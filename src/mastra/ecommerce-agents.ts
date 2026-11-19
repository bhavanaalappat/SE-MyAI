import { Agent } from '@mastra/core/agent';
import { chatModel } from './lm-studio';
import { ragContextProcessor } from './rag';
import { ECOMMERCE_REQUIREMENTS_PROMPT, ECOMMERCE_SDLC_PROMPT } from './ecommerce-prompts';

const baseOptions = {
  modelSettings: { maxOutputTokens: 2200 },
} as const;

export const ecommerceRequirementsAgent = new Agent({
  id: 'ecommerce-requirements-agent',
  name: 'E-commerce Requirements Agent',
  description: 'Builds a traceable, evidence-grounded requirements profile for e-commerce software.',
  instructions: ECOMMERCE_REQUIREMENTS_PROMPT,
  model: chatModel,
  defaultOptions: baseOptions,
  inputProcessors: [ragContextProcessor],
});

export const ecommerceSdlcSelectionAgent = new Agent({
  id: 'ecommerce-sdlc-selection-agent',
  name: 'E-commerce SDLC Recommendation Agent',
  description: 'Ranks SDLC options and generates a project-specific e-commerce workflow.',
  instructions: ECOMMERCE_SDLC_PROMPT,
  model: chatModel,
  defaultOptions: {
    ...baseOptions,
    modelSettings: { maxOutputTokens: 3000 },
  },
  inputProcessors: [ragContextProcessor],
});

export const myAiCoordinator = new Agent({
  id: 'myai-coordinator',
  name: 'myAI Coordinator',
  description: 'Coordinates evidence-grounded e-commerce requirements and SDLC analysis.',
  instructions: 'Do not draft requirements or an SDLC directly. Use the ecommerce-requirements-then-sdlc workflow for complete analysis. Remind users that regulatory, payment, security, and release decisions require authorized human approval.',
  model: chatModel,
  defaultOptions: { modelSettings: { maxOutputTokens: 300 } },
});
