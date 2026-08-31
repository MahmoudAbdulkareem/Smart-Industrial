// frontend/src/components/AlertsPanel.js
import React, { useState, useMemo } from "react";
import { RefreshCw, Wrench, CheckCircle2, AlertTriangle } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { useLanguage } from "../context/LanguageContext";
import { useSocket } from "../hooks/useSocket";

const SEV = {
    critical: { bg: "bg-status-critical/10", border: "border-status-critical/30", text: "text-status-critical", left: "border-l-status-critical", dot: "bg-status-critical" },
    caution:  { bg: "bg-status-elevated/10", border: "border-status-elevated/30", text: "text-status-elevated", left: "border-l-status-elevated", dot: "bg-status-elevated" },
    warning:  { bg: "bg-status-elevated/10", border: "border-status-elevated/30", text: "text-status-elevated", left: "border-l-status-elevated", dot: "bg-status-elevated" },
    info:     { bg: "bg-status-info/10", border: "border-status-info/30", text: "text-status-info", left: "border-l-status-info", dot: "bg-status-info" },
};

function sevStyle(sev) { return SEV[(sev || "info").toLowerCase()] || SEV.info; }

function severityRank(sev) {
    const s = (sev || "info").toLowerCase();
    if (s === "critical") return 0;
    if (s === "caution" || s === "warning") return 1;
    return 2;
}

