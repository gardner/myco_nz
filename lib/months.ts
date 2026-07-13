const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function getSeasonalMonths(month: number): [number, number, number] {
  const previous = month === 1 ? 12 : month - 1;
  const next = month === 12 ? 1 : month + 1;
  return [previous, month, next];
}

export function formatSeasonalRange(month: number): string {
  const [first, , last] = getSeasonalMonths(month);
  return `${SHORT_MONTHS[first - 1]}-${SHORT_MONTHS[last - 1]}`;
}

export function formatMonthName(month: number): string {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError("A month from 1 to 12 is required");
  }
  return MONTHS[month - 1];
}
