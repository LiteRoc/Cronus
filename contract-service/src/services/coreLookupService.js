// src/services/coreLookupService.js

export const safeGetName = (obj) =>
  obj?.name || obj?.displayName || obj?.fullName || obj?.title || null;

// Per-request cache so we don’t call core-service 5 times for the same ID
export const buildCoreLookup = (coreClient) => {
  const cache = new Map(); // key: `${type}:${id}` -> name|null

  return async (type, id) => {
    if (!id) return null;
    const key = `${type}:${id.toString()}`;
    if (cache.has(key)) return cache.get(key);

    try {
      // Adjust these paths to match YOUR core-service routes
      // Examples shown: /customers/:id and /vendors/:id
      const path =
        type === "customer"
          ? `/customers/${id}`
          : type === "vendor"
          ? `/vendors/${id}`
          : null;

      if (!path) return null;

      const { data } = await coreClient.get(path);
      const name = safeGetName(data) || safeGetName(data?.customer) || safeGetName(data?.vendor);

      cache.set(key, name);
      return name;
    } catch (err) {
      // Don’t fail the whole endpoint if core lookup fails
      console.warn(`[coreLookup] Failed to fetch ${type} ${id}:`, err?.response?.status || err.message);
      cache.set(key, null);
      return null;
    }
  };
};