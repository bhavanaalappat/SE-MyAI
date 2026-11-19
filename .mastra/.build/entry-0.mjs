import 'dotenv/config';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { Workspace, LocalFilesystem } from '@mastra/core/workspace';
import { Agent } from '@mastra/core/agent';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { setDefaultResultOrder } from 'node:dns';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

"use strict";
const workspaceRoot = [
  process.env.MYAI_WORKSPACE_ROOT,
  process.env.INIT_CWD,
  process.cwd(),
  resolve(process.cwd(), "../../..")
].find((path) => Boolean(path && existsSync(join(path, "docs/ingested")))) ?? process.cwd();
const ecommerceWorkspace = new Workspace({
  id: "myai-ecommerce-workspace",
  filesystem: new LocalFilesystem({ basePath: workspaceRoot, readOnly: true }),
  bm25: true,
  autoIndexPaths: ["docs/ingested/**/*.md", "docs/ingested/**/*.txt", "docs/ingested/**/*.yaml"],
  tools: { enabled: false }
});

"use strict";
const MAX_HIT_CHARS = 1200;
const TOP_K = 6;
const ECOMMERCE_QUERY = "e-commerce commerce platform requirements payments checkout inventory fulfilment security privacy performance integrations release testing SDLC";
const SDLC_QUERY = "software development lifecycle planning implementation testing review release maintenance security documented public evidence";
const partText = (part) => {
  if (typeof part === "string") return part;
  if (!part || typeof part !== "object") return "";
  const record = part;
  if (typeof record.text === "string") return record.text;
  if (typeof record.content === "string") return record.content;
  return "";
};
const messageText = (message) => {
  const content = message.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(partText).join("\n");
  if (content && typeof content === "object") {
    const record = content;
    if (typeof record.content === "string") return record.content;
    if (Array.isArray(record.parts)) return record.parts.map(partText).join("\n");
  }
  return "";
};
const queryFromMessages = (messages) => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role !== "user") continue;
    const text = messageText(message).trim();
    if (text && !text.startsWith("/")) return text;
  }
  return "";
};
const retrieveEvidence = async (query) => {
  const trimmed = query.trim();
  if (trimmed.length < 8) return [];
  const indexedHits = await ecommerceWorkspace.search(trimmed, { mode: "bm25", topK: TOP_K });
  if (indexedHits.length > 0) return indexedHits;
  const corpusPath = join(workspaceRoot, "docs/ingested/ecommerce/ecommerce-software-sdlc.md");
  try {
    const content = await readFile(corpusPath, "utf8");
    return [{ id: "ecommerce-software-sdlc.md", content }];
  } catch {
    return [];
  }
};
const uniqueHits = (...lists) => {
  const seen = /* @__PURE__ */ new Set();
  const merged = [];
  for (const list of lists) {
    for (const hit of list) {
      if (seen.has(hit.id)) continue;
      seen.add(hit.id);
      merged.push(hit);
    }
  }
  return merged.slice(0, 10);
};
const formatEvidence = (hits) => {
  if (hits.length === 0) {
    return ["Retrieved evidence: none.", "Mark claims about existing software, vendors, legal requirements, payment controls, and numeric thresholds NEEDS-VALIDATION.", "Do not invent citations."].join("\n");
  }
  return [
    "Retrieved evidence from docs/ingested/ecommerce. Use it only as comparative evidence and cite the source IDs and URLs included in the corpus.",
    ...hits.map((hit, index) => `[${index + 1}] ${hit.id}
${hit.content.replace(/\s+/g, " ").trim().slice(0, MAX_HIT_CHARS)}`)
  ].join("\n\n");
};
const ragContextProcessor = {
  id: "ecommerce-rag-context-processor",
  name: "E-commerce Evidence Retrieval",
  async processInput({ messages, systemMessages }) {
    const query = queryFromMessages(messages);
    if (!query) return { messages, systemMessages };
    const evidence = formatEvidence(uniqueHits(
      await retrieveEvidence(query),
      await retrieveEvidence(ECOMMERCE_QUERY),
      await retrieveEvidence(SDLC_QUERY)
    ));
    const systemContent = systemMessages.map((message) => messageText(message)).filter(Boolean).join("\n\n");
    return {
      messages,
      systemMessages: [{ role: "system", content: [systemContent, evidence].filter(Boolean).join("\n\n") }]
    };
  }
};
const assertCorpusSearchable = async () => {
  const hits = await retrieveEvidence("e-commerce software SDLC testing security release");
  if (hits.length === 0) throw new Error("E-commerce corpus returned no BM25 hits");
};

