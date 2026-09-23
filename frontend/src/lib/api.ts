/**
 * API client for the BPMS backend (template-architecture conversion).
 * Uses Next.js rewrites to proxy /api/* to the NestJS backend on port 3001.
 * This avoids CORS issues — all calls are same-origin.
 *
 * Backend API shape (synced 2026-09):
 * - List endpoints (GET collections) return the envelope `{ items, totalCount }`
 *   and accept `page` / `pageSize` / `sortBy` / `sortOrder` / `search` query
 *   params (pageSize is capped at 100 by the backend).
 * - user/form/category/department/position `create` returns the created id
 *   (a bare JSON string); their `update` returns void (200 with empty body).
 * - processes/reports create+update return the full entity; deletes return 204.
 *
 * To keep the view layer simple, the list helpers below UNWRAP the envelope and
 * auto-paginate (fetching every page up to a safety cap), so every list method
 * still resolves to a plain `T[]` — the same contract the views were built on.
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
    ...(headers as Record<string, string> | undefined),
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
    const err = new Error(errorBody.message || `HTTP ${res.status}`);
    (err as any).status = res.status; // let callers branch on 403/404/…
    throw err;
  }

  // Backend "void" endpoints (e.g. update) answer 200 with an EMPTY body —
  // res.json() would throw on those, so parse defensively via text.
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined as T;
  }
}

// ---------------------------------------------------------------------------
// GetMany envelope — backend list contract
// ---------------------------------------------------------------------------

/** Envelope returned by every backend list endpoint. */
export interface GetManyReply<T> {
  items: T[];
  totalCount: number;
}

/** Backend caps `pageSize` at 100 — request full pages. */
const PAGE_SIZE = 100;
/** Hard safety cap: 20 pages = 2,000 rows per list call. */
const MAX_PAGES = 20;

/** Extra query params accepted by backend list endpoints. */
export interface GetManyParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

/**
 * GET a list endpoint and UNWRAP the `{ items, totalCount }` envelope,
 * fetching every page until `totalCount` rows are collected (or the safety
 * cap is hit). Resolves to a plain array — the old unpaginated contract.
 */
async function fetchAll<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<T[]> {
  const merged = (page: number): Record<string, string | number | boolean | undefined> => ({
    ...params,
    page,
    pageSize: PAGE_SIZE,
  });
  const first = await apiFetch<GetManyReply<T>>(path, { params: merged(1) });
  const items = [...(first.items ?? [])];
  const total = Math.min(first.totalCount ?? items.length, PAGE_SIZE * MAX_PAGES);
  while (items.length < total) {
    const next = await apiFetch<GetManyReply<T>>(path, {
      params: merged(Math.floor(items.length / PAGE_SIZE) + 1),
    });
    if (!next.items?.length) break; // server-side drift — stop paging
    items.push(...next.items);
  }
  return items;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const authApi = {
  login: (username: string, password: string) =>
    apiFetch<{
      accessToken: string;
      userId: string;
      username: string;
      email: string;
      name: string;
      role: string;
    }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  register: (username: string, email: string, name: string, password: string) =>
    apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, name, password }),
    }),
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
// Tasks — list endpoints (mine / participated / all) return the GetMany
// envelope; unwrapped here into a plain Task[].
// ---------------------------------------------------------------------------
export const tasksApi = {
  mine: () => fetchAll<any>('/tasks/mine'),
  participated: () => fetchAll<any>('/tasks/participated'),
  findAll: () => fetchAll<any>('/tasks'),
  findOne: (id: string) => apiFetch<any>(`/tasks/${id}`),
  complete: (id: string, data: Record<string, any>) =>
    apiFetch(`/tasks/${id}/complete`, { method: 'POST', body: JSON.stringify({ data }) }),
  claim: (id: string) => apiFetch(`/tasks/${id}/claim`, { method: 'POST' }),
  release: (id: string) => apiFetch(`/tasks/${id}/release`, { method: 'POST' }),
};

// ---------------------------------------------------------------------------
// Process Instances — GET list endpoints return the GetMany envelope
// (unwrapped); start/terminate/findOne return the full instance object.
// ---------------------------------------------------------------------------
export const processInstancesApi = {
  findAll: () => fetchAll<any>('/process-instances'),
  mine: () => fetchAll<any>('/process-instances/mine'),
  /** Case list: user participates (started or has a task) — admin gets all */
  cases: () => fetchAll<any>('/process-instances/cases'),
  findOne: (id: string) => apiFetch<any>(`/process-instances/${id}`),
  start: (processId: string) =>
    apiFetch('/process-instances', { method: 'POST', body: JSON.stringify({ processId }) }),
  terminate: (id: string) => apiFetch(`/process-instances/${id}/terminate`, { method: 'POST' }),
};

