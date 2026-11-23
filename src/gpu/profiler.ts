import type { MemoryTracker } from './memory';
import { SlotRing } from './ring';

const MAX_PASSES = 8;
const READBACK_SLOTS = 4;

/** GPU milliseconds per pass label, e.g. `{ sim, shadow, main, tonemap }`. */
export type PassTimings = Readonly<Record<string, number>>;

/** Converts begin/end timestamp pairs (ns) to milliseconds per label. */
export function timestampsToMs(times: BigUint64Array, labels: readonly string[]): PassTimings {
  const out: Record<string, number> = {};
  labels.forEach((label, i) => {
    const begin = times[2 * i] ?? 0n;
    const end = times[2 * i + 1] ?? 0n;
    out[label] = end > begin ? Number(end - begin) / 1e6 : 0;
  });
  return out;
}

/**
 * Per-pass GPU timing via timestamp queries. Results are read back through a ring
 * of mappable buffers, so a frame never waits on a previous frame's readback.
 */
export class GpuProfiler {
  private readonly querySet: GPUQuerySet | null = null;
  private readonly resolveBuffer: GPUBuffer | null = null;
  private readonly readbacks: GPUBuffer[] = [];
  private readonly ring = new SlotRing(READBACK_SLOTS);
  private readonly slotLabels: string[][] = [];
  private frameLabels: string[] = [];
  private pendingSlot: number | null = null;
  private latest: PassTimings | null = null;
  private readonly memory: MemoryTracker;

  constructor(memory: MemoryTracker, enabled: boolean) {
    this.memory = memory;
    if (!enabled) return;
    const bytes = MAX_PASSES * 2 * 8;
    this.querySet = memory.device.createQuerySet({
      label: 'profiler-queries',
      type: 'timestamp',
      count: MAX_PASSES * 2,
    });
    this.resolveBuffer = memory.createBuffer({
      label: 'profiler-resolve',
      size: bytes,
      usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
    });
    for (let i = 0; i < READBACK_SLOTS; i++) {
      this.readbacks.push(
        memory.createBuffer({
          label: 'profiler-readback',
          size: bytes,
          usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        }),
      );
    }
  }

  get supported(): boolean {
    return this.querySet !== null;
  }

  beginFrame(): void {
    this.frameLabels = [];
    this.pendingSlot = null;
  }

  /** Spread into a pass descriptor; `undefined` when timing is unavailable. */
  timestampWrites(label: string): GPURenderPassTimestampWrites | undefined {
    if (!this.querySet || this.frameLabels.length >= MAX_PASSES) return undefined;
    const index = this.frameLabels.push(label) - 1;
    return {
      querySet: this.querySet,
      beginningOfPassWriteIndex: index * 2,
      endOfPassWriteIndex: index * 2 + 1,
    };
  }

  /** Call before `encoder.finish()`. */
  endFrame(encoder: GPUCommandEncoder): void {
    if (!this.querySet || !this.resolveBuffer || this.frameLabels.length === 0) return;
    const slot = this.ring.acquire();
    const readback = slot === null ? undefined : this.readbacks.at(slot);
    if (slot === null || !readback) return;
    const count = this.frameLabels.length * 2;
    encoder.resolveQuerySet(this.querySet, 0, count, this.resolveBuffer, 0);
    encoder.copyBufferToBuffer(this.resolveBuffer, 0, readback, 0, count * 8);
    this.slotLabels[slot] = this.frameLabels;
    this.pendingSlot = slot;
  }

  /** Call after `queue.submit()`. */
  afterSubmit(): void {
    const slot = this.pendingSlot;
    if (slot === null) return;
    const readback = this.readbacks.at(slot);
    const labels = this.slotLabels.at(slot) ?? [];
    if (!readback) return;
    readback
      .mapAsync(GPUMapMode.READ, 0, labels.length * 16)
      .then(() => {
        this.latest = timestampsToMs(
          new BigUint64Array(readback.getMappedRange(0, labels.length * 16)),
          labels,
        );
        readback.unmap();
      })
      .catch(() => {
        // Mapping fails only when the device is lost or the buffer destroyed.
      })
      .finally(() => {
        this.ring.release(slot);
      });
  }

  /** Most recent per-pass timings in ms, or `null` when timestamps are unsupported. */
  results(): PassTimings | null {
    return this.latest;
  }

  destroy(): void {
    this.querySet?.destroy();
    if (this.resolveBuffer) this.memory.destroy(this.resolveBuffer);
    for (const buffer of this.readbacks) this.memory.destroy(buffer);
  }
}
