import { useEffect, useRef, useState } from "react";
import { useSocket } from "./useSocket";

const STORAGE_KEY = "alarmEnabled";

/**
 * Plays a short industrial-style double-beep via the Web Audio API whenever the
 * backend emits a real `alert:new` socket event with severity "critical". No audio
 * file dependency, and no invented alerts — this only reacts to the genuine alert
 * stream your rule engine / ML pipeline already produces.
 */
export function useAudibleAlarm() {
    const [enabled, setEnabled] = useState(() => localStorage.getItem(STORAGE_KEY) !== "0");
    const ctxRef = useRef(null);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
    }, [enabled]);

    function beep() {
        if (!enabled) return;
        try {
            if (!ctxRef.current) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                ctxRef.current = new AudioCtx();
            }
            const ctx = ctxRef.current;
            const now = ctx.currentTime;
            [0, 0.22].forEach((offset) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "square";
                osc.frequency.setValueAtTime(880, now + offset);
                gain.gain.setValueAtTime(0.0001, now + offset);
                gain.gain.exponentialRampToValueAtTime(0.15, now + offset + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18);
                osc.connect(gain).connect(ctx.destination);
                osc.start(now + offset);
                osc.stop(now + offset + 0.2);
            });
        } catch {
            // Audio not available (autoplay policy before first user gesture) — safe no-op.
        }
    }

    useSocket({
        "alert:new": (alert) => {
            if ((alert?.severity || "").toLowerCase() === "critical") beep();
        },
    });

    return { enabled, setEnabled };
}
