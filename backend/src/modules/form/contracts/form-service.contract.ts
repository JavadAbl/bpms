import { Form } from '#common/infrastructure/database/generated/prisma/client.js';

/**
 * Cross-module API of the form domain.
 * Consumed by the process module (assignment validation).
 */
export abstract class FormServiceContract {
  abstract formGetById(id: string): Promise<Form | null>;
}
