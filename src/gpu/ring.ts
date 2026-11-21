/** Round-robin pool of slots; a slot is busy from `acquire` until `release`. */
export class SlotRing {
  private readonly busy: boolean[];
  private next = 0;
  readonly size: number;

  constructor(size: number) {
    this.size = size;
    this.busy = new Array<boolean>(size).fill(false);
  }

  acquire(): number | null {
    for (let i = 0; i < this.size; i++) {
      const slot = (this.next + i) % this.size;
      if (!this.busy[slot]) {
        this.busy[slot] = true;
        this.next = (slot + 1) % this.size;
        return slot;
      }
    }
    return null;
  }

  release(slot: number): void {
    this.busy[slot] = false;
  }
}
