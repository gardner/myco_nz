"use client";

import { ExternalLink } from "lucide-react";

import styles from "@/components/fungi-list.module.css";
import type { FungiResult } from "@/lib/types";

const PLACEHOLDER_URL = "/fungi-placeholder.svg";

export function FungiList({ results }: { results: FungiResult[] }) {
  return (
    <ol className={styles.list} aria-label="Fungi ranked by nearby observations">
      {results.map((result, index) => (
        <li key={result.taxonId}>
          <FungiCard result={result} index={index} />
        </li>
      ))}
    </ol>
  );
}

function FungiCard({ result, index }: { result: FungiResult; index: number }) {
  const displayName = result.commonName ?? "No common name listed";
  const hasPhoto = result.image !== null;

  return (
    <article className={styles.card}>
      <div className={styles.media}>
        {/* Direct source thumbnails preserve iNaturalist attribution without an image proxy. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.image}
          src={result.image?.url ?? PLACEHOLDER_URL}
          width={112}
          height={112}
          alt={hasPhoto ? `Photo of ${displayName} (${result.scientificName})` : ""}
          loading={index < 3 ? "eager" : "lazy"}
          decoding="async"
          onError={(event) => {
            event.currentTarget.src = PLACEHOLDER_URL;
            event.currentTarget.alt = "";
          }}
        />
        {result.image && (
          <p className={styles.credit}>
            {result.image.attribution && <span>{result.image.attribution}</span>}
            {result.image.licenseCode && (
              <span>{formatLicense(result.image.licenseCode)}</span>
            )}
          </p>
        )}
      </div>

      <div className={styles.details}>
        <span className={styles.rank} aria-label={`Rank ${result.rank}`}>
          {result.rank}
        </span>
        <h2>{displayName}</h2>
        <i className={styles.scientific}>{result.scientificName}</i>
        <p className={styles.evidence}>{result.observationCountLabel}</p>
        <a
          className={styles.link}
          href={result.observationsUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          View nearby observations
          <ExternalLink aria-hidden="true" size={16} strokeWidth={2} />
          <span className="sr-only"> on iNaturalist NZ (opens in a new tab)</span>
        </a>
      </div>
    </article>
  );
}

function formatLicense(code: string): string {
  return code.replace(/^cc-/, "CC ").toUpperCase();
}
