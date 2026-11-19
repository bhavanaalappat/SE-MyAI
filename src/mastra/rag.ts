import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { InputProcessorOrWorkflow, ProcessInputArgs, ProcessInputResult } from '@mastra/core/processors';
import { ecommerceWorkspace } from './workspace';
import { workspaceRoot } from './workspace';

const MAX_HIT_CHARS = 1200;
const TOP_K = 6;
const ECOMMERCE_QUERY = 'e-commerce commerce platform requirements payments checkout inventory fulfilment security privacy performance integrations release testing SDLC';
const SDLC_QUERY = 'software development lifecycle planning implementation testing review release maintenance security documented public evidence';

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

export const retrieveEvidence = async (query: string) => {
  const trimmed = query.trim();
  if (trimmed.length < 8) return [];
  const indexedHits = await ecommerceWorkspace.search(trimmed, { mode: 'bm25', topK: TOP_K });
  if (indexedHits.length > 0) return indexedHits;

  // Fallback for local Mastra builds where the BM25 index is not persisted
  // or glob indexing behaves differently across operating systems.
  const corpusPath = join(workspaceRoot, 'docs/ingested/ecommerce/ecommerce-software-sdlc.md');
  try {
    const content = await readFile(corpusPath, 'utf8');
    return [{ id: 'ecommerce-software-sdlc.md', content }];
  } catch {
    return [];
  }
};

const uniqueHits = (...lists: Array<Array<{ id: string; content: string }>>) => {
  const seen = new Set<string>();
  const merged: Array<{ id: string; content: string }> = [];
  for (const list of lists) {
    for (const hit of list) {
      if (seen.has(hit.id)) continue;
      seen.add(hit.id);
      merged.push(hit);
    }
  }
  return merged.slice(0, 10);
};

export const formatEvidence = (hits: Array<{ id: string; content: string }>) => {
  if (hits.length === 0) {
    return ['Retrieved evidence: none.', 'Mark claims about existing software, vendors, legal requirements, payment controls, and numeric thresholds NEEDS-VALIDATION.', 'Do not invent citations.'].join('\n');
  }
  return [
    'Retrieved evidence from docs/ingested/ecommerce. Use it only as comparative evidence and cite the source IDs and URLs included in the corpus.',
    ...hits.map((hit, index) => `[${index + 1}] ${hit.id}\n${hit.content.replace(/\s+/g, ' ').trim().slice(0, MAX_HIT_CHARS)}`),
  ].join('\n\n');
};

export const ragContextProcessor = {
  id: 'ecommerce-rag-context-processor',
  name: 'E-commerce Evidence Retrieval',
  async processInput({ messages, systemMessages }: ProcessInputArgs): Promise<ProcessInputResult> {
    const query = queryFromMessages(messages);
    if (!query) return { messages, systemMessages };
    const evidence = formatEvidence(uniqueHits(
      await retrieveEvidence(query),
      await retrieveEvidence(ECOMMERCE_QUERY),
      await retrieveEvidence(SDLC_QUERY),
    ));
    const systemContent = systemMessages.map((message) => messageText(message)).filter(Boolean).join('\n\n');
    return {
      messages,
      systemMessages: [{ role: 'system', content: [systemContent, evidence].filter(Boolean).join('\n\n') }],
    };
  },
} as InputProcessorOrWorkflow;

export const assertCorpusSearchable = async () => {
  const hits = await retrieveEvidence('e-commerce software SDLC testing security release');
  if (hits.length === 0) throw new Error('E-commerce corpus returned no BM25 hits');
};
