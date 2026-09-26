'use client';

import { useQuery } from '@tanstack/react-query';
import { filesApi } from './api';

// ---------------------------------------------------------------------------
// Files — attachments stamped onto process instances. Uploads/downloads are
// imperative side effects (stay in the components); only the per-instance
// listing is a query. Keyed per instance so panels never cross-contaminate.
// ---------------------------------------------------------------------------

/** Per-instance attachment list key. */
export const filesKeys = {
  byInstance: (instanceId: string) => ['files', 'by-instance', instanceId] as const,
};

/** List every attachment of one instance. Returns the raw query. */
export function useInstanceFiles(instanceId: string) {
  return useQuery({
    queryKey: filesKeys.byInstance(instanceId),
    queryFn: () => filesApi.byInstance(instanceId),
  });
}
