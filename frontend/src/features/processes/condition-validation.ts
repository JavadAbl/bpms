/**
 * Frontend mirror of the backend save-time condition validator
 * (mini-services/bpms-backend/src/bpmn/condition-validator.ts). Keep in sync.
 *
 * The designer runs this BEFORE calling the save API so broken gateway
 * conditions are rejected instantly with a Persian toast — the backend runs
 * the same rules as the authoritative gate (defense in depth).
 *
 * Engine facts (bpmn-engine lib/index.cjs):
 *  - only /^(javascript|js)$/i language gets real JS evaluation,
 *  - the body MUST call next(err, result) or the gateway hangs,
 *  - any other shape falls back to the template resolver → always-true →
 *    exclusive gateway always takes the first branch.
 */

export interface ConditionValidationIssue {
  flowId: string;
  flowName: string;
  kind: 'syntax' | 'no-next' | 'unsupported-language' | 'empty-body';
  /** Persian, user-facing message */
  message: string;
}

const FLOW_RE =
  /<(?:bpmn:|bpmn2:)?sequenceFlow\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:bpmn:|bpmn2:)?sequenceFlow>)/g;
const COND_RE =
  /<(?:bpmn:|bpmn2:)?conditionExpression\b([^>]*)>([\s\S]*?)<\/(?:bpmn:|bpmn2:)?conditionExpression>/;
const COND_EMPTY_RE = /<(?:bpmn:|bpmn2:)?conditionExpression\b[^>]*?\/>\s*$/;
const JS_LANG_RE = /^(javascript|js)$/i;

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

function checkJavascriptBody(body: string): ConditionValidationIssue['kind'] | null {
  if (!body.trim()) return 'empty-body';
  if (!/\bnext\s*\(/.test(body)) return 'no-next';
  try {
    // Compile WITHOUT running — SyntaxError means the engine would throw
    // eslint-disable-next-line no-new-func
    new Function('next', 'environment', body);
  } catch {
    return 'syntax';
  }
  return null;
}

const KIND_MESSAGE: Record<ConditionValidationIssue['kind'], (flowName: string) => string> = {
  syntax: (f) => `شرط فلش «${f}» عبارت جاوااسکریپت نامعتبری دارد`,
  'no-next': (f) =>
    `شرط فلش «${f}» باید next(null, …) را فراخوانی کند، در غیر این صورت دروازه متوقف می‌شود`,
  'unsupported-language': (f) =>
    `شرط فلش «${f}» باید با زبان javascript و در قالب next(null, …) نوشته شود (در غیر این صورت موتور همیشه اولین مسیر را انتخاب می‌کند)`,
  'empty-body': (f) => `شرط فلش «${f}» خالی است — شرط را کامل کنید یا حذفش کنید`,
};

/**
 * Scan BPMN XML and return every condition the engine would mis-evaluate.
 * Empty array = safe to save.
 */
export function validateConditionXml(bpmnXml: string): ConditionValidationIssue[] {
  if (!bpmnXml || !bpmnXml.includes('conditionExpression')) return [];

  const issues: ConditionValidationIssue[] = [];
  FLOW_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = FLOW_RE.exec(bpmnXml)) !== null) {
    const flowAttrs = match[1] || '';
    const inner = match[2] || ''; // undefined for self-closing flows → ''
    const flowId = attr(flowAttrs, 'id') || '(unknown)';
    const flowName = attr(flowAttrs, 'name') || flowId;

    const condMatch = inner.match(COND_RE);
    if (!condMatch) {
      if (COND_EMPTY_RE.test(inner.trim())) {
        issues.push({ flowId, flowName, kind: 'empty-body', message: KIND_MESSAGE['empty-body'](flowName) });
      }
      continue;
    }

    const language = attr(condMatch[1] || '', 'language');
    const body = decodeXmlEntities(condMatch[2] || '').trim();

    if (!JS_LANG_RE.test(language)) {
      issues.push({
        flowId,
        flowName,
        kind: 'unsupported-language',
        message: KIND_MESSAGE['unsupported-language'](flowName),
      });
      continue;
    }

    const kind = checkJavascriptBody(body);
    if (kind) {
      issues.push({ flowId, flowName, kind, message: KIND_MESSAGE[kind](flowName) });
    }
  }

  return issues;
}
