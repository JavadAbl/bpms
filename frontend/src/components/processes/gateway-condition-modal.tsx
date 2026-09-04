'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, ArrowRight, FlaskConical, Play, Trash2, Zap } from 'lucide-react';

export interface ConditionVariable {
  name: string;
  label?: string;
  type: string;
  /** for select-type form fields — used by the dry-run tester dropdown */
  options?: string[];
}

interface Props {
  open: boolean;
  /** diagram-js element: gateway (Exclusive/Inclusive) or a sequence flow */
  element: any | null;
  modeler: any | null;
  variables: ConditionVariable[];
  onClose: () => void;
}

interface FlowRow {
  flowId: string;
  flowBoId: string;
  targetLabel: string;
  mode: 'simple' | 'expression';
  variable: string;
  operator: string;
  value: string;
  expression: string;
  isDefault: boolean;
  /** raw body as currently stored in the BPMN XML ('' when none) */
  initialBody: string;
  initialDefault: boolean;
  /** true when the stored body is a hand-written script (not our next(...) wrapper) */
  rawScript: boolean;
}

const OPERATORS = [
  { value: '==', label: 'برابر باشد (==)' },
  { value: '!=', label: 'برابر نباشد (!=)' },
  { value: '>', label: 'بزرگتر از (>)' },
  { value: '>=', label: 'بزرگتر یا مساوی (>=)' },
  { value: '<', label: 'کوچکتر از (<)' },
  { value: '<=', label: 'کوچکتر یا مساوی (<=)' },
];

/**
 * Matches the engine's script-wrapper format:
 *   next(null, <js expression>)
 * The bpmn-engine Scripts module runs `language="javascript"` conditions in a
 * node vm context where `next` is the completion callback — a condition MUST
 * call next(err, result) to resolve, otherwise the gateway hangs.
 */
const NEXT_WRAPPER_RE = /^\s*next\s*\(\s*(?:null|undefined)\s*,\s*([\s\S]+?)\s*\)\s*;?\s*$/;

/** Matches a simple condition: environment.variables.x OP value */
const SIMPLE_RE =
  /^\s*environment\.variables\.([A-Za-z0-9_]+)\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+?)\s*;?\s*$/;

function unwrapNext(body: string): { inner: string; wrapped: boolean } | null {
  if (!body) return null;
  const m = body.match(NEXT_WRAPPER_RE);
  if (m) return { inner: m[1], wrapped: true };
  return null;
}

