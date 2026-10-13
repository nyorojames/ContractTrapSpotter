/**
 * LLM provider abstraction.
 * Supports Gemini, OpenAI, and Anthropic.
 * Provider is swappable via the options page.
 */

export type LLMProvider = 'gemini' | 'openai' | 'anthropic';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model?: string;
}

export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
  jsonMode: boolean;
}

export interface LLMProviderInterface {
  call(request: LLMRequest): Promise<string>;
}
