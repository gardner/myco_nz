export type RequestPacer = Readonly<{
  wait: (signal: AbortSignal) => Promise<void>;
  defer: (durationMs: number) => void;
}>;

export function createRequestPacer(intervalMs = 1_000): RequestPacer {
  let lastStartedAt = Number.NEGATIVE_INFINITY;
  let notBefore = 0;

  return {
    async wait(signal) {
      const now = Date.now();
      const delay = Math.max(0, lastStartedAt + intervalMs - now, notBefore - now);
      await abortableDelay(delay, signal);
      lastStartedAt = Date.now();
    },
    defer(durationMs) {
      notBefore = Math.max(notBefore, Date.now() + durationMs);
    },
  };
}

function abortableDelay(delayMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(abortError());
  if (delayMs === 0) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(finish, delayMs);
    signal.addEventListener("abort", abort, { once: true });

    function finish() {
      signal.removeEventListener("abort", abort);
      resolve();
    }

    function abort() {
      clearTimeout(timeout);
      reject(abortError());
    }
  });
}

function abortError(): DOMException {
  return new DOMException("The request was aborted", "AbortError");
}
