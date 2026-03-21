import React, { useState } from "react";
import HealthView from "./components/HealthView";
import EnergyView from "./components/EnergyView";
import KpiCards   from "./components/KpiCards";

const TABS = [
  { id: "kpis",   label: "KPI Overview" },
  { id: "health", label: "Health View" },
  { id: "energy", label: "Energy View" },
];

export default function App() {
  const [tab, setTab] = useState("kpis");

  return (
    <div style={{ fontFamily: "Arial, sans-serif", minHeight: "100vh", backgroundColor: "#f5f5f5" }}>

      {/* Top navbar */}
      <nav style={{
        backgroundColor: "#343a40",
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        gap: 24,
        height: 52,
      }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 16, marginRight: 16 }}>
          Smart Industrial Dashboard
        </span>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: "none",
              border: "none",
              color: tab === t.id ? "#fff" : "#adb5bd",
              fontSize: 14,
              cursor: "pointer",
              padding: "0 4px",
              borderBottom: tab === t.id ? "2px solid #007bff" : "2px solid transparent",
              height: 52,
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Main content */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>
          {TABS.find(t => t.id === tab)?.label}
        </h2>
        <p style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>
          {tab === "kpis"   && "Summary of all asset and energy KPIs. Refreshes every 5 seconds."}
          {tab === "health" && "Asset health scores, RUL, MTBF, and live sensor readings."}
          {tab === "energy" && "Energy consumption vs baseline, PUE, EER, and CO₂."}
        </p>

        {tab === "kpis"   && <KpiCards />}
        {tab === "health" && <HealthView />}
        {tab === "energy" && <EnergyView />}
      </main>
    </div>
  );
}
