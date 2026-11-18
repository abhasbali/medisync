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
  CreateUser,
  LoginResponse,
  UpdateUser,
  User,
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

const TOKEN_KEY = "medisync.token";

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string | null) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable: token lives only for this page load */
    }
  },
};

/** Called when the server rejects our token (expired, revoked, user disabled). */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

http.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (r) => r,
  (err) => {
    if (axios.isAxiosError(err) && err.response?.status === 401 && !err.config?.url?.includes("/api/auth/login")) {
      onUnauthorized?.();
    }
    return Promise.reject(err);
  },
);

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
  login: (username: string, password: string) =>
    call<LoginResponse>(http.post("/api/auth/login", { username, password })),
  me: () => call<User>(http.get("/api/auth/me")),
  changePassword: (currentPassword: string, newPassword: string) =>
    call<void>(http.post("/api/auth/change-password", { currentPassword, newPassword })),

  users: () => call<User[]>(http.get("/api/users")),
  createUser: (body: CreateUser) => call<User>(http.post("/api/users", body)),
  updateUser: (id: number, body: UpdateUser) => call<User>(http.put(`/api/users/${id}`, body)),
  resetPassword: (id: number, newPassword: string) =>
    call<void>(http.post(`/api/users/${id}/reset-password`, { newPassword })),

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
  transfer: (id: number) => call<Transfer>(http.get(`/api/transfers/${id}`)),
  createTransfer: (body: CreateTransferRequest) => call<Transfer>(http.post("/api/transfers", body)),
  approveTransfer: (id: number) => call<Transfer>(http.post(`/api/transfers/${id}/approve`)),
  rejectTransfer: (id: number) => call<Transfer>(http.post(`/api/transfers/${id}/reject`)),
};
