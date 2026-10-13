import type { LLMProviderInterface, LLMRequest } from './types';

/**
 * Mock LLM provider that returns pre-recorded responses.
 * Used for testing and Cypress demos to avoid burning API quota.
 */
export class MockLLMProvider implements LLMProviderInterface {
  private responses: Map<string, string> = new Map();
  private defaultResponse: string;

  constructor() {
    this.defaultResponse = JSON.stringify({
      document_type: 'tos',
      clauses: [
        {
          id: 'mock-1',
          category: 'auto_renewal',
          severity: 3,
          quote: 'Your subscription will automatically renew',
          explanation: 'The service automatically renews your subscription, which means you may be charged without explicit re-authorization.',
          confidence: 0.9,
        },
        {
          id: 'mock-2',
          category: 'third_party_data_sharing',
          severity: 4,
          quote: 'We may share your personal information with third-party partners',
          explanation: 'Your personal data may be shared with unnamed third parties, giving you limited control over who accesses your information.',
          confidence: 0.85,
        },
        {
          id: 'mock-3',
          category: 'unilateral_changes',
          severity: 3,
          quote: 'We reserve the right to modify these terms at any time without prior notice',
          explanation: 'The company can change the agreement at any time without telling you first, meaning the terms you agreed to could change.',
          confidence: 0.92,
        },
      ],
      unclear_sections: [],
    });
  }

  setResponse(key: string, response: string): void {
    this.responses.set(key, response);
  }

  setDefaultResponse(response: string): void {
    this.defaultResponse = response;
  }

  async call(_request: LLMRequest): Promise<string> {
    // Simulate API latency
    await new Promise(resolve => setTimeout(resolve, 500));
    return this.defaultResponse;
  }
}
