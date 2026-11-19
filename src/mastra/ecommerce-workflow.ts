import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { ecommerceRequirementsAgent, ecommerceSdlcSelectionAgent } from './ecommerce-agents';
import { workspaceRoot } from './workspace';

const previewDir = join(workspaceRoot, 'artifacts/ecommerce-sdlc');

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

const htmlPreview = (markdown: string) => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>myAI E-commerce SDLC Recommendation</title><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.8.1/github-markdown.min.css"/><style>body{box-sizing:border-box;min-width:200px;max-width:1100px;margin:0 auto;padding:45px;}</style></head><body class="markdown-body"><pre style="white-space:pre-wrap">${markdown.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] ?? c))}</pre></body></html>`;

const profileRequirements = createStep({
  id: 'profile-ecommerce-requirements',
  description: 'Create an evidence-grounded e-commerce requirements profile.',
  inputSchema: z.object({ prompt: z.string() }),
  outputSchema: z.object({ requirements: z.string() }),
  execute: async ({ inputData }) => {
    const result = await ecommerceRequirementsAgent.generate(inputData.prompt);
    const requirements = textFromGenerateResult(result);
    if (!requirements) throw new Error('E-commerce Requirements Agent returned no text');
    return { requirements };
  },
});

const recommendEcommerceSdlc = createStep({
  id: 'recommend-ecommerce-sdlc',
  description: 'Rank SDLC options and produce a project-specific e-commerce workflow.',
  inputSchema: z.object({ requirements: z.string() }),
  outputSchema: z.object({ requirements: z.string(), sdlc: z.string(), document: z.string() }),
  execute: async ({ inputData }) => {
    const result = await ecommerceSdlcSelectionAgent.generate(`Recommend an SDLC for this e-commerce requirements profile.\n\n${inputData.requirements}`);
    const sdlc = textFromGenerateResult(result);
    if (!sdlc) throw new Error('E-commerce SDLC Recommendation Agent returned no text');
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
    const markdownPath = join(previewDir, 'latest.md');
    const htmlPath = join(previewDir, 'latest.html');
    await writeFile(markdownPath, `${inputData.document.trim()}\n`, 'utf8');
    await writeFile(htmlPath, htmlPreview(inputData.document), 'utf8');
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
