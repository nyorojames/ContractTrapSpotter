import type { LLMConfig, LLMProviderInterface, LLMRequest } from '../types';

export class GeminiProvider implements LLMProviderInterface {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async call(request: LLMRequest): Promise<string> {
    const model = this.config.model || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.config.apiKey}`;

    const body = {
      system_instruction: {
        parts: [{ text: request.systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: request.userPrompt }],
        },
      ],
      generationConfig: {
        responseMimeType: request.jsonMode ? 'application/json' : 'text/plain',
        temperature: 0.1,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('Empty response from Gemini API');
    }

    return text;
  }
}
