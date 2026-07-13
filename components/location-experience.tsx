"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import styles from "@/components/location-experience.module.css";
import {
  EmptyView,
  LoadingView,
  LocationGate,
  ResultsView,
  StatusView,
} from "@/components/location-views";
import {
  getApproximateCell,
  LocationAccessError,
  readStoredLocation,
  storeLocationCell,
} from "@/lib/client-location";
import { fetchFungi, FungiClientError } from "@/lib/fungi-client";
import type { FungiResponse } from "@/lib/types";

type ViewState =
  | { status: "idle" | "locating" | "denied" | "unsupported" | "unavailable" }
  | { status: "loading"; cell: string }
  | { status: "success" | "empty"; data: FungiResponse; cell: string }
  | { status: "error" | "outside"; cell: string };

export function LocationExperience() {
  const [state, setState] = useState<ViewState>({ status: "idle" });
  const activeRequest = useRef<AbortController | null>(null);
  const operationGeneration = useRef(0);
  const focusAfterAction = useRef(false);
  const experience = useRef<HTMLElement | null>(null);
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);

  const loadResults = useCallback(async (cell: string, generation?: number) => {
    const currentGeneration = generation ?? ++operationGeneration.current;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setState({ status: "loading", cell });

    try {
      const month = new Date().getMonth() + 1;
      const data = await fetchFungi(cell, month, controller.signal);
      if (currentGeneration !== operationGeneration.current) return;
      setState({ status: data.results.length ? "success" : "empty", data, cell });
    } catch (error) {
      if (controller.signal.aborted || currentGeneration !== operationGeneration.current) return;
      const status =
        error instanceof FungiClientError && error.code === "outside-new-zealand"
          ? "outside"
          : "error";
      setState({ status, cell });
    }
  }, []);

  const requestLocation = useCallback(async () => {
    const currentGeneration = ++operationGeneration.current;
    activeRequest.current?.abort();
    focusAfterAction.current = true;
    setState({ status: "locating" });
    try {
      const cell = await getApproximateCell(navigator.geolocation ?? null);
      if (currentGeneration !== operationGeneration.current) return;
      storeLocationCell(cell);
      await loadResults(cell, currentGeneration);
    } catch (error) {
      if (currentGeneration !== operationGeneration.current) return;
      if (!(error instanceof LocationAccessError)) {
        setState({ status: "unavailable" });
        return;
      }
      setState({ status: error.code });
    }
  }, [loadResults]);

  const retryResults = useCallback(
    async (cell: string) => {
      focusAfterAction.current = true;
      await loadResults(cell);
    },
    [loadResults],
  );

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

  useEffect(() => {
    if (!focusAfterAction.current || state.status === "locating" || state.status === "loading") {
      return;
    }
    experience.current?.querySelector<HTMLElement>("h1")?.focus();
    focusAfterAction.current = false;
  }, [state.status]);

  return (
    <section className={styles.experience} ref={experience}>
      <p className="sr-only" role="status" aria-live="polite">
        {liveMessage(state)}
      </p>
      <StateView
        state={state}
        hydrated={hydrated}
        requestLocation={requestLocation}
        loadResults={retryResults}
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

function liveMessage(state: ViewState): string {
  if (state.status === "locating") return "Finding your approximate area.";
  if (state.status === "loading") return "Loading nearby fungi.";
  if (state.status === "success") return `${state.data.results.length} fungi results loaded.`;
  if (state.status === "empty") return "No nearby fungi results found.";
  if (state.status === "idle") return "Ready to find nearby fungi.";
  if (state.status === "denied") return "Location access is off.";
  if (state.status === "unsupported") return "Location is not available in this browser.";
  if (state.status === "unavailable") return "Your approximate area could not be found.";
  if (state.status === "outside") return "Nearby Fungi currently covers Aotearoa New Zealand.";
  return "Nearby fungi could not be loaded.";
}

function subscribeToHydration(): () => void {
  return () => undefined;
}
