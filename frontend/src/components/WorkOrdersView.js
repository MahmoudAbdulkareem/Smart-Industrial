// frontend/src/components/WorkOrdersView.js
import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  RefreshCw, 
  FileSpreadsheet, 
  CheckCircle, 
  Clock, 
  Package, 
  XCircle, 
  Lock, 
  AlertCircle, 
  Zap, 
  Wrench, 
  Users, 
  MapPin, 
  Search, 
  Plus,
  Cloud,
  CloudOff,
  Database,
  Download,
  Upload,
  RefreshCcw,
  Eye,
  EyeOff,
  AlertTriangle,
  Check,
  X,
  Info,
  Trash2,
  Edit,
  MoreVertical,
  Calendar,
  Filter,
  Grid,
  List,
  Activity,
  Server,
  Wifi,
  WifiOff,
  HardDrive,
  Cpu,
  Thermometer,
  Gauge,
  BarChart3,
  PieChart,
  Layers,
  FolderOpen,
  FileText,
  Send,
  Inbox,
  ArrowUpRight,
  ArrowDownLeft,
  Maximize2,
  Minimize2,
  Settings,
  User,
  Briefcase,
  Tag,
  Hash,
  Link,
  ExternalLink,
  Copy,
  Clipboard,
  Printer,
  DownloadCloud,
  UploadCloud,
  RefreshCw as RefreshIcon,
  AlertOctagon,
  Bell,
  BellOff,
  Star,
  StarOff,
  Heart,
  HeartOff,
  Flag,
  FlagOff,
  PlusCircle,
  MinusCircle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronLeft,
  MoreHorizontal,
  MoreVertical as MoreVert
} from "lucide-react";
import { useApi } from "../hooks/useApi";
import { useSocket } from "../hooks/useSocket";
import CreateWorkOrderButton from "./CreateWorkOrderButton";
import WorkOrderSyncTrackerModal from "./WorkOrderSyncTrackerModal";

const API_BASE_URL = process.env.REACT_APP_API_URL || "";

