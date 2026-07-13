"use client";

import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";

import styles from "@/components/approximate-area-label.module.css";

export function ApproximateAreaLabel({ cell }: { cell: string }) {
  const [resolved, setResolved] = useState<{ cell: string; label: string } | null>(null);

  useEffect(() => {
    let current = true;
    void import("@/lib/approximate-place")
      .then((places) => {
        if (!current) return;
        setResolved({
          cell,
          label: places.formatApproximatePlace(places.getApproximatePlaceForCell(cell)),
        });
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [cell]);

  const label = resolved?.cell === cell ? resolved.label : "Aotearoa New Zealand";

  return (
    <span className={styles.area} aria-label={`Approximate area: ${label}`}>
      <MapPin aria-hidden="true" size={15} />
      <strong>{label}</strong>
    </span>
  );
}
