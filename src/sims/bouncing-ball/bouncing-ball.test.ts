import { describe, expect, it } from 'vitest';
import { defaultSimParams } from '../../schema';
import { bouncingBallBounds } from './bouncing-ball';

describe('bouncingBallBounds', () => {
  const defaults = defaultSimParams('bouncing-ball');

  it('covers the drop height and drag-limited travel', () => {
    const b = bouncingBallBounds({
      ...defaults,
      radius: 0.5,
      dropHeight: 5,
      drag: 0.5,
      initialVelocityX: 2,
    });
    expect(b.min).toEqual([-0.5, 0, -0.5]);
    expect(b.max).toEqual([4.5, 5.5, 0.5]);
  });

  it('extends in the direction of travel and caps it without drag', () => {
    const b = bouncingBallBounds({ ...defaults, drag: 0, initialVelocityX: -1 });
    expect(b.min[0]).toBe(-50 - defaults.radius);
    expect(b.max[0]).toBe(defaults.radius);
  });

  it('starts no lower than the radius', () => {
    const b = bouncingBallBounds({ ...defaults, radius: 2, dropHeight: 1 });
    expect(b.max[1]).toBe(4);
  });
});
