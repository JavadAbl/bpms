#!/usr/bin/env node
/**
 * UI Redesign Phase 1 — hardcoded Tailwind palette classes → MD3 semantic tokens.
 * Mechanical, boundary-safe replacement. src/components/ui is excluded (hand-restyled).
 * bpmn-designer.tsx gets an extra mapping: palette type-dots use chart tokens
 * so the 5 element types stay visually distinct in both themes.
 */
const fs = require('fs');
const path = require('path');

const ROOT = '/home/z/my-project';

const MAPPINGS = [
  // ---- emerald brand → primary ----
  ['hover:bg-emerald-700', 'hover:bg-primary/90'],
  ['hover:bg-emerald-600', 'hover:bg-primary/90'],
  ['hover:border-emerald-300', 'hover:border-primary/50'],
  ['bg-emerald-600', 'bg-primary'],
  ['bg-emerald-500', 'bg-primary'],
  ['bg-emerald-100', 'bg-primary-container'],
  ['text-emerald-800', 'text-on-primary-container'],
  ['text-emerald-900', 'text-on-primary-container'],
  ['hover:bg-emerald-50', 'hover:bg-primary/10'],
  ['bg-emerald-50', 'bg-primary/10'],
  ['text-emerald-600', 'text-primary'],
  ['text-emerald-700', 'text-primary'],
  ['border-emerald-400', 'border-primary/40'],
  ['border-emerald-200', 'border-primary/30'],
  ['ring-emerald-500', 'ring-primary'],
  // ---- red → destructive ----
  ['hover:bg-red-50', 'hover:bg-destructive/10'],
  ['hover:bg-red-100', 'hover:bg-destructive/15'],
  ['hover:text-red-600', 'hover:text-destructive'],
  ['hover:bg-red-700', 'hover:bg-destructive/90'],
  ['bg-red-600', 'bg-destructive'],
  ['hover:border-red-200', 'hover:border-destructive/40'],
  ['bg-red-100', 'bg-destructive/15'],
  ['bg-red-50', 'bg-destructive/10'],
  ['border-red-200', 'border-destructive/30'],
  ['border-red-300', 'border-destructive/40'],
  ['text-red-800', 'text-destructive'],
  ['text-red-700', 'text-destructive'],
  ['text-red-600', 'text-destructive'],
  ['text-red-500', 'text-destructive'],
  ['text-red-400', 'text-destructive/80'],
  // ---- green → success ----
  ['hover:bg-green-700', 'hover:bg-success/90'],
  ['bg-green-600', 'bg-success'],
  ['bg-green-100', 'bg-success/15'],
  ['bg-green-50', 'bg-success/10'],
  ['border-green-200', 'border-success/30'],
  ['text-green-800', 'text-success'],
  ['text-green-700', 'text-success'],
  ['text-green-600', 'text-success'],
  // ---- amber/orange/yellow → warning ----
  ['bg-amber-100', 'bg-warning/15'],
  ['bg-amber-50', 'bg-warning/10'],
  ['border-amber-200', 'border-warning/30'],
  ['text-amber-800', 'text-warning'],
  ['text-amber-700', 'text-warning'],
  ['text-amber-600', 'text-warning'],
  ['bg-orange-100', 'bg-warning/15'],
  ['bg-orange-50', 'bg-warning/10'],
  ['text-orange-800', 'text-warning'],
  ['text-orange-700', 'text-warning'],
  ['text-orange-600', 'text-warning'],
  ['bg-yellow-100', 'bg-warning/12'],
  ['text-yellow-800', 'text-warning'],
  // ---- blue → primary (info) ----
  ['bg-blue-100', 'bg-primary/15'],
  ['bg-blue-50', 'bg-primary/10'],
  ['border-blue-200', 'border-primary/30'],
  ['text-blue-800', 'text-primary'],
  ['text-blue-700', 'text-primary'],
  ['text-blue-600', 'text-primary'],
  ['bg-blue-600', 'bg-primary'],
  // ---- purple/violet/teal/cyan → primary family / success ----
  ['bg-purple-100', 'bg-primary-container'],
  ['text-purple-800', 'text-on-primary-container'],
  ['text-purple-600', 'text-primary'],
  ['bg-violet-100', 'bg-primary-container'],
  ['text-violet-700', 'text-primary'],
  ['text-violet-600', 'text-primary'],
  ['text-teal-600', 'text-success'],
  ['text-cyan-600', 'text-primary'],
  ['text-pink-600', 'text-destructive'],
  ['bg-pink-100', 'bg-destructive/10'],
  // ---- gray neutrals → semantic tokens ----
  ['hover:bg-gray-100', 'hover:bg-accent'],
  ['hover:bg-gray-50', 'hover:bg-accent/60'],
  ['hover:border-gray-200', 'hover:border-border'],
  ['hover:text-gray-900', 'hover:text-foreground'],
  ['hover:text-gray-700', 'hover:text-foreground'],
  ['text-gray-900', 'text-foreground'],
  ['text-gray-800', 'text-foreground'],
  ['text-gray-700', 'text-foreground'],
  ['text-gray-600', 'text-muted-foreground'],
  ['text-gray-500', 'text-muted-foreground'],
  ['text-gray-400', 'text-muted-foreground/80'],
  ['text-gray-300', 'text-muted-foreground/60'],
  ['text-gray-200', 'text-muted-foreground/50'],
  ['border-gray-300', 'border-border'],
  ['border-gray-200', 'border-border'],
  ['border-gray-100', 'border-border/70'],
  ['border-gray-50', 'border-border/50'],
  ['bg-gray-200', 'bg-muted'],
  ['bg-gray-300', 'bg-border'],
  ['bg-gray-100', 'bg-muted'],
  ['bg-gray-50', 'bg-muted/50'],
  ['hover:bg-white', 'hover:bg-card'],
  ['bg-white', 'bg-card'],
  ['ring-gray-300', 'ring-border'],
  ['divide-gray-200', 'divide-border'],
  ['divide-gray-100', 'divide-border/70'],
  // ---- edge leftovers (second codemod pass) ----
  ['text-amber-500', 'text-warning'],
  ['text-yellow-500', 'text-warning'],
  ['border-emerald-600', 'border-primary'],
  ['border-emerald-500', 'border-primary'],
  ['text-purple-700', 'text-on-primary-container'],
  ['bg-teal-100', 'bg-success/15'],
  ['bg-gray-900', 'bg-foreground'],
  ['text-gray-100', 'text-background'],
];

