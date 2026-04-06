import React from "react";
import { useApi } from "../hooks/useApi";

function KpiTile({ label, value, unit, color, icon }) {
  return (
    <div style={{
      background: "#fff", 
      border: "1px solid #dde3ec", 
      borderRadius: 10,
      padding: "20px 18px", 
      textAlign: "center",
      borderTop: `3px solid ${color}`,
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    }}>
      <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7a99", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "#1a2332", lineHeight: 1 }}>{value}</div>
      {unit && <div style={{ fontSize: 11, color: "#9aa5b4", marginTop: 4 }}>{unit}</div>}
    </div>
  );
}

function healthColor(score) {
  if (score >= 70) return "#16a34a";
  if (score >= 40) return "#d97706";
  return "#dc2626";
}

export default function KpiCards() {
  const { data: assets, loading: aLoad, error: aErr } = useApi("/assets/health", 10000);
  const { data: energy, loading: eLoad, error: eErr } = useApi("/energy", 10000);

  if (aLoad || eLoad) return <div style={container}><Skeleton /></div>;
  if (aErr) return <div style={container}><Err msg={aErr} /></div>;
  if (eErr) return <div style={container}><Err msg={eErr} /></div>;
  if (!Array.isArray(assets)) return <div style={container}><Skeleton /></div>;

  const avgHealth = parseFloat((assets.reduce((s, a) => s + a.healthScore, 0) / assets.length).toFixed(1));
  const critical  = assets.filter(a => a.status === "critical").length;
  const caution   = assets.filter(a => a.status === "caution").length;
  const healthy   = assets.filter(a => a.status === "healthy").length;

  return (
    <div style={container}>
      <p style={sLabel}>Asset Health</p>
      <div style={grid}>
        <KpiTile label="Avg Health Score" value={avgHealth} unit="out of 100"  color={healthColor(avgHealth)} icon="🏥" />
        <KpiTile label="Critical Assets"  value={critical}  unit="assets"      color="#dc2626"  icon="🔴" />
        <KpiTile label="Caution Assets"   value={caution}   unit="assets"      color="#d97706"  icon="🟡" />
        <KpiTile label="Healthy Assets"   value={healthy}   unit="assets"      color="#16a34a"  icon="🟢" />
      </div>

      <p style={{ ...sLabel, marginTop: 28 }}>Energy KPIs</p>
      <div style={grid}>
        <KpiTile label="PUE"  value={energy?.kpis.pue.toFixed(2) ?? "—"} unit="Target ≤ 1.5"   color="#1d6fcc" icon="⚡" />
        <KpiTile label="EER"  value={energy?.kpis.eer.toFixed(2) ?? "—"} unit="Higher = better" color="#1d6fcc" icon="♻️" />
        <KpiTile label="CO₂"  value={energy?.kpis.co2.toFixed(1) ?? "—"} unit="kg / hour"       color="#7c3aed" icon="🌿" />
      </div>
      
      <p style={{ fontSize: 12, color: "#9aa5b4", marginTop: 20, textAlign: "center" }}>⟳ Refreshes every 10 s</p>
    </div>
  );
}

// --- Styles ---

const container = {
  maxWidth: "900px",    // Limits the width of the dashboard
  margin: "40px auto",  // Centers the container horizontally and adds top/bottom spacing
  padding: "0 20px",    // Adds padding for mobile screens
};

const grid = { 
  display: "grid", 
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", // changed auto-fill to auto-fit
  justifyContent: "center", // Centers cards within the grid row
  gap: 12 
};

const sLabel = { 
  fontSize: 11, 
  fontWeight: 600, 
  color: "#6b7a99", 
  textTransform: "uppercase", 
  letterSpacing: 0.7, 
  marginBottom: 10,
  textAlign: "center" // Centers the section titles
};

function Skeleton() {
  return (
    <div style={grid}>
      {[...Array(7)].map((_, i) => (
        <div key={i} style={{ background: "#fff", border: "#dde3ec 1px solid", borderRadius: 10, height: 110 }} />
      ))}
    </div>
  );
}

function Err({ msg }) { 
  return <p style={{ color: "#dc2626", fontSize: 13, textAlign: "center" }}>Error: {msg}</p>; 
}