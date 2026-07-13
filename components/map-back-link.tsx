"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

import {
  buildSharedLocationUrl,
  parseSharedLocationSearch,
} from "@/lib/shared-location";

export function MapBackLink({ className }: { className: string }) {
  const href = useSyncExternalStore(subscribeToLocation, currentResultsUrl, () => "/");

  return (
    <Link
      className={className}
      href={href}
      aria-label="Back to Nearby Fungi"
      title="Back to Nearby Fungi"
    >
      <ArrowLeft aria-hidden="true" size={20} />
    </Link>
  );
}

function subscribeToLocation(): () => void {
  return () => undefined;
}

function currentResultsUrl(): string {
  const shared = parseSharedLocationSearch(window.location.search);
  return shared ? buildSharedLocationUrl(shared.cell, shared.month) : "/";
}
