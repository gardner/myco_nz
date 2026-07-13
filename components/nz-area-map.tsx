"use client";

import { type MouseEvent, type PointerEvent, useMemo, useState } from "react";

import styles from "@/components/map-experience.module.css";
import {
  formatApproximatePlace,
  getApproximatePlaceForCell,
  getCellGeometry,
  locationToApproximateCell,
} from "@/lib/approximate-place";
import type { MapArea } from "@/lib/map-areas";
import {
  CHATHAM_PATHS,
  CHATHAM_VIEW_BOX,
  clientPointToLocation,
  MAINLAND_PATHS,
  MAINLAND_VIEW_BOX,
} from "@/lib/nz-map-geometry";

type MapKind = "mainland" | "chatham";
type MapPreview = Readonly<{ cell: string; map: MapKind }>;

export function NzAreaMap({
  hydrated,
  selectedArea,
  selectedCell,
  onSelectCell,
  onConversionError,
}: {
  hydrated: boolean;
  selectedArea?: MapArea;
  selectedCell?: string | null;
  onSelectCell: (cell: string) => void;
  onConversionError: () => void;
}) {
  const [hovered, setHovered] = useState<MapPreview | null>(null);
  const selected = useMemo(() => {
    if (selectedCell) return previewForCell(selectedCell);
    return selectedArea
      ? previewForLocation(selectedArea.latitude, selectedArea.longitude)
      : null;
  }, [selectedArea, selectedCell]);
  const preview = selected ?? hovered;

  const previewPoint = (map: MapKind) => (event: PointerEvent<SVGGElement>) => {
    if (event.pointerType === "touch") return;
    const location = readMapLocation(event);
    if (!location) return;
    const cell = locationToApproximateCell(location.latitude, location.longitude);
    setHovered((current) => current?.cell === cell && current.map === map
      ? current
      : { cell, map });
  };

  const choosePoint = (event: MouseEvent<SVGGElement>) => {
    const location = readMapLocation(event);
    if (!location) {
      onConversionError();
      return;
    }
    onSelectCell(locationToApproximateCell(location.latitude, location.longitude));
  };

  return (
    <div
      className={styles.mapFrame}
      role="img"
      aria-labelledby="nz-map-title nz-map-description"
    >
      <span className="sr-only" id="nz-map-title">Map of Aotearoa New Zealand</span>
      <span className="sr-only" id="nz-map-description">
        Choose a point on the map and confirm it below, or use the named-area list.
      </span>
      <svg
        className={styles.mainlandMap}
        viewBox={MAINLAND_VIEW_BOX}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <g
          data-testid="mainland-land"
          onClick={hydrated ? choosePoint : undefined}
          onPointerMove={hydrated ? previewPoint("mainland") : undefined}
          onPointerLeave={() => setHovered(null)}
        >
          {MAINLAND_PATHS.map((path) => <path className={styles.land} d={path} key={path} />)}
        </g>
        {preview?.map === "mainland" && <CellPreview cell={preview.cell} map="mainland" />}
      </svg>
      <div className={styles.chathamInset}>
        <span>Chatham Islands</span>
        <svg
          viewBox={CHATHAM_VIEW_BOX}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <g
            onClick={hydrated ? choosePoint : undefined}
            onPointerMove={hydrated ? previewPoint("chatham") : undefined}
            onPointerLeave={() => setHovered(null)}
          >
            {CHATHAM_PATHS.map((path) => <path className={styles.land} d={path} key={path} />)}
          </g>
          {preview?.map === "chatham" && <CellPreview cell={preview.cell} map="chatham" />}
        </svg>
      </div>
      {preview && <MapReadout cell={preview.cell} />}
    </div>
  );
}

function CellPreview({ cell, map }: { cell: string; map: MapKind }) {
  const geometry = getCellGeometry(cell);
  const [latitude, longitude] = geometry.centre;
  const points = geometry.boundary
    .map(([boundaryLatitude, boundaryLongitude]) =>
      `${boundaryLongitude},${-boundaryLatitude}`)
    .join(" ");
  return (
    <g
      className={styles.cellPreview}
      data-testid="map-cell-preview"
      pointerEvents="none"
    >
      <circle
        className={styles.cellHalo}
        cx={longitude}
        cy={-latitude}
        r={map === "mainland" ? 0.13 : 0.014}
      />
      <polygon className={styles.cellPolygon} points={points} />
      <circle
        className={styles.cellCentre}
        cx={longitude}
        cy={-latitude}
        r={map === "mainland" ? 0.035 : 0.005}
      />
    </g>
  );
}

function MapReadout({ cell }: { cell: string }) {
  const place = getApproximatePlaceForCell(cell);
  return (
    <div className={styles.mapReadout} aria-hidden="true">
      <span>Approximate area</span>
      <strong data-testid="map-place-label">{formatApproximatePlace(place)}</strong>
    </div>
  );
}

function previewForLocation(latitude: number, longitude: number): MapPreview {
  return previewForCell(locationToApproximateCell(latitude, longitude));
}

function previewForCell(cell: string): MapPreview {
  const [, longitude] = getCellGeometry(cell).centre;
  return { cell, map: longitude < 0 ? "chatham" : "mainland" };
}

function readMapLocation(event: MouseEvent<SVGGElement> | PointerEvent<SVGGElement>) {
  const svg = event.currentTarget.ownerSVGElement;
  return svg ? clientPointToLocation(svg, event.clientX, event.clientY) : null;
}
