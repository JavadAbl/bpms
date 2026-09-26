/**
 * Schema verification — runnable assertions for every zod schema in the
 * feature slices (run: `bun scripts/verify-schemas.ts` from frontend/).
 *
 * Guards the validation CONTRACTS the forms rely on: required fields, typed
 * garbage rejection (NaN numbers), uniqueness rules and the gateway
 * condition-body checks (partial rows, numeric literals, JS syntax).
 */

import { z } from 'zod';
import { loginSchema } from '../src/features/auth/schemas';
import { createUserSchema } from '../src/features/users/schemas';
import { departmentSchema } from '../src/features/organizations/schemas';
import { categorySchema } from '../src/features/categories/schemas';
import { startProcessSchema } from '../src/features/instances/schemas';
import {
  processDesignSchema,
  formBuilderSchema,
  validateGatewayRows,
} from '../src/features/processes/schemas';
import {
  buildDynamicFormSchema,
  validateDynamicForm,
} from '../src/components/common/dynamic-form';

let passed = 0;
let failed = 0;

function check(label: string, cond: boolean) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`  ✘ FAIL: ${label}`);
  }
}

function issues<T>(schema: z.ZodType<T, any>, value: unknown): Record<string, string> {
  const res = schema.safeParse(value);
  if (res.success) return {};
  const out: Record<string, string> = {};
  for (const issue of res.error.issues) {
    const key = issue.path.map(String).join('.') || '_form';
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/* ============ auth: login ============ */
{
  const e = issues(loginSchema, { username: '  ', password: '' });
  check('login: blank username rejected', e.username === 'نام کاربری الزامی است');
  check('login: empty password rejected', e.password === 'رمز عبور الزامی است');
  const ok = loginSchema.safeParse({ username: ' ali ', password: 'x' });
  check('login: valid passes + username trimmed', ok.success && ok.data!.username === 'ali');
}

/* ============ users: create ============ */
{
  const e = issues(createUserSchema, {
    name: '', username: 'u', email: 'nope', password: '', role: 'USER',
  });
  check('user create: name required', e.name === 'نام الزامی است');
  check('user create: email format enforced', e.email === 'ایمیل نامعتبر است');
  check('user create: password required on create', e.password === 'رمز عبور الزامی است');
}

/* ============ organizations ============ */
{
  const e = issues(departmentSchema, { name: '   ', description: '' });
  check('department: blank name rejected', e.name === 'نام الزامی است');
  check('department: valid passes', departmentSchema.safeParse({ name: 'فناوری', description: '' }).success);
}

/* ============ categories (regression) ============ */
{
  const e = issues(categorySchema, { name: 'نوع مرخصی', key: 'leave type', description: '', items: [] });
  check('category: invalid key rejected', !!e.key);
  const dup = issues(categorySchema, {
    name: 'x', key: 'x', description: '',
    items: [
      { label: 'a', value: 'v' },
      { label: 'b', value: 'v' },
    ],
  });
  check('category: duplicate values flagged on second row', !!dup['items.1.value']);
}

/* ============ instances: start process ============ */
{
  const e = issues(startProcessSchema, { processId: '' });
  check('startProcess: empty selection rejected', e.processId === 'انتخاب فرآیند الزامی است');
  check('startProcess: valid passes', startProcessSchema.safeParse({ processId: 'p1' }).success);
}

/* ============ processes: designer meta form ============ */
{
  const e = issues(processDesignSchema, {
    name: '', description: '', bpmnXml: '', startersRestricted: false, starterIds: [],
  });
  check('design: name required', e.name === 'نام فرآیند الزامی است');
  check('design: diagram required', !!e.bpmnXml);
  const r = issues(processDesignSchema, {
    name: 'حکم کار', description: '', bpmnXml: '<xml/>', startersRestricted: true, starterIds: [],
  });
  check('design: restricted process needs >=1 starter',
    r.starterIds === 'اگر شروع فرآیند محدود است، حداقل یک کاربر را انتخاب کنید');
  check('design: unrestricted passes',
    processDesignSchema.safeParse({
      name: 'x', description: '', bpmnXml: '<xml/>', startersRestricted: false, starterIds: [],
    }).success);
}

/* ============ processes: form builder ============ */
{
  const e = issues(formBuilderSchema, {
    name: '', description: '',
    fields: [{ name: '', label: '', type: 'text', variable: '' }],
  });
  check('builder: form name required', e.name === 'نام فرم الزامی است');
  check('builder: empty label rejected', e['fields.0.label'] === 'برچسب فیلد الزامی است');
  check('builder: empty variable rejected', e['fields.0.variable'] === 'نام متغیر الزامی است');

  // variable falls back to name (same rule as ensureProcessVariables)
  const fb = issues(formBuilderSchema, {
    name: 'فرم', description: '',
    fields: [{ name: 'var_1', label: 'ok', type: 'text', variable: '' }],
  });
  check('builder: variable falls back to field name', !fb['fields.0.variable']);

  const bad = issues(formBuilderSchema, {
    name: 'فرم', description: '',
    fields: [{ name: '1x', label: 'ok', type: 'text', variable: '1x' }],
  });
  check('builder: variable must start with a letter', !!bad['fields.0.variable']);

  const dup = issues(formBuilderSchema, {
    name: 'فرم', description: '',
    fields: [
      { name: 'amount', label: 'مقدار', type: 'number', variable: 'amount' },
      { name: 'amount', label: 'دیگری', type: 'text', variable: 'amount' },
    ],
  });
  check('builder: duplicate variables flagged on the second row', !!dup['fields.1.variable']);

  const ok = formBuilderSchema.safeParse({
    name: '  فرم درخواست  ', description: '',
    fields: [
      { name: 'amount', label: 'مقدار', type: 'number', variable: 'amount', required: true },
      { name: 'note', label: 'یادداشت', type: 'textarea', variable: 'note', defaultValue: 'hi' },
    ],
  });
  check('builder: valid passes, name trimmed, defaultValue kept',
    ok.success && ok.data!.name === 'فرم درخواست' && (ok.data!.fields[1] as any).defaultValue === 'hi');
}

/* ============ processes: gateway condition rows ============ */
{
  const vars = [
    { name: 'amount', label: 'مقدار', type: 'number' },
    { name: 'leaveType', label: 'نوع', type: 'select' },
  ];
  const row = (over: Record<string, unknown>) => ({
    flowId: 'f1', mode: 'simple', variable: '', operator: '==', value: '',
    expression: '', isDefault: false, initialBody: '', rawScript: false,
    ...over,
  });

  // half-filled simple row
  let e = validateGatewayRows([row({ variable: 'leaveType', value: '' }) as any], vars);
  check('gateway: half-filled simple row rejected', e.f1 === 'انتخاب متغیر و مقدار الزامی است');

  // non-numeric value on a number variable
  e = validateGatewayRows([row({ variable: 'amount', value: 'abc' }) as any], vars);
  check('gateway: non-numeric value on number variable rejected', e.f1 === 'مقدار عددی نامعتبر است');

  // broken JS expression
  e = validateGatewayRows([row({ mode: 'expression', expression: 'if (' }) as any], vars);
  check('gateway: invalid JS expression rejected', (e.f1 || '').startsWith('عبارت جاوااسکریپت نامعتبر است'));

  // valid simple + valid expression + default row all pass
  e = validateGatewayRows([
    row({ variable: 'amount', value: '5' }),
    row({ mode: 'expression', expression: 'amount > 10' }),
    row({ isDefault: true }),
  ] as any[], vars);
  check('gateway: valid rows pass untouched', Object.keys(e).length === 0);

  // raw scripts are never rewritten, but ARE still syntax-checked (the
  // original PASS-1 behavior: a broken foreign script must be rejected
  // because it is saved as-is)
  e = validateGatewayRows([row({ rawScript: true, initialBody: 'next(null, amount > 3)' }) as any], vars);
  check('gateway: valid foreign raw script left alone', Object.keys(e).length === 0);
  e = validateGatewayRows([row({ rawScript: true, initialBody: 'weird stuff(((' }) as any], vars);
  check('gateway: broken foreign raw script still rejected', !!e.f1);
}

/* ============ dynamic (definition-driven) forms ============ */
{
  const fields: any[] = [
    { name: 'title', label: 'عنوان', type: 'text', required: true },
    { name: 'amount', label: 'مقدار', type: 'number', required: true },
    { name: 'att', label: 'پیوست', type: 'file', required: true },
    { name: 'prev', label: 'قبلی', type: 'text', required: true, readOnly: true },
  ];
  const e = validateDynamicForm(fields, { title: '', amount: NaN, att: [] });
  check('dynamic: required text empty rejected', !!e.title);
  check('dynamic: NaN number rejected', e.amount === 'مقدار عددی نامعتبر است');
  check('dynamic: empty file array rejected', !!e.att);
  check('dynamic: read-only fields never block', !e.prev);

  const ok = buildDynamicFormSchema(fields).safeParse({
    title: 'x', amount: 3, att: [{ id: 'a', name: 'f.pdf' }], prev: '',
  });
  check('dynamic: valid values pass (all keys kept)', ok.success && (ok.data as any)['title'] === 'x');
}

/* ============ summary ============ */
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
