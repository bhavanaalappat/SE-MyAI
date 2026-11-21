import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { InputProcessorOrWorkflow, ProcessInputArgs, ProcessInputResult } from '@mastra/core/processors';
import { ecommerceWorkspace, workspaceRoot } from './workspace';

/** Retrieval budget. Worst case ≈ 3 excerpts × ~550 chars ≈ 450 tokens per agent call. */
export const RETRIEVAL_LIMITS = {
  topK: 2, // BM25 hits per search
  maxQueryChars: 700, // BM25 query length (keeps long requirement profiles cheap)
  maxExcerptChars: 500, // per evidence excerpt
  maxFallbackChars: 1500, // fallback excerpt if BM25 fails
  maxEvidenceItems: 3, // after de-duplication, per agent call
} as const;

// The only file used for retrieval. Do not index CSV or other corpus files.
const CORPUS_FILE = 'ecommerce-software-sdlc.md';
const CORPUS_PATH = join(workspaceRoot, 'docs/ingested/ecommerce', CORPUS_FILE);

// One short domain query per agent (instead of three broad searches).
const REQUIREMENTS_DOMAIN_QUERY = 'e-commerce checkout payments inventory fulfilment security privacy';
const SDLC_DOMAIN_QUERY = 'software development lifecycle testing review release security';

type Hit = { id: string; content: string; limit?: number };

const URL_RE = /https?:\/\/[^\s)>\]]+/g;
const flat = (text: string) => text.replace(/\s+/g, ' ').trim();

const partText = (part: unknown): string => {
  if (typeof part === 'string') return part;
  if (!part || typeof part !== 'object') return '';
  const record = part as Record<string, unknown>;
  if (typeof record.text === 'string') return record.text;
  if (typeof record.content === 'string') return record.content;
  return '';
};

const messageText = (message: { content?: unknown }): string => {
  const content = message.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(partText).join('\n');
  if (content && typeof content === 'object') {
    const record = content as Record<string, unknown>;
    if (typeof record.content === 'string') return record.content;
    if (Array.isArray(record.parts)) return record.parts.map(partText).join('\n');
  }
  return '';
};

const queryFromMessages = (messages: Array<{ role?: string; content?: unknown }>) => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role !== 'user') continue;
    const text = messageText(message).trim();
    if (text && !text.startsWith('/')) return text;
  }
  return '';
};

const queryTerms = (query: string) => new Set(query.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? []);

/** Pick the paragraph that overlaps most with the query terms. */
const bestParagraph = (content: string, wanted: Set<string>) => {
  let text = '';
  let score = -1;
  for (const paragraph of content.split(/\n\s*\n/)) {
    const lower = paragraph.toLowerCase();
    let current = 0;
    for (const term of wanted) if (lower.includes(term)) current += 1;
    if (current > score) {
      text = paragraph;
      score = current;
    }
  }
  return { text, score: Math.max(score, 0) };
};

let corpusCache: string | undefined;
const loadCorpus = async () => {
  if (corpusCache !== undefined) return corpusCache;
  try {
    corpusCache = await readFile(CORPUS_PATH, 'utf8');
    return corpusCache;
  } catch {
    return '';
  }
};

/** Short, relevant excerpt only — never the whole corpus. */
const fallbackEvidence = async (query: string): Promise<Hit[]> => {
  const corpus = await loadCorpus();
  if (!corpus) return [];
  const { text, score } = bestParagraph(corpus, queryTerms(query));
  if (!text || score === 0) return [];
  return [{ id: CORPUS_FILE, content: text.slice(0, RETRIEVAL_LIMITS.maxFallbackChars), limit: RETRIEVAL_LIMITS.maxFallbackChars }];
};

