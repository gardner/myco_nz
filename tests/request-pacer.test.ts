import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRequestPacer } from "@/lib/request-pacer";

describe("request pacer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts requests at least one interval apart", async () => {
    const pacer = createRequestPacer(1_000);
    const signal = new AbortController().signal;

    await pacer.wait(signal);
    const next = pacer.wait(signal);
    let started = false;
    void next.then(() => {
      started = true;
    });

    await vi.advanceTimersByTimeAsync(999);
    expect(started).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(next).resolves.toBeUndefined();
  });

  it("drops an aborted waiter so the latest request can use the next slot", async () => {
    const pacer = createRequestPacer(1_000);
    await pacer.wait(new AbortController().signal);
    const obsoleteController = new AbortController();
    const obsolete = pacer.wait(obsoleteController.signal);
    obsoleteController.abort();
    const latest = pacer.wait(new AbortController().signal);

    await expect(obsolete).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(latest).resolves.toBeUndefined();
  });

  it("defers the next request during a rate-limit cooldown", async () => {
    const pacer = createRequestPacer(1_000);
    await pacer.wait(new AbortController().signal);
    pacer.defer(5_000);
    const next = pacer.wait(new AbortController().signal);
    let started = false;
    void next.then(() => {
      started = true;
    });

    await vi.advanceTimersByTimeAsync(4_999);
    expect(started).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(next).resolves.toBeUndefined();
  });
});
