/**
 * Injection pattern scanner.
 * Detects instruction-like text that attempts prompt injection.
 */

export interface InjectionWarning {
  pattern: string;
  matchedText: string;
  location: 'visible' | 'hidden' | 'comment';
  position: number;
}

// Patterns that indicate prompt injection attempts
const INJECTION_PATTERNS: { pattern: RegExp; name: string }[] = [
  // English
  { pattern: /ignore\s+(all\s+)?previous\s+instructions/gi, name: 'ignore_previous_instructions' },
  { pattern: /disregard\s+(the\s+)?(above|previous)/gi, name: 'disregard_above' },
  { pattern: /rate\s+this\s+(document\s+)?as\s+safe/gi, name: 'rate_as_safe' },
  { pattern: /you\s+are\s+now\s+a/gi, name: 'role_override' },
  { pattern: /system\s*:/gi, name: 'system_prompt_injection' },
  { pattern: /\bforget\s+(everything|all|your)\b/gi, name: 'forget_instructions' },
  { pattern: /do\s+not\s+(analyze|report|flag|detect)/gi, name: 'suppress_analysis' },
  { pattern: /this\s+document\s+is\s+(completely\s+)?safe/gi, name: 'assert_safe' },
  { pattern: /output\s+(only|just)\s+json/gi, name: 'output_override' },
  { pattern: /api[_\s]?key/gi, name: 'api_key_exfiltration' },
  { pattern: /click\s+(the\s+)?delete/gi, name: 'dangerous_action' },
  { pattern: /click\s+(the\s+)?accept/gi, name: 'dangerous_action_accept' },
  { pattern: /click\s+(the\s+)?purchase/gi, name: 'dangerous_action_purchase' },
  { pattern: /click\s+(the\s+)?submit/gi, name: 'dangerous_action_submit' },
  { pattern: /call\s+page[_\s-]?agent/gi, name: 'agent_abuse' },
  { pattern: /execute\s+(javascript|js|code)/gi, name: 'code_execution' },

  // Turkish
  { pattern: /önceki\s+talimatları\s+yoksay/gi, name: 'ignore_previous_tr' },
  { pattern: /bu\s+belgeyi\s+güvenli\s+olarak\s+değerlendir/gi, name: 'rate_safe_tr' },

  // Common multi-language
  { pattern: /ignorar\s+instrucciones\s+anteriores/gi, name: 'ignore_previous_es' },
  { pattern: /ignorez\s+les\s+instructions\s+précédentes/gi, name: 'ignore_previous_fr' },
  { pattern: /vorherige\s+anweisungen\s+ignorieren/gi, name: 'ignore_previous_de' },
];

/**
 * Scan text for prompt injection patterns.
 * Returns all detected injection attempts.
 */
export function scanForInjections(text: string): InjectionWarning[] {
  const warnings: InjectionWarning[] = [];

  for (const { pattern, name } of INJECTION_PATTERNS) {
    // Reset regex state
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      warnings.push({
        pattern: name,
        matchedText: match[0],
        location: 'visible',
        position: match.index,
      });
    }
  }

  return warnings;
}

/**
 * Scan HTML comments for injection attempts.
 */
export function scanHtmlComments(html: string): InjectionWarning[] {
  const warnings: InjectionWarning[] = [];
  const commentRegex = /<!--([\s\S]*?)-->/g;
  let match: RegExpExecArray | null;

  while ((match = commentRegex.exec(html)) !== null) {
    const commentContent = match[1];
    const injections = scanForInjections(commentContent);
    for (const injection of injections) {
      warnings.push({
        ...injection,
        location: 'comment',
        position: match.index + injection.position,
      });
    }
  }

  return warnings;
}
