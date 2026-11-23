struct Params {
  gravity: f32,
  restitution: f32,
  drag: f32,
  dt: f32,
  radius: f32,
  count: u32,
}

@group(0) @binding(0) var<storage, read_write> posRadius: array<vec4f>;
@group(0) @binding(1) var<storage, read_write> velocity: array<vec4f>;
@group(0) @binding(2) var<uniform> params: Params;

// Impacts slower than this stop dead instead of bouncing, so a resting ball doesn't jitter.
const REST_SPEED = 0.05;

@compute @workgroup_size(64)
fn step(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= params.count) {
    return;
  }
  let r = params.radius;
  let dt = params.dt;
  var p = posRadius[i].xyz;
  var v = velocity[i].xyz;

  // Semi-implicit Euler: update velocity (gravity, exact linear drag), then position.
  v.y -= params.gravity * dt;
  v *= exp(-params.drag * dt);
  p += v * dt;

  if (p.y < r) {
    p.y = r;
    if (v.y < 0.0) {
      let impact = -v.y;
      let restThreshold = max(REST_SPEED, 2.0 * params.gravity * dt);
      v.y = select(impact * params.restitution, 0.0, impact < restThreshold);
    }
  }

  posRadius[i] = vec4f(p, r);
  velocity[i] = vec4f(v, 0.0);
}

// Applies the current radius and ground constraint without advancing time (for param edits while paused).
@compute @workgroup_size(64)
fn project(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= params.count) {
    return;
  }
  let r = params.radius;
  let p = posRadius[i].xyz;
  posRadius[i] = vec4f(p.x, max(p.y, r), p.z, r);
}
