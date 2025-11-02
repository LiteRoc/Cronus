// ✅ src/components/procedures/ProcedureSelector.tsx
import useSWR from "swr";
import { Select } from "@/components/ui/select";
import { getProcedures } from "@/services/procedureAPI";
import { Procedure } from "@/types";


export const ProcedureSelector: React.FC<{
  selectedId?: string;
  onChange: (id: string | null) => void;
  disabled?: boolean;
}> = ({ selectedId, onChange, disabled }) => {
  const { data: procedures = [] } = useSWR<Procedure[]>("/procedures", getProcedures);


    return (
    <Select
        value={selectedId || ""}
        onChange={(val: any) => onChange(val || null)}
        disabled={disabled}
        >
        <option value="">Select a procedure</option>
            {procedures.map((p) => (
        <option key={p._id} value={p._id}>
            {p.name}
        </option>
        ))}
    </Select>
    );
};