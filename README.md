# Open World Sandbox

Real-time physics simulations in raw WebGPU, inspired by open-world games. Every simulation runs
on the GPU inside a shared default scene: an analytic golden-hour sky, an infinite ground grid, a
sun with soft shadows, HDR rendering with AgX tone mapping, orbit controls, auto-generated
parameter controls and a performance overlay.

This repository accompanies a blog series: _link coming soon_.

<!-- TODO: link the series once the first post is published. -->

## Running locally

Requires Node 24 (see `.nvmrc`) and a WebGPU-capable browser.

```sh
nvm use
npm install
npm run dev
```

Open the printed URL. Drag to orbit, right-drag (or shift-drag, or two fingers) to pan, and
scroll or pinch to zoom. Press <kbd>`</kbd> to toggle the performance overlay.

| Script              | What it does                                                          |
| ------------------- | --------------------------------------------------------------------- |
| `npm run dev`       | Vite dev server                                                       |
| `npm run build`     | Type-check and build to `dist/` (served under `/open-world-sandbox/`) |
| `npm run preview`   | Serve the production build locally                                    |
| `npm run check`     | Type-check, lint, format check, tests and boundary rules              |
| `npm run depcruise` | Module boundary rules only                                            |

## Sharing a simulation

The URL describes what you're looking at:

```
#/<simId>?perf=1&p=<params>
```

`p` is base64url-encoded JSON holding only the parameters that differ from their defaults. Copy
the URL to share a sim with the same parameters and overlay state. Invalid values fall back to the
defaults.

## Adding a simulation

1. **Schema:** add `src/schema/sims/<name>.ts` with each parameter's default, range and label
   (`.meta({ label, step })`), and register it in `src/schema/sims/index.ts`.
2. **Simulation:** add `src/sims/<name>/` implementing `Simulation` from `src/engine`. Put the
   WGSL next to the TypeScript that uses it, and import it with `?raw`. `step(dt, pass)` records
   compute work into the engine's `sim` pass. `renderables()` returns what to draw, ideally
   straight from your storage buffers.
3. **Registry:** add one line to `src/app/registry.ts`. TypeScript reports an error until you do.
4. **New visuals:** if the sim needs something new to draw (water, particles, debug lines), add a
   feature or material to `src/renderer/` first. Sims never create render passes.

The controls panel is generated from the schema, so a new sim needs no UI code.

## Architecture

```
src/
  schema/    zod schemas: the only place zod is imported
  gpu/       device, canvas sizing, buffers, shaders, memory tracking, GPU profiler
  renderer/  frame orchestration and every render pass (shadow → main HDR → tone map)
  physics/   reusable solvers (empty for now)
  assets/    asset loading (empty for now)
  engine/    frame loop, fixed timestep, sim lifecycle, orbit controls, stores, metrics
  sims/      one folder per simulation
  ui/        React: panel, schema-driven controls, transport, performance overlay
  app/       composition root: startup, registry, URL routing
```

Each layer exposes its public API through `index.ts`. dependency-cruiser enforces which layers
may import which (see `.dependency-cruiser.cjs`), and CI fails on any violation.

Conventions:

- SI units throughout.
- Right-handed coordinates with y up; the ground is the y = 0 plane.
- Reversed-Z depth.
- All lighting is computed in linear HDR, and sRGB encoding happens once, in the tone-map pass.

## Browser support

Recent desktop Chrome and Edge are the primary targets. Other browsers with WebGPU are
best-effort. Browsers without WebGPU get an explanatory screen.

GPU pass timings in the overlay need the `timestamp-query` feature. Browsers may coarsen these
timings unless WebGPU developer features are enabled (`chrome://flags/#enable-webgpu-developer-features`).

## Deployment

`.github/workflows/deploy.yml` runs `npm ci`, `npm run check` and `npm run build` on every push
and pull request, and deploys `dist/` to GitHub Pages on pushes to `main`. For deploys to work,
set the repository's Pages source to **GitHub Actions** (Settings → Pages → Build and
deployment).
