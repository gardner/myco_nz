const RESOLUTION_SIX_CELL = /^86[0-9a-f]{13}$/;
const CANONICAL_MONTH = /^(?:[1-9]|1[0-2])$/;

export type SharedLocation = Readonly<{
  cell: string;
  month: number;
}>;

export function parseSharedLocationSearch(search: string): SharedLocation | null {
  const params = new URLSearchParams(search);
  const cells = params.getAll("cell");
  const months = params.getAll("month");
  if (cells.length !== 1 || months.length !== 1) return null;

  const [cell] = cells;
  const [monthValue] = months;
  if (!RESOLUTION_SIX_CELL.test(cell) || !CANONICAL_MONTH.test(monthValue)) return null;
  return { cell, month: Number(monthValue) };
}

export function buildSharedLocationUrl(cell: string, month: number): string {
  if (!RESOLUTION_SIX_CELL.test(cell) || !isMonth(month)) {
    throw new RangeError("A canonical resolution 6 cell and month are required");
  }
  return `/?cell=${cell}&month=${month}`;
}

function isMonth(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 12;
}
