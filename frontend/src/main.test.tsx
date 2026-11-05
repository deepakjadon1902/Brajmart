import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  render: vi.fn(), createRoot: vi.fn(), hydrateRoot: vi.fn(), preload: vi.fn(),
  readInitialData: vi.fn(), applyInitialData: vi.fn(), installRecovery: vi.fn(), recover: vi.fn(),
}));

vi.mock('react-dom/client', () => ({ createRoot: mocks.createRoot, hydrateRoot: mocks.hydrateRoot }));
vi.mock('./App.tsx', () => ({ default: () => null, preloadRouteForPath: mocks.preload }));
vi.mock('./lib/initialData', () => ({ readInitialData: mocks.readInitialData, applyInitialData: mocks.applyInitialData }));
vi.mock('./lib/moduleLoadRecovery', () => ({
  installModuleLoadRecovery: mocks.installRecovery,
  recoverFromModuleLoadError: mocks.recover,
  isModuleLoadError: () => true,
}));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  document.body.innerHTML = '<div id="root"><p>Prerendered product</p></div>';
  mocks.createRoot.mockReturnValue({ render: mocks.render });
  mocks.readInitialData.mockReturnValue({ generatedAt: 'fixture' });
  mocks.preload.mockResolvedValue([]);
});

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('page startup', () => {
  it('registers recovery before loading a prerendered route, then hydrates normally', async () => {
    await import('./main');
    expect(mocks.installRecovery.mock.invocationCallOrder[0]).toBeLessThan(mocks.preload.mock.invocationCallOrder[0]);
    expect(mocks.hydrateRoot).toHaveBeenCalledTimes(1);
    expect(mocks.createRoot).not.toHaveBeenCalled();
  });

  it('shows recovery when the initial route module fails before React mounts', async () => {
    const error = new Error('Failed to fetch dynamically imported module: /assets/Product-old.js');
    mocks.preload.mockRejectedValue(error);
    mocks.recover.mockReturnValue(true);
    await import('./main');
    expect(mocks.hydrateRoot).not.toHaveBeenCalled();
    expect(mocks.createRoot).toHaveBeenCalledTimes(1);
    expect(mocks.render.mock.calls[0][0].props).toEqual({ error, recovering: true });
  });

  it('keeps a manual reload fallback when startup cannot recover automatically', async () => {
    const error = new Error('Importing a module script failed');
    mocks.preload.mockRejectedValue(error);
    mocks.recover.mockReturnValue(false);
    await import('./main');
    expect(mocks.render.mock.calls[0][0].props).toEqual({ error, recovering: false });
    expect(mocks.hydrateRoot).not.toHaveBeenCalled();
  });

  it('mounts routes without prerendered content without waiting on a preload', async () => {
    document.getElementById('root')!.innerHTML = '';
    mocks.readInitialData.mockReturnValue(null);
    await import('./main');
    expect(mocks.preload).not.toHaveBeenCalled();
    expect(mocks.createRoot).toHaveBeenCalledTimes(1);
    expect(mocks.render).toHaveBeenCalledTimes(1);
  });
});
