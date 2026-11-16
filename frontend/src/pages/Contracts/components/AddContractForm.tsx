import { useEffect, useRef, useState, type FormEvent } from "react";
import { useUser } from "@/context/UserContext";
import { useFacility } from "@/context/FacilityContext";
import { createContract } from "@/services/contractCreation";
import type { Contract } from "@/types/Contract";

type Props = {
  onCreated: (contract: Contract) => void;
  onCancel: () => void;
};

export default function AddContractForm(props: Props) {
  const { user } = useUser();
  const { selectedFacilityId, availableFacilities } = useFacility();
  const facility = availableFacilities.find(f => f._id === selectedFacilityId);

  if (user?.role !== "admin" || !facility) return null;

  return (
    <ContractForm
      key={`${user._id}|${facility._id}`}
      facilityId={facility._id}
      facilityName={facility.name}
      {...props}
    />
  );
}

function ContractForm({
  facilityId,
  facilityName,
  onCreated,
  onCancel,
}: Props & { facilityId: string; facilityName: string }) {
  const { user } = useUser();
  const { selectedFacilityId } = useFacility();
  const [name, setName] = useState("");
  const [type, setType] = useState<"customer" | "vendor">("customer");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [annualValue, setAnnualValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const context = useRef({ facilityId: selectedFacilityId, user });
  context.current = { facilityId: selectedFacilityId, user };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;

    const actor = user;
    const amount = Number(annualValue);
    if (
      context.current.facilityId !== facilityId ||
      actor?.role !== "admin"
    ) return;

    if (
      !name.trim() || !startDate || !endDate ||
      endDate < startDate || !annualValue.trim() ||
      !Number.isFinite(amount) || amount < 0
    ) {
      setError("Enter a name, valid contract dates, and a nonnegative annual value.");
      return;
    }

    pending.current = true;
    setSaving(true);
    setError("");

    try {
      const contract = await createContract(facilityId, {
        name: name.trim(),
        type,
        startDate,
        endDate,
        totalValue: amount,
      });

      if (
        mounted.current && context.current.facilityId === facilityId &&
        context.current.user === actor
      ) onCreated(contract);
    } catch {
      if (
        mounted.current && context.current.facilityId === facilityId &&
        context.current.user === actor
      ) {
        setError(
          "Creation could not be confirmed. Check the contract list before trying again."
        );
      }
    } finally {
      pending.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border bg-white p-5" aria-label="Add contract">
      <h2 className="text-xl font-semibold">Add Contract</h2>
      <p className="mt-1 text-sm text-gray-600">
        Hospital: {facilityName}. A contract number will be assigned when the draft is saved.
      </p>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <fieldset disabled={saving} className="space-y-4">
          <label className="block">
            Contract name
            <input required value={name}
              onChange={e => setName(e.target.value)}
              className="mt-1 block w-full rounded border p-2" />
          </label>
          <label className="block">
            Contract type
            <select value={type}
              onChange={e => setType(e.target.value as "customer" | "vendor")}
              className="mt-1 block w-full rounded border p-2">
              <option value="customer">Customer contract</option>
              <option value="vendor">Vendor contract</option>
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              Start date
              <input required type="date" value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="mt-1 block w-full rounded border p-2" />
            </label>
            <label className="block">
              End date
              <input required type="date" value={endDate} min={startDate}
                onChange={e => setEndDate(e.target.value)}
                className="mt-1 block w-full rounded border p-2" />
            </label>
          </div>
          <label className="block">
            Base annual value (USD)
            <input required type="number" min="0" step="0.01" value={annualValue}
              onChange={e => setAnnualValue(e.target.value)}
              className="mt-1 block w-full rounded border p-2" />
          </label>
          <p className="text-sm text-gray-600">
            Enter the original annual value. Addendum adjustments are recorded separately.
          </p>
        </fieldset>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <div className="flex gap-3">
          <button disabled={saving}
            className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">
            {saving ? "Saving…" : "Save Draft"}
          </button>
          <button type="button" disabled={saving} onClick={onCancel}
            className="rounded border px-4 py-2 disabled:opacity-50">
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
