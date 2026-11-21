import { Agent } from '@mastra/core/agent';
import { chatModel } from './lm-studio';
import { requirementsRagProcessor, sdlcRagProcessor } from './rag';
import { ECOMMERCE_REQUIREMENTS_PROMPT, ECOMMERCE_SDLC_PROMPT } from './ecommerce-prompts';

/**
 * Output budgets (tokens). Prompts also enforce word limits, so these are a
 * safety net rather than the primary control.
 * Approx. total per call: instructions ~600 + evidence ~450 + input + output.
 * Use an LM Studio context length of at least 8192.
 */
export const OUTPUT_LIMITS = {
  requirements: 1500,
  sdlc: 2000,
  coordinator: 300,
} as const;

export const ecommerceRequirementsAgent = new Agent({
  id: 'ecommerce-requirements-agent',
  name: 'E-commerce Requirements Agent',
  description: 'Builds a traceable, evidence-grounded requirements profile for e-commerce software.',
  instructions: ECOMMERCE_REQUIREMENTS_PROMPT,
  model: chatModel,
  defaultOptions: { modelSettings: { maxOutputTokens: OUTPUT_LIMITS.requirements } },
  inputProcessors: [requirementsRagProcessor],
});

export const ecommerceSdlcSelectionAgent = new Agent({
  id: 'ecommerce-sdlc-selection-agent',
  name: 'E-commerce SDLC Recommendation Agent',
  description: 'Ranks SDLC options and generates a project-specific e-commerce workflow.',
  instructions: ECOMMERCE_SDLC_PROMPT,
  model: chatModel,
  defaultOptions: { modelSettings: { maxOutputTokens: OUTPUT_LIMITS.sdlc } },
  inputProcessors: [sdlcRagProcessor],
});

export const myAiCoordinator = new Agent({
  id: 'myai-coordinator',
  name: 'myAI Coordinator',
  description: 'Coordinates evidence-grounded e-commerce requirements and SDLC analysis.',
  instructions: 'Do not draft requirements or an SDLC directly. Use the ecommerce-requirements-then-sdlc workflow for complete analysis. Remind users that regulatory, payment, security, and release decisions require authorized human approval.',
  model: chatModel,
  defaultOptions: { modelSettings: { maxOutputTokens: OUTPUT_LIMITS.coordinator } },
});