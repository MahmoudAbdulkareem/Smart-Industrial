import React from "react";

const W = 1200;
const H = 28;

/**
 * A thin waveform strip driven entirely by `history`: the real rolling buffer of
 * fleet-average health scores from useFleetPulse (sourced from the backend's
 * `sensor:reading` broadcast). No random noise is added here — if history is empty,
 * the ribbon renders flat and dim rather than faking activity.
 */
export default function PulseRibbon({ history = [], tone = "normal" }) {
    const toneColor = {
        normal: "var(--status-normal)",
        elevated: "var(--status-elevated)",
        critical: "var(--status-critical)",
    }[tone] || "var(--status-normal)";

    const points = buildPoints(history);

    return (
        <div className="w-full h-[28px] overflow-hidden bg-base-panel/60 dark:bg-base-panel/60">
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full">
                <polyline
                    points={points}
                    fill="none"
                    stroke={toneColor}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={history.length ? 0.9 : 0.25}
                />
            </svg>
        </div>
    );
}

function buildPoints(history) {
    if (!history.length) {
        return `0,${H / 2} ${W},${H / 2}`;
    }
    const min = 0;
    const max = 100;
    const step = W / Math.max(history.length - 1, 1);
    return history
        .map((v, i) => {
            const x = i * step;
            const clamped = Math.min(max, Math.max(min, v));
            const y = H - (clamped / max) * H;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");
}
