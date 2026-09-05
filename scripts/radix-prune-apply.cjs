/**
 * Radix + orphan dep prune (Phase 7 optional cleanup).
 * Deletes dead ui wrapper files and removes their now-zero-import deps
 * from package.json. Based on scripts/radix-prune-analysis.cjs output.
 */
const fs = require('fs');
const path = require('path');

const ROOT = '/home/z/my-project';

const deadWrappers = [
  'accordion', 'alert', 'aspect-ratio', 'calendar', 'carousel', 'chart',
  'collapsible', 'context-menu', 'drawer', 'form', 'hover-card', 'input-otp',
  'menubar', 'navigation-menu', 'pagination', 'popover', 'progress',
  'radio-group', 'resizable', 'scroll-area', 'sidebar', 'slider', 'sonner',
  'switch', 'table', 'tabs', 'toggle-group', 'toggle',
];

const depsToRemove = [
  // radix (only importers were dead wrappers)
  '@radix-ui/react-accordion',
  '@radix-ui/react-aspect-ratio',
  '@radix-ui/react-collapsible',
  '@radix-ui/react-context-menu',
  '@radix-ui/react-hover-card',
  '@radix-ui/react-menubar',
  '@radix-ui/react-navigation-menu',
  '@radix-ui/react-popover',
  '@radix-ui/react-progress',
  '@radix-ui/react-radio-group',
  '@radix-ui/react-scroll-area',
  '@radix-ui/react-slider',
  '@radix-ui/react-switch',
  '@radix-ui/react-tabs',
  '@radix-ui/react-toggle',
  '@radix-ui/react-toggle-group',
  // non-radix libs whose only importer was a deleted wrapper
  'embla-carousel-react',
  'input-otp',
  'react-day-picker',
  'react-hook-form',
  'react-resizable-panels',
  'sonner',
  'vaul',
];

// 1. delete dead wrappers
let deleted = 0;
for (const name of deadWrappers) {
  const p = path.join(ROOT, 'src', 'components', 'ui', `${name}.tsx`);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    deleted++;
  } else {
    console.warn('MISSING (skip):', name);
  }
}
console.log(`deleted ${deleted} wrapper files`);

// 2. strip deps from package.json
const pkgPath = path.join(ROOT, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
let removed = [];
for (const dep of depsToRemove) {
  if (pkg.dependencies && pkg.dependencies[dep]) {
    delete pkg.dependencies[dep];
    removed.push(dep);
  } else {
    console.warn('not in dependencies (skip):', dep);
  }
}
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`removed ${removed.length} deps from package.json`);

// 3. verify none of the removed deps are still imported in src
const { execSync } = require('child_process');
let leaks = [];
for (const dep of depsToRemove) {
  try {
    const out = execSync(
      `rg -l "${dep.replace(/[/@]/g, (c) => '\\' + c)}" /home/z/my-project/src`,
      { encoding: 'utf8' },
    );
    if (out.trim()) leaks.push({ dep, files: out.trim().split('\n') });
  } catch {
    /* rg exits 1 on no matches -> good */
  }
}
if (leaks.length) {
  console.error('LEAKS — deps still imported:');
  for (const l of leaks) console.error(l.dep, l.files);
  process.exit(1);
}
console.log('no imports remain for any removed dep ✓');
