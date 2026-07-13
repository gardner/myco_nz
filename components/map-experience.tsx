"use client";

import { LockKeyhole, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import styles from "@/components/map-experience.module.css";
import {
  coordinatesToApproximateCell,
  handoffLocationCell,
  markResultsForFocus,
} from "@/lib/client-location";
import {
  CHATHAM_PATHS,
  CHATHAM_VIEW_BOX,
  clientPointToLocation,
  MAINLAND_PATHS,
  MAINLAND_VIEW_BOX,
} from "@/lib/nz-map-geometry";
import { buildSharedLocationUrl } from "@/lib/shared-location";

type NamedArea = Readonly<{
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}>;

const AREA_GROUPS = [
  {
    label: "North Island",
    areas: [
      area("kaitaia", "Kaitaia", -35.1149, 173.2637),
      area("whangarei", "Whangarei", -35.7251, 174.3237),
      area("auckland", "Auckland", -36.8509, 174.7645),
      area("hamilton", "Hamilton", -37.787, 175.2793),
      area("tauranga", "Tauranga", -37.6878, 176.1651),
      area("rotorua", "Rotorua", -38.1368, 176.2497),
      area("gisborne", "Gisborne", -38.6623, 178.0176),
      area("new-plymouth", "New Plymouth", -39.0556, 174.0752),
      area("napier", "Napier", -39.4928, 176.912),
      area("palmerston-north", "Palmerston North", -40.3564, 175.6111),
      area("wellington", "Wellington", -41.2866, 174.7756),
    ],
  },
  {
    label: "South Island and Rakiura",
    areas: [
      area("nelson", "Nelson", -41.2706, 173.284),
      area("blenheim", "Blenheim", -41.5134, 173.9612),
      area("westport", "Westport", -41.7526, 171.6037),
      area("christchurch", "Christchurch", -43.5321, 172.6362),
      area("greymouth", "Greymouth", -42.4504, 171.2108),
      area("queenstown", "Queenstown", -45.0312, 168.6626),
      area("dunedin", "Dunedin", -45.8788, 170.5028),
      area("invercargill", "Invercargill", -46.4132, 168.3538),
      area("oban", "Oban, Rakiura", -46.8997, 168.1294),
    ],
  },
  {
    label: "Chatham Islands",
    areas: [area("waitangi", "Waitangi", -43.9535, -176.5597)],
  },
] as const;

const NAMED_AREAS = AREA_GROUPS.flatMap((group) => group.areas);

export function MapExperience() {
  const router = useRouter();
  const [selectedArea, setSelectedArea] = useState("");
  const [status, setStatus] = useState("");
  const [hasError, setHasError] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const operationGeneration = useRef(0);
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);

  useEffect(() => {
    heading.current?.focus();
    return () => {
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
        router.push(buildSharedLocationUrl(cell, new Date().getMonth() + 1));
      } catch {
        if (generation !== operationGeneration.current) return;
        setSelecting(false);
        setHasError(true);
        setStatus("We couldn't use that area. Try another point or choose a named area.");
      }
    },
    [router, selecting],
  );

  const chooseMapPoint = useCallback(
    (event: MouseEvent<SVGGElement>) => {
      const svg = event.currentTarget.ownerSVGElement;
      const location = svg
        ? clientPointToLocation(svg, event.clientX, event.clientY)
        : null;
      if (!location) {
        setHasError(true);
        setStatus("We couldn't use that area. Try another point or choose a named area.");
        return;
      }
      void chooseLocation(location.latitude, location.longitude);
    },
    [chooseLocation],
  );

  const chooseNamedArea = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const location = NAMED_AREAS.find((candidate) => candidate.id === selectedArea);
    if (location) void chooseLocation(location.latitude, location.longitude);
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

      <div
        className={styles.mapFrame}
        role="img"
        aria-labelledby="nz-map-title nz-map-description"
      >
        <span className="sr-only" id="nz-map-title">Map of Aotearoa New Zealand</span>
        <span className="sr-only" id="nz-map-description">
          Choose a point on the map, or use the named-area list below.
        </span>
        <svg
          className={styles.mainlandMap}
          viewBox={MAINLAND_VIEW_BOX}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <g data-testid="mainland-land" onClick={hydrated ? chooseMapPoint : undefined}>
            {MAINLAND_PATHS.map((path) => <path className={styles.land} d={path} key={path} />)}
          </g>
        </svg>
        <div className={styles.chathamInset}>
          <span>Chatham Islands</span>
          <svg
            viewBox={CHATHAM_VIEW_BOX}
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <g onClick={hydrated ? chooseMapPoint : undefined}>
              {CHATHAM_PATHS.map((path) => <path className={styles.land} d={path} key={path} />)}
            </g>
          </svg>
        </div>
      </div>

      <form className={styles.namedAreaForm} onSubmit={chooseNamedArea}>
        <label htmlFor="named-area">Choose a named area</label>
        <div className={styles.namedAreaControls}>
          <select
            id="named-area"
            value={selectedArea}
            onChange={(event) => setSelectedArea(event.target.value)}
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
          Your chosen point is converted on this device. We send and store only{" "}
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
      <p className={styles.provenance}>Map outline: Natural Earth, public domain.</p>
    </section>
  );
}

function area(
  id: string,
  name: string,
  latitude: number,
  longitude: number,
): NamedArea {
  return { id, name, latitude, longitude };
}

function subscribeToHydration(): () => void {
  return () => undefined;
}
