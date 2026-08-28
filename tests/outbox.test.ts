import { describe, it, expect } from "vitest";
import { Outbox } from "../web/outbox.js";

describe("Outbox", () => {
  it("queues messages sent before a transmitter is set", () => {
    const outbox = new Outbox();
    const sent: string[] = [];
    outbox.send("a");
    outbox.send("b");
    expect(sent).toEqual([]);

    outbox.setTransmitter((p) => sent.push(p));
    outbox.flush();
    expect(sent).toEqual(["a", "b"]);
  });

  it("transmits immediately once a transmitter is set", () => {
    const outbox = new Outbox();
    const sent: string[] = [];
    outbox.setTransmitter((p) => sent.push(p));
    outbox.send("c");
    expect(sent).toEqual(["c"]);
  });

  it("preserves ordering across a reconnect", () => {
    const outbox = new Outbox();
    const sent: string[] = [];
    outbox.setTransmitter((p) => sent.push(p));
    outbox.send("first");
    outbox.setTransmitter(null);
    outbox.send("queued");
    outbox.setTransmitter((p) => sent.push(p));
    outbox.flush();
    expect(sent).toEqual(["first", "queued"]);
  });

  it("flushes pending only once", () => {
    const outbox = new Outbox();
    const sent: string[] = [];
    outbox.send("only-once");
    outbox.setTransmitter((p) => sent.push(p));
    outbox.flush();
    outbox.flush();
    expect(sent).toEqual(["only-once"]);
  });
});
