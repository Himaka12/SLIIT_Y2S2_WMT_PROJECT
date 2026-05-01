let currentAction = null;
const listeners = new Set();

export const emitAdminTabBarAction = (action) => {
  currentAction = action || null;
  listeners.forEach((listener) => listener(currentAction));
};

export const subscribeAdminTabBarAction = (listener) => {
  listeners.add(listener);
  listener(currentAction);

  return () => {
    listeners.delete(listener);
  };
};
