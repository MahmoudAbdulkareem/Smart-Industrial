import React, { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, Cell, ReferenceLine } from "recharts";
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

function RadialGauge({ pct: p, color, label, sublabel, size = 80 }) {
    const r = size / 2 - 8, circ = 2 * Math.PI * r, dash = (p / 100) * circ;
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

function PctBar({ label, p, color, note }) {
    return (
        <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color }}>{p}%</span>
            </div>
            <div style={{ background: "#f0f4f8", borderRadius: 6, height: 8, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(p, 100)}%`, height: "100%", background: color, borderRadius: 6, transition: "width 0.7s ease" }} />
            </div>
            {note && <span style={{ fontSize: 10, color: "#9aa5b4" }}>{note}</span>}
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

function MetricsPanel({ userRole }) {
    const { t } = useLanguage();
    const [metrics,  setMetrics]  = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [active,   setActive]   = useState("pue");
    const [form,     setForm]     = useState({ zone: "", pue: "", eer: "", co2_emissions: "" });
    const [saving,   setSaving]   = useState(false);
    const [msg,      setMsg]      = useState(null);

    useEffect(() => { loadMetrics(); }, []);

    async function loadMetrics() {
        setLoading(true);
        try {
            const res = await fetch("/api/energy/metrics/latest", { headers: { Authorization: "Bearer " + getToken() } });
            if (res.ok) setMetrics(await res.json());
        } catch {}
        setLoading(false);
    }

    async function handleSubmit(e) {
        e.preventDefault(); setSaving(true); setMsg(null);
        try {
            const res = await fetch("/api/energy/metrics", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken() },
                body: JSON.stringify({ zone: form.zone, pue: parseFloat(form.pue), eer: parseFloat(form.eer), co2_emissions: parseFloat(form.co2_emissions) }),
            });
            if (res.ok) { setMsg({ ok: true, text: t("metricsRecorded") }); setForm({ zone: "", pue: "", eer: "", co2_emissions: "" }); await loadMetrics(); }
            else { const j = await res.json(); setMsg({ ok: false, text: j.error || t("metricsError") }); }
        } catch { setMsg({ ok: false, text: "Cannot connect to server." }); }
        setSaving(false);
    }

    const cfg = {
        pue: { key: "PUE", color: "#1d6fcc", label: "PUE", unit: "",       note: t("pueTarget"), target: 1.5 },
        eer: { key: "EER", color: "#059669", label: "EER", unit: "",       note: t("eerNote") },
        co2: { key: "CO2", color: "#dc2626", label: "CO₂", unit: " kg/h", note: "Lower is better", target: 100 },
    };
    const mc   = cfg[active];
    const data = metrics.map(m => ({
        zone: m.zone,
        PUE:  parseFloat(parseFloat(m.pue).toFixed(2)),
        EER:  parseFloat(parseFloat(m.eer).toFixed(2)),
        CO2:  parseFloat(parseFloat(m.co2_emissions).toFixed(1)),
    }));

    const zones = metrics.map(m => {
        const pu = parseFloat(m.pue), er = parseFloat(m.eer), co = parseFloat(m.co2_emissions);
        const { p: cop, over: coOver } = co2Vs(co);
        return { zone: m.zone, pue: pu, eer: er, co2: co, pueEff: pueEff(pu), eerPct: Math.min(100, Math.round((er / 6) * 100)), co2Pct: cop, co2Over: coOver };
    });

    return (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "20px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a2332", margin: 0 }}>{t("energyMetrics")}</h3>
                    <p style={{ fontSize: 11, color: "#9aa5b4", margin: "3px 0 0" }}>{t("zone24hAvg")}</p>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                    {Object.entries(cfg).map(([k, v]) => (
                        <button key={k} onClick={() => setActive(k)} style={{ padding: "5px 12px", fontSize: 12, fontWeight: active === k ? 700 : 400, borderRadius: 7, border: "1px solid " + (active === k ? v.color : "#d1d9e6"), background: active === k ? v.color + "18" : "#fff", color: active === k ? v.color : "#6b7a99", cursor: "pointer", fontFamily: "inherit" }}>
                            {v.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div style={{ height: 200, background: "#f8faff", borderRadius: 8 }} />
            ) : metrics.length === 0 ? (
                <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: "#9aa5b4", fontSize: 13 }}>{t("noMetricsData")}</div>
            ) : (
                <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="zone" tick={{ fontSize: 10, fill: "#9aa5b4" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                        <YAxis tick={{ fontSize: 10, fill: "#9aa5b4" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                        <Tooltip content={<ChartTip />} />
                        {mc.target && <ReferenceLine y={mc.target} stroke={mc.color} strokeDasharray="6 3" label={{ value: `Target: ${mc.target}`, fontSize: 10, fill: mc.color }} />}
                        <Bar dataKey={mc.key} name={mc.label + mc.unit} radius={[4, 4, 0, 0]}>
                            {data.map((entry, i) => {
                                const bad = (active === "pue" && entry.PUE > 1.5) || (active === "co2" && entry.CO2 > 100);
                                return <Cell key={i} fill={bad ? "#ef4444" : mc.color} />;
                            })}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            )}

            {!loading && zones.length > 0 && (
                <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                    {zones.map(z => (
                        <div key={z.zone} style={{ background: "#f8faff", border: "1px solid #e8f0fe", borderRadius: 10, padding: "12px 16px", flex: 1, minWidth: 160 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7a99", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>{z.zone}</div>
                            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                                <RadialGauge p={z.pueEff} color={z.pueEff >= 60 ? "#059669" : "#dc2626"} label={t("pueEfficiency")} sublabel={`PUE ${z.pue.toFixed(2)}`} size={72} />
                                <div style={{ flex: 1, minWidth: 100 }}>
                                    <PctBar label={t("eerScore")} p={z.eerPct} color="#059669" note={`EER ${z.eer.toFixed(2)}`} />
                                    <PctBar label={t("co2VsTarget")} p={Math.min(100, z.co2Pct)} color={z.co2Over ? "#dc2626" : "#059669"} note={`${z.co2.toFixed(1)} kg/h — ${z.co2Over ? "+" + z.co2Pct + "% " + t("overTarget") : z.co2Pct + "% " + t("underTarget")}`} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {userRole === "energy_manager" && (
                <div style={{ marginTop: 18, borderTop: "1px solid #f0f4f8", paddingTop: 16 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 600, color: "#1a2332", marginBottom: 10 }}>{t("recordNewMetrics")}</h4>
                    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                        {[
                            { name: "zone",          label: t("zone"),    placeholder: "Zone 1", type: "text" },
                            { name: "pue",           label: t("pue"),     placeholder: "1.20",   type: "number", step: "0.01" },
                            { name: "eer",           label: t("eer"),     placeholder: "3.50",   type: "number", step: "0.01" },
                            { name: "co2_emissions", label: t("co2KgH"), placeholder: "150",    type: "number", step: "0.1" },
                        ].map(f => (
                            <div key={f.name}>
                                <label style={{ fontSize: 11, color: "#6b7a99", display: "block", marginBottom: 4 }}>{f.label}</label>
                                <input name={f.name} type={f.type} step={f.step} placeholder={f.placeholder} required value={form[f.name]}
                                    onChange={e => setForm(p => ({ ...p, [f.name]: e.target.value }))}
                                    style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #d1d9e6", borderRadius: 7, color: "#1a2332", fontFamily: "inherit", width: 110, outline: "none" }} />
                            </div>
                        ))}
                        <button type="submit" disabled={saving} style={{ padding: "8px 18px", fontSize: 13, fontWeight: 600, background: "#1d6fcc", border: "none", borderRadius: 7, color: "#fff", cursor: "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1 }}>
                            {saving ? "…" : t("record")}
                        </button>
                    </form>
                    {msg && <p style={{ marginTop: 8, fontSize: 12, color: msg.ok ? "#15803d" : "#dc2626" }}>{msg.ok ? "✓" : "⚠"} {msg.text}</p>}
                </div>
            )}
        </div>
    );
}

export default function EnergyView({ userRole }) {
    const { t } = useLanguage();
    const { data, loading, error } = useApi("/energy", 15000);
    const [thresholdMsg, setThresholdMsg] = useState("");

    if (loading) return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{[70, 110, 300, 260].map((h, i) => <div key={i} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, height: h, animation: `pulse 1.4s ease-in-out ${i * 0.12}s infinite` }} />)}</div>;
    if (error)   return <p style={{ color: "#dc2626", fontSize: 13 }}>Error: {error}</p>;
    if (!data)   return null;

    const { current, baseline, water, gas, kpis, history } = data;
    const elecP  = pct(current,       baseline);
    const waterP = pct(water.current, water.baseline);
    const gasP   = pct(gas.current,   gas.baseline);
    const pueff  = pueEff(kpis.pue);
    const { p: co2P, over: co2Over } = co2Vs(kpis.co2, 60);

    async function saveThreshold(e) {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
            const res = await fetch("/api/thresholds", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken() }, body: JSON.stringify({ assetId: fd.get("assetId"), metric: fd.get("metric"), value: parseFloat(fd.get("value")) }) });
            setThresholdMsg(res.ok ? t("thresholdSaved") : t("thresholdError"));
        } catch { setThresholdMsg("Cannot connect to server."); }
    }

    const resources = [
        { label: t("electricity"), actual: current,       base: baseline,       unit: "kWh",   icon: "⚡", p: elecP },
        { label: t("water"),       actual: water.current, base: water.baseline, unit: "L/min", icon: "💧", p: waterP },
        { label: t("gas"),         actual: gas.current,   base: gas.baseline,   unit: "m³/h",  icon: "🔥", p: gasP },
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {[
                    { label: "PUE", value: kpis.pue.toFixed(2), note: t("pueTarget"), ok: kpis.pue <= 1.5, extra: `${pueff}% ${t("efficiency")}` },
                    { label: "EER", value: kpis.eer.toFixed(2), note: t("eerNote"),   ok: true, extra: `${Math.round((kpis.eer / 6) * 100)}% of max` },
                    { label: "CO₂", value: kpis.co2.toFixed(1) + " kg/h", note: t("co2Emissions"), ok: !co2Over, extra: co2Over ? `+${co2P}% ${t("overTarget")}` : `-${co2P}% ${t("underTarget")}` },
                ].map(k => (
                    <div key={k.label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderTop: "3px solid #1d6fcc", borderRadius: 10, padding: "16px 22px", minWidth: 130, textAlign: "center", flex: 1, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "#6b7a99", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6 }}>{k.label}</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: k.ok ? "#1a2332" : "#dc2626" }}>{k.value}</div>
                        <div style={{ fontSize: 11, color: k.ok ? "#6b7a99" : "#dc2626", marginTop: 4 }}>{k.note}</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: k.ok ? "#059669" : "#dc2626", marginTop: 4 }}>{k.extra}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {resources.map(r => (
                    <div key={r.label} style={{ background: "#fff", border: "1px solid " + (r.p.over ? "#fecaca" : "#bbf7d0"), borderRadius: 10, padding: "14px 18px", flex: 1, minWidth: 160, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                            <span>{r.icon}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{r.label}</span>
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: r.p.over ? "#dc2626" : "#15803d" }}>
                            {r.actual} <span style={{ fontSize: 12, fontWeight: 400, color: "#9aa5b4" }}>{r.unit}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "#9aa5b4", marginTop: 4 }}>{t("baseline")}: {r.base} {r.unit}</div>
                        <div style={{ marginTop: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                <span style={{ fontSize: 10, color: "#9aa5b4" }}>vs {t("baseline")}</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: r.p.over ? "#dc2626" : "#059669" }}>{r.p.over ? "+" : "-"}{r.p.p}%</span>
                            </div>
                            <div style={{ background: "#f0f4f8", borderRadius: 4, height: 6, overflow: "hidden" }}>
                                <div style={{ width: `${Math.min(r.p.p, 100)}%`, height: "100%", background: r.p.over ? "#ef4444" : "#22c55e", borderRadius: 4, transition: "width 0.5s ease" }} />
                            </div>
                        </div>
                        {r.p.over && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>⚠ {t("aboveBaseline")}</div>}
                    </div>
                ))}
            </div>

            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a2332", marginBottom: 14 }}>{t("overallPerformance")}</h3>
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
                    <RadialGauge p={pueff} color={pueff >= 60 ? "#1d6fcc" : "#dc2626"} label={t("pueEfficiency")} sublabel={`PUE: ${kpis.pue.toFixed(2)}`} size={90} />
                    <RadialGauge p={Math.min(100, Math.round((kpis.eer / 6) * 100))} color="#059669" label={t("eerScore")} sublabel={`EER: ${kpis.eer.toFixed(2)}`} size={90} />
                    <RadialGauge p={Math.min(100, co2P)} color={co2Over ? "#dc2626" : "#059669"} label={t("co2VsTarget")} sublabel={`${kpis.co2.toFixed(1)} kg/h`} size={90} />
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <PctBar label={t("electricity")} p={Math.min(100, elecP.p)}  color={elecP.over  ? "#ef4444" : "#22c55e"} note={`${elecP.over  ? "+" : "-"}${elecP.p}% vs baseline`} />
                        <PctBar label={t("water")}       p={Math.min(100, waterP.p)} color={waterP.over ? "#ef4444" : "#22c55e"} note={`${waterP.over ? "+" : "-"}${waterP.p}% vs baseline`} />
                        <PctBar label={t("gas")}         p={Math.min(100, gasP.p)}   color={gasP.over   ? "#ef4444" : "#22c55e"} note={`${gasP.over   ? "+" : "-"}${gasP.p}% vs baseline`} />
                    </div>
                </div>
            </div>

            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "20px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "#1a2332", marginBottom: 18 }}>{t("electricity24h")}</h3>
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
            </div>

            <MetricsPanel userRole={userRole} />

            {userRole === "energy_manager" && (
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: "#1a2332", marginBottom: 6 }}>{t("configureThresholds")}</h3>
                    <p style={{ fontSize: 12, color: "#6b7a99", marginBottom: 16 }}>{t("thresholdDesc")}</p>
                    <form onSubmit={saveThreshold} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                        {[{ name: "assetId", label: t("assetIdLabel"), placeholder: "AST-001" }, { name: "metric", label: t("metric"), placeholder: "temperature" }, { name: "value", label: t("threshold"), placeholder: "75", type: "number" }].map(f => (
                            <div key={f.name}>
                                <label style={{ fontSize: 11, color: "#6b7a99", display: "block", marginBottom: 4 }}>{f.label}</label>
                                <input name={f.name} type={f.type || "text"} placeholder={f.placeholder} required style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #d1d9e6", borderRadius: 7, color: "#1a2332", fontFamily: "inherit", width: 130, outline: "none" }} />
                            </div>
                        ))}
                        <button type="submit" style={{ padding: "8px 18px", fontSize: 13, fontWeight: 600, background: "#1d6fcc", border: "none", borderRadius: 7, color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>{t("save")}</button>
                    </form>
                    {thresholdMsg && <p style={{ marginTop: 10, fontSize: 12, color: "#15803d" }}>{thresholdMsg}</p>}
                </div>
            )}
        </div>
    );
}
