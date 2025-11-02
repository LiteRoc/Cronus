//src/pages/EditWorkOrder/components/TestEquipmentSection.tsx

import React from "react";
import { FormCard, Button } from "@/components/ui";
import { WorkOrder } from "@/types/WorkOrder";

type Props = {
  workOrder: WorkOrder;
  onDeleteTestEquip: (equipmentId: string) => void;
  onShowAddTestEquipModal: () => void;
};

const TestEquipmentSection: React.FC<Props> = ({ workOrder, onDeleteTestEquip, onShowAddTestEquipModal }: Props) => {

  console.log("🔍 testEquipmentUsed", workOrder.testEquipmentUsed);

  return (
    <FormCard title="Test Equipment">
        <div className="flex justify-end mb-3">
          <Button 
            type="button"
            className="bg-blue-600 text-white px-3 py-1 rounded"
            onClick={() => onShowAddTestEquipModal()}
          >
             + Add Equipment
          </Button>
        </div>

        {workOrder.testEquipmentUsed?.length === 0 && (
          <p className="text-sm text-muted-foreground">No test equipment logged.</p>
        )}

        <ul className="space-y-2">
          {workOrder.testEquipmentUsed?.map((te) => {
            const asset = te.equipmentId as any;
            return (
              <li key={te._id} className="flex justify-between items-center border rounded px-3 py-2">
                <div>
                  <div className="font-medium">{asset.ctrlNumber}</div>
                  <div className="text-sm text-muted-foreground">
                    {asset.manufacturer} {asset.model}
                  </div>
                  {te.note && (
                    <div className="text-sm italic text-gray-500 mt-1">Note: {te.note}</div>
                  )}
                </div>
                
                {/* Remove Button*/}
                {workOrder.status !== "Closed" && (
                  <Button
                    type="button"
                    className="bg-red-600 text-white px-3 py-1 rounded h-fit"
                    onClick={() => {
                      const id = 
                        typeof te.equipmentId === "object"
                          ? te.equipmentId._id // populated case
                          : te.equipmentId; // string ID case
                      onDeleteTestEquip?.(id!);
                    }}
                  >
                    - Remove
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
    </FormCard>
  );
};

export default TestEquipmentSection;