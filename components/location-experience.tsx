"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import styles from "@/components/location-experience.module.css";
import {
  BrandHeader,
  LocationGate,
  ResultsView,
  StatusView,
} from "@/components/location-views";
import {
  consumeLocationHandoff,
  consumeResultsFocus,
  clearStoredLocationCell,
  getApproximateCell,
  getLocationSeed,
  LocationAccessError,
  readStoredLocation,
  storeLocationCell,
} from "@/lib/client-location";
import { fetchFungi, FungiClientError } from "@/lib/fungi-client";
import {
  buildSharedLocationUrl,
  parseSharedLocationSearch,
} from "@/lib/shared-location";
import type { FungiResponse } from "@/lib/types";

type ViewState =
  | { status: "idle" | "locating" | "unsupported" | "unavailable" }
  | { status: "loading"; cell: string; month: number }
  | { status: "success" | "empty"; data: FungiResponse; cell: string; month: number }
  | { status: "error" | "invalid" | "outside"; cell: string; month: number };

type InitialSelection = Readonly<{
  cell: string | null;
  month: number;
  shouldFocus: boolean;
}>;

export function LocationExperience() {
  const router = useRouter();
  const [state, setState] = useState<ViewState>({ status: "idle" });
  const activeRequest = useRef<AbortController | null>(null);
  const operationGeneration = useRef(0);
  const selectedMonth = useRef(currentMonth());
  const focusAfterAction = useRef(false);
  const experience = useRef<HTMLElement | null>(null);
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);

  const loadResults = useCallback(async (cell: string, month: number, generation?: number) => {
    const currentGeneration = generation ?? ++operationGeneration.current;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    selectedMonth.current = month;
    window.history.replaceState(window.history.state, "", buildSharedLocationUrl(cell, month));
    setState({ status: "loading", cell, month });

    try {
      const data = await fetchFungi(cell, month, controller.signal);
      if (currentGeneration !== operationGeneration.current) return;
      storeLocationCell(cell);
      setState({ status: data.results.length ? "success" : "empty", data, cell, month });
    } catch (error) {
      if (controller.signal.aborted || currentGeneration !== operationGeneration.current) return;
      const status = resultErrorStatus(error);
      if (status === "invalid" || status === "outside") clearStoredLocationCell(cell);
      setState({ status, cell, month });
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
      await loadResults(cell, selectedMonth.current, currentGeneration);
    } catch (error) {
      if (currentGeneration !== operationGeneration.current) return;
      if (!(error instanceof LocationAccessError)) {
        setState({ status: "unavailable" });
        return;
      }
      if (error.code === "denied") {
        router.replace(mapUrl(selectedMonth.current));
        return;
      }
      setState({ status: error.code });
    }
  }, [loadResults, router]);

  useEffect(() => {
    const initial = getInitialSelection(window.location.search);
    const cell = initial.cell;
    const restoreTimer = cell
      ? window.setTimeout(() => {
          focusAfterAction.current = initial.shouldFocus;
          void loadResults(cell, initial.month);
        }, 0)
      : undefined;
    return () => {
      if (restoreTimer !== undefined) window.clearTimeout(restoreTimer);
      operationGeneration.current += 1;
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
      {!hasResultsShell(state) && <BrandHeader />}
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
  loadResults: (cell: string, month: number) => Promise<void>;
}) {
  switch (state.status) {
    case "loading":
    case "success":
    case "empty":
      return (
        <ResultsView
          data={state.status === "loading" ? undefined : state.data}
          month={state.month}
          onRefresh={requestLocation}
          onSelectMonth={(month) => loadResults(state.cell, month)}
        />
      );
    case "invalid":
      return (
        <StatusView
          heading="This shared area isn't valid"
          description="Choose an area on the map or refresh your location to continue."
          action="Refresh location"
          onAction={requestLocation}
          secondaryAction={{ href: mapUrl(state.month), label: "Choose on map" }}
        />
      );
    case "error":
      return (
        <StatusView
          heading="We couldn't load fungi right now"
          description="iNaturalist may be temporarily unavailable. Your approximate area is ready to retry."
          action="Try again"
          onAction={() => loadResults(state.cell, state.month)}
        />
      );
    case "outside":
      return (
        <StatusView
          heading="Nearby Fungi currently covers Aotearoa New Zealand"
          description="Refresh your location when you are back within the supported area."
          action="Refresh location"
          onAction={requestLocation}
          secondaryAction={{ href: mapUrl(state.month), label: "Choose on map" }}
        />
      );
    case "unsupported":
      return (
        <StatusView
          heading="Location isn't available"
          description="This browser or device does not provide location access."
          action="Try again"
          onAction={requestLocation}
          secondaryAction={{ href: "/map", label: "Choose on map" }}
        />
      );
    case "unavailable":
      return (
        <StatusView
          heading="We couldn't find your area"
          description="Check your device location settings and try again."
          action="Try again"
          onAction={requestLocation}
          secondaryAction={{ href: "/map", label: "Choose on map" }}
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
  if (state.status === "unsupported") return "Location is not available in this browser.";
  if (state.status === "unavailable") return "Your approximate area could not be found.";
  if (state.status === "outside") return "Nearby Fungi currently covers Aotearoa New Zealand.";
  if (state.status === "invalid") return "This shared area is not valid.";
  return "Nearby fungi could not be loaded.";
}

function subscribeToHydration(): () => void {
  return () => undefined;
}

function currentMonth(): number {
  return new Date().getMonth() + 1;
}

function mapUrl(month: number): string {
  return `/map?month=${month}`;
}

function hasResultsShell(state: ViewState): boolean {
  return state.status === "loading" || state.status === "success" || state.status === "empty";
}

function resultErrorStatus(error: unknown): "error" | "invalid" | "outside" {
  if (!(error instanceof FungiClientError)) return "error";
  if (error.code === "invalid-location") return "invalid";
  if (error.code === "outside-new-zealand") return "outside";
  return "error";
}

function getInitialSelection(search: string): InitialSelection {
  const handedOffCell = consumeLocationHandoff();
  const shared = parseSharedLocationSearch(search);
  const stored = readStoredLocation();
  const storedCell = stored ? stored.cell : null;
  const seedDisabled = new URLSearchParams(search).has("disable_location_seed");
  const seedCell = seedDisabled ? null : getLocationSeed();
  const candidates = [shared ? shared.cell : null, handedOffCell, storedCell, seedCell];
  const cell =
    candidates.find((candidate): candidate is string => typeof candidate === "string") ?? null;
  const markedForFocus = cell ? consumeResultsFocus() : false;
  return {
    cell,
    month: shared ? shared.month : currentMonth(),
    shouldFocus: handedOffCell ? true : markedForFocus,
  };
}
