import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type RequestFilters } from "@/services/api";
import type { CreateEmergencyRequest, CreateTransferRequest, InventoryUpdate } from "@/types/api";

/** Query keys grouped by the data they represent, so WebSocket events can invalidate precisely. */
export const keys = {
  hospitals: ["hospitals"] as const,
  stats: ["stats"] as const,
  activity: ["activity"] as const,
  inventory: ["inventory"] as const,
  hospitalInventory: (id: number) => ["inventory", "hospital", id] as const,
  requests: ["requests"] as const,
  requestList: (f: RequestFilters) => ["requests", "list", f] as const,
  queue: ["requests", "queue"] as const,
  transfers: ["transfers"] as const,
};

export const useHospitals = () => useQuery({ queryKey: keys.hospitals, queryFn: api.hospitals });
export const useStats = () => useQuery({ queryKey: keys.stats, queryFn: api.stats });
export const useActivity = (limit = 30) =>
  useQuery({ queryKey: [...keys.activity, limit], queryFn: () => api.activity(limit) });
export const useHospitalInventory = (id: number | null) =>
  useQuery({
    queryKey: keys.hospitalInventory(id ?? 0),
    queryFn: () => api.hospitalInventory(id as number),
    enabled: id != null,
  });
export const useRequests = (filters: RequestFilters) =>
  useQuery({ queryKey: keys.requestList(filters), queryFn: () => api.requests(filters) });
export const useQueue = () => useQuery({ queryKey: keys.queue, queryFn: api.queue });
export const useTransfers = () => useQuery({ queryKey: keys.transfers, queryFn: api.transfers });

/**
 * Every mutation can change counts shown on several screens (an allocation changes inventory,
 * stats, queue and activity), so after success we refresh everything. The WebSocket event does the
 * same for other browser windows.
 */
function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

export function useCreateRequest() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (b: CreateEmergencyRequest) => api.createRequest(b), onSuccess: invalidate });
}

export function useDischarge() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: number) => api.discharge(id), onSuccess: invalidate });
}

export function useCancelRequest() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: number) => api.cancel(id), onSuccess: invalidate });
}

export function useUpdateInventory() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: InventoryUpdate }) => api.updateInventory(id, body),
    onSuccess: invalidate,
  });
}

export function useCreateTransfer() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (b: CreateTransferRequest) => api.createTransfer(b), onSuccess: invalidate });
}

export function useApproveTransfer() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: number) => api.approveTransfer(id), onSuccess: invalidate });
}

export function useRejectTransfer() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: number) => api.rejectTransfer(id), onSuccess: invalidate });
}
