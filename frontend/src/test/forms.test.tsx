import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQuery } from "./utils";
import { EmergencyForm } from "@/components/emergency/EmergencyForm";
import { TransferForm } from "@/components/sharing/TransferForm";
import { api, ApiError, toApiError } from "@/services/api";
import type { AllocationResult, Hospital } from "@/types/api";
import { AxiosError, AxiosHeaders } from "axios";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const allocated: AllocationResult = {
  allocated: true,
  message: "ICU bed reserved",
  request: {
    id: 1,
    patientName: "Test Patient",
    patientAge: 58,
    patientCondition: "Synthetic",
    severity: "CRITICAL",
    resourceType: "ICU",
    latitude: 13.0418,
    longitude: 80.2341,
    status: "ALLOCATED",
    hospitalId: 4,
    hospitalName: "Kauvery Hospital",
    hospitalArea: "Alwarpet",
    hospitalPhone: "044-40006000",
    distanceKm: 2.29,
    createdAt: new Date().toISOString(),
    allocatedAt: new Date().toISOString(),
    completedAt: null,
    queuePosition: null,
  },
};

describe("EmergencyForm", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("shows validation errors and does not call the API when required fields are missing", async () => {
    const spy = vi.spyOn(api, "createRequest");
    renderWithQuery(<EmergencyForm onResult={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /find nearest bed/i }));
    expect(await screen.findByText("Patient name is required")).toBeInTheDocument();
    expect(screen.getByText("Patient age is required")).toBeInTheDocument();
    expect(screen.getByText("Latitude is required")).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it("resolves the selected area to coordinates and submits the request to the backend", async () => {
    const spy = vi.spyOn(api, "createRequest").mockResolvedValue(allocated);
    const onResult = vi.fn();
    renderWithQuery(<EmergencyForm onResult={onResult} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Patient name"), "Test Patient");
    await user.type(screen.getByLabelText("Age"), "58");
    await user.type(screen.getByLabelText("Medical condition"), "Synthetic cardiac case");
    await user.selectOptions(screen.getByLabelText("Severity"), "CRITICAL");
    await user.selectOptions(screen.getByLabelText("Required resource"), "ICU");
    await user.selectOptions(screen.getByLabelText("Patient area"), "T. Nagar");
    expect(screen.getByLabelText("Latitude")).toHaveValue("13.0418");
    expect(screen.getByLabelText("Longitude")).toHaveValue("80.2341");

    await user.click(screen.getByRole("button", { name: /find nearest bed/i }));

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    expect(spy.mock.calls[0][0]).toEqual({
      patientName: "Test Patient",
      patientAge: 58,
      patientCondition: "Synthetic cardiac case",
      severity: "CRITICAL",
      resourceType: "ICU",
      latitude: 13.0418,
      longitude: 80.2341,
    });
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(allocated));
  });

  it("maps server field errors onto the form", async () => {
    vi.spyOn(api, "createRequest").mockRejectedValue(
      new ApiError("Latitude must be between -90 and 90", 400, { latitude: "Latitude must be between -90 and 90 (server)" }),
    );
    renderWithQuery(<EmergencyForm onResult={vi.fn()} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Patient name"), "Test");
    await user.type(screen.getByLabelText("Age"), "30");
    await user.type(screen.getByLabelText("Medical condition"), "x");
    await user.type(screen.getByLabelText("Latitude"), "13");
    await user.type(screen.getByLabelText("Longitude"), "80");
    await user.click(screen.getByRole("button", { name: /find nearest bed/i }));
    expect(await screen.findByText("Latitude must be between -90 and 90 (server)")).toBeInTheDocument();
  });
});

const hospitals = [
  { id: 1, name: "Apollo Hospitals", inventory: [{ id: 2, resourceType: "ICU", total: 30, available: 5 }] },
  { id: 2, name: "MIOT International", inventory: [{ id: 7, resourceType: "ICU", total: 25, available: 2 }] },
] as unknown as Hospital[];

describe("TransferForm", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("rejects the same hospital as requester and donor and a fractional quantity", async () => {
    const spy = vi.spyOn(api, "createTransfer");
    renderWithQuery(<TransferForm hospitals={hospitals} />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Requesting hospital"), "1");
    await user.selectOptions(screen.getByLabelText("Donor hospital"), "1");
    const qty = screen.getByLabelText("Quantity");
    await user.clear(qty);
    await user.type(qty, "2.5");
    await user.click(screen.getByRole("button", { name: /send request/i }));
    expect(await screen.findByText("Requesting and donor hospital must be different")).toBeInTheDocument();
    expect(screen.getByText("Quantity must be a whole number")).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it("warns about insufficient donor stock and submits a valid request", async () => {
    const spy = vi.spyOn(api, "createTransfer").mockResolvedValue({
      id: 9,
      requesterHospitalId: 2,
      requesterHospitalName: "MIOT International",
      donorHospitalId: 1,
      donorHospitalName: "Apollo Hospitals",
      resourceType: "ICU",
      quantity: 2,
      note: null,
      status: "PENDING",
      createdAt: new Date().toISOString(),
      resolvedAt: null,
    });
    renderWithQuery(<TransferForm hospitals={hospitals} />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Requesting hospital"), "2");
    await user.selectOptions(screen.getByLabelText("Donor hospital"), "1");
    const qty = screen.getByLabelText("Quantity");
    await user.clear(qty);
    await user.type(qty, "7");
    expect(screen.getByText(/Approval will fail/)).toBeInTheDocument();
    await user.clear(qty);
    await user.type(qty, "2");
    await user.click(screen.getByRole("button", { name: /send request/i }));
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({
        requesterHospitalId: 2,
        donorHospitalId: 1,
        resourceType: "ICU",
        quantity: 2,
        note: undefined,
      }),
    );
  });
});

describe("API error handling", () => {
  it("extracts the server message and field errors", () => {
    const err = new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 409,
      statusText: "Conflict",
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { message: "Donor does not have enough available units", fieldErrors: {} },
    });
    const apiErr = toApiError(err);
    expect(apiErr.status).toBe(409);
    expect(apiErr.message).toBe("Donor does not have enough available units");
  });

  it("explains when the backend is unreachable", () => {
    const apiErr = toApiError(new AxiosError("Network Error", "ERR_NETWORK"));
    expect(apiErr.message).toMatch(/Cannot reach the MediSync server/);
  });
});
