/**
 * Integration with Alibaba page-agent.
 * Used for: reading DOM as text, expanding accordions, scrolling, navigating to legal links.
 * NOT used for: risk judgments, clicking dangerous buttons.
 *
 * Safety: page-agent actions are restricted to a read-only allowlist.
 */

// Read-only action allowlist
const ALLOWED_ACTIONS = [
  'scroll',
  'expand',
  'show more',
  'read more',
  'load more',
  'navigate to',
  'go to',
  'click to expand',
  'open section',
  'view full',
  'see all',
] as const;

// Dangerous actions that must NEVER be executed
const BLOCKED_ACTIONS = [
  'submit',
  'purchase',
  'buy',
  'accept',
  'agree',
  'delete',
  'remove',
  'sign up',
  'sign in',
  'log in',
  'subscribe',
  'checkout',
  'pay',
  'confirm',
  'approve',
  'cancel account',
  'close account',
  'deactivate',
] as const;

/**
 * Check if an action is safe to execute.
 */
export function isActionAllowed(action: string): boolean {
  const lower = action.toLowerCase();

  // Check blocked list first
  for (const blocked of BLOCKED_ACTIONS) {
    if (lower.includes(blocked)) {
      return false;
    }
  }

  // Check allowed list
  for (const allowed of ALLOWED_ACTIONS) {
    if (lower.includes(allowed)) {
      return true;
    }
  }

  // Default: deny
  return false;
}

/**
 * Attempt to use page-agent to expand collapsed sections.
 * Falls back gracefully if page-agent is not available.
 */
export async function expandCollapsedSections(): Promise<{ expanded: number; errors: string[] }> {
  let expanded = 0;
  const errors: string[] = [];

  // Fallback: try native DOM expansion without page-agent
  try {
    // Expand <details> elements
    document.querySelectorAll('details:not([open])').forEach(el => {
      (el as HTMLDetailsElement).open = true;
      expanded++;
    });

    // Click common "show more" / "read more" buttons/links
    const expandTriggers = document.querySelectorAll(
      'button, a, [role="button"]'
    );

    for (const trigger of expandTriggers) {
      const text = (trigger.textContent || '').toLowerCase().trim();
      if (
        text.includes('show more') ||
        text.includes('read more') ||
        text.includes('expand') ||
        text.includes('view full') ||
        text.includes('see all') ||
        text.includes('load more')
      ) {
        if (isActionAllowed(text)) {
          (trigger as HTMLElement).click();
          expanded++;
          // Small delay to let content load
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    }
  } catch (err) {
    errors.push(`DOM expansion error: ${err}`);
  }

  return { expanded, errors };
}

/**
 * NOTE: Full page-agent integration would use:
 *
 * import { PageAgent } from 'page-agent';
 *
 * const agent = new PageAgent({
 *   model: userModel,
 *   baseURL: providerBaseUrl,
 *   apiKey: userApiKey,
 *   language: 'en-US',
 * });
 *
 * // Execute a read-only task
 * if (isActionAllowed(task)) {
 *   await agent.execute(task);
 * }
 *
 * // Get structured page state
 * // agent.pageController.getBrowserState() returns { url, title, header, content, footer }
 *
 * Current implementation uses direct DOM manipulation as a reliable fallback.
 * page-agent is designed for full GUI automation and its LLM-driven action loop
 * is overkill for our simple expand/scroll needs. We use its concepts
 * (DOM state extraction, action allowlisting) but implement them directly
 * for better security control.
 */
