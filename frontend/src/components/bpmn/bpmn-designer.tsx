'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
// Import bpmn-js CSS for proper rendering (fixes black dots on sequence flows)
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import './bpmn-designer.css';
import { taskLabelFixModule } from './task-label-fix';

export interface BpmnDesignerHandle {
  deleteSelected: () => void;
  renameSelected: () => void;
  getModeler: () => any;
}

interface BpmnDesignerProps {
  onXmlChange: (xml: string) => void;
  onElementSelect?: (element: any) => void;
  initialXml?: string;
  onAssignmentAction?: (element: any) => void;
  /** Fired when the user asks to edit gateway/flow conditions (context menu, toolbar button) */
  onConditionAction?: (element: any, modeler: any) => void;
}

export const DEFAULT_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="شروع">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:endEvent id="EndEvent_1" name="پایان">
      <bpmn:incoming>Flow_2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="EndEvent_1" />
    <bpmn:userTask id="Task_1" name="وظیفه جدید">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:userTask>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="152" y="82" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1">
        <dc:Bounds x="250" y="60" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="402" y="82" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="188" y="100" />
        <di:waypoint x="250" y="100" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="350" y="100" />
        <di:waypoint x="402" y="100" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

export function BpmnDesigner({
  onXmlChange,
  onElementSelect,
  initialXml,
  onAssignmentAction,
  onConditionAction,
}: BpmnDesignerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; element: any } | null>(null);
  const [selectedElement, setSelectedElement] = useState<any>(null);
  const [connectMode, setConnectMode] = useState(false);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const BpmnModeler = (await import('bpmn-js/lib/Modeler')).default;
      if (!mounted || !containerRef.current) return;

      const modeler = new BpmnModeler({
        container: containerRef.current,
        // NOTE: diagram-js >= 8 removed `keyboard.bindTo` — binding to the
        // document is now implicit. See https://github.com/bpmn-io/diagram-js/issues/661
        additionalModules: [taskLabelFixModule],
      });
      modelerRef.current = modeler;

      try {
        await modeler.importXML(initialXml || DEFAULT_BPMN_XML);
        modeler.get('canvas').zoom('fit-viewport');

        const { xml } = await modeler.saveXML({ format: true });
        onXmlChange(xml);

        const eventBus = modeler.get('eventBus');

        // Debounce XML export to avoid excessive updates
        let debounceTimer: any;
        eventBus.on('element.changed', () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(async () => {
            try {
              const { xml } = await modeler.saveXML({ format: true });
              onXmlChange(xml);
            } catch (e) {
              // ignore
            }
          }, 300);
        });

        eventBus.on('selection.changed', (e: any) => {
          const selection = e.newSelection;
          if (selection && selection.length > 0) {
            setSelectedElement(selection[0]);
            onElementSelect?.(selection[0]);
          } else {
            setSelectedElement(null);
            onElementSelect?.(null);
          }
        });

        // Handle context menu (right-click)
        const container = containerRef.current;
        const handleContextMenu = (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();

          // Find the BPMN element from the clicked target
          let target = e.target as HTMLElement;
          let elementId: string | null = null;
          while (target && target !== container) {
            elementId = target.getAttribute('data-element-id');
            if (elementId) break;
            target = target.parentElement as HTMLElement;
          }

          if (elementId) {
            const el = modeler.get('elementRegistry').get(elementId);
            if (el) {
              // Select the element first
              modeler.get('selection').select(el);
              setContextMenu({ x: e.clientX, y: e.clientY, element: el });
            }
          }
        };
        container.addEventListener('contextmenu', handleContextMenu);

        // Handle keyboard delete
        const handleKeyDown = (e: KeyboardEvent) => {
          // Check if we're in an input/textarea
          const target = e.target as HTMLElement;
          if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

          if (e.key === 'Delete' || e.key === 'Backspace') {
            const selection = modeler.get('selection');
            const selected = selection.get();
            if (selected && selected.length > 0) {
              e.preventDefault();
              e.stopPropagation();
              const modeling = modeler.get('modeling');
              modeling.removeElements(selected);
            }
          }
        };
        window.addEventListener('keydown', handleKeyDown);

        setReady(true);
      } catch (err) {
        console.error('Error importing BPMN XML:', err);
      }
    };

    init();

    return () => {
      mounted = false;
      window.removeEventListener('keydown', () => {});
      if (modelerRef.current) {
        try {
          modelerRef.current.destroy();
        } catch (e) {
          // ignore
        }
        modelerRef.current = null;
      }
    };
  }, []);

  const createElement = useCallback((type: string) => {
    const modeler = modelerRef.current;
    if (!modeler) return;

    const elementFactory = modeler.get('elementFactory');
    const autoPlace = modeler.get('autoPlace');
    const selection = modeler.get('selection');
    const canvas = modeler.get('canvas');
    const modeling = modeler.get('modeling');

    const currentSelection = selection.get();
    const source = currentSelection[0];

    let shape;
    switch (type) {
      case 'startEvent': shape = elementFactory.createShape({ type: 'bpmn:StartEvent' }); break;
      case 'endEvent': shape = elementFactory.createShape({ type: 'bpmn:EndEvent' }); break;
      case 'userTask': shape = elementFactory.createShape({ type: 'bpmn:UserTask' }); break;
      case 'serviceTask': shape = elementFactory.createShape({ type: 'bpmn:ServiceTask' }); break;
      case 'exclusiveGateway': shape = elementFactory.createShape({ type: 'bpmn:ExclusiveGateway' }); break;
      case 'parallelGateway': shape = elementFactory.createShape({ type: 'bpmn:ParallelGateway' }); break;
      case 'inclusiveGateway': shape = elementFactory.createShape({ type: 'bpmn:InclusiveGateway' }); break;
      default: return;
    }

    if (source && autoPlace && !source.type.includes('SequenceFlow')) {
      // Auto-place after the selected element (this also creates a sequence flow connection)
      const newShape = autoPlace.append(source, shape);
      selection.select(newShape);
    } else {
      // No source selected — place at center of visible canvas
      const root = canvas.getRootElement();
      const viewbox = canvas.viewbox();
      const cx = viewbox.x + viewbox.width / 2;
      const cy = viewbox.y + viewbox.height / 2;
      const newShape = modeling.createShape(shape, { x: cx, y: cy }, root);
      selection.select(newShape);
    }
  }, []);

  const startConnectMode = useCallback(() => {
    const modeler = modelerRef.current;
    if (!modeler) return;

    // Activate the global connect tool
    const connect = modeler.get('globalConnect');
    if (connect) {
      connect.start();
      setConnectMode(true);
      // Exit connect mode after a connection is made or cancelled
      const eventBus = modeler.get('eventBus');
      const exitConnect = () => {
        setConnectMode(false);
        eventBus.off('global-connect.end', exitConnect);
        eventBus.off('global-connect.cancel', exitConnect);
      };
      eventBus.on('global-connect.end', exitConnect);
      eventBus.on('global-connect.cancel', exitConnect);
    }
  }, []);

  const deleteSelected = useCallback(() => {
    const modeler = modelerRef.current;
    if (!modeler) return;
    const selection = modeler.get('selection');
    const selected = selection.get();
    if (selected && selected.length > 0) {
      const modeling = modeler.get('modeling');
      modeling.removeElements(selected);
    }
  }, []);

  const renameSelected = useCallback(() => {
    const modeler = modelerRef.current;
    if (!modeler || !selectedElement) return;
    const currentName = selectedElement.businessObject?.name || '';
    const newName = window.prompt('نام عنصر را وارد کنید:', currentName);
    if (newName !== null) {
      const modeling = modeler.get('modeling');
      modeling.updateProperties(selectedElement, { name: newName });
    }
  }, [selectedElement]);

  // Latest-ref so init-time listeners always call the current prop
  const onConditionActionRef = useRef(onConditionAction);
  onConditionActionRef.current = onConditionAction;

  const selectedSupportsCondition =
    !!selectedElement &&
    (selectedElement.type === 'bpmn:ExclusiveGateway' ||
      selectedElement.type === 'bpmn:InclusiveGateway' ||
      selectedElement.type === 'bpmn:SequenceFlow');

  const paletteItems = [
    { type: 'startEvent', label: 'شروع', icon: '○', color: 'bg-chart-2' },
    { type: 'userTask', label: 'وظیفه کاربر', icon: '☐', color: 'bg-chart-1' },
    { type: 'exclusiveGateway', label: 'انحصاری', icon: '✕', color: 'bg-chart-3' },
    { type: 'parallelGateway', label: 'موازی', icon: '＋', color: 'bg-chart-4' },
    { type: 'inclusiveGateway', label: 'فراگیر', icon: '◉', color: 'bg-chart-3' },
    { type: 'endEvent', label: 'پایان', icon: '●', color: 'bg-chart-5' },
  ];

  // Context menu items
  const contextMenuItems = contextMenu?.element ? (() => {
    const el = contextMenu.element;
    const isTask = el.type?.includes('Task');
    const isConditionalGateway =
      el.type === 'bpmn:ExclusiveGateway' || el.type === 'bpmn:InclusiveGateway';
    const isSequenceFlow = el.type === 'bpmn:SequenceFlow';
    const items: { label: string; icon: string; action: () => void; danger?: boolean }[] = [
      { label: 'ویرایش نام', icon: '✏️', action: () => { renameSelected(); setContextMenu(null); } },
    ];
    if (isConditionalGateway || isSequenceFlow) {
      items.push({
        label: isConditionalGateway ? 'مدیریت شرط‌ها' : 'ویرایش شرط',
        icon: '⚡',
        action: () => {
          onConditionActionRef.current?.(el, modelerRef.current);
          setContextMenu(null);
        },
      });
    }
    if (isTask) {
      items.push({
        label: 'تخصیص',
        icon: '👤',
        action: () => {
          onAssignmentAction?.(el);
          setContextMenu(null);
        },
      });
    }
    items.push({ label: 'حذف عنصر', icon: '🗑️', action: () => { deleteSelected(); setContextMenu(null); }, danger: true });
    return items;
  })() : [];

  return (
    <div className="flex flex-col h-full">
      {/* Palette toolbar — MD3 surface with tonal chips + pill actions */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border/70 bg-muted/40 flex-wrap">
        <span className="text-xs font-medium text-muted-foreground ml-2">افزودن:</span>
        {paletteItems.map((item) => (
          <button
            key={item.type}
            onClick={() => createElement(item.type)}
            className="state-layer flex items-center gap-1.5 px-2.5 h-8 rounded-full text-xs text-foreground hover:bg-accent transition-colors"
            title={item.label}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] ${item.color}`}>
              {item.icon}
            </span>
            <span className="hidden sm:inline">{item.label}</span>
          </button>
        ))}

        <div className="w-px h-6 bg-border/70 mx-1" />

        {/* Condition button — exclusive/inclusive gateways and sequence flows */}
        <button
          onClick={() => {
            if (selectedSupportsCondition) {
              onConditionActionRef.current?.(selectedElement, modelerRef.current);
            }
          }}
          disabled={!selectedSupportsCondition}
          className="state-layer flex items-center gap-1.5 px-2.5 h-8 rounded-full text-xs text-warning hover:bg-warning/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="تنظیم شرط روی دروازه یا فلش انتخاب شده"
        >
          <span className="text-base leading-none">⚡</span>
          <span className="hidden sm:inline">شرط</span>
        </button>

        {/* Connect button */}
        <button
          onClick={startConnectMode}
          className={`state-layer flex items-center gap-1.5 px-2.5 h-8 rounded-full text-xs transition-colors ${
            connectMode
              ? 'bg-primary-container text-on-primary-container'
              : 'text-foreground hover:bg-accent'
          }`}
          title="اتصال دو عنصر با فلش"
        >
          <span className="text-base leading-none">→</span>
          <span className="hidden sm:inline">اتصال</span>
        </button>

        {/* Delete button */}
        <button
          onClick={deleteSelected}
          disabled={!selectedElement}
          className="state-layer flex items-center gap-1.5 px-2.5 h-8 rounded-full text-xs text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="حذف عنصر انتخاب شده (Delete)"
        >
          <span className="text-base leading-none">🗑️</span>
          <span className="hidden sm:inline">حذف</span>
        </button>

        <div className="flex-1" />
        {selectedElement ? (
          <span className="inline-flex items-center max-w-[280px] h-7 px-3 rounded-full bg-secondary text-secondary-foreground text-xs">
            <span className="truncate">انتخاب: {selectedElement.businessObject?.name || selectedElement.id}</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/80 hidden md:inline">
            برای اتصال: دکمه اتصال → کلیک روی عنصر مبدا → کلیک روی عنصر مقصد
          </span>
        )}
      </div>

      {/* Canvas — framed MD3 surface (modeler internals untouched) */}
      <div className="flex-1 relative m-3 rounded-xl border border-border/60 overflow-hidden shadow-elev-1" style={{ minHeight: '400px' }}>
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/60 md-skeleton">
            <p className="text-sm text-muted-foreground/80">در حال بارگذاری...</p>
          </div>
        )}
        <div
          ref={containerRef}
          className="bpmn-canvas-container w-full h-full"
          dir="ltr"
          style={{ background: '#fafafa' }}
        />
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
          />
          <div
            className="fixed z-[100] bg-card border border-border/60 rounded-xl shadow-elev-2 py-1.5 min-w-[190px] overflow-hidden"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
              transform: 'translateX(calc(-100% - 8px))',
            }}
            dir="rtl"
          >
            {contextMenuItems.map((item, i) => (
              <div key={i}>
                {item.danger && i > 0 && <div className="my-1.5 border-t border-border/60" />}
                <button
                  onClick={item.action}
                  className={`state-layer w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                    item.danger ? 'text-destructive' : 'text-foreground hover:bg-accent'
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
