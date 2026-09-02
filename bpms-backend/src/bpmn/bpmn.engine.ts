import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter } from 'events';

/**
 * Result returned when a BPMN user task is waiting for input.
 * The Activity API is kept in-memory so we can signal it later.
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
  onStateChange?: (state: any) => void | Promise<void>;
}

/**
 * Wraps the `bpmn-engine` npm package into a NestJS-friendly service.
 *
 * Persistence design:
 *  - Each running ProcessInstance has ONE Engine instance held in-memory.
 *  - On every state transition (wait / end / error), `engine.getState()` is
 *    called and the result is passed to `onStateChange`, which persists it
 *    to `ProcessInstance.engineState` in the DB.
 *  - On server startup, `resumeInstance` is called for every RUNNING instance:
 *    a new Engine is created, `engine.recover(savedState)` is called, then
 *    `engine.resume({ listener })`. The engine re-emits `wait` events for
 *    postponed user tasks, which re-populates the in-memory Maps and
 *    ensures the DB Task rows are in sync.
 *  - The `executionId` is persisted on the Task row, so `signalTask` can
 *    look it up from the DB instead of relying on in-memory state.
 */
@Injectable()
export class BpmnEngineService {
  private readonly logger = new Logger(BpmnEngineService.name);
  private readonly engines = new Map<string, any>(); // instanceId -> engine
  private readonly waitingTasks = new Map<string, any>(); // key -> activity api
  private readonly callbacksMap = new Map<string, EngineCallbacks>(); // instanceId -> callbacks

  // Lazy-load ESM module on first use
  private engineModulePromise: Promise<any> | null = null;

  private async getEngineModule(): Promise<any> {
    if (!this.engineModulePromise) {
      this.engineModulePromise = import('bpmn-engine');
    }
    return this.engineModulePromise;
  }

  /**
   * Extract user task definitions (id + name + documentation) from a BPMN XML.
   * Uses a lightweight regex-based parser — sufficient for MVP. For production
   * use `bpmn-moddle` for a fully spec-compliant parse.
   */
  extractUserTasks(bpmnXml: string): UserTaskDefinition[] {
    const tasks: UserTaskDefinition[] = [];
    // Match <bpmn:userTask ...> ... </bpmn:userTask> (also self-closing form)
    const userTaskRegex =
      /<(?:bpmn:|bpmn2:)userTask\b([^>]*?)\/?>(?:([\s\S]*?)<\/(?:bpmn:|bpmn2:)userTask>)?/g;
    let match: RegExpExecArray | null;
    while ((match = userTaskRegex.exec(bpmnXml)) !== null) {
      const attrs = match[1] || '';
      const inner = match[2] || '';
      const id = (attrs.match(/\bid="([^"]+)"/) || [])[1];
      const name = (attrs.match(/\bname="([^"]*)"/) || [])[1] || id || 'Unnamed Task';
      let documentation: string | undefined;
      const docMatch = inner.match(
        /<(?:bpmn:|bpmn2:)documentation[^>]*>([\s\S]*?)<\/(?:bpmn:|bpmn2:)documentation>/,
      );
      if (docMatch) documentation = docMatch[1].trim();
      if (id) tasks.push({ id, name, documentation });
    }
    return tasks;
  }

  /**
   * Start a new BPMN instance from scratch.
   */
  async startInstance(opts: {
    instanceId: string;
    bpmnXml: string;
    callbacks: EngineCallbacks;
  }): Promise<void> {
    const { Engine } = await this.getEngineModule();
    const engine = Engine({
      name: `instance-${opts.instanceId}`,
      source: opts.bpmnXml,
    });
    this.engines.set(opts.instanceId, engine);
    this.callbacksMap.set(opts.instanceId, opts.callbacks);

    this.setupListener(opts.instanceId, opts.callbacks);

    try {
      const listener = this.createListener(opts.instanceId, opts.callbacks);
      // Execute the engine; the listener will fire `wait` when a userTask is reached.
      // We also set up a race between execute() completing and the first wait/end event
      // so that startInstance returns only after the first task is ready (or the process ended).
      await engine.execute({ listener });
      this.logger.log(`Instance ${opts.instanceId} started`);
      // Give the engine a tick to emit the first wait/end event
      await new Promise((resolve) => setImmediate(resolve));
      // Save initial state after execution kicks off
      await this.persistState(opts.instanceId, opts.callbacks);
    } catch (err: any) {
      this.cleanup(opts.instanceId);
      throw err;
    }
  }

