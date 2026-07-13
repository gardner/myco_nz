export type MapArea = Readonly<{
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}>;

export const AREA_GROUPS = [
  {
    label: "North Island",
    areas: [
      area("kaitaia", "Kaitaia", -35.1149, 173.2637),
      area("whangarei", "Whangarei", -35.7251, 174.3237),
      area("auckland", "Auckland", -36.8509, 174.7645),
      area("hamilton", "Hamilton", -37.787, 175.2793),
      area("tauranga", "Tauranga", -37.6878, 176.1651),
      area("rotorua", "Rotorua", -38.1368, 176.2497),
      area("gisborne", "Gisborne", -38.6623, 178.0176),
      area("new-plymouth", "New Plymouth", -39.0556, 174.0752),
      area("napier", "Napier", -39.4928, 176.912),
      area("palmerston-north", "Palmerston North", -40.3564, 175.6111),
      area("wellington", "Wellington", -41.2866, 174.7756),
    ],
  },
  {
    label: "South Island and Rakiura",
    areas: [
      area("nelson", "Nelson", -41.2706, 173.284),
      area("blenheim", "Blenheim", -41.5134, 173.9612),
      area("westport", "Westport", -41.7526, 171.6037),
      area("christchurch", "Christchurch", -43.5321, 172.6362),
      area("greymouth", "Greymouth", -42.4504, 171.2108),
      area("queenstown", "Queenstown", -45.0312, 168.6626),
      area("dunedin", "Dunedin", -45.8788, 170.5028),
      area("invercargill", "Invercargill", -46.4132, 168.3538),
      area("oban", "Oban, Rakiura", -46.8997, 168.1294),
    ],
  },
  {
    label: "Chatham Islands",
    areas: [area("waitangi", "Waitangi", -43.9535, -176.5597)],
  },
] as const;

const AREAS: readonly MapArea[] = AREA_GROUPS.flatMap((group) => group.areas);

export function getMapArea(id: string): MapArea | undefined {
  return AREAS.find((candidate) => candidate.id === id);
}

function area(
  id: string,
  name: string,
  latitude: number,
  longitude: number,
): MapArea {
  return { id, name, latitude, longitude };
}