export const retrieveEvidence = async (query: string): Promise<Hit[]> => {
  const trimmed = flat(query).slice(0, RETRIEVAL_LIMITS.maxQueryChars);
  if (trimmed.length < 8) return [];
  try {
    const hits = await ecommerceWorkspace.search(trimmed, { mode: 'bm25', topK: RETRIEVAL_LIMITS.topK });
    const usable = hits
      .filter((hit) => String(hit.id).includes(CORPUS_FILE))
      .slice(0, RETRIEVAL_LIMITS.topK)
      .map((hit) => ({ id: String(hit.id), content: String(hit.content ?? '') }))
      .filter((hit) => hit.content.trim().length > 0);
    if (usable.length > 0) return usable;
  } catch (error) {
    console.warn('[rag] BM25 search failed, using short fallback excerpt:', error instanceof Error ? error.message : error);
  }
  return fallbackEvidence(trimmed);
};

const mergeHits = (...lists: Hit[][]): Hit[] => {
  const seen = new Set<string>();
  const merged: Hit[] = [];
  for (const list of lists) {
    for (const hit of list) {
      // One corpus file means many hits share an id, so key on id + content start.
      const key = `${hit.id}|${flat(hit.content).slice(0, 120)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(hit);
    }
  }
  return merged.slice(0, RETRIEVAL_LIMITS.maxEvidenceItems);
};

const excerpt = (hit: Hit, wanted: Set<string>) => {
  const max = hit.limit ?? RETRIEVAL_LIMITS.maxExcerptChars;
  const { text } = bestParagraph(hit.content, wanted);
  let out = flat(text || hit.content).slice(0, max);
  // Keep a source URL available for citation even if the excerpt was cut.
  const before = hit.content.slice(0, Math.max(0, hit.content.indexOf(text)));
  const url = text.match(URL_RE)?.[0] ?? before.match(URL_RE)?.pop();
  if (url && !out.includes(url)) out += ` [URL: ${url}]`;
  return out;
};

export const formatEvidence = (hits: Hit[], focus = '') => {
  if (hits.length === 0) {
    return 'Retrieved evidence: none. Mark claims about existing software, vendors, legal/payment rules, and numeric thresholds NEEDS-VALIDATION. Do not invent citations.';
  }
  const wanted = queryTerms(focus);
  return [
    'Retrieved evidence (comparative only; cite source ID and URL):',
    ...hits.map((hit, index) => `[${index + 1}] ${hit.id}: ${excerpt(hit, wanted)}`),
  ].join('\n');
};

const createRagProcessor = (id: string, name: string, domainQuery: string) =>
  ({
    id,
    name,
    async processInput({ messages, systemMessages }: ProcessInputArgs): Promise<ProcessInputResult> {
      const query = queryFromMessages(messages);
      if (!query) return { messages, systemMessages };
      const [primary, domain] = await Promise.all([retrieveEvidence(query), retrieveEvidence(domainQuery)]);
      const evidence = formatEvidence(mergeHits(primary, domain), `${query.slice(0, RETRIEVAL_LIMITS.maxQueryChars)} ${domainQuery}`);
      const systemContent = systemMessages.map((message) => messageText(message)).filter(Boolean).join('\n\n');
      return {
        messages,
        systemMessages: [{ role: 'system', content: [systemContent, evidence].filter(Boolean).join('\n\n') }],
      };
    },
  }) as InputProcessorOrWorkflow;

/** Requirements agent: user brief + one e-commerce domain query. */
export const requirementsRagProcessor = createRagProcessor(
  'ecommerce-requirements-rag-processor',
  'E-commerce Requirements Evidence Retrieval',
  REQUIREMENTS_DOMAIN_QUERY,
);

/** SDLC agent: requirements profile + one SDLC query. */
export const sdlcRagProcessor = createRagProcessor(
  'ecommerce-sdlc-rag-processor',
  'E-commerce SDLC Evidence Retrieval',
  SDLC_DOMAIN_QUERY,
);

/** Backwards-compatible alias for any other file that still imports the old name. */
export const ragContextProcessor = requirementsRagProcessor;

export const assertCorpusSearchable = async () => {
  const hits = await retrieveEvidence('e-commerce software SDLC testing security release');
  if (hits.length === 0) throw new Error('E-commerce corpus returned no BM25 hits');
};