  /**
   * Resume a previously-running instance from saved engine state.
   * Called on server startup for every instance with status=RUNNING.
   */
  async resumeInstance(opts: {
    instanceId: string;
    bpmnXml: string;
    engineState: any;
    callbacks: EngineCallbacks;
  }): Promise<void> {
    const { Engine } = await this.getEngineModule();
    const engine = Engine({
      name: `instance-${opts.instanceId}`,
      source: opts.bpmnXml,
    });

    // Recover the saved state — this does NOT start execution
    engine.recover(opts.engineState);
    this.engines.set(opts.instanceId, engine);
    this.callbacksMap.set(opts.instanceId, opts.callbacks);

    this.setupListener(opts.instanceId, opts.callbacks);

    try {
      await engine.resume({ listener: this.createListener(opts.instanceId, opts.callbacks) });
      this.logger.log(`Instance ${opts.instanceId} resumed from saved state`);
    } catch (err: any) {
      this.cleanup(opts.instanceId);
      throw err;
    }
  }

  /**
   * Set up the engine broker subscriptions for end / error events.
   * The `wait` event is handled by the listener (see createListener).
   */
  private setupListener(instanceId: string, callbacks: EngineCallbacks): void {
    const engine = this.engines.get(instanceId);
    if (!engine) return;

    engine.broker.subscribeTmp(
      'event',
      'engine.end',
      async () => {
        this.logger.log(`Instance ${instanceId} ended`);
        this.cleanup(instanceId);
        try {
          await callbacks.onEnd();
        } catch (err: any) {
          this.logger.error(`onEnd callback failed for ${instanceId}: ${err.message}`);
        }
      },
      { noAck: true },
    );

    engine.broker.subscribeTmp(
      'event',
      'engine.error',
      async (_routingKey: string, msg: any) => {
        const err = msg?.content?.error || new Error('Unknown engine error');
        this.logger.error(
          `Instance ${instanceId} errored: ${err.message}\n` +
            `  msg content: ${JSON.stringify(msg?.content, null, 0).slice(0, 500)}`,
        );
        this.cleanup(instanceId);
        try {
          await callbacks.onError(err);
        } catch (cbErr: any) {
          this.logger.error(`onError callback failed for ${instanceId}: ${cbErr.message}`);
        }
      },
      { noAck: true },
    );

    // Subscribe to activity errors for better debugging
    engine.broker.subscribeTmp(
      'event',
      'activity.error',
      async (_routingKey: string, msg: any) => {
        this.logger.error(
          `Activity error in instance ${instanceId}: ${msg?.content?.error?.message || 'unknown'}\n` +
            `  activity: ${msg?.content?.id || '?'}, execution: ${msg?.content?.executionId || '?'}\n` +
            `  content: ${JSON.stringify(msg?.content, null, 0).slice(0, 500)}`,
        );
      },
      { noAck: true },
    );
  }

  /**
   * Create the EventEmitter listener that handles `wait` events.
   * On `wait`, we:
   *  1. Store the activity API in-memory (keyed by instanceId:executionId)
   *  2. Invoke the onUserTask callback (which creates/updates the Task row)
   *  3. Persist the engine state
   */
  private createListener(instanceId: string, callbacks: EngineCallbacks): EventEmitter {
    const listener = new EventEmitter();
    listener.on('wait', async (api: any) => {
      const activityId = api?.content?.id;
      const executionId = api?.content?.executionId;
      if (!activityId || !executionId) {
        this.logger.warn(
          `wait event without activityId/executionId: ${JSON.stringify(api?.content)}`,
        );
        return;
      }
      const key = `${instanceId}:${executionId}`;
      this.waitingTasks.set(key, api);
      const info: WaitingTaskInfo = {
        activityId,
        executionId,
        name: api.content.name || activityId,
        description: api.content.documentation,
        formKey: api.content.formKey,
      };
      this.logger.log(
        `Instance ${instanceId} waiting on task "${info.name}" (${activityId}, execution=${executionId})`,
      );
      try {
        await callbacks.onUserTask(info);
      } catch (err: any) {
        this.logger.error(`onUserTask callback failed for ${instanceId}: ${err.message}`);
      }
      // Persist state AFTER the Task row is created so DB is consistent
      await this.persistState(instanceId, callbacks);
    });
    return listener;
  }

