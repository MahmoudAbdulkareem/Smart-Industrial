import React, { useState, useEffect, useCallback } from "react";
import { useApi } from "../hooks/useApi";
import { useLanguage } from "../context/LanguageContext";
import { useSocket } from "../hooks/useSocket";

function normaliseStatus(raw) {
    if (!raw) return "healthy";
    const s = raw.toString().toLowerCase();
    if (s === "critical") return "critical";
    if (s === "caution" || s === "warning" || s === "warn") return "caution";
    return "healthy";
}

function KpiTile({ label, value, unit, color, icon, subColor }) {
    const [isAnimating, setIsAnimating] = useState(false);
    
    useEffect(() => {
        if (value !== "—") {
            setIsAnimating(true);
            const timer = setTimeout(() => setIsAnimating(false), 300);
            return () => clearTimeout(timer);
        }
    }, [value]);
    
    return (
        <div style={{
            background: "#fff",
            border: "1px solid #dde3ec",
            borderRadius: 10,
            padding: "20px 18px",
            textAlign: "center",
            borderTop: `3px solid ${color}`,
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            transition: "all 0.3s ease",
            transform: isAnimating ? "scale(1.02)" : "scale(1)",
        }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7a99", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>{label}</div>
            <div style={{ 
                fontSize: 30, 
                fontWeight: 800, 
                color: subColor || "#1a2332", 
                lineHeight: 1,
                transition: "color 0.3s ease"
            }}>{value}</div>
            {unit && <div style={{ fontSize: 11, color: "#9aa5b4", marginTop: 5 }}>{unit}</div>}
        </div>
    );
}

function healthColor(s) {
    if (s >= 70) return "#16a34a";
    if (s >= 40) return "#d97706";
    return "#dc2626";
}

const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 };
const sLabel = { fontSize: 11, fontWeight: 700, color: "#6b7a99", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10, textAlign: "center" };