// ---------------------------------------------------------------------------
// Process drafts — pre-start form fill. Submit starts the BPMN instance and
// completes the first user task with the saved form data.
// ---------------------------------------------------------------------------
export const processDraftsApi = {
  findAll: () => fetchAll<any>('/process-drafts'),
  findOne: (id: string) => apiFetch<any>(`/process-drafts/${id}`),
  create: (processId: string) =>
    apiFetch('/process-drafts', { method: 'POST', body: JSON.stringify({ processId }) }),
  update: (id: string, data: Record<string, any>) =>
    apiFetch(`/process-drafts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ data }),
    }),
  submit: (id: string, data?: Record<string, any>) =>
    apiFetch(`/process-drafts/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify({ data: data || {} }),
    }),
  remove: (id: string) =>
    apiFetch(`/process-drafts/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Process Definitions — GET /processes returns the GetMany envelope
// (unwrapped, auto-paginated); all sub-resources and writes keep their
// original shapes (plain arrays / full DTOs / 204 on delete).
// ---------------------------------------------------------------------------
export const processesApi = {
  findAll: () => fetchAll<any>('/processes'),
  findOne: (id: string) => apiFetch<any>(`/processes/${id}`),
  getUserTasks: (id: string) => apiFetch<any[]>(`/processes/${id}/user-tasks`),
  getAssignments: (id: string) => apiFetch<any[]>(`/processes/${id}/assignments`),
  create: (data: {
    name: string;
    description?: string;
    bpmnXml: string;
    /** optional initial starter restriction — empty/omitted = all users may start */
    starterIds?: string[];
  }) => apiFetch('/processes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, any>) =>
    apiFetch(`/processes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  setAssignments: (id: string, assignments: any[]) =>
    apiFetch(`/processes/${id}/assignments`, {
      method: 'PUT',
      body: JSON.stringify({ assignments }),
    }),
  getStarters: (id: string) => apiFetch<any[]>(`/processes/${id}/starters`),
  /** Replace the starter set — empty array lifts the restriction (all users) */
  setStarters: (id: string, userIds: string[]) =>
    apiFetch(`/processes/${id}/starters`, {
      method: 'PUT',
      body: JSON.stringify({ userIds }),
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
// Forms — scoped to a process (processId is REQUIRED on the list endpoint).
// create returns the new form id (string); update returns void.
// ---------------------------------------------------------------------------
export const formsApi = {
  findAll: (processId: string) => fetchAll<any>('/forms', { processId }),
  findOne: (id: string) => apiFetch<any>(`/forms/${id}`),
  create: (data: { name: string; description?: string; fields: any[]; processId: string }) =>
    apiFetch<string>('/forms', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name: string; description?: string; fields: any[]; processId: string }) =>
    apiFetch<void>(`/forms/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch<void>(`/forms/${id}`, { method: 'DELETE' }),
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
  /** List endpoints return the GetMany envelope — unwrapped to Category[]. */
  findAll: () => fetchAll<Category>('/categories'),
  findOne: (id: string) => apiFetch<Category>(`/categories/${id}`),
  /** Returns the created category id (string), not the entity. */
  create: (data: { key: string; name: string; description?: string; items?: CategoryItemInput[] }) =>
    apiFetch<string>('/categories', { method: 'POST', body: JSON.stringify(data) }),
  /** Returns void (200, empty body). */
  update: (
    id: string,
    data: { key?: string; name?: string; description?: string; items?: CategoryItemInput[] },
  ) => apiFetch<void>(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch<void>(`/categories/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Departments — list returns the GetMany envelope (unwrapped);
// create returns the id, update returns void.
// ---------------------------------------------------------------------------
export const departmentsApi = {
  findAll: () => fetchAll<any>('/departments'),
  findOne: (id: string) => apiFetch<any>(`/departments/${id}`),
  create: (data: { name: string; description?: string }) =>
    apiFetch<string>('/departments', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; description?: string }) =>
    apiFetch<void>(`/departments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch<void>(`/departments/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Positions — GET /positions returns the GetMany envelope (unwrapped);
// by-department lists stay plain arrays; create returns the id, update void;
// assignUsers / removeUser still return the updated Position.
// ---------------------------------------------------------------------------
export const positionsApi = {
  findAll: () => fetchAll<any>('/positions'),
  findByDepartment: (deptId: string) => apiFetch<any[]>(`/positions/by-department/${deptId}`),
  findOne: (id: string) => apiFetch<any>(`/positions/${id}`),
  create: (deptId: string, data: { name: string; description?: string }) =>
    apiFetch<string>(`/positions/by-department/${deptId}`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; description?: string }) =>
    apiFetch<void>(`/positions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch(`/positions/${id}`, { method: 'DELETE' }),
  assignUsers: (id: string, userIds: string[]) =>
    apiFetch(`/positions/${id}/users`, { method: 'POST', body: JSON.stringify({ userIds }) }),
  removeUser: (positionId: string, userId: string) =>
    apiFetch(`/positions/${positionId}/users/${userId}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Users — list returns the GetMany envelope (unwrapped);
// create returns the id (string), update returns void.
// ---------------------------------------------------------------------------
export const usersApi = {
  findAll: () => fetchAll<any>('/users'),
  findOne: (id: string) => apiFetch<any>(`/users/${id}`),
  create: (data: { username: string; email: string; name: string; password: string; role?: string }) =>
    apiFetch<string>('/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, any>) =>
    apiFetch<void>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch<void>(`/users/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Report builder (v6) — admin-defined tabular reports over process instances
// ---------------------------------------------------------------------------

export interface ReportColumnConfig {
  /** stable key — convention: "field:<fieldKey>" or "var:<variableName>" */
  key: string;
  source: 'INSTANCE' | 'VARIABLE';
  fieldKey: string;
  label?: string;
}

export interface ReportFilterConfig {
  type: 'STATUS' | 'DATE_RANGE' | 'VARIABLE';
  statuses?: string[];
  from?: string;
  to?: string;
  name?: string;
  op?: 'eq' | 'neq' | 'contains';
  value?: string;
}

export interface ReportDefinition {
  id: string;
  name: string;
  description?: string | null;
  processId: string;
  process: { id: string; name: string; status: string } | undefined;
  columns: ReportColumnConfig[];
  filters: ReportFilterConfig[];
  columnCount: number;
  filterCount: number;
  createdBy: { id: string; name: string; email: string } | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface ReportOption {
  value: string;
  label: string;
}

export interface ReportFieldCatalog {
  instanceFields: { key: string; label: string; type: string }[];
  variables: {
    name: string;
    label: string;
    type: string;
    options?: ReportOption[];
  }[];
}

export interface ReportResultColumn extends ReportColumnConfig {
  label: string;
  type: string;
  options?: ReportOption[];
}

export interface ReportExecutionResult {
  report: { id: string; name: string; description?: string | null } | null;
  process: { id: string; name: string };
  columns: ReportResultColumn[];
  rows: {
    id: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    values: Record<string, any>;
  }[];
  total: number;
  byStatus: Record<string, number>;
  generatedAt: string;
}

export interface SaveReportInput {
  name: string;
  description?: string;
  processId: string;
  columns: ReportColumnConfig[];
  filters?: ReportFilterConfig[];
}

export const reportsApi = {
  /** GET /reports returns the GetMany envelope — unwrapped to ReportDefinition[]. */
  findAll: () => fetchAll<ReportDefinition>('/reports'),
  findOne: (id: string) => apiFetch<ReportDefinition>(`/reports/${id}`),
  create: (data: SaveReportInput) =>
    apiFetch<ReportDefinition>('/reports', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<SaveReportInput>) =>
    apiFetch<ReportDefinition>(`/reports/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch(`/reports/${id}`, { method: 'DELETE' }),
  /** Selectable fields for a process: fixed instance fields + process variables */
  getFieldCatalog: (processId: string) =>
    apiFetch<ReportFieldCatalog>(`/reports/field-catalog/${processId}`),
  /** Execute an UNSAVED config (builder «پیش‌نمایش») — admin only */
  preview: (data: { processId: string; columns: ReportColumnConfig[]; filters?: ReportFilterConfig[] }) =>
    apiFetch<ReportExecutionResult>('/reports/preview', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  /** Execute a saved report — live rows over the process instances */
  execute: (id: string) => apiFetch<ReportExecutionResult>(`/reports/${id}/execute`, { method: 'POST' }),
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
