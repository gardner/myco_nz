import { LocationExperience } from "@/components/location-experience";

export default function Home() {
  return (
    <main className="page-shell">
      <div className="page-content">
        <header className="brand" aria-label="Nearby Fungi">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/fungi-placeholder.svg" width="34" height="34" alt="" />
          <span>Nearby Fungi</span>
        </header>
        <LocationExperience />
      </div>
    </main>
  );
}