export default function KpiCards() {
    const { t } = useLanguage();
    const { data: assets, loading: aLoad, error: aErr, setData: setAssets, refresh: refreshAssets } = useApi("/assets/health", 15000);
    const { data: energy, loading: eLoad, error: eErr, setData: setEnergy, refresh: refreshEnergy } = useApi("/energy", 15000);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [realtimeAssets, setRealtimeAssets] = useState([]);
    const [realtimeEnergy, setRealtimeEnergy] = useState(null);
    const [updateCount, setUpdateCount] = useState(0);
    const [isConnected, setIsConnected] = useState(false);

    // Handle real-time sensor updates for health KPIs
    const socketHandlers = useCallback({
        "sensor:reading": (reading) => {
            if (!reading?.assetId) {
                console.log("[KpiCards] Invalid sensor reading:", reading);
                return;
            }
            
            setLastUpdate(new Date());
            setUpdateCount(prev => prev + 1);
            
            setAssets(prev => {
                if (!Array.isArray(prev)) return prev;
                const updated = prev.map(asset =>
                    asset.id === reading.assetId
                        ? {
                            ...asset,
                            healthScore: reading.healthScore ?? asset.healthScore,
                            rul: reading.rul ?? asset.rul,
                            status: reading.status ?? asset.status,
                            sensors: {
                                ...asset.sensors,
                                vibration: reading.sensors?.vibration ?? asset.sensors?.vibration,
                                temperature: reading.sensors?.temperature ?? asset.sensors?.temperature,
                                pressure: reading.sensors?.pressure ?? asset.sensors?.pressure,
                            }
                        }
                        : asset
                );
                return updated;
            });
        },
        
        "energy:update": (update) => {
            if (!update || !update.kpis) {
                console.log("[KpiCards] Invalid energy update:", update);
                return;
            }
            
            setLastUpdate(new Date());
            setUpdateCount(prev => prev + 1);
            setRealtimeEnergy(update);
            
            setEnergy(prev => ({
                ...prev,
                current: update.current,
                baseline: update.baseline,
                water: update.water,
                gas: update.gas,
                kpis: update.kpis,
                _realtime: true,
                _updatedAt: new Date().toISOString()
            }));
        },
        
        "health:update": (update) => {
            if (update?.assetId) {
                setLastUpdate(new Date());
                setUpdateCount(prev => prev + 1);
                setAssets(prev => {
                    if (!Array.isArray(prev)) return prev;
                    return prev.map(asset =>
                        asset.id === update.assetId
                            ? { ...asset, ...update }
                            : asset
                    );
                });
            }
        },
        
        "connection:established": (data) => {
            console.log("[KpiCards] Socket.IO connected:", data);
            setIsConnected(true);
        }
    }, [setAssets, setEnergy]);

    useSocket(socketHandlers);

    useEffect(() => {
        if (Array.isArray(assets) && assets.length > 0) {
            setRealtimeAssets(assets);
        }
    }, [assets]);

    useEffect(() => {
        if (energy && energy.kpis) {
            setRealtimeEnergy(energy);
        }
    }, [energy]);

    const handleRefresh = async () => {
        await refreshAssets();
        await refreshEnergy();
        setLastUpdate(new Date());
    };

    if (aLoad || eLoad) {
        return (
            <div style={{ maxWidth: 900, margin: "40px auto", padding: "0 20px" }}>
                <div style={grid}>
                    {[...Array(7)].map((_, i) => (
                        <div key={i} style={{ 
                            background: "#fff", 
                            border: "1px solid #dde3ec", 
                            borderRadius: 10, 
                            height: 110, 
                            animation: `pulse 1.4s ease-in-out ${i * 0.1}s infinite` 
                        }} />
                    ))}
                </div>
            </div>
        );
    }
    
    if (aErr) return (
        <div style={{ maxWidth: 900, margin: "40px auto", padding: "0 20px", textAlign: "center" }}>
            <p style={{ color: "#dc2626", fontSize: 13 }}>Error loading assets: {aErr}</p>
            <button onClick={handleRefresh} style={{
                marginTop: 10,
                padding: "6px 12px",
                fontSize: 12,
                background: "#1d6fcc",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: "pointer"
            }}>Retry</button>
        </div>
    );
    
    if (eErr) return (
        <div style={{ maxWidth: 900, margin: "40px auto", padding: "0 20px", textAlign: "center" }}>
            <p style={{ color: "#dc2626", fontSize: 13 }}>Error loading energy: {eErr}</p>
            <button onClick={handleRefresh} style={{
                marginTop: 10,
                padding: "6px 12px",
                fontSize: 12,
                background: "#1d6fcc",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: "pointer"
            }}>Retry</button>
        </div>
    );
    
    if (!Array.isArray(realtimeAssets) || realtimeAssets.length === 0) {
        return (
            <div style={{ maxWidth: 900, margin: "40px auto", padding: "0 20px", textAlign: "center" }}>
                <p style={{ color: "#6b7a99", fontSize: 13 }}>No asset data available. Waiting for data...</p>
            </div>
        );
    }

    const normalised = realtimeAssets.map(a => ({ ...a, status: normaliseStatus(a.status) }));

    const avgHealth = normalised.length
        ? parseFloat((normalised.reduce((s, a) => s + (a.healthScore || 0), 0) / normalised.length).toFixed(1))
        : 0;

    const critical = normalised.filter(a => a.status === "critical").length;
    const caution = normalised.filter(a => a.status === "caution").length;
    const healthy = normalised.filter(a => a.status === "healthy").length;

    const energyData = realtimeEnergy || energy;
    const pueValue = energyData?.kpis?.pue?.toFixed(2) ?? "—";
    const eerValue = energyData?.kpis?.eer?.toFixed(2) ?? "—";
    const co2Value = energyData?.kpis?.co2?.toFixed(1) ?? "—";

    return (
        <div style={{ maxWidth: 900, margin: "40px auto", padding: "0 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <p style={sLabel}>{t("assetHealth")}</p>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {lastUpdate && (
                        <span style={{ fontSize: 10, color: "#9aa5b4" }}>
                             Live · {lastUpdate.toLocaleTimeString()}
                            {updateCount > 0 && ` (${updateCount} updates)`}
                        </span>
                    )}
                    <button 
                        onClick={handleRefresh}
                        style={{
                            fontSize: 11,
                            padding: "4px 10px",
                            background: "#f8faff",
                            border: "1px solid #d1d9e6",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontFamily: "inherit"
                        }}
                    >
                        ⟳ Refresh
                    </button>
                </div>
            </div>
            
            <div style={grid}>
                <KpiTile 
                    label={t("avgHealthScore")} 
                    value={avgHealth}  
                    unit={t("outOf100")} 
                    color={healthColor(avgHealth)} 
                    subColor={healthColor(avgHealth)} 
                />
                <KpiTile 
                    label={t("criticalAssets")} 
                    value={critical}   
                    unit={t("assets")}   
                    color="#dc2626" 
                    subColor="#dc2626" 
                />
                <KpiTile 
                    label={t("cautionAssets")}  
                    value={caution}    
                    unit={t("assets")}   
                    color="#d97706" 
                    subColor="#d97706" 
                />
                <KpiTile 
                    label={t("healthyAssets")}  
                    value={healthy}    
                    unit={t("assets")}   
                    color="#16a34a" 
                    subColor="#16a34a" 
                />
            </div>
            
            <p style={{ ...sLabel, marginTop: 28 }}>{t("energyPerformance")}</p>
            
            <div style={grid}>
                <KpiTile 
                    label="PUE" 
                    value={pueValue} 
                    unit={t("pueTarget")}  
                    color="#1d6fcc" 
                />
                <KpiTile 
                    label="EER" 
                    value={eerValue} 
                    unit={t("eerNote")}    
                    color="#1d6fcc" 
                />
                <KpiTile 
                    label="CO₂" 
                    value={co2Value} 
                    unit="kg / hour"       
                    color="#7c3aed" 
                />
            </div>
            
            <p style={{ fontSize: 12, color: "#9aa5b4", marginTop: 20, textAlign: "center" }}>
                ⟳ Updates every 5-7 seconds
                {lastUpdate && ` · Last: ${lastUpdate.toLocaleTimeString()}`}
            </p>
        </div>
    );
}