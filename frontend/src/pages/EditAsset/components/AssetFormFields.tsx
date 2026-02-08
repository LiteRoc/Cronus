import React from "react";
import { Asset } from "@/types";
import { Button, Input, Textarea, Select, Checkbox, FormCard } from "@/components/ui";
import { formatISODate } from "@/utils/dateUtils";
import { useFacilityDepartmentData } from "@/hooks/useFacilityDepartmentData";

interface Props {
  asset: Asset;
  isReadOnly: boolean;
  handleChange: (field: keyof Asset, value: any) => void;
  updateField: (path: string, value: any) => void;
}

const AssetFormFields: React.FC<Props> = ({ asset, isReadOnly, handleChange, updateField }) => {
  const { availableFacilities, departments } = useFacilityDepartmentData();

  if (!asset) {
    return <div className="p-4 text-sm text-gray-500">Loading asset…</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* 🏷 Identity */}
      <FormCard title="Identification">
        <Input id="Control Number" value={asset.ctrlNumber} disabled={isReadOnly} onChange={e => handleChange("ctrlNumber", e.target.value)} />
        <Input id="Manufacturer" value={asset.manufacturer} disabled={isReadOnly} onChange={e => handleChange("manufacturer", e.target.value)} />
        <Input id="Model" value={asset.model} disabled={isReadOnly} onChange={e => handleChange("model", e.target.value)} />
        <Input id="Model Number" value={asset.modelNumber ?? ""} disabled={isReadOnly} onChange={e => handleChange("modelNumber", e.target.value)} />
        <Input id="Serial Number" value={asset.serialNumber ?? ""} disabled={isReadOnly} onChange={e => handleChange("serialNumber", e.target.value)} />
        <Input id="Revision Number" value={asset.revisionNumber ?? ""} disabled={isReadOnly} onChange={e => handleChange("revisionNumber", e.target.value)} />
        <Textarea label="Description" value={asset.description ?? ""} disabled={isReadOnly} onChange={e => handleChange("description", e.target.value)} />
      </FormCard>

      {/* 🏥 Location */}
      <FormCard title="Location & Status">
        <Select
          label="Facility"
          value={asset?.facilityId || ""}
          disabled={isReadOnly}
          onChange={(e) => {
            const newFacilityId = e.target.value;
            updateField("facilityId", newFacilityId);
            updateField("departmentId", ""); // reset department when facility changes
          }}
        >
          <option value="">Select Facility</option>
          {availableFacilities.map((fac) => (
            <option key={fac._id} value={fac._id}>
              {fac.name}
            </option>
          ))}
        </Select>
        <Select
          label="Department"
          value={asset?.departmentId || ""}
          disabled={isReadOnly || !asset?.facilityId}
          onChange={(e) => updateField("departmentId", e.target.value)}
        >
          <option value="">Select Department</option>
          {departments.map((dept: any) => (
            <option key={dept._id} value={dept._id}>
              {dept.name}
            </option>
          ))}
        </Select>
        <Input
          id="Location Note"
          value={asset?.locationNote ?? ""}
          disabled={isReadOnly}
          onChange={(e) => updateField("locationNote", e.target.value)}
        />
        <Select label="Status" value={asset.status ?? "Active"} disabled={isReadOnly} onChange={e => updateField("status", e.target.value)}>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Retired">Retired</option>
          <option value="Pending">Pending</option>
        </Select>
      </FormCard>

      {/* 🔗 Parent / Child */}
      <FormCard title="Parent / Child Relationship">
        <Input id="Parent Asset ID" value={asset.parentAsset ?? ""} disabled={isReadOnly} onChange={e => handleChange("parentAsset", e.target.value)} />
        <Input id="Relation to Parent" value={asset.relationToParent ?? ""} disabled={isReadOnly} onChange={e => handleChange("relationToParent", e.target.value)} />
      </FormCard>

      {/* 💰 Financial */}
      <FormCard title="Financial Details">
        <Input id="Purchase Date" type="date" value={formatISODate(asset.purchaseDate)} disabled={isReadOnly} onChange={e => handleChange("purchaseDate", e.target.value)} />
        <Input id="Purchase Cost ($)" type="number" value={asset.purchaseCost ?? ""} disabled={isReadOnly} onChange={e => handleChange("purchaseCost", parseFloat(e.target.value))} />
        <Input id="Budget Value ($)" type="number" value={asset.budgetValue ?? ""} disabled={isReadOnly} onChange={e => handleChange("budgetValue", parseFloat(e.target.value))} />
        <Input id="Contract Value ($)" type="number" value={asset.contractValue ?? ""} disabled={isReadOnly} onChange={e => handleChange("contractValue", parseFloat(e.target.value))} />
      </FormCard>

      {/* 🛡️ Compliance Flags */}
      <div className="md:col-span-2" >
        <FormCard title="Compliance Flags">
          <Checkbox label="HIPAA Relevant" checked={asset.isHIPAARelevant ?? false} disabled={isReadOnly} onChange={e => handleChange("isHIPAARelevant", e.target.checked)} />
          <Checkbox label="Security Sensitive" checked={asset.isSecuritySensitive ?? false} disabled={isReadOnly} onChange={e => handleChange("isSecuritySensitive", e.target.checked)} />
          <Checkbox label="Has Alarm" checked={asset.isAlarmed ?? false} disabled={isReadOnly} onChange={e => handleChange("isAlarmed", e.target.checked)} />
          <Checkbox label="AEM Excluded" checked={asset.isAEMExcluded ?? false} disabled={isReadOnly} onChange={e => handleChange("isAEMExcluded", e.target.checked)} />
          <Select label="Risk Level" value={asset.riskLevel ?? ""} disabled={isReadOnly} onChange={e => handleChange("riskLevel", e.target.value)}>
            <option value="">--</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </Select>
        </FormCard>
      </div>

      {/* ⚕ FDA / Regulatory */}
      <div className="md:col-span-2" >
        <FormCard title="FDA / Regulatory Info" >
          <Input id="Classification Name" value={asset.classificationName ?? ""} disabled={isReadOnly} onChange={e => handleChange("classificationName", e.target.value)} />
          <Input id="Regulation Number" value={asset.regulationNumber ?? ""} disabled={isReadOnly} onChange={e => handleChange("regulationNumber", e.target.value)} />
          <Input id="Panel" value={asset.panel ?? ""} disabled={isReadOnly} onChange={e => handleChange("panel", e.target.value)} />
          <Checkbox label="Prescription Required" checked={asset.prescriptionRequired ?? false} disabled={isReadOnly} onChange={e => handleChange("prescriptionRequired", e.target.checked)} />
          <Checkbox label="OTC" checked={asset.otc ?? false} disabled={isReadOnly} onChange={e => handleChange("otc", e.target.checked)} />
          <Input id="Submission #" value={asset.submissionNumber ?? ""} disabled={isReadOnly} onChange={e => handleChange("submissionNumber", e.target.value)} />
          <Input id="Manufacturer DUNS" value={asset.manufacturerDUNS ?? ""} disabled={isReadOnly} onChange={e => handleChange("manufacturerDUNS", e.target.value)} />
          <Textarea label="GMDN Definition" value={asset.gmdnDefinition ?? ""} disabled={isReadOnly} onChange={e => handleChange("gmdnDefinition", e.target.value)} />
        </FormCard>
      </div>

      {/* 🧩 Attributes */}
      <div className="md:col-span-2">
        <FormCard title="Custom Attributes">
          {Object.entries(asset.attributes || {}).map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <Input
                placeholder="Name"
                value={key}
                disabled={isReadOnly}
                onChange={(e) => {
                  const newKey = e.target.value;
                  const updated: Record<string, string> = { ...(asset.attributes as Record<string, string>) };
                  delete updated[key];
                  updated[newKey] = value?.toString() ?? "";
                  updateField("attributes", updated);
                }}
              />
              <Input
                placeholder="Value"
                value={value?.toString() ?? ""}
                disabled={isReadOnly}
                onChange={(e) => {
                  const updated: Record<string, string> = { ...(asset.attributes as Record<string, string>) };
                  updated[key] = e.target.value;
                  updateField("attributes", updated);
                }}
              />
            </div>
          ))}

          {!isReadOnly && (
            <Button
              variant="default"
              size="md"
              onClick={() => {
                const updated = { ...asset.attributes, [`attr${Date.now()}`]: "" };
                updateField("attributes", updated);
              }}
            >
              + Add Attribute
            </Button>
          )}
        </FormCard>
      </div>

    </div>
  );
};

export default AssetFormFields;