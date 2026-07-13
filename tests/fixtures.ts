import type { FungiResponse } from "@/lib/types";

export const fungiResponse: FungiResponse = {
  schemaVersion: 1,
  generatedAt: "2026-07-13T00:00:00.000Z",
  query: {
    cell: "86bb2955fffffff",
    resolution: 6,
    requestedMonth: 7,
    includedMonths: [6, 7, 8],
    radiusKm: 30,
    locale: "en-NZ",
  },
  coverage: {
    mode: "cell-centre-radius",
    sourceCells: ["86bb2955fffffff"],
    expansionLevel: 0,
    label: "Within about 30 km of your approximate area",
  },
  source: { name: "iNaturalist", siteUrl: "https://inaturalist.nz" },
  results: [
    {
      rank: 1,
      taxonId: 382779,
      commonName: "White Basket Fungus",
      scientificName: "Ileodictyon cibarium",
      observationCount: 448,
      observationCountLabel: "448 research-grade observations nearby in Jun-Aug",
      image: {
        url: "https://inaturalist-open-data.s3.amazonaws.com/photos/41876325/square.jpeg",
        attribution: "(c) k_fordyce, some rights reserved (CC BY-NC)",
        licenseCode: "cc-by-nc",
      },
      observationsUrl:
        "https://inaturalist.nz/observations?taxon_id=382779&lat=-41.30340&lng=174.75272&radius=30&month=6%2C7%2C8&quality_grade=research",
    },
    {
      rank: 2,
      taxonId: 179230,
      commonName: "Ear fungus",
      scientificName: "Auricularia cornea",
      observationCount: 312,
      observationCountLabel: "312 research-grade observations nearby in Jun-Aug",
      image: {
        url: "https://inaturalist-open-data.s3.amazonaws.com/photos/120283404/square.jpg",
        attribution:
          "(c) Sunčana Bradley, some rights reserved (CC BY), uploaded by Sunčana Bradley",
        licenseCode: "cc-by",
      },
      observationsUrl:
        "https://inaturalist.nz/observations?taxon_id=179230&lat=-41.30340&lng=174.75272&radius=30&month=6%2C7%2C8&quality_grade=research",
    },
    {
      rank: 3,
      taxonId: 53281,
      commonName: "Scarlet Pouch",
      scientificName: "Leratiomyces erythrocephalus",
      observationCount: 296,
      observationCountLabel: "296 research-grade observations nearby in Jun-Aug",
      image: {
        url: "https://inaturalist-open-data.s3.amazonaws.com/photos/1901505/square.jpg",
        attribution:
          "(c) Shirley Kerr, some rights reserved (CC BY-NC), uploaded by Shirley Kerr",
        licenseCode: "cc-by-nc",
      },
      observationsUrl:
        "https://inaturalist.nz/observations?taxon_id=53281&lat=-41.30340&lng=174.75272&radius=30&month=6%2C7%2C8&quality_grade=research",
    },
  ],
};
