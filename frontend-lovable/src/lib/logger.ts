const isDev = import.meta.env.VITE_MODE === 'development' || import.meta.env.DEV;

export const devDebug = (...args: unknown[]) => {
  if (isDev) {
    console.debug(...args);
  }
};

export const devLog = (...args: unknown[]) => {
  if (isDev) {
    console.log(...args);
  }
};

export const devError = (...args: unknown[]) => {
  if (isDev) {
    console.error(...args);
  }
};
