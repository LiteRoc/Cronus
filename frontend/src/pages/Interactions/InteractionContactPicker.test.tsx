import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import InteractionContactPicker from "./InteractionContactPicker";
import { getContacts } from "@/services/contactAPI";
import type { Contact } from "@/types/Contact";

vi.mock("@/services/contactAPI", () => ({
  getContacts: vi.fn(),
}));

const api = vi.mocked(getContacts);

const contact = (
  id: string,
  name: string,
  facilityId = "facility-a",
  status: Contact["status"] = "active",
): Contact => ({
  _id: id,
  organizationId: "organization-1",
  primaryFacilityId: facilityId,
  facilityIds: [facilityId],
  firstName: name,
  lastName: "Contact",
  title: "",
  functionalDescription: "",
  email: "",
  phone: "",
  notes: "",
  status,
  createdBy: "user-1",
  updatedBy: "user-1",
  archivedAt: null,
  archivedBy: null,
  createdAt: "2026-11-09T12:00:00.000Z",
  updatedAt: "2026-11-09T12:00:00.000Z",
});

const response = (contacts: Contact[], page = 1, totalPages = 1) => ({
  contacts,
  total: contacts.length,
  page,
  limit: 20,
  totalPages,
});

function deferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

function Harness({ facilityId }: { facilityId: string }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  return (
    <>
      <InteractionContactPicker
        facilityId={facilityId}
        selectedIds={selectedIds}
        onChange={setSelectedIds}
      />

      <output data-testid="selected-ids">
        {selectedIds.join(",")}
      </output>
    </>
  );
}

beforeEach(() => {
  api.mockReset();
});

describe("Interaction Contact picker", () => {
  test("allows active Contacts in the selected Facility only", async () => {
    api.mockResolvedValue(
      response([
        contact("a", "Avery"),
        contact("inactive", "Inactive", "facility-a", "inactive"),
        contact("foreign", "Foreign", "facility-b"),
      ]),
    );

    render(<Harness facilityId="facility-a" />);

    const eligible = await screen.findByRole("checkbox", {
      name: "Avery Contact",
    });

    fireEvent.click(eligible);

    expect(screen.getByTestId("selected-ids")).toHaveTextContent("a");

    expect(
      screen.getByRole("checkbox", {
        name: /Inactive Contact/,
      }),
    ).toBeDisabled();

    expect(
      screen.getByRole("checkbox", {
        name: /Foreign Contact/,
      }),
    ).toBeDisabled();
  });

  test("preserves multiple selections across pagination", async () => {
    api.mockImplementation(async (_facilityId, params) =>
      params?.page === 2
        ? response([contact("b", "Blake")], 2, 2)
        : response([contact("a", "Avery")], 1, 2),
    );

    render(<Harness facilityId="facility-a" />);

    fireEvent.click(
      await screen.findByRole("checkbox", {
        name: "Avery Contact",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    fireEvent.click(
      await screen.findByRole("checkbox", {
        name: "Blake Contact",
      }),
    );

    expect(screen.getByTestId("selected-ids")).toHaveTextContent("a,b");

    expect(screen.getByLabelText("Selected Contacts")).toHaveTextContent(
      "Avery Contact",
    );

    expect(screen.getByLabelText("Selected Contacts")).toHaveTextContent(
      "Blake Contact",
    );
  });

  test("preserves selections when searching", async () => {
    api.mockImplementation(async (_facilityId, params) =>
      params?.search === "Blake"
        ? response([contact("b", "Blake")])
        : response([contact("a", "Avery")]),
    );

    render(<Harness facilityId="facility-a" />);

    fireEvent.click(
      await screen.findByRole("checkbox", {
        name: "Avery Contact",
      }),
    );

    fireEvent.change(screen.getByLabelText("Search linked Contacts"), {
      target: { value: "Blake" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    fireEvent.click(
      await screen.findByRole("checkbox", {
        name: "Blake Contact",
      }),
    );

    expect(screen.getByTestId("selected-ids")).toHaveTextContent("a,b");
  });

  test("clears old Facility Contact names immediately", async () => {
    api.mockImplementation(async (facilityId) =>
      response([
        facilityId === "facility-a"
          ? contact("a", "Avery")
          : contact("b", "Blake", "facility-b"),
      ]),
    );

    const view = render(<Harness facilityId="facility-a" />);

    expect(
      await screen.findByText("Avery Contact"),
    ).toBeInTheDocument();

    view.rerender(<Harness facilityId="facility-b" />);

    expect(screen.queryByText("Avery Contact")).not.toBeInTheDocument();

    expect(
      await screen.findByText("Blake Contact"),
    ).toBeInTheDocument();
  });

  test("ignores stale responses from a previous Facility", async () => {
    const stale = deferred<ReturnType<typeof response>>();

    api.mockImplementation((facilityId) =>
      facilityId === "facility-a"
        ? stale.promise
        : Promise.resolve(
            response([contact("b", "Blake", "facility-b")]),
          ),
    );

    const view = render(<Harness facilityId="facility-a" />);

    view.rerender(<Harness facilityId="facility-b" />);

    expect(
      await screen.findByText("Blake Contact"),
    ).toBeInTheDocument();

    await act(async () => {
      stale.resolve(response([contact("a", "Avery")]));
      await stale.promise;
    });

    expect(screen.queryByText("Avery Contact")).not.toBeInTheDocument();
  });

  test("removes a selected Contact without affecting others", async () => {
    api.mockResolvedValue(
      response([
        contact("a", "Avery"),
        contact("b", "Blake"),
      ]),
    );

    render(<Harness facilityId="facility-a" />);

    fireEvent.click(
      await screen.findByRole("checkbox", {
        name: "Avery Contact",
      }),
    );

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Blake Contact",
      }),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove linked Contact 1",
      }),
    );

    expect(screen.getByTestId("selected-ids")).toHaveTextContent("b");
  });
});
