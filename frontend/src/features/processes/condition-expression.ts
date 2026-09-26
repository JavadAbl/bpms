/**
 * Pure BPMN condition-expression helpers — the single source of truth for
 * building/parsing the `next(null, <expr>)` script bodies the bpmn-engine
 * Scripts module executes on gateway flows.
 *
 * Shared by the gateway condition modal (live preview) and the slice's zod
 * schema (save-time validation), so the builder UI and the validation can
 * never drift apart. Contains no React / DOM code.
 */

export interface ConditionVariable {
  name: string;
  label?: string;
  type: string;
  /** Selectable values of select/radio variables — resolved the SAME way the
   *  runtime form renders them: category items (Persian labels) or inline
   *  options. Keeps the no-code builder in sync with what users submit. */
  options?: { value: string; label: string }[];
}

/** The editable subset of a flow row the modal works with. */
export interface ConditionRow {
  flowId: string;
  mode: 'simple' | 'expression';
  variable: string;
  operator: string;
  value: string;
  expression: string;
  isDefault: boolean;
  /** raw body as currently stored in the BPMN XML ('' when none) */
  initialBody: string;
  /** true when the stored body is a hand-written script (not our next(...) wrapper) */
  rawScript: boolean;
}

/**
 * Matches the engine's script-wrapper format:
 *   next(null, <js expression>)
 * The bpmn-engine Scripts module runs `language="javascript"` conditions in a
 * node vm context where `next` is the completion callback — a condition MUST
 * call next(err, result) to resolve, otherwise the gateway hangs.
 */
export const NEXT_WRAPPER_RE = /^\s*next\s*\(\s*(?:null|undefined)\s*,\s*([\s\S]+?)\s*\)\s*;?\s*$/;

/** Matches a simple condition: environment.variables.x OP value */
export const SIMPLE_RE =
  /^\s*environment\.variables\.([A-Za-z0-9_]+)\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+?)\s*;?\s*$/;

export function unwrapNext(body: string): { inner: string; wrapped: boolean } | null {
  if (!body) return null;
  const m = body.match(NEXT_WRAPPER_RE);
  if (m) return { inner: m[1], wrapped: true };
  return null;
}

export function parseSimple(
  inner: string,
): { variable: string; operator: string; value: string } | null {
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
export function buildSimpleExpression(
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

/**
 * The body that will be SAVED for a row (null = remove the condition).
 * Mirrors the modal's historical rowFinalBody exactly:
 *  - default flow carries no condition
 *  - foreign hand-written scripts are never touched
 *  - expression mode avoids double-wrapping an explicit next(...) call
 */
export function buildFinalBody(row: ConditionRow, variables: ConditionVariable[]): string | null {
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
}
