const importCartDrawer = () => import('./CartDrawer');
let cartDrawerPromise: ReturnType<typeof importCartDrawer> | undefined;

export const loadCartDrawer = () => {
  cartDrawerPromise ??= importCartDrawer().catch((error) => {
    cartDrawerPromise = undefined;
    throw error;
  });
  return cartDrawerPromise;
};

export const preloadCartDrawer = () => {
  void loadCartDrawer().catch(() => {});
};