const STATUS = {
    WAPPR: { label: "Waiting Approval", color: "#B4791F", bg: "#FDF3E2", border: "#F5D48A", icon: Clock },
    APPR:  { label: "Approved",         color: "#4A8FCB", bg: "#EAF4FC", border: "#BFE0F5", icon: CheckCircle },
    INPRG: { label: "In Progress",      color: "#0369a1", bg: "#EAF4FC", border: "#bae6fd", icon: RefreshCw },
    WMATL: { label: "Waiting Material", color: "#8B5CF6", bg: "#faf5ff", border: "#ddd6fe", icon: Package },
    COMP:  { label: "Complete",         color: "#0E9370", bg: "#E8F8F2", border: "#A8E6CC", icon: Check },
    CLOSE: { label: "Closed",           color: "#0E9370", bg: "#E8F8F2", border: "#A8E6CC", icon: Lock },
    CAN:   { label: "Cancelled",        color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb", icon: XCircle },
};

const STATUS_TRANSITIONS = {
    WAPPR: ["APPR", "CAN"],
    APPR:  ["INPRG", "WMATL", "CAN"],
    INPRG: ["WMATL", "COMP", "CAN"],
    WMATL: ["INPRG", "COMP", "CAN"],
    COMP:  ["CLOSE"],
    CLOSE: [],
    CAN:   [],
};

const ORIGIN = {
    AUTO_ML_PREDICTION:  { label: "Auto-ML",       bg: "#EAF4FC", color: "#0369a1", border: "#bae6fd", icon: Zap },
    MANUAL:              { label: "Manual",        bg: "#f1f5f9", color: "#475569", border: "#e2e8f0", icon: Wrench },
};

const SYNC_STYLES = {
    SYNCHRONIZED: { label: "Synchronized", bg: "#E8F8F2", color: "#0E9370", border: "#A8E6CC", icon: Check },
    PENDING_SYNC: { label: "Pending",      bg: "#FDF3E2", color: "#B4791F", border: "#F5D48A", icon: Clock },
    SYNC_FAILED:  { label: "Failed",       bg: "#FBEAEA", color: "#B23A3D", border: "#F3B7B8", icon: XCircle },
    NOT_CONFIGURED: { label: "Local Only", bg: "#F5F7FA", color: "#5B6B7D", border: "#e2e8f0", icon: Database },
};

function mapSyncStatus(rawStatus) {
    if (rawStatus === "SENT") return "SYNCHRONIZED";
    if (rawStatus === "FAILED") return "SYNC_FAILED";
    if (rawStatus === "PENDING") return "PENDING_SYNC";
    return "NOT_CONFIGURED";
}

function fmt(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
        " " + new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function authHeaders() {
    const token = localStorage.getItem("token");
    return { Authorization: token ? "Bearer " + token : "", "Content-Type": "application/json" };
}

function exportCSV(data, filename) {
    if (!data || !data.length) return;
    const keys = ["wonum", "assetName", "generateType", "status", "priority", "description", "reportedBy", "createdAt"];
    const csv = [keys.join(","), ...data.map(r => keys.map(k => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = filename + ".csv";
    a.click();
}

function ConnectionBadge({ status }) {
    if (!status) return null;
    if (!status.configured) {
        return (
            <div style={{ 
                background: "linear-gradient(135deg, #F5F7FA 0%, #f1f5f9 100%)", 
                border: "1px solid #e2e8f0", 
                borderRadius: 12, 
                padding: "10px 16px", 
                color: "#5B6B7D", 
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 8
            }}>
                <CloudOff size={16} />
                <span>Running in local-only mode — set <code style={{ background: "#e2e8f0", padding: "2px 6px", borderRadius: 4 }}>MAXIMO_BASE_URL</code> to connect</span>
            </div>
        );
    }
    if (status.connected) {
        return (
            <div style={{ 
                background: "linear-gradient(135deg, #E8F8F2 0%, #E8F8F2 100%)", 
                border: "1px solid #A8E6CC", 
                borderRadius: 12, 
                padding: "10px 16px", 
                color: "#0E9370", 
                fontSize: 12, 
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 8
            }}>
                <Cloud size={16} />
                <span>Connected to Maximo</span>
                <span style={{ 
                    fontSize: 10, 
                    background: "#0E9370", 
                    color: "white", 
                    padding: "2px 8px", 
                    borderRadius: 12,
                    fontWeight: 700
                }}>LIVE</span>
            </div>
        );
    }
    return (
        <div style={{ 
            background: "linear-gradient(135deg, #FBEAEA 0%, #FBEAEA 100%)", 
            border: "1px solid #F3B7B8", 
            borderRadius: 12, 
            padding: "10px 16px", 
            color: "#B23A3D", 
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 8
        }}>
            <AlertCircle size={16} />
            <span>Configured but unreachable: {status.error}</span>
        </div>
    );
}

function Toast({ message, type, onClose }) {
    const colors = {
        success: { bg: "linear-gradient(135deg, #E8F8F2 0%, #E8F8F2 100%)", border: "#A8E6CC", text: "#0E9370", icon: CheckCircle },
        error: { bg: "linear-gradient(135deg, #FBEAEA 0%, #FBEAEA 100%)", border: "#F3B7B8", text: "#B23A3D", icon: XCircle },
        info: { bg: "linear-gradient(135deg, #EAF4FC 0%, #dbeafe 100%)", border: "#BFE0F5", text: "#4A8FCB", icon: Info },
        warning: { bg: "linear-gradient(135deg, #FDF3E2 0%, #fef3c7 100%)", border: "#F5D48A", text: "#B4791F", icon: AlertTriangle },
    };

    const style = colors[type] || colors.info;
    const Icon = style.icon;

    useEffect(() => {
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div style={{
            position: "fixed",
            top: 20,
            right: 20,
            background: style.bg,
            border: `2px solid ${style.border}`,
            borderRadius: 12,
            padding: "14px 20px",
            color: style.text,
            fontSize: 13,
            zIndex: 9999,
            maxWidth: 420,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            animation: "slideIn 0.3s ease-out"
        }}>
            <Icon size={20} />
            <span style={{ flex: 1, fontWeight: 500 }}>{message}</span>
            <button onClick={onClose} style={{
                background: "none",
                border: "none",
                color: style.text,
                cursor: "pointer",
                fontSize: 18,
                opacity: 0.6,
                padding: "0 4px",
                transition: "opacity 0.2s"
            }}>×</button>
        </div>
    );
}

function StatCard({ icon: Icon, label, value, color, bg }) {
    return (
        <div style={{
            background: bg || "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: "16px 20px",
            flex: 1,
            minWidth: 120,
            display: "flex",
            alignItems: "center",
            gap: 14,
            transition: "all 0.2s",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
        }}>
            <div style={{
                width: 48,
                height: 48,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: bg || "#F5F7FA",
                borderRadius: 10
            }}>
                {Icon && <Icon size={24} color={color || "#0B0F14"} />}
            </div>
            <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: color || "#0B0F14" }}>{value || 0}</div>
                <div style={{ fontSize: 11, color: "#5B6B7D", fontWeight: 500 }}>{label}</div>
            </div>
        </div>
    );
}

export default function WorkOrdersView({ userRole }) {
    const { data: rawData, loading, error, refresh, setData } = useApi("/workorders", 30000);
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [originFilter, setOriginFilter] = useState("ALL");
    const [search, setSearch] = useState("");
    const [expanded, setExpanded] = useState(null);
    const [updating, setUpdating] = useState(null);
    const [toasts, setToasts] = useState([]);

    const [connection, setConnection] = useState(null);
    const [syncRows, setSyncRows] = useState([]);
    const [trackerOpen, setTrackerOpen] = useState(false);
    const [retryingId, setRetryingId] = useState(null);
    const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [lastSyncAt, setLastSyncAt] = useState(null);
    const [lastSyncResult, setLastSyncResult] = useState(null);
    const [metrics, setMetrics] = useState(null);

    const syncIntervalRef = useRef(null);
    const AUTO_SYNC_INTERVAL_MS = 7000;

    const canUpdate = userRole === "maintenance_engineer" || userRole === "it_admin";
    const canSync = userRole === "it_admin";

    const addToast = useCallback((message, type = "info") => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const fetchConnection = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/maximo/test-connection`, { headers: authHeaders() });
            setConnection(await res.json());
        } catch (e) {
            setConnection({ configured: false, error: e.message });
        }
    }, []);

    const fetchSyncRows = useCallback(async () => {
        if (!canSync) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/maximo/sync/recent?limit=200`, { headers: authHeaders() });
            if (!res.ok) return;
            const json = await res.json();
            setSyncRows(Array.isArray(json) ? json : []);
        } catch (e) {
            setSyncRows([]);
        }
    }, [canSync]);

    const fetchMetrics = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/workorders/metrics`, { headers: authHeaders() });
            if (res.ok) {
                const data = await res.json();
                setMetrics(data);
            } else {
                setMetrics(null);
            }
        } catch (e) {
            setMetrics(null);
        }
    }, []);

    const runAutoCycle = useCallback(async (showToast = false) => {
        if (!canSync || !connection?.configured) return;

        setSyncing(true);
        try {
            const results = {
                pulled: null,
                retried: null,
                assets: null
            };

            try {
                const pullRes = await fetch(`${API_BASE_URL}/api/maximo/sync/pull-status`, {
                    method: "POST",
                    headers: authHeaders(),
                });
                results.pulled = await pullRes.json();
            } catch (err) {
                results.pulled = { error: err.message };
            }

            try {
                const retryRes = await fetch(`${API_BASE_URL}/api/maximo/sync/retry`, {
                    method: "POST",
                    headers: authHeaders(),
                });
                results.retried = await retryRes.json();
            } catch (err) {
                results.retried = { error: err.message };
            }

            try {
                const assetRes = await fetch(`${API_BASE_URL}/api/maximo/sync-assets`, {
                    method: "POST",
                    headers: authHeaders(),
                });
                results.assets = await assetRes.json();
            } catch (err) {
                results.assets = { error: err.message };
            }

            setLastSyncResult(results);
            setLastSyncAt(new Date());

            if (showToast) {
                const changed = results.pulled?.updated || 0;
                const retried = results.retried?.sent || 0;
                const assetsUpdated = results.assets?.updated || 0;
                if (changed || retried || assetsUpdated) {
                    let msg = `Sync cycle:`;
                    if (changed) msg += ` ${changed} status change${changed === 1 ? "" : "s"} pulled,`;
                    if (retried) msg += ` ${retried} pending sync${retried === 1 ? "" : "s"} sent,`;
                    if (assetsUpdated) msg += ` ${assetsUpdated} assets refreshed`;
                    addToast(msg, "success");
                } else {
                    addToast("Sync cycle ran — nothing changed", "info");
                }
            }

            await refresh();
            await fetchSyncRows();
            await fetchMetrics();
        } catch (err) {
            setLastSyncResult({ error: err.message });
            if (showToast) addToast(`Sync cycle failed: ${err.message}`, "error");
        } finally {
            setSyncing(false);
        }
    }, [canSync, connection, refresh, addToast, fetchSyncRows, fetchMetrics]);

    useEffect(() => {
        if (!canSync || !autoSyncEnabled || !connection?.configured) return;

        const initialTimeout = setTimeout(() => runAutoCycle(false), 2000);
        syncIntervalRef.current = setInterval(() => runAutoCycle(false), AUTO_SYNC_INTERVAL_MS);

        return () => {
            clearTimeout(initialTimeout);
            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
        };
    }, [canSync, autoSyncEnabled, connection, runAutoCycle]);

    const fetchAllData = useCallback(() => {
        fetchConnection();
        fetchSyncRows();
        fetchMetrics();
    }, [fetchConnection, fetchSyncRows, fetchMetrics]);

    useEffect(() => { 
        fetchAllData(); 
    }, [fetchAllData]);

    useSocket({
        "workorder:created": (wo) => {
            if (!wo) return;
            setData(prev => Array.isArray(prev) ? [wo, ...prev] : [wo]);
            fetchSyncRows();
            fetchMetrics();
            addToast(`New work order created: ${wo.wonum}`, "success");
        },
        "workorder:updated": ({ id, status, oldStatus }) => {
            setData(prev => Array.isArray(prev) ? prev.map(w => w.id === id ? { ...w, status } : w) : prev);
            if (oldStatus && status !== oldStatus) {
                const wo = Array.isArray(rawData) ? rawData.find(w => w.id === id) : null;
                if (wo) {
                    addToast(`${wo.wonum}: ${oldStatus} → ${STATUS[status]?.label || status}`, "info");
                }
                fetchMetrics();
            }
        },
        "workorder:synced": ({ wonum, syncStatus }) => {
            setSyncRows(prev => [...prev, { 
                wonum, 
                syncStatus, 
                attemptedAt: new Date().toISOString(),
                entityType: "WORKORDER" 
            }]);
            if (syncStatus === "SENT") {
                addToast(`${wonum} synced to Maximo`, "success");
            } else if (syncStatus === "FAILED") {
                addToast(`${wonum} failed to sync to Maximo`, "error");
            }
        }
    });

    const syncByLocalId = {};
    for (const row of syncRows) {
        if (row.entityType !== "WORKORDER") continue;
        const existing = syncByLocalId[row.entityLocalId];
        if (!existing || new Date(row.attemptedAt) > new Date(existing.attemptedAt)) {
            syncByLocalId[row.entityLocalId] = row;
        }
    }

    async function updateStatus(e, wonum, newStatus) {
        e.stopPropagation();
        setUpdating(wonum + newStatus);
        try {
            const res = await fetch(`${API_BASE_URL}/api/workorders/${wonum}/status`, {
                method: "PATCH",
                headers: authHeaders(),
                body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) throw new Error(await res.text());
            const updated = await res.json();
            setData(prev => Array.isArray(prev) ? prev.map(w => w.wonum === wonum ? { ...w, status: updated.status } : w) : prev);
            addToast(`${wonum} status updated to ${STATUS[newStatus]?.label || newStatus}`, "success");
            fetchMetrics();
        } catch (err) {
            addToast(`Failed to update status: ${err.message}`, "error");
        } finally {
            setUpdating(null);
        }
    }

    async function retryRow(e, logId) {
        e.stopPropagation();
        setRetryingId(logId);
        try {
            const res = await fetch(`${API_BASE_URL}/api/maximo/sync/${logId}/retry`, { 
                method: "POST", 
                headers: authHeaders() 
            });
            const result = await res.json();
            if (result.sent) {
                addToast(`Retry successful`, "success");
            } else {
                addToast(`Retry failed: ${result.error || 'Unknown error'}`, "error");
            }
            await fetchSyncRows();
        } catch (err) {
            addToast(`Retry failed: ${err.message}`, "error");
        } finally {
            setRetryingId(null);
        }
    }

    const wos = Array.isArray(rawData) ? rawData : [];
    const counts = wos.reduce((a, w) => { a[w.status] = (a[w.status] || 0) + 1; return a; }, {});
    const syncCounts = wos.reduce((a, w) => {
        const key = canSync ? mapSyncStatus(syncByLocalId[w.id]?.syncStatus) : "NOT_CONFIGURED";
        a[key] = (a[key] || 0) + 1;
        return a;
    }, {});

    const shown = wos.filter(w => {
        const ms = statusFilter === "ALL" || w.status === statusFilter;
        const mo = originFilter === "ALL" || (w.generateType || "MANUAL") === originFilter;
        const mq = !search || [w.wonum, w.assetName, w.assetId, w.description, w.reportedBy]
            .some(v => (v || "").toLowerCase().includes(search.toLowerCase()));
        return ms && mo && mq;
    });

    if (loading) return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", 
                gap: 12 
            }}>
                {[...Array(4)].map((_, i) => (
                    <div key={i} style={{ 
                        background: "#F5F7FA", 
                        border: "1px solid #e2e8f0", 
                        borderRadius: 12, 
                        height: 80,
                        animation: `pulse 1.4s ease-in-out ${i * 0.15}s infinite` 
                    }} />
                ))}
            </div>
            {[...Array(3)].map((_, i) => (
                <div key={i} style={{ 
                    background: "#F5F7FA", 
                    border: "1px solid #e2e8f0", 
                    borderRadius: 12, 
                    height: 64,
                    animation: `pulse 1.4s ease-in-out ${i * 0.1}s infinite` 
                }} />
            ))}
        </div>
    );
    if (error) return (
        <div style={{ 
            background: "#FBEAEA", 
            border: "1px solid #F3B7B8", 
            borderRadius: 12, 
            padding: "20px 24px",
            color: "#B23A3D",
            display: "flex",
            alignItems: "center",
            gap: 12
        }}>
            <XCircle size={24} />
            <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Error Loading Work Orders</div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>{error}</div>
            </div>
        </div>
    );

    return (
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <style>{`
                @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
                @keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
                @keyframes fadeIn{from{opacity:0}to{opacity:1}}
                @keyframes pulseDot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}
                @keyframes spin{to{transform:rotate(360deg)}}
            `}</style>

            {toasts.map(toast => (
                <Toast 
                    key={toast.id} 
                    message={toast.message} 
                    type={toast.type} 
                    onClose={() => removeToast(toast.id)} 
                />
            ))}

            {/* Header */}
            <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 20,
                flexWrap: "wrap",
                gap: 12
            }}>
                <div>
                    <h2 style={{ 
                        fontSize: 22, 
                        fontWeight: 800, 
                        color: "#0B0F14",
                        margin: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: 10
                    }}>
                        <FolderOpen size={24} color="#5AA9E6" />
                        <span>Work Orders</span>
                        <span style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#5B6B7D",
                            background: "#f1f5f9",
                            padding: "2px 10px",
                            borderRadius: 20
                        }}>
                            {wos.length} total
                        </span>
                    </h2>
                    <p style={{ 
                        fontSize: 13, 
                        color: "#5B6B7D", 
                        margin: "4px 0 0 0",
                    }}>
                        Auto-generated &amp; manual work orders, kept in sync with IBM Maximo
                    </p>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {canSync && connection?.configured && (
                        <button
                            onClick={() => setAutoSyncEnabled(v => !v)}
                            title={autoSyncEnabled ? "Live sync running — click to pause" : "Live sync paused — click to resume"}
                            style={{
                                display: "flex", alignItems: "center", gap: 7,
                                padding: "7px 12px", borderRadius: 20,
                                border: `1px solid ${autoSyncEnabled ? "#A8E6CC" : "#e2e8f0"}`,
                                background: autoSyncEnabled ? "#E8F8F2" : "#F5F7FA",
                                cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, fontWeight: 600,
                                color: autoSyncEnabled ? "#0E9370" : "#5B6B7D",
                            }}
                        >
                            <span style={{
                                width: 7, height: 7, borderRadius: "50%",
                                background: autoSyncEnabled ? "#12B886" : "#94a3b8",
                                animation: autoSyncEnabled && syncing ? "pulseDot 1s ease-in-out infinite" : "none",
                                flexShrink: 0,
                            }} />
                            <RefreshCcw size={14} />
                            {autoSyncEnabled ? (syncing ? "Syncing…" : "Live sync") : "Paused"}
                            {lastSyncAt && <span style={{ opacity: 0.65, fontWeight: 500 }}>· {fmt(lastSyncAt)}</span>}
                        </button>
                    )}

                    <ConnectionBadge status={connection} />

                    {canSync && (
                        <button onClick={() => setTrackerOpen(true)} title="Sync Log Tracker" aria-label="Sync Log Tracker" style={{
                            width: 38, height: 38, padding: 0,
                            background: "#fff", color: "#5B6B7D", border: "1px solid #e2e8f0",
                            borderRadius: "50%", cursor: "pointer", fontFamily: "inherit",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.15s"
                        }}>
                            <Database size={18} />
                        </button>
                    )}

                    <CreateWorkOrderButton onCreated={() => { 
                        refresh(); 
                        fetchSyncRows(); 
                        fetchConnection();
                        fetchMetrics();
                        addToast("Work order created successfully", "success");
                    }} />
                </div>
            </div>

            {/* Stats Cards */}
            <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", 
                gap: 12,
                marginBottom: 12
            }}>
                <StatCard 
                    icon={List}
                    label="Total" 
                    value={wos.length} 
                    color="#0B0F14"
                    bg="#F5F7FA"
                />
                <StatCard 
                    icon={Clock}
                    label="Waiting Approval" 
                    value={counts.WAPPR || 0}
                    color="#B4791F"
                    bg="#FDF3E2"
                />
                <StatCard 
                    icon={RefreshCw}
                    label="In Progress" 
                    value={counts.INPRG || 0}
                    color="#0369a1"
                    bg="#EAF4FC"
                />
                <StatCard 
                    icon={CheckCircle}
                    label="Completed" 
                    value={(counts.COMP || 0) + (counts.CLOSE || 0)}
                    color="#0E9370"
                    bg="#E8F8F2"
                />
            </div>

            {/* Sync Stats */}
            {canSync && (
                <div style={{ 
                    display: "grid", 
                    gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", 
                    gap: 10,
                    marginBottom: 20,
                    padding: "12px 16px",
                    background: "#F5F7FA",
                    borderRadius: 12,
                    border: "1px solid #e2e8f0"
                }}>
                    {["SYNCHRONIZED", "PENDING_SYNC", "SYNC_FAILED"].map(key => {
                        const s = SYNC_STYLES[key];
                        const Icon = s.icon;
                        return (
                            <div key={key} style={{ 
                                display: "flex", 
                                alignItems: "center", 
                                gap: 8,
                                padding: "4px 8px",
                                borderRadius: 8,
                                background: s.bg,
                                border: `1px solid ${s.border}`
                            }}>
                                <Icon size={20} color={s.color} />
                                <div>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: s.color, lineHeight: 1.2 }}>
                                        {syncCounts[key] || 0}
                                    </div>
                                    <div style={{ fontSize: 10, color: s.color, fontWeight: 600 }}>
                                        {s.label}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {lastSyncResult?.error && (
                <div style={{ 
                    marginBottom: 14, 
                    fontSize: 12, 
                    padding: "10px 16px", 
                    borderRadius: 8,
                    color: "#B23A3D",
                    background: "#FBEAEA",
                    border: "1px solid #F3B7B8",
                    display: "flex",
                    alignItems: "center",
                    gap: 8
                }}>
                    <XCircle size={16} />
                    Last sync cycle failed: {lastSyncResult.error}
                </div>
            )}

            {/* Filters */}
            <div style={{ 
                display: "flex", 
                gap: 8, 
                flexWrap: "wrap", 
                marginBottom: 12,
                alignItems: "center"
            }}>
                <Filter size={14} color="#5B6B7D" />
                <span style={{ fontSize: 11, color: "#5B6B7D", fontWeight: 600 }}>Status:</span>
                <button onClick={() => setStatusFilter("ALL")} style={{
                    fontSize: 11, 
                    fontWeight: 600, 
                    padding: "4px 14px", 
                    borderRadius: 20, 
                    cursor: "pointer",
                    fontFamily: "inherit", 
                    border: "1px solid #E2E8F0",
                    background: statusFilter === "ALL" ? "#0B0F14" : "#fff",
                    color: statusFilter === "ALL" ? "#fff" : "#5B6B7D",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    gap: 4
                }}>
                    <Layers size={12} /> All
                </button>
                {Object.entries(STATUS).map(([k, s]) => counts[k] ? (
                    <button key={k} onClick={() => setStatusFilter(statusFilter === k ? "ALL" : k)} style={{
                        fontSize: 11, 
                        fontWeight: 600, 
                        padding: "4px 14px", 
                        borderRadius: 20, 
                        cursor: "pointer",
                        fontFamily: "inherit", 
                        border: `1px solid ${s.border}`, 
                        background: statusFilter === k ? s.bg : "#fff",
                        color: statusFilter === k ? s.color : "#5B6B7D",
                        outline: statusFilter === k ? `2px solid ${s.color}` : "none", 
                        outlineOffset: 2,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        transition: "all 0.2s"
                    }}>
                        {s.icon && <s.icon size={12} />}
                        {counts[k]} {s.label}
                    </button>
                ) : null)}
            </div>

            <div style={{ 
                display: "flex", 
                gap: 8, 
                flexWrap: "wrap", 
                marginBottom: 16,
                alignItems: "center"
            }}>
                <span style={{ fontSize: 11, color: "#5B6B7D", fontWeight: 600 }}>Origin:</span>
                {["ALL", ...Object.keys(ORIGIN)].map(k => {
                    const s = k === "ALL" ? null : ORIGIN[k];
                    const active = originFilter === k;
                    const Icon = s?.icon;
                    return (
                        <button key={k} onClick={() => setOriginFilter(active ? "ALL" : k)} style={{
                            fontSize: 10, 
                            fontWeight: 700, 
                            padding: "4px 12px", 
                            borderRadius: 20, 
                            cursor: "pointer",
                            fontFamily: "inherit", 
                            border: `1px solid ${s ? s.border : "#E2E8F0"}`,
                            background: active ? (s ? s.bg : "#0B0F14") : "#fff",
                            color: active ? (s ? s.color : "#fff") : "#8493A6",
                            transition: "all 0.2s",
                            display: "flex",
                            alignItems: "center",
                            gap: 4
                        }}>
                            {Icon && <Icon size={12} />} {k === "ALL" ? "All origins" : s.label}
                        </button>
                    );
                })}
            </div>

            {/* Search & Actions */}
            <div style={{ 
                display: "flex", 
                gap: 10, 
                marginBottom: 16, 
                flexWrap: "wrap", 
                alignItems: "center" 
            }}>
                <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
                    <Search size={16} style={{ 
                        position: "absolute", 
                        left: 12, 
                        top: "50%", 
                        transform: "translateY(-50%)",
                        color: "#8493A6"
                    }} />
                    <input 
                        value={search} 
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search WO#, asset, description..."
                        style={{ 
                            padding: "8px 12px 8px 36px", 
                            fontSize: 13, 
                            border: "1px solid #E2E8F0", 
                            borderRadius: 8, 
                            fontFamily: "inherit", 
                            width: "100%", 
                            outline: "none",
                            background: "#fff",
                            transition: "border-color 0.2s"
                        }}
                        onFocus={e => e.target.style.borderColor = "#5AA9E6"}
                        onBlur={e => e.target.style.borderColor = "#E2E8F0"}
                    />
                </div>
                <button onClick={refresh} style={{ 
                    padding: "8px 16px", 
                    fontSize: 12, 
                    border: "1px solid #E2E8F0", 
                    background: "#fff", 
                    borderRadius: 8, 
                    cursor: "pointer", 
                    fontFamily: "inherit",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    transition: "all 0.2s"
                }}>
                    <RefreshCw size={14} /> Refresh
                </button>
                <button onClick={() => exportCSV(shown, "work_orders")} style={{ 
                    padding: "8px 16px", 
                    fontSize: 12, 
                    border: "1px solid #0E937040", 
                    background: "#E8F8F2", 
                    color: "#0E9370", 
                    borderRadius: 8, 
                    cursor: "pointer", 
                    fontFamily: "inherit", 
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    transition: "all 0.2s"
                }}>
                    <FileSpreadsheet size={14} /> Export CSV
                </button>
                <span style={{ 
                    fontSize: 12, 
                    color: "#8493A6",
                    marginLeft: "auto"
                }}>
                    Showing {shown.length} of {wos.length} work orders
                </span>
            </div>

            {/* Work Order List */}
            {shown.length === 0 ? (
                <div style={{ 
                    background: "linear-gradient(135deg, #F5F7FA 0%, #f1f5f9 100%)", 
                    border: "2px dashed #E2E8F0", 
                    borderRadius: 16, 
                    padding: "48px 20px", 
                    textAlign: "center", 
                    color: "#8493A6",
                    fontSize: 14
                }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>{wos.length === 0 ? "📭" : "🔍"}</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#5B6B7D" }}>
                        {wos.length === 0
                            ? "No work orders yet"
                            : "No work orders match the current filter"}
                    </div>
                    <p style={{ fontSize: 13, marginTop: 8 }}>
                        {wos.length === 0
                            ? "Critical assets and high-risk ML predictions raise them automatically, or create one manually above."
                            : "Try adjusting your filters or search terms above."}
                    </p>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {shown.map(wo => {
                        const s = STATUS[wo.status] || STATUS.WAPPR;
                        const origin = ORIGIN[wo.generateType] || ORIGIN.MANUAL;
                        const open = expanded === wo.id;
                        const transitions = STATUS_TRANSITIONS[wo.status] || [];
                        const syncRow = syncByLocalId[wo.id];
                        const syncKey = canSync ? mapSyncStatus(syncRow?.syncStatus) : "NOT_CONFIGURED";
                        const syncStyle = SYNC_STYLES[syncKey];
                        const StatusIcon = s.icon;
                        const OriginIcon = origin.icon;
                        const SyncIcon = syncStyle.icon;

                        return (
                            <div 
                                key={wo.id || wo.wonum} 
                                style={{ 
                                    background: "#fff", 
                                    border: `1px solid ${open ? s.border : "#e2e8f0"}`, 
                                    borderLeft: `4px solid ${s.color}`, 
                                    borderRadius: 12, 
                                    overflow: "hidden",
                                    transition: "all 0.2s",
                                    boxShadow: open ? "0 4px 12px rgba(0,0,0,0.06)" : "none"
                                }}
                            >
                                <div 
                                    onClick={() => setExpanded(open ? null : wo.id)} 
                                    style={{ 
                                        padding: "12px 16px", 
                                        cursor: "pointer", 
                                        display: "flex", 
                                        alignItems: "center", 
                                        gap: 10, 
                                        flexWrap: "wrap",
                                        transition: "background 0.2s"
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = "#F5F7FA"}
                                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                >
                                    <span style={{ 
                                        fontSize: 13, 
                                        fontWeight: 700, 
                                        color: "#0B0F14", 
                                        fontFamily: "'IBM Plex Mono', monospace",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 6
                                    }}>
                                        <Hash size={14} color="#8493A6" />
                                        {wo.wonum}
                                    </span>
                                    <span style={{ 
                                        fontSize: 10, 
                                        fontWeight: 700, 
                                        padding: "2px 10px", 
                                        borderRadius: 20, 
                                        background: origin.bg, 
                                        color: origin.color, 
                                        border: `1px solid ${origin.border}`,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 4
                                    }}>
                                        <OriginIcon size={12} /> {origin.label}
                                    </span>
                                    <span style={{ 
                                        fontSize: 11, 
                                        fontWeight: 600, 
                                        padding: "3px 12px", 
                                        borderRadius: 20, 
                                        background: s.bg, 
                                        color: s.color, 
                                        border: `1px solid ${s.border}`,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 4
                                    }}>
                                        <StatusIcon size={12} /> {s.label}
                                    </span>
                                    <span style={{ 
                                        fontSize: 11, 
                                        padding: "3px 10px", 
                                        borderRadius: 6, 
                                        background: "#F5F7FA", 
                                        color: "#374151", 
                                        border: "1px solid #e2e8f0",
                                        maxWidth: 150,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 4
                                    }}>
                                        <Wrench size={12} color="#8493A6" />
                                        {wo.assetName || wo.assetnum || "No Asset"}
                                    </span>
                                    {canSync && (
                                        <span style={{ 
                                            fontSize: 10, 
                                            fontWeight: 700, 
                                            padding: "2px 10px", 
                                            borderRadius: 20, 
                                            background: syncStyle.bg, 
                                            color: syncStyle.color, 
                                            border: `1px solid ${syncStyle.border}`,
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 4
                                        }}>
                                            <SyncIcon size={12} /> {syncStyle.label}
                                        </span>
                                    )}
                                    <span style={{ 
                                        fontSize: 11, 
                                        color: "#8493A6", 
                                        marginLeft: "auto",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 6
                                    }}>
                                        <Calendar size={14} />
                                        {fmt(wo.createdAt)}
                                        <ChevronDown size={16} style={{ 
                                            transition: "transform 0.2s",
                                            transform: open ? "rotate(180deg)" : "none"
                                        }} />
                                    </span>
                                </div>

                                {open && (
                                    <div style={{ 
                                        padding: "0 16px 16px 16px", 
                                        borderTop: "1px solid #F5F7FA",
                                        animation: "fadeIn 0.2s ease-out"
                                    }}>
                                        <div style={{ 
                                            marginTop: 12, 
                                            padding: "12px 16px", 
                                            background: "#F5F7FA", 
                                            borderRadius: 8, 
                                            fontSize: 13, 
                                            color: "#374151", 
                                            lineHeight: 1.6, 
                                            border: "1px solid #e2e8f0",
                                            display: "flex",
                                            alignItems: "flex-start",
                                            gap: 8
                                        }}>
                                            <FileText size={16} color="#8493A6" style={{ marginTop: 2 }} />
                                            {wo.description || "No description provided"}
                                        </div>

                                        <div style={{ 
                                            display: "grid", 
                                            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", 
                                            gap: 12, 
                                            marginTop: 12, 
                                            fontSize: 12, 
                                            color: "#5B6B7D" 
                                        }}>
                                            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                                <AlertCircle size={14} /> Priority: <strong style={{ color: "#0B0F14" }}>{wo.priority || "—"}</strong>
                                            </span>
                                            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                                <Users size={14} /> Reported by: <strong style={{ color: "#0B0F14" }}>{wo.reportedBy || "—"}</strong>
                                            </span>
                                            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                                <Tag size={14} /> Asset #: <strong style={{ color: "#0B0F14" }}>{wo.assetnum || "—"}</strong>
                                            </span>
                                            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                                <MapPin size={14} /> Site: <strong style={{ color: "#0B0F14" }}>{wo.siteid || "—"}</strong>
                                            </span>
                                        </div>

                                        {canSync && (
                                            <div style={{ 
                                                marginTop: 12, 
                                                display: "flex", 
                                                gap: 10, 
                                                alignItems: "center", 
                                                flexWrap: "wrap",
                                                padding: "8px 12px",
                                                background: "#F5F7FA",
                                                borderRadius: 8,
                                                border: "1px solid #e2e8f0"
                                            }}>
                                                <Cloud size={14} color="#5B6B7D" />
                                                <span style={{ fontSize: 11, color: "#5B6B7D" }}>
                                                    Maximo sync: <strong style={{ color: syncStyle.color }}>{syncStyle.label}</strong>
                                                    {syncRow?.attemptedAt && <> · last attempt {fmt(syncRow.attemptedAt)}</>}
                                                </span>
                                                {syncRow && syncKey !== "SYNCHRONIZED" && (
                                                    <button 
                                                        disabled={retryingId === syncRow.id} 
                                                        onClick={e => retryRow(e, syncRow.id)} 
                                                        style={{
                                                            fontSize: 11, 
                                                            fontWeight: 600, 
                                                            padding: "4px 14px", 
                                                            borderRadius: 20, 
                                                            cursor: retryingId === syncRow.id ? "default" : "pointer",
                                                            border: "1px solid #BFE0F5", 
                                                            background: retryingId === syncRow.id ? "#e2e8f0" : "#EAF4FC", 
                                                            color: retryingId === syncRow.id ? "#94a3b8" : "#4A8FCB", 
                                                            fontFamily: "inherit",
                                                            transition: "all 0.2s",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: 4
                                                        }}
                                                    >
                                                        <RefreshCcw size={12} />
                                                        {retryingId === syncRow.id ? "Retrying…" : "Retry Sync"}
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {canUpdate && transitions.length > 0 && (
                                            <div style={{ 
                                                marginTop: 12, 
                                                display: "flex", 
                                                gap: 6, 
                                                flexWrap: "wrap", 
                                                alignItems: "center",
                                                padding: "8px 12px",
                                                background: "#F5F7FA",
                                                borderRadius: 8,
                                                border: "1px solid #e2e8f0"
                                            }}>
                                                <RefreshCw size={14} color="#5B6B7D" />
                                                <span style={{ fontSize: 11, color: "#5B6B7D", fontWeight: 500 }}>Move to:</span>
                                                {transitions.map(nextStatus => {
                                                    const ns = STATUS[nextStatus];
                                                    const busy = updating === (wo.wonum + nextStatus);
                                                    const NextIcon = ns.icon;
                                                    return (
                                                        <button 
                                                            key={nextStatus} 
                                                            disabled={!!updating} 
                                                            onClick={e => updateStatus(e, wo.wonum, nextStatus)} 
                                                            style={{
                                                                fontSize: 11, 
                                                                fontWeight: 600, 
                                                                padding: "4px 14px", 
                                                                borderRadius: 20,
                                                                cursor: updating ? "not-allowed" : "pointer",
                                                                border: `1px solid ${ns.border}`, 
                                                                background: busy ? ns.border : ns.bg,
                                                                color: ns.color, 
                                                                fontFamily: "inherit", 
                                                                opacity: updating && !busy ? 0.5 : 1,
                                                                transition: "all 0.2s",
                                                                display: "flex",
                                                                alignItems: "center",
                                                                gap: 4
                                                            }}
                                                        >
                                                            {busy ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <NextIcon size={12} />}
                                                            {ns.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {(wo.status === "COMP" || wo.status === "CAN") && (
                                            <div style={{ 
                                                marginTop: 12, 
                                                fontSize: 12, 
                                                color: "#5B6B7D",
                                                padding: "8px 12px",
                                                background: wo.status === "COMP" ? "#E8F8F2" : "#f9fafb",
                                                borderRadius: 8,
                                                border: `1px solid ${wo.status === "COMP" ? "#A8E6CC" : "#e5e7eb"}`,
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 8
                                            }}>
                                                {wo.status === "COMP" ? <CheckCircle size={16} color="#0E9370" /> : <XCircle size={16} color="#6b7280" />}
                                                {wo.status === "COMP" ? "Work order completed" : "Work order cancelled"}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <WorkOrderSyncTrackerModal
                open={trackerOpen}
                onClose={() => setTrackerOpen(false)}
                onToast={addToast}
            />
        </div>
    );
}