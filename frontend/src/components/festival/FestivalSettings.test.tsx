import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { useSettingsStore } from '@/store/settingsStore';
import { updatePublicSettings } from '@/lib/api';
import FestivalSettings from './FestivalSettings';
import { FestivalDecorations, FestivalFooter, FestivalToran } from './FestivalDecor';

vi.mock('@/lib/api', () => ({ updatePublicSettings: vi.fn() }));
beforeEach(() => { useSettingsStore.getState().updateSettings({ festivalTheme: 'none' }); vi.mocked(updatePublicSettings).mockReset(); });
afterEach(() => { cleanup(); useSettingsStore.getInitialState().settings = { ...useSettingsStore.getState().settings, festivalTheme: 'none' }; });
const setup = () => render(<MemoryRouter><FestivalSettings /><FestivalDecorations /><FestivalToran /><FestivalFooter /></MemoryRouter>);

describe('festival settings and storefront', () => {
  it('persists Diwali, switches to Holi, and turns decorations off', async () => {
    vi.mocked(updatePublicSettings).mockImplementation(async payload => ({ festivalTheme: payload.festivalTheme }));
    setup();
    expect(screen.queryByTestId('festival-decorations')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Apply Diwali decorations' }));
    await screen.findByText('Diwali active');
    expect(updatePublicSettings).toHaveBeenLastCalledWith({ festivalTheme: 'diwali' });
    expect(screen.getByTestId('festival-decorations').className).toContain('festival-diwali');
    expect(screen.getByTestId('festival-toran').className).toContain('festival-diwali');
    fireEvent.click(screen.getByRole('button', { name: 'Apply Holi decorations' }));
    await screen.findByText('Holi active');
    expect(screen.getByTestId('festival-decorations').className).toContain('festival-holi');
    fireEvent.click(screen.getByRole('button', { name: 'Turn decorations off' }));
    await screen.findByText('Decorations off');
    expect(screen.queryByTestId('festival-decorations')).toBeNull();
    expect(screen.queryByTestId('festival-toran')).toBeNull();
  });

  it('keeps the current decoration during a save and after failure, and supports retry', async () => {
    useSettingsStore.getState().updateSettings({ festivalTheme: 'diwali' });
    let rejectSave!: (reason: Error) => void;
    vi.mocked(updatePublicSettings).mockReturnValue(new Promise((_, reject) => { rejectSave = reject; }));
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Apply Holi decorations' }));
    expect(screen.getByRole('button', { name: 'Apply Holi decorations' })).toBeDisabled();
    expect(screen.getByTestId('festival-decorations').className).toContain('festival-diwali');
    rejectSave(new Error('Could not save. Please retry.'));
    await screen.findByRole('alert');
    expect(useSettingsStore.getState().settings.festivalTheme).toBe('diwali');
    vi.mocked(updatePublicSettings).mockResolvedValue({ festivalTheme: 'holi' });
    fireEvent.click(screen.getByRole('button', { name: 'Apply Holi decorations' }));
    await screen.findByText('Holi active');
  });

  it('reports an outdated backend rather than silently claiming success', async () => {
    vi.mocked(updatePublicSettings).mockResolvedValue({ storeName: 'BrajMart' });
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Apply Diwali decorations' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('alert').textContent).toContain('Update the backend');
    expect(useSettingsStore.getState().settings.festivalTheme).toBe('none');
  });

  it.each(['/admin/settings', '/email/unsubscribe'])('omits storefront decorations on %s', path => {
    useSettingsStore.getState().updateSettings({ festivalTheme: 'diwali' });
    render(<MemoryRouter initialEntries={[path]}><FestivalDecorations /><FestivalToran /><FestivalFooter /></MemoryRouter>);
    expect(screen.queryByTestId('festival-decorations')).toBeNull();
    expect(screen.queryByTestId('festival-toran')).toBeNull();
  });

  it.each(['diwali', 'holi'] as const)('renders %s server-side with deterministic decorative vector objects', theme => {
    useSettingsStore.getState().updateSettings({ festivalTheme: theme });
    useSettingsStore.getInitialState().settings = useSettingsStore.getState().settings;
    const node = <StaticRouter location="/"><FestivalDecorations /><FestivalToran /></StaticRouter>;
    const html = renderToString(node);
    expect(html).toContain(`festival-${theme}`);
    expect(html).toContain(`data-motif="${theme === 'diwali' ? 'diya' : 'pichkari'}"`);
    expect(html).toContain('aria-hidden="true"');
    expect(renderToString(node)).toBe(html);
  });

  it('does not allow an older persisted theme to override the current server selection', async () => {
    useSettingsStore.getState().updateSettings({ festivalTheme: 'diwali' });
    localStorage.setItem('brajmart-settings', JSON.stringify({ state: { settings: { festivalTheme: 'holi', storeName: 'Saved name' } }, version: 0 }));
    await useSettingsStore.persist.rehydrate();
    await waitFor(() => expect(useSettingsStore.getState().settings.festivalTheme).toBe('diwali'));
    expect(useSettingsStore.getState().settings.storeName).toBe('Saved name');
    localStorage.clear();
  });
});
