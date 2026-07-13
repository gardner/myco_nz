import { buildSharedLocationUrl } from "@/lib/shared-location";

const CANONICAL_MONTH = /^(?:[1-9]|1[0-2])$/;

type RouteContext = {
  params: Promise<{ cell: string; month: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  return redirectLegacyUrl(request, context);
}

export async function HEAD(request: Request, context: RouteContext): Promise<Response> {
  return redirectLegacyUrl(request, context);
}

async function redirectLegacyUrl(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { cell, month } = await context.params;
  if (!CANONICAL_MONTH.test(month)) return invalidRequest();

  try {
    const location = new URL(buildSharedLocationUrl(cell, Number(month)), request.url);
    return new Response(null, {
      status: 308,
      headers: { Location: location.toString() },
    });
  } catch {
    return invalidRequest();
  }
}

function invalidRequest(): Response {
  return Response.json(
    { error: "Invalid legacy result URL" },
    { status: 400, headers: { "Cache-Control": "no-store" } },
  );
}
