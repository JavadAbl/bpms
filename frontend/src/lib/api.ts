/**
 * API client for BPMS backend.
 * Uses Next.js rewrites to proxy /api/* to the NestJS backend on port 3001.
 * This avoids CORS issues — all calls are same-origin.
 */

const API_BASE = '/api';

let token: string | null = null;

export function setToken(t: string | null) {
  token = t;
  if (typeof window !== 'undefined') {
    if (t) {
      localStorage.setItem('bpms_token', t);
    } else {
      localStorage.removeItem('bpms_token');
    }
  }
}

export function getToken(): string | null {
  if (!token && typeof window !== 'undefined') {
    token = localStorage.getItem('bpms_token');
  }
  return token;
}

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

async function apiFetch<T = any>(path: string, options: FetchOptions = {}): Promise<T> {
  const { params, headers, ...rest } = options;

  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  const t = getToken();
  if (t) {
    finalHeaders['Authorization'] = `Bearer ${t}`;
  }

  const res = await fetch(url.toString(), {
    ...rest,
    headers: finalHeaders,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(errorBody.message || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<{ accessToken: string; userId: string; email: string; name: string; role: string }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    ),
  register: (email: string, name: string, password: string) =>
    apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ email, name, password }) }),
};

// ---------------------------------------------------------------------------
// Dashboard (UI redesign Phase 3) — aggregated KPIs, ADMIN global / USER own
// ---------------------------------------------------------------------------
export interface DashboardData {
  myPendingTasks: number;
  runningInstances: number;
  activeProcesses: number;
  completedLast7Days: { date: string; count: number }[];
  instancesByStatus: Record<string, number>;
  recentTasks: any[];
  recentInstances: any[];
}

export const dashboardApi = {
  get: () => apiFetch<DashboardData>('/dashboard'),
};

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------
export const tasksApi = {
  mine: () => apiFetch<any[]>('/tasks/mine'),
  findAll: () => apiFetch<any[]>('/tasks'),
  findOne: (id: string) => apiFetch<any>(`/tasks/${id}`),
  complete: (id: string, data: Record<string, any>) =>
    apiFetch(`/tasks/${id}/complete`, { method: 'POST', body: JSON.stringify({ data }) }),
  claim: (id: string) => apiFetch(`/tasks/${id}/claim`, { method: 'POST' }),
  release: (id: string) => apiFetch(`/tasks/${id}/release`, { method: 'POST' }),
};

// ---------------------------------------------------------------------------
// Process Instances
// ---------------------------------------------------------------------------
export const processInstancesApi = {
  findAll: () => apiFetch<any[]>('/process-instances'),
  mine: () => apiFetch<any[]>('/process-instances/mine'),
  findOne: (id: string) => apiFetch<any>(`/process-instances/${id}`),
  start: (processId: string) =>
    apiFetch('/process-instances', { method: 'POST', body: JSON.stringify({ processId }) }),
  terminate: (id: string) => apiFetch(`/process-instances/${id}/terminate`, { method: 'POST' }),
};

