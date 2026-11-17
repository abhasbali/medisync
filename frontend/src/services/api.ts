import axios, { AxiosError } from "axios";
import type {
  Activity,
  AllocationResult,
  ApiErrorBody,
  CreateEmergencyRequest,
  CreateTransferRequest,
  EmergencyRequest,
  Hospital,
  Inventory,
  InventoryUpdate,
  RequestStatus,
  Severity,
  Stats,
  Transfer,
} from "@/types/api";

/** In development Vite proxies /api to http://localhost:8080; set VITE_API_BASE_URL for other setups. */
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "",
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

/** Error carrying the server's message and per-field validation errors. */
export class ApiError extends Error {
  status: number | undefined;
  fieldErrors: Record<string, string>;

  constructor(message: string, status?: number, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<ApiErrorBody>;
    if (!ax.response) {
      return new ApiError("Cannot reach the MediSync server. Check that the backend is running on port 8080.");
    }
    const body = ax.response.data;
    const message =
      (body && typeof body === "object" && body.message) || `Request failed with status ${ax.response.status}`;
    return new ApiError(message, ax.response.status, body?.fieldErrors ?? {});
  }
  return new ApiError(err instanceof Error ? err.message : "Unexpected error");
}

async function call<T>(promise: Promise<{ data: T }>): Promise<T> {
  try {
    return (await promise).data;
  } catch (err) {
    throw toApiError(err);
  }
}

export interface RequestFilters {
  status?: RequestStatus;
  severity?: Severity;
  search?: string;
}

export const api = {
  hospitals: () => call<Hospital[]>(http.get("/api/hospitals")),
  hospital: (id: number) => call<Hospital>(http.get(`/api/hospitals/${id}`)),
  stats: () => call<Stats>(http.get("/api/stats")),
  activity: (limit = 30) => call<Activity[]>(http.get("/api/activity", { params: { limit } })),

  inventory: () => call<Inventory[]>(http.get("/api/inventory")),
  hospitalInventory: (hospitalId: number) => call<Inventory[]>(http.get(`/api/inventory/hospital/${hospitalId}`)),
  updateInventory: (id: number, body: InventoryUpdate) => call<Inventory>(http.patch(`/api/inventory/${id}`, body)),

  requests: (filters: RequestFilters = {}) =>
    call<EmergencyRequest[]>(
      http.get("/api/requests", {
        params: {
          status: filters.status || undefined,
          severity: filters.severity || undefined,
          search: filters.search?.trim() || undefined,
        },
      }),
    ),
  request: (id: number) => call<EmergencyRequest>(http.get(`/api/requests/${id}`)),
  queue: () => call<EmergencyRequest[]>(http.get("/api/requests/queue")),
  createRequest: (body: CreateEmergencyRequest) => call<AllocationResult>(http.post("/api/requests", body)),
  discharge: (id: number) => call<EmergencyRequest>(http.post(`/api/requests/${id}/discharge`)),
  cancel: (id: number) => call<EmergencyRequest>(http.post(`/api/requests/${id}/cancel`)),

  transfers: () => call<Transfer[]>(http.get("/api/transfers")),
  createTransfer: (body: CreateTransferRequest) => call<Transfer>(http.post("/api/transfers", body)),
  approveTransfer: (id: number) => call<Transfer>(http.post(`/api/transfers/${id}/approve`)),
  rejectTransfer: (id: number) => call<Transfer>(http.post(`/api/transfers/${id}/reject`)),
};
