// Layer → layers it may import (besides itself). `app` may import anything.
const layers = {
  schema: [],
  gpu: ['schema'],
  assets: ['schema'],
  renderer: ['gpu', 'schema'],
  physics: ['gpu', 'schema'],
  engine: ['renderer', 'gpu', 'schema'],
  sims: ['engine', 'physics', 'renderer', 'gpu', 'assets', 'schema'],
  ui: ['engine', 'schema'],
};

const layerRules = Object.entries(layers).map(([layer, allowed]) => ({
  name: `layer-${layer}`,
  comment: `${layer}/ may only import: ${allowed.join(', ') || '(nothing but zod)'}`,
  severity: 'error',
  from: { path: `^src/${layer}/` },
  to: { path: '^src/[^/]+/', pathNot: `^src/(${[layer, ...allowed].join('|')})/` },
}));

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    ...layerRules,
    {
      name: 'zod-only-in-schema',
      comment: 'zod is consumed only inside src/schema/',
      severity: 'error',
      from: { pathNot: '^src/schema/' },
      to: { path: '(^|/)node_modules/zod/' },
    },
    {
      name: 'schema-public-api-only',
      comment: 'Outside schema/, import only schema/index.ts',
      severity: 'error',
      from: { pathNot: '^src/schema/' },
      to: { path: '^src/schema/', pathNot: '^src/schema/index\\.ts$' },
    },
    {
      name: 'layer-public-api-only',
      comment: 'Cross-layer imports go through the layer index.ts (or a sim folder index.ts)',
      severity: 'error',
      from: { path: '^src/([^/]+)/' },
      to: {
        path: '^src/[^/]+/',
        pathNot: ['^src/$1/', '^src/[^/]+/index\\.ts$', '^src/sims/[^/]+/index\\.ts$'],
      },
    },
    {
      name: 'no-cross-sim',
      comment: 'sims/<a>/ never imports sims/<b>/',
      severity: 'error',
      from: { path: '^src/sims/([^/]+)/' },
      to: { path: '^src/sims/[^/]+/', pathNot: '^src/sims/$1/' },
    },
    {
      name: 'react-only-in-ui',
      comment: 'react / react-dom only in ui/ and app/',
      severity: 'error',
      from: { pathNot: '^src/(ui|app)/' },
      to: { path: '(^|/)node_modules/(react|react-dom)/' },
    },
    {
      name: 'app-is-root',
      comment: 'Nothing imports app/',
      severity: 'error',
      from: { pathNot: '^src/app/' },
      to: { path: '^src/app/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-undeclared',
      comment: 'No imports of packages missing from package.json',
      severity: 'error',
      from: {},
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true, pathNot: '\\?raw$' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.app.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
