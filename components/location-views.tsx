import { ExternalLink, LocateFixed, LockKeyhole, RefreshCw } from "lucide-react";

import { FungiList } from "@/components/fungi-list";
import styles from "@/components/location-experience.module.css";
import { formatSeasonalRange } from "@/lib/months";
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
          .
        </span>
      </p>
      <SourceLine />
    </div>
  );
}

export function LoadingView({ onRefresh }: { onRefresh: () => void }) {
  return (
    <>
      <ResultsHeader onRefresh={onRefresh} />
      <div className={styles.skeletonList} aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <div className={styles.skeleton} key={index} />
        ))}
      </div>
    </>
  );
}

export function ResultsView({ data, onRefresh }: { data: FungiResponse; onRefresh: () => void }) {
  return (
    <>
      <ResultsHeader data={data} onRefresh={onRefresh} />
      <FungiList results={data.results} />
      <ResultsFooter />
    </>
  );
}

export function EmptyView({ data, onRefresh }: { data: FungiResponse; onRefresh: () => void }) {
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
}: {
  heading: string;
  description: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className={styles.statusPanel}>
      <h1 tabIndex={-1}>{heading}</h1>
      <p>{description}</p>
      <button className={styles.primaryButton} onClick={onAction} type="button">
        {action}
      </button>
    </div>
  );
}

function ResultsHeader({ data, onRefresh }: { data?: FungiResponse; onRefresh: () => void }) {
  const context = data
    ? `Historical research-grade records from ${formatSeasonalRange(data.query.requestedMonth)}. ${data.coverage.label}.`
    : "Loading seasonal research-grade records within your approximate area.";

  return (
    <header className={styles.resultsHeader}>
      <div className={styles.resultsBrand} aria-label="Nearby Fungi">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/fungi-placeholder.svg" width="34" height="34" alt="" />
        <span>Nearby Fungi</span>
      </div>
      <div className={styles.resultsContext}>
        <h1 tabIndex={-1}>Most often observed near you</h1>
        <p>{context}</p>
      </div>
      <button
        className={styles.refreshButton}
        onClick={onRefresh}
        type="button"
        aria-label="Refresh location"
        title="Refresh location"
      >
        <RefreshCw aria-hidden="true" size={20} />
      </button>
    </header>
  );
}

function ResultsFooter() {
  return (
    <footer className={styles.resultsFooter}>
      <SourceLine />
      <p>
        Observation frequency does not guarantee that a species is present today. This is not an
        identification or edibility guide.
      </p>
    </footer>
  );
}

function SourceLine() {
  return (
    <p className={styles.source}>
      Powered by{" "}
      <a href="https://inaturalist.nz" target="_blank" rel="noopener noreferrer">
        iNaturalist observations
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      .
    </p>
  );
}
