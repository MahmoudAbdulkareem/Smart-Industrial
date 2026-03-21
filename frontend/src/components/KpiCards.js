import React from "react";
import { useApi } from "../hooks/useApi";

export default function KpiCards() {
  const { data: assets, loading: aLoad } = useApi("/assets/health", 6000);
  const { data: energy, loading: eLoad } = useApi("/energy", 8000);

  if (aLoad || eLoad) return <p>Loading KPIs…</p>;

  const avgHealth = assets
    ? parseFloat((assets.reduce((s, a) => s + a.healthScore, 0) / assets.length).toFixed(1))
    : "-";

  const kpis = [
    { label: "Avg Health Score",   value: avgHealth,          unit: "/ 100" },
    { label: "Critical Assets",    value: assets?.filter(a => a.status === "critical").length ?? "-", unit: "assets" },
    { label: "Caution Assets",     value: assets?.filter(a => a.status === "caution").length  ?? "-", unit: "assets" },
    { label: "PUE",                value: energy?.kpis.pue   ?? "-", unit: "" },
    { label: "EER",                value: energy?.kpis.eer   ?? "-", unit: "" },
    { label: "CO₂",                value: energy?.kpis.co2   ?? "-", unit: "kg/h" },
  ];

  return (
    <div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: 16,
        marginBottom: 24,
      }}>
        {kpis.map(k => (
          <div key={k.label} style={{
            border: "1px solid #ccc", borderRadius: 6,
            padding: "16px", backgroundColor: "#fff", textAlign: "center",
          }}>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#333" }}>{k.value}</div>
            {k.unit && <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{k.unit}</div>}
          </div>
        ))}
      </div>
      <p style={{ fontSize: 13, color: "#888" }}>
        Data updates every 5–8 seconds from the backend mock API.
      </p>
    </div>
  );
}
