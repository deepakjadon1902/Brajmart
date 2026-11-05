import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let reload: ReturnType<typeof vi.fn>;
const entry = '/assets/index-first-build.js';
const setEntry = (src: string) => { document.head.innerHTML = `<script type="module" src="${src}"></script>`; };

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  window.sessionStorage.clear();
  setEntry(entry);
  reload = vi.fn();
  vi.stubGlobal('location', { ...window.location, reload });
  vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.head.innerHTML = '';
});

describe('page module recovery', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://www.brajmart.com/assets/AdminAnalytics-old.js',
    'Importing a module script failed.',
    'error loading dynamically imported module: https://www.brajmart.com/assets/Cart-old.js',
    'Loading chunk 42 failed.',
    'Loading CSS chunk 42 failed.',
    'Unable to preload CSS for /assets/page-old.css',
  ])('recognizes browser module loading errors: %s', async (message) => {
    const { isModuleLoadError } = await import('./moduleLoadRecovery');
    expect(isModuleLoadError(new Error(message))).toBe(true);
  });

  it('does not reload ordinary render or API errors', async () => {
    const { recoverFromModuleLoadError } = await import('./moduleLoadRecovery');
    expect(recoverFromModuleLoadError(new Error('Request failed (503)'))).toBe(false);
    expect(recoverFromModuleLoadError(new TypeError('Cannot read properties of undefined'))).toBe(false);
    await vi.runAllTimersAsync();
    expect(reload).not.toHaveBeenCalled();
  });

  it('shares one reload between the Vite event and React error boundary', async () => {
    const { installModuleLoadRecovery, recoverFromModuleLoadError } = await import('./moduleLoadRecovery');
    const uninstall = installModuleLoadRecovery();
    const error = new TypeError('Failed to fetch dynamically imported module');
    const event = Object.assign(new Event('vite:preloadError', { cancelable: true }), { payload: error });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(recoverFromModuleLoadError(error)).toBe(true);
    await vi.runAllTimersAsync();
    expect(reload).toHaveBeenCalledTimes(1);
    uninstall();
  });

  it('stops automatic reloads if the same entry still fails after a reload', async () => {
    const error = new Error('Importing a module script failed');
    const first = await import('./moduleLoadRecovery');
    expect(first.recoverFromModuleLoadError(error)).toBe(true);
    await vi.runAllTimersAsync();
    vi.resetModules();
    const afterReload = await import('./moduleLoadRecovery');
    expect(afterReload.recoverFromModuleLoadError(error)).toBe(false);
    await vi.runAllTimersAsync();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('allows a later deployment to recover in the same tab, including tabs with the old permanent flag', async () => {
    window.sessionStorage.setItem('brajmart-dynamic-import-reload', '1');
    const error = new Error('Failed to fetch dynamically imported module');
    const first = await import('./moduleLoadRecovery');
    expect(first.recoverFromModuleLoadError(error)).toBe(true);
    await vi.runAllTimersAsync();
    vi.resetModules();
    setEntry('/assets/index-next-build.js');
    const nextBuild = await import('./moduleLoadRecovery');
    expect(nextBuild.recoverFromModuleLoadError(error)).toBe(true);
    await vi.runAllTimersAsync();
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('does not spend the recovery attempt while offline', async () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    const { recoverFromModuleLoadError } = await import('./moduleLoadRecovery');
    const error = new Error('Failed to fetch dynamically imported module');
    expect(recoverFromModuleLoadError(error)).toBe(false);
    expect(window.sessionStorage.length).toBe(0);
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true);
    expect(recoverFromModuleLoadError(error)).toBe(true);
    await vi.runAllTimersAsync();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it.each(['getItem', 'setItem'] as const)('safely falls back to manual reload if storage %s is blocked', async (method) => {
    vi.spyOn(Storage.prototype, method).mockImplementation(() => { throw new DOMException('Storage blocked', 'SecurityError'); });
    const { recoverFromModuleLoadError } = await import('./moduleLoadRecovery');
    expect(recoverFromModuleLoadError(new Error('Failed to fetch dynamically imported module'))).toBe(false);
    await vi.runAllTimersAsync();
    expect(reload).not.toHaveBeenCalled();
  });

  it('unsubscribes the Vite handler when disposed', async () => {
    const { installModuleLoadRecovery } = await import('./moduleLoadRecovery');
    const uninstall = installModuleLoadRecovery();
    uninstall();
    window.dispatchEvent(Object.assign(new Event('vite:preloadError'), { payload: new Error('Importing a module script failed') }));
    await vi.runAllTimersAsync();
    expect(reload).not.toHaveBeenCalled();
  });
});
