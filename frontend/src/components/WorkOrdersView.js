import React, { useState } from "react";
import { useApi } from "../hooks/useApi";
import { useSocket } from "../hooks/useSocket";

const STATUS = {
    WAPPR: { label:"Waiting Approval", color:"#b45309", bg:"#fffbeb", border:"#fde68a" },
    APPR:  { label:"Approved",         color:"#1d4ed8", bg:"#eff6ff", border:"#bfdbfe" },
    INPRG: { label:"In Progress",      color:"#0369a1", bg:"#f0f9ff", border:"#bae6fd" },
    WMATL: { label:"Waiting Material", color:"#7c3aed", bg:"#faf5ff", border:"#ddd6fe" },
    COMP:  { label:"Complete",         color:"#15803d", bg:"#f0fdf4", border:"#bbf7d0" },
    CAN:   { label:"Cancelled",        color:"#6b7280", bg:"#f9fafb", border:"#e5e7eb" },
};

const STATUS_TRANSITIONS = {
    WAPPR: ["APPR", "CAN"],
    APPR:  ["INPRG", "WMATL", "CAN"],
    INPRG: ["WMATL", "COMP", "CAN"],
    WMATL: ["INPRG", "COMP", "CAN"],
    COMP:  [],
    CAN:   [],
};

function fmt(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }) +
        " " + new Date(iso).toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit" });
}

