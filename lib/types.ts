export type FungiImage = {
  url: string;
  attribution: string | null;
  licenseCode: string | null;
};

export type FungiResult = {
  rank: number;
  taxonId: number;
  commonName: string | null;
  scientificName: string;
  observationCount: number;
  observationCountLabel: string;
  image: FungiImage | null;
  observationsUrl: string;
};

export type FungiResponse = {
  schemaVersion: 1;
  generatedAt: string;
  query: {
    cell: string;
    resolution: 6;
    requestedMonth: number;
    includedMonths: [number, number, number];
    radiusKm: 30;
    locale: "en-NZ";
  };
  coverage: {
    mode: "cell-centre-radius" | "expanded-radius" | "cell-ring";
    sourceCells: string[];
    expansionLevel: number;
    label: string;
  };
  source: {
    name: "iNaturalist";
    siteUrl: "https://inaturalist.nz";
  };
  results: FungiResult[];
};
