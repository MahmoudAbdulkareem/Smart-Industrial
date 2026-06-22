import { useState, useEffect, useCallback, useRef } from "react";
import { useSocket } from "./useSocket";

export function useApi(path, interval = 0) {
    const [data,    setData]    = useState(null);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState(null);
    const pathRef = useRef(path);

    const fetch_ = useCallback(async () => {
        try {
            const token = localStorage.getItem("token");
            const res   = await fetch("/api" + path, {
                headers: { Authorization: token ? "Bearer " + token : "" },
            });
            if (!res.ok) throw new Error(await res.text());
            const result = await res.json();
            setData(result);
            setError(null);
            return result;
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [path]);

    useSocket({
        "sensor:reading": (update) => {
            if (path === "/assets/health" && update) {
                setData(prev => {
                    if (!Array.isArray(prev)) return prev;
                    return prev.map(asset => 
                        asset.id === update.assetId
                            ? {
                                ...asset,
                                healthScore: update.healthScore ?? asset.healthScore,
                                rul: update.rul ?? asset.rul,
                                status: update.status ?? asset.status,
                                vibration: update.sensors?.vibration ?? asset.vibration,
                                temperature: update.sensors?.temperature ?? asset.temperature,
                                pressure: update.sensors?.pressure ?? asset.pressure,
                                sensors: update.sensors || asset.sensors,
                                lastUpdate: update.timestamp
                            }
                            : asset
                    );
                });
                console.log(`[API] Real-time update for ${update.assetId}: score=${update.healthScore}`);
            }
        },
        
        "energy:update": (update) => {
            if (path === "/energy" && update) {
                setData(prev => ({
                    ...prev,
                    current: update.current,
                    baseline: update.baseline,
                    water: update.water,
                    gas: update.gas,
                    kpis: update.kpis,
                    _updatedAt: new Date().toISOString()
                }));
                console.log(`[API] Real-time energy update: PUE=${update.kpis?.pue}`);
            }
        },
        
        "health:update": (update) => {
            if (path === "/assets/health" && update) {
                setData(prev => {
                    if (!Array.isArray(prev)) return prev;
                    return prev.map(asset =>
                        asset.id === update.assetId
                            ? { ...asset, ...update }
                            : asset
                    );
                });
            }
        },
        
        "alert:new": (alert) => {
            if (path === "/alerts") {
                setData(prev => {
                    if (!Array.isArray(prev)) return prev;
                    return [alert, ...prev];
                });
            }
        }
    });

    useEffect(() => {
        fetch_();
        if (interval > 0) {
            const id = setInterval(fetch_, interval);
            return () => clearInterval(id);
        }
    }, [fetch_, interval]);

    return { data, loading, error, refresh: fetch_, setData };
}