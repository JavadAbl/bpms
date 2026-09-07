/**
 * Save-time validation for gateway condition expressions.
 *
 * bpmn-engine only evaluates a sequence-flow condition as real JavaScript when
 * it carries `language="javascript"` (or "js") AND the body calls
 * `next(err, result)` — see lib/index.cjs: `/^(javascript|js)$/i.test(language)`.
 * Any other shape silently falls back to the dumb template resolver, which
 * returns a truthy string, so an exclusive gateway ALWAYS takes the first
 * outgoing flow (verified bug). A javascript body that never calls next()
 * hangs the gateway forever.
 *
 * This validator rejects all of those shapes BEFORE the XML reaches the DB,
 * both on process create/update (ProcessesService) and on activation.
 *
 * NOTE: a browser-safe mirror of this logic lives at
 * src/lib/condition-validation.ts (frontend designer save gate). Keep the two
 * in sync.
 */

export interface ConditionValidationError {
  /** id of the offending sequenceFlow */
  flowId: string;
  /** name attribute of the flow (may be empty) */
  flowName: string;
  message: string;
}

export interface ConditionIssue {
  kind: 'syntax' | 'no-next' | 'unsupported-language' | 'empty-body';
  message: string;
}

/** Matches expanded <sequenceFlow ...>inner</sequenceFlow> AND self-closing <sequenceFlow .../> */
const FLOW_RE = /<(?:bpmn:|bpmn2:)?sequenceFlow\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:bpmn:|bpmn2:)?sequenceFlow>)/g;

/** Matches an expanded <conditionExpression ...>body</conditionExpression> */
const COND_RE = /<(?:bpmn:|bpmn2:)?conditionExpression\b([^>]*)>([\s\S]*?)<\/(?:bpmn:|bpmn2:)?conditionExpression>/;

/** Matches a self-closing <conditionExpression ... /> (empty condition) */
const COND_EMPTY_RE = /<(?:bpmn:|bpmn2:)?conditionExpression\b[^>]*?\/>\s*$/;

/** Engine-accepted script languages (bpmn-engine lib/index.cjs) */
const JS_LANG_RE = /^(javascript|js)$/i;

/** Decode XML entities so `a &lt; b` compiles as `a < b`. &amp; must be last. */
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function attr(attrs: string, name: string): string {
  const m = attrs.match(new RegExp(`\\b${name}="([^"]*)"`));
  return m ? m[1] : '';
}

/**
 * Validate a single decoded condition body that IS a javascript-language script.
 * Mirrors the engine: compile with new Function('next','environment', body),
 * plus a static "must call next()" heuristic.
 */
export function checkJavascriptBody(body: string): ConditionIssue | null {
  if (!body.trim()) {
    return { kind: 'empty-body', message: 'condition body is empty' };
  }
  if (!/\bnext\s*\(/.test(body)) {
    return {
      kind: 'no-next',
      message:
        'javascript condition must call next(null, <expr>) — a body without next() hangs the gateway forever',
    };
  }
  try {
    // Compile WITHOUT running — SyntaxError means the engine would throw at runtime
    // eslint-disable-next-line no-new-func
    new Function('next', 'environment', body);
  } catch (e: any) {
    return {
      kind: 'syntax',
      message: `invalid JavaScript: ${e?.message || String(e)}`,
    };
  }
  return null;
}

/**
 * Scan BPMN XML and return every condition expression that the bpmn-engine
 * would mis-evaluate. Empty array = all conditions are save-safe.
 */
export function validateConditionExpressions(bpmnXml: string): ConditionValidationError[] {
  if (!bpmnXml || !bpmnXml.includes('conditionExpression')) return [];

  const errors: ConditionValidationError[] = [];
  FLOW_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = FLOW_RE.exec(bpmnXml)) !== null) {
    const flowAttrs = match[1] || '';
    const inner = match[2] || ''; // undefined for self-closing flows → ''
    const flowId = attr(flowAttrs, 'id') || '(unknown flow)';
    const flowName = attr(flowAttrs, 'name');

    const condMatch = inner.match(COND_RE);
    if (!condMatch) {
      // self-closing <conditionExpression/> → empty body
      if (COND_EMPTY_RE.test(inner.trim())) {
        errors.push({
          flowId,
          flowName,
          message: 'conditionExpression is empty — set a condition via the designer or remove it',
        });
      }
      continue;
    }

    const condAttrs = condMatch[1] || '';
    const language = attr(condAttrs, 'language');
    const body = decodeXmlEntities(condMatch[2] || '').trim();

    if (!JS_LANG_RE.test(language)) {
      errors.push({
        flowId,
        flowName,
        message: !language
          ? 'condition has no language attribute — bpmn-engine treats it as a text template that is ALWAYS true (gateway takes the first branch). Use language="javascript" with a next(null, <expr>) body'
          : `unsupported condition language "${language}" — bpmn-engine only evaluates "javascript". Use next(null, <expr>) bodies`,
      });
      continue;
    }

    const issue = checkJavascriptBody(body);
    if (issue) {
      errors.push({ flowId, flowName, message: issue.message });
    }
  }

  return errors;
}

/** Human-readable one-line summary used in BadRequestException messages. */
export function formatConditionErrors(errors: ConditionValidationError[]): string {
  return errors
    .map((e) => `Flow "${e.flowName || e.flowId}" (${e.flowId}): ${e.message}`)
    .join('\n');
}
