import { describe, expect, it } from "vitest";

import {
  buildObservationsUrl,
  buildSpeciesCountsUrl,
  buildTaxonPhotosUrl,
  InvalidUpstreamResponseError,
  normaliseSpeciesCounts,
} from "@/lib/inaturalist";
import realSpeciesCounts from "@/tests/fixtures/inaturalist-species-counts.json";

const query = {
  cell: "86bb2955fffffff",
  requestedMonth: 7,
  centreLat: -41.307532459,
  centreLng: 174.801809117,
};

describe("iNaturalist URL policy", () => {
  it("builds an encoded taxon photo browser URL", () => {
    expect(buildTaxonPhotosUrl(500194, "Rossbeevera pachydermis")).toBe(
      "https://www.inaturalist.nz/taxa/500194-Rossbeevera-pachydermis/browse_photos",
    );
    expect(buildTaxonPhotosUrl(123, "Fungus / test #1")).toBe(
      "https://www.inaturalist.nz/taxa/123-Fungus-%2F-test-%231/browse_photos",
    );
  });

  it("builds a fixed species-count query", () => {
    const url = new URL(buildSpeciesCountsUrl(query));

    expect(`${url.origin}${url.pathname}`).toBe(
      "https://api.inaturalist.org/v1/observations/species_counts",
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      lat: "-41.30753",
      lng: "174.80181",
      radius: "30",
      month: "6,7,8",
      iconic_taxa: "Fungi",
      rank: "species",
      quality_grade: "research",
      locale: "en",
      per_page: "20",
    });
    expect(url.searchParams.has("photos")).toBe(false);
    expect(url.searchParams.has("year")).toBe(false);
  });

  it("builds a matching observations link from the cell centre", () => {
    const url = new URL(
      buildObservationsUrl({
        taxonId: 123,
        centreLat: query.centreLat,
        centreLng: query.centreLng,
        months: [6, 7, 8],
      }),
    );

    expect(`${url.origin}${url.pathname}`).toBe("https://inaturalist.nz/observations");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      taxon_id: "123",
      lat: "-41.30753",
      lng: "174.80181",
      radius: "30",
      month: "6,7,8",
      quality_grade: "research",
    });
  });
});

describe("normaliseSpeciesCounts", () => {
  it("normalises a captured response from the real iNaturalist API", () => {
    const result = normaliseSpeciesCounts({
      payload: realSpeciesCounts,
      ...query,
      generatedAt: new Date("2026-07-13T00:00:00.000Z"),
    });

    expect(result.results.map(({ taxonId, observationCount }) => ({ taxonId, observationCount }))).toEqual([
      { taxonId: 382779, observationCount: 448 },
      { taxonId: 179230, observationCount: 312 },
      { taxonId: 53281, observationCount: 296 },
    ]);
    expect(result.results[0]).toMatchObject({
      commonName: "White Basket Fungus",
      scientificName: "Ileodictyon cibarium",
      image: {
        url: "https://inaturalist-open-data.s3.amazonaws.com/photos/41876325/square.jpeg",
        licenseCode: "cc-by-nc",
      },
    });
  });

  it("preserves rank order, fallbacks, photo metadata, and response coverage", () => {
    const result = normaliseSpeciesCounts({
      payload: {
        results: [
          {
            count: 84,
            taxon: {
              id: 123,
              name: "Flammulina velutipes",
              preferred_common_name: "Velvet shank",
              default_photo: {
                square_url: "https://static.inaturalist.org/photo-square.jpg",
                medium_url: "https://static.inaturalist.org/photo-medium.jpg",
                attribution: "(c) Example Observer, CC BY-NC",
                license_code: "cc-by-nc",
              },
            },
          },
          {
            count: 1,
            taxon: { id: 456, name: "Ileodictyon cibarium" },
          },
        ],
      },
      ...query,
      generatedAt: new Date("2026-07-13T00:00:00.000Z"),
    });

    expect(result).toMatchObject({
      schemaVersion: 1,
      generatedAt: "2026-07-13T00:00:00.000Z",
      query: {
        cell: query.cell,
        resolution: 6,
        requestedMonth: 7,
        includedMonths: [6, 7, 8],
        radiusKm: 30,
        locale: "en-NZ",
      },
      coverage: {
        mode: "cell-centre-radius",
        sourceCells: [query.cell],
        expansionLevel: 0,
        label: "Within about 30 km of your approximate area",
      },
      source: { name: "iNaturalist", siteUrl: "https://inaturalist.nz" },
    });
    expect(result.results).toHaveLength(2);
    expect(result.results[0]).toMatchObject({
      rank: 1,
      taxonId: 123,
      commonName: "Velvet shank",
      scientificName: "Flammulina velutipes",
      observationCount: 84,
      observationCountLabel: "84 research-grade observations nearby in Jun-Aug",
      image: {
        url: "https://static.inaturalist.org/photo-square.jpg",
        attribution: "(c) Example Observer, CC BY-NC",
        licenseCode: "cc-by-nc",
      },
    });
    expect(result.results[1]).toMatchObject({
      rank: 2,
      commonName: null,
      observationCountLabel: "1 research-grade observation nearby in Jun-Aug",
      image: null,
    });
  });

  it("rejects a malformed upstream result", () => {
    expect(() =>
      normaliseSpeciesCounts({
        payload: { results: [{ count: 2, taxon: { id: 123 } }] },
        ...query,
        generatedAt: new Date(),
      }),
    ).toThrow(InvalidUpstreamResponseError);
  });

  it("caps results at 20 and falls back through the available photo URLs", () => {
    const payload = {
      results: Array.from({ length: 21 }, (_, index) => ({
        count: 21 - index,
        taxon: {
          id: index + 1,
          name: `Fungus ${index + 1}`,
          default_photo: {
            medium_url: `https://static.inaturalist.org/${index + 1}.jpg`,
          },
        },
      })),
    };

    const result = normaliseSpeciesCounts({
      payload,
      ...query,
      generatedAt: new Date("2026-07-13T00:00:00.000Z"),
    });

    expect(result.results).toHaveLength(20);
    expect(result.results[0].image).toEqual({
      url: "https://static.inaturalist.org/1.jpg",
      attribution: null,
      licenseCode: null,
    });
    expect(result.results[19]).toMatchObject({ rank: 20, taxonId: 20 });
  });
});
