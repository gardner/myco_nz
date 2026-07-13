export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  callerSignal: AbortSignal,
  timeoutMs = 10_000,
): Promise<Response> {
  if (callerSignal.aborted) throw abortError();

  const controller = new AbortController();
  let cancel: (reason: Error) => void = () => undefined;
  const cancellation = new Promise<never>((_, reject) => {
    cancel = reject;
  });
  const abort = () => {
    controller.abort();
    cancel(abortError());
  };
  const timeout = setTimeout(() => {
    controller.abort();
    cancel(new Error("Request timed out"));
  }, timeoutMs);
  callerSignal.addEventListener("abort", abort, { once: true });

  try {
    return await Promise.race([
      fetch(input, { ...init, signal: controller.signal }),
      cancellation,
    ]);
  } finally {
    clearTimeout(timeout);
    callerSignal.removeEventListener("abort", abort);
  }
}

function abortError(): DOMException {
  return new DOMException("The request was aborted", "AbortError");
}