function parseSimple(inner: string): { variable: string; operator: string; value: string } | null {
  const m = inner.match(SIMPLE_RE);
  if (!m) return null;
  const operator = m[2] === '===' ? '==' : m[2] === '!==' ? '!=' : m[2];
  let value = m[3];
  const strMatch = value.match(/^(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")$/);
  if (strMatch) {
    value = (strMatch[1] ?? strMatch[2]).replace(/\\'/g, "'").replace(/\\"/g, '"');
  }
  return { variable: m[1], operator, value };
}

/** Builds the JS expression for simple mode (returns null when invalid). */
function buildSimpleExpression(
  row: { variable: string; operator: string; value: string },
  variables: ConditionVariable[],
): string | null {
  if (!row.variable) return null;
  const meta = variables.find((v) => v.name === row.variable);
  const raw = row.value.trim();
  if (raw === '') return null;
  let literal: string;
  if (meta && (meta.type === 'number' || meta.type === 'integer' || meta.type === 'float')) {
    if (!/^-?\d+(\.\d+)?$/.test(raw)) return null;
    literal = raw;
  } else if (meta && (meta.type === 'checkbox' || meta.type === 'boolean')) {
    literal = raw === 'true' ? 'true' : 'false';
  } else {
    literal = `'${raw.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }
  return `environment.variables.${row.variable} ${row.operator} ${literal}`;
}

/* ===================== dry-run tester ===================== */

type RowTestKind = 'match' | 'no' | 'always' | 'error' | 'hang';

interface RowTest {
  kind: RowTestKind;
  message?: string;
}

/**
 * Runs a condition body exactly the way bpmn-engine's Scripts module does:
 * compile the body, call it with a `next(err, result)` completion callback and
 * an `environment` whose `variables` hold the sample values. A condition MUST
 * call next() — otherwise the gateway hangs forever (same as the engine).
 */
function runBody(body: string, vars: Record<string, unknown>): RowTest {
  if (!body) return { kind: 'always' }; // no condition → always taken
  let fn: Function;
  try {
    // Compile-only here; execution below mirrors the engine's vm run
    // eslint-disable-next-line no-new-func
    fn = new Function('next', 'environment', body);
  } catch (e: any) {
    return { kind: 'error', message: e?.message || String(e) };
  }
  try {
    let called = false;
    let err: any;
    let result: any;
    const next = (e: any, r: any) => {
      called = true;
      err = e;
      result = r;
    };
    fn(next, { variables: vars });
    if (!called) return { kind: 'hang' };
    if (err) return { kind: 'error', message: err?.message ? String(err.message) : String(err) };
    return { kind: result ? 'match' : 'no' };
  } catch (e: any) {
    return { kind: 'error', message: e?.message || String(e) };
  }
}

/** Converts a raw sample-input string into the typed value the engine would see. */
function parseSample(meta: ConditionVariable | undefined, raw: string | undefined): unknown {
  if (raw === undefined || raw === '') return undefined; // empty = variable absent (undefined)
  if (!meta) return raw;
  if (['number', 'integer', 'float'].includes(meta.type)) {
    const n = Number(raw);
    return Number.isNaN(n) ? raw : n;
  }
  if (meta.type === 'checkbox' || meta.type === 'boolean') return raw === 'true';
  return raw;
}

const SAMPLE_UNSET = '__unset__';

export function GatewayConditionModal({ open, element, modeler, variables, onClose }: Props) {
  const [rows, setRows] = useState<FlowRow[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ---- dry-run tester state ----
  const [testOpen, setTestOpen] = useState(false);
  const [samples, setSamples] = useState<Record<string, string>>({});
  const [testRun, setTestRun] = useState<{
    rows: Record<string, RowTest>;
    verdict: { tone: 'ok' | 'warn' | 'bad'; text: string };
  } | null>(null);

  const analysis = useMemo(() => {
    if (!open || !element) return null;
    const type: string = element.type || '';
    const isGateway = type === 'bpmn:ExclusiveGateway' || type === 'bpmn:InclusiveGateway';
    const isFlow = type === 'bpmn:SequenceFlow';
    if (!isGateway && !isFlow) return null;

    // The gateway whose `default` attribute we manage
    const gatewayEl = isGateway ? element : element.source;
    const gatewayIsConditional =
      gatewayEl &&
      (gatewayEl.type === 'bpmn:ExclusiveGateway' || gatewayEl.type === 'bpmn:InclusiveGateway');
    const defaultBoId = gatewayIsConditional ? gatewayEl.businessObject?.default?.id : undefined;

    const flows: any[] = isGateway
      ? (element.outgoing || []).filter((c: any) => c.type === 'bpmn:SequenceFlow')
      : [element];

    const parsedRows: FlowRow[] = flows.map((conn: any) => {
      const bo = conn.businessObject || {};
      const body: string = bo.conditionExpression?.body || '';
      const unwrapped = unwrapNext(body);
      const inner = unwrapped ? unwrapped.inner : body;
      const simple = unwrapped ? parseSimple(inner) : null;

      let mode: 'simple' | 'expression' = 'simple';
      let variable = '';
      let operator = '==';
      let value = '';
      let expression = '';

      if (body) {
        if (simple) {
          mode = 'simple';
          variable = simple.variable;
          operator = simple.operator;
          value = simple.value;
        } else {
          mode = 'expression';
          expression = inner;
        }
      }

      return {
        flowId: conn.id,
        flowBoId: bo.id || conn.id,
        targetLabel:
          conn.target?.businessObject?.name || conn.target?.id || '—',
        mode,
        variable,
        operator,
        value,
        expression,
        isDefault: !!defaultBoId && defaultBoId === bo.id,
        initialBody: body,
        initialDefault: !!defaultBoId && defaultBoId === bo.id,
        rawScript: !!body && !unwrapped,
      };
    });

    return { isGateway, isFlow, gatewayEl, gatewayIsConditional, rows: parsedRows };
  }, [open, element]);

  // Seed editable rows whenever the modal opens for an element
  useEffect(() => {
    if (!open || !analysis) return;
    setRows(analysis.rows);
    setErrors({});
    setTestRun(null);
    setSamples({});
    // analysis is derived solely from (open, element) via useMemo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, element]);

  const updateRow = (flowId: string, patch: Partial<FlowRow>) => {
    setRows((prev) => prev.map((r) => (r.flowId === flowId ? { ...r, ...patch } : r)));
    setErrors((prev) => {
      if (!prev[flowId]) return prev;
      const next = { ...prev };
      delete next[flowId];
      return next;
    });
    setTestRun(null); // results are stale once any condition changes
  };

  const setDefaultRow = (flowId: string) => {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        isDefault: r.flowId === flowId ? !r.isDefault : false,
      })),
    );
    setTestRun(null);
  };

  const rowPreview = (row: FlowRow): string | null => {
    if (row.rawScript && row.initialBody) return row.initialBody;
    if (row.mode === 'simple') {
      const expr = buildSimpleExpression(row, variables);
      return expr ? `next(null, ${expr})` : null;
    }
    const trimmed = row.expression.trim();
    return trimmed ? `next(null, ${trimmed})` : null;
  };

  /** body that will be saved for this row ('' = remove condition) */
  const rowFinalBody = (row: FlowRow): string | null => {
    if (row.isDefault) return null; // default flow carries no condition
    if (row.rawScript) return row.initialBody; // never touch foreign scripts
    if (row.mode === 'simple') {
      const expr = buildSimpleExpression(row, variables);
      return expr ? `next(null, ${expr})` : null;
    }
    const trimmed = row.expression.trim();
    if (!trimmed) return null;
    // Avoid double-wrapping if the user already wrote the next(...) call
    return NEXT_WRAPPER_RE.test(trimmed) ? trimmed : `next(null, ${trimmed})`;
  };

  const handleSave = () => {
    if (!analysis || !modeler) return;
    const modeling = modeler.get('modeling');
    const moddle = modeler.get('moddle');
    const registry = modeler.get('elementRegistry');
    const newErrors: Record<string, string> = {};

    // ---- PASS 1: validate every row first — nothing is applied unless all
    // rows are valid. This rejects invalid JS expressions at save time.
    for (const row of rows) {
      const finalBody = rowFinalBody(row);

      // Validation: simple mode with partial/invalid input
      if (!row.isDefault && !row.rawScript && row.mode === 'simple') {
        const meta = variables.find((v) => v.name === row.variable);
        const invalidNumber =
          meta &&
          ['number', 'integer', 'float'].includes(meta.type) &&
          row.value.trim() !== '' &&
          !/^-?\d+(\.\d+)?$/.test(row.value.trim());
        const hasPartial = row.variable !== '' || row.value.trim() !== '';
        if (invalidNumber) {
          newErrors[row.flowId] = 'مقدار عددی نامعتبر است';
          continue;
        }
        if (hasPartial && !finalBody) {
          newErrors[row.flowId] = 'انتخاب متغیر و مقدار الزامی است';
          continue;
        }
      }

      // Syntax-check the exact script body the engine will compile.
      // new Function compiles WITHOUT running — a SyntaxError here means the
      // engine would throw at runtime, so the save is rejected.
      if (finalBody) {
        try {
          // eslint-disable-next-line no-new-func
          new Function('next', 'environment', finalBody);
        } catch (e: any) {
          newErrors[row.flowId] = `عبارت جاوااسکریپت نامعتبر است: ${e?.message || e}`;
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // ---- PASS 2: everything valid — apply updates
    for (const row of rows) {
      const finalBody = rowFinalBody(row);
      const flowEl = registry.get(row.flowId);
      if (!flowEl) continue;

      const currentBody: string = flowEl.businessObject?.conditionExpression?.body || '';
      if ((finalBody || '') !== currentBody) {
        if (finalBody) {
          const condition = moddle.create('bpmn:FormalExpression', {
            body: finalBody,
            language: 'javascript',
          });
          modeling.updateProperties(flowEl, { conditionExpression: condition });
        } else if (currentBody) {
          modeling.updateProperties(flowEl, { conditionExpression: undefined });
        }
      }
    }

    // Sync the gateway default flow
    if (analysis.gatewayIsConditional && analysis.gatewayEl) {
      const defaultRow = rows.find((r) => r.isDefault);
      const currentDefaultId: string | undefined = analysis.gatewayEl.businessObject?.default?.id;
      const newDefaultBoId: string | undefined = defaultRow
        ? defaultRow.flowBoId
        : undefined;
      if ((currentDefaultId || undefined) !== (newDefaultBoId || undefined)) {
        const defaultEl = defaultRow ? registry.get(defaultRow.flowId) : null;
        modeling.updateProperties(analysis.gatewayEl, {
          default: defaultEl ? defaultEl.businessObject : undefined,
        });
      }
    }

    onClose();
  };

  const gatewayTitle = analysis?.isGateway
    ? 'شرط‌های دروازه انحصاری/فراگیر'
    : 'شرط فلش توالی';

  /* ---------- dry-run tester logic ---------- */

  const runTest = () => {
    if (!analysis) return;
    // Build the variables object exactly as the engine sees it
    const vars: Record<string, unknown> = {};
    variables.forEach((v) => {
      const val = parseSample(v, samples[v.name]);
      if (val !== undefined) vars[v.name] = val;
    });

    const results: Record<string, RowTest> = {};
    rows.forEach((r) => {
      results[r.flowId] = r.isDefault ? { kind: 'always' } : runBody(rowFinalBody(r) || '', vars);
    });

    const defaultRow = rows.find((r) => r.isDefault);
    const candidates = rows.filter(
      (r) => !r.isDefault && (results[r.flowId].kind === 'match' || results[r.flowId].kind === 'always'),
    );
    const label = (r: FlowRow) =>
      r.isDefault ? `${r.targetLabel} (پیش‌فرض)` : r.targetLabel;

    let verdict: { tone: 'ok' | 'warn' | 'bad'; text: string };
    if (analysis.gatewayEl?.type === 'bpmn:InclusiveGateway') {
      if (candidates.length > 0) {
        verdict = {
          tone: 'ok',
          text: `مسیرهای فعال: ${candidates.map(label).join(' + ')}`,
        };
      } else if (defaultRow) {
        verdict = { tone: 'ok', text: `هیچ شرطی برقرار نیست → فلش پیش‌فرض: ${label(defaultRow)}` };
      } else {
        verdict = {
          tone: 'bad',
          text: 'هیچ شرطی برقرار نمی‌شود و فلش پیش‌فرض هم تعیین نشده — فرآیند در این دروازه متوقف می‌شود!',
        };
      }
    } else {
      // XOR: first matching flow (in order) wins
      const winner = candidates[0];
      if (winner) {
        verdict = { tone: 'ok', text: `مسیر اجرا: ${label(winner)}` };
      } else if (defaultRow) {
        verdict = { tone: 'ok', text: `هیچ شرطی برقرار نیست → فلش پیش‌فرض: ${label(defaultRow)}` };
      } else {
        verdict = {
          tone: 'bad',
          text: 'هیچ شرطی برقرار نمی‌شود و فلش پیش‌فرض هم تعیین نشده — فرآیند در این دروازه متوقف می‌شود!',
        };
      }
    }

    setTestRun({ rows: results, verdict });
  };

  const renderSampleInput = (v: ConditionVariable) => {
    const raw = samples[v.name] ?? '';
    const isBool = v.type === 'checkbox' || v.type === 'boolean';
    const isNum = ['number', 'integer', 'float'].includes(v.type);
    if (isBool) {
      return (
        <Select
          value={raw || SAMPLE_UNSET}
          onValueChange={(val) =>
            setSamples((prev) => ({
              ...prev,
              [v.name]: val === SAMPLE_UNSET ? '' : val,
            }))
          }
        >
          <SelectTrigger className="h-7 text-[11px] bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SAMPLE_UNSET}>نامشخص (undefined)</SelectItem>
            <SelectItem value="true">درست (true)</SelectItem>
            <SelectItem value="false">نادرست (false)</SelectItem>
          </SelectContent>
        </Select>
      );
    }
    if (v.type === 'select' && v.options && v.options.length > 0) {
      return (
        <Select
          value={raw || SAMPLE_UNSET}
          onValueChange={(val) =>
            setSamples((prev) => ({
              ...prev,
              [v.name]: val === SAMPLE_UNSET ? '' : val,
            }))
          }
        >
          <SelectTrigger className="h-7 text-[11px] bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SAMPLE_UNSET}>نامشخص (undefined)</SelectItem>
            {v.options.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    return (
      <Input
        value={raw}
        onChange={(e) => setSamples((prev) => ({ ...prev, [v.name]: e.target.value }))}
        placeholder={isNum ? 'مثلا 5' : 'مقدار آزمایشی'}
        className="h-7 text-[11px] bg-white"
        dir="ltr"
        type={isNum ? 'number' : 'text'}
      />
    );
  };

  const testResultBadge = (r: RowTest) => {
    switch (r.kind) {
      case 'match':
        return <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">✔ اجرا می‌شود</Badge>;
      case 'always':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">✔ بدون شرط (همیشه)</Badge>
        );
      case 'no':
        return <Badge variant="secondary" className="text-[10px]">✘ برقرار نیست</Badge>;
      case 'hang':
        return (
          <Badge className="bg-red-100 text-red-800 text-[10px]">⚠ next فراخوانی نشد</Badge>
        );
      case 'error':
        return (
          <Badge className="bg-red-100 text-red-800 text-[10px]">خطا: {r.message}</Badge>
        );
    }
  };

  // After saving, will there be an unguarded XOR gateway?
  const warning = useMemo(() => {
    if (!analysis?.isGateway || rows.length < 2) return null;
    const defaultRow = rows.find((r) => r.isDefault);
    if (defaultRow) return null;
    const unguarded = rows.filter((r) => !rowFinalBody(r));
    if (unguarded.length === 0) return null;
    return 'برای دروازه انحصاری، هر خروجی باید شرط داشته باشد یا یک فلش پیش‌فرض تعیین شود؛ در غیر این صورت موتور فرآیند ممکن است متوقف شود.';
  }, [analysis, rows, variables]);

  const hasVariables = variables.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Zap className="w-4 h-4 text-amber-500" />
            {gatewayTitle}
            {analysis?.gatewayEl?.businessObject?.name && (
              <Badge variant="secondary" className="font-normal">
                {analysis.gatewayEl.businessObject.name}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {!hasVariables && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            هنوز متغیری تعریف نشده است. برای ساخت شرط، ابتدا از تب «متغیرها» متغیر فرآیند اضافه
            کنید یا در حالت «عبارت» عبارت جاوااسکریپت بنویسید.
          </div>
        )}

        <div className="space-y-3 py-1">
          {rows.map((row) => (
            <div
              key={row.flowId}
              className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <ArrowRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="text-xs text-gray-500 shrink-0">به:</span>
                  <span className="text-sm font-medium truncate">{row.targetLabel}</span>
                  {row.initialBody && !row.isDefault && (
                    <Badge className="bg-amber-100 text-amber-800 text-[10px] shrink-0">
                      شرط دارد
                    </Badge>
                  )}
                </div>
                {analysis?.gatewayIsConditional && (
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer shrink-0">
                    <input
                      type="radio"
                      name="default-flow"
                      checked={row.isDefault}
                      onChange={() => setDefaultRow(row.flowId)}
                      className="accent-emerald-600"
                    />
                    پیش‌فرض
                  </label>
                )}
              </div>

              {!row.isDefault && !row.rawScript && (
                <>
                  <div className="flex items-center gap-1 text-[11px]">
                    <button
                      onClick={() => updateRow(row.flowId, { mode: 'simple' })}
                      className={`px-2 py-1 rounded-md transition-colors ${
                        row.mode === 'simple'
                          ? 'bg-emerald-100 text-emerald-700 font-medium'
                          : 'text-gray-500 hover:bg-gray-200/60'
                      }`}
                    >
                      شرط ساده
                    </button>
                    <button
                      onClick={() => updateRow(row.flowId, { mode: 'expression' })}
                      className={`px-2 py-1 rounded-md transition-colors ${
                        row.mode === 'expression'
                          ? 'bg-emerald-100 text-emerald-700 font-medium'
                          : 'text-gray-500 hover:bg-gray-200/60'
                      }`}
                    >
                      عبارت جاوااسکریپت
                    </button>
                  </div>

                  {row.mode === 'simple' ? (
                    <div className="grid grid-cols-3 gap-2">
                      <Select
                        value={row.variable || 'none'}
                        onValueChange={(v) => updateRow(row.flowId, { variable: v === 'none' ? '' : v })}
                      >
                        <SelectTrigger className="h-8 text-xs bg-white">
                          <SelectValue placeholder="متغیر" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" disabled>
                            انتخاب متغیر
                          </SelectItem>
                          {variables.map((v) => (
                            <SelectItem key={v.name} value={v.name}>
                              {v.label || v.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={row.operator}
                        onValueChange={(v) => updateRow(row.flowId, { operator: v })}
                      >
                        <SelectTrigger className="h-8 text-xs bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {OPERATORS.map((op) => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {variables.find((v) => v.name === row.variable)?.type === 'checkbox' ||
                      variables.find((v) => v.name === row.variable)?.type === 'boolean' ? (
                        <Select
                          value={row.value || 'false'}
                          onValueChange={(v) => updateRow(row.flowId, { value: v })}
                        >
                          <SelectTrigger className="h-8 text-xs bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">درست (true)</SelectItem>
                            <SelectItem value="false">نادرست (false)</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={row.value}
                          onChange={(e) => updateRow(row.flowId, { value: e.target.value })}
                          placeholder="مقدار"
                          className="h-8 text-xs bg-white"
                          dir="ltr"
                        />
                      )}
                    </div>
                  ) : (
                    <Textarea
                      value={row.expression}
                      onChange={(e) => updateRow(row.flowId, { expression: e.target.value })}
                      placeholder="environment.variables.amount > 1000"
                      className="min-h-[64px] font-mono text-xs bg-white"
                      dir="ltr"
                    />
                  )}

                  {row.mode === 'expression' && hasVariables && (
                    <div className="flex flex-wrap gap-1">
                      {variables.map((v) => (
                        <button
                          key={v.name}
                          onClick={() =>
                            updateRow(row.flowId, {
                              expression: `${row.expression}${row.expression && !row.expression.endsWith(' ') ? ' ' : ''}environment.variables.${v.name} `,
                            })
                          }
                          className="px-1.5 py-0.5 rounded bg-white border border-gray-200 text-[10px] font-mono text-gray-600 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
                          dir="ltr"
                        >
                          {v.name}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {row.rawScript && (
                <div className="p-2 bg-blue-50 rounded text-[11px] text-blue-700">
                  این فلش یک اسکریپت دستی دارد و حفظ می‌شود. برای ویرایش، ابتدا شرط را پاک کنید.
                  <code dir="ltr" className="block mt-1 font-mono truncate">
                    {row.initialBody}
                  </code>
                </div>
              )}

              {row.isDefault && (
                <p className="text-[11px] text-gray-500">
                  فلش پیش‌فرض شرط نمی‌پذیرد و در صورت برقرار نبودن سایر شرط‌ها اجرا می‌شود.
                </p>
              )}

              {rowPreview(row) && !row.rawScript && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-400 shrink-0">خروجی XML:</span>
                  <code
                    dir="ltr"
                    className="text-[10px] font-mono bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-600 truncate"
                  >
                    {rowPreview(row)}
                  </code>
                </div>
              )}

              {errors[row.flowId] && (
                <p className="text-[11px] text-red-600">{errors[row.flowId]}</p>
              )}

              {/* dry-run result for this row */}
              {testRun && testRun.rows[row.flowId] && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {testResultBadge(testRun.rows[row.flowId])}
                  {testRun.verdict.tone === 'ok' &&
                    testRun.verdict.text.includes(row.targetLabel) && (
                      <span className="text-[10px] text-emerald-700">← انتخاب‌شده در این اجرا</span>
                    )}
                </div>
              )}

              <div className="flex justify-start">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() =>
                    updateRow(row.flowId, {
                      mode: 'simple',
                      variable: '',
                      operator: '==',
                      value: '',
                      expression: '',
                      isDefault: false,
                    })
                  }
                >
                  <Trash2 className="w-3 h-3 ml-1" />
                  پاک کردن شرط
                </Button>
              </div>
            </div>
          ))}

          {rows.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">
              {analysis?.isGateway
                ? 'این دروازه خروجی ندارد؛ ابتدا با ابزار «اتصال» فلش‌های خروجی بسازید.'
                : 'عنصر انتخاب شده قابل تنظیم شرط نیست.'}
            </p>
          )}

          {warning && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{warning}</span>
            </div>
          )}

          {/* ---- dry-run condition tester ---- */}
          {rows.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setTestOpen((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-xs"
              >
                <span className="flex items-center gap-1.5 font-medium text-gray-700">
                  <FlaskConical className="w-3.5 h-3.5 text-violet-600" />
                  تستر شرط (اجرای آزمایشی با مقادیر نمونه)
                </span>
                <span className="text-gray-400 text-sm leading-none">{testOpen ? '−' : '+'}</span>
              </button>

              {testOpen && (
                <div className="p-3 space-y-3 bg-white">
                  {hasVariables ? (
                    <div className="grid grid-cols-2 gap-2">
                      {variables.map((v) => (
                        <div key={v.name} className="space-y-1">
                          <label className="flex items-center gap-1 text-[10px] text-gray-500">
                            <span className="font-mono" dir="ltr">
                              {v.name}
                            </span>
                            {v.label && v.label !== v.name && (
                              <span className="truncate">({v.label})</span>
                            )}
                          </label>
                          {renderSampleInput(v)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-500">
                      متغیری برای ورود مقدار آزمایشی وجود ندارد؛ شرط‌ها با مقادیر undefined آزموده
                      می‌شوند.
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={runTest} className="h-7 text-xs">
                      <Play className="w-3 h-3 ml-1" />
                      اجرای آزمایشی
                    </Button>
                    <span className="text-[10px] text-gray-400">
                      مقدار خالی = متغیر تعریف‌نشده (undefined)
                    </span>
                  </div>

                  {testRun && (
                    <div className="space-y-2 pt-2 border-t border-gray-100">
                      {rows.map((row) => (
                        <div
                          key={`t-${row.flowId}`}
                          className="flex items-center gap-2 text-[11px]"
                        >
                          <ArrowRight className="w-3 h-3 text-gray-300 shrink-0" />
                          <span className="truncate text-gray-600">
                            {row.isDefault
                              ? `${row.targetLabel} (پیش‌فرض)`
                              : row.targetLabel}
                          </span>
                          {testRun.rows[row.flowId] && testResultBadge(testRun.rows[row.flowId])}
                        </div>
                      ))}
                      <div
                        className={`p-2 rounded text-[11px] font-medium ${
                          testRun.verdict.tone === 'ok'
                            ? 'bg-emerald-50 text-emerald-800'
                            : testRun.verdict.tone === 'warn'
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-red-50 text-red-800'
                        }`}
                      >
                        {testRun.verdict.text}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            انصراف
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            ذخیره شرط‌ها
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
