import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { _id: "U", role: "admin" } as any,
  facilityId: "aaaaaaaaaaaaaaaaaaaaaaaa" as string | null,
  create: vi.fn(),
}));

vi.mock("@/context/UserContext", () => ({
  useUser: () => ({ user: state.user }),
}));
vi.mock("@/context/FacilityContext", () => ({
  useFacility: () => ({
    selectedFacilityId: state.facilityId,
    availableFacilities: [
      { _id: "aaaaaaaaaaaaaaaaaaaaaaaa", name: "Synthetic Hospital A" },
      { _id: "bbbbbbbbbbbbbbbbbbbbbbbb", name: "Synthetic Hospital B" },
    ],
  }),
}));
vi.mock("@/services/contractCreation", () => ({
  createContract: state.create,
}));

import AddContractForm from "./AddContractForm";

const created = vi.fn();
const cancel = vi.fn();
const view = () => <AddContractForm onCreated={created} onCancel={cancel} />;

function fill() {
  fireEvent.change(screen.getByLabelText("Contract name"), {
    target: { value: "  Synthetic agreement  " },
  });
  fireEvent.change(screen.getByLabelText("Start date"), {
    target: { value: "2026-01-01" },
  });
  fireEvent.change(screen.getByLabelText("End date"), {
    target: { value: "2026-12-31" },
  });
  fireEvent.change(screen.getByLabelText("Base annual value (USD)"), {
    target: { value: "1200.50" },
  });
}
const submit = () => fireEvent.submit(
  screen.getByRole("button", { name: "Save Draft" }).closest("form")!
);

beforeEach(() => {
  vi.clearAllMocks();
  state.user = { _id: "U", role: "admin" };
  state.facilityId = "aaaaaaaaaaaaaaaaaaaaaaaa";
  state.create.mockResolvedValue({ _id: "C", status: "draft" });
});
afterEach(cleanup);

test("saves the trimmed original annual value for the selected hospital", async () => {
  render(view());
  fill();
  submit();
  await waitFor(() => expect(created).toHaveBeenCalledWith({
    _id: "C", status: "draft",
  }));
  expect(state.create).toHaveBeenCalledWith(state.facilityId, {
    name: "Synthetic agreement",
    type: "customer",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    totalValue: 1200.50,
  });
});

test("hides creation from non-administrators and without a selected hospital", () => {
  state.user = { _id: "U", role: "technician" };
  const result = render(view());
  expect(screen.queryByRole("button", { name: "Save Draft" })).toBeNull();
  state.user = { _id: "U", role: "admin" };
  state.facilityId = null;
  result.rerender(view());
  expect(screen.queryByRole("button", { name: "Save Draft" })).toBeNull();
});

test("rejects reversed dates and negative annual values", () => {
  render(view());
  fill();
  fireEvent.change(screen.getByLabelText("End date"), {
    target: { value: "2025-12-31" },
  });
  submit();
  expect(state.create).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("End date"), {
    target: { value: "2026-12-31" },
  });
  fireEvent.change(screen.getByLabelText("Base annual value (USD)"), {
    target: { value: "-1" },
  });
  submit();
  expect(state.create).not.toHaveBeenCalled();
});

test("blocks duplicate submission while a save is pending", async () => {
  let resolve!: (value: any) => void;
  state.create.mockReturnValue(new Promise(r => { resolve = r; }));
  render(view());
  fill();
  const form = screen.getByRole("button", { name: "Save Draft" }).closest("form")!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(state.create).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  resolve({ _id: "C" });
  await waitFor(() => expect(created).toHaveBeenCalledTimes(1));
});

test("shows an uncertain-save message without reporting success", async () => {
  state.create.mockRejectedValue(new Error("Network failure"));
  render(view());
  fill();
  submit();
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(
    "Check the contract list before trying again"
  ));
  expect(created).not.toHaveBeenCalled();
});

test("clears form and ignores a pending response after a hospital change", async () => {
  let resolve!: (value: any) => void;
  state.create.mockReturnValue(new Promise(r => { resolve = r; }));
  const result = render(view());
  fill();
  submit();
  state.facilityId = "bbbbbbbbbbbbbbbbbbbbbbbb";
  result.rerender(view());
  expect(screen.getByLabelText("Contract name")).toHaveValue("");
  resolve({ _id: "OLD" });
  await waitFor(() => expect(state.create).toHaveBeenCalledTimes(1));
  expect(created).not.toHaveBeenCalled();
});

test("cancel closes the form without creating a contract", () => {
  render(view());
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(cancel).toHaveBeenCalledOnce();
  expect(state.create).not.toHaveBeenCalled();
});
