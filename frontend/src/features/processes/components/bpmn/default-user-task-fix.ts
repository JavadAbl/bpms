/**
 * Default inserted tasks to UserTask.
 *
 * Every "generic" task entry in bpmn-js — the built-in palette's "create
 * task", the context pad's "append task", drag & drop and the change-element
 * popup's plain "task" option — creates a bare `bpmn:Task`. The BPMS engine
 * only reacts to `bpmn:UserTask`, so such tasks would silently become
 * pass-through steps. This module remaps them to `bpmn:UserTask` at
 * creation time, covering every creation path:
 *
 *  - elementFactory.createElement — palette / context pad / drag & drop /
 *    auto-place all go through createShape → createElement. The shape's
 *    `type` AND its businessObject are built here, so remapping the type
 *    string keeps renderer (dispatches on shape.type) and XML serialization
 *    (serializes businessObject.$type) in sync.
 *  - bpmnReplace.replaceElement — the "change element" popup builds the
 *    businessObject and the new shape itself, bypassing the hook above.
 *  - bpmnFactory.create — belt & suspenders for any direct semantic-layer
 *    call (e.g. future code paths), before the id is assigned.
 *
 * Deliberately narrow: only `bpmn:Task` is remapped. Explicitly created
 * ServiceTask/SendTask/etc. keep their type, and EXISTING/imported diagrams
 * are never touched (the XML reader instantiates via `new Type()`, not via
 * any of these factories).
 *
 * Registered as additionalModules on the designer modeler (same pattern as
 * ./task-label-fix).
 */

const TASK_TYPE = 'bpmn:Task';
const USER_TASK_TYPE = 'bpmn:UserTask';

/** Swap a bare-task type string for UserTask; anything else passes through. */
const remapType = (type: string | undefined | null) =>
  type === TASK_TYPE ? USER_TASK_TYPE : type;

export default class DefaultUserTaskFix {
  static $inject = ['elementFactory', 'bpmnFactory', 'bpmnReplace'];

  constructor(elementFactory: any, bpmnFactory: any, bpmnReplace: any) {
    // 1. Shape layer — palette / context pad / drag & drop / auto-place.
    const originalCreateElement = elementFactory.createElement.bind(elementFactory);
    elementFactory.createElement = (elementType: string, attrs: Record<string, any>) => {
      // Only when the shape is built from a bare type string (no pre-built
      // businessObject) — otherwise replace/copy flows manage their own bo.
      if (attrs && !attrs.businessObject && attrs.type === TASK_TYPE) {
        attrs = { ...attrs, type: USER_TASK_TYPE };
      }
      return originalCreateElement(elementType, attrs);
    };

    // 2. "Change element" popup (bpmn-replace menu).
    const originalReplace = bpmnReplace.replaceElement;
    bpmnReplace.replaceElement = (
      element: any,
      targetElement: { type?: string; [key: string]: unknown } | undefined | null,
      hints?: Record<string, unknown>,
    ) =>
      originalReplace.call(
        bpmnReplace,
        element,
        targetElement?.type === TASK_TYPE
          ? { ...targetElement, type: USER_TASK_TYPE }
          : targetElement,
        hints,
      );

    // 3. Semantic layer — id assignment happens after create() in BpmnFactory,
    //    and the Activity-prefixed id stays valid for a UserTask.
    const originalCreate = bpmnFactory.create.bind(bpmnFactory);
    bpmnFactory.create = (type: string, attrs?: Record<string, unknown>) =>
      originalCreate(remapType(type), attrs);
  }
}

export const defaultUserTaskModule = {
  __init__: ['defaultUserTaskFix'],
  defaultUserTaskFix: ['type', DefaultUserTaskFix],
};
