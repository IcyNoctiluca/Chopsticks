export class Outbox {
  private pending: string[] = [];
  private transmit: ((payload: string) => void) | null = null;

  setTransmitter(transmit: ((payload: string) => void) | null): void {
    this.transmit = transmit;
  }

  send(payload: string): void {
    if (this.transmit) {
      this.transmit(payload);
    } else {
      this.pending.push(payload);
    }
  }

  flush(): void {
    const pending = this.pending;
    this.pending = [];
    for (const payload of pending) {
      this.transmit?.(payload);
    }
  }
}
