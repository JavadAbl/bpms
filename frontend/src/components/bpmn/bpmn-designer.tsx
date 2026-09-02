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
        keyboard: {
          bindTo: window,
        },
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

  const paletteItems = [
    { type: 'startEvent', label: 'شروع', icon: '○', color: 'bg-green-500' },
    { type: 'userTask', label: 'وظیفه کاربر', icon: '☐', color: 'bg-blue-500' },
    { type: 'exclusiveGateway', label: 'انحصاری', icon: '✕', color: 'bg-yellow-500' },
    { type: 'parallelGateway', label: 'موازی', icon: '＋', color: 'bg-purple-500' },
    { type: 'inclusiveGateway', label: 'فراگیر', icon: '◉', color: 'bg-orange-500' },
    { type: 'endEvent', label: 'پایان', icon: '●', color: 'bg-red-500' },
  ];

  // Context menu items
  const contextMenuItems = contextMenu?.element ? (() => {
    const el = contextMenu.element;
    const isTask = el.type?.includes('Task');
    const items: { label: string; icon: string; action: () => void; danger?: boolean }[] = [
      { label: 'ویرایش نام', icon: '✏️', action: () => { renameSelected(); setContextMenu(null); } },
    ];
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
      {/* Palette toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-200 bg-gray-50 flex-wrap">
        <span className="text-xs text-gray-500 ml-2">افزودن:</span>
        {paletteItems.map((item) => (
          <button
            key={item.type}
            onClick={() => createElement(item.type)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-gray-700 hover:bg-white hover:shadow-sm transition-all border border-transparent hover:border-gray-200"
            title={item.label}
          >
            <span className={`w-5 h-5 rounded flex items-center justify-center text-white text-[10px] ${item.color}`}>
              {item.icon}
            </span>
            <span className="hidden sm:inline">{item.label}</span>
          </button>
        ))}

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Connect button */}
        <button
          onClick={startConnectMode}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-all border ${
            connectMode
              ? 'bg-emerald-100 border-emerald-400 text-emerald-700'
              : 'text-gray-700 hover:bg-white hover:shadow-sm border-transparent hover:border-gray-200'
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
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-red-600 hover:bg-red-50 transition-all border border-transparent hover:border-red-200 disabled:opacity-40 disabled:cursor-not-allowed"
          title="حذف عنصر انتخاب شده (Delete)"
        >
          <span className="text-base leading-none">🗑️</span>
          <span className="hidden sm:inline">حذف</span>
        </button>

        <div className="flex-1" />
        <span className="text-xs text-gray-400">
          {selectedElement
            ? `انتخاب شده: ${selectedElement.businessObject?.name || selectedElement.id}`
            : 'برای اتصال: دکمه اتصال → کلیک روی عنصر مبدا → کلیک روی عنصر مقصد'}
        </span>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative" style={{ minHeight: '400px' }}>
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <p className="text-sm text-gray-400">در حال بارگذاری...</p>
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
            className="fixed z-[100] bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px]"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
              transform: 'translateX(calc(-100% - 8px))',
            }}
            dir="rtl"
          >
            {contextMenuItems.map((item, i) => (
              <div key={i}>
                {item.danger && i > 0 && <div className="my-1 border-t border-gray-100" />}
                <button
                  onClick={item.action}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 ${
                    item.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700'
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
