import type { Metadata } from "next";

import {
  formatApproximatePlace,
  getApproximatePlaceForCell,
} from "@/lib/approximate-place";
import { formatMonthName } from "@/lib/months";
import {
  buildSharedLocationUrl,
  parseSharedLocationSearch,
} from "@/lib/shared-location";
import { validateLocationCell } from "@/lib/validation";

const SITE_ORIGIN = "https://myco.nz";
const SITE_NAME = "Nearby Fungi";
const ROOT_TITLE = "Nearby Fungi in Aotearoa New Zealand";
const ROOT_DESCRIPTION =
  "See the fungi most often recorded near an approximate area in Aotearoa New Zealand around this time of year, using research-grade iNaturalist observations.";
const SOCIAL_IMAGE = {
  url: new URL("/social/nearby-fungi-v1.jpg", SITE_ORIGIN),
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: "A white mushroom growing from a mossy tree in an Aotearoa New Zealand forest.",
};

type StaticMetadataOptions = Readonly<{
  title: string;
  description: string;
  path: string;
}>;

export function buildRootMetadata(search: string): Metadata {
  const location = parseSharedLocationSearch(search);
  if (!location || !validateLocationCell(location.cell).ok) {
    return buildStaticMetadata({
      title: ROOT_TITLE,
      description: ROOT_DESCRIPTION,
      path: "/",
    });
  }

  const month = formatMonthName(location.month);
  const formattedPlace = formatApproximatePlace(
    getApproximatePlaceForCell(location.cell),
  );
  const place = `${formattedPlace[0].toLowerCase()}${formattedPlace.slice(1)}`;
  const title = `Fungi recorded ${place} around ${month} | ${SITE_NAME}`;
  const description =
    `See fungi most often recorded ${place} around ${month}, using research-grade iNaturalist observations.`;

  return {
    ...buildStaticMetadata({
      title,
      description,
      path: buildSharedLocationUrl(location.cell, location.month),
    }),
    robots: { index: false, follow: true },
  };
}

export function buildStaticMetadata({
  title,
  description,
  path,
}: StaticMetadataOptions): Metadata {
  const canonical = new URL(path, SITE_ORIGIN);

  return {
    metadataBase: new URL(SITE_ORIGIN),
    applicationName: SITE_NAME,
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      locale: "en_NZ",
      type: "website",
      images: [SOCIAL_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [SOCIAL_IMAGE],
    },
  };
}
