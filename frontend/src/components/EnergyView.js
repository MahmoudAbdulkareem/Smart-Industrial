import React, { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useApi } from "../hooks/useApi";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:8, padding:"10px 14px", fontSize:12, boxShadow:"0 4px 12px rgba(0,0,0,0.08)" }}>
      <p style={{ color:"#6b7a99", marginBottom:4, fontWeight:500 }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color:p.color, margin:"2px 0" }}>{p.name}: <strong>{p.value} kWh</strong></p>
      ))}
    </div>
  );
}

export default function EnergyView({ userRole }) {
  const { data, loading, error } = useApi("/energy", 10000);
  const [thresholdMsg, setThresholdMsg] = useState("");

  if (loading) return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {[70, 110, 300].map((h, i) => <div key={i} style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, height:h, animation:"pulse 1.4s ease-in-out " + (i*0.12) + "s infinite" }} />)}
    </div>
  );
  if (error) return <p style={{ color:"#dc2626", fontSize:13 }}>Error: {error}</p>;
  if (!data)  return null;

  const { current, baseline, water, gas, kpis, history } = data;

  async function saveThreshold(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const res = await fetch("/api/thresholds", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("token") },
        body: JSON.stringify({ assetId: fd.get("assetId"), metric: fd.get("metric"), value: parseFloat(fd.get("value")) }),
      });
      setThresholdMsg(res.ok ? "Threshold saved successfully." : "Failed to save.");
    } catch { setThresholdMsg("Cannot connect to server."); }
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
        {[{ label:"PUE", value:kpis.pue.toFixed(2), note:"Target ≤ 1.5", ok:kpis.pue <= 1.5 },
          { label:"EER", value:kpis.eer.toFixed(2), note:"Higher is better", ok:true },
          { label:"CO₂", value:kpis.co2.toFixed(1) + " kg/h", note:"Emissions", ok:kpis.co2 <= 60 }].map(k => (
          <div key={k.label} style={{ background:"#fff", border:"1px solid #e2e8f0", borderTop:"3px solid #1d6fcc", borderRadius:10, padding:"16px 22px", minWidth:120, textAlign:"center", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize:10, fontWeight:600, color:"#6b7a99", textTransform:"uppercase", letterSpacing:0.7, marginBottom:6 }}>{k.label}</div>
            <div style={{ fontSize:24, fontWeight:700, color: k.ok ? "#1a2332" : "#dc2626" }}>{k.value}</div>
            <div style={{ fontSize:11, color: k.ok ? "#6b7a99" : "#dc2626", marginTop:4 }}>{k.note}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
        {[{ label:"Electricity", actual:current,       base:baseline,       unit:"kWh",   icon:"⚡" },
          { label:"Water",       actual:water.current, base:water.baseline, unit:"L/min", icon:"💧" },
          { label:"Gas",         actual:gas.current,   base:gas.baseline,   unit:"m³/h",  icon:"🔥" }].map(r => {
          const over = r.actual > r.base * 1.05;
          return (
            <div key={r.label} style={{ background:"#fff", border:"1px solid " + (over ? "#fecaca" : "#bbf7d0"), borderRadius:10, padding:"14px 18px", flex:1, minWidth:140, boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
                <span>{r.icon}</span>
                <span style={{ fontSize:13, fontWeight:600, color:"#374151" }}>{r.label}</span>
              </div>
              <div style={{ fontSize:20, fontWeight:700, color: over ? "#dc2626" : "#15803d" }}>
                {r.actual} <span style={{ fontSize:12, fontWeight:400, color:"#9aa5b4" }}>{r.unit}</span>
              </div>
              <div style={{ fontSize:11, color:"#9aa5b4", marginTop:4 }}>Baseline: {r.base} {r.unit}</div>
              {over && <div style={{ fontSize:11, color:"#dc2626", marginTop:4 }}>⚠ Above baseline</div>}
            </div>
          );
        })}
      </div>

      <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, padding:"20px 18px", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
        <h3 style={{ fontSize:14, fontWeight:600, color:"#1a2332", marginBottom:18 }}>Electricity — 24h Actual vs Baseline</h3>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={history} margin={{ top:5, right:10, left:-20, bottom:0 }}>
            <defs>
              <linearGradient id="gActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#1d6fcc" stopOpacity={0.18}/>
                <stop offset="95%" stopColor="#1d6fcc" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="gBase" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#9aa5b4" stopOpacity={0.12}/>
                <stop offset="95%" stopColor="#9aa5b4" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="hour" tick={{ fontSize:10, fill:"#9aa5b4" }} interval={3} tickLine={false} axisLine={{ stroke:"#e2e8f0" }} />
            <YAxis tick={{ fontSize:10, fill:"#9aa5b4" }} tickLine={false} axisLine={{ stroke:"#e2e8f0" }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize:12, color:"#6b7a99", paddingTop:10 }} />
            <Area type="monotone" dataKey="baseline" name="Baseline" stroke="#9aa5b4" strokeDasharray="5 3" fill="url(#gBase)" strokeWidth={1.5} />
            <Area type="monotone" dataKey="actual"   name="Actual"   stroke="#1d6fcc" fill="url(#gActual)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {userRole === "energy_manager" && (
        <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, padding:20, boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
          <h3 style={{ fontSize:14, fontWeight:600, color:"#1a2332", marginBottom:6 }}>Configure Alert Thresholds</h3>
          <p style={{ fontSize:12, color:"#6b7a99", marginBottom:16 }}>Set the value at which an alert is triggered for an asset metric.</p>
          <form onSubmit={saveThreshold} style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"flex-end" }}>
            {[{ name:"assetId", label:"Asset ID", placeholder:"AST-001" },
              { name:"metric",  label:"Metric",   placeholder:"temperature" },
              { name:"value",   label:"Threshold", placeholder:"75", type:"number" }].map(f => (
              <div key={f.name}>
                <label style={{ fontSize:11, color:"#6b7a99", display:"block", marginBottom:4 }}>{f.label}</label>
                <input name={f.name} type={f.type || "text"} placeholder={f.placeholder} required
                  style={{ padding:"8px 12px", fontSize:13, border:"1px solid #d1d9e6", borderRadius:7, color:"#1a2332", fontFamily:"inherit", width:130 }} />
              </div>
            ))}
            <button type="submit" style={{ padding:"8px 18px", fontSize:13, fontWeight:600, background:"#1d6fcc", border:"none", borderRadius:7, color:"#fff", cursor:"pointer", fontFamily:"inherit" }}>Save</button>
          </form>
          {thresholdMsg && <p style={{ marginTop:10, fontSize:12, color: thresholdMsg.startsWith("Threshold") ? "#15803d" : "#dc2626" }}>{thresholdMsg}</p>}
        </div>
      )}
    </div>
  );
}
