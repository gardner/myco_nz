import { describe, expect, it } from "vitest";

import { metadata as mapMetadata } from "@/app/map/page";
import {
  buildRootMetadata,
  buildStaticMetadata,
} from "@/lib/social-metadata";

const SITE_URL = "https://myco.nz";
const SOCIAL_IMAGE_URL = new URL(`${SITE_URL}/social/nearby-fungi-v1.jpg`);
const SOCIAL_IMAGE_ALT =
  "A white mushroom growing from a mossy tree in an Aotearoa New Zealand forest.";
const ROOT_TITLE = "Nearby Fungi in Aotearoa New Zealand";
const ROOT_DESCRIPTION =
  "See the fungi most often recorded near an approximate area in Aotearoa New Zealand around this time of year, using research-grade iNaturalist observations.";

describe("social metadata", () => {
  it("describes the generic home page for search-free shares", () => {
    const metadata = buildRootMetadata("");

    expect(metadata).toMatchObject({
      metadataBase: new URL(SITE_URL),
      title: ROOT_TITLE,
      description: ROOT_DESCRIPTION,
      alternates: { canonical: new URL(`${SITE_URL}/`) },
      openGraph: {
        title: ROOT_TITLE,
        description: ROOT_DESCRIPTION,
        url: new URL(`${SITE_URL}/`),
        siteName: "Nearby Fungi",
        locale: "en_NZ",
        type: "website",
        images: [
          {
            url: SOCIAL_IMAGE_URL,
            width: 1200,
            height: 630,
            type: "image/jpeg",
            alt: SOCIAL_IMAGE_ALT,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: ROOT_TITLE,
        description: ROOT_DESCRIPTION,
        images: [
          {
            url: SOCIAL_IMAGE_URL,
            width: 1200,
            height: 630,
            type: "image/jpeg",
            alt: SOCIAL_IMAGE_ALT,
          },
        ],
      },
    });
  });

  it("publishes an honest place and month for a valid shared view", () => {
    const metadata = buildRootMetadata(
      "?cell=86bb2955fffffff&month=9&utm_source=example",
    );
    const canonical = new URL(
      `${SITE_URL}/?cell=86bb2955fffffff&month=9`,
    );

    expect(metadata).toMatchObject({
      title: "Fungi recorded near Wellington around September | Nearby Fungi",
      description:
        "See fungi most often recorded near Wellington around September, using research-grade iNaturalist observations.",
      alternates: { canonical },
      robots: { index: false, follow: true },
      openGraph: {
        title: "Fungi recorded near Wellington around September | Nearby Fungi",
        description:
          "See fungi most often recorded near Wellington around September, using research-grade iNaturalist observations.",
        url: canonical,
      },
      twitter: {
        card: "summary_large_image",
        title: "Fungi recorded near Wellington around September | Nearby Fungi",
        description:
          "See fungi most often recorded near Wellington around September, using research-grade iNaturalist observations.",
      },
    });
  });

  it.each([
    ["an incomplete share", "?cell=86bb2955fffffff"],
    ["a malformed cell", "?cell=not-an-h3-cell&month=9"],
    ["an overseas cell", "?cell=86be0e35fffffff&month=9"],
    ["a noncanonical month", "?cell=86bb2955fffffff&month=09"],
    [
      "duplicate months",
      "?cell=86bb2955fffffff&month=9&month=10",
    ],
  ])("falls back to generic metadata for %s", (_, search) => {
    const metadata = buildRootMetadata(search);

    expect(metadata).toMatchObject({
      title: ROOT_TITLE,
      description: ROOT_DESCRIPTION,
      alternates: { canonical: new URL(`${SITE_URL}/`) },
      openGraph: {
        title: ROOT_TITLE,
        description: ROOT_DESCRIPTION,
        url: new URL(`${SITE_URL}/`),
      },
      twitter: {
        title: ROOT_TITLE,
        description: ROOT_DESCRIPTION,
      },
    });
  });

  it("builds complete metadata for a static route", () => {
    const metadata = buildStaticMetadata({
      title: "Choose an area | Nearby Fungi",
      description: "Choose an approximate area in Aotearoa New Zealand.",
      path: "/map",
    });

    expect(metadata).toMatchObject({
      metadataBase: new URL(SITE_URL),
      title: "Choose an area | Nearby Fungi",
      description: "Choose an approximate area in Aotearoa New Zealand.",
      alternates: { canonical: new URL(`${SITE_URL}/map`) },
      openGraph: {
        title: "Choose an area | Nearby Fungi",
        description: "Choose an approximate area in Aotearoa New Zealand.",
        url: new URL(`${SITE_URL}/map`),
        siteName: "Nearby Fungi",
        locale: "en_NZ",
        type: "website",
        images: [
          {
            url: SOCIAL_IMAGE_URL,
            width: 1200,
            height: 630,
            type: "image/jpeg",
            alt: SOCIAL_IMAGE_ALT,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: "Choose an area | Nearby Fungi",
        description: "Choose an approximate area in Aotearoa New Zealand.",
        images: [
          {
            url: SOCIAL_IMAGE_URL,
            width: 1200,
            height: 630,
            type: "image/jpeg",
            alt: SOCIAL_IMAGE_ALT,
          },
        ],
      },
    });
  });

  it("uses the complete static metadata on the map route", () => {
    expect(mapMetadata).toEqual(
      buildStaticMetadata({
        title: "Choose an area | Nearby Fungi",
        description: "Choose an approximate area in Aotearoa New Zealand.",
        path: "/map",
      }),
    );
  });
});
