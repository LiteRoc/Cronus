// src/pages/Contracts/Contracts/ContractDetailPage.tsx

import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createDraftAmendment } from "@/services/contractAPI";
import { previewApplyAmendment, applyApprovedAmendment } from "@/services/contractAPI";
import { submitAmendment, approveAmendment, declineAmendment, voidAmendment } from "@/services/contractAPI";
import { addVendorLink, updateVendorLink, updateVendorLinkAssets, getVendorLinkOverview } from "@/services/contractAPI";
import { useContractOverview } from "@/hooks/useContractOverview";
import { FormCard } from "@/components/ui";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ErrorMessage from "@/components/ui/ErrorMessage";
import AddAmendmentModal from "../components/AddAmendmentModal";
import { useFacilityAssetsForSelect } from "@/hooks/useFacilityAssetsForSelect";
import { useContractValue } from "@/hooks/useContractValue";
import { ContractValuePanel } from "../components/ContractValuePanel";
import { ContractValueChart } from "../components/ContractValueChart";
import { ContractTimelineTable } from "../components/ContractTimelineTable";
import { TimelineEventDetailsModal } from "../Modals/TimelineEventDetailModal";
import type { ContractValueTimelineEvent } from "@/types/ContractValue";
import { fmtMoney, safeDiv } from "@/utils/format";
import { ytdFraction } from "@/utils/dateUtils";
import { showSuccess } from "@/utils/toastUtils";
import { useVendors } from "@/hooks/useVendors";

