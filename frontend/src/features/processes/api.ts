import { apiFetch } from '@/lib/api/client';
import { fetchAll } from '@/lib/api/envelope';

/**
 * Process Definitions + dynamic Forms (both scoped to a process).
 *
 * GET /processes returns the GetMany envelope (unwrapped, auto-paginated);
 * all sub-resources and writes keep their original shapes (plain arrays /
 * full DTOs / 204 on delete). Forms: processId is REQUIRED on the list
 * endpoint; create returns the new form id (string), update returns void.
 */
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

export const formsApi = {
  findAll: (processId: string) => fetchAll<any>('/forms', { processId }),
  findOne: (id: string) => apiFetch<any>(`/forms/${id}`),
  create: (data: { name: string; description?: string; fields: any[]; processId: string }) =>
    apiFetch<string>('/forms', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name: string; description?: string; fields: any[]; processId: string }) =>
    apiFetch<void>(`/forms/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch<void>(`/forms/${id}`, { method: 'DELETE' }),
};
