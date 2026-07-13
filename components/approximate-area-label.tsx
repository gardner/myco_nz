"use client";

import { MapPin } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import styles from "@/components/approximate-area-label.module.css";

type ResolvedArea = Readonly<{
  cell: string;
  prefix: string;
  placeName: string;
}>;

export function ApproximateAreaLabel({
  cell,
  href,
}: {
  cell: string;
  href: string;
}) {
  const [resolved, setResolved] = useState<ResolvedArea | null>(null);

  useEffect(() => {
    let current = true;
    void import("@/lib/approximate-place")
      .then((places) => {
        if (!current) return;
        const place = places.getApproximatePlaceForCell(cell);
        const description = places.describeApproximatePlace(place);
        setResolved({
          cell,
          ...description,
        });
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [cell]);

  const area = resolved?.cell === cell ? resolved : null;

  return (
    <span className={styles.area} data-testid="approximate-area-label">
      <MapPin aria-hidden="true" size={15} />
      <span className="sr-only">Approximate area: </span>
      <strong>
        {area ? (
          <>
            {area.prefix}
            <Link href={href} aria-label={`View ${area.placeName} on map`}>
              {area.placeName}
            </Link>
          </>
        ) : "Aotearoa New Zealand"}
      </strong>
    </span>
  );
}
