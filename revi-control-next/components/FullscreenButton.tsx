"use client";

// Presentation mode — toggles browser fullscreen for showing the app on a big
// screen in buyer meetings. Client component (needs onClick + the Fullscreen API).
export default function FullscreenButton() {
  const toggle = () => {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      (el.requestFullscreen?.() ?? Promise.resolve()).catch(() => { /* ignore */ });
    } else {
      document.exitFullscreen?.().catch(() => { /* ignore */ });
    }
  };
  return (
    <button className="pt-btn ghost" onClick={toggle} title="הצג במסך מלא למצגת">
      ⛶ מצב מצגת
    </button>
  );
}
