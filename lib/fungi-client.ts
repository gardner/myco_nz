import type { FungiResponse } from "@/lib/types";

export type ClientErrorCode = "outside-new-zealand" | "unavailable" | "invalid-response";

export class FungiClientError extends Error {
  constructor(public readonly code: ClientErrorCode) {
    super(code);
    this.name = "FungiClientError";
  }
}

export async function fetchFungi(
  cell: string,
  month: number,
  signal: AbortSignal,
): Promise<FungiResponse> {
  const response = await fetch(`/api/fungi/v1/en-NZ/r6/${cell}/${month}`, {
    headers: { Accept: "application/json" },
    signal,
  });

  if (response.status === 422) throw new FungiClientError("outside-new-zealand");
  if (!response.ok) throw new FungiClientError("unavailable");

  const payload: unknown = await response.json();
  if (!isFungiResponse(payload)) throw new FungiClientError("invalid-response");
  return payload;
}

function isFungiResponse(value: unknown): value is FungiResponse {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<FungiResponse>;
  return (
    candidate.schemaVersion === 1 &&
    Array.isArray(candidate.results) &&
    typeof candidate.coverage?.label === "string" &&
    candidate.query?.resolution === 6
  );
}
