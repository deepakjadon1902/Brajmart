import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Link } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/store/settingsStore';
import FestivalWelcome from './FestivalWelcome';

beforeEach(() => {
  vi.useFakeTimers();
  useSettingsStore.getState().updateSettings({ festivalTheme: 'diwali', storeName: 'BrajMart' });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const reveal = () => act(() => { vi.advanceTimersByTime(700); });
const tree = (initialEntries = ['/']) => <MemoryRouter initialEntries={initialEntries}>
  <Link to="/products">Shop</Link><Link to="/">Home</Link><FestivalWelcome />
</MemoryRouter>;

it('shows centred Diwali wishes after startup and closes through the continue action', () => {
  render(tree());
  expect(screen.queryByRole('dialog')).toBeNull();
  reveal();
  expect(screen.getByRole('dialog', { name: 'Shubh Deepavali' })).toBeInTheDocument();
  expect(screen.getByText(/May the glow of every diya/)).toBeInTheDocument();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: /Continue exploring/ }));
  fireEvent.click(screen.getByRole('button', { name: /Continue exploring/ }));
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('focuses the visible close action in a short landscape viewport', () => {
  vi.stubGlobal('innerHeight', 390);
  render(tree());
  reveal();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close festival wishes' }));
});

it('stays dismissed while navigating and appears again on a new application load', () => {
  const app = render(tree());
  reveal();
  fireEvent.click(screen.getByRole('button', { name: 'Close festival wishes' }));
  fireEvent.click(screen.getByText('Shop'));
  fireEvent.click(screen.getByText('Home'));
  reveal();
  expect(screen.queryByRole('dialog')).toBeNull();
  app.unmount();
  render(tree());
  reveal();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

it('waits until the visitor reaches home before presenting their first greeting', () => {
  render(tree(['/products']));
  reveal();
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByText('Home'));
  reveal();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

it('handles settings arriving after startup and closes immediately when decorations turn off', () => {
  useSettingsStore.getState().updateSettings({ festivalTheme: 'none' });
  render(tree());
  reveal();
  expect(screen.queryByRole('dialog')).toBeNull();
  act(() => useSettingsStore.getState().updateSettings({ festivalTheme: 'holi' }));
  reveal();
  expect(screen.getByRole('dialog', { name: 'Happy Holi' })).toBeInTheDocument();
  act(() => useSettingsStore.getState().updateSettings({ festivalTheme: 'none' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});

it.each(['/admin/settings', '/checkout', '/payment-status/test', '/product/tulsi-mala'])('does not interrupt %s with a greeting', route => {
  render(tree([route]));
  reveal();
  expect(screen.queryByRole('dialog')).toBeNull();
});
