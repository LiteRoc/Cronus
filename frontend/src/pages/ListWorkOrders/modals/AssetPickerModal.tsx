// src/components/AssetPickerModal.tsx
import { useEffect, useState } from "react";
import { Button, Label, Input } from "@/components/ui";
import Modal from "@/components/Modal";
import { Asset, AssetFilters } from "@/types";
import { useAssetsLite } from "../hooks/useAssetsLite";
import { useDebouncedValue } from "../hooks/useDebounceValue"; // optional

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (asset: Asset) => void;
};

export default function AssetPickerModal({ isOpen, onClose, onSelect }: Props) {
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 300); // optional
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const filters: AssetFilters = { q: debouncedQ /*, status: "Active" */ };

  const { assets, totalPages, isLoading } = useAssetsLite(filters, page, pageSize);

  useEffect(() => {
    if (!isOpen) {
      setQ("");
      setPage(1);
    }
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="w-full max-w-3xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Select Asset</h3>

        {/* a11y: real label, visually hidden */}
        <Label htmlFor="asset-search" srOnly>
          Search assets
        </Label>
        <Input
          id="asset-search"
          type="search"
          placeholder="Search ctrl #, model, mfr, serial…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          autoComplete="off"
          className="w-72"
        />
      </div>

      <div className="border rounded">
        <div className="grid grid-cols-6 bg-gray-50 px-3 py-2 text-xs font-semibold">
          <div>Ctrl #</div><div>Manufacturer</div><div>Model</div>
          <div>Serial</div><div>Status</div><div></div>
        </div>

        <div className="max-h-80 overflow-auto divide-y">
          {isLoading && <div className="p-4 text-sm">Loading…</div>}
          {!isLoading && assets.length === 0 && <div className="p-4 text-sm">No assets found.</div>}

          {assets.map(a => (
            <div key={a._id} className="grid grid-cols-6 items-center px-3 py-2 text-sm">
              <div className="truncate">{a.ctrlNumber}</div>
              <div className="truncate">{a.manufacturer}</div>
              <div className="truncate">{a.model}</div>
              <div className="truncate">{a.serialNumber}</div>
              <div className="truncate">{a.status}</div>
              <div className="text-right">
                <Button variant="default" size="md" onClick={() => onSelect(a)}>Select</Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
          <span className="text-sm">Page {page} / {Math.max(1, totalPages)}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      </div>
    </Modal>
  );
}