"use strict";
setDefaultResultOrder("ipv4first");
const value = (name, fallback) => {
  const configured = process.env[name]?.trim();
  if (configured) return configured;
  if (fallback !== void 0) return fallback;
  throw new Error(`Missing required environment variable: ${name}`);
};
const config = {
  lmStudio: {
    baseURL: value("LM_STUDIO_BASE_URL", "http://127.0.0.1:1234/v1"),
    apiKey: value("LM_STUDIO_API_KEY", "lm-studio"),
    model: value("LM_STUDIO_MODEL", "qwen/qwen3.5-9b")
  }
};

"use strict";
const lmStudio = createOpenAICompatible({
  name: "lm-studio",
  baseURL: config.lmStudio.baseURL,
  apiKey: config.lmStudio.apiKey
});
const chatModel = lmStudio.chatModel(config.lmStudio.model);

"use strict";
const ECOMMERCE_REQUIREMENTS_PROMPT = `You are the myAI E-commerce Requirements Agent. Convert the user's e-commerce project brief into an evidence-grounded requirements profile.

Do not choose an SDLC in this step. Do not greet or conduct an interview. If information is missing, state an assumption and mark it NEEDS-VALIDATION. Treat retrieved software records as comparative evidence, never as proof of what the new project must do.

Use retrieved corpus evidence only for claims about existing e-commerce software and documented public engineering practices. Cite the exact corpus source ID and URL when making such claims. Do not invent regulatory requirements, payment-provider behavior, security controls, service-level targets, or vendor practices.

Return Markdown only, with exactly these headings:
# E-commerce Requirements Profile
## Summary
## Assumptions
## Stakeholders
## Product context
## Requirements
For every requirement include: ID, statement, category, source or assumption, priority, dependencies, acceptance criteria, verification method, and confidence. Use multi-label categories where appropriate: business, stakeholder, functional, security, privacy, performance, availability, reliability, usability, data-management, integration, payment, inventory, fulfilment, audit/reporting, and operational/maintenance.
## Decision factors
Extract requirement stability, business criticality, payment/data/security risk, technical complexity, legacy dependence, expected change frequency, deployment model, stakeholder availability, testing/documentation formality, budget/schedule constraints, need for formal verification, and consequence of failure.
## Quality findings
Flag ambiguity, incompleteness, inconsistency, duplication, infeasibility, lack of testability, missing source, undefined terminology, stakeholder conflict, and missing security/privacy/payment controls.
## Traceability
Link each requirement to the user's statement, an assumption, or a retrieved corpus source.
## Risks
Each risk must state its impact on the later SDLC choice.
## Open questions
List questions whose answers would materially change requirements, risk, or SDLC.

All legal, tax, PCI, privacy, payments, and jurisdiction-specific claims must be NEEDS-VALIDATION unless authoritative project evidence is supplied.`;
const ECOMMERCE_SDLC_PROMPT = `You are the myAI E-commerce SDLC Recommendation Agent. You receive a completed e-commerce requirements profile and recommend a lifecycle for the proposed project.

Use the verified e-commerce corpus as comparative evidence only. Cite corpus IDs and official URLs. Separate observed evidence from project-specific reasoning. Never claim that a software project's undocumented internal process exists. Mark unsupported legal, payment, PCI, privacy, or jurisdiction-specific claims NEEDS-VALIDATION.

Evaluate: requirement stability, business and payment criticality, customer/data privacy risk, security risk, technical uncertainty, integrations and legacy systems, expected change frequency, deployment model, stakeholder availability, testing and documentation formality, failure consequence, and need for traceable approvals.

Choose from Waterfall, V-Model, Spiral, Agile, DevSecOps, or a named hybrid. Rank at least three alternatives using numeric heuristic scores. Scores are decision-support estimates, not probabilities or empirical measurements. Explain the strengths, weaknesses, and ranking-change condition for every alternative. Require human approval for the final SDLC choice.

Return Markdown only, with exactly these headings:
# E-commerce SDLC Recommendation
## Decision factors
Use a table with factor, evidence from requirement IDs, implication, and confidence.
## Ranked recommendations
Rank at least three options with heuristic scores, strengths, weaknesses, and conditions that would change the ranking.
## Recommended SDLC
Name one primary lifecycle and explain why it fits this project.
## Project-specific workflow
For each phase provide activities, responsible roles, deliverables, e-commerce security and payment/data-protection activities, testing, validation gates, entry/exit criteria, and requirement IDs.
## Evidence and traceability
Cite corpus paths and source URLs. Separate observed evidence from reasoning.
## Human approvals
Identify approvals needed from product, architecture, security, privacy, payment/compliance, operations, and release stakeholders.
## Residual risk and validation plan
State uncertainty, evidence gaps, and how to validate them before implementation or production.`;

