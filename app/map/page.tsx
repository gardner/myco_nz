import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { MapExperience } from "@/components/map-experience";
import styles from "@/app/map/map-page.module.css";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Choose an area | Nearby Fungi",
  description: "Choose an approximate area in Aotearoa New Zealand.",
};

export default function MapPage() {
  return (
    <main className="page-shell">
      <div className="page-content">
        <header className={styles.routeHeader}>
          <div className={styles.brandMark}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/fungi-placeholder.svg" width="34" height="34" alt="" />
            <span>Nearby Fungi</span>
          </div>
          <Link
            className={styles.backLink}
            href="/"
            aria-label="Back to Nearby Fungi"
            title="Back to Nearby Fungi"
          >
            <ArrowLeft aria-hidden="true" size={20} />
          </Link>
        </header>
        <MapExperience />
      </div>
    </main>
  );
}
