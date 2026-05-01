const listeners = new Set();

export const emitCustomerTabBarVisibility = (visible) => {
  listeners.forEach((listener) => listener(Boolean(visible)));
};

export const subscribeCustomerTabBarVisibility = (listener) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};
