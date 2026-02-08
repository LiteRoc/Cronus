// src/pages/Contracts/components/AddAmendmentModal.tsx

import React, { useMemo, useState } from "react";
import type { Asset, AmendmentChangeType, ServiceProviderType, CoverageCode } from "@/types";
import { money } from "@/utils/format";

type Props = {
  open: boolean;
  onClose: () => void;
  assets: Asset[];
  defaultDate?: string; // yyyy-mm-dd
  onSubmit: (payload: {
    date: string;
    description?: string;
    changeType: AmendmentChangeType;
    items: {
      assetId: string;
      deltaValue: number;
      coverageCode: CoverageCode;
      serviceProviderType: ServiceProviderType;
      serviceProviderId?: string;
    }[];
  }) => Promise<void>;
};

type SelectedItem = {
  deltaValue: number;
  coverageCode: CoverageCode;
  serviceProviderType: ServiceProviderType;
  serviceProviderId?: string;
};

const AddAmendmentModal: React.FC<Props> = ({
  open,
  onClose,
  assets,
  defaultDate,
  onSubmit,
}) => {
  const [changeType, setChangeType] = useState<AmendmentChangeType>("add");
  const [date, setDate] = useState(
    defaultDate ?? new Date().toISOString().slice(0, 10)
  );
  const [description, setDescription] = useState("");

  // lightweight search
  const [query, setQuery] = useState("");

  // selected items keyed by assetId
  const [selected, setSelected] = useState<Record<string, SelectedItem>>({});
  const [saving, setSaving] = useState(false);

  const filteredAssets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) => {
      const hay = [a.ctrlNumber, a.manufacturer, a.model, a.serialNumber]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [assets, query]);

  const selectedIds = useMemo(() => Object.keys(selected), [selected]);

  const selectedRows = useMemo(() => {
    const map = new Map(assets.map((a) => [a._id, a]));
    return selectedIds.map((id) => map.get(id)).filter(Boolean) as Asset[];
  }, [assets, selectedIds]);

  const totalDelta = useMemo(() => {
    const sum = Object.values(selected).reduce(
      (s, v) => s + Math.abs(Number(v?.deltaValue) || 0),
      0
    );
    return changeType === "remove" ? -sum : sum;
  }, [selected, changeType]);

  const toggleAsset = (assetId: string) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[assetId] !== undefined) {
        delete next[assetId];
      } else {
        next[assetId] = {
          deltaValue: 0,
          coverageCode: "FSC",
          serviceProviderType: "internal",
        };
      }
      return next;
    });
  };

  const setDeltaValue = (assetId: string, value: number) => {
    setSelected((prev) => ({
      ...prev,
      [assetId]: {
        ...(prev[assetId] ?? {
          deltaValue: 0,
          coverageCode: "FSC",
          serviceProviderType: "internal",
        }),
        deltaValue: value,
      },
    }));
  };

  const setCoverageCode = (assetId: string, coverageCode: CoverageCode) => {
    setSelected((prev) => ({
      ...prev,
      [assetId]: {
        ...(prev[assetId] ?? {
          deltaValue: 0,
          coverageCode: "FSC",
          serviceProviderType: "internal",
        }),
        coverageCode,
      },
    }));
  };

  const setServiceProviderType = (
    assetId: string,
    serviceProviderType: ServiceProviderType
  ) => {
    setSelected((prev) => ({
      ...prev,
      [assetId]: {
        ...(prev[assetId] ?? {
          deltaValue: 0,
          coverageCode: "FSC",
          serviceProviderType: "internal",
        }),
        serviceProviderType,
      },
    }));
  };

  const removeSelected = (assetId: string) => {
    setSelected((prev) => {
      const next = { ...prev };
      delete next[assetId];
      return next;
    });
  };

  const submit = async () => {
    if (!date) return;
    if (selectedIds.length === 0) return;

    const items = selectedIds.map((assetId) => {
      const sel = selected[assetId];
      const raw = Number(sel?.deltaValue || 0);

      // Keep add/remove values positive; changeType indicates direction.
      const deltaValue = changeType === "update" ? raw : Math.abs(raw);

      return {
        assetId,
        deltaValue,
        coverageCode: sel?.coverageCode ?? "FSC",
        serviceProviderType: sel?.serviceProviderType ?? "internal",
        serviceProviderId: sel?.serviceProviderId,
      };
    });

    try {
      setSaving(true);
      await onSubmit({ date, description, changeType, items });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-6xl bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="p-5 border-b flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold">Add Amendment</h2>
              <p className="text-sm text-gray-500">
                Select assets and enter a value + coverage per asset.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 px-2 py-1"
            >
              ✕
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Header fields */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-sm font-medium">Change Type</label>
                <select
                  value={changeType}
                  onChange={(e) =>
                    setChangeType(e.target.value as AmendmentChangeType)
                  }
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="add">Add</option>
                  <option value="remove">Remove</option>
                  <option value="update">Update Value</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium">Effective Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium">Description</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder='e.g., "Initial inventory - 3x Trophon EPR"'
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>

            {/* Search */}
            <div>
              <label className="block text-sm font-medium">Search Assets</label>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ctrl #, manufacturer, model, serial..."
                className="w-full border rounded px-3 py-2"
              />
            </div>

            {/* Asset list */}
            <div className="overflow-auto rounded-lg border border-gray-200 max-h-[35vh]">
              <table className="w-full table-auto border-collapse">
                <thead className="bg-gray-100 text-gray-700 sticky top-0 z-10">
                  <tr>
                    <th className="border px-3 py-2 w-[50px]"></th>
                    <th className="border px-3 py-2">Ctrl #</th>
                    <th className="border px-3 py-2">Manufacturer</th>
                    <th className="border px-3 py-2">Model</th>
                    <th className="border px-3 py-2">Serial</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.map((a) => {
                    const checked = selected[a._id] !== undefined;
                    return (
                      <tr
                        key={a._id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleAsset(a._id)}
                      >
                        <td
                          className="border px-3 py-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAsset(a._id)}
                          />
                        </td>
                        <td className="border px-3 py-2 font-medium">{a.ctrlNumber}</td>
                        <td className="border px-3 py-2">{a.manufacturer}</td>
                        <td className="border px-3 py-2">{a.model}</td>
                        <td className="border px-3 py-2">{a.serialNumber}</td>
                      </tr>
                    );
                  })}
                  {filteredAssets.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-gray-500">
                        No assets match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Selected assets */}
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">
                  Selected Assets ({selectedRows.length})
                </h3>
                <div className="text-sm">
                  Total Delta:{" "}
                  <span className="font-semibold">{money(totalDelta)}</span>
                </div>
              </div>

              {selectedRows.length === 0 ? (
                <p className="text-sm text-gray-500 italic">
                  Select assets above to add them to this amendment.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedRows.map((a) => (
                    <div
                      key={a._id}
                      className="flex items-center gap-3 border rounded px-3 py-2"
                    >
                      <div className="min-w-[140px] font-medium">{a.ctrlNumber}</div>

                      <div className="flex-1 text-sm text-gray-700 truncate">
                        {a.manufacturer} {a.model} — SN: {a.serialNumber ?? "—"}
                      </div>

                      <div className="w-[140px]">
                        <select
                          value={selected[a._id]?.coverageCode ?? "FSC"}
                          onChange={(e) =>
                            setCoverageCode(a._id, e.target.value as CoverageCode)
                          }
                          className="w-full border rounded px-2 py-2 text-sm"
                          title="Coverage"
                        >
                          <option value="FSC">FSC</option>
                          <option value="PMWP">PMWP</option>
                          <option value="PMO">PMO</option>
                          <option value="LBR">LBR</option>
                          <option value="PARTS">PARTS</option>
                          <option value="HYB">HYB</option>
                        </select>
                      </div>

                      <div className="w-[170px]">
                        <select
                          value={selected[a._id]?.serviceProviderType ?? "internal"}
                          onChange={(e) =>
                            setServiceProviderType(
                              a._id,
                              e.target.value as ServiceProviderType
                            )
                          }
                          className="w-full border rounded px-2 py-2 text-sm"
                          title="Service provider"
                        >
                          <option value="internal">Internal (Sigma)</option>
                          <option value="vendor">Vendor</option>
                        </select>
                      </div>

                      <div className="w-[160px]">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={selected[a._id]?.deltaValue ?? 0}
                          onChange={(e) => setDeltaValue(a._id, Number(e.target.value))}
                          className="w-full border rounded px-3 py-2"
                          placeholder="Value"
                        />
                      </div>

                      <button
                        type="button"
                        className="text-red-600 hover:underline text-sm"
                        onClick={() => removeSelected(a._id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="p-5 border-t flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded border hover:bg-gray-50"
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={submit}
              className="ml-auto px-5 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
              disabled={saving || selectedIds.length === 0 || !date}
            >
              {saving ? "Saving..." : "Save Amendment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddAmendmentModal;
