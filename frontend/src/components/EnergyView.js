// EnergyView.js — Energy Management tab
//
// Sprint S1 Week 2 — Journal de Bord, March 18
//   "Started Energy View and created a baseline vs actual consumption chart
//    using Recharts. Normalizing different energy units like kWh, m3, and
//    liters requires proper planning in data modeling."
//   "Dynamic color coding per bar in a chart is difficult to implement.
//    Resolved by creating a custom color function."
//
// Now uses an AreaChart from Recharts to show 24h electricity history.
// Three resource cards (Electricity, Water, Gas) show current vs baseline.
// If actual > baseline × 1.05, the card highlights in red with a warning.
//
// The configure thresholds form is only visible to energy_manager role.
// This is role-based UI — the API also enforces this on the backend.
//
// Recharts key concepts:
//   ResponsiveContainer — makes the chart fill its parent div's width
//   AreaChart           — line chart with a filled area below the line
//   XAxis dataKey       — which field from each data object is the x-axis
//   Tooltip             — hover popup showing exact values
//   Legend              — colour key at the bottom

import React, { useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useApi } from "../hooks/useApi";

// Custom tooltip so it matches the dark theme
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      backgroundColor: "#1c2128",
      border:          "1px solid #30363d",
      borderRadius:    6,
      padding:         "8px 12px",
      fontSize:        12,
    }}>
      <p style={{ color: "#8b949e", marginBottom: 4 }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color, margin: "2px 0" }}>
          {p.name}: <strong style={{ fontFamily: "'JetBrains Mono', monospace" }}>{p.value} kWh</strong>
        </p>
      ))}
    </div>
  );
}

