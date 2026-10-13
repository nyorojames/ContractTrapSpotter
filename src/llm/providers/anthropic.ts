import type { LLMConfig, LLMProviderInterface, LLMRequest } from '../types';

export class AnthropicProvider implements LLMProviderInterface {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async call(request: LLMRequest): Promise<string> {
    const model = this.config.model || 'claude-sonnet-4-20250514';
    const url = 'https://api.anthropic.com/v1/messages';

    const body = {
      model,
      max_tokens: 4096,
      system: request.systemPrompt,
      messages: [
        { role: 'user', content: request.userPrompt },
      ],
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    const textBlock = data?.content?.find((b: { type: string }) => b.type === 'text');
    return textBlock?.text || '';
  }
}