  /**
   * Complete a waiting user task by signaling the engine with form data.
   * The activity API is looked up from the in-memory Map.
   *
   * The form data is also merged into the activity's environment variables
   * so that downstream gateway conditions can reference them via
   * `environment.variables.<fieldName>`. This is necessary because
   * bpmn-engine does not automatically propagate signal data to gateway
   * condition expressions.
   */
  async signalTask(instanceId: string, executionId: string, data: any): Promise<void> {
    const key = `${instanceId}:${executionId}`;
    const api = this.waitingTasks.get(key);
    if (!api) {
      throw new NotFoundException(
        `No waiting task found for instance ${instanceId} execution ${executionId}. ` +
          `If the server was restarted, the engine should have been recovered on startup — ` +
          `check the logs for resume errors.`,
      );
    }
    this.waitingTasks.delete(key);

    // Merge form data into the activity's environment variables so gateway
    // conditions can reference them (e.g. environment.variables.leaveType).
    // We use the activity's environment (api.environment) which is the
    // definition's cloned environment — NOT the engine's environment.
    if (api.environment && data && typeof data === 'object') {
      try {
        Object.assign(api.environment.variables, data);
        this.logger.log(
          `Merged form data into variables for instance ${instanceId}: ${JSON.stringify(Object.keys(data))}`,
        );
      } catch (err: any) {
        this.logger.warn(`Failed to merge variables for ${instanceId}: ${err.message}`);
      }
    }

    api.signal(data);
    this.logger.log(`Signaled task execution=${executionId} on instance ${instanceId}`);

    // Give the engine a tick to process the signal and transition.
    await new Promise((resolve) => setImmediate(resolve));
    await this.persistState(instanceId, this.currentCallbacks(instanceId));
  }

  /**
   * Stop and discard a running instance (does not delete DB record).
   */
  async terminateInstance(instanceId: string): Promise<void> {
    const engine = this.engines.get(instanceId);
    if (engine) {
      try {
        await engine.stop();
      } catch (err) {
        this.logger.warn(`Error stopping instance ${instanceId}: ${(err as Error).message}`);
      }
    }
    this.cleanup(instanceId);
  }

  isRunning(instanceId: string): boolean {
    return this.engines.has(instanceId);
  }

  /**
   * Persist the current engine state via the onStateChange callback.
   * Failures are logged but not thrown — state persistence is best-effort
   * to avoid blocking the engine flow.
   */
  private async persistState(instanceId: string, callbacks: EngineCallbacks): Promise<void> {
    if (!callbacks.onStateChange) return;
    const engine = this.engines.get(instanceId);
    if (!engine) return;
    try {
      const state = await engine.getState();
      await callbacks.onStateChange(state);
    } catch (err: any) {
      this.logger.warn(`Failed to persist state for ${instanceId}: ${err.message}`);
    }
  }

  /**
   * Retrieve the callbacks for an instance (used by signalTask to persist state).
   */
  private currentCallbacks(instanceId: string): EngineCallbacks {
    return (
      this.callbacksMap.get(instanceId) || {
        onUserTask: () => {},
        onEnd: () => {},
        onError: () => {},
      }
    );
  }

  private cleanup(instanceId: string): void {
    this.engines.delete(instanceId);
    this.callbacksMap.delete(instanceId);
    // Remove all waiting tasks for this instance
    for (const key of this.waitingTasks.keys()) {
      if (key.startsWith(`${instanceId}:`)) this.waitingTasks.delete(key);
    }
  }
}
