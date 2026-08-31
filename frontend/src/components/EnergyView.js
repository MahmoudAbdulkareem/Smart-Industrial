import React, { useState, useRef, useEffect } from "react";
import {
    Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend, ComposedChart
} from "recharts";
import { useApi } from "../hooks/useApi";
import { useSocket } from "../hooks/useSocket";
import { useLanguage } from "../context/LanguageContext";
import {
    Activity,
    AlertCircle,
    AlertTriangle,
    ArrowDown,
    ArrowUp,
    BarChart3,
    Bell,
    Calendar,
    Check,
    CheckCircle,
    ChevronDown,
    ChevronUp,
    Clock,
    Cloud,
    CloudOff,
    Coffee,
    Database,
    DollarSign,
    Download,
    Droplet,
    Edit,
    Eye,
    EyeOff,
    FileSpreadsheet,
    FileText,
    Filter,
    Flame,
    HardDrive,
    Hash,
    Info,
    Layers,
    Link,
    List,
    MapPin,
    Maximize2,
    Minimize2,
    MoreHorizontal,
    MoreVertical,
    Package,
    PieChart,
    Plus,
    PlusCircle,
    Power,
    RefreshCw,
    Save,
    Search,
    Server,
    Settings,
    Share2,
    Shield,
    Sliders,
    Target,
    Thermometer,
    Trash2,
    TrendingDown,
    TrendingUp,
    Users,
    Wallet,
    Wifi,
    WifiOff,
    Wrench,
    X,
    XCircle,
    Zap
} from "lucide-react";

function getToken() { return localStorage.getItem("token"); }