function exportCSV(data, filename) {
    if (!data || !data.length) return;
    const keys = ["wonum","asset_name","status","priority","description","created_by","created_at"];
    const csv = [keys.join(","), ...data.map(r => keys.map(k => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = filename + ".csv"; a.click();
}

export default function WorkOrdersView({ userRole }) {
    const { data: rawData, loading, error, refresh, setData } = useApi("/workorders", 60000);
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [search, setSearch]             = useState("");
    const [expanded, setExpanded]         = useState(null);
    const [updating, setUpdating]         = useState(null);

    const canUpdate = userRole === "maintenance_engineer" || userRole === "it_admin";

    useSocket({
        "workorder:created": (wo) => {
            if (!wo) return;
            setData(prev => Array.isArray(prev) ? [wo, ...prev] : [wo]);
        },
        "workorder:updated": ({ id, status }) => {
            setData(prev => Array.isArray(prev)
                ? prev.map(w => w.id === id ? { ...w, status } : w)
                : prev
            );
        },
    });

    async function updateStatus(e, woId, newStatus) {
        e.stopPropagation();
        setUpdating(woId + newStatus);
        try {
            const res = await fetch(`/api/workorders/${woId}/status`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer " + localStorage.getItem("token"),
                },
                body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) throw new Error(await res.text());
            const updated = await res.json();
            setData(prev => Array.isArray(prev)
                ? prev.map(w => w.id === woId ? { ...w, status: updated.status } : w)
                : prev
            );
        } catch (err) {
            alert("Failed to update status: " + err.message);
        } finally {
            setUpdating(null);
        }
    }

    const wos    = Array.isArray(rawData) ? rawData : [];
    const counts = wos.reduce((a, w) => { a[w.status] = (a[w.status]||0)+1; return a; }, {});

    const shown = wos.filter(w => {
        const ms = statusFilter === "ALL" || w.status === statusFilter;
        const mq = !search || [w.wonum, w.asset_name, w.description, w.created_by]
            .some(v => (v||"").toLowerCase().includes(search.toLowerCase()));
        return ms && mq;
    });

    if (loading) return (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {[...Array(4)].map((_,i) => (
                <div key={i} style={{ background:"#f8faff", border:"1px solid #e2e8f0",
                    borderRadius:8, height:64, animation:`pulse 1.4s ease-in-out ${i*0.1}s infinite` }} />
            ))}
        </div>
    );

    if (error) return <p style={{ color:"#dc2626", fontSize:13 }}>Error: {error}</p>;

    return (
        <div>
            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

            {/* Status filter pills */}
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
                <button onClick={() => setStatusFilter("ALL")} style={{
                    fontSize:11, fontWeight:600, padding:"3px 12px", borderRadius:20, cursor:"pointer",
                    fontFamily:"inherit", border:"1px solid #d1d9e6",
                    background: statusFilter==="ALL" ? "#1a2332" : "#fff",
                    color: statusFilter==="ALL" ? "#fff" : "#6b7a99",
                }}>All ({wos.length})</button>
                {Object.entries(STATUS).map(([k,s]) => counts[k] ? (
                    <button key={k} onClick={() => setStatusFilter(statusFilter===k ? "ALL" : k)} style={{
                        fontSize:11, fontWeight:600, padding:"3px 12px", borderRadius:20, cursor:"pointer",
                        fontFamily:"inherit", border:`1px solid ${s.border}`, background:s.bg, color:s.color,
                        outline: statusFilter===k ? `2px solid ${s.color}` : "none", outlineOffset:2,
                    }}>{counts[k]} {s.label}</button>
                ) : null)}
            </div>

            <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
                <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search WO#, asset, description..."
                    style={{ padding:"6px 12px", fontSize:13, border:"1px solid #d1d9e6",
                        borderRadius:8, fontFamily:"inherit", width:260, outline:"none" }} />
                <button onClick={refresh} style={{ padding:"6px 12px", fontSize:12,
                    border:"1px solid #d1d9e6", background:"#fff", borderRadius:8,
                    cursor:"pointer", fontFamily:"inherit" }}>⟳ Refresh</button>
                <button onClick={() => exportCSV(shown, "work_orders")} style={{ padding:"6px 12px",
                    fontSize:12, border:"1px solid #16603440", background:"#f0fdf4",
                    color:"#166034", borderRadius:8, cursor:"pointer", fontFamily:"inherit",
                    fontWeight:600 }}>↓ Report (CSV)</button>
                <span style={{ fontSize:12, color:"#9aa5b4", marginLeft:"auto" }}>
                    {shown.length} work order{shown.length !== 1 ? "s" : ""}
                </span>
            </div>

            {shown.length === 0 ? (
                <div style={{ background:"#f8faff", border:"1px dashed #d1d9e6", borderRadius:8,
                    padding:"28px 20px", textAlign:"center", color:"#9aa5b4", fontSize:13 }}>
                    {wos.length === 0
                        ? "No work orders yet. They are created automatically on anomaly detection, or manually from the Health view."
                        : "No work orders match the current filter."}
                </div>
            ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                    {shown.map(wo => {
                        const s    = STATUS[wo.status] || STATUS.WAPPR;
                        const open = expanded === wo.id;
                        const isAuto = (wo.created_by||"").startsWith("System") || (wo.created_by||"").startsWith("Rule") || (wo.created_by||"").startsWith("AUTO");
                        const transitions = STATUS_TRANSITIONS[wo.status] || [];

                        return (
                            <div key={wo.id} style={{ background:"#fff",
                                border:`1px solid ${open ? s.border : "#e2e8f0"}`,
                                borderLeft:`4px solid ${s.color}`, borderRadius:8, overflow:"hidden" }}>

                                {/* Header row */}
                                <div onClick={() => setExpanded(open ? null : wo.id)}
                                    style={{ padding:"11px 15px", cursor:"pointer", display:"flex",
                                        alignItems:"center", gap:8, flexWrap:"wrap" }}>
                                    <span style={{ fontSize:12, fontWeight:700, color:"#1a2332",
                                        fontFamily:"monospace" }}>{wo.wonum}</span>
                                    {isAuto && (
                                        <span style={{ fontSize:10, fontWeight:600, padding:"1px 7px",
                                            borderRadius:20, background:"#f0f9ff", color:"#0369a1",
                                            border:"1px solid #bae6fd" }}>AUTO</span>
                                    )}
                                    <span style={{ fontSize:11, fontWeight:600, padding:"2px 9px",
                                        borderRadius:20, background:s.bg, color:s.color,
                                        border:`1px solid ${s.border}` }}>{s.label}</span>
                                    <span style={{ fontSize:11, padding:"2px 8px", borderRadius:6,
                                        background:"#f0f4f8", color:"#374151", border:"1px solid #e2e8f0" }}>
                                        {wo.asset_name || wo.asset_id}
                                    </span>
                                    <span style={{ fontSize:12, color:"#9aa5b4", marginLeft:"auto" }}>
                                        {fmt(wo.created_at)}
                                    </span>
                                    <span style={{ fontSize:13, color:"#9aa5b4" }}>{open ? "▲" : "▼"}</span>
                                </div>

                                {open && (
                                    <div style={{ padding:"0 15px 14px 15px",
                                        borderTop:"1px solid #f0f4f8" }}>
                                        <div style={{ marginTop:10, padding:"10px 12px",
                                            background:"#f8faff", borderRadius:7,
                                            fontSize:12, color:"#374151", lineHeight:1.6,
                                            border:"1px solid #e2e8f0" }}>
                                            {wo.description}
                                        </div>

                                        <div style={{ display:"flex", gap:24, marginTop:10, fontSize:11, color:"#6b7a99", flexWrap:"wrap" }}>
                                            <span style={{ minWidth:140 }}>Priority: <strong>{wo.priority || "High"}</strong></span>
                                            <span style={{ minWidth:160 }}>By: <strong>{isAuto ? "System"  : (wo.created_by || "—")}</strong></span>
                                            <span style={{ minWidth:160 }}>Asset ID: <strong>{wo.asset_id ? wo.asset_id : (wo.asset_id || "—")}</strong></span>
                                            <span style={{ minWidth:160 }}> Work Order ID: #<strong>{wo.id ? wo.id : (wo.id || "—")}</strong></span>
                                        </div>

                                        

                                        {canUpdate && transitions.length > 0 && (
                                            <div style={{ marginTop:12, display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
                                                <span style={{ fontSize:11, color:"#9aa5b4", fontWeight:500 }}>
                                                    Move to:
                                                </span>
                                                {transitions.map(nextStatus => {
                                                    const ns   = STATUS[nextStatus];
                                                    const busy = updating === (wo.id + nextStatus);
                                                    return (
                                                        <button key={nextStatus}
                                                            disabled={!!updating}
                                                            onClick={e => updateStatus(e, wo.id, nextStatus)}
                                                            style={{ fontSize:11, fontWeight:600,
                                                                padding:"4px 12px", borderRadius:20,
                                                                cursor: updating ? "not-allowed" : "pointer",
                                                                border:`1px solid ${ns.border}`,
                                                                background: busy ? ns.border : ns.bg,
                                                                color: ns.color, fontFamily:"inherit",
                                                                opacity: updating && !busy ? 0.5 : 1 }}>
                                                            {busy ? "..." : ns.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {(wo.status === "COMP" || wo.status === "CAN") && (
                                            <div style={{ marginTop:10, fontSize:11, color:"#9aa5b4" }}>
                                                {wo.status === "COMP" ? "✅ Work order completed." : "🚫 Work order cancelled."}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
