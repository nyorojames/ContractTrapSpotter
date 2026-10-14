import { describe, it, expect, vi } from 'vitest';
import { isActionAllowed, ALLOWED_ACTIONS, BLOCKED_ACTIONS, safeExecuteCommand } from '../src/page-agent/integration';

describe('PageAgent Safety Allowlist', () => {
  it('allows safe read-only actions', () => {
    expect(isActionAllowed('expand all collapsed sections of the terms text')).toBe(true);
    expect(isActionAllowed('scroll down to view terms')).toBe(true);
    expect(isActionAllowed('show more clauses')).toBe(true);
    expect(isActionAllowed('click to expand details')).toBe(true);
  });

  it('strictly rejects destructive and state-changing actions', () => {
    expect(isActionAllowed('click submit')).toBe(false);
    expect(isActionAllowed('purchase subscription')).toBe(false);
    expect(isActionAllowed('accept terms and conditions')).toBe(false);
    expect(isActionAllowed('delete account')).toBe(false);
    expect(isActionAllowed('confirm payment of $99')).toBe(false);
    expect(isActionAllowed('checkout now')).toBe(false);
    expect(isActionAllowed('sign in with credentials')).toBe(false);
  });

  it('rejects commands containing embedded blocked verbs even if mixed with safe words', () => {
    expect(isActionAllowed('expand section and click delete')).toBe(false);
    expect(isActionAllowed('scroll down and accept all terms')).toBe(false);
    expect(isActionAllowed('show more then click purchase')).toBe(false);
  });

  it('throws an error before invoking the library when a blocked verb is executed', async () => {
    const mockAgent = {
      execute: vi.fn(),
    } as any;

    await expect(safeExecuteCommand(mockAgent, 'click delete button')).rejects.toThrow(
      /Action rejected by safety allowlist/
    );

    // Verify library was never called
    expect(mockAgent.execute).not.toHaveBeenCalled();
  });

  it('calls agent.execute only when command is verified safe', async () => {
    const mockAgent = {
      execute: vi.fn().mockResolvedValue({ success: true }),
    } as any;

    const result = await safeExecuteCommand(mockAgent, 'expand all collapsed sections');
    expect(result.success).toBe(true);
    expect(mockAgent.execute).toHaveBeenCalledWith('expand all collapsed sections');
  });
});
