import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureEmailFollowup } from '@/lib/api';
import { useCheckoutFollowups } from './useCheckoutFollowups';

vi.mock('@/lib/api', () => ({ captureEmailFollowup: vi.fn() }));
const capture = vi.mocked(captureEmailFollowup);
const payload = () => ({
  email: 'recipient@example.invalid', customerName: '', items: [{ productId: '5', quantity: 1 }],
  consent: { cartReminder: true, offerEmail: false, whatsappFollowup: false },
});
const tick = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(601); }); };

beforeEach(() => {
  vi.useFakeTimers();
  capture.mockReset().mockResolvedValue({ saved: true, reminderScheduled: true });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('checkout reminder capture', () => {
  it('saves favorites without a cart and saves empty lists to cancel obsolete reminders', async () => {
    const input = { ...payload(), items: [], favoriteItems: [{ productId: '5', quantity: 1 }], reminderSource: 'saved_products' as const };
    const { rerender } = renderHook(({ value }) => useCheckoutFollowups(value, true), { initialProps: { value: input } });
    await tick();
    expect(capture.mock.calls[0][0].favoriteItems).toEqual(input.favoriteItems);
    rerender({ value: { ...input, favoriteItems: [] } });
    await tick();
    expect(capture).toHaveBeenCalledTimes(2);
    expect(capture.mock.calls[1][0].items).toEqual([]);
    expect(capture.mock.calls[1][0].favoriteItems).toEqual([]);
  });
  it('saves opted-in customers before they fill an address or continue to payment', async () => {
    const { result } = renderHook(() => useCheckoutFollowups(payload(), true));
    await tick();
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith({ ...payload(), revokeCartReminder: false });
    expect(result.current.state).toBe('saved');
  });

  it('does not capture missing/invalid emails, empty carts, or customers without an opt-in', async () => {
    for (const input of [
      { ...payload(), email: '' }, { ...payload(), email: 'incomplete@' },
      { ...payload(), items: [] },
      { ...payload(), consent: { cartReminder: false, offerEmail: false, whatsappFollowup: false } },
    ]) {
      const { unmount } = renderHook(() => useCheckoutFollowups(input, true));
      await tick();
      unmount();
    }
    expect(capture).not.toHaveBeenCalled();
  });

  it('debounces typing and saves the latest verified cart snapshot', async () => {
    const { rerender } = renderHook(({ input }) => useCheckoutFollowups(input, true), { initialProps: { input: payload() } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    rerender({ input: { ...payload(), customerName: 'Customer Name', items: [{ productId: '5', quantity: 2 }] } });
    await tick();
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls[0][0].items[0].quantity).toBe(2);
  });

  it('continuing to payment shares an in-flight save and does not schedule a duplicate reminder', async () => {
    let resolve!: (value: { saved: boolean; reminderScheduled: boolean }) => void;
    capture.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const { result } = renderHook(() => useCheckoutFollowups(payload(), true));
    await tick();
    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => { first = result.current.save(); second = result.current.save(); });
    expect(first).toBe(second);
    await act(async () => { resolve({ saved: true, reminderScheduled: true }); await first; });
    await act(async () => { await result.current.save(); });
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it('serializes saves so an older slow request cannot replace a newer cart', async () => {
    let resolveFirst!: (value: { saved: boolean; reminderScheduled: boolean }) => void;
    capture.mockImplementationOnce(() => new Promise((done) => { resolveFirst = done; }));
    const { rerender } = renderHook(({ input }) => useCheckoutFollowups(input, true), { initialProps: { input: payload() } });
    await tick();
    rerender({ input: { ...payload(), items: [{ productId: '5', quantity: 3 }] } });
    await tick();
    expect(capture).toHaveBeenCalledTimes(1);
    await act(async () => { resolveFirst({ saved: true, reminderScheduled: true }); });
    expect(capture).toHaveBeenCalledTimes(2);
    expect(capture.mock.calls[1][0].items[0].quantity).toBe(3);
  });

  it('unchecking the reminder explicitly revokes the saved reminder', async () => {
    const { rerender } = renderHook(({ input }) => useCheckoutFollowups(input, true), { initialProps: { input: payload() } });
    await tick();
    rerender({ input: { ...payload(), consent: { cartReminder: false, offerEmail: false, whatsappFollowup: false } } });
    await tick();
    expect(capture).toHaveBeenCalledTimes(2);
    expect(capture.mock.calls[1][0].revokeCartReminder).toBe(true);
    expect(capture.mock.calls[1][0].consent.cartReminder).toBe(false);
  });

  it('submits opt-outs immediately and shows saving until the server acknowledges them', async () => {
    const { result, rerender } = renderHook(({ input }) => useCheckoutFollowups(input, true), { initialProps: { input: payload() } });
    await tick();
    let finish!: (value: { saved: boolean; reminderScheduled: boolean }) => void;
    capture.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    rerender({ input: { ...payload(), consent: { cartReminder: false, offerEmail: false, whatsappFollowup: false } } });
    await act(async () => { await Promise.resolve(); });
    expect(capture).toHaveBeenCalledTimes(2);
    expect(result.current.state).toBe('saving');
    await act(async () => { finish({ saved: true, reminderScheduled: false }); });
    expect(result.current.state).not.toBe('saving');
  });

  it('shows save failures and lets the customer retry without blocking checkout', async () => {
    capture.mockRejectedValueOnce(new Error('Database unavailable'));
    const { result } = renderHook(() => useCheckoutFollowups(payload(), true));
    await tick();
    expect(result.current.state).toBe('error');
    await act(async () => { await result.current.save(); });
    expect(result.current.state).toBe('saved');
    expect(capture).toHaveBeenCalledTimes(2);
  });

  it('rechecking while a withdrawal is in flight restores the selected reminder after withdrawal completes', async () => {
    let releaseWithdrawal!: (value: { saved: boolean; reminderScheduled: boolean }) => void;
    const { rerender } = renderHook(({ input }) => useCheckoutFollowups(input, true), { initialProps: { input: payload() } });
    await tick();
    capture.mockImplementationOnce(() => new Promise((done) => { releaseWithdrawal = done; }));
    rerender({ input: { ...payload(), consent: { cartReminder: false, offerEmail: false, whatsappFollowup: false } } });
    await tick();
    rerender({ input: payload() });
    await tick();
    expect(capture).toHaveBeenCalledTimes(2);
    await act(async () => { releaseWithdrawal({ saved: true, reminderScheduled: false }); });
    expect(capture).toHaveBeenCalledTimes(3);
    expect(capture.mock.calls[2][0].consent.cartReminder).toBe(true);
  });

  it('does not reschedule an unchanged cart after returning from the payment popup', async () => {
    const { rerender } = renderHook(({ enabled }) => useCheckoutFollowups(payload(), enabled), { initialProps: { enabled: true } });
    await tick();
    rerender({ enabled: false });
    await tick();
    rerender({ enabled: true });
    await tick();
    expect(capture).toHaveBeenCalledTimes(1);
  });
});
