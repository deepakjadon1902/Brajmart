const getCurrentUserId = () => {
  try {
    const raw = localStorage.getItem('brajmart-auth');
    if (!raw) return 'guest';
    const parsed = JSON.parse(raw);
    return parsed?.state?.user?.id || 'guest';
  } catch {
    return 'guest';
  }
};

export const createUserScopedStorage = (baseKey: string) => ({
  getItem: () => {
    const key = `${baseKey}:${getCurrentUserId()}`;
    return localStorage.getItem(key);
  },
  setItem: (_name: string, value: string) => {
    const key = `${baseKey}:${getCurrentUserId()}`;
    localStorage.setItem(key, value);
  },
  removeItem: () => {
    const key = `${baseKey}:${getCurrentUserId()}`;
    localStorage.removeItem(key);
  },
});