function exportCSV(data, filename) {
    if (!data || !data.length) return;
    const keys = Object.keys(data[0]);
    const csv = [keys.join(","), ...data.map(r => keys.map(k => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename + ".csv";
    a.click();
    URL.revokeObjectURL(url);
}

function exportExcel(data, filename) {
    if (!data || !data.length) return;
    const keys = Object.keys(data[0]);
    const rows = [keys, ...data.map(r => keys.map(k => r[k] ?? ""))];
    const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Sheet1"><Table>${
        rows.map(r => `<Row>${r.map(c => `<Cell><Data ss:Type="${typeof c === "number" ? "Number" : "String"}">${String(c).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</Data></Cell>`).join("")}</Row>`).join("")
    }</Table></Worksheet></Workbook>`;
    const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename + ".xls";
    a.click();
    URL.revokeObjectURL(url);
}

function ExportBar({ data, filename }) {
    return (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#8493A6", fontWeight: 500 }}>Export:</span>
            {[
                { label: "Excel", color: "#0E9370", bg: "#E8F8F2", icon: FileSpreadsheet, action: () => exportExcel(data, filename) },
                { label: "CSV", color: "#4A8FCB", bg: "#EAF4FC", icon: FileText, action: () => exportCSV(data, filename) },
                { label: "Full Report", color: "#5B6B7D", bg: "#F5F7FA", icon: Download, action: () => window.open(`${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/reports/energy?format=html`, "_blank") },
            ].map(b => {
                const Icon = b.icon;
                return (
                    <button key={b.label} onClick={b.action}
                        style={{ padding: "4px 11px", fontSize: 11, fontWeight: 600, borderRadius: 6,
                            border: "1px solid " + b.color + "40", background: b.bg, color: b.color,
                            cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
                        <Icon size={12} /> {b.label}
                    </button>
                );
            })}
        </div>
    );
}

function ChartTip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
            <p style={{ color: "#5B6B7D", marginBottom: 4, fontWeight: 500 }}>{label}</p>
            {payload.map(p => <p key={p.name} style={{ color: p.color, margin: "2px 0" }}>{p.name}: <strong>{typeof p.value === "number" ? p.value.toFixed(2) : p.value}</strong></p>)}
        </div>
    );
}

function pct(actual, baseline) {
    if (!baseline) return { p: 0, over: false };
    const d = actual - baseline;
    return { p: parseFloat(Math.abs((d / baseline) * 100).toFixed(1)), over: d > 0 };
}

function pueEff(pue) { return parseFloat(Math.max(0, Math.min(100, ((3.0 - pue) / 2.0) * 100)).toFixed(1)); }
function co2Vs(actual, target = 100) {
    const d = actual - target;
    return { p: parseFloat(Math.abs((d / target) * 100).toFixed(1)), over: d > 0 };
}

function formatCurrency(value) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}

function formatNumber(value, decimals = 1) {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value);
}

function ZoneModal({ zone, onClose, onSave }) {
    const [formData, setFormData] = useState({
        name: zone?.name || "",
        pue: zone?.pue || 1.2,
        eer: zone?.eer || 3.5,
        co2_emissions: zone?.co2_emissions || 400,
        electricity_kwh: zone?.electricity_kwh || 350,
        electricity_base: zone?.electricity_base || 400,
        water_lpm: zone?.water_lpm || 50,
        water_base: zone?.water_base || 60,
        gas_m3h: zone?.gas_m3h || 15,
        gas_base: zone?.gas_base || 18
    });

    const handleSubmit = () => {
        onSave({ ...formData, id: zone?.id });
    };

    return (
        <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
        }} onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{
                background: "#fff",
                borderRadius: 14,
                padding: 28,
                maxWidth: 520,
                width: "100%",
                maxHeight: "90vh",
                overflowY: "auto",
                boxShadow: "0 24px 64px rgba(0,0,0,0.18)"
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0B0F14", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                        <Layers size={18} color="#5AA9E6" />
                        {zone?.id ? "Edit Zone" : "Add New Zone"}
                    </h3>
                    <button onClick={onClose} style={{
                        background: "none",
                        border: "none",
                        fontSize: 22,
                        color: "#8493A6",
                        cursor: "pointer"
                    }}><X size={18} /></button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                        <label style={{ fontSize: 11, color: "#5B6B7D", display: "block", marginBottom: 4 }}>Zone Name</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            style={{ width: "100%", padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 13 }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, color: "#5B6B7D", display: "block", marginBottom: 4 }}>PUE</label>
                        <input
                            type="number"
                            step="0.01"
                            value={formData.pue}
                            onChange={e => setFormData({ ...formData, pue: parseFloat(e.target.value) })}
                            style={{ width: "100%", padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 13 }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, color: "#5B6B7D", display: "block", marginBottom: 4 }}>EER</label>
                        <input
                            type="number"
                            step="0.1"
                            value={formData.eer}
                            onChange={e => setFormData({ ...formData, eer: parseFloat(e.target.value) })}
                            style={{ width: "100%", padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 13 }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, color: "#5B6B7D", display: "block", marginBottom: 4 }}>CO₂ Emissions (kg/h)</label>
                        <input
                            type="number"
                            value={formData.co2_emissions}
                            onChange={e => setFormData({ ...formData, co2_emissions: parseFloat(e.target.value) })}
                            style={{ width: "100%", padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 13 }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, color: "#5B6B7D", display: "block", marginBottom: 4 }}>Electricity (kWh)</label>
                        <input
                            type="number"
                            value={formData.electricity_kwh}
                            onChange={e => setFormData({ ...formData, electricity_kwh: parseFloat(e.target.value) })}
                            style={{ width: "100%", padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 13 }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, color: "#5B6B7D", display: "block", marginBottom: 4 }}>Electricity Baseline</label>
                        <input
                            type="number"
                            value={formData.electricity_base}
                            onChange={e => setFormData({ ...formData, electricity_base: parseFloat(e.target.value) })}
                            style={{ width: "100%", padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 13 }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, color: "#5B6B7D", display: "block", marginBottom: 4 }}>Water (L/min)</label>
                        <input
                            type="number"
                            value={formData.water_lpm}
                            onChange={e => setFormData({ ...formData, water_lpm: parseFloat(e.target.value) })}
                            style={{ width: "100%", padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 13 }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, color: "#5B6B7D", display: "block", marginBottom: 4 }}>Water Baseline</label>
                        <input
                            type="number"
                            value={formData.water_base}
                            onChange={e => setFormData({ ...formData, water_base: parseFloat(e.target.value) })}
                            style={{ width: "100%", padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 13 }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, color: "#5B6B7D", display: "block", marginBottom: 4 }}>Gas (m³/h)</label>
                        <input
                            type="number"
                            value={formData.gas_m3h}
                            onChange={e => setFormData({ ...formData, gas_m3h: parseFloat(e.target.value) })}
                            style={{ width: "100%", padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 13 }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, color: "#5B6B7D", display: "block", marginBottom: 4 }}>Gas Baseline</label>
                        <input
                            type="number"
                            value={formData.gas_base}
                            onChange={e => setFormData({ ...formData, gas_base: parseFloat(e.target.value) })}
                            style={{ width: "100%", padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 13 }}
                        />
                    </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
                    <button onClick={onClose} style={{
                        padding: "8px 18px",
                        fontSize: 13,
                        background: "#fff",
                        border: "1px solid #E2E8F0",
                        borderRadius: 7,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                    }}>
                        <X size={14} /> Cancel
                    </button>
                    <button onClick={handleSubmit} style={{
                        padding: "8px 18px",
                        fontSize: 13,
                        fontWeight: 600,
                        background: "#5AA9E6",
                        color: "#fff",
                        border: "none",
                        borderRadius: 7,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                    }}>
                        <Save size={14} /> Save Zone
                    </button>
                </div>
            </div>
        </div>
    );
}

function ScheduleModal({ onClose, onAdd }) {
    const [schedule, setSchedule] = useState({ time: "", action: "", target: "" });

    return (
        <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
        }} onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{
                background: "#fff",
                borderRadius: 14,
                padding: 28,
                maxWidth: 420,
                width: "100%",
                boxShadow: "0 24px 64px rgba(0,0,0,0.18)"
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0B0F14", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                        <Calendar size={18} color="#5AA9E6" />
                        Schedule Action
                    </h3>
                    <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: "#8493A6", cursor: "pointer" }}>
                        <X size={18} />
                    </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                        <label style={{ fontSize: 11, color: "#5B6B7D", display: "block", marginBottom: 4 }}>Time</label>
                        <input
                            type="time"
                            value={schedule.time}
                            onChange={e => setSchedule({ ...schedule, time: e.target.value })}
                            style={{ width: "100%", padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 6 }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, color: "#5B6B7D", display: "block", marginBottom: 4 }}>Action</label>
                        <select
                            value={schedule.action}
                            onChange={e => setSchedule({ ...schedule, action: e.target.value })}
                            style={{ width: "100%", padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 6 }}
                        >
                            <option value="">Select Action</option>
                            <option value="reduce_load">Reduce Load</option>
                            <option value="optimize_cooling">Optimize Cooling</option>
                            <option value="shift_production">Shift Production</option>
                            <option value="enable_savings">Enable Savings Mode</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: 11, color: "#5B6B7D", display: "block", marginBottom: 4 }}>Target</label>
                        <input
                            type="text"
                            placeholder="e.g., 5% reduction"
                            value={schedule.target}
                            onChange={e => setSchedule({ ...schedule, target: e.target.value })}
                            style={{ width: "100%", padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 6 }}
                        />
                    </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
                    <button onClick={onClose} style={{
                        padding: "8px 18px",
                        fontSize: 13,
                        background: "#fff",
                        border: "1px solid #E2E8F0",
                        borderRadius: 7,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                    }}>
                        <X size={14} /> Cancel
                    </button>
                    <button onClick={() => { onAdd(schedule); onClose(); }} style={{
                        padding: "8px 18px",
                        fontSize: 13,
                        fontWeight: 600,
                        background: "#5AA9E6",
                        color: "#fff",
                        border: "none",
                        borderRadius: 7,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                    }}>
                        <Plus size={14} /> Add Schedule
                    </button>
                </div>
            </div>
        </div>
    );
}

function ZoneCard({ zone, onEdit, onDelete }) {
    const pueEffVal = pueEff(zone.pue || 1.2);
    const statusColor = pueEffVal >= 60 ? "#12B886" : pueEffVal >= 40 ? "#F0A93A" : "#E6484B";
    
    return (
        <div style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: "16px 18px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            transition: "all 0.2s"
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: "#0B0F14", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                        <Layers size={14} color="#5AA9E6" />
                        {zone.name}
                    </h4>
                    <span style={{ fontSize: 10, color: "#8493A6" }}>Zone {zone.id}</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => onEdit(zone)} style={{
                        padding: "4px 10px",
                        fontSize: 11,
                        border: "1px solid #E2E8F0",
                        background: "#fff",
                        borderRadius: 4,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                    }}>
                        <Edit size={12} /> Edit
                    </button>
                    <button onClick={() => onDelete(zone.id)} style={{
                        padding: "4px 10px",
                        fontSize: 11,
                        color: "#E6484B",
                        border: "1px solid #F3B7B8",
                        background: "#FBEAEA",
                        borderRadius: 4,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                    }}>
                        <Trash2 size={12} /> Delete
                    </button>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: statusColor }}>
                        {zone.electricity_kwh?.toFixed(1) || 0}
                    </div>
                    <div style={{ fontSize: 9, color: "#5B6B7D" }}>kWh</div>
                </div>
                <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: statusColor }}>
                        {zone.pue?.toFixed(2) || 0}
                    </div>
                    <div style={{ fontSize: 9, color: "#5B6B7D" }}>PUE</div>
                </div>
                <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: statusColor }}>
                        {zone.eer?.toFixed(1) || 0}
                    </div>
                    <div style={{ fontSize: 9, color: "#5B6B7D" }}>EER</div>
                </div>
            </div>

            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #F5F7FA" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#5B6B7D" }}>
                    <span><Droplet size={12} style={{ verticalAlign: 'middle' }} /> {zone.water_lpm?.toFixed(1) || 0} L/min</span>
                    <span><Flame size={12} style={{ verticalAlign: 'middle' }} /> {zone.gas_m3h?.toFixed(1) || 0} m³/h</span>
                    <span><Cloud size={12} style={{ verticalAlign: 'middle' }} /> {zone.co2_emissions?.toFixed(1) || 0} kg/h</span>
                </div>
                <div style={{ marginTop: 6 }}>
                    <div style={{ background: "#F5F7FA", borderRadius: 4, height: 4, overflow: "hidden" }}>
                        <div style={{
                            width: `${Math.min((zone.electricity_kwh / zone.electricity_base) * 100, 100)}%`,
                            height: "100%",
                            background: (zone.electricity_kwh / zone.electricity_base) > 1.1 ? "#E6484B" : "#12B886",
                            borderRadius: 4
                        }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#8493A6", marginTop: 2 }}>
                        <span>0%</span>
                        <span>vs baseline</span>
                        <span>100%</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function GoalModal({ goal, onClose, onSave }) {
    const [formData, setFormData] = useState({
        target: goal?.target || "",
        deadline: goal?.deadline || ""
    });

    return (
        <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
        }} onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{
                background: "#fff",
                borderRadius: 14,
                padding: 28,
                maxWidth: 400,
                width: "100%",
                boxShadow: "0 24px 64px rgba(0,0,0,0.18)"
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0B0F14", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                        <Target size={18} color="#5AA9E6" />
                        Energy Goal
                    </h3>
                    <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: "#8493A6", cursor: "pointer" }}>
                        <X size={18} />
                    </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                        <label style={{ fontSize: 11, color: "#5B6B7D", display: "block", marginBottom: 4 }}>Target (kWh)</label>
                        <input
                            type="number"
                            value={formData.target}
                            onChange={e => setFormData({ ...formData, target: parseFloat(e.target.value) })}
                            style={{ width: "100%", padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 6 }}
                            placeholder="Enter target consumption"
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, color: "#5B6B7D", display: "block", marginBottom: 4 }}>Deadline</label>
                        <input
                            type="date"
                            value={formData.deadline}
                            onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                            style={{ width: "100%", padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 6 }}
                        />
                    </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
                    <button onClick={onClose} style={{
                        padding: "8px 18px",
                        fontSize: 13,
                        background: "#fff",
                        border: "1px solid #E2E8F0",
                        borderRadius: 7,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                    }}>
                        <X size={14} /> Cancel
                    </button>
                    <button onClick={() => { onSave(formData); onClose(); }} style={{
                        padding: "8px 18px",
                        fontSize: 13,
                        fontWeight: 600,
                        background: "#5AA9E6",
                        color: "#fff",
                        border: "none",
                        borderRadius: 7,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                    }}>
                        <Save size={14} /> Save Goal
                    </button>
                </div>
            </div>
        </div>
    );
}

function AlertModal({ onClose, onAdd }) {
    const [alert, setAlert] = useState({ threshold: "", action: "", message: "" });

    return (
        <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
        }} onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{
                background: "#fff",
                borderRadius: 14,
                padding: 28,
                maxWidth: 420,
                width: "100%",
                boxShadow: "0 24px 64px rgba(0,0,0,0.18)"
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0B0F14", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                        <Bell size={18} color="#E6484B" />
                        Create Alert
                    </h3>
                    <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: "#8493A6", cursor: "pointer" }}>
                        <X size={18} />
                    </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                        <label style={{ fontSize: 11, color: "#5B6B7D", display: "block", marginBottom: 4 }}>Threshold (kWh)</label>
                        <input
                            type="number"
                            value={alert.threshold}
                            onChange={e => setAlert({ ...alert, threshold: e.target.value })}
                            style={{ width: "100%", padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 6 }}
                            placeholder="Enter threshold value"
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, color: "#5B6B7D", display: "block", marginBottom: 4 }}>Action</label>
                        <input
                            type="text"
                            value={alert.action}
                            onChange={e => setAlert({ ...alert, action: e.target.value })}
                            style={{ width: "100%", padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 6 }}
                            placeholder="Action to take"
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, color: "#5B6B7D", display: "block", marginBottom: 4 }}>Message</label>
                        <input
                            type="text"
                            value={alert.message}
                            onChange={e => setAlert({ ...alert, message: e.target.value })}
                            style={{ width: "100%", padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 6 }}
                            placeholder="Alert message"
                        />
                    </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
                    <button onClick={onClose} style={{
                        padding: "8px 18px",
                        fontSize: 13,
                        background: "#fff",
                        border: "1px solid #E2E8F0",
                        borderRadius: 7,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                    }}>
                        <X size={14} /> Cancel
                    </button>
                    <button onClick={() => { onAdd(alert); onClose(); }} style={{
                        padding: "8px 18px",
                        fontSize: 13,
                        fontWeight: 600,
                        background: "#E6484B",
                        color: "#fff",
                        border: "none",
                        borderRadius: 7,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                    }}>
                        <Bell size={14} /> Create Alert
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function EnergyView({ userRole }) {
    const { t } = useLanguage();
    const { data, loading, error, refresh, setData } = useApi("/energy", 15000);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [editingBaseline, setEditingBaseline] = useState(false);
    const [newBaseline, setNewBaseline] = useState(0);
    const [showZones, setShowZones] = useState(false);
    const [showSchedule, setShowSchedule] = useState(false);
    const [showGoal, setShowGoal] = useState(false);
    const [showAlert, setShowAlert] = useState(false);
    const [showZoneModal, setShowZoneModal] = useState(false);
    const [editingZone, setEditingZone] = useState(null);
    const [zones, setZones] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [goals, setGoals] = useState({ target: 0, deadline: "", achieved: false });
    const [alerts, setAlerts] = useState([]);
    const [history, setHistory] = useState([]);
    const [zoneLoading, setZoneLoading] = useState(false);
    const [toast, setToast] = useState(null);

    const histTableRef = useRef(null);

    useEffect(() => {
        fetchZones();
        fetchSchedules();
        fetchGoals();
        fetchAlerts();
        loadHistory();
    }, []);

    const fetchZones = async () => {
        setZoneLoading(true);
        try {
            const res = await fetch("/api/energy/zones", {
                headers: { Authorization: "Bearer " + getToken() }
            });
            if (res.ok) {
                const data = await res.json();
                setZones(data);
            }
        } catch (e) {
            console.error("Failed to fetch zones:", e);
        } finally {
            setZoneLoading(false);
        }
    };

    const fetchSchedules = async () => {
        try {
            const res = await fetch("/api/energy/schedules", {
                headers: { Authorization: "Bearer " + getToken() }
            });
            if (res.ok) {
                const data = await res.json();
                setSchedules(data);
            }
        } catch (e) {
            console.error("Failed to fetch schedules:", e);
        }
    };

    const fetchGoals = async () => {
        try {
            const res = await fetch("/api/energy/goals", {
                headers: { Authorization: "Bearer " + getToken() }
            });
            if (res.ok) {
                const data = await res.json();
                if (data) setGoals(data);
            }
        } catch (e) {
            console.error("Failed to fetch goals:", e);
        }
    };

    const fetchAlerts = async () => {
        try {
            const res = await fetch("/api/energy/alerts", {
                headers: { Authorization: "Bearer " + getToken() }
            });
            if (res.ok) {
                const data = await res.json();
                setAlerts(data);
            }
        } catch (e) {
            console.error("Failed to fetch alerts:", e);
        }
    };

    const loadHistory = () => {
        try {
            const saved = localStorage.getItem("optimizationHistory");
            if (saved) setHistory(JSON.parse(saved));
        } catch (e) {}
    };

    useSocket({
        "energy:update": (update) => {
            console.log("[EnergyView] Received energy update:", update);
            if (update) {
                setLastUpdate(new Date());
                setData(prev => {
                    if (!prev) {
                        return {
                            current: update.current || 0,
                            baseline: update.baseline || 0,
                            water: { 
                                current: update.water?.current || 0, 
                                baseline: update.water?.baseline || 0 
                            },
                            gas: { 
                                current: update.gas?.current || 0, 
                                baseline: update.gas?.baseline || 0 
                            },
                            kpis: { 
                                pue: update.kpis?.pue || 0, 
                                eer: update.kpis?.eer || 0, 
                                co2: update.kpis?.co2 || 0 
                            },
                            history: []
                        };
                    }
                    
                    const updatedHistory = [...(prev.history || [])];
                    const now = new Date();
                    const currentHourStr = `${String(now.getHours()).padStart(2, '0')}:00`;

                    const existingIndex = updatedHistory.findIndex(h => h.hour === currentHourStr);
                    
                    if (existingIndex >= 0) {
                        updatedHistory[existingIndex] = {
                            ...updatedHistory[existingIndex],
                            actual: update.current,
                            baseline: update.baseline ?? updatedHistory[existingIndex].baseline
                        };
                    } else {
                        updatedHistory.push({
                            hour: currentHourStr,
                            actual: update.current,
                            baseline: update.baseline ?? prev.baseline
                        });
                        if (updatedHistory.length > 24) {
                            updatedHistory.shift();
                        }
                    }

                    return {
                        ...prev,
                        current: update.current ?? prev.current,
                        baseline: update.baseline ?? prev.baseline,
                        water: {
                            current: update.water?.current ?? prev.water?.current,
                            baseline: update.water?.baseline ?? prev.water?.baseline
                        },
                        gas: {
                            current: update.gas?.current ?? prev.gas?.current,
                            baseline: update.gas?.baseline ?? prev.gas?.baseline
                        },
                        kpis: {
                            pue: update.kpis?.pue ?? prev.kpis?.pue,
                            eer: update.kpis?.eer ?? prev.kpis?.eer,
                            co2: update.kpis?.co2 ?? prev.kpis?.co2
                        },
                        history: updatedHistory
                    };
                });
            }
        },
        "energy:zone:updated": (zone) => {
            console.log("[EnergyView] Zone updated:", zone);
            setZones(prev => {
                const existing = prev.findIndex(z => z.name === zone.name);
                if (existing >= 0) {
                    const updated = [...prev];
                    updated[existing] = zone;
                    return updated;
                }
                return [...prev, zone];
            });
            setToast({ message: `Zone ${zone.name} updated`, type: "success" });
            setTimeout(() => setToast(null), 3000);
        },
        "energy:zone:deleted": ({ zone }) => {
            console.log("[EnergyView] Zone deleted:", zone);
            setZones(prev => prev.filter(z => z.name !== zone));
            setToast({ message: `Zone ${zone} deleted`, type: "warning" });
            setTimeout(() => setToast(null), 3000);
        }
    });

    if (loading) return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[70, 110, 300, 260, 180, 200].map((h, i) => (
                <div key={i} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, height: h, animation: `pulse 1.4s ease-in-out ${i * 0.12}s infinite` }} />
            ))}
        </div>
    );
    if (error) return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#E6484B", fontSize: 13 }}>
            <AlertCircle size={18} /> Error: {error}
        </div>
    );
    if (!data) return null;

    const { 
        current = 0, 
        baseline = 0, 
        water = { current: 0, baseline: 0 }, 
        gas = { current: 0, baseline: 0 }, 
        kpis = { pue: 0, eer: 0, co2: 0 }, 
        history: histData = [] 
    } = data;

    const elecP = pct(current, baseline);
    const waterP = pct(water.current, water.baseline);
    const gasP = pct(gas.current, gas.baseline);
    const pueff = pueEff(kpis.pue);
    const { p: co2P, over: co2Over } = co2Vs(kpis.co2, 60);
    const savings = {
        diff: Math.abs(baseline - current),
        pct: baseline !== 0 ? Math.round(((baseline - current) / baseline) * 100) : 0,
        saving: current < baseline,
        cost: Math.abs(baseline - current) * 0.12
    };

    const progress = goals.target > 0 ? Math.min((current / goals.target) * 100, 100) : 0;

    const exportData = histData && histData.length > 0 
        ? histData.map(h => ({ Hour: h.hour, "Actual (kWh)": h.actual, "Baseline (kWh)": h.baseline }))
        : [];

    const handleZoneSave = async (zoneData) => {
        try {
            const res = await fetch("/api/energy/zones", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer " + getToken()
                },
                body: JSON.stringify(zoneData)
            });
            if (res.ok) {
                await fetchZones();
                setShowZoneModal(false);
                setEditingZone(null);
                setToast({ message: `Zone ${zoneData.name} saved successfully`, type: "success" });
                setTimeout(() => setToast(null), 3000);
            }
        } catch (e) {
            console.error("Failed to save zone:", e);
            setToast({ message: "Failed to save zone", type: "error" });
            setTimeout(() => setToast(null), 3000);
        }
    };

    const handleZoneDelete = async (zoneId) => {
        if (!window.confirm("Delete this zone?")) return;
        try {
            const res = await fetch(`/api/energy/zones/${zoneId}`, {
                method: "DELETE",
                headers: { Authorization: "Bearer " + getToken() }
            });
            if (res.ok) {
                await fetchZones();
                setToast({ message: "Zone deleted", type: "warning" });
                setTimeout(() => setToast(null), 3000);
            }
        } catch (e) {
            console.error("Failed to delete zone:", e);
        }
    };

    const handleAddSchedule = async (schedule) => {
        try {
            const res = await fetch("/api/energy/schedules", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer " + getToken()
                },
                body: JSON.stringify(schedule)
            });
            if (res.ok) {
                await fetchSchedules();
                setToast({ message: "Schedule added", type: "success" });
                setTimeout(() => setToast(null), 3000);
            }
        } catch (e) {
            console.error("Failed to add schedule:", e);
        }
    };

    const handleDeleteSchedule = async (id) => {
        try {
            const res = await fetch(`/api/energy/schedules/${id}`, {
                method: "DELETE",
                headers: { Authorization: "Bearer " + getToken() }
            });
            if (res.ok) {
                await fetchSchedules();
                setToast({ message: "Schedule deleted", type: "warning" });
                setTimeout(() => setToast(null), 3000);
            }
        } catch (e) {
            console.error("Failed to delete schedule:", e);
        }
    };

    const handleSaveGoal = async (goalData) => {
        try {
            const res = await fetch("/api/energy/goals", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer " + getToken()
                },
                body: JSON.stringify(goalData)
            });
            if (res.ok) {
                await fetchGoals();
                setToast({ message: "Goal saved", type: "success" });
                setTimeout(() => setToast(null), 3000);
            }
        } catch (e) {
            console.error("Failed to save goal:", e);
        }
    };

    const handleAddAlert = async (alertData) => {
        try {
            const res = await fetch("/api/energy/alerts", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer " + getToken()
                },
                body: JSON.stringify(alertData)
            });
            if (res.ok) {
                await fetchAlerts();
                setToast({ message: "Alert created", type: "warning" });
                setTimeout(() => setToast(null), 3000);
            }
        } catch (e) {
            console.error("Failed to create alert:", e);
        }
    };

    const handleAcknowledgeAlert = async (id) => {
        try {
            const res = await fetch(`/api/energy/alerts/${id}/acknowledge`, {
                method: "PATCH",
                headers: { Authorization: "Bearer " + getToken() }
            });
            if (res.ok) {
                await fetchAlerts();
                setToast({ message: "Alert acknowledged", type: "success" });
                setTimeout(() => setToast(null), 3000);
            }
        } catch (e) {
            console.error("Failed to acknowledge alert:", e);
        }
    };

    const saveBaseline = () => {
        if (!data) return;
        const updated = { ...data, baseline: newBaseline };
        setData(updated);
        setEditingBaseline(false);
        localStorage.setItem("customBaseline", JSON.stringify({ baseline: newBaseline, timestamp: new Date().toISOString() }));
        
        const hist = JSON.parse(localStorage.getItem("optimizationHistory") || "[]");
        hist.push({
            id: Date.now(),
            type: "baseline_update",
            title: "Baseline Updated",
            description: `Baseline changed from ${data.baseline} to ${newBaseline} kWh`,
            appliedAt: new Date().toISOString()
        });
        localStorage.setItem("optimizationHistory", JSON.stringify(hist));
        setHistory(hist);
        setToast({ message: "Baseline updated", type: "success" });
        setTimeout(() => setToast(null), 3000);
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <style>{`
                @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
                @keyframes slideIn{from{transform:translateX(-20px);opacity:0}to{transform:translateX(0);opacity:1}}
            `}</style>

            {toast && (
                <div style={{
                    position: "fixed",
                    top: 20,
                    right: 20,
                    padding: "12px 20px",
                    borderRadius: 8,
                    background: toast.type === "success" ? "#E8F8F2" : toast.type === "warning" ? "#FBEAEA" : "#FBEAEA",
                    border: `1px solid ${toast.type === "success" ? "#A8E6CC" : toast.type === "warning" ? "#F3B7B8" : "#F3B7B8"}`,
                    color: toast.type === "success" ? "#0E9370" : toast.type === "warning" ? "#8E2C2E" : "#8E2C2E",
                    zIndex: 1001,
                    animation: "slideIn 0.3s ease",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8
                }}>
                    {toast.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                    {toast.message}
                </div>
            )}

            {showZoneModal && (
                <ZoneModal
                    zone={editingZone}
                    onClose={() => { setShowZoneModal(false); setEditingZone(null); }}
                    onSave={handleZoneSave}
                />
            )}

            {showSchedule && (
                <ScheduleModal
                    onClose={() => setShowSchedule(false)}
                    onAdd={handleAddSchedule}
                />
            )}

            {showGoal && (
                <GoalModal
                    goal={goals}
                    onClose={() => setShowGoal(false)}
                    onSave={handleSaveGoal}
                />
            )}

            {showAlert && (
                <AlertModal
                    onClose={() => setShowAlert(false)}
                    onAdd={handleAddAlert}
                />
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0B0F14", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                        <Zap size={20} color="#F0A93A" />
                        Energy Management
                    </h2>
                    <p style={{ fontSize: 11, color: "#8493A6", margin: "4px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
                        <Activity size={12} />
                        Live data · {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : "Connecting..."}
                    </p>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={() => setShowZones(!showZones)} style={{
                        padding: "6px 14px",
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 6,
                        border: showZones ? "2px solid #5AA9E6" : "1px solid #E2E8F0",
                        background: showZones ? "#EAF4FC" : "#fff",
                        color: showZones ? "#4A8FCB" : "#5B6B7D",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                    }}>
                        <Layers size={14} /> Zones
                    </button>
                    <button onClick={() => setShowSchedule(true)} style={{
                        padding: "6px 14px",
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 6,
                        border: "1px solid #E2E8F0",
                        background: "#fff",
                        color: "#5B6B7D",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                    }}>
                        <Calendar size={14} /> Schedule
                    </button>
                    <button onClick={() => setShowGoal(true)} style={{
                        padding: "6px 14px",
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 6,
                        border: "1px solid #E2E8F0",
                        background: "#fff",
                        color: "#5B6B7D",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                    }}>
                        <Target size={14} /> Goal
                    </button>
                    <button onClick={() => setShowAlert(true)} style={{
                        padding: "6px 14px",
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 6,
                        border: "1px solid #E2E8F0",
                        background: "#fff",
                        color: "#5B6B7D",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                    }}>
                        <Bell size={14} /> Alert
                    </button>
                    <button onClick={refresh} style={{
                        padding: "6px 14px",
                        fontSize: 12,
                        border: "1px solid #E2E8F0",
                        background: "#fff",
                        borderRadius: 6,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                    }}>
                        <RefreshCw size={14} /> Refresh
                    </button>
                    <ExportBar data={exportData} filename="energy_data" />
                </div>
            </div>

            {showZones && (
                <div style={{
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: "18px 20px",
                    animation: "slideIn 0.3s ease"
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0B0F14", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                            <Layers size={16} color="#5AA9E6" />
                            Energy Zones
                        </h3>
                        <button onClick={() => { setEditingZone(null); setShowZoneModal(true); }} style={{
                            padding: "4px 12px",
                            fontSize: 11,
                            fontWeight: 600,
                            background: "#5AA9E6",
                            color: "#fff",
                            border: "none",
                            borderRadius: 4,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 4
                        }}>
                            <Plus size={14} /> Add Zone
                        </button>
                    </div>
                    {zoneLoading ? (
                        <p style={{ color: "#5B6B7D", fontSize: 12 }}>Loading zones...</p>
                    ) : zones.length === 0 ? (
                        <p style={{ color: "#5B6B7D", fontSize: 12 }}>No zones configured. Add your first zone.</p>
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                            {zones.map(zone => (
                                <ZoneCard
                                    key={zone.id || zone.name}
                                    zone={zone}
                                    onEdit={(z) => { setEditingZone(z); setShowZoneModal(true); }}
                                    onDelete={handleZoneDelete}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {schedules.length > 0 && (
                <div style={{
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: "14px 18px",
                    animation: "slideIn 0.3s ease"
                }}>
                    <h4 style={{ fontSize: 12, fontWeight: 700, color: "#5B6B7D", textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 8px", display: "flex", alignItems: "center", gap: 6 }}>
                        <Calendar size={14} /> Scheduled Actions
                    </h4>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {schedules.map(s => (
                            <div key={s.id} style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "4px 10px",
                                background: "#E8F8F2",
                                border: "1px solid #A8E6CC",
                                borderRadius: 6,
                                fontSize: 11
                            }}>
                                <Clock size={12} />
                                <span style={{ fontWeight: 600 }}>{s.time}</span>
                                <span>{s.action}</span>
                                {s.target && <span style={{ color: "#5AA9E6" }}>→ {s.target}</span>}
                                <button onClick={() => handleDeleteSchedule(s.id)} style={{
                                    background: "none",
                                    border: "none",
                                    color: "#E6484B",
                                    cursor: "pointer",
                                    padding: "0 2px"
                                }}>
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {alerts.filter(a => a.active).length > 0 && (
                <div style={{
                    background: "#FBEAEA",
                    border: "1px solid #F3B7B8",
                    borderRadius: 12,
                    padding: "14px 18px"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <Bell size={16} color="#E6484B" />
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#8E2C2E" }}>Active Alerts</span>
                    </div>
                    {alerts.filter(a => a.active).map(alert => (
                        <div key={alert.id} style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "6px 12px",
                            background: "#fff",
                            borderRadius: 6,
                            marginBottom: 4,
                            border: "1px solid #F3B7B8"
                        }}>
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: "#8E2C2E", display: "flex", alignItems: "center", gap: 4 }}>
                                    <AlertTriangle size={12} />
                                    Threshold: {alert.threshold} kWh
                                </div>
                                <div style={{ fontSize: 11, color: "#5B6B7D" }}>
                                    {alert.message || `Action: ${alert.action}`}
                                </div>
                            </div>
                            <button onClick={() => handleAcknowledgeAlert(alert.id)} style={{
                                padding: "4px 12px",
                                fontSize: 11,
                                background: "#5AA9E6",
                                color: "#fff",
                                border: "none",
                                borderRadius: 4,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 4
                            }}>
                                <Check size={12} /> Acknowledge
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 18px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#5B6B7D", textTransform: "uppercase", letterSpacing: 1, display: "flex", alignItems: "center", gap: 4 }}>
                        <Activity size={12} /> PUE
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: kpis.pue <= 1.5 ? "#0B0F14" : "#E6484B" }}>{kpis.pue.toFixed(2)}</div>
                    <div style={{ fontSize: 11, color: "#5B6B7D" }}>Target: ≤ 1.5</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: kpis.pue <= 1.5 ? "#12B886" : "#E6484B" }}>
                        {pueff}% Efficient
                    </div>
                </div>
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 18px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#5B6B7D", textTransform: "uppercase", letterSpacing: 1, display: "flex", alignItems: "center", gap: 4 }}>
                        <BarChart3 size={12} /> EER
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: "#0B0F14" }}>{kpis.eer.toFixed(2)}</div>
                    <div style={{ fontSize: 11, color: "#5B6B7D" }}>Energy Efficiency Ratio</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#12B886" }}>{Math.round((kpis.eer/6)*100)}% of Max</div>
                </div>
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 18px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#5B6B7D", textTransform: "uppercase", letterSpacing: 1, display: "flex", alignItems: "center", gap: 4 }}>
                        <Cloud size={12} /> CO₂
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: co2Over ? "#E6484B" : "#0B0F14" }}>{kpis.co2.toFixed(1)} kg/h</div>
                    <div style={{ fontSize: 11, color: "#5B6B7D" }}>Target: 60 kg/h</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: co2Over ? "#E6484B" : "#12B886" }}>
                        {co2Over ? <ArrowUp size={12} style={{ verticalAlign: 'middle' }} /> : <ArrowDown size={12} style={{ verticalAlign: 'middle' }} />}
                        {co2Over ? `+${co2P}% Over` : `-${co2P}% Under`}
                    </div>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 150, background: "#fff", borderRadius: 12, border: "1px solid " + (elecP.over ? "#F3B7B8" : "#A8E6CC"), borderTop: "3px solid " + (elecP.over ? "#E6484B" : "#12B886"), padding: "16px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <Zap size={20} color={elecP.over ? "#E6484B" : "#12B886"} />
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>Electricity</span>
                            {editingBaseline && (
                                <button onClick={saveBaseline} style={{
                                    marginLeft: "auto",
                                    padding: "2px 10px",
                                    fontSize: 11,
                                    background: "#5AA9E6",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: 4,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4
                                }}>
                                    <Save size={12} /> Save
                                </button>
                            )}
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: elecP.over ? "#E6484B" : "#0E9370" }}>
                            {formatNumber(current)}
                            <span style={{ fontSize: 12, fontWeight: 400, color: "#8493A6", marginLeft: 4 }}>kWh</span>
                        </div>
                        {editingBaseline ? (
                            <input
                                type="number"
                                value={newBaseline}
                                onChange={(e) => setNewBaseline(parseFloat(e.target.value))}
                                style={{ padding: "4px 8px", fontSize: 12, border: "1px solid #E2E8F0", borderRadius: 4, width: 100, marginTop: 4 }}
                            />
                        ) : (
                            <div style={{ fontSize: 11, color: "#8493A6", marginTop: 2, cursor: "pointer" }} onClick={() => { setEditingBaseline(true); setNewBaseline(baseline); }}>
                                <Edit size={12} style={{ verticalAlign: 'middle' }} /> Baseline: {formatNumber(baseline)} kWh <span style={{ fontSize: 10, color: "#5AA9E6" }}>(edit)</span>
                            </div>
                        )}
                        <div style={{ marginTop: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                                <span style={{ color: "#8493A6" }}>vs baseline</span>
                                <span style={{ fontWeight: 700, color: elecP.over ? "#E6484B" : "#12B886" }}>
                                    {elecP.over ? <ArrowUp size={12} style={{ verticalAlign: 'middle' }} /> : <ArrowDown size={12} style={{ verticalAlign: 'middle' }} />}
                                    {elecP.p}%
                                </span>
                            </div>
                            <div style={{ background: "#F5F7FA", borderRadius: 4, height: 5, marginTop: 4 }}>
                                <div style={{ width: Math.min(elecP.p, 100) + "%", height: "100%", background: elecP.over ? "#E6484B" : "#12B886", borderRadius: 4 }} />
                            </div>
                        </div>
                        <div style={{ fontSize: 11, color: "#12B886", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
                            <DollarSign size={14} /> {formatCurrency(savings.cost)}/h {savings.saving ? "saved" : "extra"}
                        </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 150, background: "#fff", borderRadius: 12, border: "1px solid " + (waterP.over ? "#F3B7B8" : "#A8E6CC"), borderTop: "3px solid " + (waterP.over ? "#E6484B" : "#12B886"), padding: "16px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <Droplet size={20} color={waterP.over ? "#E6484B" : "#12B886"} />
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>Water</span>
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: waterP.over ? "#E6484B" : "#0E9370" }}>
                            {formatNumber(water.current)}
                            <span style={{ fontSize: 12, fontWeight: 400, color: "#8493A6", marginLeft: 4 }}>L/min</span>
                        </div>
                        <div style={{ fontSize: 11, color: "#8493A6", marginTop: 2 }}>Baseline: {formatNumber(water.baseline)} L/min</div>
                        <div style={{ marginTop: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                                <span style={{ color: "#8493A6" }}>vs baseline</span>
                                <span style={{ fontWeight: 700, color: waterP.over ? "#E6484B" : "#12B886" }}>
                                    {waterP.over ? <ArrowUp size={12} style={{ verticalAlign: 'middle' }} /> : <ArrowDown size={12} style={{ verticalAlign: 'middle' }} />}
                                    {waterP.p}%
                                </span>
                            </div>
                            <div style={{ background: "#F5F7FA", borderRadius: 4, height: 5, marginTop: 4 }}>
                                <div style={{ width: Math.min(waterP.p, 100) + "%", height: "100%", background: waterP.over ? "#E6484B" : "#12B886", borderRadius: 4 }} />
                            </div>
                        </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 150, background: "#fff", borderRadius: 12, border: "1px solid " + (gasP.over ? "#F3B7B8" : "#A8E6CC"), borderTop: "3px solid " + (gasP.over ? "#E6484B" : "#12B886"), padding: "16px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <Flame size={20} color={gasP.over ? "#E6484B" : "#12B886"} />
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>Gas</span>
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: gasP.over ? "#E6484B" : "#0E9370" }}>
                            {formatNumber(gas.current)}
                            <span style={{ fontSize: 12, fontWeight: 400, color: "#8493A6", marginLeft: 4 }}>m³/h</span>
                        </div>
                        <div style={{ fontSize: 11, color: "#8493A6", marginTop: 2 }}>Baseline: {formatNumber(gas.baseline)} m³/h</div>
                        <div style={{ marginTop: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                                <span style={{ color: "#8493A6" }}>vs baseline</span>
                                <span style={{ fontWeight: 700, color: gasP.over ? "#E6484B" : "#12B886" }}>
                                    {gasP.over ? <ArrowUp size={12} style={{ verticalAlign: 'middle' }} /> : <ArrowDown size={12} style={{ verticalAlign: 'middle' }} />}
                                    {gasP.p}%
                                </span>
                            </div>
                            <div style={{ background: "#F5F7FA", borderRadius: 4, height: 5, marginTop: 4 }}>
                                <div style={{ width: Math.min(gasP.p, 100) + "%", height: "100%", background: gasP.over ? "#E6484B" : "#12B886", borderRadius: 4 }} />
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ background: "#E8F8F2", border: "1px solid #A8E6CC", borderRadius: 12, padding: "16px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <Wallet size={20} color="#0E9370" />
                        <div>
                            <h4 style={{ fontSize: 13, fontWeight: 700, color: "#0B0F14", margin: 0 }}>Cost Savings</h4>
                            <p style={{ fontSize: 10, color: "#5B6B7D", margin: 0 }}>vs baseline</p>
                        </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        <div style={{ textAlign: "center", background: "#fff", borderRadius: 6, padding: 8 }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: savings.saving ? "#12B886" : "#E6484B" }}>
                                {savings.saving ? <TrendingDown size={16} style={{ verticalAlign: 'middle' }} /> : <TrendingUp size={16} style={{ verticalAlign: 'middle' }} />}
                                {savings.pct}%
                            </div>
                            <div style={{ fontSize: 9, color: "#5B6B7D" }}>Savings Rate</div>
                        </div>
                        <div style={{ textAlign: "center", background: "#fff", borderRadius: 6, padding: 8 }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "#0B0F14" }}>
                                {formatCurrency(savings.cost)}/h
                            </div>
                            <div style={{ fontSize: 9, color: "#5B6B7D" }}>Hourly</div>
                        </div>
                        <div style={{ textAlign: "center", background: "#fff", borderRadius: 6, padding: 8 }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "#0B0F14" }}>
                                {formatCurrency(savings.cost * 24)}/day
                            </div>
                            <div style={{ fontSize: 9, color: "#5B6B7D" }}>Daily</div>
                        </div>
                    </div>
                </div>
            </div>

            {goals.target > 0 && (
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div>
                            <h4 style={{ fontSize: 13, fontWeight: 700, color: "#0B0F14", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                                <Target size={16} color="#5AA9E6" />
                                Energy Goal
                            </h4>
                            <p style={{ fontSize: 11, color: "#5B6B7D", margin: 0 }}>
                                Target: {formatNumber(goals.target)} kWh by {new Date(goals.deadline).toLocaleDateString()}
                            </p>
                        </div>
                        <button onClick={() => setShowGoal(true)} style={{
                            padding: "4px 10px",
                            fontSize: 11,
                            border: "1px solid #E2E8F0",
                            background: "#fff",
                            borderRadius: 4,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 4
                        }}>
                            <Edit size={12} /> Edit
                        </button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ background: "#F5F7FA", borderRadius: 6, height: 12, overflow: "hidden" }}>
                                <div style={{
                                    width: Math.min(progress, 100) + "%",
                                    height: "100%",
                                    background: progress > 80 ? "#E6484B" : progress > 60 ? "#F0A93A" : "#12B886",
                                    borderRadius: 6,
                                    transition: "width 0.5s ease"
                                }} />
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#5B6B7D", marginTop: 4 }}>
                                <span>0 kWh</span>
                                <span>{progress.toFixed(1)}%</span>
                                <span>{formatNumber(goals.target)} kWh</span>
                            </div>
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: progress > 80 ? "#E6484B" : progress > 60 ? "#F0A93A" : "#12B886" }}>
                            {progress.toFixed(1)}%
                        </div>
                    </div>
                </div>
            )}

            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0B0F14", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                        <BarChart3 size={16} color="#5AA9E6" />
                        24-Hour Consumption
                    </h3>
                    <ExportBar data={exportData} filename="energy_24h" />
                </div>
                {histData && histData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                        <ComposedChart data={histData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#5AA9E6" stopOpacity={0.18}/>
                                    <stop offset="95%" stopColor="#5AA9E6" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8493A6" stopOpacity={0.12}/>
                                    <stop offset="95%" stopColor="#8493A6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#8493A6" }} interval={3} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                            <YAxis tick={{ fontSize: 10, fill: "#8493A6" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                            <Tooltip content={<ChartTip />} />
                            <Legend wrapperStyle={{ fontSize: 12, color: "#5B6B7D", paddingTop: 10 }} />
                            <Area type="monotone" dataKey="baseline" name="Baseline" stroke="#8493A6" strokeDasharray="5 3" fill="url(#gB)" strokeWidth={1.5} />
                            <Area type="monotone" dataKey="actual" name="Actual" stroke="#5AA9E6" fill="url(#gA)" strokeWidth={2} />
                        </ComposedChart>
                    </ResponsiveContainer>
                ) : (
                    <div style={{ textAlign: "center", padding: "40px 0", color: "#8493A6" }}>
                        No historical data available
                    </div>
                )}
                <table ref={histTableRef} style={{ display: "none" }}>
                    <thead><tr><th>Hour</th><th>Actual (kWh)</th><th>Baseline (kWh)</th></tr></thead>
                    <tbody>
                        {histData && histData.length > 0 ? (
                            histData.map((h, i) => (
                                <tr key={i}><td>{h.hour}</td><td>{h.actual}</td><td>{h.baseline}</td></tr>
                            ))
                        ) : (
                            <tr><td colSpan="3" style={{ textAlign: "center", color: "#8493A6" }}>No data available</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {userRole === "energy_manager" && (
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 18 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: "#0B0F14", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                        <Sliders size={16} color="#5AA9E6" />
                        Threshold Configuration
                    </h3>
                    <p style={{ fontSize: 11, color: "#5B6B7D", marginBottom: 14 }}>Set custom thresholds for energy monitoring</p>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData(e.target);
                        fetch("/api/thresholds", {
                            method: "POST",
                            headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken() },
                            body: JSON.stringify({
                                assetId: fd.get("assetId"),
                                metric: fd.get("metric"),
                                value: parseFloat(fd.get("value"))
                            }),
                        }).then(() => {
                            setToast({ message: "Threshold saved successfully", type: "success" });
                            setTimeout(() => setToast(null), 3000);
                        }).catch(() => {
                            setToast({ message: "Failed to save threshold", type: "error" });
                            setTimeout(() => setToast(null), 3000);
                        });
                        e.target.reset();
                    }} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                        {[
                            { name: "assetId", label: "Asset ID", placeholder: "AST-001", icon: Hash },
                            { name: "metric", label: "Metric", placeholder: "temperature", icon: Thermometer },
                            { name: "value", label: "Threshold", placeholder: "75", type: "number", icon: Sliders },
                        ].map(f => {
                            const Icon = f.icon;
                            return (
                                <div key={f.name}>
                                    <label style={{ fontSize: 10, color: "#5B6B7D", display: "block", marginBottom: 3, display: "flex", alignItems: "center", gap: 4 }}>
                                        {Icon && <Icon size={12} />} {f.label}
                                    </label>
                                    <input
                                        name={f.name}
                                        type={f.type || "text"}
                                        placeholder={f.placeholder}
                                        required
                                        style={{ padding: "6px 10px", fontSize: 12, border: "1px solid #E2E8F0", borderRadius: 6, width: 120 }}
                                    />
                                </div>
                            );
                        })}
                        <button type="submit" style={{
                            padding: "6px 16px",
                            fontSize: 12,
                            fontWeight: 600,
                            background: "#5AA9E6",
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 4
                        }}>
                            <Save size={14} /> Save
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}