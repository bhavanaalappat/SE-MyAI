import 'dotenv/config';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { assertCorpusSearchable } from './rag';
import { ecommerceRequirementsAgent, ecommerceSdlcSelectionAgent, myAiCoordinator } from './ecommerce-agents';
import { ecommerceRequirementsThenSdlc } from './ecommerce-workflow';
import { ecommerceWorkspace } from './workspace';

export const mastra = new Mastra({
  agents: {
    myAiCoordinator,
    ecommerceRequirementsAgent,
    ecommerceSdlcSelectionAgent,
  },
  workflows: { ecommerceRequirementsThenSdlc },
  storage: new LibSQLStore({
    id: 'myai-storage',
    url: process.env.MASTRA_DATABASE_URL ?? 'file:./myai.db',
  }),
});

// Retrieval-only workspace: do not attach it globally, so corpus text is not
// injected as an extra system message outside the controlled RAG processor.
await ecommerceWorkspace.init();
await assertCorpusSearchable();
