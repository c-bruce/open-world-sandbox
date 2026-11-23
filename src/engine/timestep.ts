/** Real frame time is clamped to this so a backgrounded tab doesn't trigger a burst of steps. */
export const MAX_FRAME_SECONDS = 0.25;
/** Upper bound on fixed steps per frame; any further backlog is dropped. */
export const MAX_STEPS_PER_FRAME = 8;

/** The subset of `AppParams` the timestep reads. */
export interface TimestepSettings {
  fixedTimestep: number;
  substeps: number;
  timeScale: number;
  paused: boolean;
}

/** What to run this frame: `substeps` calls to `sim.step(substepDt, pass)`. */
export interface StepPlan {
  fixedSteps: number;
  substeps: number;
  /** Seconds per substep. */
  substepDt: number;
  /** Simulated seconds this frame. */
  simSeconds: number;
}

/** Fixed-timestep accumulator with pause, single-step and time scale. */
export class FixedTimestep {
  private accumulator = 0;
  private stepRequested = false;

  requestStep(): void {
    this.stepRequested = true;
  }

  reset(): void {
    this.accumulator = 0;
    this.stepRequested = false;
  }

  advance(realSeconds: number, settings: TimestepSettings): StepPlan {
    const { fixedTimestep, substeps } = settings;
    let fixedSteps: number;
    if (settings.paused) {
      fixedSteps = this.stepRequested ? 1 : 0;
      this.accumulator = 0;
    } else {
      const clamped = Math.min(Math.max(realSeconds, 0), MAX_FRAME_SECONDS);
      this.accumulator += clamped * settings.timeScale;
      fixedSteps = Math.floor(this.accumulator / fixedTimestep);
      this.accumulator -= fixedSteps * fixedTimestep;
      if (fixedSteps > MAX_STEPS_PER_FRAME) {
        fixedSteps = MAX_STEPS_PER_FRAME;
        this.accumulator = 0;
      }
    }
    this.stepRequested = false;
    return {
      fixedSteps,
      substeps: fixedSteps * substeps,
      substepDt: fixedTimestep / substeps,
      simSeconds: fixedSteps * fixedTimestep,
    };
  }
}
