import React, { useState, useEffect, useCallback } from "react";
import { ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { HeartPulse, Link2, Settings, Zap, RefreshCw } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { useLanguage } from "../context/LanguageContext";
import { useSocket } from "../hooks/useSocket";

function authHeaders() {
    const token = localStorage.getItem("token");
    return { Authorization: token ? "Bearer " + token : "" };
}

function normaliseStatus(raw) {
    if (!raw) return "healthy";
    const s = raw.toString().toLowerCase();
    if (s === "critical") return "critical";
    if (s === "caution" || s === "warning" || s === "warn") return "caution";
    return "healthy";
}

function isToday(iso) {
    if (!iso) return false;
    const d = new Date(iso);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

const toneClasses = {
    normal: "border-t-status-normal text-status-normal",
    info: "border-t-status-info text-status-info",
    elevated: "border-t-status-elevated text-status-elevated",
    critical: "border-t-status-critical text-status-critical",
    purple: "border-t-purple-500 text-purple-600",
};

function KpiTile({ label, value, unit, icon: Icon, sub, tone = "info" }) {
    return (
        <div className={`bg-surface-panel border border-surface-line rounded-xl px-4 py-4 text-center border-t-[3px] shadow-panel ${toneClasses[tone]}`}>
            <Icon size={20} className="mx-auto mb-1.5" />
            <div className="text-[10px] font-bold text-ink-dim uppercase tracking-wider mb-2">{label}</div>
            <div className="text-[28px] font-extrabold leading-none font-mono">{value}</div>
            {unit && <div className="text-[11px] text-ink-dim/70 mt-1.5">{unit}</div>}
            {sub && <div className="text-[10px] text-ink-dim/70 mt-1">{sub}</div>}
        </div>
    );
}

function healthTone(s) {
    if (s >= 70) return "normal";
    if (s >= 40) return "elevated";
    return "critical";
}

const sectionLabel = "text-[11px] font-bold text-ink-dim uppercase tracking-wider";

export default function KpiCards({ userRole }) {
    const { t } = useLanguage();
    const { data: assets, loading: aLoad, error: aErr, setData: setAssets, refresh: refreshAssets } = useApi("/assets/health", 15000);
    const { data: energy, loading: eLoad, refresh: refreshEnergy } = useApi("/energy", 15000);
    const { data: workorders, refresh: refreshWO } = useApi("/workorders", 30000);

    const [trend, setTrend] = useState([]);
    const [syncSummary, setSyncSummary] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);

    const canSeeSyncDetail = userRole === "it_admin";

    const loadTrend = useCallback(async () => {
        try {
            const [healthRes, energyRes] = await Promise.all([
                fetch("/api/assets/health/history?hours=24", { headers: authHeaders() }),
                fetch("/api/energy/history", { headers: authHeaders() }),
            ]);
            const healthSeries = healthRes.ok ? await healthRes.json() : [];
            const energySeries = energyRes.ok ? await energyRes.json() : [];

            const byHour = new Map();
            healthSeries.forEach(p => byHour.set(p.timestamp, { timestamp: p.timestamp, fleetHealth: p.fleetHealth }));
            energySeries.forEach(p => {
                const existing = byHour.get(p.timestamp) || { timestamp: p.timestamp };
                existing.kw = p.kw;
                byHour.set(p.timestamp, existing);
            });
            const merged = Array.from(byHour.values())
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                .map(p => ({ ...p, label: new Date(p.timestamp).toLocaleTimeString([], { hour: "2-digit" }) }));
            setTrend(merged);
        } catch {
            setTrend([]);
        }
    }, []);

    const loadSyncSummary = useCallback(async () => {
        if (!canSeeSyncDetail) return;
        try {
            const res = await fetch("/api/maximo/sync/recent?limit=200", { headers: authHeaders() });
            if (!res.ok) return;
            const rows = await res.json();
            const latestByEntity = new Map();
            rows.filter(r => r.entityType === "WORKORDER").forEach(r => {
                const ex = latestByEntity.get(r.entityLocalId);
                if (!ex || new Date(r.attemptedAt) > new Date(ex.attemptedAt)) latestByEntity.set(r.entityLocalId, r);
            });
            const values = Array.from(latestByEntity.values());
            const synced = values.filter(r => r.syncStatus === "SENT").length;
            setSyncSummary({ total: values.length, synced, pct: values.length ? Math.round((synced / values.length) * 100) : 100 });
        } catch {
            setSyncSummary(null);
        }
    }, [canSeeSyncDetail]);

    useEffect(() => { loadTrend(); loadSyncSummary(); }, [loadTrend, loadSyncSummary]);

    useSocket({
        "sensor:reading": (reading) => {
            if (!reading?.assetId) return;
            setLastUpdate(new Date());
            setAssets(prev => Array.isArray(prev) ? prev.map(a => a.id === reading.assetId ? { ...a, healthScore: reading.healthScore ?? a.healthScore, status: reading.status ?? a.status } : a) : prev);
        },
        "health:update": (update) => {
            if (!update?.assetId) return;
            setLastUpdate(new Date());
            setAssets(prev => Array.isArray(prev) ? prev.map(a => a.id === update.assetId ? { ...a, ...update } : a) : prev);
        },
        "workorder:created": () => { setLastUpdate(new Date()); refreshWO(); loadSyncSummary(); },
    });

    async function handleRefresh() {
        await Promise.all([refreshAssets(), refreshEnergy(), refreshWO(), loadTrend(), loadSyncSummary()]);
        setLastUpdate(new Date());
    }

    if (aLoad || eLoad) {
        return (
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-surface-panel border border-surface-line rounded-xl h-[110px] animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
                ))}
            </div>
        );
    }
    if (aErr) return <p className="text-status-critical text-sm">Error loading assets: {aErr}</p>;

    const normalised = (Array.isArray(assets) ? assets : []).map(a => ({ ...a, status: normaliseStatus(a.status) }));
    const critical = normalised.filter(a => a.status === "critical").length;
    const caution = normalised.filter(a => a.status === "caution").length;
    const healthy = normalised.filter(a => a.status === "healthy").length;
    const fleetHealthIndex = normalised.length
        ? Math.round(normalised.reduce((s, a) => s + (a.healthScore || 0), 0) / normalised.length)
        : 0;

    const wos = Array.isArray(workorders) ? workorders : [];
    const autoWoToday = wos.filter(w => (w.generateType || "").startsWith("AUTO") && isToday(w.createdAt)).length;

    const energyData = energy || {};
    const totalEnergyLoad = energyData.current != null ? energyData.current.toFixed(1) : "—";

    const donutTotal = Math.max(1, critical + caution + healthy);

    return (
        <div className="max-w-[1080px] mx-auto">
            <div className="flex justify-between items-center mb-3.5">
                <p className={sectionLabel}>Fleet Overview</p>
                <div className="flex gap-2.5 items-center">
                    {lastUpdate && <span className="text-[10px] text-ink-dim/70 font-mono">Live · {lastUpdate.toLocaleTimeString()}</span>}
                    <button onClick={handleRefresh} className="flex items-center gap-1 text-[11px] px-2.5 py-1 bg-surface border border-surface-line rounded-md hover:bg-surface-line/50 transition-colors">
                        <RefreshCw size={12} /> Refresh
                    </button>
                </div>
            </div>

            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <KpiTile label="Fleet Health Index" value={fleetHealthIndex} unit="/ 100" tone={healthTone(fleetHealthIndex)} icon={HeartPulse} />
                <KpiTile
                    label="Maximo Sync Status"
                    value={canSeeSyncDetail ? (syncSummary ? `${syncSummary.pct}%` : "—") : "—"}
                    unit={canSeeSyncDetail ? `${syncSummary?.synced ?? 0}/${syncSummary?.total ?? 0} synced` : "it_admin only"}
                    tone="info" icon={Link2}
                />
                <KpiTile label="Auto Work Orders" value={autoWoToday} unit="generated today" tone="purple" icon={Settings} />
                <KpiTile label="Total Energy Load" value={totalEnergyLoad} unit="kW (fleet avg)" tone="info" icon={Zap} />
            </div>

            <p className={`${sectionLabel} mt-7 mb-2`}>Fleet Health vs. Energy — Last 24h</p>
            <div className="bg-surface-panel border border-surface-line rounded-xl px-3 pt-4 pb-1.5">
                {trend.length === 0 ? (
                    <div className="h-[220px] flex items-center justify-center text-ink-dim/70 text-xs">
                        No historical inference/energy data in the last 24h yet.
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={240}>
                        <ComposedChart data={trend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9aa5b4" }} />
                            <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 10, fill: "#9aa5b4" }} />
                            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#9aa5b4" }} />
                            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, fontFamily: "IBM Plex Mono" }} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Area yAxisId="left" type="monotone" dataKey="fleetHealth" name="Fleet Health %" stroke="#12B886" fill="#12B88620" strokeWidth={2} />
                            <Line yAxisId="right" type="monotone" dataKey="kw" name="Energy Load (kW)" stroke="#5AA9E6" strokeWidth={2} dot={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                )}
            </div>

            <p className={`${sectionLabel} mt-7 mb-2`}>Asset Status Breakdown</p>
            <div className="bg-surface-panel border border-surface-line rounded-xl px-4.5 py-4 flex gap-6 items-center flex-wrap">
                <div className="flex h-3.5 w-[240px] rounded-lg overflow-hidden flex-shrink-0">
                    <div className="bg-status-normal" style={{ width: `${(healthy / donutTotal) * 100}%` }} />
                    <div className="bg-status-elevated" style={{ width: `${(caution / donutTotal) * 100}%` }} />
                    <div className="bg-status-critical" style={{ width: `${(critical / donutTotal) * 100}%` }} />
                </div>
                <div className="flex gap-4.5 text-xs flex-wrap font-mono">
                    <span><span className="inline-block w-2 h-2 rounded-full bg-status-normal mr-1.5" />Operational: <strong>{healthy}</strong></span>
                    <span><span className="inline-block w-2 h-2 rounded-full bg-status-elevated mr-1.5" />Degraded: <strong>{caution}</strong></span>
                    <span><span className="inline-block w-2 h-2 rounded-full bg-status-critical mr-1.5" />Down: <strong>{critical}</strong></span>
                </div>
            </div>
        </div>
    );
}
