type AuthListener = () => void;
let authListeners: AuthListener[] = [];

export const addAuthListener = (fn: AuthListener): (() => void) => {
  authListeners.push(fn);
  return () => { authListeners = authListeners.filter((l) => l !== fn); };
};

export const notifyAuthRequired = (): void =>
  authListeners.forEach((l) => l());

export const clearAuthListeners = (): void => { authListeners = []; };
