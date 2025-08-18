import React from "react";
import { Asset } from "../../../types/types";

interface Props {
  asset: Asset;
  onChange: (field: keyof Asset, value: any) => void;
}

const AssetFormFields: React.FC<Props> = ({ asset, onChange }) => {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block font-semibold">Control Number</label>
        <input
          className="w-full border p-2"
          value={asset.ctrlNumber}
          onChange={(e) => onChange("ctrlNumber", e.target.value)}
        />
      </div>

      <div>
        <label className="block font-semibold">Manufacturer</label>
        <input
          className="w-full border p-2"
          value={asset.manufacturer}
          onChange={(e) => onChange("manufacturer", e.target.value)}
        />
      </div>

      <div>
        <label className="block font-semibold">Model</label>
        <input
          className="w-full border p-2"
          value={asset.model}
          onChange={(e) => onChange("model", e.target.value)}
        />
      </div>

      <div>
        <label className="block font-semibold">Serial Number</label>
        <input
          className="w-full border p-2"
          value={asset.serialNumber}
          onChange={(e) => onChange("serialNumber", e.target.value)}
        />
      </div>

      <div>
        <label className="block font-semibold">Status</label>
        <select
          className="w-full border p-2"
          value={asset.status}
          onChange={(e) => onChange("status", e.target.value)}
        >
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      <div>
        <label className="block font-semibold">Category</label>
        <select
          className="w-full border p-2"
          value={asset.category}
          onChange={(e) => onChange("category", e.target.value)}
        >
          <option value="Biomed">Biomed</option>
          <option value="test">Test Equipment</option>
          <option value="Biomed">Imaging</option>
          <option value="Biomed">Sterilizer</option>
        </select>
      </div>
      <div>
        <label className="block font-semibold">Notes</label>
            <textarea
                id="notes"
                name="notes"
                value={asset.notes || ""}
                onChange={(e) => onChange("notes", e.target.value)}
                className="border p-2 rounded w-full"
                rows={4}
            >
                
            </textarea>
        </div>
    </div>
  );
};

export default AssetFormFields;