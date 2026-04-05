// KpiCards.js — KPI Overview tab
//
// Sprint S1 Week 2 — Journal de Bord, March 19
//   "Implemented KPI Cards for RUL, Health Score, and MTBF using mock data
//    and setInterval to mimic real-time data updates."
//
// Now uses real SQL Server data via the useApi hook (polling every 6s).
// Two API calls run in parallel:
//   /api/assets/health  → asset count, avg health score, critical/caution counts
//   /api/energy         → PUE, EER, CO2 values
//
// Both hooks start loading simultaneously — we wait for both to finish
// before rendering, rather than rendering half a card.

import React from "react";
import { useApi } from "../hooks/useApi";

// Color helpers for status-dependent styling
function healthColor(score) {
  if (score >= 70) return "#3fb950";
  if (score >= 40) return "#d29922";
  return "#f85149";
}

function KpiTile({ label, value, unit, accent, note }) {
  return (
    <div style={{
      backgroundColor: "#161b22",
      border:          `1px solid #30363d`,
      borderTop:       `3px solid ${accent || "#58a6ff"}`,
      borderRadius:    8,
      padding:         "20px 18px",
      display:         "flex",
      flexDirection:   "column",
      gap:             4,
      minWidth:        130,
    }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#8b949e", textTransform: "uppercase", letterSpacing: 0.8 }}>
        {label}
      </span>
      <span style={{ fontSize: 30, fontWeight: 700, color: "#e6edf3", lineHeight: 1.2, fontFamily: "'JetBrains Mono', monospace" }}>
        {value}
      </span>
      {unit && <span style={{ fontSize: 12, color: "#8b949e" }}>{unit}</span>}
      {note && <span style={{ fontSize: 11, color: accent || "#58a6ff", marginTop: 4 }}>{note}</span>}
    </div>
  );
}

export default function KpiCards() {
  const { data: assets, loading: aLoad, error: aErr } = useApi("/assets/health", 6000);
  const { data: energy, loading: eLoad, error: eErr } = useApi("/energy",        8000);

  if (aLoad || eLoad) return <Skeleton />;
  if (aErr) return <ErrorMsg msg={`Assets: ${aErr}`} />;
  if (eErr) return <ErrorMsg msg={`Energy: ${eErr}`} />;
  if (!Array.isArray(assets)) return <Skeleton />;

  const avgHealth   = parseFloat(
    (assets.reduce((s, a) => s + a.healthScore, 0) / assets.length).toFixed(1)
  );
  const criticalCnt = assets.filter(a => a.status === "critical").length;
  const cautionCnt  = assets.filter(a => a.status === "caution").length;
  const healthyCnt  = assets.filter(a => a.status === "healthy").length;

  return (
    <div>
      {/* Section: Asset Health */}
      <p style={sectionLabel}>Asset Health</p>
      <div style={gridStyle}>
        <KpiTile
          label="Avg Health Score"
          value={avgHealth}
          unit="out of 100"
          accent={healthColor(avgHealth)}
          note={avgHealth >= 70 ? "Fleet in good condition" : avgHealth >= 40 ? "Monitor closely" : "Immediate action needed"}
        />
        <KpiTile label="Critical"  value={criticalCnt} unit="assets" accent="#f85149" />
        <KpiTile label="Caution"   value={cautionCnt}  unit="assets" accent="#d29922" />
        <KpiTile label="Healthy"   value={healthyCnt}  unit="assets" accent="#3fb950" />
      </div>

      {/* Section: Energy */}
      <p style={{ ...sectionLabel, marginTop: 32 }}>Energy Performance</p>
      <div style={gridStyle}>
        <KpiTile
          label="PUE"
          value={energy?.kpis?.pue?.toFixed(2) ?? "—"}
          unit="Power Usage Effectiveness"
          accent="#58a6ff"
          note="Target: ≤ 1.5"
        />
        <KpiTile
          label="EER"
          value={energy?.kpis?.eer?.toFixed(2) ?? "—"}
          unit="Energy Efficiency Ratio"
          accent="#58a6ff"
          note="Higher is better"
        />
        <KpiTile
          label="CO₂ Emissions"
          value={energy?.kpis?.co2?.toFixed(1) ?? "—"}
          unit="kg / hour"
          accent="#d29922"
        />
      </div>

      <p style={{ fontSize: 12, color: "#484f58", marginTop: 24 }}>
        ⟳ Asset data refreshes every 6 s · Energy data refreshes every 8 s
      </p>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={gridStyle}>
      {[...Array(6)].map((_, i) => (
        <div key={i} style={{
          backgroundColor: "#161b22",
          border:          "1px solid #30363d",
          borderRadius:    8,
          height:          108,
          animation:       "pulse 1.5s ease-in-out infinite",
          animationDelay:  `${i * 0.1}s`,
        }} />
      ))}
      <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }`}</style>
    </div>
  );
}

function ErrorMsg({ msg }) {
  return <p style={{ color: "#f85149", fontSize: 13 }}>Error: {msg}</p>;
}

const gridStyle = {
  display:             "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
  gap:                 12,
};

const sectionLabel = {
  fontSize:      11,
  fontWeight:    600,
  color:         "#8b949e",
  textTransform: "uppercase",
  letterSpacing: 0.8,
  marginBottom:  10,
};