"use strict";
const baseOptions = {
  modelSettings: { maxOutputTokens: 2200 }
};
const ecommerceRequirementsAgent = new Agent({
  id: "ecommerce-requirements-agent",
  name: "E-commerce Requirements Agent",
  description: "Builds a traceable, evidence-grounded requirements profile for e-commerce software.",
  instructions: ECOMMERCE_REQUIREMENTS_PROMPT,
  model: chatModel,
  defaultOptions: baseOptions,
  inputProcessors: [ragContextProcessor]
});
const ecommerceSdlcSelectionAgent = new Agent({
  id: "ecommerce-sdlc-selection-agent",
  name: "E-commerce SDLC Recommendation Agent",
  description: "Ranks SDLC options and generates a project-specific e-commerce workflow.",
  instructions: ECOMMERCE_SDLC_PROMPT,
  model: chatModel,
  defaultOptions: {
    ...baseOptions,
    modelSettings: { maxOutputTokens: 3e3 }
  },
  inputProcessors: [ragContextProcessor]
});
const myAiCoordinator = new Agent({
  id: "myai-coordinator",
  name: "myAI Coordinator",
  description: "Coordinates evidence-grounded e-commerce requirements and SDLC analysis.",
  instructions: "Do not draft requirements or an SDLC directly. Use the ecommerce-requirements-then-sdlc workflow for complete analysis. Remind users that regulatory, payment, security, and release decisions require authorized human approval.",
  model: chatModel,
  defaultOptions: { modelSettings: { maxOutputTokens: 300 } }
});

