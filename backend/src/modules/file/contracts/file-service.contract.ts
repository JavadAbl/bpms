/**
 * Cross-module API of the file domain.
 * Consumed by the task module (stamping attachments on task completion).
 */
export abstract class FilesServiceContract {
  /**
   * Stamp taskId/instanceId onto every file referenced by a completed task's
   * submission data (values are arrays/objects of {id, name, ...} metas).
   * Returns the number of stamped rows.
   */
  abstract fileStampFromSubmissionData(
    data: Record<string, unknown>,
    taskId: string,
    instanceId: string,
  ): Promise<number>;
}
