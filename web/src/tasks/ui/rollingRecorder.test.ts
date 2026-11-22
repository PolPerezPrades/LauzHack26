import { describe, expect, it } from "vitest";
import { RollingRecorder, type Clock, type RecorderLike } from "./rollingRecorder";

/** A fake clock with manual time and timers. */
function fakeClock() {
  let t = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const clock: Clock = {
    now: () => t,
    setTimeout: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { at: t + ms, fn });
      return id;
    },
    clearTimeout: (id) => void timers.delete(id as number),
  };
  const advance = (to: number) => {
    for (;;) {
      const due = [...timers.entries()].filter(([, x]) => x.at <= to).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      t = due[1].at;
      due[1].fn();
    }
    t = to;
  };
  return { clock, advance, pending: () => timers.size };
}

/** A fake recorder whose single blob says when it started, so tests can tell runs apart. */
function fakeRecorders(clock: Clock) {
  const all: (RecorderLike & { startedAt: number })[] = [];
  const make = () => {
    const r = {
      state: "inactive" as RecorderLike["state"],
      ondataavailable: null as RecorderLike["ondataavailable"],
      onstop: null as RecorderLike["onstop"],
      startedAt: -1,
      start() {
        r.state = "recording";
        r.startedAt = clock.now();
      },
      stop() {
        if (r.state === "inactive") return;
        r.state = "inactive";
        // like MediaRecorder: the data, then the stop event, after the call returns
        queueMicrotask(() => {
          r.ondataavailable?.({ data: new Blob([`from ${r.startedAt}`]) });
          r.onstop?.();
        });
      },
    };
    all.push(r);
    return r;
  };
  return { make, all };
}

async function textOf(blob: Blob) {
  return await blob.text();
}

describe("RollingRecorder", () => {
  it("keeps only the longer of the two running clips: the last half to whole segment", async () => {
    const { clock, advance } = fakeClock();
    const { make, all } = fakeRecorders(clock);
    const rec = new RollingRecorder(make, 5000, clock);
    rec.start();
    advance(7000); // run A restarted at 5000; run B started at 2500
    const clip = await rec.finish();
    expect(clip?.ms).toBe(4500);
    expect(await textOf(clip!.blob)).toBe("from 2500");
    expect(all.every((r) => r.state === "inactive")).toBe(true);
  });

  it("uses the only clip there is early on, and the restarted run once it is the longer one", async () => {
    const early = fakeClock();
    const a = new RollingRecorder(fakeRecorders(early.clock).make, 5000, early.clock);
    a.start();
    early.advance(1200);
    expect(await textOf((await a.finish())!.blob)).toBe("from 0");

    const later = fakeClock();
    const b = new RollingRecorder(fakeRecorders(later.clock).make, 5000, later.clock);
    b.start();
    later.advance(10_700); // A restarted at 10000 (0.7 s), B at 7500 (3.2 s)
    const clip = await b.finish();
    expect(clip?.ms).toBe(3200);
    expect(await textOf(clip!.blob)).toBe("from 7500");
  });

  it("drops everything on dispose, even a clip that is being finalised", async () => {
    const { clock, advance, pending } = fakeClock();
    const { make, all } = fakeRecorders(clock);
    const rec = new RollingRecorder(make, 5000, clock);
    rec.start();
    advance(3000);
    const finishing = rec.finish();
    rec.dispose();
    expect(await finishing).toBeNull();
    expect(pending()).toBe(0);
    expect(all.every((r) => r.state === "inactive")).toBe(true);

    const other = fakeClock();
    const idle = new RollingRecorder(fakeRecorders(other.clock).make, 5000, other.clock);
    idle.start();
    idle.dispose();
    other.advance(20_000); // no restart after dispose
    expect(await idle.finish()).toBeNull();
  });
});
