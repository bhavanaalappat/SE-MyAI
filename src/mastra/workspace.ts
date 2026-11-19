import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { LocalFilesystem, Workspace } from '@mastra/core/workspace';

export const workspaceRoot = [
  process.env.MYAI_WORKSPACE_ROOT,
  process.env.INIT_CWD,
  process.cwd(),
  resolve(process.cwd(), '../../..'),
].find((path): path is string => Boolean(path && existsSync(join(path, 'docs/ingested')))) ?? process.cwd();

export const ecommerceWorkspace = new Workspace({
  id: 'myai-ecommerce-workspace',
  filesystem: new LocalFilesystem({ basePath: workspaceRoot, readOnly: true }),
  bm25: true,
  autoIndexPaths: ['docs/ingested/**/*.md', 'docs/ingested/**/*.txt', 'docs/ingested/**/*.yaml'],
  tools: { enabled: false },
});