export default function EnergyView({ userRole }) {
  const { data, loading, error } = useApi("/energy", 8000);
  const [thresholdMsg, setThresholdMsg] = useState("");

  if (loading) return <Skeleton />;
  if (error)   return <p style={{ color: "#f85149", fontSize: 13 }}>Error: {error}</p>;
  if (!data)   return <Skeleton />;

  const { current, baseline, water, gas, kpis, history } = data;

  async function saveThreshold(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/api/thresholds", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          assetId: formData.get("assetId"),
          metric:  formData.get("metric"),
          value:   parseFloat(formData.get("value")),
        }),
      });
      if (res.ok) setThresholdMsg("✓ Threshold saved successfully");
      else        setThresholdMsg("⚠ Failed to save threshold");
    } catch {
      setThresholdMsg("⚠ Cannot connect to server");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* KPI tiles row */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {[
          {
            label: "PUE",
            value: kpis.pue.toFixed(2),
            note:  kpis.pue <= 1.5 ? "✓ Within target" : "⚠ Above target",
            ok:    kpis.pue <= 1.5,
            title: "Power Usage Effectiveness — target ≤ 1.5",
          },
          {
            label: "EER",
            value: kpis.eer.toFixed(2),
            note:  "Higher is better",
            ok:    true,
            title: "Energy Efficiency Ratio",
          },
          {
            label: "CO₂",
            value: kpis.co2.toFixed(1),
            note:  "kg / hour",
            ok:    kpis.co2 <= 60,
            title: "CO₂ equivalent emissions",
          },
        ].map(k => (
          <div key={k.label} title={k.title} style={{
            backgroundColor: "#161b22",
            border:          "1px solid #30363d",
            borderRadius:    8,
            padding:         "14px 20px",
            minWidth:        120,
            textAlign:       "center",
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#8b949e", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: k.ok ? "#e6edf3" : "#f85149", fontFamily: "'JetBrains Mono', monospace" }}>{k.value}</div>
            <div style={{ fontSize: 11, color: k.ok ? "#3fb950" : "#f85149", marginTop: 4 }}>{k.note}</div>
          </div>
        ))}
      </div>

      {/* Resource cards: Electricity, Water, Gas */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {[
          { label: "Electricity", actual: current,       base: baseline,       unit: "kWh",   icon: "⚡" },
          { label: "Water",       actual: water.current, base: water.baseline, unit: "L/min", icon: "💧" },
          { label: "Gas",         actual: gas.current,   base: gas.baseline,   unit: "m³/h",  icon: "🔥" },
        ].map(r => {
          const over = r.actual > r.base * 1.05;
          const pct  = ((r.actual / r.base) * 100).toFixed(0);
          return (
            <div key={r.label} style={{
              backgroundColor: over ? "#3d1a1a" : "#161b22",
              border:          `1px solid ${over ? "#6e2929" : "#30363d"}`,
              borderRadius:    8,
              padding:         "14px 18px",
              minWidth:        160,
              flex:            1,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 16 }}>{r.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#cdd9e5" }}>{r.label}</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: over ? "#f85149" : "#3fb950", fontFamily: "'JetBrains Mono', monospace" }}>
                {r.actual} <span style={{ fontSize: 12, fontWeight: 400, color: "#8b949e" }}>{r.unit}</span>
              </div>
              <div style={{ fontSize: 11, color: "#8b949e", marginTop: 4 }}>
                Baseline: {r.base} {r.unit} · {pct}%
              </div>
              {over && <div style={{ fontSize: 11, color: "#f85149", marginTop: 6 }}>⚠ Above baseline</div>}
            </div>
          );
        })}
      </div>

      {/* 24-hour area chart */}
      <div style={{
        backgroundColor: "#161b22",
        border:          "1px solid #30363d",
        borderRadius:    8,
        padding:         "20px 16px",
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "#e6edf3", marginBottom: 16 }}>
          Electricity — 24h Actual vs Baseline (kWh)
        </h3>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#58a6ff" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#58a6ff" stopOpacity={0}   />
              </linearGradient>
              <linearGradient id="gradBase" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#8b949e" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#8b949e" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 10, fill: "#8b949e" }}
              interval={3}
              tickLine={false}
              axisLine={{ stroke: "#30363d" }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#8b949e" }}
              tickLine={false}
              axisLine={{ stroke: "#30363d" }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12, color: "#8b949e", paddingTop: 8 }}
            />
            <Area
              type="monotone"
              dataKey="baseline"
              name="Baseline"
              stroke="#8b949e"
              strokeDasharray="5 3"
              fill="url(#gradBase)"
              strokeWidth={1.5}
            />
            <Area
              type="monotone"
              dataKey="actual"
              name="Actual"
              stroke="#58a6ff"
              fill="url(#gradActual)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Configure thresholds — energy_manager only */}
      {userRole === "energy_manager" && (
        <div style={{
          backgroundColor: "#161b22",
          border:          "1px solid #30363d",
          borderRadius:    8,
          padding:         20,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#e6edf3", marginBottom: 4 }}>
            Configure Alert Thresholds
          </h3>
          <p style={{ fontSize: 12, color: "#8b949e", marginBottom: 16 }}>
            Set the threshold value at which an alert is raised for a specific asset and metric.
          </p>
          <form onSubmit={saveThreshold} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            {[
              { name: "assetId", label: "Asset ID",  placeholder: "AST-001" },
              { name: "metric",  label: "Metric",    placeholder: "temperature" },
              { name: "value",   label: "Threshold", placeholder: "75",  type: "number" },
            ].map(f => (
              <div key={f.name}>
                <label style={{ fontSize: 11, color: "#8b949e", display: "block", marginBottom: 4 }}>{f.label}</label>
                <input
                  name={f.name}
                  type={f.type || "text"}
                  placeholder={f.placeholder}
                  required
                  style={{
                    padding:         "8px 12px",
                    fontSize:        13,
                    backgroundColor: "#0d1117",
                    border:          "1px solid #30363d",
                    borderRadius:    5,
                    color:           "#e6edf3",
                    fontFamily:      "inherit",
                    width:           130,
                  }}
                />
              </div>
            ))}
            <button type="submit" style={{
              padding:         "8px 16px",
              fontSize:        13,
              fontWeight:      600,
              backgroundColor: "#1f6feb",
              border:          "none",
              borderRadius:    5,
              color:           "#fff",
              cursor:          "pointer",
              fontFamily:      "inherit",
            }}>
              Save
            </button>
          </form>
          {thresholdMsg && (
            <p style={{ marginTop: 10, fontSize: 12, color: thresholdMsg.startsWith("✓") ? "#3fb950" : "#f85149" }}>
              {thresholdMsg}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {[80, 120, 280].map((h, i) => (
        <div key={i} style={{
          backgroundColor: "#161b22", border: "1px solid #30363d",
          borderRadius: 8, height: h,
          animation: "pulse 1.5s ease-in-out infinite",
          animationDelay: `${i * 0.15}s`,
        }} />
      ))}
      <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }`}</style>
    </div>
  );
}
