import { useEffect, useRef } from "react";

import styles from "@/components/month-selector.module.css";

const MONTHS = [
  ["January", "Jan"],
  ["February", "Feb"],
  ["March", "Mar"],
  ["April", "Apr"],
  ["May", "May"],
  ["June", "Jun"],
  ["July", "Jul"],
  ["August", "Aug"],
  ["September", "Sep"],
  ["October", "Oct"],
  ["November", "Nov"],
  ["December", "Dec"],
] as const;

export function MonthSelector({
  selectedMonth,
  onSelect,
  disabled = false,
}: {
  selectedMonth: number;
  onSelect: (month: number) => void;
  disabled?: boolean;
}) {
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = scroller.current;
    const selected = container?.querySelector<HTMLElement>(`[data-month="${selectedMonth}"]`);
    if (!container || !selected || container.scrollWidth <= container.clientWidth) return;
    container.scrollLeft = selected.offsetLeft - (container.clientWidth - selected.offsetWidth) / 2;
  }, [selectedMonth]);

  return (
    <div className={styles.selector} ref={scroller}>
      <div className={styles.months} role="radiogroup" aria-label="Month of year">
        {MONTHS.map(([name, shortName], index) => {
          const month = index + 1;
          return (
            <div className={styles.option} key={name}>
              <input
                className={styles.input}
                type="radio"
                name="month-of-year"
                value={month}
                id={`month-${month}`}
                aria-label={name}
                checked={selectedMonth === month}
                disabled={disabled}
                onChange={() => {
                  if (selectedMonth !== month) onSelect(month);
                }}
              />
              <label className={styles.month} htmlFor={`month-${month}`} data-month={month}>
                {shortName}
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
