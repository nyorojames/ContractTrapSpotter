import { PageAgent } from 'page-agent';

/**
 * Read-only action allowlist for PageAgent.
 * PageAgent is permitted ONLY to perform passive exploration and accordion expansion.
 */
export const ALLOWED_ACTIONS = [
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

/**
 * Destructive, transactional, and state-changing actions that must NEVER be executed.
 */
export const BLOCKED_ACTIONS = [
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
 * Check if an action string is safe to execute according to the safety allowlist.
 */
export function isActionAllowed(action: string): boolean {
  const lower = action.toLowerCase();

  // Strict: check blocked verbs first
  for (const blocked of BLOCKED_ACTIONS) {
    if (lower.includes(blocked)) {
      return false;
    }
  }

  // Check allowed verbs
  for (const allowed of ALLOWED_ACTIONS) {
    if (lower.includes(allowed)) {
      return true;
    }
  }

  return false;
}

export interface PageAgentConfigOptions {
  apiKey?: string;
  baseURL?: string;
  model?: string;
}

/**
 * Safe execution guard for PageAgent commands.
 * Rejects any command containing blocked verbs before touching the library.
 */
export async function safeExecuteCommand(
  agent: PageAgent | null,
  command: string
): Promise<{ success: boolean; result?: any; error?: string }> {
  if (!isActionAllowed(command)) {
    throw new Error(`Action rejected by safety allowlist: "${command}" contains blocked verbs`);
  }

  if (!agent) {
    return { success: false, error: 'PageAgent is not initialized' };
  }

  try {
    const result = await agent.execute(command);
    return { success: true, result };
  } catch (err: any) {
    return { success: false, error: String(err?.message || err) };
  }
}

/**
 * Native DOM expansion fallback when PageAgent is unavailable, unconfigured,
 * or blocked by browser CSP.
 */
export async function expandWithNativeDom(): Promise<{ expanded: number; errors: string[] }> {
  let expanded = 0;
  const errors: string[] = [];

  try {
    // 1. Open all <details> elements
    document.querySelectorAll('details:not([open])').forEach(el => {
      (el as HTMLDetailsElement).open = true;
      expanded++;
    });

    // 2. Click common expand triggers that pass the allowlist
    const expandTriggers = document.querySelectorAll('button, a, [role="button"]');
    for (const trigger of Array.from(expandTriggers)) {
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
          await new Promise(r => setTimeout(r, 150));
        }
      }
    }
  } catch (err) {
    errors.push(`Native DOM expansion error: ${err}`);
  }

  return { expanded, errors };
}

/**
 * Real integration point for PageAgent:
 * 1. Initializes PageAgent with the user's own API key (never the demo LLM).
 * 2. Hides the library's default UI panel to avoid clashing with ContractTrapSpotter's report panel.
 * 3. Runs a single constrained command through the safety allowlist:
 *    "expand all collapsed sections of the terms text".
 * 4. Extracts structured DOM content via pageController.getBrowserState().
 * 5. Falls back to native DOM expansion if PageAgent encounters CSP or initialization limits.
 */
