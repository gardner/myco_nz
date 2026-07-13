"use client";

import { LockKeyhole, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { GazetteerAttribution } from "@/components/gazetteer-attribution";
import styles from "@/components/map-experience.module.css";
import { NzAreaMap } from "@/components/nz-area-map";
import {
  formatApproximatePlace,
  getApproximatePlaceForCell,
} from "@/lib/approximate-place";
import {
  coordinatesToApproximateCell,
  handoffLocationCell,
  markResultsForFocus,
} from "@/lib/client-location";
import { AREA_GROUPS, getMapArea } from "@/lib/map-areas";
import {
  buildSharedLocationUrl,
  parseSharedLocationSearch,
  parseSharedMonthSearch,
} from "@/lib/shared-location";
import { validateLocationCell } from "@/lib/validation";

export function MapExperience() {
  const router = useRouter();
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedMapCell, setSelectedMapCell] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [hasError, setHasError] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const operationGeneration = useRef(0);
  const selectedMonth = useRef(currentMonth());
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);

  useEffect(() => {
    const search = window.location.search;
    const shared = parseSharedLocationSearch(search);
    selectedMonth.current = parseSharedMonthSearch(search) ?? currentMonth();
    const restoredCell = shared && validateLocationCell(shared.cell).ok
      ? shared.cell
      : null;
    const restoreTimer = restoredCell
      ? window.setTimeout(() => {
          setSelectedMapCell(restoredCell);
          const label = formatApproximatePlace(
            getApproximatePlaceForCell(restoredCell),
          );
          setStatus(`${label} is selected on the map.`);
        }, 0)
      : undefined;
    heading.current?.focus();
    return () => {
      if (restoreTimer !== undefined) window.clearTimeout(restoreTimer);
      operationGeneration.current += 1;
    };
  }, []);

  const chooseLocation = useCallback(
    async (latitude: number, longitude: number) => {
      if (selecting) return;
      const generation = ++operationGeneration.current;
      setSelecting(true);
      setHasError(false);
      setStatus("Area selected. Loading nearby fungi.");
      try {
        const cell = await coordinatesToApproximateCell(latitude, longitude);
        if (generation !== operationGeneration.current) return;
        handoffLocationCell(cell);
        markResultsForFocus();
        router.push(buildSharedLocationUrl(cell, selectedMonth.current));
      } catch {
        if (generation !== operationGeneration.current) return;
        setSelecting(false);
        setHasError(true);
        setStatus("We couldn't use that area. Try another point or choose a named area.");
      }
    },
    [router, selecting],
  );

  const selectMapCell = (cell: string) => {
    setSelectedMapCell(cell);
    setSelectedArea("");
    setHasError(false);
    setStatus("Map area selected. Confirm to see nearby fungi.");
  };

  const chooseMapCell = () => {
    if (!selectedMapCell || selecting) return;
    operationGeneration.current += 1;
    setSelecting(true);
    setHasError(false);
    setStatus("Area selected. Loading nearby fungi.");
    handoffLocationCell(selectedMapCell);
    markResultsForFocus();
    router.push(buildSharedLocationUrl(selectedMapCell, selectedMonth.current));
  };

  const chooseNamedArea = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const location = getMapArea(selectedArea);
    if (location) void chooseLocation(location.latitude, location.longitude);
  };

  const previewNamedArea = (areaId: string) => {
    const location = getMapArea(areaId);
    setSelectedArea(areaId);
    setSelectedMapCell(null);
    setHasError(false);
    setStatus(location ? `${location.name} is selected as a named area.` : "");
  };

  const showConversionError = () => {
    setHasError(true);
    setStatus("We couldn't use that area. Try another point or choose a named area.");
  };

  return (
    <section
      className={styles.experience}
      aria-busy={selecting}
      data-ready={hydrated ? "true" : "false"}
    >
      <p className={styles.eyebrow}>No device location required</p>
      <h1 ref={heading} tabIndex={-1}>Choose an area</h1>
      <p className={styles.intro}>
        Select somewhere in Aotearoa New Zealand to see fungi observed nearby.
      </p>
      <p
        className={hasError ? styles.feedback : "sr-only"}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {status}
      </p>

      <NzAreaMap
        hydrated={hydrated && !selecting}
        selectedArea={getMapArea(selectedArea)}
        selectedCell={selectedMapCell}
        onSelectCell={selectMapCell}
        onConversionError={showConversionError}
      />

      {selectedMapCell && (
        <button
          className={styles.mapSelectionAction}
          type="button"
          disabled={!hydrated || selecting}
          onClick={chooseMapCell}
        >
          <MapPin aria-hidden="true" size={19} />
          {selecting ? "Loading nearby fungi..." : "Use selected map area"}
        </button>
      )}

      <form className={styles.namedAreaForm} onSubmit={chooseNamedArea}>
        <label htmlFor="named-area">Choose a named area</label>
        <div className={styles.namedAreaControls}>
          <select
            id="named-area"
            value={selectedArea}
            onChange={(event) => previewNamedArea(event.target.value)}
            disabled={!hydrated || selecting}
          >
            <option value="">Select a town or city</option>
            {AREA_GROUPS.map((group) => (
              <optgroup label={group.label} key={group.label}>
                {group.areas.map((location) => (
                  <option value={location.id} key={location.id}>{location.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <button type="submit" disabled={!hydrated || !selectedArea || selecting}>
            <MapPin aria-hidden="true" size={19} />
            {selecting ? "Loading nearby fungi..." : "Show fungi near this area"}
          </button>
        </div>
      </form>

      <p className={styles.privacy}>
        <LockKeyhole aria-hidden="true" size={17} />
        <span>
          Your chosen point is converted on this device. We send only{" "}
          <a
            href="https://h3geo.org/docs"
            target="_blank"
            rel="noopener noreferrer"
          >
            an approximate area
            <span className="sr-only"> (opens H3 documentation in a new tab)</span>
          </a>
          {" "}directly to iNaturalist and store only that area on this device.
        </span>
      </p>
      <p className={styles.provenance}>
        Map outline: Natural Earth. Place names: <GazetteerAttribution />.
      </p>
    </section>
  );
}

function subscribeToHydration(): () => void {
  return () => undefined;
}

function currentMonth(): number {
  return new Date().getMonth() + 1;
}
