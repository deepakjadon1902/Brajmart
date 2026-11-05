const RELOAD_KEY = 'brajmart-module-reload-entry';
let reloadScheduled = false;

export const isModuleLoadError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error || '');
  return (error instanceof Error && error.name === 'ChunkLoadError')
    || /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading (?:CSS )?chunk [\s\S]* failed|Unable to preload CSS|Failed to load module script/i.test(message);
};

// Remember the loaded entry, rather than blocking recovery for the whole tab's
// lifetime. A later deployment can recover again; the same build cannot loop.
export const recoverFromModuleLoadError = (error: unknown): boolean => {
  if (typeof window === 'undefined' || !isModuleLoadError(error) || window.navigator.onLine === false) return false;
  if (reloadScheduled) return true;

  const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src || import.meta.url;
  try {
    if (window.sessionStorage.getItem(RELOAD_KEY) === entry) return false;
    window.sessionStorage.setItem(RELOAD_KEY, entry);
  } catch {
    // Without persistent reload protection, leave recovery to the reload button.
    return false;
  }

  reloadScheduled = true;
  window.setTimeout(() => window.location.reload(), 250);
  return true;
};

export const installModuleLoadRecovery = () => {
  const onPreloadError = (event: Event & { payload?: unknown }) => {
    recoverFromModuleLoadError(event.payload);
    // Keep the rejection intact so React can show its fallback if loading still
    // fails. Suppressing it makes Vite resolve the import with an empty module.
  };
  window.addEventListener('vite:preloadError', onPreloadError);
  return () => window.removeEventListener('vite:preloadError', onPreloadError);
};
