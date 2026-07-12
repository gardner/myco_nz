import { env } from "cloudflare:workers";

import { handleFungiRequest } from "@/lib/fungi-handler";

type RouteContext = {
  params: Promise<{ cell: string; month: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { cell, month } = await context.params;
  return handleFungiRequest(
    { request, cell, rawMonth: month },
    {
      fetch,
      limit: (input) => env.INATURALIST_MISS_LIMITER.limit(input),
      now: () => new Date(),
      userAgent: env.INATURALIST_USER_AGENT,
      log: (event) => console.log(event),
    },
  );
}

export async function HEAD(request: Request, context: RouteContext): Promise<Response> {
  const response = await GET(request, context);
  return new Response(null, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
