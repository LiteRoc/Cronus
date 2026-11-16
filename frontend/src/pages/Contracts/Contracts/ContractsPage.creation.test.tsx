import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const state = vi.hoisted(() => ({
  role: "admin",
  facilityId: "aaaaaaaaaaaaaaaaaaaaaaaa" as string | null,
  mutate: vi.fn(),
}));

vi.mock("@/context/UserContext", () => ({
  useUser: () => ({ user: { _id: "U", role: state.role } }),
}));
vi.mock("@/context/FacilityContext", () => ({
  useFacility: () => ({
    selectedFacilityId: state.facilityId,
    availableFacilities: [
      { _id: "aaaaaaaaaaaaaaaaaaaaaaaa", name: "Synthetic Hospital" },
    ],
  }),
}));
vi.mock("@/hooks/useFacilityContracts", () => ({
  useFacilityContracts: () => ({
    contracts: [], isLoading: false, isError: false, mutate: state.mutate,
  }),
}));
vi.mock("../components/AddContractForm", () => ({
  default: ({ onCancel }: { onCancel: () => void }) => (
    <section aria-label="Creation form">
      <button onClick={onCancel}>Cancel creation</button>
    </section>
  ),
}));

import ContractsPage from "./ContractsPage";

beforeEach(() => {
  state.role = "admin";
  state.facilityId = "aaaaaaaaaaaaaaaaaaaaaaaa";
});
afterEach(cleanup);

test("empty contract list still offers creation and cancellation", () => {
  render(<MemoryRouter><ContractsPage /></MemoryRouter>);
  expect(screen.getByText("No contracts yet.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Add Contract" }));
  expect(screen.getByRole("region", { name: "Creation form" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cancel creation" }));
  expect(screen.queryByRole("region", { name: "Creation form" })).toBeNull();
});

test("creation requires a selected hospital", () => {
  state.facilityId = null;
  render(<MemoryRouter><ContractsPage /></MemoryRouter>);
  expect(screen.getByRole("button", { name: "Add Contract" })).toBeDisabled();
});

test("non-administrators have no creation button", () => {
  state.role = "technician";
  render(<MemoryRouter><ContractsPage /></MemoryRouter>);
  expect(screen.queryByRole("button", { name: "Add Contract" })).toBeNull();
});
