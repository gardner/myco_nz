const RESOLUTION_SIX_CELL = /^86[0-9a-f]{13}$/;
const CANONICAL_MONTH = /^(?:[1-9]|1[0-2])$/;

export type SharedLocation = Readonly<{
  cell: string;
  month: number;
}>;

export function parseSharedLocationSearch(search: string): SharedLocation | null {
  const params = new URLSearchParams(search);
  const cells = params.getAll("cell");
  const month = parseSharedMonthSearch(search);
  if (cells.length !== 1 || month === null) return null;

  const [cell] = cells;
  if (!RESOLUTION_SIX_CELL.test(cell)) return null;
  return { cell, month };
}

export function parseSharedMonthSearch(search: string): number | null {
  const months = new URLSearchParams(search).getAll("month");
  if (months.length !== 1 || !CANONICAL_MONTH.test(months[0])) return null;
  return Number(months[0]);
}

export function buildSharedLocationUrl(cell: string, month: number): string {
  return buildLocationUrl("/", cell, month);
}

export function buildMapLocationUrl(cell: string, month: number): string {
  return buildLocationUrl("/map", cell, month);
}

function buildLocationUrl(path: string, cell: string, month: number): string {
  if (!RESOLUTION_SIX_CELL.test(cell) || !isMonth(month)) {
    throw new RangeError("A canonical resolution 6 cell and month are required");
  }
  return `${path}?cell=${cell}&month=${month}`;
}

function isMonth(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 12;
}
