'use client';

import { useEffect, useRef, useState } from 'react';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import '@/components/bpmn/bpmn-designer.css'; // shared BPMN canvas styles (LTR container, label fonts)
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { GitBranch, Printer, Zap } from 'lucide-react';

interface ConditionInfo {
  flowId: string;
  sourceLabel: string;
  targetLabel: string;
  body: string;
  isDefault: boolean;
}

interface Props {
  open: boolean;
  processName: string;
  bpmnXml: string | null;
  loadingXml?: boolean;
  onClose: () => void;
}

/** Shorten a condition body for display: strips the next(null, …) wrapper. */
function shortCondition(body: string): string {
  const m = body.match(/^\s*next\s*\(\s*(?:null|undefined)\s*,\s*([\s\S]+?)\s*\)\s*;?\s*$/);
  const inner = m ? m[1] : body;
  return inner.replace(/environment\.variables\./g, '').replace(/;$/, '');
}

/**
 * Read-only preview of a process definition:
 *  - navigable diagram (pan/zoom via bpmn-js NavigatedViewer)
 *  - summary list of all routing conditions (incl. default flow) below the diagram
 */
export function ProcessPreviewDialog({ open, processName, bpmnXml, loadingXml, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [conditions, setConditions] = useState<ConditionInfo[]>([]);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!open || !bpmnXml || !containerRef.current) return;
    let viewer: any = null;
    let mounted = true;
    const container = containerRef.current;

    (async () => {
      setImporting(true);
      setError('');
      setConditions([]);
      try {
        const Viewer = (await import('bpmn-js/lib/NavigatedViewer')).default;
        viewer = new Viewer({ container });
        await viewer.importXML(bpmnXml);
        if (!mounted) return;
        viewer.get('canvas').zoom('fit-viewport');

        const registry = viewer.get('elementRegistry');
        const list: ConditionInfo[] = [];

        registry.forEach((el: any) => {
          if (el.type !== 'bpmn:SequenceFlow') return;
          const bo = el.businessObject || {};
          const body: string = bo.conditionExpression?.body || '';
          const srcBo = el.source?.businessObject || {};
          const isDefault = !!srcBo.default && srcBo.default.id === bo.id;
          if (!body && !isDefault) return;

          const sourceLabel = srcBo.name || el.source?.id || '—';
          const targetLabel = el.target?.businessObject?.name || el.target?.id || '—';
          list.push({ flowId: el.id, sourceLabel, targetLabel, body, isDefault });
        });

        if (!mounted) return;
        // order: gateway flows first, then by appearance
        setConditions(list);
      } catch (e: any) {
        if (mounted) setError(e?.message || String(e));
      } finally {
        if (mounted) setImporting(false);
      }
    })();

    return () => {
      mounted = false;
      try {
        viewer?.destroy();
      } catch {
        // ignore
      }
    };
  }, [open, bpmnXml]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="sm:max-w-3xl max-h-[90vh] overflow-y-auto process-print-dialog"
        dir="rtl"
      >
        <DialogHeader className="flex flex-row items-center gap-2 print:hidden">
          <DialogTitle className="flex items-center gap-2 text-base flex-1">
            <GitBranch className="w-4 h-4 text-emerald-600" />
            پیش‌نمایش فرآیند: {processName}
          </DialogTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            title="چاپ نمودار و شرط‌های مسیریابی"
          >
            <Printer className="w-3.5 h-3.5 ml-1" />
            چاپ
          </Button>
        </DialogHeader>

        {loadingXml ? (
          <Skeleton className="h-[380px] w-full rounded-lg" />
        ) : error ? (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            خطا در بارگذاری نمودار: {error}
          </div>
        ) : (
          <>
            <div className="process-print-area space-y-3">
              {/* print-only header — replaces the dialog title on paper */}
              <div className="hidden print:block mb-1">
                <p className="text-lg font-bold">فرآیند: {processName}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  نمودار فرآیند و شرط‌های مسیریابی — چاپ‌شده در{' '}
                  {new Date().toLocaleDateString('fa-IR')}
                </p>
              </div>

              <div className="relative">
                <div
                  ref={containerRef}
                  dir="ltr"
                  className="w-full h-[380px] border border-gray-200 rounded-lg bg-gray-50 bpmn-canvas-container"
                />
                {importing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-lg print:hidden">
                    <p className="text-xs text-gray-400">در حال بارگذاری نمودار…</p>
                  </div>
                )}
              </div>

              <div>
                <p className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-2">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  شرط‌های مسیریابی ({conditions.length})
                </p>
                {conditions.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    این فرآیند هیچ شرط مسیریابی (دروازه شرطی) ندارد.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {conditions.map((c) => (
                      <li
                        key={c.flowId}
                        className="flex items-center gap-2 text-xs bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5"
                      >
                        <span className="text-gray-500 shrink-0">{c.sourceLabel}</span>
                        <span className="text-gray-300">→</span>
                        <span className="font-medium shrink-0">{c.targetLabel}</span>
                        {c.isDefault && !c.body ? (
                          <Badge className="bg-emerald-100 text-emerald-800 text-[10px] shrink-0">
                            فلش پیش‌فرض
                          </Badge>
                        ) : (
                          <code
                            dir="ltr"
                            className="font-mono text-[10px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-700 truncate"
                          >
                            {shortCondition(c.body)}
                          </code>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <p className="text-[10px] text-gray-400 process-print-hide">
              با دکمه «چاپ»، نمودار به همراه فهرست کامل شرط‌های مسیریابی روی کاغذ چاپ می‌شود.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
