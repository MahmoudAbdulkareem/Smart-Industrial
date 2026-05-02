import React, { useState, useRef } from "react";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend
} from "recharts";
import { useApi } from "../hooks/useApi";
import { useLanguage } from "../context/LanguageContext";

function getToken() { return localStorage.getItem("token"); }

function pct(actual, baseline) {
    if (!baseline) return { p: 0, over: false };
    const d = actual - baseline;
    return { p: parseFloat(Math.abs((d / baseline) * 100).toFixed(1)), over: d > 0 };
}
function pueEff(pue) { return parseFloat(Math.max(0, Math.min(100, ((3.0 - pue) / 2.0) * 100)).toFixed(1)); }
function co2Vs(actual, target = 100) {
    const d = actual - target;
    return { p: parseFloat(Math.abs((d / target) * 100).toFixed(1)), over: d > 0 };
}

function exportCSV(data, filename) {
    if (!data || !data.length) return;
    const keys = Object.keys(data[0]);
    const csv = [keys.join(","), ...data.map(r => keys.map(k => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename + ".csv"; a.click();
    URL.revokeObjectURL(url);
}

function exportExcel(data, filename) {
    if (!data || !data.length) return;
    const keys = Object.keys(data[0]);
    const rows = [keys, ...data.map(r => keys.map(k => r[k] ?? ""))];
    const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Sheet1"><Table>${
        rows.map(r => `<Row>${r.map(c => `<Cell><Data ss:Type="${typeof c === "number" ? "Number" : "String"}">${String(c).replace(/&/g,"&amp;").replace(/</g,"&lt;")}</Data></Cell>`).join("")}</Row>`).join("")
    }</Table></Worksheet></Workbook>`;
    const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename + ".xls"; a.click();
    URL.revokeObjectURL(url);
}

function exportPDF(tableRef, filename) {
    const printWin = window.open("", "_blank");
    const html = `<!DOCTYPE html><html><head><title>${filename}</title>
    <style>body{font-family:Inter,Arial,sans-serif;padding:24px;color:#1a2332}h2{font-size:18px;margin-bottom:16px}
    table{width:100%;border-collapse:collapse;font-size:12px}th{background:#1d6fcc;color:#fff;padding:9px 12px;text-align:left}
    td{padding:8px 12px;border-bottom:1px solid #e2e8f0}tr:nth-child(even){background:#f8faff}
    @media print{body{padding:0}}</style></head><body>
    <h2>${filename}</h2>${tableRef.current?.outerHTML || ""}<script>window.onload=()=>{window.print();window.close()}</script>
    </body></html>`;
    printWin.document.write(html);
    printWin.document.close();
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

function RadialGauge({ pct: p, color, label, sublabel, size = 80 }) {
    const r = size / 2 - 8, circ = 2 * Math.PI * r, dash = (Math.min(p,100) / 100) * circ;
    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f0f4f8" strokeWidth={7} />
                <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7}
                    strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                    transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: "stroke-dasharray 0.6s ease" }} />
                <text x={size/2} y={size/2 + 5} textAnchor="middle" fontSize={13} fontWeight={700} fill={color}>{p}%</text>
            </svg>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#374151", textAlign: "center" }}>{label}</span>
            {sublabel && <span style={{ fontSize: 10, color: "#9aa5b4", textAlign: "center" }}>{sublabel}</span>}
        </div>
    );
}

function ChartTip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
            <p style={{ color: "#6b7a99", marginBottom: 4, fontWeight: 500 }}>{label}</p>
            {payload.map(p => <p key={p.name} style={{ color: p.color, margin: "2px 0" }}>{p.name}: <strong>{typeof p.value === "number" ? p.value.toFixed(2) : p.value}</strong></p>)}
        </div>
    );
}

function ResourceCard({ label, icon, actual, base, unit, p }) {
    const bad = p.over;
    return (
        <div style={{
            background: "#fff", borderRadius: 12,
            border: "1px solid " + (bad ? "#fecaca" : "#bbf7d0"),
            borderTop: "3px solid " + (bad ? "#ef4444" : "#22c55e"),
            padding: "18px 20px", flex: 1, minWidth: 170,
            boxShadow: "0 1px 6px rgba(0,0,0,0.04)"
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 20 }}>{icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{label}</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: bad ? "#dc2626" : "#15803d", letterSpacing: -0.5 }}>
                {actual}
                <span style={{ fontSize: 13, fontWeight: 400, color: "#9aa5b4", marginLeft: 4 }}>{unit}</span>
            </div>
            <div style={{ fontSize: 11, color: "#9aa5b4", marginTop: 2 }}>Baseline: {base} {unit}</div>
            <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: "#9aa5b4" }}>vs baseline</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: bad ? "#dc2626" : "#059669" }}>
                        {bad ? "+" : "-"}{p.p}%
                    </span>
                </div>
                <div style={{ background: "#f0f4f8", borderRadius: 4, height: 5, overflow: "hidden" }}>
                    <div style={{ width: Math.min(p.p, 100) + "%", height: "100%", background: bad ? "#ef4444" : "#22c55e", borderRadius: 4, transition: "width 0.5s ease" }} />
                </div>
            </div>
            {bad && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 6, fontWeight: 500 }}>⚠ Above baseline</div>}
        </div>
    );
}

function KpiPill({ label, value, note, extra, ok }) {
    return (
        <div style={{
            background: "#fff", border: "1px solid #e2e8f0",
            borderTop: "3px solid " + (ok ? "#1d6fcc" : "#ef4444"),
            borderRadius: 12, padding: "16px 22px",
            minWidth: 140, textAlign: "center", flex: 1,
            boxShadow: "0 1px 6px rgba(0,0,0,0.04)"
        }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7a99", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: ok ? "#1a2332" : "#dc2626", letterSpacing: -0.5 }}>{value}</div>
            <div style={{ fontSize: 11, color: ok ? "#9aa5b4" : "#ef4444", marginTop: 4 }}>{note}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: ok ? "#059669" : "#dc2626", marginTop: 4 }}>{extra}</div>
        </div>
    );
}

function OverallEnergyReview({ kpis, elecP, waterP, gasP, current, water, gas, baseline }) {
    const pueff  = pueEff(kpis.pue);
    const eerPct = Math.min(100, Math.round((kpis.eer / 6) * 100));
    const { p: co2P, over: co2Over } = co2Vs(kpis.co2, 60);

    const metrics = [
        {
            key: "pue",
            label: "PUE Efficiency",
            pct: pueff,
            color: pueff >= 60 ? "#1d6fcc" : "#ef4444",
            good: pueff >= 60,
            value: kpis.pue.toFixed(2),
            unit: "",
            caption: pueff >= 60 ? "Within target (≤ 1.5)" : "Above target (≤ 1.5)",
            icon: "⚡",
        },
        {
            key: "eer",
            label: "EER Score",
            pct: eerPct,
            color: "#059669",
            good: true,
            value: kpis.eer.toFixed(2),
            unit: "",
            caption: "Higher is better",
            icon: "❄️",
        },
        {
            key: "co2",
            label: "CO₂ vs Target",
            pct: Math.min(100, co2P),
            color: co2Over ? "#ef4444" : "#059669",
            good: !co2Over,
            value: kpis.co2.toFixed(1),
            unit: " kg/h",
            caption: co2Over ? `+${co2P}% over target` : `-${co2P}% under target`,
            icon: "🌿",
        },
    ];

    const resources = [
        { label: "Electricity", pct: elecP.p, bad: elecP.over, note: `${elecP.over ? "+" : "-"}${elecP.p}% vs baseline`, color: elecP.over ? "#ef4444" : "#22c55e" },
        { label: "Water",       pct: waterP.p, bad: waterP.over, note: `${waterP.over ? "+" : "-"}${waterP.p}% vs baseline`, color: waterP.over ? "#ef4444" : "#22c55e" },
        { label: "Gas",         pct: gasP.p,   bad: gasP.over,   note: `${gasP.over ? "+" : "-"}${gasP.p}% vs baseline`,   color: gasP.over   ? "#ef4444" : "#22c55e" },
    ];

    return (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "22px 24px", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
                <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1a2332", margin: 0 }}>Overall Energy Review</h3>
                    <p style={{ fontSize: 11, color: "#9aa5b4", margin: "4px 0 0" }}>Live KPIs · Resource consumption vs baseline</p>
                </div>
                <span style={{
                    fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 20,
                    background: elecP.over || waterP.over || gasP.over ? "#fef2f2" : "#f0fdf4",
                    color: elecP.over || waterP.over || gasP.over ? "#b91c1c" : "#166534",
                    border: "1px solid " + (elecP.over || waterP.over || gasP.over ? "#fecaca" : "#bbf7d0")
                }}>
                    {elecP.over || waterP.over || gasP.over ? "⚠ Action needed" : "✓ On target"}
                </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
                {metrics.map(m => (
                    <div key={m.key} style={{
                        background: "#f8faff", border: "1px solid #e8f0fe",
                        borderRadius: 12, padding: "16px 18px",
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 10
                    }}>
                        <RadialGauge pct={m.pct} color={m.color} label={m.label} sublabel={m.value + m.unit} size={88} />
                        <span style={{
                            fontSize: 11, fontWeight: 600,
                            color: m.good ? "#059669" : "#dc2626",
                            background: m.good ? "#f0fdf4" : "#fef2f2",
                            border: "1px solid " + (m.good ? "#bbf7d0" : "#fecaca"),
                            padding: "2px 9px", borderRadius: 20
                        }}>{m.caption}</span>
                    </div>
                ))}
            </div>

            <div style={{ borderTop: "1px solid #f0f4f8", paddingTop: 18 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7a99", textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 14px" }}>Resource Consumption</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {resources.map(r => (
                        <div key={r.label} style={{ display: "grid", gridTemplateColumns: "90px 1fr 80px", alignItems: "center", gap: 12 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{r.label}</span>
                            <div style={{ background: "#f0f4f8", borderRadius: 6, height: 8, overflow: "hidden" }}>
                                <div style={{ width: Math.min(r.pct, 100) + "%", height: "100%", background: r.color, borderRadius: 6, transition: "width 0.7s ease" }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: r.bad ? "#dc2626" : "#059669", textAlign: "right", whiteSpace: "nowrap" }}>
                                {r.note}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function EnergyView({ userRole }) {
    const { t } = useLanguage();
    const { data, loading, error } = useApi("/energy", 15000);
    const [thresholdMsg, setThresholdMsg] = useState("");
    
    const histTableRef = useRef(null);
    const fullTableRef = useRef(null);

    if (loading) return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[70, 110, 300, 260].map((h, i) => (
                <div key={i} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, height: h, animation: `pulse 1.4s ease-in-out ${i * 0.12}s infinite` }} />
            ))}
        </div>
    );
    if (error) return <p style={{ color: "#dc2626", fontSize: 13 }}>Error: {error}</p>;
    if (!data) return null;

    const { current, baseline, water, gas, kpis, history } = data;
    const elecP  = pct(current,       baseline);
    const waterP = pct(water.current, water.baseline);
    const gasP   = pct(gas.current,   gas.baseline);
    const pueff  = pueEff(kpis.pue);
    const { p: co2P, over: co2Over } = co2Vs(kpis.co2, 60);

    const resources = [
        { label: t("electricity"), actual: current,       base: baseline,       unit: "kWh",   icon: "⚡", p: elecP  },
        { label: t("water"),       actual: water.current, base: water.baseline, unit: "L/min", icon: "💧", p: waterP },
        { label: t("gas"),         actual: gas.current,   base: gas.baseline,   unit: "m³/h",  icon: "🔥", p: gasP   },
    ];

    const exportData = history.map(h => ({ Hour: h.hour, "Actual (kWh)": h.actual, "Baseline (kWh)": h.baseline }));

    const fullExportData = [
        { Section: "KPIs", Metric: "PUE", Value: kpis.pue.toFixed(2), Target: "≤ 1.5", Status: kpis.pue <= 1.5 ? "OK" : "OVER" },
        { Section: "KPIs", Metric: "EER", Value: kpis.eer.toFixed(2), Target: "Higher is better", Status: "OK" },
        { Section: "KPIs", Metric: "CO₂ (kg/h)", Value: kpis.co2.toFixed(1), Target: "60", Status: co2Over ? "OVER" : "OK" },
        { Section: "Resources", Metric: "Electricity (kWh)", Value: current, Target: baseline, Status: elecP.over ? "ABOVE" : "BELOW" },
        { Section: "Resources", Metric: "Water (L/min)", Value: water.current, Target: water.baseline, Status: waterP.over ? "ABOVE" : "BELOW" },
        { Section: "Resources", Metric: "Gas (m³/h)", Value: gas.current, Target: gas.baseline, Status: gasP.over ? "ABOVE" : "BELOW" },
        ...history.map(h => ({ Section: "24h History", Metric: h.hour, Value: h.actual, Target: h.baseline, Status: h.actual > h.baseline ? "ABOVE" : "BELOW" })),
    ];

    async function saveThreshold(e) {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
            const res = await fetch("/api/thresholds", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken() },
                body: JSON.stringify({ assetId: fd.get("assetId"), metric: fd.get("metric"), value: parseFloat(fd.get("value")) }),
            });
            setThresholdMsg(res.ok ? t("thresholdSaved") : t("thresholdError"));
        } catch { setThresholdMsg("Cannot connect to server."); }
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div>
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1a2332", margin: 0 }}>{t("energyView")}</h2>
                    <p style={{ fontSize: 11, color: "#9aa5b4", margin: "3px 0 0" }}>Live data · auto-refreshes every 15s</p>
                </div>
                <ExportBar data={fullExportData} tableRef={fullTableRef} filename="energy_full_report" />
                {/* Hidden full table for PDF */}
                <table ref={fullTableRef} style={{ display: "none" }}>
                    <thead><tr><th>Section</th><th>Metric</th><th>Value</th><th>Target/Baseline</th><th>Status</th></tr></thead>
                    <tbody>{fullExportData.map((r, i) => <tr key={i}><td>{r.Section}</td><td>{r.Metric}</td><td>{r.Value}</td><td>{r.Target}</td><td>{r.Status}</td></tr>)}</tbody>
                </table>
            </div>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <KpiPill label="PUE"  value={kpis.pue.toFixed(2)}           note={t("pueTarget")}     ok={kpis.pue <= 1.5} extra={`${pueff}% ${t("efficiency")}`} />
                <KpiPill label="EER"  value={kpis.eer.toFixed(2)}           note={t("eerNote")}       ok={true}             extra={`${Math.round((kpis.eer/6)*100)}% of max`} />
                <KpiPill label="CO₂"  value={kpis.co2.toFixed(1) + " kg/h"} note={t("co2Emissions")} ok={!co2Over}         extra={co2Over ? `+${co2P}% ${t("overTarget")}` : `-${co2P}% ${t("underTarget")}`} />
            </div>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                {resources.map(r => <ResourceCard key={r.label} {...r} />)}
            </div>

            <OverallEnergyReview kpis={kpis} elecP={elecP} waterP={waterP} gasP={gasP}
                current={current} water={water} gas={gas} baseline={baseline} />

            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "20px 22px", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a2332", margin: 0 }}>{t("electricity24h")}</h3>
                    <ExportBar data={exportData} tableRef={histTableRef} filename="energy_24h" />
                </div>
                <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1d6fcc" stopOpacity={0.18}/><stop offset="95%" stopColor="#1d6fcc" stopOpacity={0}/></linearGradient>
                            <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#9aa5b4" stopOpacity={0.12}/><stop offset="95%" stopColor="#9aa5b4" stopOpacity={0}/></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#9aa5b4" }} interval={3} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                        <YAxis tick={{ fontSize: 10, fill: "#9aa5b4" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                        <Tooltip content={<ChartTip />} />
                        <Legend wrapperStyle={{ fontSize: 12, color: "#6b7a99", paddingTop: 10 }} />
                        <Area type="monotone" dataKey="baseline" name="Baseline" stroke="#9aa5b4" strokeDasharray="5 3" fill="url(#gB)" strokeWidth={1.5} />
                        <Area type="monotone" dataKey="actual"   name="Actual"   stroke="#1d6fcc" fill="url(#gA)" strokeWidth={2} />
                    </AreaChart>
                </ResponsiveContainer>

                <table ref={histTableRef} style={{ display: "none" }}>
                    <thead><tr><th>Hour</th><th>Actual (kWh)</th><th>Baseline (kWh)</th></tr></thead>
                    <tbody>{history.map((h, i) => <tr key={i}><td>{h.hour}</td><td>{h.actual}</td><td>{h.baseline}</td></tr>)}</tbody>
                </table>
            </div>


            {userRole === "energy_manager" && (
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 22, boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: "#1a2332", marginBottom: 6 }}>{t("configureThresholds")}</h3>
                    <p style={{ fontSize: 12, color: "#6b7a99", marginBottom: 16 }}>{t("thresholdDesc")}</p>
                    <form onSubmit={saveThreshold} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                        {[
                            { name: "assetId", label: t("assetIdLabel"), placeholder: "AST-001" },
                            { name: "metric",  label: t("metric"),       placeholder: "temperature" },
                            { name: "value",   label: t("threshold"),    placeholder: "75", type: "number" },
                        ].map(f => (
                            <div key={f.name}>
                                <label style={{ fontSize: 11, color: "#6b7a99", display: "block", marginBottom: 4 }}>{f.label}</label>
                                <input name={f.name} type={f.type || "text"} placeholder={f.placeholder} required
                                    style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #d1d9e6", borderRadius: 8, color: "#1a2332", fontFamily: "inherit", width: 130, outline: "none" }} />
                            </div>
                        ))}
                        <button type="submit" style={{ padding: "8px 18px", fontSize: 13, fontWeight: 600, background: "#1d6fcc", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>{t("save")}</button>
                    </form>
                    {thresholdMsg && <p style={{ marginTop: 10, fontSize: 12, color: "#15803d" }}>{thresholdMsg}</p>}
                </div>
            )}
        </div>
    );
}