const BPMN_DOT_MAPPINGS = [
  ['bg-green-500', 'bg-chart-2'],
  ['bg-blue-500', 'bg-chart-1'],
  ['bg-purple-500', 'bg-chart-4'],
  ['bg-orange-500', 'bg-chart-3'],
  ['bg-yellow-500', 'bg-chart-3'],
  ['bg-red-500', 'bg-chart-5'],
];

function tokenRegex(token) {
  // boundary: not preceded by [-\w], not followed by [\w-]
  return new RegExp(`(?<![\\w-])${token.replace(/-/g, '\\-')}(?![\\w-])`, 'g');
}

function processFile(filePath, extraMappings = []) {
  let src = fs.readFileSync(filePath, 'utf8');
  const before = src;
  let count = 0;
  for (const [from, to] of [...extraMappings, ...MAPPINGS]) {
    const re = tokenRegex(from);
    const matches = src.match(re);
    if (matches) {
      count += matches.length;
      src = src.replace(re, to);
    }
  }
  if (src !== before) {
    fs.writeFileSync(filePath, src);
  }
  return count;
}

const targets = [];
for (const dir of ['src/components/views', 'src/components/common', 'src/components/forms', 'src/components/processes']) {
  for (const f of fs.readdirSync(path.join(ROOT, dir))) {
    if (f.endsWith('.tsx')) targets.push(path.join(ROOT, dir, f));
  }
}
targets.push(path.join(ROOT, 'src/components/app-shell.tsx'));
targets.push(path.join(ROOT, 'src/components/bpmn/bpmn-designer.tsx'));

let total = 0;
for (const f of targets) {
  const isBpmn = f.endsWith('bpmn-designer.tsx');
  const n = processFile(f, isBpmn ? BPMN_DOT_MAPPINGS : []);
  if (n > 0) console.log(`${String(n).padStart(3)}  ${path.relative(ROOT, f)}`);
  total += n;
}
console.log(`\nTotal replacements: ${total} across ${targets.length} files`);
