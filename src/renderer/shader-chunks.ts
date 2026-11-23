import atmosphere from './atmosphere.wgsl?raw';
import frame from './frame.wgsl?raw';
import fullscreen from './fullscreen.wgsl?raw';
import lighting from './lighting.wgsl?raw';

/** WGSL has no includes; features prepend the chunks they need. */
export const wgsl = {
  frame,
  atmosphere,
  lighting: atmosphere + lighting,
  fullscreen,
};
