import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { config } from './config';

// Qwen 3.5 "thinking" tokens count against maxOutputTokens and are not returned
// as text, which makes steps fail with "reached its maximum output length".
// Ask the server to disable thinking on every chat request. Set
// LMSTUDIO_DISABLE_THINKING=false to turn this off.
const disableThinking = process.env.LMSTUDIO_DISABLE_THINKING !== 'false';

const fetchWithoutThinking: typeof fetch = async (input, init) => {
  if (disableThinking && typeof init?.body === 'string') {
    try {
      const body = JSON.parse(init.body) as Record<string, unknown>;
      body.chat_template_kwargs = { ...(body.chat_template_kwargs as object | undefined), enable_thinking: false };
      return fetch(input, { ...init, body: JSON.stringify(body) });
    } catch {
      // Not JSON: send the request unchanged.
    }
  }
  return fetch(input, init);
};

export const lmStudio = createOpenAICompatible({
  name: 'lm-studio',
  baseURL: config.lmStudio.baseURL,
  apiKey: config.lmStudio.apiKey,
  fetch: fetchWithoutThinking,
});

export const chatModel = lmStudio.chatModel(config.lmStudio.model);