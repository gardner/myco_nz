import { ExternalLink, LocateFixed, LockKeyhole, RefreshCw } from "lucide-react";

import { FungiList } from "@/components/fungi-list";
import styles from "@/components/location-experience.module.css";
import { formatSeasonalRange } from "@/lib/months";
import type { FungiResponse } from "@/lib/types";

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
        Your exact location stays on this device. We send only an approximate area.
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
  return (
    <header className={styles.resultsHeader}>
      <p className={styles.eyebrow}>Historical observation frequency</p>
      <h1 tabIndex={-1}>Most often observed near you</h1>
      <p>
        {data
          ? `Based on research-grade observations from ${formatSeasonalRange(data.query.requestedMonth)} across previous years.`
          : "Loading seasonal research-grade observations..."}
      </p>
      <p className={styles.coverage}>
        {data?.coverage.label ?? "Within your approximate area"}
      </p>
      <button className={styles.secondaryButton} onClick={onRefresh} type="button">
        <RefreshCw aria-hidden="true" size={17} />
        Refresh location
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
