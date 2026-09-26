import { z } from 'zod';

/**
 * The global "start a process" dialog: a process must be picked before a
 * draft (start form) can be created for it.
 */
export const startProcessSchema = z.object({
  processId: z.string().min(1, 'انتخاب فرآیند الزامی است'),
});

export type StartProcessValues = z.infer<typeof startProcessSchema>;
