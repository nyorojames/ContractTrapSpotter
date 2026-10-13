import type { LLMConfig, LLMProviderInterface } from './types';
import { GeminiProvider } from './providers/gemini';
import { OpenAIProvider } from './providers/openai';
import { AnthropicProvider } from './providers/anthropic';

export type { LLMConfig, LLMProvider, LLMProviderInterface, LLMRequest } from './types';

export function createLLMProvider(config: LLMConfig): LLMProviderInterface {
  switch (config.provider) {
    case 'gemini':
      return new GeminiProvider(config);
    case 'openai':
      return new OpenAIProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}
