import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { beforeEach } from "vitest";
import { getContacts } from "@/services/contactAPI";

import InteractionForm from "./InteractionForm";

import type { Interaction } from "@/types/Interaction";

const existingInteraction: Interaction = {
  _id: "interaction-1",
  facilityId: "facility-a",
  type: "meeting",
  occurredAt: "2026-08-25T13:30:00.000Z",
  summary: "Original meeting",
  body: "Original discussion",
  direction: "outbound",
  visibility: "operational",
  contactIds: ["historical-contact"],
  createdBy: "user-1",
  updatedBy: "user-1",
  createdAt: "2026-08-25T13:30:00.000Z",
  updatedAt: "2026-08-25T13:30:00.000Z",
  archivedAt: null,
  archivedBy: null,
};

const renderForm = (
  isAdmin: boolean,
  onSubmit = vi.fn().mockResolvedValue(undefined),
  interaction: Interaction | null = null,
) => {
  render(
    <InteractionForm
      interaction={interaction}
      facilityId="facility-a"
      facilityTimezone="America/New_York"
      timezoneLabel="Time zone: Facility — America/New_York"
      isAdmin={isAdmin}
      submitting={false}
      error={null}
      onCancel={vi.fn()}
      onSubmit={onSubmit}
    />,
  );

  return onSubmit;
};

vi.mock("@/services/contactAPI", () => ({
  getContacts: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(getContacts).mockResolvedValue({
    contacts: [],
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });
});

describe("Interaction form", () => {
  test("admin can select restricted visibility", () => {
    renderForm(true);

    expect(screen.getByLabelText("Visibility")).toBeInTheDocument();

    expect(
      screen.getByRole("option", { name: "Restricted" }),
    ).toBeInTheDocument();
  });

  test("technician cannot select restricted visibility", () => {
    renderForm(false);

    expect(screen.queryByLabelText("Visibility")).not.toBeInTheDocument();
    expect(screen.queryByText("Restricted")).not.toBeInTheDocument();
  });

  test("converts Facility-local time into ISO UTC", async () => {
    const onSubmit = renderForm(false);

    fireEvent.change(screen.getByLabelText("Interaction summary"), {
      target: { value: "Service agreement discussion" },
    });

    fireEvent.change(screen.getByLabelText("Interaction date and time"), {
      target: { value: "2026-08-25T09:30" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Save Interaction" }),
    );

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: "Service agreement discussion",
          occurredAt: "2026-08-25T13:30:00.000Z",
          visibility: "operational",
          contactIds: [],
        }),
      );
    });
  });

  test("rejects future Interaction timestamps", async () => {
    const onSubmit = renderForm(true);

    const future = new Date(Date.now() + 60 * 60 * 1000);

    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });

    const parts = Object.fromEntries(
      formatter.formatToParts(future).map((part) => [part.type, part.value]),
    );

    const value =
      `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;

    fireEvent.change(screen.getByLabelText("Interaction summary"), {
      target: { value: "Future activity" },
    });

    fireEvent.change(screen.getByLabelText("Interaction date and time"), {
      target: { value },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Save Interaction" }),
    );

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(/already occurred/);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("rejects ambiguous daylight-saving times", async () => {
    const onSubmit = renderForm(true);

    fireEvent.change(screen.getByLabelText("Interaction summary"), {
      target: { value: "Ambiguous meeting" },
    });

    fireEvent.change(screen.getByLabelText("Interaction date and time"), {
      target: { value: "2026-11-01T01:30" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Save Interaction" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /occurs twice/,
    );

    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("submits selected Contact IDs with the Interaction", async () => {
  vi.mocked(getContacts).mockResolvedValue({
    contacts: [{
      _id: "contact-1",
      organizationId: "organization-1",
      primaryFacilityId: "facility-a",
      facilityIds: ["facility-a"],
      firstName: "Avery",
      lastName: "Morgan",
      title: "",
      functionalDescription: "",
      email: "",
      phone: "",
      notes: "",
      status: "active",
      createdBy: "user-1",
      updatedBy: "user-1",
      archivedAt: null,
      archivedBy: null,
      createdAt: "2026-11-09T12:00:00.000Z",
      updatedAt: "2026-11-09T12:00:00.000Z",
    }],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  });

  const onSubmit = renderForm(false);

  fireEvent.click(
    await screen.findByRole("checkbox", {
      name: "Avery Morgan",
    }),
  );

  fireEvent.change(screen.getByLabelText("Interaction summary"), {
    target: { value: "Met with Avery" },
  });

  fireEvent.change(screen.getByLabelText("Interaction date and time"), {
    target: { value: "2026-08-25T09:30" },
  });

  fireEvent.click(
    screen.getByRole("button", { name: "Save Interaction" }),
  );

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: "Met with Avery",
        contactIds: ["contact-1"],
      }),
    );
  });
});
});

describe("Interaction partial PATCH integrity", () => {
  test("editing summary preserves historical Contact relationships", async () => {
    const onSubmit = renderForm(true, undefined, existingInteraction);

    fireEvent.change(screen.getByLabelText("Interaction summary"), {
      target: { value: "Updated meeting notes" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Save Interaction" }),
    );

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        summary: "Updated meeting notes",
      });
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  test("changing Contact membership includes contactIds", async () => {
    const onSubmit = renderForm(true, undefined, existingInteraction);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove linked Contact 1",
      }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Save Interaction" }),
    );

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        contactIds: [],
      });
    });
  });

  test("unchanged Interaction does not submit a PATCH", async () => {
    const onSubmit = renderForm(true, undefined, existingInteraction);

    fireEvent.click(
      screen.getByRole("button", { name: "Save Interaction" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No changes to save.",
    );

    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("preserves original timestamp precision during unrelated edits", async () => {
    const onSubmit = renderForm(
      true,
      undefined,
      {
        ...existingInteraction,
        occurredAt: "2026-08-25T13:30:42.500Z",
      },
    );

    fireEvent.change(screen.getByLabelText("Interaction summary"), {
      target: { value: "Updated summary" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Save Interaction" }),
    );

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        summary: "Updated summary",
      });
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
