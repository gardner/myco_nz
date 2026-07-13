"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ExternalLink, LocateFixed, LockKeyhole, RefreshCw } from "lucide-react";

import { FungiList } from "@/components/fungi-list";
import styles from "@/components/location-experience.module.css";
import {
  getApproximateCell,
  LocationAccessError,
  readStoredLocation,
  storeLocationCell,
} from "@/lib/client-location";
import { fetchFungi, FungiClientError } from "@/lib/fungi-client";
import { formatSeasonalRange } from "@/lib/months";
import type { FungiResponse } from "@/lib/types";

type ViewState =
  | { status: "idle" | "locating" | "denied" | "unsupported" | "unavailable" }
  | { status: "loading"; cell: string }
  | { status: "success" | "empty"; data: FungiResponse; cell: string }
  | { status: "error" | "outside"; cell: string };

export function LocationExperience() {
  const [state, setState] = useState<ViewState>({ status: "idle" });
  const activeRequest = useRef<AbortController | null>(null);
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);

  const loadResults = useCallback(async (cell: string) => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setState({ status: "loading", cell });

    try {
      const month = new Date().getMonth() + 1;
      const data = await fetchFungi(cell, month, controller.signal);
      setState({ status: data.results.length ? "success" : "empty", data, cell });
    } catch (error) {
      if (controller.signal.aborted) return;
      const status =
        error instanceof FungiClientError && error.code === "outside-new-zealand"
          ? "outside"
          : "error";
      setState({ status, cell });
    }
  }, []);

  const requestLocation = useCallback(async () => {
    setState({ status: "locating" });
    try {
      const cell = await getApproximateCell(navigator.geolocation ?? null);
      storeLocationCell(cell);
      await loadResults(cell);
    } catch (error) {
      if (!(error instanceof LocationAccessError)) {
        setState({ status: "unavailable" });
        return;
      }
      setState({ status: error.code });
    }
  }, [loadResults]);

  useEffect(() => {
    const stored = readStoredLocation();
    const restoreTimer = stored
      ? window.setTimeout(() => void loadResults(stored.cell), 0)
      : undefined;
    return () => {
      if (restoreTimer !== undefined) window.clearTimeout(restoreTimer);
      activeRequest.current?.abort();
    };
  }, [loadResults]);

  return (
    <section className={styles.experience}>
      <p className="sr-only" role="status" aria-live="polite">
        {liveMessage(state)}
      </p>
      <StateView
        state={state}
        hydrated={hydrated}
        requestLocation={requestLocation}
        loadResults={loadResults}
      />
    </section>
  );
}

function StateView({
  state,
  hydrated,
  requestLocation,
  loadResults,
}: {
  state: ViewState;
  hydrated: boolean;
  requestLocation: () => Promise<void>;
  loadResults: (cell: string) => Promise<void>;
}) {
  switch (state.status) {
    case "loading":
      return <LoadingView onRefresh={requestLocation} />;
    case "success":
      return <ResultsView data={state.data} onRefresh={requestLocation} />;
    case "empty":
      return <EmptyView data={state.data} onRefresh={requestLocation} />;
    case "error":
      return (
        <StatusView
          heading="We couldn't load fungi right now"
          description="iNaturalist may be temporarily unavailable. Your approximate area is ready to retry."
          action="Try again"
          onAction={() => loadResults(state.cell)}
        />
      );
    case "outside":
      return (
        <StatusView
          heading="Nearby Fungi currently covers Aotearoa New Zealand"
          description="Refresh your location when you are back within the supported area."
          action="Refresh location"
          onAction={requestLocation}
        />
      );
    case "denied":
      return (
        <StatusView
          heading="Location access is off"
          description="Allow location access in your browser, then try again. Exact coordinates stay on this device."
          action="Try again"
          onAction={requestLocation}
        />
      );
    case "unsupported":
      return (
        <StatusView
          heading="Location isn't available"
          description="This browser or device does not provide location access."
          action="Try again"
          onAction={requestLocation}
        />
      );
    case "unavailable":
      return (
        <StatusView
          heading="We couldn't find your area"
          description="Check your device location settings and try again."
          action="Try again"
          onAction={requestLocation}
        />
      );
    case "locating":
      return <LocationGate hydrated={hydrated} locating onAction={requestLocation} />;
    default:
      return <LocationGate hydrated={hydrated} locating={false} onAction={requestLocation} />;
  }
}

function LocationGate({
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
      <h1>Fungi likely near you</h1>
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

function LoadingView({ onRefresh }: { onRefresh: () => void }) {
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

function ResultsView({ data, onRefresh }: { data: FungiResponse; onRefresh: () => void }) {
  return (
    <>
      <ResultsHeader data={data} onRefresh={onRefresh} />
      <FungiList results={data.results} />
      <ResultsFooter />
    </>
  );
}

function EmptyView({ data, onRefresh }: { data: FungiResponse; onRefresh: () => void }) {
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

function ResultsHeader({ data, onRefresh }: { data?: FungiResponse; onRefresh: () => void }) {
  return (
    <header className={styles.resultsHeader}>
      <p className={styles.eyebrow}>Historical observation frequency</p>
      <h1>Most often observed near you</h1>
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

function StatusView({
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
      <h1>{heading}</h1>
      <p>{description}</p>
      <button className={styles.primaryButton} onClick={onAction} type="button">
        {action}
      </button>
    </div>
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

function liveMessage(state: ViewState): string {
  if (state.status === "locating") return "Finding your approximate area.";
  if (state.status === "loading") return "Loading nearby fungi.";
  if (state.status === "success") return `${state.data.results.length} fungi results loaded.`;
  if (state.status === "empty") return "No nearby fungi results found.";
  if (state.status === "idle") return "Ready to find nearby fungi.";
  return "Nearby fungi status changed.";
}

function subscribeToHydration(): () => void {
  return () => undefined;
}
