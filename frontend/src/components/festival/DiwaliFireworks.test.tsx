import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import { useSettingsStore } from '@/store/settingsStore';
import { FestivalDecorations, FestivalToran } from './FestivalDecor';

afterEach(cleanup);
const setup = (path = '/products') => render(<MemoryRouter initialEntries={[path]}><FestivalDecorations /></MemoryRouter>);

it('enables the animated fireworks only for the active Diwali theme', () => {
  useSettingsStore.getState().updateSettings({ festivalTheme: 'diwali' });
  setup();
  expect(screen.getByTestId('diwali-fireworks')).toHaveAttribute('aria-hidden', 'true');
  act(() => useSettingsStore.getState().updateSettings({ festivalTheme: 'holi' }));
  expect(screen.queryByTestId('diwali-fireworks')).toBeNull();
  act(() => useSettingsStore.getState().updateSettings({ festivalTheme: 'none' }));
  expect(screen.queryByTestId('diwali-fireworks')).toBeNull();
});

it.each(['/checkout', '/payment-status/test', '/thank-you', '/admin/dashboard', '/admin/settings', '/email/unsubscribe'])('keeps storefront fireworks away from %s', path => {
  useSettingsStore.getState().updateSettings({ festivalTheme: 'diwali' });
  setup(path);
  expect(screen.queryByTestId('diwali-fireworks')).toBeNull();
});

it.each(['diwali', 'holi'] as const)('opts the dashboard into %s while the global storefront layer stays hidden', theme => {
  useSettingsStore.getState().updateSettings({ festivalTheme: theme });
  render(<MemoryRouter initialEntries={['/admin/dashboard/']}>
    <FestivalDecorations /><FestivalToran />
    <FestivalDecorations surface="admin-dashboard" /><FestivalToran surface="admin-dashboard" />
  </MemoryRouter>);
  expect(screen.getAllByTestId('festival-decorations')).toHaveLength(1);
  expect(screen.getByTestId('festival-decorations')).toHaveClass('festival-admin-dashboard', `festival-${theme}`);
  expect(screen.getAllByTestId('festival-toran')).toHaveLength(1);
  expect(screen.queryByTestId('diwali-fireworks') !== null).toBe(theme === 'diwali');
  act(() => useSettingsStore.getState().updateSettings({ festivalTheme: 'none' }));
  expect(screen.queryByTestId('festival-decorations')).toBeNull();
  expect(screen.queryByTestId('festival-toran')).toBeNull();
});

it.each(['/admin', '/admin/login', '/admin/orders', '/admin/settings', '/admin/dashboard/reports', '/products', '/email/unsubscribe'])('rejects dashboard artwork outside the exact dashboard route: %s', path => {
  useSettingsStore.getState().updateSettings({ festivalTheme: 'diwali' });
  render(<MemoryRouter initialEntries={[path]}>
    <FestivalDecorations surface="admin-dashboard" /><FestivalToran surface="admin-dashboard" />
  </MemoryRouter>);
  expect(screen.queryByTestId('festival-decorations')).toBeNull();
  expect(screen.queryByTestId('festival-toran')).toBeNull();
});

it('pauses the fireworks while the tab is hidden and resumes when visible', () => {
  const previous = Object.getOwnPropertyDescriptor(document, 'visibilityState');
  try {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    useSettingsStore.getState().updateSettings({ festivalTheme: 'diwali' });
    setup();
    expect(screen.getByTestId('diwali-fireworks')).toHaveAttribute('data-paused', 'false');
    act(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.getByTestId('diwali-fireworks')).toHaveAttribute('data-paused', 'true');
    act(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.getByTestId('diwali-fireworks')).toHaveAttribute('data-paused', 'false');
  } finally {
    if (previous) Object.defineProperty(document, 'visibilityState', previous);
    else delete (document as unknown as Record<string, unknown>).visibilityState;
  }
});
