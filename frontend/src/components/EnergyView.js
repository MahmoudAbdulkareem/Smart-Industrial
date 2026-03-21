import React from "react";
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useApi } from "../hooks/useApi";

export default function EnergyView() {
  const { data, loading, error } = useApi("/energy", 5000);

  if (loading) return <p>Loading…</p>;
  if (error)   return <p style={{ color: "red" }}>Error: {error}</p>;

  const { current, baseline, water, gas, kpis, history } = data;
  const overBaseline = current > baseline * 1.05;

  return (
    <div>
      {/* KPI tiles */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        {[
          { label: "PUE",        value: kpis.pue,  unit: ""     },
          { label: "EER",        value: kpis.eer,  unit: ""     },
          { label: "CO₂",        value: kpis.co2,  unit: "kg/h" },
        ].map(k => (
          <div key={k.label} style={{
            border: "1px solid #ccc", borderRadius: 6, padding: "12px 20px",
            backgroundColor: "#fff", minWidth: 120, textAlign: "center",
          }}>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{k.value}</div>
            {k.unit && <div style={{ fontSize: 11, color: "#999" }}>{k.unit}</div>}
          </div>
        ))}
      </div>

      {/* Current vs baseline badges */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        {[
          { label: "Electricity", actual: current,       base: baseline,       unit: "kWh"   },
          { label: "Water",       actual: water.current, base: water.baseline, unit: "L/min" },
          { label: "Gas",         actual: gas.current,   base: gas.baseline,   unit: "m³/h"  },
        ].map(r => {
          const over  = r.actual > r.base * 1.05;
          const color = over ? "#f8d7da" : "#d4edda";
          const text  = over ? "#721c24" : "#155724";
          return (
            <div key={r.label} style={{
              border: "1px solid #ccc", borderRadius: 6, padding: "10px 16px",
              backgroundColor: color, color: text,
            }}>
              <strong>{r.label}</strong>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                {r.actual} / {r.base} {r.unit}
              </div>
              {over && <div style={{ fontSize: 12 }}>⚠ Above baseline</div>}
            </div>
          );
        })}
      </div>

      {/* 24h electricity chart */}
      <div style={{
        border: "1px solid #ccc", borderRadius: 6,
        padding: 16, backgroundColor: "#fff",
      }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15 }}>
          Electricity — 24h Actual vs Baseline
        </h3>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={history} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval={3} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Area
              type="monotone" dataKey="baseline" name="Baseline"
              stroke="#6c757d" strokeDasharray="5 3"
              fill="#e9ecef" strokeWidth={1.5}
            />
            <Area
              type="monotone" dataKey="actual" name="Actual"
              stroke="#007bff" fill="#cce5ff" strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
