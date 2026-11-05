import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ErrorBoundary, { AppErrorFallback } from './ErrorBoundary';
import { recoverFromModuleLoadError } from '@/lib/moduleLoadRecovery';

vi.mock('@/lib/moduleLoadRecovery', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/moduleLoadRecovery')>(),
  recoverFromModuleLoadError: vi.fn(() => false),
}));

const Crash = ({ error }: { error: Error }): never => { throw error; };

beforeEach(() => {
  vi.mocked(recoverFromModuleLoadError).mockReset().mockReturnValue(false);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('app error fallback', () => {
  it('renders ordinary children without invoking recovery', () => {
    render(<ErrorBoundary><p>Cart content</p></ErrorBoundary>);
    expect(screen.getByText('Cart content')).toBeVisible();
    expect(recoverFromModuleLoadError).not.toHaveBeenCalled();
  });

  it('provides a working reload button and collapsed details after persistent module errors', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    render(<ErrorBoundary><Crash error={new Error('Failed to fetch dynamically imported module: /assets/AdminAnalytics-old.js')} /></ErrorBoundary>);
    expect(screen.getByRole('heading', { name: 'This page needs a refresh' })).toBeVisible();
    expect(screen.getByText(/AdminAnalytics-old/)).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Reload page' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('explains automatic recovery while it is in progress', () => {
    vi.mocked(recoverFromModuleLoadError).mockReturnValue(true);
    render(<ErrorBoundary><Crash error={new Error('Importing a module script failed')} /></ErrorBoundary>);
    expect(screen.getByRole('heading', { name: 'Updating this page…' })).toBeVisible();
    expect(screen.getByText(/return to this page automatically/)).toBeVisible();
  });

  it('keeps ordinary render errors distinct from page file failures', () => {
    render(<ErrorBoundary><Crash error={new Error('Unexpected report data')} /></ErrorBoundary>);
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeVisible();
  });

  it('also renders outside the router when initial page preloading fails', () => {
    render(<AppErrorFallback error={new Error('Unable to preload CSS for /assets/product-old.css')} />);
    expect(screen.getByRole('alert')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'This page needs a refresh' })).toBeVisible();
  });
});
