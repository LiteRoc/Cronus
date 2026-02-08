// src/services/coreAssetService.js

export async function fetchAssetsByIds(coreClient, assetIds = []) {
  const unique = [...new Set(assetIds.filter(Boolean).map(String))];
  if (!unique.length) return [];

  // assumes core-service supports POST /assets/batch { ids: [] }
  const { data } = await coreClient.post("/assets/batch", { assetIds: unique });

  // normalize shape: allow core to return either { assets: [] } or [].
  const assets = Array.isArray(data) ? data : (data?.assets ?? []);
  console.log("assets/batch raw response type:", Array.isArray(data) ? "array" : typeof data, data);

  // return only what the UI needs (and keep response stable)
  return assets.map(a => ({
    _id: String(a._id),
    manufacturer: a.manufacturer ?? "",
    model: a.model ?? "",
    serialNumber: a.serialNumber ?? "",
    ctrlNumber: a.ctrlNumber ?? "",
    departmentId: a.departmentId ?? null,
    facilityId: a.facilityId ?? null,
  }));
}