export const HOME_PRODUCT_LIMIT = 6;

export const homePositionOf = (product) => {
  const position = Number(product.homePosition);
  return product.showOnHome && Number.isInteger(position) && position >= 1 && position <= HOME_PRODUCT_LIMIT ? position : null;
};

// Keep each automatic product in its original position unless a manual choice
// replaces it. Fill any holes left by moving an existing top product only once.
export const pickHomeProducts = (items, compare, usePositions = true) => {
  const unique = [...new Map(items.map((product) => [String(product.id), product])).values()];
  const ranked = [...unique].sort((a, b) => compare(a, b) ||
    String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
  if (!usePositions) return ranked.slice(0, HOME_PRODUCT_LIMIT);
  const size = Math.min(HOME_PRODUCT_LIMIT, ranked.length);
  const slots = ranked.slice(0, size);
  const pinned = new Map();
  const selected = unique.filter((product) => product.showOnHome);
  const numbered = selected.filter(homePositionOf).sort((a, b) =>
    String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')) || String(a.id).localeCompare(String(b.id)));
  for (const product of numbered) {
    const index = Math.min(homePositionOf(product), size) - 1;
    if (!pinned.has(index)) pinned.set(index, product);
  }
  // Preserve selections made before numbered positions were introduced.
  for (const product of selected.filter((product) => !homePositionOf(product))) {
    const index = Array.from({ length: size }, (_, i) => i).find((i) => !pinned.has(i));
    if (index !== undefined) pinned.set(index, product);
  }
  const used = new Set([...pinned.values()].map((product) => String(product.id)));
  for (let i = 0; i < size; i++) {
    if (pinned.has(i)) slots[i] = pinned.get(i);
    else if (used.has(String(slots[i].id))) slots[i] = undefined;
    else used.add(String(slots[i].id));
  }
  const replacements = ranked.filter((product) => !used.has(String(product.id)));
  return slots.map((product) => product || replacements.shift()).filter(Boolean);
};
