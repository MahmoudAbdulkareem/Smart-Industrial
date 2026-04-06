import React, { useState } from "react";
import { useApi } from "../hooks/useApi";

const STATUS_STYLES = {
  healthy:  { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d", bar: "#22c55e" },
  caution:  { bg: "#fffbeb", border: "#fde68a", text: "#b45309", bar: "#f59e0b" },
  critical: { bg: "#fef2f2", border: "#fecaca", text: "#b91c1c", bar: "#ef4444" },
};

const btnPrimary = { padding: "8px 18px", fontSize: 13, fontWeight: 600, borderRadius: 7, border: "none", cursor: "pointer", background: "#1d6fcc", color: "#fff", fontFamily: "inherit" };
const btnSecondary = { ...btnPrimary, background: "#fff", border: "1px solid #d1d9e6", color: "#374151" };

function WorkOrderModal({ asset, onClose }) {
  const [desc, setDesc] = useState("Maintenance required — Health Score: " + asset.healthScore + "/100");
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);

  async function submit() {
    setStatus("loading");
    try {
      const res = await fetch("/api/workorders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: JSON.stringify({ assetId: asset.id, description: desc }),
      });
      const json = await res.json();
      if (!res.ok) { setStatus("error"); return; }
      setResult(json);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: "100%", maxWidth: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", border: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1a2332" }}>Create Work Order</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: "#9aa5b4", cursor: "pointer" }}>×</button>
        </div>

        <div style={{ background: "#f8faff", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          <span style={{ color: "#6b7a99" }}>Asset: </span>
          <strong style={{ color: "#1a2332" }}>{asset.name}</strong>
          <span style={{ color: "#9aa5b4", marginLeft: 8 }}>{asset.id} · {asset.location}</span>
        </div>

        {status === "success" ? (
          <div>
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "12px 14px", fontSize: 13, color: "#15803d", marginBottom: 16 }}>
              Work Order <strong>{result.wonum}</strong> created · Status: {result.status}
            </div>
            <button onClick={onClose} style={btnPrimary}>Close</button>
          </div>
        ) : (
          <>
            <label style={{ fontSize: 12, fontWeight: 500, color: "#6b7a99", display: "block", marginBottom: 6 }}>Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3}
              style={{ width: "100%", padding: "10px 12px", fontSize: 13, border: "1px solid #d1d9e6", borderRadius: 8, fontFamily: "inherit", resize: "vertical", marginBottom: 14, color: "#1a2332" }} />
            {status === "error" && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>Failed. Check backend is running.</p>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={onClose} style={btnSecondary}>Cancel</button>
              <button onClick={submit} style={btnPrimary} disabled={status === "loading"}>
                {status === "loading" ? "Submitting…" : "Submit to Maximo"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AssetCard({ asset, canCreateWO }) {
  const [showModal, setShowModal] = useState(false);
  const s = STATUS_STYLES[asset.status] || STATUS_STYLES.healthy;

  return (
    <div style={{ background: "#fff", border: "1px solid " + s.border, borderRadius: 10, padding: 20, display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: "#1a2332" }}>{asset.name}</div>
          <div style={{ fontSize: 11, color: "#9aa5b4", marginTop: 3 }}>{asset.id} · {asset.location}</div>
        </div>
        <span style={{ background: s.bg, color: s.text, border: "1px solid " + s.border, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, textTransform: "capitalize" }}>
          {asset.status}
        </span>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: "#6b7a99" }}>Health Score</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: s.text }}>{asset.healthScore} / 100</span>
        </div>
        <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: asset.healthScore + "%", background: s.bar, borderRadius: 4, transition: "width 0.6s ease" }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 20 }}>
        {[{ label: "RUL", value: asset.rul + " days" }, { label: "MTBF", value: asset.mtbf + " hrs" }].map(k => (
          <div key={k.label}>
            <div style={{ fontSize: 10, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{k.label}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#f8faff", borderRadius: 8, padding: "8px 12px", display: "flex", gap: 16, flexWrap: "wrap" }}>
        {[{ label: "Vibration", value: (asset.sensors?.vibration ?? "—") + " mm/s" },
          { label: "Temp", value: (asset.sensors?.temperature ?? "—") + " °C" },
          { label: "Pressure", value: (asset.sensors?.pressure ?? "—") + " bar" }].map(r => (
          <div key={r.label}>
            <div style={{ fontSize: 9, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: 0.5 }}>{r.label}</div>
            <div style={{ fontSize: 12, color: "#374151", fontWeight: 500, marginTop: 2 }}>{r.value}</div>
          </div>
        ))}
      </div>

      {canCreateWO && asset.status !== "healthy" && (
        <button onClick={() => setShowModal(true)} style={{ padding: "7px 14px", fontSize: 12, fontWeight: 500, background: "#fff", border: "1px solid #ef4444", color: "#dc2626", borderRadius: 7, cursor: "pointer", alignSelf: "flex-start", fontFamily: "inherit" }}>
          + Create Work Order
        </button>
      )}

      {showModal && <WorkOrderModal asset={asset} onClose={() => setShowModal(false)} />}
    </div>
  );
}

export default function HealthView({ userRole }) {
const { data, loading, error, refresh } = useApi("/assets/health", 6000);

// Optional manual refresh button
<button onClick={refresh}>⟳ Refresh Now</button>
  if (loading) return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 16 }}>
      {[...Array(5)].map((_, i) => <div key={i} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, height: 220, animation: "pulse 1.4s ease-in-out " + (i * 0.1) + "s infinite" }} />)}
    </div>
  );

  if (error) return <p style={{ color: "#dc2626", fontSize: 13 }}>Error: {error}</p>;
  if (!Array.isArray(data)) return null;

  const sorted = [...data].sort((a, b) => a.healthScore - b.healthScore);
  const canCreate = userRole === "maintenance_engineer";
  const counts = {
    critical: data.filter(a => a.status === "critical").length,
    caution: data.filter(a => a.status === "caution").length,
    healthy: data.filter(a => a.status === "healthy").length,
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[{ label: "Critical", count: counts.critical, bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" },
            { label: "Caution", count: counts.caution, bg: "#fffbeb", color: "#b45309", border: "#fde68a" },
            { label: "Healthy", count: counts.healthy, bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" }].map(s => (
            <div key={s.label} style={{ background: s.bg, border: "1px solid " + s.border, borderRadius: 8, padding: "10px 18px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.count}</span>
              <span style={{ fontSize: 13, color: s.color, fontWeight: 500 }}>{s.label}</span>
            </div>
          ))}
        </div>
        <button onClick={refresh} style={{ fontSize: 13, padding: "6px 14px", background: "#f8faff", border: "1px solid #d1d9e6", borderRadius: 7, cursor: "pointer" }}>
          ⟳ Refresh
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 16 }}>
        {sorted.map(asset => <AssetCard key={asset.id} asset={asset} canCreateWO={canCreate} />)}
      </div>
    </div>
  );
}