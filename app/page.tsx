import { LocationExperience } from "@/components/location-experience";

export const dynamic = "force-static";

export default function Home() {
  return (
    <main className="page-shell">
      <div className="page-content">
        <LocationExperience />
      </div>
    </main>
  );
}
