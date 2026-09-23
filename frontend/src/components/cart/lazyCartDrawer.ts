const importCartDrawer = () => import('./CartDrawer');
let cartDrawerPromise: ReturnType<typeof importCartDrawer> | undefined;

export const loadCartDrawer = () => {
  cartDrawerPromise ??= importCartDrawer();
  return cartDrawerPromise;
};

export const preloadCartDrawer = () => {
  void loadCartDrawer();
};
