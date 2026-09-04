import CockpitClient from "@/components/CockpitClient";

// Root is the operator entry: the shift wizard (and the live cockpit once launched).
// The raw live map stays available at /map.
export const metadata = { title: "Revi-Control — חדר בקרה" };
export default function Page() {
  return <CockpitClient />;
}
