import React, { useState, useEffect } from "react";
import { RefreshCw, Wrench, AlertTriangle, X, FileSpreadsheet, FileText } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { useSocket } from "../hooks/useSocket";
import { useLanguage } from "../context/LanguageContext";

function exportCSV(data, filename) {
    if (!data || !data.length) return;
    const keys = Object.keys(data[0]);
    const csv = [keys.join(","), ...data.map(r => keys.map(k => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename + ".csv";
    a.click();
    URL.revokeObjectURL(url);
}

function exportExcel(data, filename) {
    if (!data || !data.length) return;
    const keys = Object.keys(data[0]);
    const rows = [keys, ...data.map(r => keys.map(k => r[k] ?? ""))];
    const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Sheet1"><Table>${
        rows.map(r => `<Row>${r.map(c => `<Cell><Data ss:Type="${typeof c === "number" ? "Number" : "String"}">${String(c).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</Data></Cell>`).join("")}</Row>`).join("")
    }</Table></Worksheet></Workbook>`;
    const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename + ".xls";
    a.click();
    URL.revokeObjectURL(url);
}

function ExportBar({ data, filename }) {
    return (
        <div className="flex gap-1.5 items-center">
            <span className="text-[11px] text-ink-dim/70 font-medium">Export:</span>
            <button onClick={() => exportExcel(data, filename)} className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md border border-status-normal/40 bg-status-normal/10 text-status-normal">
                <FileSpreadsheet size={12} /> Excel
            </button>
            <button onClick={() => exportCSV(data, filename)} className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md border border-status-info/40 bg-status-info/10 text-status-info">
                <FileText size={12} /> CSV
            </button>
        </div>
    );
}

const STATUS_STYLES = {
    healthy: { bg: "bg-status-normal/10", border: "border-status-normal/40", text: "text-status-normal", bar: "from-status-normal to-status-normal", dot: "bg-status-normal" },
    caution: { bg: "bg-status-elevated/10", border: "border-status-elevated/40", text: "text-status-elevated", bar: "from-status-elevated to-status-elevated", dot: "bg-status-elevated" },
    critical: { bg: "bg-status-critical/10", border: "border-status-critical/40", text: "text-status-critical", bar: "from-status-critical to-status-critical", dot: "bg-status-critical" },
};

function normaliseStatus(raw) {
    if (!raw) return "healthy";
    const s = raw.toString().toLowerCase();
    if (s === "critical") return "critical";
    if (s === "caution" || s === "warning" || s === "warn") return "caution";
    return "healthy";
}

function WorkOrderModal({ asset, onClose }) {
    const { t } = useLanguage();
    const [desc, setDesc] = useState(`${t("createWorkOrder")} — Health: ${asset.healthScore}/100`);
    const [status, setStatus] = useState("idle");
    const [result, setResult] = useState(null);

    async function submit() {
        setStatus("loading");
        try {
            const res = await fetch("/api/workorders", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("token") },
                body: JSON.stringify({ assetId: asset.id, description: desc }),
            });
            const json = await res.json();
            if (!res.ok) { setStatus("error"); return; }
            setResult(json);
            setStatus("success");
        } catch { setStatus("error"); }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bg-surface-panel rounded-2xl p-7 w-full max-w-[460px] shadow-2xl border border-surface-line">
                <div className="flex justify-between items-center mb-5">
                    <h3 className="text-base font-bold text-ink flex items-center gap-2"><Wrench size={16} />{t("createWorkOrder")}</h3>
                    <button onClick={onClose} className="text-ink-dim hover:text-ink text-xl leading-none"><X size={18} /></button>
                </div>
                <div className="bg-surface rounded-lg px-3.5 py-2.5 mb-4 text-sm border border-surface-line">
                    <span className="text-ink-dim">{t("asset")}: </span>
                    <strong className="text-ink">{asset.name}</strong>
                    <span className="text-ink-dim/70 ml-2">{asset.id} · {asset.location}</span>
                </div>
                {status === "success" ? (
                    <div>
                        <div className="bg-status-normal/10 border border-status-normal/30 rounded-lg px-3.5 py-3 text-sm text-status-normal mb-4">
                            ✓ {t("workOrderSuccess")} <strong>{result.wonum}</strong>
                        </div>
                        <button onClick={onClose} className="px-4.5 py-2 text-sm font-semibold bg-status-info text-white rounded-lg">{t("close")}</button>
                    </div>
                ) : (
                    <>
                        <label className="text-xs font-medium text-ink-dim block mb-1.5">{t("description")}</label>
                        <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3}
                            className="w-full px-3 py-2.5 text-sm border border-surface-line rounded-lg resize-y mb-3.5 text-ink box-border font-sans" />
                        {status === "error" && <p className="text-status-critical text-sm mb-3">{t("workOrderError")}</p>}
                        <div className="flex gap-2 justify-end">
                            <button onClick={onClose} className="px-4.5 py-2 text-sm font-semibold bg-surface-panel border border-surface-line text-ink-dim rounded-lg">{t("cancel")}</button>
                            <button onClick={submit} disabled={status === "loading"} className="px-4.5 py-2 text-sm font-semibold bg-status-info text-white rounded-lg disabled:opacity-70">
                                {status === "loading" ? "…" : t("submit")}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function AssetCard({ asset, canCreateWO }) {
    const { t } = useLanguage();
    const [showModal, setShowModal] = useState(false);
    const key = normaliseStatus(asset.status);
    const s = STATUS_STYLES[key];

    const healthScore = Math.max(0, Math.min(100, asset.healthScore || 0));
    const rul = Math.max(0, asset.rul || 0);
    const mtbf = Math.max(0, asset.mtbf || 0);
    const mtbfRemainingPct = asset.mtbfRemainingPct != null ? Math.max(0, Math.min(100, asset.mtbfRemainingPct)) : null;

    const statusLabel = { healthy: t("healthy"), caution: t("caution"), critical: t("critical") };

    return (
        <div className={`bg-surface-panel border ${s.border} rounded-xl p-5 flex flex-col gap-3.5 shadow-panel border-t-4 ${s.dot.replace("bg-", "border-t-")}`}>
            <div className="flex justify-between items-start">
                <div>
                    <div className="font-bold text-sm text-ink">{asset.name}</div>
                    <div className="text-[11px] text-ink-dim/70 mt-0.5">{asset.assetnum || asset.id} · {asset.location}</div>
                </div>
                <span className={`${s.bg} ${s.text} border ${s.border} px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap`}>
                    {statusLabel[key]}
                </span>
            </div>

            <div>
                <div className="flex justify-between mb-1.5">
                    <span className="text-xs text-ink-dim font-medium">{t("healthScore")}</span>
                    <span className={`text-sm font-extrabold font-mono ${s.text}`}>{Math.round(healthScore)} <span className="text-[11px] font-normal text-ink-dim/70">/ 100</span></span>
                </div>
                <div className="h-2.5 bg-surface-line rounded-md overflow-hidden">
                    <div className={`h-full rounded-md transition-[width] duration-700 bg-gradient-to-r ${s.bar}`} style={{ width: `${Math.max(0, Math.min(100, healthScore))}%` }} />
                </div>
            </div>

            {mtbfRemainingPct != null && (
                <div>
                    <div className="flex justify-between mb-1">
                        <span className="text-[11px] text-ink-dim/70 font-medium">MTBF remaining</span>
                        <span className={`text-xs font-bold font-mono ${mtbfRemainingPct < 15 ? "text-status-critical" : "text-ink-dim"}`}>{mtbfRemainingPct.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 bg-surface-line rounded overflow-hidden">
                        <div className={`h-full rounded ${mtbfRemainingPct < 15 ? "bg-status-critical" : mtbfRemainingPct < 30 ? "bg-status-elevated" : "bg-ink-dim/40"}`} style={{ width: `${mtbfRemainingPct}%` }} />
                    </div>
                </div>
            )}

            {Array.isArray(asset.ruleReasons) && asset.ruleReasons.length > 0 && key !== "healthy" && (
                <div className={`text-[11px] ${s.text} ${s.bg} border ${s.border} rounded-md px-2.5 py-1.5 leading-relaxed flex items-start gap-1.5`}>
                    {key === "critical" ? <Wrench size={12} className="mt-0.5 flex-shrink-0" /> : <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />}
                    <span>{asset.ruleReasons.join("; ")}</span>
                </div>
            )}

            <div className="flex gap-5 flex-wrap items-center">
                <div>
                    <div className="text-[10px] text-ink-dim/70 uppercase tracking-wide mb-0.5">{t("rul")}</div>
                    <div className="text-[13px] font-bold text-ink font-mono">{Math.round(rul)} days</div>
                </div>
                <div>
                    <div className="text-[10px] text-ink-dim/70 uppercase tracking-wide mb-0.5">{t("mtbf")}</div>
                    <div className="text-[13px] font-bold text-ink font-mono">{Math.round(mtbf)} hrs</div>
                </div>
                {asset.anomalyDetected && (
                    <div className="ml-auto bg-status-critical/10 border border-status-critical/30 rounded-md px-2.5 py-1 text-[11px] text-status-critical font-bold flex items-center gap-1">
                        <AlertTriangle size={11} /> {t("anomaly")}
                    </div>
                )}
            </div>

            <div className="bg-surface rounded-lg px-3.5 py-2.5 flex gap-4.5 flex-wrap border border-surface-line">
                {[
                    { label: "Vibration", value: (asset.sensors?.vibration ?? 0).toFixed(3) + " RMS" },
                    { label: "Temp", value: (asset.sensors?.temperature ?? 0).toFixed(1) + " °C" },
                    { label: "Pressure", value: (asset.sensors?.pressure ?? 0).toFixed(2) + " bar" },
                ].map(r => (
                    <div key={r.label}>
                        <div className="text-[9px] text-ink-dim/70 uppercase tracking-wide">{r.label}</div>
                        <div className="text-xs text-ink font-semibold mt-0.5 font-mono">{r.value}</div>
                    </div>
                ))}
            </div>

            {canCreateWO && key !== "healthy" && (
                <button onClick={() => setShowModal(true)} className={`px-3.5 py-2 text-xs font-semibold ${key === "critical" ? "bg-status-critical/10" : "bg-status-elevated/10"} border ${s.border} ${s.text} rounded-lg self-start flex items-center gap-1.5`}>
                    <Wrench size={13} /> {t("createWorkOrder")}
                </button>
            )}
            {showModal && <WorkOrderModal asset={asset} onClose={() => setShowModal(false)} />}
        </div>
    );
}

function SummaryBadge({ statusKey, count, label }) {
    const s = STATUS_STYLES[statusKey];
    return (
        <div className={`${s.bg} border ${s.border} rounded-xl px-5 py-3 flex items-center gap-2.5 min-w-[120px]`}>
            <div>
                <div className={`text-2xl font-extrabold leading-none font-mono ${s.text}`}>{count}</div>
                <div className={`text-xs font-semibold mt-0.5 ${s.text}`}>{label}</div>
            </div>
        </div>
    );
}

function removeDuplicatesAndAutoRegistered(assets) {
    // First, filter out auto-registered assets
    const filtered = assets.filter(asset => 
        !asset.name?.toLowerCase().includes("auto-registered") &&
        !asset.id?.toLowerCase().includes("auto-registered")
    );
    
    // Then remove duplicates by ID, keeping the one with highest health score
    const uniqueMap = new Map();
    filtered.forEach(asset => {
        const existing = uniqueMap.get(asset.id);
        if (!existing || (asset.healthScore || 0) > (existing.healthScore || 0)) {
            uniqueMap.set(asset.id, asset);
        }
    });
    return Array.from(uniqueMap.values());
}

export default function HealthView({ userRole }) {
    const { t } = useLanguage();
    const { data, loading, error, refresh, setData } = useApi("/assets/health", 15000);
    const [filteredData, setFilteredData] = useState([]);
    const [lastUpdate, setLastUpdate] = useState(null);

    useEffect(() => {
        if (Array.isArray(data) && data.length > 0) {
            setFilteredData(removeDuplicatesAndAutoRegistered(data));
        } else {
            setFilteredData([]);
        }
    }, [data]);

    useSocket({
        "sensor:reading": (reading) => {
            if (!reading?.assetId) return;
            setLastUpdate(new Date());
            setData(prev => {
                if (!Array.isArray(prev)) return prev;
                return prev.map(asset =>
                    asset.id === reading.assetId
                        ? {
                            ...asset,
                            healthScore: Math.max(0, Math.min(100, reading.healthScore ?? asset.healthScore)),
                            rul: Math.max(0, reading.rul ?? asset.rul),
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
            });
        },
        "alert:triggered": (alert) => { console.log("Alert received:", alert); }
    });

    if (loading) {
        return (
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="bg-surface-panel border border-surface-line rounded-xl h-[240px] animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
                ))}
            </div>
        );
    }

    if (error) return (
        <div className="bg-status-critical/10 border border-status-critical/30 rounded-lg px-4.5 py-3.5 text-status-critical text-sm flex items-center gap-2">
            <AlertTriangle size={14} /> Error loading health data: {error}
            <button onClick={refresh} className="ml-2.5 text-status-info underline">Retry</button>
        </div>
    );

    if (!Array.isArray(filteredData) || filteredData.length === 0) return (
        <div className="bg-surface border border-surface-line rounded-lg p-5 text-ink-dim text-sm text-center">
            No asset data available yet. Make sure the backend is running.
        </div>
    );

    const normalised = filteredData.map(a => ({
        ...a,
        status: normaliseStatus(a.status),
        healthScore: Math.max(0, Math.min(100, a.healthScore || 0)),
        rul: Math.max(0, a.rul || 0),
        mtbf: Math.max(0, a.mtbf || 0),
    }));
    const sorted = [...normalised].sort((a, b) => a.healthScore - b.healthScore);
    const canCreate = userRole === "maintenance_engineer";

    const counts = {
        critical: normalised.filter(a => a.status === "critical").length,
        caution: normalised.filter(a => a.status === "caution").length,
        healthy: normalised.filter(a => a.status === "healthy").length,
    };

    const avgScore = normalised.length
        ? parseFloat((normalised.reduce((s, a) => s + (a.healthScore || 0), 0) / normalised.length).toFixed(1))
        : 0;

    const exportData = sorted.map(a => ({
        ID: a.id, Name: a.name, Location: a.location, Status: a.status,
        "Health Score": a.healthScore, "RUL (days)": Math.round(a.rul || 0), "MTBF (hrs)": Math.round(a.mtbf || 0),
        "Vibration (RMS)": a.sensors?.vibration?.toFixed(3) ?? "",
        "Temp (°C)": a.sensors?.temperature?.toFixed(1) ?? "",
        "Pressure (bar)": a.sensors?.pressure?.toFixed(2) ?? "",
    }));

    return (
        <div>
            <div className="flex justify-between items-start mb-5 flex-wrap gap-3">
                <div>
                    <p className="text-[11px] text-ink-dim/70 mb-1.5">
                        Live sensor data · Updates every 5-7s
                        {lastUpdate && <span className="font-mono"> · Last: {lastUpdate.toLocaleTimeString()}</span>}
                    </p>
                    <div className="flex gap-2.5 flex-wrap items-center">
                        <SummaryBadge statusKey="critical" count={counts.critical} label={t("critical")} />
                        <SummaryBadge statusKey="caution" count={counts.caution} label={t("caution")} />
                        <SummaryBadge statusKey="healthy" count={counts.healthy} label={t("healthy")} />
                        <div className="bg-status-info/10 border border-status-info/30 rounded-xl px-5 py-3 min-w-[120px]">
                            <div className="text-2xl font-extrabold text-status-info leading-none font-mono">{avgScore}</div>
                            <div className="text-xs text-status-info font-semibold mt-0.5">Avg Score</div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    <button onClick={refresh} className="flex items-center gap-1.5 text-sm px-4 py-2 bg-surface border border-surface-line rounded-lg text-ink-dim hover:bg-surface-line/40">
                        <RefreshCw size={13} /> {t("refresh")}
                    </button>
                    <ExportBar data={exportData} filename="asset_health_report" />
                </div>
            </div>

            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
                {sorted.map(asset => (
                    <AssetCard key={asset.id} asset={asset} canCreateWO={canCreate} />
                ))}
            </div>
        </div>
    );
}