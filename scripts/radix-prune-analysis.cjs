/**
 * Radix prune analysis (UI redesign Phase 7, optional cleanup).
 * Builds the src/ import graph, computes reachability from all non-ui
 * entry files, and reports:
 *  - ui wrappers that are never reachable (dead scaffold files)
 *  - @radix-ui/* deps whose ONLY importers are dead wrappers (prunable)
 * Read-only: prints a report, changes nothing.
 */
const fs = require('fs');
const path = require('path');

const ROOT = '/home/z/my-project';
const SRC = path.join(ROOT, 'src');
const UI_DIR = path.join(SRC, 'components', 'ui');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = walk(SRC);
const fileSet = new Set(files);

const importRegex =
  /(?:import\s+[^'"()]*?from\s*|import\s*\(\s*|require\(\s*|export\s+[^'"()]*?from\s*)['"]([^'"]+)['"]/g;

function resolveAlias(spec) {
  // '@/components/ui/button' -> SRC/components/ui/button.{tsx,ts,jsx,js}
  const base = path.join(SRC, spec.replace(/^@\//, ''));
  for (const ext of ['.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts']) {
    const cand = base.endsWith(ext) ? base : base + ext;
    if (fileSet.has(cand)) return cand;
  }
  return null;
}

function resolveRelative(spec, fromFile) {
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const ext of ['.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts']) {
    const cand = base.endsWith(ext) ? base : base + ext;
    if (fileSet.has(cand)) return cand;
  }
  return null;
}

const graph = new Map(); // file -> { fileDeps: Set, pkgDeps: Set }
for (const f of files) {
  const code = fs.readFileSync(f, 'utf8');
  const fileDeps = new Set();
  const pkgDeps = new Set();
  let m;
  while ((m = importRegex.exec(code))) {
    const spec = m[1];
    if (spec.startsWith('@/')) {
      const r = resolveAlias(spec);
      if (r) fileDeps.add(r);
      else pkgDeps.add(spec);
    } else if (spec.startsWith('.')) {
      const r = resolveRelative(spec, f);
      if (r) fileDeps.add(r);
      else pkgDeps.add(spec);
    } else {
      pkgDeps.add(spec);
    }
  }
  graph.set(f, { fileDeps, pkgDeps });
}

// Roots: every source file NOT inside src/components/ui
const roots = files.filter((f) => !f.startsWith(UI_DIR + path.sep));

// BFS reachability
const reached = new Set();
const queue = [...roots];
while (queue.length) {
  const f = queue.pop();
  if (reached.has(f)) continue;
  reached.add(f);
  const { fileDeps } = graph.get(f);
  for (const d of fileDeps) if (!reached.has(d)) queue.push(d);
}

// Reachable packages (imported by any reached file)
const reachedPkgs = new Set();
for (const f of reached) for (const p of graph.get(f).pkgDeps) reachedPkgs.add(p);

// ui wrappers not reachable
const uiFiles = files.filter((f) => f.startsWith(UI_DIR + path.sep));
const deadWrappers = uiFiles.filter((f) => !reached.has(f));

// radix deps in package.json
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const radixDeps = Object.keys(pkg.dependencies || {}).filter((d) =>
  d.startsWith('@radix-ui/'),
);

// importers of each radix dep across ALL src files
const importersOf = {};
for (const f of files) {
  for (const p of graph.get(f).pkgDeps) {
    (importersOf[p] ||= []).push(f);
  }
}

const prunable = [];
const keep = [];
for (const dep of radixDeps) {
  const imps = importersOf[dep] || [];
  const aliveImps = imps.filter((f) => reached.has(f));
  if (imps.length === 0) prunable.push({ dep, reason: 'zero imports anywhere' });
  else if (aliveImps.length === 0)
    prunable.push({
      dep,
      reason: 'only imported by dead wrappers: ' + imps.map((f) => path.basename(f)).join(', '),
    });
  else keep.push({ dep, via: aliveImps.length + ' live importers' });
}

console.log('=== RADIX PRUNE ANALYSIS (Phase 7) ===');
console.log(`src files: ${files.length} | roots (non-ui): ${roots.length} | reached: ${reached.size}`);
console.log(`\n--- Dead ui wrappers (${deadWrappers.length}) ---`);
for (const f of deadWrappers) console.log('  ' + path.relative(ROOT, f));
console.log(`\n--- Prunable radix deps (${prunable.length}) ---`);
for (const p of prunable) console.log(`  ${p.dep}  [${p.reason}]`);
console.log(`\n--- Keep (${keep.length}) ---`);
for (const k of keep) console.log(`  ${k.dep}  (${k.via})`);
console.log('\n--- sanity: non-radix packages imported ONLY by dead wrappers ---');
const allPkgs = new Set();
for (const f of files) for (const p of graph.get(f).pkgDeps) allPkgs.add(p);
for (const p of [...allPkgs].sort()) {
  if (p.startsWith('@radix-ui/') || p.startsWith('@/') || p.startsWith('.')) continue;
  const imps = (importersOf[p] || []).filter((f) => reached.has(f));
  if (imps.length === 0) console.log(`  ${p}  (importers: ${(importersOf[p] || []).map((f) => path.basename(f)).join(', ') || 'none'})`);
}
