"use client";
import dynamic from "next/dynamic";

// Leaflet touches window at import time, so load the map only on the client.
const LiveMap = dynamic(() => import("@/components/LiveMap"), { ssr: false });

export default function Page() {
      return <LiveMap />;
}
