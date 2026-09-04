"use client";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import ShiftWizard from "@/components/ShiftWizard";

// Leaflet touches window at import time — client only.
const LiveMap = dynamic(() => import("@/components/LiveMap"), { ssr: false });

// Transport bar drives LiveMap by dispatching the same keyboard events it
// already listens for on document (Space=play/pause, ←/→=seek, R=restart).
// Zero changes to LiveMap internals.
function key(code: string, k: string) {
  document.dispatchEvent(new KeyboardEvent("keydown", { code, key: k, bubbles: true }));
}

function TransportBar({ onExit }: { onExit: () => void }) {
  const [playing, setPlaying] = useState(true);

  const toggle = () => { key("Space", " "); setPlaying(p => !p); };
  const back = () => { key("ArrowLeft", "ArrowLeft"); setPlaying(false); };
  const fwd = () => { key("ArrowRight", "ArrowRight"); setPlaying(false); };
  const restart = () => { key("KeyR", "r"); setPlaying(true); };
  const stop = () => { key("KeyR", "r"); setTimeout(() => { key("Space", " "); setPlaying(false); }, 30); };

  return (
    <div className="tp-bar">
      <div className="tp-group">
        <button className="tp-btn" onClick={restart} title="מהתחלה">⏮</button>
        <button className="tp-btn" onClick={back} title="אחורה">⏪</button>
        <button className="tp-btn play" onClick={toggle} title="הפעל / השהה">{playing ? "⏸" : "▶"}</button>
        <button className="tp-btn" onClick={fwd} title="קדימה">⏩</button>
        <button className="tp-btn" onClick={stop} title="עצור">⏹</button>
      </div>
      <div className="tp-hint">רווח = השהה · ← → דילוג · גרור את הבסיס ופינות האזור על המפה</div>
      <button className="tp-exit" onClick={onExit}>↩ אשף חדש</button>
    </div>
  );
}

function CockpitInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const launched = !!sp.get("drones");

  if (!launched) return <ShiftWizard />;

  // key on the query so changing the mission remounts LiveMap cleanly.
  const q = sp.toString();
  return (
    <div className="cockpit-mode">
      <LiveMap key={q} />
      <TransportBar onExit={() => router.push("/cockpit")} />
    </div>
  );
}

export default function CockpitClient() {
  return (
    <Suspense fallback={null}>
      <CockpitInner />
    </Suspense>
  );
}
