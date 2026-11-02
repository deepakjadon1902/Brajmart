import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import { useSettingsStore } from '@/store/settingsStore';
import { FestivalDecorations } from './FestivalDecor';

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

it.each(['/checkout', '/payment-status/test', '/thank-you', '/admin/settings', '/email/unsubscribe'])('keeps fireworks away from %s', path => {
  useSettingsStore.getState().updateSettings({ festivalTheme: 'diwali' });
  setup(path);
  expect(screen.queryByTestId('diwali-fireworks')).toBeNull();
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
