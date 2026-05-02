import React, { useState, useRef } from "react";
import { useApi } from "../hooks/useApi";
import { useLanguage } from "../context/LanguageContext";

function exportCSV(data, filename) {
    if (!data || !data.length) return;
    const keys = Object.keys(data[0]);
    const csv = [keys.join(","), ...data.map(r => keys.map(k => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url; a.download = filename + ".csv"; a.click();
    URL.revokeObjectURL(url);
}
function exportExcel(data, filename) {
    if (!data || !data.length) return;
    const keys = Object.keys(data[0]);
    const rows = [keys, ...data.map(r => keys.map(k => r[k] ?? ""))];
    const xml  = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Sheet1"><Table>${
        rows.map(r => `<Row>${r.map(c => `<Cell><Data ss:Type="${typeof c === "number" ? "Number" : "String"}">${String(c).replace(/&/g,"&amp;").replace(/</g,"&lt;")}</Data></Cell>`).join("")}</Row>`).join("")
    }</Table></Worksheet></Workbook>`;
    const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url; a.download = filename + ".xls"; a.click();
    URL.revokeObjectURL(url);
}
function exportPDF(tableRef, filename) {
    const printWin = window.open("", "_blank");
    const html = `<!DOCTYPE html><html><head><title>${filename}</title>
    <style>body{font-family:Inter,Arial,sans-serif;padding:24px;color:#1a2332}h2{font-size:18px;margin-bottom:16px}
    table{width:100%;border-collapse:collapse;font-size:12px}th{background:#1d6fcc;color:#fff;padding:9px 12px;text-align:left}
    td{padding:8px 12px;border-bottom:1px solid #e2e8f0}tr:nth-child(even){background:#f8faff}
    .healthy{color:#15803d;font-weight:600}.caution{color:#b45309;font-weight:600}.critical{color:#b91c1c;font-weight:600}
    @media print{body{padding:0}}</style></head><body>
    <h2>${filename}</h2>${tableRef.current?.outerHTML || ""}<script>window.onload=()=>{window.print();window.close()}</script>
    </body></html>`;
    printWin.document.write(html); printWin.document.close();
}
function ExportBar({ data, tableRef, filename }) {
    return (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#9aa5b4", fontWeight: 500 }}>Export:</span>
            {[
                { label: "Excel", color: "#166534", bg: "#f0fdf4", action: () => exportExcel(data, filename) },
                { label: "CSV",   color: "#1d4ed8", bg: "#eff6ff", action: () => exportCSV(data, filename) },
            ].map(b => (
                <button key={b.label} onClick={b.action}
                    style={{ padding: "4px 11px", fontSize: 11, fontWeight: 600, borderRadius: 6,
                        border: "1px solid " + b.color + "40", background: b.bg, color: b.color,
                        cursor: "pointer", fontFamily: "inherit" }}>
                    ↓ {b.label}
                </button>
            ))}
        </div>
    );
}

const STATUS_STYLES = {
    healthy:  { bg: "#f0fdf4", border: "#86efac", text: "#15803d", bar: "#22c55e", dot: "#16a34a", badge: "#dcfce7" },
    caution:  { bg: "#fffbeb", border: "#fcd34d", text: "#b45309", bar: "#f59e0b", dot: "#d97706", badge: "#fef9c3" },
    critical: { bg: "#fff1f2", border: "#fca5a5", text: "#b91c1c", bar: "#ef4444", dot: "#dc2626", badge: "#fee2e2" },
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
    const [desc,   setDesc]   = useState(`${t("createWorkOrder")} — Health: ${asset.healthScore}/100`);
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
            setResult(json); setStatus("success");
        } catch { setStatus("error"); }
    }

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: "100%", maxWidth: 460, boxShadow: "0 24px 64px rgba(0,0,0,0.18)", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1a2332", margin: 0 }}>🔧 {t("createWorkOrder")}</h3>
                    <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: "#9aa5b4", cursor: "pointer", lineHeight: 1 }}>×</button>
                </div>
                <div style={{ background: "#f8faff", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, border: "1px solid #e8f0fe" }}>
                    <span style={{ color: "#6b7a99" }}>{t("asset")}: </span>
                    <strong style={{ color: "#1a2332" }}>{asset.name}</strong>
                    <span style={{ color: "#9aa5b4", marginLeft: 8 }}>{asset.id} · {asset.location}</span>
                </div>
                {status === "success" ? (
                    <div>
                        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "12px 14px", fontSize: 13, color: "#15803d", marginBottom: 16 }}>
                            ✓ {t("workOrderSuccess")} <strong>{result.wonum}</strong>
                        </div>
                        <button onClick={onClose} style={{ padding: "8px 18px", fontSize: 13, fontWeight: 600, background: "#1d6fcc", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontFamily: "inherit" }}>{t("close")}</button>
                    </div>
                ) : (
                    <>
                        <label style={{ fontSize: 12, fontWeight: 500, color: "#6b7a99", display: "block", marginBottom: 6 }}>{t("description")}</label>
                        <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3}
                            style={{ width: "100%", padding: "10px 12px", fontSize: 13, border: "1px solid #d1d9e6", borderRadius: 8, fontFamily: "inherit", resize: "vertical", marginBottom: 14, color: "#1a2332", boxSizing: "border-box" }} />
                        {status === "error" && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{t("workOrderError")}</p>}
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            <button onClick={onClose} style={{ padding: "8px 18px", fontSize: 13, fontWeight: 600, background: "#fff", border: "1px solid #d1d9e6", color: "#374151", borderRadius: 7, cursor: "pointer", fontFamily: "inherit" }}>{t("cancel")}</button>
                            <button onClick={submit} disabled={status === "loading"} style={{ padding: "8px 18px", fontSize: 13, fontWeight: 600, background: "#1d6fcc", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontFamily: "inherit", opacity: status === "loading" ? 0.7 : 1 }}>
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
    const s   = STATUS_STYLES[key];

    const statusLabel = {
        healthy:  t("healthy"),
        caution:  t("caution"),
        critical: t("critical"),
    };

    const statusIcon = { healthy: "✅", caution: "⚠️", critical: "🔴" };

    return (
        <div style={{
            background: "#fff",
            border: "1px solid " + s.border,
            borderTop: "4px solid " + s.dot,
            borderRadius: 12,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 14,
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            transition: "box-shadow 0.2s",
        }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#1a2332" }}>{asset.name}</div>
                    <div style={{ fontSize: 11, color: "#9aa5b4", marginTop: 3 }}>{asset.id} · {asset.location}</div>
                </div>
                <span style={{
                    background: s.badge,
                    color: s.text,
                    border: "1px solid " + s.border,
                    padding: "4px 12px",
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    whiteSpace: "nowrap",
                }}>
                    {statusIcon[key]} {statusLabel[key]}
                </span>
            </div>

            <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                    <span style={{ fontSize: 12, color: "#6b7a99", fontWeight: 500 }}>{t("healthScore")}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: s.text }}>{asset.healthScore} <span style={{ fontSize: 11, fontWeight: 400, color: "#9aa5b4" }}>/ 100</span></span>
                </div>
                <div style={{ height: 10, background: "#f1f5f9", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{
                        height: "100%",
                        width: asset.healthScore + "%",
                        background: `linear-gradient(90deg, ${s.bar}, ${s.dot})`,
                        borderRadius: 6,
                        transition: "width 0.8s ease",
                    }} />
                </div>
            </div>

            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                {[
                    { label: t("rul"),  value: asset.rul  + " days" },
                    { label: t("mtbf"), value: asset.mtbf + " hrs"  },
                ].map(k => (
                    <div key={k.label}>
                        <div style={{ fontSize: 10, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 }}>{k.label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{k.value}</div>
                    </div>
                ))}
                {asset.anomalyDetected && (
                    <div style={{ marginLeft: "auto", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, padding: "3px 10px", fontSize: 11, color: "#b91c1c", fontWeight: 700 }}>
                        ⚠ {t("anomaly")}
                    </div>
                )}
            </div>

            <div style={{ background: "#f8faff", borderRadius: 8, padding: "10px 14px", display: "flex", gap: 18, flexWrap: "wrap", border: "1px solid #e8f0fe" }}>
                {[
                    { label: "Vibration", value: (asset.sensors?.vibration   ?? "—") + " mm/s", icon: "📳" },
                    { label: "Temp",      value: (asset.sensors?.temperature ?? "—") + " °C",   icon: "🌡" },
                    { label: "Pressure",  value: (asset.sensors?.pressure    ?? "—") + " bar",  icon: "💨" },
                ].map(r => (
                    <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 14 }}>{r.icon}</span>
                        <div>
                            <div style={{ fontSize: 9, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: 0.5 }}>{r.label}</div>
                            <div style={{ fontSize: 12, color: "#374151", fontWeight: 600, marginTop: 1 }}>{r.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {canCreateWO && key !== "healthy" && (
                <button onClick={() => setShowModal(true)} style={{
                    padding: "8px 14px", fontSize: 12, fontWeight: 600,
                    background: key === "critical" ? "#fef2f2" : "#fffbeb",
                    border: "1px solid " + s.border,
                    color: s.text, borderRadius: 8, cursor: "pointer",
                    alignSelf: "flex-start", fontFamily: "inherit",
                    display: "flex", alignItems: "center", gap: 6,
                }}>
                    🔧 {t("createWorkOrder")}
                </button>
            )}
            {showModal && <WorkOrderModal asset={asset} onClose={() => setShowModal(false)} />}
        </div>
    );
}

function SummaryBadge({ statusKey, count, label }) {
    const s = STATUS_STYLES[statusKey];
    const icons = { critical: "🔴", caution: "🟡", healthy: "🟢" };
    return (
        <div style={{
            background: s.bg,
            border: "1px solid " + s.border,
            borderRadius: 10,
            padding: "12px 20px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            minWidth: 120,
        }}>
            <span style={{ fontSize: 22 }}>{icons[statusKey]}</span>
            <div>
                <div style={{ fontSize: 26, fontWeight: 800, color: s.text, lineHeight: 1 }}>{count}</div>
                <div style={{ fontSize: 12, color: s.text, fontWeight: 600, marginTop: 2 }}>{label}</div>
            </div>
        </div>
    );
}

export default function HealthView({ userRole }) {
    const { t } = useLanguage();
    const { data, loading, error, refresh } = useApi("/assets/health", 15000);
    const tableRef = useRef(null);

    if (loading) {
        return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                {[...Array(5)].map((_, i) => (
                    <div key={i} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, height: 240, animation: `pulse 1.4s ease-in-out ${i * 0.1}s infinite` }} />
                ))}
            </div>
        );
    }
    if (error) return (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "14px 18px", color: "#b91c1c", fontSize: 13 }}>
            ❌ Error loading health data: {error}
        </div>
    );
    if (!Array.isArray(data) || data.length === 0) return (
        <div style={{ background: "#f8faff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "20px", color: "#6b7a99", fontSize: 13, textAlign: "center" }}>
            No asset data available yet. Make sure the backend and mock publisher are running.
        </div>
    );

    const normalised = data.map(a => ({ ...a, status: normaliseStatus(a.status) }));
    const sorted     = [...normalised].sort((a, b) => a.healthScore - b.healthScore);
    const canCreate  = userRole === "maintenance_engineer";

    const counts = {
        critical: normalised.filter(a => a.status === "critical").length,
        caution:  normalised.filter(a => a.status === "caution").length,
        healthy:  normalised.filter(a => a.status === "healthy").length,
    };

    const avgScore = normalised.length
        ? parseFloat((normalised.reduce((s, a) => s + a.healthScore, 0) / normalised.length).toFixed(1))
        : 0;

    return (
        <div>
        
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <SummaryBadge statusKey="critical" count={counts.critical} label={t("critical")} />
                    <SummaryBadge statusKey="caution"  count={counts.caution}  label={t("caution")}  />
                    <SummaryBadge statusKey="healthy"  count={counts.healthy}  label={t("healthy")}  />
                    <div style={{ background: "#f0f4ff", border: "1px solid #c7d2fe", borderRadius: 10, padding: "12px 20px", minWidth: 120 }}>
                        <div style={{ fontSize: 26, fontWeight: 800, color: "#3730a3", lineHeight: 1 }}>{avgScore}</div>
                        <div style={{ fontSize: 12, color: "#4f46e5", fontWeight: 600, marginTop: 2 }}>Avg Score</div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <button onClick={refresh} style={{
                        fontSize: 13, padding: "8px 16px",
                        background: "#f8faff", border: "1px solid #d1d9e6",
                        borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                        color: "#374151", display: "flex", alignItems: "center", gap: 6,
                    }}>
                        ⟳ {t("refresh")}
                    </button>
                    <ExportBar
                        data={sorted.map(a => ({
                            ID: a.id, Name: a.name, Location: a.location,
                            Status: a.status, "Health Score": a.healthScore,
                            "RUL (days)": a.rul, "MTBF (hrs)": a.mtbf,
                            "Vibration (mm/s)": a.sensors?.vibration ?? "",
                            "Temp (°C)": a.sensors?.temperature ?? "",
                            "Pressure (bar)": a.sensors?.pressure ?? "",
                        }))}
                        tableRef={tableRef}
                        filename="asset_health_report"
                    />
                </div>
            </div>

            <table ref={tableRef} style={{ display: "none" }}>
                <thead>
                    <tr><th>ID</th><th>Name</th><th>Location</th><th>Status</th><th>Health Score</th><th>RUL (days)</th><th>MTBF (hrs)</th><th>Vibration</th><th>Temp °C</th><th>Pressure bar</th></tr>
                </thead>
                <tbody>
                    {sorted.map(a => (
                        <tr key={a.id} className={a.status}>
                            <td>{a.id}</td><td>{a.name}</td><td>{a.location}</td><td>{a.status}</td>
                            <td>{a.healthScore}</td><td>{a.rul}</td><td>{a.mtbf}</td>
                            <td>{a.sensors?.vibration ?? ""}</td>
                            <td>{a.sensors?.temperature ?? ""}</td>
                            <td>{a.sensors?.pressure ?? ""}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                {sorted.map(asset => (
                    <AssetCard key={asset.id} asset={asset} canCreateWO={canCreate} />
                ))}
            </div>
        </div>
    );
}
