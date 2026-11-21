import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { ecommerceRequirementsAgent, ecommerceSdlcSelectionAgent } from './ecommerce-agents';
import { workspaceRoot } from './workspace';

const previewDir = join(workspaceRoot, 'artifacts/ecommerce-sdlc');

// Size safeguards (characters; ~4 chars per token).
const LIMITS = {
  maxPromptChars: 6000, // user brief sent to the Requirements Agent
  maxProfileChars: 7000, // requirements profile sent to the SDLC Agent
  maxDocumentChars: 40000, // combined artifact written to disk
} as const;

const clip = (text: string, max: number, label: string) => {
  if (text.length <= max) return text;
  console.warn(`[workflow] ${label} was ${text.length} chars; clipped to ${max}.`);
  return `${text.slice(0, max).trimEnd()}\n\n[${label} clipped to ${max} characters]`;
};

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | undefined =>
  value && typeof value === 'object' ? value as UnknownRecord : undefined;

const textFromContent = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(textFromContent).filter(Boolean).join('\n');
  const record = asRecord(value);
  if (!record) return '';
  for (const key of ['text', 'content', 'output_text']) {
    const candidate = record[key];
    if (typeof candidate === 'string') return candidate;
  }
  if (Array.isArray(record.parts)) return textFromContent(record.parts);
  return '';
};

const textFromGenerateResult = (result: unknown): string => {
  const root = asRecord(result);
  if (!root) return '';

  // Current Mastra/AI SDK result shape.
  const direct = textFromContent(root.text);
  if (direct.trim()) return direct.trim();

  // Some provider versions expose the assistant response under response.messages.
  const response = asRecord(root.response);
  const messages = response?.messages;
  if (Array.isArray(messages)) {
    const assistantText = messages
      .filter((message) => asRecord(message)?.role === 'assistant')
      .map((message) => textFromContent(asRecord(message)?.content))
      .filter(Boolean)
      .join('\n');
    if (assistantText.trim()) return assistantText.trim();
  }

  // OpenAI-compatible fallback shape, useful with local LM Studio servers.
  const choices = response?.choices ?? root.choices;
  if (Array.isArray(choices)) {
    const choice = asRecord(choices[0]);
    const message = asRecord(choice?.message);
    const choiceText = textFromContent(message?.content ?? choice?.text);
    if (choiceText.trim()) return choiceText.trim();
  }

  return '';
};

const markIfTruncated = (result: unknown, text: string, label: string) => {
  if (asRecord(result)?.finishReason !== 'length') return text;
  console.warn(`[workflow] ${label} hit the output token limit and was cut off.`);
  return `${text}\n\n> NOTE: ${label} output was cut off at the token limit. Treat it as incomplete.`;
};

const htmlPreview = (markdown: string) => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>myAI E-commerce SDLC Recommendation</title><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.8.1/github-markdown.min.css"/><style>body{box-sizing:border-box;min-width:200px;max-width:1100px;margin:0 auto;padding:45px;}</style></head><body class="markdown-body"><pre style="white-space:pre-wrap">${markdown.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] ?? c))}</pre></body></html>`;

const profileRequirements = createStep({
  id: 'profile-ecommerce-requirements',
  description: 'Create an evidence-grounded e-commerce requirements profile.',
  inputSchema: z.object({ prompt: z.string() }),
  outputSchema: z.object({ requirements: z.string() }),
  execute: async ({ inputData }) => {
    const result = await ecommerceRequirementsAgent.generate(clip(inputData.prompt, LIMITS.maxPromptChars, 'Project brief'));
    const text = textFromGenerateResult(result);
    if (!text) throw new Error('E-commerce Requirements Agent returned no text (check LM Studio is running and the model is loaded)');
    return { requirements: markIfTruncated(result, text, 'Requirements profile') };
  },
});

const recommendEcommerceSdlc = createStep({
  id: 'recommend-ecommerce-sdlc',
  description: 'Rank SDLC options and produce a project-specific e-commerce workflow.',
  inputSchema: z.object({ requirements: z.string() }),
  outputSchema: z.object({ requirements: z.string(), sdlc: z.string(), document: z.string() }),
  execute: async ({ inputData }) => {
    // Only the concise requirements profile is passed on; the original brief is not repeated.
    const profile = clip(inputData.requirements, LIMITS.maxProfileChars, 'Requirements profile');
    const result = await ecommerceSdlcSelectionAgent.generate(`Recommend an SDLC for this requirements profile.\n\n${profile}`);
    const text = textFromGenerateResult(result);
    if (!text) throw new Error('E-commerce SDLC Recommendation Agent returned no text (check LM Studio is running and the model is loaded)');
    const sdlc = markIfTruncated(result, text, 'SDLC recommendation');
    return { requirements: inputData.requirements, sdlc, document: `${inputData.requirements.trim()}\n\n---\n\n${sdlc.trim()}` };
  },
});

const writeEcommercePreview = createStep({
  id: 'write-ecommerce-preview',
  description: 'Write Markdown and HTML e-commerce SDLC recommendation previews.',
  inputSchema: z.object({ requirements: z.string(), sdlc: z.string(), document: z.string() }),
  outputSchema: z.object({ requirements: z.string(), sdlc: z.string(), document: z.string(), markdownPath: z.string(), htmlPath: z.string() }),
  execute: async ({ inputData }) => {
    await mkdir(previewDir, { recursive: true });
    const document = clip(inputData.document, LIMITS.maxDocumentChars, 'Document');
    const markdownPath = join(previewDir, 'latest.md');
    const htmlPath = join(previewDir, 'latest.html');
    await writeFile(markdownPath, `${document.trim()}\n`, 'utf8');
    await writeFile(htmlPath, htmlPreview(document), 'utf8');
    return { ...inputData, markdownPath, htmlPath };
  },
});

export const ecommerceRequirementsThenSdlc = createWorkflow({
  id: 'ecommerce-requirements-then-sdlc',
  description: 'Profile e-commerce requirements, rank SDLC options, and write an evidence-grounded workflow.',
  inputSchema: z.object({ prompt: z.string() }),
  outputSchema: z.object({ requirements: z.string(), sdlc: z.string(), document: z.string(), markdownPath: z.string(), htmlPath: z.string() }),
})
  .then(profileRequirements)
  .then(recommendEcommerceSdlc)
  .then(writeEcommercePreview)
  .commit();

export const runEcommerceRequirementsThenSdlc = async (prompt: string) => {
  const run = await ecommerceRequirementsThenSdlc.createRun();
  const result = await run.start({ inputData: { prompt } });
  if (result.status !== 'success') {
    const message = result.status === 'failed' ? result.error.message : result.status;
    throw new Error(`myAI workflow failed: ${message}`);
  }
  return result.result;
};