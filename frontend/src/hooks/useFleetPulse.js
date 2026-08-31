import { useEffect, useRef, useState } from "react";
import { useSocket } from "./useSocket";
import { useSocketContext } from "../context/SocketContext";

const RIBBON_LENGTH = 60; // samples kept for the live pulse ribbon

/**
 * Aggregates the real `sensor:reading` broadcast (emitted by backend/services/broadcastService.js
 * every ~7s per asset) into fleet-level numbers used across the shell:
 * - global health score (mean of latest reading per asset)
 * - active alert count (assets currently WARNING/CRITICAL)
 * - last-message timestamp (used to show live latency, not a fabricated ping)
 * - a rolling history of the fleet health score, for the pulse ribbon
 *
 * This intentionally does not invent any numbers — if no sockets have arrived yet,
 * values are null/empty so the UI can show "awaiting data" rather than a fake reading.
 */
export function useFleetPulse() {
    const { isConnected } = useSocketContext();
    const [assets, setAssets] = useState({}); // assetId -> latest reading
    const [lastMessageAt, setLastMessageAt] = useState(null);
    const historyRef = useRef([]);
    const [history, setHistory] = useState([]);

    useSocket({
        "sensor:reading": (reading) => {
            setAssets((prev) => ({ ...prev, [reading.assetId]: reading }));
            setLastMessageAt(Date.now());
        },
    });

    useEffect(() => {
        const values = Object.values(assets);
        if (!values.length) return;
        const avgHealth =
            values.reduce((sum, a) => sum + (Number(a.healthScore) || 0), 0) / values.length;
        historyRef.current = [...historyRef.current, avgHealth].slice(-RIBBON_LENGTH);
        setHistory(historyRef.current);
    }, [assets]);

    const values = Object.values(assets);
    const globalHealth = values.length
        ? values.reduce((sum, a) => sum + (Number(a.healthScore) || 0), 0) / values.length
        : null;
    const activeAlerts = values.filter(
        (a) => a.status && a.status.toLowerCase() !== "normal" && a.status.toLowerCase() !== "ok"
    ).length;

    return {
        isConnected,
        assets: values,
        globalHealth,
        activeAlerts,
        lastMessageAt,
        history,
    };
}