"use strict";
const previewDir = join(workspaceRoot, "artifacts/ecommerce-sdlc");
const asRecord = (value) => value && typeof value === "object" ? value : void 0;
const textFromContent = (value) => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textFromContent).filter(Boolean).join("\n");
  const record = asRecord(value);
  if (!record) return "";
  for (const key of ["text", "content", "output_text"]) {
    const candidate = record[key];
    if (typeof candidate === "string") return candidate;
  }
  if (Array.isArray(record.parts)) return textFromContent(record.parts);
  return "";
};
const textFromGenerateResult = (result) => {
  const root = asRecord(result);
  if (!root) return "";
  const direct = textFromContent(root.text);
  if (direct.trim()) return direct.trim();
  const response = asRecord(root.response);
  const messages = response?.messages;
  if (Array.isArray(messages)) {
    const assistantText = messages.filter((message) => asRecord(message)?.role === "assistant").map((message) => textFromContent(asRecord(message)?.content)).filter(Boolean).join("\n");
    if (assistantText.trim()) return assistantText.trim();
  }
  const choices = response?.choices ?? root.choices;
  if (Array.isArray(choices)) {
    const choice = asRecord(choices[0]);
    const message = asRecord(choice?.message);
    const choiceText = textFromContent(message?.content ?? choice?.text);
    if (choiceText.trim()) return choiceText.trim();
  }
  return "";
};
const htmlPreview = (markdown) => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>myAI E-commerce SDLC Recommendation</title><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.8.1/github-markdown.min.css"/><style>body{box-sizing:border-box;min-width:200px;max-width:1100px;margin:0 auto;padding:45px;}</style></head><body class="markdown-body"><pre style="white-space:pre-wrap">${markdown.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c)}</pre></body></html>`;
const profileRequirements = createStep({
  id: "profile-ecommerce-requirements",
  description: "Create an evidence-grounded e-commerce requirements profile.",
  inputSchema: z.object({ prompt: z.string() }),
  outputSchema: z.object({ requirements: z.string() }),
  execute: async ({ inputData }) => {
    const result = await ecommerceRequirementsAgent.generate(inputData.prompt);
    const requirements = textFromGenerateResult(result);
    if (!requirements) throw new Error("E-commerce Requirements Agent returned no text");
    return { requirements };
  }
});
const recommendEcommerceSdlc = createStep({
  id: "recommend-ecommerce-sdlc",
  description: "Rank SDLC options and produce a project-specific e-commerce workflow.",
  inputSchema: z.object({ requirements: z.string() }),
  outputSchema: z.object({ requirements: z.string(), sdlc: z.string(), document: z.string() }),
  execute: async ({ inputData }) => {
    const result = await ecommerceSdlcSelectionAgent.generate(`Recommend an SDLC for this e-commerce requirements profile.

${inputData.requirements}`);
    const sdlc = textFromGenerateResult(result);
    if (!sdlc) throw new Error("E-commerce SDLC Recommendation Agent returned no text");
    return { requirements: inputData.requirements, sdlc, document: `${inputData.requirements.trim()}

---

${sdlc.trim()}` };
  }
});
const writeEcommercePreview = createStep({
  id: "write-ecommerce-preview",
  description: "Write Markdown and HTML e-commerce SDLC recommendation previews.",
  inputSchema: z.object({ requirements: z.string(), sdlc: z.string(), document: z.string() }),
  outputSchema: z.object({ requirements: z.string(), sdlc: z.string(), document: z.string(), markdownPath: z.string(), htmlPath: z.string() }),
  execute: async ({ inputData }) => {
    await mkdir(previewDir, { recursive: true });
    const markdownPath = join(previewDir, "latest.md");
    const htmlPath = join(previewDir, "latest.html");
    await writeFile(markdownPath, `${inputData.document.trim()}
`, "utf8");
    await writeFile(htmlPath, htmlPreview(inputData.document), "utf8");
    return { ...inputData, markdownPath, htmlPath };
  }
});
const ecommerceRequirementsThenSdlc = createWorkflow({
  id: "ecommerce-requirements-then-sdlc",
  description: "Profile e-commerce requirements, rank SDLC options, and write an evidence-grounded workflow.",
  inputSchema: z.object({ prompt: z.string() }),
  outputSchema: z.object({ requirements: z.string(), sdlc: z.string(), document: z.string(), markdownPath: z.string(), htmlPath: z.string() })
}).then(profileRequirements).then(recommendEcommerceSdlc).then(writeEcommercePreview).commit();
const runEcommerceRequirementsThenSdlc = async (prompt) => {
  const run = await ecommerceRequirementsThenSdlc.createRun();
  const result = await run.start({ inputData: { prompt } });
  if (result.status !== "success") {
    const message = result.status === "failed" ? result.error.message : result.status;
    throw new Error(`myAI workflow failed: ${message}`);
  }
  return result.result;
};

"use strict";
const mastra = new Mastra({
  agents: {
    myAiCoordinator,
    ecommerceRequirementsAgent,
    ecommerceSdlcSelectionAgent
  },
  workflows: {
    ecommerceRequirementsThenSdlc
  },
  storage: new LibSQLStore({
    id: "myai-storage",
    url: process.env.MASTRA_DATABASE_URL ?? "file:./myai.db"
  })
});
await ecommerceWorkspace.init();
await assertCorpusSearchable();

export { mastra };
