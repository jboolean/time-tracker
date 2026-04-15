import type {
  Category,
  Project,
  Task,
} from "@time-tracker/shared";

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw Object.assign(new Error(`${method} /api${path} failed: ${res.status}`), {
      status: res.status,
      body: text,
    });
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function requestOptional<T>(
  method: string,
  path: string
): Promise<T | null> {
  const res = await fetch(`/api${path}`, { method });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${method} /api${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  categories: {
    list: (): Promise<Category[]> => request("GET", "/categories"),
    create: (body: Omit<Category, "id" | "createdAt" | "updatedAt">): Promise<Category> =>
      request("POST", "/categories", body),
    update: (id: string, body: Partial<Omit<Category, "id" | "createdAt" | "updatedAt">>): Promise<Category> =>
      request("PATCH", `/categories/${id}`, body),
    delete: (id: string): Promise<void> => request("DELETE", `/categories/${id}`),
  },
  projects: {
    list: (params?: { categoryId?: string }): Promise<Project[]> => {
      const qs = params?.categoryId ? `?categoryId=${encodeURIComponent(params.categoryId)}` : "";
      return request("GET", `/projects${qs}`);
    },
    create: (body: Omit<Project, "id" | "createdAt" | "updatedAt" | "archived">): Promise<Project> =>
      request("POST", "/projects", body),
    update: (id: string, body: Partial<Omit<Project, "id" | "createdAt" | "updatedAt" | "archived">>): Promise<Project> =>
      request("PATCH", `/projects/${id}`, body),
    delete: (id: string): Promise<void> => request("DELETE", `/projects/${id}`),
  },
  tasks: {
    list: (params?: { startTime?: string; endTime?: string; projectId?: string; categoryId?: string }): Promise<Task[]> => {
      const q = new URLSearchParams();
      if (params?.startTime) q.set("startTime", params.startTime);
      if (params?.endTime) q.set("endTime", params.endTime);
      if (params?.projectId) q.set("projectId", params.projectId);
      if (params?.categoryId) q.set("categoryId", params.categoryId);
      const qs = q.toString() ? `?${q.toString()}` : "";
      return request("GET", `/tasks${qs}`);
    },
    active: (): Promise<Task | null> => requestOptional("GET", "/tasks/active"),
    create: (body: Omit<Task, "id" | "createdAt" | "updatedAt">): Promise<Task> =>
      request("POST", "/tasks", body),
    update: (id: string, body: Partial<Omit<Task, "id" | "createdAt" | "updatedAt">>): Promise<Task> =>
      request("PATCH", `/tasks/${id}`, body),
    delete: (id: string): Promise<void> => request("DELETE", `/tasks/${id}`),
    end: (id: string): Promise<Task> => request("POST", `/tasks/${id}/end`),
  },
  intake: {
    submit: (body: { rawInput: string; projectId?: string; startTime?: string }): Promise<Task> =>
      request("POST", "/intake", body),
  },
};
