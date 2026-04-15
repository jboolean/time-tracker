import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

export function useActiveTask() {
  return useQuery({
    queryKey: ["tasks", "active"],
    queryFn: () => api.tasks.active(),
    refetchInterval: 30_000,
  });
}

export function useTasks(params?: { startTime?: string; endTime?: string }) {
  return useQuery({
    queryKey: ["tasks", params],
    queryFn: () => api.tasks.list(params),
  });
}
