import Link from "next/link";
import { ExternalLink, LocateFixed, LockKeyhole, MapPinned } from "lucide-react";

import { ApproximateAreaLabel } from "@/components/approximate-area-label";
import { FungiList } from "@/components/fungi-list";
import { GazetteerAttribution } from "@/components/gazetteer-attribution";
import styles from "@/components/location-experience.module.css";
import { MonthSelector } from "@/components/month-selector";
import { NzMapIcon } from "@/components/nz-map-icon";
import { formatSeasonalRange } from "@/lib/months";
import { buildMapLocationUrl } from "@/lib/shared-location";
import type { FungiResponse } from "@/lib/types";

export function BrandHeader() {
  return (
    <header className="brand" aria-label="Nearby Fungi">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/fungi-placeholder.svg" width="34" height="34" alt="" />
      <span>Nearby Fungi</span>
    </header>
  );
}

export function LocationGate({
  hydrated,
  locating,
  onAction,
}: {
  hydrated: boolean;
  locating: boolean;
  onAction: () => void;
}) {
  return (
    <div className={styles.gate}>
      <p className={styles.eyebrow}>Seasonal records, close to home</p>
      <h1 tabIndex={-1}>Fungi likely near you</h1>
      <p className={styles.intro}>
        See the fungi most often recorded around your approximate area at this time of year.
      </p>
      <button
        className={styles.primaryButton}
        onClick={onAction}
        disabled={locating || !hydrated}
        type="button"
      >
        <LocateFixed aria-hidden="true" size={20} />
        {locating ? "Finding your area..." : "Show fungi near me"}
      </button>
      <Link className={styles.secondaryAction} href="/map">
        <MapPinned aria-hidden="true" size={18} />
        Choose on map
      </Link>
      <p className={styles.privacy}>
        <LockKeyhole aria-hidden="true" size={17} />
        <span>
          Your exact location stays on this device. We send only{" "}
          <a
            href="https://h3geo.org/docs"
            target="_blank"
            rel="noopener noreferrer"
          >
            an approximate area
            <span className="sr-only"> (opens H3 documentation in a new tab)</span>
          </a>
          {" "}directly to iNaturalist.
        </span>
      </p>
      <SourceLine />
    </div>
  );
}

export function ResultsView({
  cell,
  data,
  month,
  onRefresh,
  onSelectMonth,
}: {
  cell: string;
  data?: FungiResponse;
  month: number;
  onRefresh: () => void;
  onSelectMonth: (month: number) => void;
}) {
  return (
    <>
      <ResultsHeader cell={cell} data={data} month={month} onRefresh={onRefresh} />
      <MonthSelector selectedMonth={month} onSelect={onSelectMonth} />
      <ResultsBody data={data} onRefresh={onRefresh} />
    </>
  );
}

function ResultsBody({
  data,
  onRefresh,
}: {
  data?: FungiResponse;
  onRefresh: () => void;
}) {
  if (!data) {
    return (
      <div className={styles.skeletonList} aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <div className={styles.skeleton} key={index} />
        ))}
      </div>
    );
  }
  if (data.results.length) {
    return (
      <>
        <FungiList results={data.results} />
        <ResultsFooter />
      </>
    );
  }
  return (
    <>
      <StatusView
        heading="Not enough local records yet"
        description="iNaturalist may have sparse fungi records for this area and season."
        action="Refresh location"
        onAction={onRefresh}
      />
      <a
        className={styles.externalAction}
        href="https://inaturalist.nz/observations?iconic_taxa=Fungi&quality_grade=research"
        target="_blank"
        rel="noopener noreferrer"
      >
        Browse fungi observations on iNaturalist NZ
        <ExternalLink aria-hidden="true" size={16} />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      <p className={styles.coverage}>{data.coverage.label}</p>
    </>
  );
}

export function StatusView({
  heading,
  description,
  action,
  onAction,
  secondaryAction,
}: {
  heading: string;
  description: string;
  action: string;
  onAction: () => void;
  secondaryAction?: { href: string; label: string };
}) {
  return (
    <div className={styles.statusPanel}>
      <h1 tabIndex={-1}>{heading}</h1>
      <p>{description}</p>
      <button className={styles.primaryButton} onClick={onAction} type="button">
        {action}
      </button>
      {secondaryAction && (
        <Link className={styles.secondaryAction} href={secondaryAction.href}>
          <MapPinned aria-hidden="true" size={18} />
          {secondaryAction.label}
        </Link>
      )}
    </div>
  );
}

function ResultsHeader({
  cell,
  data,
  month,
  onRefresh,
}: {
  cell: string;
  data?: FungiResponse;
  month: number;
  onRefresh: () => void;
}) {
  const context = data
    ? `Research-grade records from ${formatSeasonalRange(data.query.requestedMonth)}, within about 30 km.`
    : "Loading research-grade records within about 30 km.";

  return (
    <header className={styles.resultsHeader}>
      <div className={styles.resultsBrand} aria-label="Nearby Fungi">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/fungi-placeholder.svg" width="34" height="34" alt="" />
        <span>Nearby Fungi</span>
      </div>
      <div className={styles.resultsContext}>
        <h1 tabIndex={-1}>Most often observed near you</h1>
        <p className={styles.resultsMeta}>
          <ApproximateAreaLabel
            cell={cell}
            href={buildMapLocationUrl(cell, month)}
          />
          <span>{context}</span>
        </p>
      </div>
      <button
        className={styles.refreshButton}
        onClick={onRefresh}
        type="button"
        aria-label="Refresh location"
        title="Refresh location"
      >
        <NzMapIcon />
      </button>
    </header>
  );
}

function ResultsFooter() {
  return (
    <footer className={styles.resultsFooter}>
      <SourceLine includePlaceNames />
      <p>
        Observation frequency does not guarantee that a species is present today. This is not an
        identification or edibility guide.
      </p>
    </footer>
  );
}

function SourceLine({ includePlaceNames = false }: { includePlaceNames?: boolean }) {
  return (
    <p className={styles.source}>
      Powered by{" "}
      <a href="https://inaturalist.nz" target="_blank" rel="noopener noreferrer">
        iNaturalist observations
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      .{" "}
      {includePlaceNames && (
        <>
          Approximate place names from <GazetteerAttribution />.
        </>
      )}
    </p>
  );
}
