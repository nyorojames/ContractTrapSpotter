import type { LLMConfig, LLMProviderInterface, LLMRequest } from '../types';

export class OpenAIProvider implements LLMProviderInterface {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async call(request: LLMRequest): Promise<string> {
    const model = this.config.model || 'gpt-4o-mini';
    const url = 'https://api.openai.com/v1/chat/completions';

    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userPrompt },
      ],
      temperature: 0.1,
    };

    if (request.jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content || '';
  }
}