// ---------------------------------------------------------------------------
// Process Definitions
// ---------------------------------------------------------------------------
export const processesApi = {
  findAll: () => apiFetch<any[]>('/processes'),
  findOne: (id: string) => apiFetch<any>(`/processes/${id}`),
  getUserTasks: (id: string) => apiFetch<any[]>(`/processes/${id}/user-tasks`),
  getAssignments: (id: string) => apiFetch<any[]>(`/processes/${id}/assignments`),
  create: (data: { name: string; description?: string; bpmnXml: string }) =>
    apiFetch('/processes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, any>) =>
    apiFetch(`/processes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  setAssignments: (id: string, assignments: any[]) =>
    apiFetch(`/processes/${id}/assignments`, {
      method: 'PUT',
      body: JSON.stringify({ assignments }),
    }),
  getVariables: (id: string) => apiFetch<any[]>(`/processes/${id}/variables`),
  getVersions: (id: string) => apiFetch<any[]>(`/processes/${id}/versions`),
  getVersion: (id: string, version: number) =>
    apiFetch<any>(`/processes/${id}/versions/${version}`),
  restoreVersion: (id: string, version: number, note?: string) =>
    apiFetch<any>(`/processes/${id}/versions/${version}/restore`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
  setVariables: (id: string, variables: { name: string; label?: string; type?: string }[]) =>
    apiFetch(`/processes/${id}/variables`, {
      method: 'PUT',
      body: JSON.stringify({ variables }),
    }),
  remove: (id: string) => apiFetch(`/processes/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------
export const formsApi = {
  findAll: (processId: string) =>
    apiFetch<any[]>('/forms', { params: { processId } }),
  findOne: (id: string) => apiFetch<any>(`/forms/${id}`),
  create: (data: { name: string; description?: string; fields: any[]; processId: string }) =>
    apiFetch('/forms', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name: string; description?: string; fields: any[]; processId: string }) =>
    apiFetch(`/forms/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch(`/forms/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Categories (global reusable dropdown option lists)
// ---------------------------------------------------------------------------
export interface CategoryItem {
  id: string;
  value: string;
  label: string;
  sortOrder: number;
}

export interface CategoryUsage {
  formCount: number;
  formNames: string[];
}

export interface Category {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  items: CategoryItem[];
  usage?: CategoryUsage;
}

export interface CategoryItemInput {
  value: string;
  label: string;
}

export const categoriesApi = {
  findAll: () => apiFetch<Category[]>('/categories'),
  findOne: (id: string) => apiFetch<Category>(`/categories/${id}`),
  create: (data: { key: string; name: string; description?: string; items?: CategoryItemInput[] }) =>
    apiFetch<Category>('/categories', { method: 'POST', body: JSON.stringify(data) }),
  update: (
    id: string,
    data: { key?: string; name?: string; description?: string; items?: CategoryItemInput[] },
  ) => apiFetch<Category>(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch(`/categories/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------
export const departmentsApi = {
  findAll: () => apiFetch<any[]>('/departments'),
  findOne: (id: string) => apiFetch<any>(`/departments/${id}`),
  create: (data: { name: string; description?: string }) =>
    apiFetch('/departments', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; description?: string }) =>
    apiFetch(`/departments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch(`/departments/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------
export const positionsApi = {
  findAll: () => apiFetch<any[]>('/positions'),
  findByDepartment: (deptId: string) => apiFetch<any[]>(`/positions/by-department/${deptId}`),
  findOne: (id: string) => apiFetch<any>(`/positions/${id}`),
  create: (deptId: string, data: { name: string; description?: string }) =>
    apiFetch(`/positions/by-department/${deptId}`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; description?: string }) =>
    apiFetch(`/positions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch(`/positions/${id}`, { method: 'DELETE' }),
  assignUsers: (id: string, userIds: string[]) =>
    apiFetch(`/positions/${id}/users`, { method: 'POST', body: JSON.stringify({ userIds }) }),
  removeUser: (positionId: string, userId: string) =>
    apiFetch(`/positions/${positionId}/users/${userId}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export const usersApi = {
  findAll: () => apiFetch<any[]>('/users'),
  findOne: (id: string) => apiFetch<any>(`/users/${id}`),
  create: (data: { email: string; name: string; password: string; role?: string }) =>
    apiFetch('/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, any>) =>
    apiFetch(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch(`/users/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Files — form file-field uploads
// Meta shape stored in form values / submissions: { id, name, size, mimeType }
// ---------------------------------------------------------------------------

export interface FileMeta {
  id: string;
  name: string;
  size: number;
  mimeType: string;
}

/** Row returned by GET /files/by-instance/:instanceId (file_attachments + uploader). */
export interface InstanceAttachment {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  taskId: string | null;
  instanceId: string | null;
  createdAt: string;
  submittedBy: { id: string; name: string; email: string } | null;
}

export const filesApi = {
  /** Upload one file (multipart). Returns the meta to store in the form value. */
  upload: async (file: File): Promise<FileMeta> => {
    const fd = new FormData();
    fd.append('file', file);
    const t = getToken();
    const res = await fetch(`${API_BASE}/files`, {
      method: 'POST',
      headers: {
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
        // No Content-Type — the browser sets the multipart boundary itself
      },
      body: fd,
    });
    if (!res.ok) {
      let msg = `upload failed (${res.status})`;
      try {
        const body = await res.json();
        msg = body.message || body.error || msg;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }
    return res.json();
  },

  /** Download a previously uploaded file as a Blob (caller names the file). */
  download: async (id: string): Promise<Blob> => {
    const t = getToken();
    const res = await fetch(`${API_BASE}/files/${id}`, {
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    });
    if (!res.ok) throw new Error(`دانلود فایل ناموفق بود (${res.status})`);
    return res.blob();
  },

  /** List every attachment stamped onto a process instance (uploader info included). */
  byInstance: async (instanceId: string): Promise<InstanceAttachment[]> => {
    const t = getToken();
    const res = await fetch(`${API_BASE}/files/by-instance/${instanceId}`, {
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    });
    if (!res.ok) throw new Error(`دریافت پیوست‌ها ناموفق بود (${res.status})`);
    return res.json();
  },
};
