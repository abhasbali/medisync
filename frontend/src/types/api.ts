// TypeScript mirrors of the Spring Boot DTOs (com.medisync.live.dto). Keep these in sync.

export const RESOURCE_TYPES = ["EMERGENCY", "ICU", "VENTILATOR", "GENERAL", "OXYGEN"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const SEVERITIES = ["CRITICAL", "SERIOUS", "STABLE"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const REQUEST_STATUSES = ["PENDING", "ALLOCATED", "DISCHARGED", "CANCELLED"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export type TransferStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ActivityType =
  | "SYSTEM"
  | "REQUEST_CREATED"
  | "ALLOCATED"
  | "QUEUED"
  | "DISCHARGED"
  | "CANCELLED"
  | "INVENTORY_UPDATED"
  | "TRANSFER_REQUESTED"
  | "TRANSFER_APPROVED"
  | "TRANSFER_REJECTED"
  | "USER_MANAGEMENT";

export const ROLES = ["ADMIN", "DISPATCHER", "HOSPITAL_STAFF"] as const;
export type Role = (typeof ROLES)[number];

export interface User {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  hospitalId: number | null;
  hospitalName: string | null;
  enabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  user: User;
}

export interface CreateUser {
  username: string;
  fullName: string;
  password: string;
  role: Role;
  hospitalId: number | null;
}

export interface UpdateUser {
  fullName: string;
  role: Role;
  hospitalId: number | null;
  enabled: boolean;
}

export interface Inventory {
  id: number;
  hospitalId: number;
  hospitalName: string;
  resourceType: ResourceType;
  total: number;
  available: number;
  occupied: number;
  activeAllocations: number;
  updatedAt: string;
}

export interface Hospital {
  id: number;
  name: string;
  area: string;
  phone: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  totalCapacity: number;
  totalAvailable: number;
  inventory: Inventory[];
}

export interface ResourceSummary {
  resourceType: ResourceType;
  total: number;
  available: number;
}

export interface Stats {
  totalCapacity: number;
  totalAvailable: number;
  activeAdmissions: number;
  waitingPatients: number;
  averageDistanceKm: number | null;
  hospitalCount: number;
  pendingTransfers: number;
  byResource: ResourceSummary[];
}

export interface Activity {
  id: number;
  actionType: ActivityType;
  message: string;
  referenceId: number | null;
  actor: string | null;
  createdAt: string;
}

export interface EmergencyRequest {
  id: number;
  patientName: string;
  patientAge: number;
  patientCondition: string;
  severity: Severity;
  resourceType: ResourceType;
  latitude: number;
  longitude: number;
  status: RequestStatus;
  hospitalId: number | null;
  hospitalName: string | null;
  hospitalArea: string | null;
  hospitalPhone: string | null;
  distanceKm: number | null;
  createdAt: string;
  allocatedAt: string | null;
  completedAt: string | null;
  queuePosition: number | null;
}

export interface CreateEmergencyRequest {
  patientName: string;
  patientAge: number;
  patientCondition: string;
  severity: Severity;
  resourceType: ResourceType;
  latitude: number;
  longitude: number;
}

export interface AllocationResult {
  allocated: boolean;
  message: string;
  request: EmergencyRequest;
}

export interface Transfer {
  id: number;
  requesterHospitalId: number;
  requesterHospitalName: string;
  donorHospitalId: number;
  donorHospitalName: string;
  resourceType: ResourceType;
  quantity: number;
  note: string | null;
  status: TransferStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export interface CreateTransferRequest {
  requesterHospitalId: number;
  donorHospitalId: number;
  resourceType: ResourceType;
  quantity: number;
  note?: string;
}

export interface InventoryUpdate {
  total: number;
  available: number;
}

export interface ApiErrorBody {
  timestamp?: string;
  status?: number;
  error?: string;
  message?: string;
  path?: string;
  fieldErrors?: Record<string, string>;
}

/** Payload of /topic/updates (com.medisync.live.websocket.UpdateMessage). */
export interface UpdateMessage {
  type: string;
  entity: "REQUEST" | "INVENTORY" | "TRANSFER";
  referenceId: number | null;
  timestamp: string;
}
