/**
 * Re-centers embedded task labels after render.
 * Fixes RTL misalignment and UserTask icon offset.
 */
type Injectables = {
  eventBus: { on: (event: string, priority: number, fn: (ctx: any) => void) => void };
  elementRegistry: { getGraphics: (element: unknown) => Element | null };
};

const ICON_LEFT_RESERVE = 26;

function fixLabelLtr(label: Element | null) {
  if (!label) return;
  label.setAttribute('direction', 'ltr');
  label.querySelectorAll('tspan').forEach((tspan) => {
    tspan.setAttribute('direction', 'ltr');
  });
}

function recenterUserTaskLabel(element: { width: number }, label: Element) {
  const width = element.width || 100;
  label.querySelectorAll('tspan').forEach((tspan) => {
    const lineWidth = (tspan as SVGTSpanElement).getComputedTextLength?.() ?? 0;
    const usable = width - ICON_LEFT_RESERVE;
    const x = ICON_LEFT_RESERVE + Math.max((usable - lineWidth) / 2, 4);
    tspan.setAttribute('x', String(x));
  });
}

function recenterTaskLabel(element: { width: number }, label: Element) {
  const width = element.width || 100;
  label.querySelectorAll('tspan').forEach((tspan) => {
    const lineWidth = (tspan as SVGTSpanElement).getComputedTextLength?.() ?? 0;
    const x = Math.max((width - lineWidth) / 2, 4);
    tspan.setAttribute('x', String(x));
  });
}

function fixTaskLabel(element: { type?: string; width: number }, gfx: Element) {
  const label = gfx.querySelector('.djs-visual .djs-label');
  if (!label) return;

  fixLabelLtr(label);

  if (element.type === 'bpmn:UserTask') {
    recenterUserTaskLabel(element, label);
  } else if (element.type?.includes('Task')) {
    recenterTaskLabel(element, label);
  }
}

export default class TaskLabelFix {
  static $inject = ['eventBus', 'elementRegistry'];

  constructor(eventBus: Injectables['eventBus'], elementRegistry: Injectables['elementRegistry']) {
    eventBus.on('render.shape', 2000, (event: { element: { type?: string; width: number }; gfx: Element }) => {
      const { element, gfx } = event;
      if (!element.type?.includes('Task')) return;
      fixTaskLabel(element, gfx);
    });

    eventBus.on('element.changed', 2000, (event: { element: { type?: string; width: number } }) => {
      const { element } = event;
      if (!element.type?.includes('Task')) return;
      const gfx = elementRegistry.getGraphics(element);
      if (gfx) fixTaskLabel(element, gfx);
    });
  }
}

export const taskLabelFixModule = {
  __init__: ['taskLabelFix'],
  taskLabelFix: ['type', TaskLabelFix],
};
