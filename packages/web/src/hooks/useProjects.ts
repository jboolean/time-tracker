import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

export function useProjects(categoryId?: string) {
  return useQuery({
    queryKey: ["projects", categoryId],
    queryFn: () => api.projects.list(categoryId ? { categoryId } : undefined),
  });
}