export default function ContractDetailPage() {
  const { id: contractId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { assets: facilityAssets } = useFacilityAssetsForSelect();
  const { overview, isLoading, isError, mutate } = useContractOverview(contractId);

  const [asOf, setAsOf] = React.useState<string>(new Date().toISOString().slice(0, 10));
  const { value, isLoading: valueLoading, isError: valueError } = useContractValue(contractId || "", asOf);

  const [amendmentOpen, setAmendmentOpen] = React.useState(false);

  const [selectedEvent, setSelectedEvent] = React.useState<ContractValueTimelineEvent | null>(null);
  const [eventModalOpen, setEventModalOpen] = React.useState(false);

  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewData, setPreviewData] = React.useState<any>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);

  const { vendors } = useVendors();
  const [vendorModalOpen, setVendorModalOpen] = React.useState(false);
  const [vendorModalMode, setVendorModalMode] = React.useState<"add" | "edit">("add");
  const [vendorForm, setVendorForm] = React.useState({
    linkId: "",
    vendorId: "",
    coverageType: "full" as "full" | "pm-only" | "parts-only" | "labor-only" | "t&m",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    annualCost: "",
    deductible: "",
    notes: "",
    coveredAssetIds: [] as string[],
    originalAssetIds: [] as string[],
  });

  const [vendorKpiOpen, setVendorKpiOpen] = React.useState(false);
  const [vendorKpiLoading, setVendorKpiLoading] = React.useState(false);
  const [vendorKpiError, setVendorKpiError] = React.useState<string | null>(null);
  const [vendorKpiData, setVendorKpiData] = React.useState<any>(null);
  const [selectedVendorLink, setSelectedVendorLink] = React.useState<any>(null);

  const assetsForLabels = overview?.assets ?? [];
  const assetLabelById = React.useMemo(() => {
    return new Map(
      assetsForLabels.map((a: any) => [
        a._id,
        a.ctrlNumber ||
          a.serialNumber ||
          `${a.manufacturer ?? ""} ${a.model ?? ""}`.trim() ||
          "Asset",
      ])
    );
  }, [assetsForLabels]);

  const openEvent = (row: ContractValueTimelineEvent) => {
    setSelectedEvent(row);
    setEventModalOpen(true);
  };

  const closeEvent = () => {
    setSelectedEvent(null);
    setEventModalOpen(false);
  };

  const coverageTypeLabel: Record<string, string> = {
    "full": "Full",
    "pm-only": "PM Only",
    "parts-only": "Parts Only",
    "labor-only": "Labor Only",
    "t&m": "T&M",
  };

  const openAddVendorLink = () => {
    setVendorModalMode("add");
    setVendorForm({
      linkId: "",
      vendorId: "",
      coverageType: "full",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      annualCost: "",
      deductible: "",
      notes: "",
      coveredAssetIds: [],
      originalAssetIds: [],
    });
    setVendorModalOpen(true);
  };

  const openEditVendorLink = (link: any) => {
    setVendorModalMode("edit");
    setVendorForm({
      linkId: link._id ?? "",
      vendorId: link.vendorId ?? "",
      coverageType: link.coverageType ?? "full",
      startDate: link.startDate ? new Date(link.startDate).toISOString().slice(0, 10) : "",
      endDate: link.endDate ? new Date(link.endDate).toISOString().slice(0, 10) : "",
      annualCost: String(link.annualCost ?? ""),
      deductible: link.deductible != null ? String(link.deductible) : "",
      notes: link.notes ?? "",
      coveredAssetIds: Array.isArray(link.coveredAssetIds) ? link.coveredAssetIds : [],
      originalAssetIds: Array.isArray(link.coveredAssetIds) ? link.coveredAssetIds : [],
    });
    setVendorModalOpen(true);
  };

  const openVendorKpis = async (link: any) => {
    if (!contractId) return;
    setSelectedVendorLink(link);
    setVendorKpiOpen(true);
    setVendorKpiLoading(true);
    setVendorKpiError(null);
    setVendorKpiData(null);
    try {
      const data = await getVendorLinkOverview(contractId, link._id);
      setVendorKpiData(data);
    } catch (e: any) {
      setVendorKpiError(e?.message ?? "Failed to load vendor KPIs.");
    } finally {
      setVendorKpiLoading(false);
    }
  };

  const handleVendorSubmit = async () => {
    if (!contractId) return;
    if (!vendorForm.vendorId) return;

    const selectedVendor = vendors?.find((v: any) => v._id === vendorForm.vendorId);
    const basePayload = {
      vendorId: vendorForm.vendorId,
      nameSnapshot: selectedVendor?.name,
      coverageType: vendorForm.coverageType,
      startDate: vendorForm.startDate,
      endDate: vendorForm.endDate,
      annualCost: Number(vendorForm.annualCost || 0),
      deductible: vendorForm.deductible ? Number(vendorForm.deductible) : undefined,
      notes: vendorForm.notes || undefined,
    };

    let linkId = vendorForm.linkId;
    if (vendorModalMode === "add") {
      const res = await addVendorLink(contractId, {
        ...basePayload,
        coveredAssetIds: vendorForm.coveredAssetIds,
      });
      linkId =
        res?.vendorLink?._id ??
        res?.link?._id ??
        res?.vendorLinkId ??
        res?._id ??
        linkId;
      showSuccess("Vendor link created");
    } else {
      await updateVendorLink(contractId, vendorForm.linkId, basePayload);
      showSuccess("Vendor link updated");
    }

    if (linkId && vendorModalMode === "edit") {
      const prev = new Set(vendorForm.originalAssetIds || []);
      const next = new Set(vendorForm.coveredAssetIds || []);
      const add = Array.from(next).filter((id) => !prev.has(id));
      const remove = Array.from(prev).filter((id) => !next.has(id));
      if (add.length || remove.length) {
        await updateVendorLinkAssets(contractId, linkId, { add, remove });
      }
    }

    setVendorModalOpen(false);
    await mutate();
  };

  if (!contractId) return <div className="p-6 text-red-600">Missing contract ID.</div>;
  if (isLoading) return <LoadingSpinner />;
  if (isError || !overview) return <ErrorMessage message="Contract not found." />;

  const { contract, workOrders, pmSummary, parts, assets } = overview;
  const vendorLinks = contract.vendorLinks ?? [];
  //console.log("Current Contract Amendments:", contract.contractNumber, contract.amendments);
  const financiallyLive = ["approved", "active", "expired", "terminated", "superseded"].includes(contract.status);
  //console.log("Contract Status:", contract.status);

  const AMENDMENT_TRANSITIONS: Record<string, string[]> = {
    draft: ["submitted", "voided"],
    submitted: ["approved", "declined", "voided"],
    approved: ["applied", "voided"],
    applied: ["superseded"],
    declined: ["draft", "voided"],
    voided: [],
    superseded: [],
  };

  const handleAmendmentTransition = async (
    currentStatus: string | undefined,
    nextStatus: string,
    amendmentIndex: number
  ) => {
    if (!contractId) return;

    const status = currentStatus ?? "draft";
    const allowed = AMENDMENT_TRANSITIONS[status] ?? [];
    if (!allowed.includes(nextStatus)) return;

    switch (nextStatus) {
      case "submitted":
        await submitAmendment(contractId, amendmentIndex);
        showSuccess("Amendment submitted");
        break;
      case "approved":
        await approveAmendment(contractId, amendmentIndex);
        showSuccess("Amendment approved");
        break;
      case "applied":
        await applyApprovedAmendment(contractId, amendmentIndex);
        showSuccess("Amendment applied");
        break;
      case "declined":
        await declineAmendment(contractId, amendmentIndex);
        showSuccess("Amendment declined");
        break;
      case "voided":
        await voidAmendment(contractId, amendmentIndex);
        showSuccess("Amendment voided");
        break;
      default:
        return;
    }

    await mutate();
  };

  function PreviewModal({
    open,
    onClose,
    data,
    loading,
    error,
  }: {
    open: boolean;
    onClose: () => void;
    data: any;
    loading: boolean;
    error: string | null;
  }) {
    if (!open) return null;

    const addedAssets = data?.diff?.addedAssets ?? [];
    const removedAssets = data?.diff?.removedAssets ?? [];

    return (
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="p-5 border-b flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">Preview Apply</h2>
                <p className="text-sm text-gray-500">
                  No changes are saved — this is an impact preview.
                </p>
              </div>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-700 px-2 py-1">✕</button>
            </div>
            <pre className="text-xs bg-gray-50 p-2 rounded">
            {JSON.stringify({ addedIds: data?.diff?.addedAssetIds, addedAssetsCount: addedAssets.length }, null, 2)}
          </pre>

            <div className="p-5">
              {loading && <p className="text-sm text-gray-600">Loading preview…</p>}
              {error && <p className="text-sm text-red-600">{error}</p>}

              {!loading && !error && data && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-lg border p-4">
                      <div className="text-sm font-semibold mb-2">Before</div>
                      <div className="text-sm text-gray-700 space-y-1">
                        <div>Total Value: <span className="font-medium">{fmtMoney(data.before?.totalValue)}</span></div>
                        <div>Assets Covered: <span className="font-medium">{data.before?.coveredAssetsCount}</span></div>
                        <div>Annual (as-of eff. date): <span className="font-medium">{fmtMoney(data.before?.annualValueAsOfEffectiveDate)}</span></div>
                        <div>Remaining Term: <span className="font-medium">{fmtMoney(data.before?.remainingTermValueFromEffectiveDate)}</span></div>
                      </div>
                    </div>

                    <div className="rounded-lg border p-4">
                      <div className="text-sm font-semibold mb-2">After</div>
                      <div className="text-sm text-gray-700 space-y-1">
                        <div>Total Value: <span className="font-medium">{fmtMoney(data.after?.totalValue)}</span></div>
                        <div>Assets Covered: <span className="font-medium">{data.after?.coveredAssetsCount}</span></div>
                        <div>Annual (as-of eff. date): <span className="font-medium">{fmtMoney(data.after?.annualValueAsOfEffectiveDate)}</span></div>
                        <div>Remaining Term: <span className="font-medium">{fmtMoney(data.after?.remainingTermValueFromEffectiveDate)}</span></div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border p-4">
                    <div className="text-sm font-semibold mb-2">Delta</div>
                    <div className="text-sm text-gray-700 space-y-1">
                      <div>Total Value Δ: <span className="font-medium">{fmtMoney(data.deltas?.totalValue)}</span></div>
                      <div>Assets Covered Δ: <span className="font-medium">{data.deltas?.coveredAssetsCount}</span></div>
                      <div>Annual Δ: <span className="font-medium">{fmtMoney(data.deltas?.annualValueAsOfEffectiveDate)}</span></div>
                      <div>Remaining Term Δ: <span className="font-medium">{fmtMoney(data.deltas?.remainingTermValueFromEffectiveDate)}</span></div>
                    </div>

                    <div className="mt-3 text-xs text-gray-500">
                      Added assets: {data.diff?.addedAssetIds?.length ?? 0} • Removed assets: {data.diff?.removedAssetIds?.length ?? 0}
                    </div>
                    {(addedAssets.length > 0 || removedAssets.length > 0) && (
                      <div className="rounded-lg border p-4 space-y-3">
                        <div className="text-sm font-semibold">Asset Changes</div>

                        {addedAssets.length > 0 && (
                          <div>
                            <div className="text-sm text-green-700 font-medium mb-1">
                              Added Assets
                            </div>
                            <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
                              {addedAssets.map((a: any) => (
                                <li key={a._id}>
                                  {a.ctrlNumber ?? "--"} · {a.manufacturer ?? "—"} {a.model ?? ""} · SN: {a.serialNumber ?? "—"}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {removedAssets.length > 0 && (
                          <div>
                            <div className="text-sm text-red-700 font-medium mb-1">
                              Removed Assets
                            </div>
                            <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
                              {removedAssets.map((a: any) => (
                                <li key={a._id}>
                                  {a.manufacturer ?? "—"} {a.model ?? ""} · SN: {a.serialNumber ?? "—"}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 border-t flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded border hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function VendorLinkModal({
    open,
    onClose,
    mode,
    form,
    setForm,
    vendors,
    assets,
    onSubmit,
  }: {
    open: boolean;
    onClose: () => void;
    mode: "add" | "edit";
    form: {
      linkId: string;
      vendorId: string;
      coverageType: "full" | "pm-only" | "parts-only" | "labor-only" | "t&m";
      startDate: string;
      endDate: string;
      annualCost: string;
      deductible: string;
      notes: string;
      coveredAssetIds: string[];
      originalAssetIds: string[];
    };
    setForm: React.Dispatch<
      React.SetStateAction<{
        linkId: string;
        vendorId: string;
        coverageType: "full" | "pm-only" | "parts-only" | "labor-only" | "t&m";
        startDate: string;
        endDate: string;
        annualCost: string;
        deductible: string;
        notes: string;
        coveredAssetIds: string[];
        originalAssetIds: string[];
      }>
    >;
    vendors: any[];
    assets: any[];
    onSubmit: () => void;
  }) {
    if (!open) return null;

    return (
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="p-5 border-b flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  {mode === "add" ? "Add Vendor Link" : "Edit Vendor Link"}
                </h2>
                <p className="text-sm text-gray-500">
                  Link a vendor and define covered assets, dates, and cost.
                </p>
              </div>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-700 px-2 py-1">✕</button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Vendor</label>
                  <select
                    className="mt-1 w-full border rounded px-3 py-2"
                    value={form.vendorId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, vendorId: e.target.value }))
                    }
                  >
                    <option value="">Select vendor…</option>
                    {vendors?.map((v) => (
                      <option key={v._id} value={v._id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Coverage Type</label>
                  <select
                    className="mt-1 w-full border rounded px-3 py-2"
                    value={form.coverageType}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        coverageType: e.target.value as any,
                      }))
                    }
                  >
                    <option value="full">Full</option>
                    <option value="pm-only">PM Only</option>
                    <option value="parts-only">Parts Only</option>
                    <option value="labor-only">Labor Only</option>
                    <option value="t&m">T&M</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Start Date</label>
                  <input
                    type="date"
                    className="mt-1 w-full border rounded px-3 py-2"
                    value={form.startDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, startDate: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">End Date</label>
                  <input
                    type="date"
                    className="mt-1 w-full border rounded px-3 py-2"
                    value={form.endDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, endDate: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Annual Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 w-full border rounded px-3 py-2"
                    value={form.annualCost}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, annualCost: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Deductible (optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 w-full border rounded px-3 py-2"
                    value={form.deductible}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, deductible: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Notes</label>
                <textarea
                  className="mt-1 w-full border rounded px-3 py-2"
                  rows={3}
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium">Covered Assets</label>
                <div className="mt-2 max-h-56 overflow-auto border rounded p-3 space-y-2">
                  {assets?.length ? (
                    assets.map((a: any) => {
                      const label =
                        a.ctrlNumber ||
                        a.serialNumber ||
                        `${a.manufacturer ?? ""} ${a.model ?? ""}`.trim() ||
                        "Asset";
                      const checked = form.coveredAssetIds.includes(a._id);
                      return (
                        <label key={a._id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setForm((f) => {
                                const next = new Set(f.coveredAssetIds);
                                if (e.target.checked) next.add(a._id);
                                else next.delete(a._id);
                                return { ...f, coveredAssetIds: Array.from(next) };
                              });
                            }}
                          />
                          <span>{label}</span>
                        </label>
                      );
                    })
                  ) : (
                    <div className="text-sm text-gray-500">No assets available.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 border-t flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded border hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSubmit}
                className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {mode === "add" ? "Add Vendor" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function VendorKpiModal({
    open,
    onClose,
    link,
    loading,
    error,
    data,
    assetCount,
    revenueYTD,
  }: {
    open: boolean;
    onClose: () => void;
    link: any;
    loading: boolean;
    error: string | null;
    data: any;
    assetCount: number;
    revenueYTD: number;
  }) {
    if (!open || !link) return null;

    const overview = data?.vendorLink ? data : data?.overview ?? data ?? {};
    const costToServeYTD =
      overview?.performance?.costToServeYTD ??
      overview?.metrics?.costToServeYTD ??
      link.metricsCache?.costToServeYTD ??
      0;
    const woCountYTD =
      overview?.workOrders?.totalYTD ??
      overview?.metrics?.woCountYTD ??
      link.metricsCache?.woCountYTD ??
      0;
    const pmCompliance =
      overview?.pmSummary?.compliancePercent ??
      overview?.metrics?.pmCompliance ??
      link.metricsCache?.pmCompliance ??
      null;

    const vendorAssetCount = link.coveredAssetIds?.length ?? 0;
    const payoutYTD = (Number(link.annualCost ?? 0) || 0) * ytdFraction();
    const allocatedRevenueYTD = assetCount
      ? revenueYTD * (vendorAssetCount / assetCount)
      : 0;
    const estNetYTD = allocatedRevenueYTD - payoutYTD;

    return (
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="p-5 border-b flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">Vendor KPIs</h2>
                <p className="text-sm text-gray-500">
                  {link.nameSnapshot ?? "Vendor"}
                </p>
              </div>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-700 px-2 py-1">✕</button>
            </div>

            <div className="p-5 space-y-4">
              {loading && <p className="text-sm text-gray-600">Loading KPIs…</p>}
              {error && <p className="text-sm text-red-600">{error}</p>}

              {!loading && !error && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="rounded-lg border p-4">
                    <div className="text-gray-500">Payout YTD (prorated)</div>
                    <div className="text-lg font-semibold">{fmtMoney(payoutYTD)}</div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="text-gray-500">Allocated Revenue YTD</div>
                    <div className="text-lg font-semibold">{fmtMoney(allocatedRevenueYTD)}</div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="text-gray-500">WO Count YTD</div>
                    <div className="text-lg font-semibold">{woCountYTD}</div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="text-gray-500">PM Compliance</div>
                    <div className="text-lg font-semibold">
                      {pmCompliance == null ? "—" : `${pmCompliance}%`}
                    </div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="text-gray-500">Cost-to-Serve YTD</div>
                    <div className="text-lg font-semibold">{fmtMoney(costToServeYTD)}</div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="text-gray-500">Est. Net YTD</div>
                    <div className="text-lg font-semibold">{fmtMoney(estNetYTD)}</div>
                  </div>
                </div>
              )}

              <div className="text-xs text-gray-500">
                Allocated Revenue uses flat allocation: Contract Revenue YTD / Total Assets × Vendor Covered Assets.
              </div>
            </div>

            <div className="p-5 border-t flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded border hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* -------------------- Header -------------------- */}
      <h1 className="text-2xl font-semibold">{contract.name}</h1>
      <p className="text-gray-500">{contract.type}</p>

      {valueError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Unable to calculate contract value for the selected date.
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => setAmendmentOpen(true)}
          className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
        >
          Add Amendment
        </button>

        <AddAmendmentModal
          open={amendmentOpen}
          onClose={() => setAmendmentOpen(false)}
          assets={facilityAssets}
          defaultDate={new Date().toISOString().slice(0, 10)}
          onSubmit={async (payload) => {
            // 1) Create draft amendment
            const draftRes = await createDraftAmendment(contractId, payload);
            console.log("Draft amendment created:", draftRes);
            await mutate();
            showSuccess("Draft amendment created");

            // 2) Optionally apply it immediately
            /*const idx = 
              draftRes?.amendmentIndex ?? 
              draftRes.idx ??
              (draftRes.contract?.amendments?.length
                ? draftRes.contract.amendments.length - 1
                : null);

            if ( idx === null ) throw new Error("Unable to determine amendment index to apply.");

            // 2) Apply it immediately (for now)
            await applyAmendmentByIndex(contractId, idx);
            await mutate();*/
          }}
        />
      </div>

      <ContractValuePanel asOf={asOf} setAsOf={setAsOf} value={value} loading={valueLoading} />

      <div className="mt-6 space-y-6">
        <ContractValueChart rows={value?.fullTimeline || []} />
        <ContractTimelineTable 
          title="Applied events (as-of)" 
          rows={value?.appliedEventsAsOf || []}
          onRowClick={openEvent}
          />
        <ContractTimelineTable 
          title="Full timeline" 
          rows={value?.fullTimeline || []}
          onRowClick={openEvent}
          />

        <TimelineEventDetailsModal
          event={selectedEvent}
          open={eventModalOpen}
          onClose={closeEvent}
        />
      </div>

      {/* -------------------- KPI Cards -------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <FormCard title="PM Compliance">
          <p className="text-3xl font-bold text-blue-600">
            {pmSummary.compliancePercent}%
          </p>
        </FormCard>

        <FormCard title="Work Orders (YTD)">
          <p className="text-3xl font-bold text-blue-600">{workOrders.totalYTD}</p>
        </FormCard>

        <FormCard title="Avg Response Time">
          <p className="text-3xl font-bold text-blue-600">
            {workOrders.avgResponseTimeHours} hrs
          </p>
        </FormCard>

        <FormCard title="Parts Used">
          <p className="text-3xl font-bold text-blue-600">{parts.totalUsed}</p>
        </FormCard>
      </div>

      {/* -------------------- Amendemnts ------------------------------ */}
      <FormCard title="Amendments">
        {(contract.amendments?.length ?? 0) === 0 ? (
          <p className="text-gray-500 italic">No amendments yet.</p>
        ) : (
          <div className="overflow-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="text-left px-3 py-2">#</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Effective</th>
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-left px-3 py-2">Delta</th>
                  <th className="text-left px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                  {(contract.amendments ?? []).map((a: any, idx: number) => {
                    const currentStatus = a.status ?? "draft";
                    const canPreview = ["draft", "submitted", "approved"].includes(currentStatus);
                    const nextActions = AMENDMENT_TRANSITIONS[currentStatus] ?? [];

                    return (
                      <tr key={a._id ?? idx} className="border-t">
                        <td className="px-3 py-2 font-medium">{a.amendmentNumber ?? "—"}</td>
                        <td className="px-3 py-2">{a.status}</td>
                        <td className="px-3 py-2">
                          {a.date ? new Date(a.date).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-3 py-2">{a.changeType}</td>
                        <td className="px-3 py-2">{fmtMoney(a.totalDelta ?? 0)}</td>

                        <td className="px-3 py-2 flex gap-2">
                          <button
                            className="px-3 py-1 rounded border hover:bg-gray-50 disabled:opacity-60"
                            disabled={!canPreview}
                            title={!canPreview ? "Preview not available for this status" : "Preview impact"}
                            onClick={async () => {
                              try {
                                setPreviewError(null);
                                setPreviewData(null);
                                setPreviewOpen(true);
                                setPreviewLoading(true);
                                const data = await previewApplyAmendment(contractId, idx);
                                setPreviewData(data);
                              } catch (e: any) {
                                setPreviewError(e?.message ?? "Failed to load preview");
                              } finally {
                                setPreviewLoading(false);
                              }
                            }}
                          >
                            Preview
                          </button>

                          {currentStatus === "applied" ? (
                            <span className="px-3 py-1 rounded bg-green-100 text-green-800 text-sm">
                              Applied
                            </span>
                          ) : (
                            <>
                              {nextActions.includes("submitted") && (
                                <button
                                  className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                                  onClick={() =>
                                    handleAmendmentTransition(currentStatus, "submitted", idx)
                                  }
                                >
                                  Submit
                                </button>
                              )}

                              {nextActions.includes("approved") && (
                                <button
                                  className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                                  onClick={() =>
                                    handleAmendmentTransition(currentStatus, "approved", idx)
                                  }
                                >
                                  Approve
                                </button>
                              )}

                              {nextActions.includes("applied") && (
                                <button
                                  className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                                  onClick={() =>
                                    handleAmendmentTransition(currentStatus, "applied", idx)
                                  }
                                >
                                  Apply
                                </button>
                              )}

                              {nextActions.includes("declined") && (
                                <button
                                  className="px-3 py-1 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60"
                                  onClick={() =>
                                    handleAmendmentTransition(currentStatus, "declined", idx)
                                  }
                                >
                                  Decline
                                </button>
                              )}

                              {nextActions.includes("voided") && (
                                <button
                                  className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                                  onClick={() =>
                                    handleAmendmentTransition(currentStatus, "voided", idx)
                                  }
                                >
                                  Void
                                </button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </FormCard>

      {/* -------------------- Vendor Links -------------------- */}
      <FormCard title="Vendor Links">
        <div className="flex justify-end mb-4">
          <button
            onClick={openAddVendorLink}
            className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Add Vendor Link
          </button>
        </div>

        {(vendorLinks?.length ?? 0) === 0 ? (
          <p className="text-gray-500 italic">No vendor links yet.</p>
        ) : (
          <div className="overflow-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="text-left px-3 py-2">Vendor</th>
                  <th className="text-left px-3 py-2">Coverage</th>
                  <th className="text-left px-3 py-2">Dates</th>
                  <th className="text-left px-3 py-2">Annual Cost</th>
                  <th className="text-left px-3 py-2">Assets</th>
                  <th className="text-left px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(vendorLinks ?? []).map((link: any) => (
                  <tr key={link._id ?? link.vendorId} className="border-t">
                    <td className="px-3 py-2">
                      {link.nameSnapshot ??
                        vendors?.find((v: any) => v._id === link.vendorId)?.name ??
                        "Vendor"}
                    </td>
                    <td className="px-3 py-2">
                      {coverageTypeLabel[link.coverageType] ?? link.coverageType ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {link.startDate ? new Date(link.startDate).toLocaleDateString() : "—"}{" "}
                      – {link.endDate ? new Date(link.endDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-3 py-2">{fmtMoney(link.annualCost ?? 0)}</td>
                    <td className="px-3 py-2">
                      {link.coveredAssetIds?.length ?? 0}
                    </td>
                    <td className="px-3 py-2 flex gap-2">
                      <button
                        className="px-3 py-1 rounded border hover:bg-gray-50"
                        onClick={() => openVendorKpis(link)}
                      >
                        KPIs
                      </button>
                      <button
                        className="px-3 py-1 rounded border hover:bg-gray-50"
                        onClick={() => openEditVendorLink(link)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </FormCard>

      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        data={previewData}
        loading={previewLoading}
        error={previewError}
      />

      <VendorLinkModal
        open={vendorModalOpen}
        onClose={() => setVendorModalOpen(false)}
        mode={vendorModalMode}
        form={vendorForm}
        setForm={setVendorForm}
        vendors={vendors ?? []}
        assets={facilityAssets ?? []}
        onSubmit={handleVendorSubmit}
      />

      <VendorKpiModal
        open={vendorKpiOpen}
        onClose={() => setVendorKpiOpen(false)}
        link={selectedVendorLink}
        loading={vendorKpiLoading}
        error={vendorKpiError}
        data={vendorKpiData}
        assetCount={assets?.length ?? 0}
        revenueYTD={(value?.annualValueAsOf ?? 0) * ytdFraction()}
      />

      {/* -------------------- Contract Performance -------------------- */}
      <FormCard title="Contract Performance (MVP)">
        {!value ? (
          <p className="text-gray-500 italic">Loading contract value…</p>
        ) : !financiallyLive ? (
          <div className="text-sm space-y-2">
            <div className="text-gray-700">
              This contract is <span className="font-semibold">{contract.status}</span>. Financials begin once it’s approved/active.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 opacity-60">
              <div>
                <div className="text-gray-500">Annual Revenue (as-of)</div>
                <div className="text-lg font-semibold">{fmtMoney(0)}</div>
              </div>
              <div>
                <div className="text-gray-500">Revenue YTD (prorated)</div>
                <div className="text-lg font-semibold">{fmtMoney(0)}</div>
              </div>
              <div>
                <div className="text-gray-500">Remaining Term Value</div>
                <div className="text-lg font-semibold">{fmtMoney(0)}</div>
              </div>
            </div>
          </div>
        ) : (
          (() => {
            const assetCount = assets?.length ?? 0;
            const annualRevenue = value.annualValueAsOf ?? 0;
            const frac = ytdFraction();
            const revenueYTD = annualRevenue * frac;

            // NOTE: your overview parts cost is currently the only “hard” cost we have.
            // Treat it as YTD cost (label it that way). If it’s lifetime, we’ll adjust later.
            const partsCostYTD = parts?.totalPartCost ?? 0;
            const laborCostYTD = overview.labor?.costYTD ?? 0;
            const travelCostYTD = overview.travel?.costYTD ?? 0;
            const totalCostYTD = partsCostYTD + laborCostYTD + travelCostYTD;

            const grossMarginYTD = revenueYTD - totalCostYTD;
            const grossMarginPercent = revenueYTD ? (grossMarginYTD / revenueYTD) * 100 : 0;

            const revenuePerAsset = safeDiv(annualRevenue, assetCount);
            const partsCostPerAsset = safeDiv(partsCostYTD, assetCount);
            const wosPerAsset = safeDiv(workOrders.totalYTD ?? 0, assetCount);

            return (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-gray-500">Annual Revenue (as-of)</div>
                    <div className="text-lg font-semibold">{fmtMoney(annualRevenue)}</div>
                  </div>

                  <div>
                    <div className="text-gray-500">Revenue YTD (prorated)</div>
                    <div className="text-lg font-semibold">{fmtMoney(revenueYTD)}</div>
                  </div>

                  <div>
                    <div className="text-gray-500">Remaining Term Value</div>
                    <div className="text-lg font-semibold">{fmtMoney(value.remainingTermValue)}</div>
                  </div>

                  <div>
                    <div className="text-gray-500">Covered Assets</div>
                    <div className="text-lg font-semibold">{assetCount || "—"}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t">
                  <div>
                    <div className="text-gray-500">Revenue / Asset (annual)</div>
                    <div className="font-semibold">{fmtMoney(revenuePerAsset)}</div>
                  </div>

                  <div>
                    <div className="text-gray-500">Parts Cost (YTD)</div>
                    <div className="font-semibold">{fmtMoney(partsCostYTD)}</div>
                  </div>

                  <div>
                    <div className="text-gray-500">Parts Cost / Asset (YTD)</div>
                    <div className="font-semibold">{fmtMoney(partsCostPerAsset)}</div>
                  </div>

                  <div>
                    <div className="text-gray-500">WO / Asset (YTD)</div>
                    <div className="font-semibold">{wosPerAsset.toFixed(2)}</div>
                  </div>
                </div>

                <div>
                  <div className="text-gray-500">Cost-to-Serve YTD</div>
                  <div className="text-lg font-semibold">{fmtMoney(totalCostYTD)}</div>
                  <div className="text-xs text-gray-500">
                    Parts {fmtMoney(partsCostYTD)} · Labor {fmtMoney(laborCostYTD)} · Travel {fmtMoney(travelCostYTD)}
                  </div>
                </div>

                <div>
                  <div className="text-gray-500">Margin YTD</div>
                  <div className="text-lg font-semibold">{fmtMoney(grossMarginYTD)}</div>
                  <div className="text-xs text-gray-500">{grossMarginPercent.toFixed(1)}%</div>
                </div>
              </div>
            );
          })()
        )}
      </FormCard>
        
      <FormCard title="Top Cost Assets (YTD)">
        {!value ? (
          <p className="text-gray-500 italic">Loading contract value…</p>
        ) : (
          (() => {
            const assetIndex = new Map(
              (overview.assets ?? []).map((a) => [a._id, a])
            );

            const topCosts = (overview.assetCosts ?? []).slice(0, 5);
            const assetCount = overview.assets?.length ?? 0;
            const annualRevenue = value.annualValueAsOf ?? 0;
            const frac = ytdFraction();
            const revenueYTD = annualRevenue * frac;
            const ytdPerAsset = assetCount ? revenueYTD / assetCount : 0;
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="py-2">Asset</th>
                      <th className="py-2">WO</th>
                      <th className="py-2">Labor</th>
                      <th className="py-2">Travel</th>
                      <th className="py-2">Parts</th>
                      <th className="py-2">Cost</th>
                      <th className="py-2">Est. Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCosts.map((row) => {
                      const a = assetIndex.get(row.assetId);
                      const label = a
                        ? `${a.manufacturer ?? ""} ${a.model ?? ""} (${a.serialNumber ?? "SN?"})`
                        : row.assetId;

                      const estMargin = ytdPerAsset - row.totalCost;

                      return (
                        <tr key={row.assetId} className="border-b last:border-b-0">
                          <td className="py-2 pr-4">{label}</td>
                          <td className="py-2">{row.woCount}</td>
                          <td className="py-2">{row.laborHours.toFixed(2)}h</td>
                          <td className="py-2">{row.travelHours.toFixed(2)}h</td>
                          <td className="py-2">{fmtMoney(row.partsCost)}</td>
                          <td className="py-2 font-medium">{fmtMoney(row.totalCost)}</td>
                          <td className="py-2">{fmtMoney(estMargin)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="text-xs text-gray-500 mt-2">
                  Est. Margin uses flat revenue allocation: Revenue YTD / {assetCount || "—"} assets.
                </div>
              </div>
            );
          })()
        )}
      </FormCard>

      {/* -------------------- Covered Assets -------------------- */}
      <FormCard title="Covered Assets">
        {assets.length === 0 ? (
          <p className="text-gray-500 italic">No assets linked to this contract.</p>
        ) : (
          <ul className="list-disc pl-6 text-sm space-y-1">
            {assets.map((a: any) => (
              <li key={a._id}>
                {a.manufacturer} {a.model} — SN: {a.serialNumber || "N/A"}
              </li>
            ))}
          </ul>
        )}
      </FormCard>

      {/* -------------------- Work Orders -------------------- */}
      <FormCard title="Recent Work Orders">
        {overview.workOrdersList?.length ? (
          <ul className="text-sm space-y-2">
            {overview.workOrdersList.slice(0, 10).map((wo: any) => {
              const statusRaw = wo.status ?? "Open";
              const statusGroup = statusRaw === "Completed" ? "Completed" : "Open";
              const statusClasses =
                statusGroup === "Completed"
                  ? "bg-green-100 text-green-800"
                  : "bg-blue-100 text-blue-800";
              const assetLabel = wo.assetId ? assetLabelById.get(wo.assetId) ?? "Asset" : "Asset";

              return (
                <li
                  key={wo._id}
                  className="border-b pb-2 flex flex-wrap items-center justify-between gap-2 text-gray-700"
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/workorders/edit/${wo._id}`)}
                      className="font-medium text-blue-700 hover:underline"
                      title="Open work order"
                    >
                      WO #{wo.workOrderNumber ?? "—"}
                    </button>
                    <span className="text-gray-500">{wo.type ?? "—"}</span>
                  </div>

                  <div className="flex items-center gap-2 text-gray-500">
                    {wo.assetId && (
                      <button
                        type="button"
                        onClick={() => navigate(`/assets/edit/${wo.assetId}`)}
                        className="text-blue-700 hover:underline"
                        title="Open asset"
                      >
                        {assetLabel}
                      </button>
                    )}
                    <span className="text-gray-400">•</span>
                    <span>{new Date(wo.createdAt).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${statusClasses}`}>
                      {statusGroup}
                    </span>
                    <span className="text-xs text-gray-500 capitalize">{statusRaw}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-gray-500 italic">No recent work orders.</p>
        )}
      </FormCard>

      {/* -------------------- Parts Summary -------------------- */}
      <FormCard title="Parts Summary">
        <p>Total parts used: {parts.totalUsed}</p>
        <p>Total parts cost: ${parts.totalPartCost.toFixed(2)}</p>
      </FormCard>

      {/* -------------------- PM Summary -------------------- */}
      <FormCard title="PM Summary">
        <p>Total PMs this year: {pmSummary.dueThisYear}</p>
        <p>Completed: {pmSummary.completedThisYear}</p>
        <p>Overdue: {pmSummary.overdue}</p>
      </FormCard>
    </div>
  );
}
