import React from "react";
import { useApi } from "../hooks/useApi";
import { useLanguage } from "../context/LanguageContext";

function KpiTile({ label, value, unit, color, icon }) {
    return (
        <div style={{ background: "#fff", border: "1px solid #dde3ec", borderRadius: 10, padding: "20px 18px", textAlign: "center", borderTop: `3px solid ${color}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7a99", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#1a2332", lineHeight: 1 }}>{value}</div>
            {unit && <div style={{ fontSize: 11, color: "#9aa5b4", marginTop: 4 }}>{unit}</div>}
        </div>
    );
}

function healthColor(s) {
    if (s >= 70) return "#16a34a";
    if (s >= 40) return "#d97706";
    return "#dc2626";
}

const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 };
const sLabel = { fontSize: 11, fontWeight: 600, color: "#6b7a99", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 10, textAlign: "center" };

export default function KpiCards() {
    const { t } = useLanguage();
    const { data: assets, loading: aLoad, error: aErr } = useApi("/assets/health", 15000);
    const { data: energy, loading: eLoad, error: eErr } = useApi("/energy", 15000);

    if (aLoad || eLoad) {
        return (
            <div style={{ maxWidth: 900, margin: "40px auto", padding: "0 20px" }}>
                <div style={grid}>{[...Array(7)].map((_, i) => <div key={i} style={{ background: "#fff", border: "1px solid #dde3ec", borderRadius: 10, height: 110, animation: `pulse 1.4s ease-in-out ${i * 0.1}s infinite` }} />)}</div>
            </div>
        );
    }
    if (aErr) return <p style={{ color: "#dc2626", fontSize: 13, textAlign: "center" }}>Error: {aErr}</p>;
    if (eErr) return <p style={{ color: "#dc2626", fontSize: 13, textAlign: "center" }}>Error: {eErr}</p>;
    if (!Array.isArray(assets)) return null;

    const avgHealth = parseFloat((assets.reduce((s, a) => s + a.healthScore, 0) / assets.length).toFixed(1));
    const critical  = assets.filter(a => a.status === "critical").length;
    const caution   = assets.filter(a => a.status === "caution").length;
    const healthy   = assets.filter(a => a.status === "healthy").length;

    return (
        <div style={{ maxWidth: 900, margin: "40px auto", padding: "0 20px" }}>
            <p style={sLabel}>{t("assetHealth")}</p>
            <div style={grid}>
                <KpiTile label={t("avgHealthScore")} value={avgHealth} unit={t("outOf100")}  color={healthColor(avgHealth)} icon="🏥" />
                <KpiTile label={t("criticalAssets")} value={critical}  unit={t("assets")}    color="#dc2626" icon="🔴" />
                <KpiTile label={t("cautionAssets")}  value={caution}   unit={t("assets")}    color="#d97706" icon="🟡" />
                <KpiTile label={t("healthyAssets")}  value={healthy}   unit={t("assets")}    color="#16a34a" icon="🟢" />
            </div>
            <p style={{ ...sLabel, marginTop: 28 }}>{t("energyPerformance")}</p>
            <div style={grid}>
                <KpiTile label="PUE" value={energy?.kpis.pue.toFixed(2) ?? "—"} unit={t("pueTarget")}  color="#1d6fcc" icon="⚡" />
                <KpiTile label="EER" value={energy?.kpis.eer.toFixed(2) ?? "—"} unit={t("eerNote")}    color="#1d6fcc" icon="♻️" />
                <KpiTile label="CO₂" value={energy?.kpis.co2.toFixed(1) ?? "—"} unit="kg / hour"       color="#7c3aed" icon="🌿" />
            </div>
            <p style={{ fontSize: 12, color: "#9aa5b4", marginTop: 20, textAlign: "center" }}>⟳ {t("refresh")} every 15s</p>
        </div>
    );
}
