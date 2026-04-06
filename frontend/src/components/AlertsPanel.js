import React, { useState } from "react";
import { useApi } from "../hooks/useApi";

const SEV = {
  critical: { bg:"#fef2f2", border:"#fecaca", text:"#b91c1c", left:"#ef4444", label:"Critical" },
  caution:  { bg:"#fffbeb", border:"#fde68a", text:"#b45309", left:"#f59e0b", label:"Caution"  },
  info:     { bg:"#eff6ff", border:"#bfdbfe", text:"#1e40af", left:"#3b82f6", label:"Info"     },
};

const ASSET_TABS = [
  { id: "all",         label: "All Alerts" },
  { id: "AST-003",     label: "Conveyor Belt C" },
  { id: "AST-004",     label: "HVAC Unit D" },
  { id: "AST-001",     label: "Compressor A" },
  { id: "AST-005",     label: "Motor Drive E" },
  { id: "AST-002",     label: "Pump Station B" },
];

const PAGE_SIZE = 5;

export default function AlertsPanel({ userRole }) {
  const { data, loading, error } = useApi("/alerts", 10000);
  const [localAcked, setLocalAcked] = useState([]);
  const [assetTab,   setAssetTab]   = useState("all");
  const [activePage, setActivePage] = useState(1);
  const [donePage,   setDonePage]   = useState(1);

  if (loading) return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {[...Array(3)].map((_,i) => <div key={i} style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:9, height:76, animation:"pulse 1.4s ease-in-out " + (i*0.1) + "s infinite" }} />)}
    </div>
  );
  if (error) return <p style={{ color:"#dc2626", fontSize:13 }}>Error: {error}</p>;
  if (!data)  return null;

  const canAck = userRole === "maintenance_engineer";

  async function handleAck(id) {
    setLocalAcked(prev => [...prev, id]);
    try {
      await fetch("/api/alerts/" + id + "/acknowledge", {
        method: "PATCH",
        headers: { Authorization: "Bearer " + localStorage.getItem("token") },
      });
    } catch {}
  }

  const filtered = assetTab === "all" ? data : data.filter(a => a.assetId === assetTab);
  const active   = filtered.filter(a => !a.acknowledged && !localAcked.includes(a.id));
  const done     = filtered.filter(a =>  a.acknowledged ||  localAcked.includes(a.id));

  const totalActivePages = Math.max(1, Math.ceil(active.length / PAGE_SIZE));
  const totalDonePages   = Math.max(1, Math.ceil(done.length   / PAGE_SIZE));
  const safePage = p => Math.min(Math.max(1, p), totalActivePages);

  const pagedActive = active.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE);
  const pagedDone   = done.slice((donePage   - 1) * PAGE_SIZE, donePage   * PAGE_SIZE);

  function Pagination({ page, total, onChange }) {
    if (total <= 1) return null;
    return (
      <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:12, justifyContent:"flex-end" }}>
        <button onClick={() => onChange(page - 1)} disabled={page === 1}
          style={{ padding:"4px 10px", fontSize:12, border:"1px solid #d1d9e6", borderRadius:6, background:"#fff", cursor:page===1?"not-allowed":"pointer", color:page===1?"#c9d3df":"#374151" }}>‹</button>
        {[...Array(total)].map((_, i) => (
          <button key={i} onClick={() => onChange(i + 1)}
            style={{ padding:"4px 10px", fontSize:12, border:"1px solid " + (page===i+1?"#1d6fcc":"#d1d9e6"), borderRadius:6, background:page===i+1?"#1d6fcc":"#fff", color:page===i+1?"#fff":"#374151", cursor:"pointer", fontWeight:page===i+1?600:400 }}>
            {i + 1}
          </button>
        ))}
        <button onClick={() => onChange(page + 1)} disabled={page === total}
          style={{ padding:"4px 10px", fontSize:12, border:"1px solid #d1d9e6", borderRadius:6, background:"#fff", cursor:page===total?"not-allowed":"pointer", color:page===total?"#c9d3df":"#374151" }}>›</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display:"flex", gap:4, marginBottom:20, background:"#f0f4f8", borderRadius:10, padding:4 }}>
        {ASSET_TABS.map(t => {
          const count = t.id === "all" ? data.filter(a => !a.acknowledged && !localAcked.includes(a.id)).length
                                       : data.filter(a => a.assetId === t.id && !a.acknowledged && !localAcked.includes(a.id)).length;
          return (
            <button key={t.id} onClick={() => { setAssetTab(t.id); setActivePage(1); setDonePage(1); }}
              style={{ flex:1, padding:"8px 12px", fontSize:12, fontWeight:assetTab===t.id?600:400, border:"none", borderRadius:7, cursor:"pointer", transition:"all 0.15s", fontFamily:"inherit",
                background:assetTab===t.id?"#fff":"transparent", color:assetTab===t.id?"#1d6fcc":"#6b7a99",
                boxShadow:assetTab===t.id?"0 1px 4px rgba(0,0,0,0.08)":"none" }}>
              {t.label}
              {count > 0 && <span style={{ marginLeft:6, background:"#ef4444", color:"#fff", fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:10 }}>{count}</span>}
            </button>
          );
        })}
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
        <span style={{ fontSize:11, fontWeight:600, color:"#6b7a99", textTransform:"uppercase", letterSpacing:0.7 }}>Active</span>
        <span style={{ background: active.length > 0 ? "#fef2f2" : "#f0fdf4", color: active.length > 0 ? "#b91c1c" : "#15803d", border:"1px solid " + (active.length > 0 ? "#fecaca" : "#bbf7d0"), fontSize:11, fontWeight:700, padding:"1px 8px", borderRadius:10 }}>
          {active.length}
        </span>
      </div>

      {active.length === 0 ? (
        <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:9, padding:"16px 20px", fontSize:13, color:"#15803d", marginBottom:24 }}>
          ✓ No active alerts{assetTab !== "all" ? " for this asset" : ""}
        </div>
      ) : (
        <div style={{ marginBottom:6 }}>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {pagedActive.map(alert => {
              const s = SEV[alert.severity] || SEV.info;
              return (
                <div key={alert.id} style={{ background:s.bg, border:"1px solid " + s.border, borderLeft:"4px solid " + s.left, borderRadius:9, padding:"14px 16px", display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6, flexWrap:"wrap" }}>
                      <span style={{ background:s.text, color:"#fff", fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:10, textTransform:"uppercase", letterSpacing:0.5 }}>{s.label}</span>
                      <strong style={{ fontSize:13, color:"#1a2332" }}>{alert.asset}</strong>
                      <span style={{ fontSize:11, color:"#9aa5b4", marginLeft:"auto" }}>{alert.time}</span>
                    </div>
                    <p style={{ margin:0, fontSize:13, color:"#4b5563", lineHeight:1.5 }}>{alert.message}</p>
                    <p style={{ margin:"5px 0 0", fontSize:10, color:"#9aa5b4" }}>ID #{alert.id} · {alert.assetId}</p>
                  </div>
                  {canAck && (
                    <button onClick={() => handleAck(alert.id)} style={{ padding:"5px 12px", fontSize:11, fontWeight:500, background:"#fff", border:"1px solid " + s.left, color:s.text, borderRadius:6, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0, fontFamily:"inherit" }}>
                      Acknowledge
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <Pagination page={activePage} total={totalActivePages} onChange={p => setActivePage(safePage(p))} />
        </div>
      )}

      {done.length > 0 && (
        <div style={{ marginTop:24 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <span style={{ fontSize:11, fontWeight:600, color:"#9aa5b4", textTransform:"uppercase", letterSpacing:0.7 }}>Acknowledged</span>
            <span style={{ background:"#f1f5f9", color:"#6b7a99", border:"1px solid #e2e8f0", fontSize:11, fontWeight:700, padding:"1px 8px", borderRadius:10 }}>{done.length}</span>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {pagedDone.map(alert => (
              <div key={alert.id} style={{ background:"#f8faff", border:"1px solid #e2e8f0", borderRadius:9, padding:"10px 16px", display:"flex", alignItems:"center", gap:12, opacity:0.65 }}>
                <span style={{ color:"#22c55e", fontWeight:700 }}>✓</span>
                <div style={{ flex:1 }}>
                  <strong style={{ fontSize:12, color:"#374151" }}>{alert.asset}</strong>
                  <span style={{ fontSize:12, color:"#6b7a99", marginLeft:8 }}>— {alert.message}</span>
                </div>
                <span style={{ fontSize:10, color:"#9aa5b4" }}>{alert.time}</span>
              </div>
            ))}
          </div>
          <Pagination page={donePage} total={totalDonePages} onChange={p => setDonePage(Math.min(Math.max(1,p), totalDonePages))} />
        </div>
      )}
    </div>
  );
}
