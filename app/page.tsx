import type { Metadata } from "next";

import { LocationExperience } from "@/components/location-experience";
import { buildRootMetadata } from "@/lib/social-metadata";

// Search parameters drive each shared view's title and canonical URL.
export const dynamic = "force-dynamic";

type HomePageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export async function generateMetadata({
  searchParams,
}: HomePageProps): Promise<Metadata> {
  return buildRootMetadata(serializeSearchParams(await searchParams));
}

export default function Home() {
  return (
    <main className="page-shell">
      <div className="page-content">
        <LocationExperience />
      </div>
    </main>
  );
}

function serializeSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(searchParams)) {
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (item !== undefined) query.append(name, item);
    }
  }
  return query.toString();
}