function fmtTime(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function ThresholdBar({ label, value, warn, max, unit }) {
    if (value === null || value === undefined) return null;
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    const tone = value >= max ? "bg-status-critical" : value >= warn ? "bg-status-elevated" : "bg-status-normal";
    const textTone = value >= max ? "text-status-critical" : value >= warn ? "text-status-elevated" : "text-status-normal";
    return (
        <div className="mb-2.5">
            <div className="flex justify-between text-[11px] text-ink-dim mb-1">
                <span>{label}</span>
                <span className={`font-bold font-mono ${textTone}`}>{value?.toFixed ? value.toFixed(2) : value} {unit}</span>
            </div>
            <div className="h-1.5 bg-surface-line rounded overflow-hidden relative">
                <div className={`h-full rounded transition-[width] duration-300 ${tone}`} style={{ width: `${pct}%` }} />
                <div className="absolute top-0 bottom-0 w-0.5 bg-status-elevated" style={{ left: `${Math.min(100, (warn / max) * 100)}%` }} />
            </div>
        </div>
    );
}

function DetailPanel({ alert, onAck, canAck }) {
    const { t } = useLanguage();
    if (!alert) {
        return (
            <div className="flex items-center justify-center h-full min-h-[300px] text-ink-dim text-sm text-center p-6">
                Select an alert on the left to see full diagnostic context — sensor readings at trigger time, threshold breach detail, and any linked Maximo work order.
            </div>
        );
    }

    const s = sevStyle(alert.severity);
    const assetLabel = alert.asset_name || alert.assetId || alert.asset_id || "Unknown asset";
    const hasTelemetry = alert.vibration_at_trigger != null || alert.temperature_at_trigger != null || alert.pressure_at_trigger != null;

    return (
        <div className="p-5">
            <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${s.dot} flex-shrink-0`} />
                <span className={`text-[10px] font-bold uppercase tracking-wide ${s.text}`}>{alert.severity || "info"}</span>
                <span className="text-[11px] text-ink-dim/70 ml-auto font-mono">{fmtTime(alert.time || alert.created_at)}</span>
            </div>

            <h3 className="text-[15px] font-bold text-ink mt-1.5 mb-0.5">{assetLabel}</h3>
            <p className="text-sm text-ink/80 leading-relaxed mb-4">{alert.message}</p>

            {alert.wonum && (
                <div className="bg-status-info/10 border border-status-info/30 rounded-lg px-3.5 py-2.5 mb-4 text-xs text-status-info flex items-center gap-2">
                    <Wrench size={14} /> Automated Maximo Work Order created — <strong className="font-mono">{alert.wonum}</strong>
                    <span className="ml-auto text-[11px] text-ink-dim/70">See Work Orders tab</span>
                </div>
            )}

            {hasTelemetry && (
                <div className="bg-surface border border-surface-line rounded-xl px-4 py-3.5 mb-4">
                    <div className="text-[11px] font-bold text-ink-dim uppercase tracking-wide mb-2.5">Sensor telemetry at trigger</div>
                    <ThresholdBar label="Vibration" value={alert.vibration_at_trigger} warn={0.20} max={0.45} unit="RMS" />
                    <ThresholdBar label="Temperature" value={alert.temperature_at_trigger} warn={75} max={95} unit="°C" />
                    <ThresholdBar label="Pressure" value={alert.pressure_at_trigger} warn={9} max={11.5} unit="bar" />
                </div>
            )}

            {alert.rule_reason && (
                <div className="text-xs text-ink-dim mb-4">
                    <span className="font-semibold text-ink">Trigger reason: </span>{alert.rule_reason}
                </div>
            )}

            <div className="text-[11px] text-ink-dim/70 mb-4 font-mono">Alert ID #{alert.id} · Asset: {alert.asset_id || alert.assetId}</div>

            {alert.acknowledged ? (
                <div className="bg-status-normal/10 border border-status-normal/30 rounded-lg px-3.5 py-2.5 text-xs text-status-normal flex items-center gap-1.5">
                    <CheckCircle2 size={13} /> Acknowledged{alert.acknowledged_by_name ? ` by ${alert.acknowledged_by_name}` : ""}{alert.acknowledged_at ? ` · ${fmtTime(alert.acknowledged_at)}` : ""}
                </div>
            ) : canAck ? (
                <button onClick={() => onAck(alert.id)} className={`px-4.5 py-2 text-sm font-semibold text-white rounded-lg ${s.dot}`}>
                    {t("acknowledge")}
                </button>
            ) : null}
        </div>
    );
}

export default function AlertsPanel({ userRole }) {
    const { t } = useLanguage();
    const { data, loading, error, refresh, setData } = useApi("/alerts", 15000);
    const [localAcked, setLocalAcked] = useState([]);
    const [severityFilter, setSeverityFilter] = useState("all");
    const [assetFilter, setAssetFilter] = useState("all");
    const [selectedId, setSelectedId] = useState(null);
    const [toast, setToast] = useState(null);

    const socketHandlers = useMemo(() => ({
        "alert:new": (alert) => {
            if (!alert) return;
            const alertWithId = { ...alert, id: alert.id || Date.now() };
            setData(prev => Array.isArray(prev) ? [alertWithId, ...prev] : [alertWithId]);
            setToast({ id: Date.now(), message: `${(alert.severity || "info").toUpperCase()}: ${alert.message}`, tone: sevStyle(alert.severity) });
            setTimeout(() => setToast(null), 5000);
        },
        "alert:acknowledged": (alert) => {
            setData(prev => Array.isArray(prev)
                ? prev.map(a => a.id === alert.id ? { ...a, acknowledged: 1, acknowledged_by: alert.acknowledged_by, acknowledged_at: alert.acknowledged_at } : a)
                : prev
            );
        }
    }), [setData]);

    useSocket(socketHandlers);

    const canAck = userRole === "maintenance_engineer" || userRole === "it_admin" || userRole === "admin";

    const assetOptions = useMemo(() => {
        if (!data || !Array.isArray(data)) return [];
        const map = new Map();
        data.forEach(a => {
            const id = a.asset_id || a.assetId;
            if (id && !map.has(id)) map.set(id, a.asset_name || id);
        });
        return Array.from(map.entries());
    }, [data]);

    const withAckFlag = useMemo(() => {
        if (!data || !Array.isArray(data)) return [];
        return data.map(a => ({ ...a, acknowledged: a.acknowledged || localAcked.includes(a.id) ? 1 : a.acknowledged }));
    }, [data, localAcked]);

    const filtered = useMemo(() => {
        return withAckFlag.filter(a => {
            const sevOk = severityFilter === "all" || (a.severity || "info").toLowerCase() === severityFilter;
            const assetId = a.asset_id || a.assetId;
            const assetOk = assetFilter === "all" || assetId === assetFilter;
            return sevOk && assetOk;
        });
    }, [withAckFlag, severityFilter, assetFilter]);

    const sorted = useMemo(() => {
        return [...filtered].sort((a, b) => {
            if (!!a.acknowledged !== !!b.acknowledged) return a.acknowledged ? 1 : -1;
            const rankDiff = severityRank(a.severity) - severityRank(b.severity);
            if (rankDiff !== 0) return rankDiff;
            return new Date(b.time || b.created_at) - new Date(a.time || a.created_at);
        });
    }, [filtered]);

    const selected = useMemo(() => {
        const found = sorted.find(a => a.id === selectedId);
        return found || sorted[0] || null;
    }, [sorted, selectedId]);

    const activeCount = useMemo(() => withAckFlag.filter(a => !a.acknowledged).length, [withAckFlag]);

    async function handleAck(id) {
        setLocalAcked(prev => [...prev, id]);
        try {
            const res = await fetch("/api/alerts/" + id + "/acknowledge", {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("token") }
            });
            if (!res.ok) throw new Error("Failed to acknowledge");
            const result = await res.json();
            setData(prev => Array.isArray(prev)
                ? prev.map(a => a.id === id ? { ...a, acknowledged: 1, acknowledged_by: result.data.acknowledged_by, acknowledged_at: result.data.acknowledged_at } : a)
                : prev
            );
        } catch (err) {
            setLocalAcked(prev => prev.filter(x => x !== id));
            alert("Failed to acknowledge alert. Please try again.");
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col gap-2.5">
                {[...Array(3)].map((_, i) => <div key={i} className="bg-surface-panel border border-surface-line rounded-lg h-[76px] animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />)}
            </div>
        );
    }

    if (error) return <p className="text-status-critical text-sm">Error: {error}</p>;
    if (!data) return null;

    return (
        <div>
            {toast && (
                <div className={`fixed top-5 right-5 bg-base border-2 ${toast.tone.left.replace("border-l-", "border-")} rounded-lg px-5 py-3 text-white text-sm z-[9999] max-w-[400px] shadow-2xl flex items-center gap-2`}>
                    <AlertTriangle size={15} /> {toast.message}
                </div>
            )}

            <div className="flex gap-2 mb-3.5 flex-wrap items-center">
                {["all", "critical", "caution", "info"].map(sev => (
                    <button key={sev} onClick={() => setSeverityFilter(sev)}
                        className={`text-[11px] font-semibold px-3 py-1 rounded-full capitalize border ${severityFilter === sev ? "bg-base text-white border-base" : "bg-surface-panel text-ink-dim border-surface-line"}`}>
                        {sev === "all" ? `All (${activeCount} active)` : sev}
                    </button>
                ))}
                <select value={assetFilter} onChange={e => setAssetFilter(e.target.value)}
                    className="text-[11px] px-2.5 py-1.5 rounded-lg border border-surface-line text-ink ml-auto bg-surface-panel">
                    <option value="all">All assets</option>
                    {assetOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
                <button onClick={refresh} className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 bg-surface border border-surface-line rounded-lg">
                    <RefreshCw size={12} /> {t("refresh")}
                </button>
            </div>

            <div className="grid gap-4 items-start" style={{ gridTemplateColumns: "minmax(280px, 380px) 1fr" }}>
                <div className="bg-surface-panel border border-surface-line rounded-xl max-h-[640px] overflow-y-auto scroll-thin">
                    {sorted.length === 0 ? (
                        <div className="p-6 text-center text-ink-dim text-sm">{t("noAlerts")}</div>
                    ) : sorted.map(alert => {
                        const s = sevStyle(alert.severity);
                        const isSelected = selected && selected.id === alert.id;
                        const assetLabel = alert.asset_name || alert.asset_id || alert.assetId;
                        return (
                            <div key={alert.id} onClick={() => setSelectedId(alert.id)}
                                className={`px-3.5 py-3 border-b border-surface-line cursor-pointer border-l-[3px] ${isSelected ? "bg-status-info/5 border-l-status-info" : s.left} ${alert.acknowledged ? "opacity-60" : ""}`}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase ${s.bg} ${s.text}`}>{alert.severity || "info"}</span>
                                    <span className="text-[10px] text-ink-dim/70 font-mono">{fmtTime(alert.time || alert.created_at)}</span>
                                </div>
                                <div className="text-xs font-bold text-ink">{assetLabel}</div>
                                <div className="text-[11px] text-ink-dim mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap">{alert.message}</div>
                                <div className="flex gap-1.5 mt-1.5 items-center">
                                    {alert.wonum && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-status-info/10 text-status-info">WO CREATED</span>}
                                    {alert.acknowledged && <span className="text-[9px] text-status-normal flex items-center gap-0.5"><CheckCircle2 size={9} /> Acknowledged</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="bg-surface-panel border border-surface-line rounded-xl min-h-[400px]">
                    <DetailPanel alert={selected} onAck={handleAck} canAck={canAck} />
                </div>
            </div>
        </div>
    );
}