export async function prepareDocumentWithPageAgent(config?: PageAgentConfigOptions): Promise<{
  expanded: boolean;
  extractedBrowserContent?: string;
  method: 'page-agent' | 'native-dom';
  fallbackReason?: string;
  error?: string;
}> {
  // If user has not configured their own API key, do NOT use the demo LLM
  if (!config?.apiKey) {
    const nativeRes = await expandWithNativeDom();
    return {
      expanded: nativeRes.expanded > 0,
      method: 'native-dom',
      fallbackReason: 'no user API key configured',
    };
  }

  let agent: PageAgent | null = null;
  try {
    // Custom fetch hook to route LLM calls through background service worker
    const customFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        const url = typeof input === 'string' ? input : input.toString();
        const bodyText = typeof init?.body === 'string' ? init.body : '';
        const response = await chrome.runtime.sendMessage({
          type: 'PAGE_AGENT_LLM_PROXY',
          data: {
            url,
            method: init?.method || 'POST',
            body: bodyText,
          },
        });

        if (!response || response.type === 'PAGE_AGENT_LLM_ERROR') {
          throw new Error(response?.error || 'PageAgent LLM background proxy request failed');
        }

        return new Response(JSON.stringify(response.data), {
          status: response.status || 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return fetch(input, init);
    };

    // Instantiate real PageAgent with user credentials and background LLM routing
    agent = new PageAgent({
      baseURL: config.baseURL || 'https://generativelanguage.googleapis.com/v1beta/openai/',
      apiKey: config.apiKey,
      model: config.model || 'gemini-2.0-flash',
      language: 'en-US',
      maxSteps: 2, // Strictly constrained single-task limit
      customFetch,
    } as any);

    // Apply strict tool restrictions: remove dangerous tools, wrap click tool
    if (agent.tools) {
      agent.tools.delete('execute_javascript');
      agent.tools.delete('input_text');
      agent.tools.delete('select_dropdown_option');
      agent.tools.delete('ask_user');

      const clickTool = agent.tools.get('click_element_by_index');
      if (clickTool) {
        const origExec = clickTool.execute;
        clickTool.execute = async function (this: any, input: any, ctx: any) {
          if (this.pageController?.elementTextMap) {
            const text = (this.pageController.elementTextMap.get(input?.index) || '').toLowerCase();
            const FORBIDDEN_VERBS = ['submit', 'buy', 'purchase', 'delete', 'accept', 'agree', 'sign', 'pay'];
            for (const verb of FORBIDDEN_VERBS) {
              if (text.includes(verb)) {
                throw new Error(`Blocked click on element matching forbidden action: "${verb}"`);
              }
            }
          }
          return origExec.call(this, input, ctx);
        };
      }
    }

    // Hide the library's built-in floating chat panel so it does not clutter the page
    if (agent.panel) {
      agent.panel.hide();
      if (agent.panel.wrapper) {
        agent.panel.wrapper.style.display = 'none';
      }
    }

    // Execute constrained expansion command through safety guard
    const command = 'expand all collapsed sections of the terms text';
    await safeExecuteCommand(agent, command);

    // Extract structured DOM content via pageController
    let extractedContent = '';
    try {
      const state = await agent.pageController.getBrowserState();
      extractedContent = state.content || '';
    } catch (stateErr: any) {
      const msg = String(stateErr?.message || stateErr);
      if (msg.includes('iframe') || msg.includes('cross-origin')) {
        console.log('[ContractTrapSpotter] (Expected page-agent warning): iframe access restricted by browser security');
      } else {
        console.log('[ContractTrapSpotter] (Expected page-agent warning): browser state extraction fallback');
      }
    }

    return {
      expanded: true,
      extractedBrowserContent: extractedContent,
      method: 'page-agent',
    };
  } catch (err: any) {
    const rawMsg = String(err?.message || err);
    let fallbackReason = 'page-agent failed';

    if (rawMsg.includes('iframe') || rawMsg.includes('SecurityError') || rawMsg.includes('cross-origin')) {
      console.log('[ContractTrapSpotter] (Expected page-agent warning): iframe access restricted by browser');
      fallbackReason = 'page-agent failed: iframe access restricted';
    } else if (rawMsg.includes('openapi-3.0') || rawMsg.includes('Invalid target')) {
      console.log('[ContractTrapSpotter] (Expected page-agent warning): openapi target not applicable');
      fallbackReason = 'page-agent failed: openapi target not applicable';
    } else if (rawMsg.includes('Failed to fetch') || rawMsg.includes('Network request failed') || rawMsg.includes('network_error')) {
      console.log('[ContractTrapSpotter] (Expected page-agent warning): network request failed');
      fallbackReason = 'page-agent failed: network request failed';
    } else if (rawMsg.includes('Blocked click')) {
      console.log('[ContractTrapSpotter] (Expected page-agent warning): blocked click on forbidden element');
      fallbackReason = 'page-agent blocked: click on forbidden button prevented';
    } else {
      console.warn('[ContractTrapSpotter] PageAgent execution failed, falling back to native DOM:', rawMsg);
      fallbackReason = `page-agent failed: ${rawMsg.slice(0, 50)}`;
    }

    const nativeRes = await expandWithNativeDom();
    return {
      expanded: nativeRes.expanded > 0,
      method: 'native-dom',
      fallbackReason,
      error: rawMsg,
    };
  } finally {
    try {
      agent?.dispose();
    } catch {
      // Dispose cleanup
    }
  }
}
