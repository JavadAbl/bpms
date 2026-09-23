/**
 * Cross-module API of the BPMN engine domain.
 * Consumed by the process, process-instance and task modules.
 */
export interface WaitingTaskInfo {
  activityId: string;
  executionId: string;
  name: string;
  description?: string;
  formKey?: string;
}

export interface UserTaskDefinition {
  id: string;
  name: string;
  documentation?: string;
}

/**
 * Callbacks invoked by the engine service during the instance lifecycle.
 * Each callback may be async; the engine service awaits them before
 * persisting state, so the DB is always consistent with the engine.
 */
export interface EngineCallbacks {
  /** Fired when the engine reaches a userTask and is waiting for input. */
  onUserTask: (info: WaitingTaskInfo) => void | Promise<void>;
  /** Fired when the process reaches an end event (normal completion). */
  onEnd: () => void | Promise<void>;
  /** Fired when the process fails with an unrecoverable error. */
  onError: (err: Error) => void | Promise<void>;
  /** Fired after every state transition so the caller can persist engineState. */
  onStateChange?: (state: unknown) => void | Promise<void>;
}

export interface BpmnStartInstanceOptions {
  instanceId: string;
  bpmnXml: string;
  callbacks: EngineCallbacks;
}

export interface BpmnResumeInstanceOptions {
  instanceId: string;
  bpmnXml: string;
  engineState: unknown;
  callbacks: EngineCallbacks;
}

export abstract class BpmnEngineServiceContract {
  /** Extract user task definitions (id + name + documentation) from BPMN XML. */
  abstract bpmnExtractUserTasks(bpmnXml: string): UserTaskDefinition[];

  /** Start a new BPMN instance from scratch. */
  abstract bpmnStartInstance(opts: BpmnStartInstanceOptions): Promise<void>;

  /** Resume a previously-running instance from saved engine state. */
  abstract bpmnResumeInstance(opts: BpmnResumeInstanceOptions): Promise<void>;

  /** Complete a waiting user task by signaling the engine with form data. */
  abstract bpmnSignalTask(instanceId: string, executionId: string, data: unknown): Promise<void>;

  /** Stop and discard a running instance (does not delete DB record). */
  abstract bpmnTerminateInstance(instanceId: string): Promise<void>;

  abstract bpmnIsRunning(instanceId: string): boolean;
}
