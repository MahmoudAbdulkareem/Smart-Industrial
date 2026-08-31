// App.js
import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import {
    LayoutDashboard, HeartPulse, Zap, ClipboardList, AlertTriangle, Users, ScrollText,
    Radio, MessageSquare, Brain, CalendarClock, FlaskConical, Boxes,
    ChevronLeft, ChevronRight, ChevronDown, LogOut, Globe, Wifi, WifiOff, Gauge, Siren,
} from "lucide-react";
import Login          from "./components/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import KpiCards       from "./components/KpiCards";
import HealthView     from "./components/HealthView";
import EnergyView     from "./components/EnergyView";
import AlertsPanel    from "./components/AlertsPanel";
import UserManagement from "./components/UserManagement";
import AuditLogView   from "./components/AuditLogView";
import WorkOrdersView from "./components/WorkOrdersView";
import MqttMonitorView from "./components/MqttMonitorView";
import MLDashboardView from "./components/MLDashboardView";
import ChatWidget from "./components/ChatWidget";
import PredictiveCalendar from "./components/PredictiveCalendar";
import AnomalyPlayground from "./components/AnomalyPlayground";
import MaximoStatusPill from "./components/shell/MaximoStatusPill";
import PulseRibbon from "./components/shell/PulseRibbon";
import FailureInjectorDrawer from "./components/shell/FailureInjectorDrawer";
import { useFleetPulse } from "./hooks/useFleetPulse";
import { useAudibleAlarm } from "./hooks/useAudibleAlarm";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";
import { SocketProvider } from "./context/SocketContext";

const ROLE_NAV = {
    maintenance_engineer: ["kpis", "health", "workorders", "alerts", "mqtt", "ml", "calendar"],
    energy_manager: ["kpis", "energy", "alerts", "mqtt", "ml", "calendar"],
    it_admin: ["kpis", "health", "energy", "workorders", "alerts", "user", "audit", "mqtt", "ml", "calendar", "anomaly"],
};

const NAV_ICON = {
    kpis: LayoutDashboard, health: HeartPulse, energy: Zap, workorders: ClipboardList,
    alerts: AlertTriangle, user: Users, audit: ScrollText, mqtt: Radio,
    ml: Brain, calendar: CalendarClock, anomaly: FlaskConical,
};

const NAV_GROUPS = [
    { title: "Dashboard", itemIds: ["kpis", "health", "energy"] },
    { title: "Maintenance", itemIds: ["workorders", "alerts", "calendar"] },
    { title: "AI & Analytics", itemIds: ["ml", "anomaly"] },
    { title: "Management", itemIds: ["user", "audit", "mqtt"] },
];

function Clock() {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);
    const date = now.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
    const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return (
        <div className="text-right leading-tight">
            <div className="text-sm font-semibold text-ink font-mono tabular-nums">{time}</div>
            <div className="text-[11px] text-ink-dim">{date}</div>
        </div>
    );
}

function StatusPill({ icon, label, tone = "info" }) {
    const toneClasses = {
        normal: "bg-status-normal/10 text-status-normal border-status-normal/30",
        elevated: "bg-status-elevated/10 text-status-elevated border-status-elevated/30",
        critical: "bg-status-critical/10 text-status-critical border-status-critical/30",
        info: "bg-status-info/10 text-status-info border-status-info/30",
    };
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium font-mono ${toneClasses[tone]}`}>
            {icon}{label}
        </span>
    );
}

function SystemStatusBar() {
    const { isConnected, globalHealth, activeAlerts, lastMessageAt, history } = useFleetPulse();

    const secondsSince = lastMessageAt ? Math.max(0, Math.round((Date.now() - lastMessageAt) / 1000)) : null;
    const healthTone = globalHealth == null ? "info" : globalHealth >= 80 ? "normal" : globalHealth >= 50 ? "elevated" : "critical";
    const ribbonTone = healthTone === "info" ? "normal" : healthTone;

    return (
        <div className="border-b border-surface-line bg-surface-panel">
            <div className="flex items-center justify-between px-8 py-2 flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                    <StatusPill
                        icon={isConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
                        label={isConnected ? `MQTT Broker: LIVE${secondsSince != null ? ` \u00b7 ${secondsSince}s ago` : ""}` : "MQTT Broker: OFFLINE"}
                        tone={isConnected ? "normal" : "critical"}
                    />
                    <MaximoStatusPill />
                    <StatusPill
                        icon={<Gauge size={13} />}
                        label={globalHealth == null ? "Fleet Health: awaiting data" : `Fleet Health: ${globalHealth.toFixed(1)}%`}
                        tone={healthTone}
                    />
                    <StatusPill
                        icon={<AlertTriangle size={13} />}
                        label={`Active Alerts: ${activeAlerts}`}
                        tone={activeAlerts > 0 ? "critical" : "normal"}
                    />
                </div>
            </div>
            <PulseRibbon history={history} tone={ribbonTone} />
        </div>
    );
}

function Dashboard() {
    const navigate = useNavigate();
    const { t, language, setLanguage } = useLanguage();
    const [user] = useState(() => {
        try {
            const userData = localStorage.getItem("user");
            return userData ? JSON.parse(userData) : null;
        } catch {
            return null;
        }
    });
    const [tab, setTab] = useState("kpis");
    const [sideOpen, setSideOpen] = useState(true);
    const [injectorOpen, setInjectorOpen] = useState(false);
    const { enabled: alarmEnabled, setEnabled: setAlarmEnabled } = useAudibleAlarm();
    const [openGroups, setOpenGroups] = useState({
        "Dashboard": true, "Maintenance": true, "AI & Analytics": true, "Management": true,
    });

    if (!user) return <Navigate to="/login" replace />;

    const navItems = ROLE_NAV[user.role] || [];
    const groupedItemIds = NAV_GROUPS.flatMap((g) => g.itemIds);
    const remainingItems = navItems.filter((id) => !groupedItemIds.includes(id));

    const navLabels = {
        kpis: t("kpiOverview"), health: t("healthView"), energy: t("energyView"), alerts: t("alerts"),
        workorders: "Work Orders & Maximo Sync", user: t("userManagement"), audit: "Audit Log",
        mqtt: "MQTT Monitor", ml: "ML Dashboard", calendar: "Maintenance Calendar",
        anomaly: "Anomaly Playground",
    };
    const navDescs = {
        kpis: "Summary of all asset and energy KPIs.",
        health: "Asset health scores, RUL, MTBF, and live sensor readings.",
        energy: "Energy consumption vs baseline, PUE, EER, and CO2.",
        alerts: "Active predictive alerts and acknowledged notifications.",
        workorders: "Auto-generated & manual work orders with live IBM Maximo sync.",
        user: "Manage user accounts and permissions.",
        audit: "Full history of user actions and system events.",
        mqtt: "Monitor MQTT messages and connections.",
        ml: "Isolation Forest anomaly detection & RUL predictions.",
        calendar: "AI-powered predictive maintenance scheduling calendar.",
        anomaly: "Interactive ML model training with explainable AI.",
    };
    const roleLabels = {
        maintenance_engineer: t("maintenanceEngineer"), energy_manager: t("energyManager"), it_admin: t("itAdmin"),
    };
    const roleTone = {
        maintenance_engineer: "bg-status-info/10 text-status-info",
        energy_manager: "bg-status-normal/10 text-status-normal",
        it_admin: "bg-purple-500/10 text-purple-600",
    };

    function logout() {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
    }

    const rc = roleTone[user.role] || "bg-surface-line text-ink-dim";

    const currentUser = {
        id: user.id || user._id || "user-" + Date.now(),
        name: user.name, email: user.email, role: user.role,
    };

    return (
        <div className="flex min-h-screen bg-surface font-sans">
            {/* Sidebar */}
            <aside
                className={`flex-shrink-0 bg-base flex flex-col sticky top-0 h-screen overflow-hidden shadow-panel transition-[width] duration-200 ${sideOpen ? "w-[240px]" : "w-[64px]"}`}
            >
                <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5">
                    <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-status-info to-blue-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
  <img 
    src="/smart.png" 
    alt="Smart Industrial" 
    className="w-full h-full object-cover" 
  />
</div>
                    {sideOpen && (
                        <div className="overflow-hidden whitespace-nowrap">
                            <div className="text-sm font-extrabold text-ink-inverted tracking-tight">Smart Industrial</div>
                            <div className="text-[9px] text-ink-invertedDim uppercase tracking-wider">Industrial 4.0 Platform</div>
                        </div>
                    )}
                </div>

                <nav className="px-2.5 py-3 flex-1 overflow-y-auto scroll-thin">
                    {NAV_GROUPS.map((group) => {
                        const visibleIds = group.itemIds.filter((id) => navItems.includes(id));
                        if (!visibleIds.length) return null;
                        const headerActive = visibleIds.includes(tab);
                        const open = openGroups[group.title];
                        return (
                            <div key={group.title} className="mb-2">
                                <button
                                    onClick={() => setOpenGroups((prev) => ({ ...prev, [group.title]: !prev[group.title] }))}
                                    className={`w-full flex items-center justify-between rounded-lg mb-0.5 font-bold text-[11px] uppercase tracking-wider transition-colors ${sideOpen ? "px-3 py-2" : "px-2.5 py-2"} ${headerActive ? "bg-status-info/15 text-status-info" : "text-ink-invertedDim hover:text-ink-inverted"}`}
                                >
                                    {sideOpen ? group.title : group.title.charAt(0)}
                                    <ChevronDown size={12} className={`transition-transform ${open ? "rotate-0" : "-rotate-90"}`} />
                                </button>
                                {open && visibleIds.map((id) => {
                                    const Icon = NAV_ICON[id];
                                    const isActive = tab === id;
                                    return (
                                        <button
                                            key={id}
                                            onClick={() => setTab(id)}
                                            title={!sideOpen ? navLabels[id] : ""}
                                            className={`w-full flex items-center gap-2.5 rounded-lg mb-0.5 text-[13px] transition-colors relative ${sideOpen ? "px-4 py-2 justify-start" : "px-2.5 py-2 justify-center"} ${isActive ? "bg-status-info/20 text-white font-semibold" : "text-ink-invertedDim hover:bg-white/5 hover:text-ink-inverted font-normal"}`}
                                        >
                                            <Icon size={16} className="flex-shrink-0" />
                                            {sideOpen && <span className="overflow-hidden whitespace-nowrap">{navLabels[id]}</span>}
                                            {isActive && sideOpen && <span className="ml-auto w-1 h-6 rounded bg-status-info flex-shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })}
                    {remainingItems.map((id) => {
                        const Icon = NAV_ICON[id];
                        const isActive = tab === id;
                        return (
                            <button
                                key={id}
                                onClick={() => setTab(id)}
                                className={`w-full flex items-center gap-2.5 rounded-lg mb-0.5 text-[13px] ${sideOpen ? "px-4 py-2" : "px-2.5 py-2 justify-center"} ${isActive ? "bg-status-info/20 text-white font-semibold" : "text-ink-invertedDim hover:bg-white/5"}`}
                            >
                                <Icon size={16} />
                                {sideOpen && navLabels[id]}
                            </button>
                        );
                    })}
                </nav>

                <div className="p-2.5 border-t border-white/5">
                    <button
                        onClick={() => setSideOpen((v) => !v)}
                        className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-ink-invertedDim hover:text-ink-inverted text-xs py-2 transition-colors"
                    >
                        {sideOpen ? <><ChevronLeft size={14} /><span>{t("collapse")}</span></> : <ChevronRight size={14} />}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                <header className="bg-surface-panel border-b border-surface-line px-8 h-16 flex items-center justify-between sticky top-0 z-50 shadow-sm">
                    <div>
                        <h1 className="text-lg font-bold text-ink tracking-tight">{navLabels[tab] || tab}</h1>
                        <p className="text-xs text-ink-dim mt-0.5">{navDescs[tab] || ""}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <Clock />
                      
                        <button
                            onClick={() => setLanguage(language === "en" ? "fr" : "en")}
                            className="flex items-center gap-1.5 px-3.5 py-1 text-[11px] font-bold border border-surface-line rounded-full bg-surface hover:bg-status-info hover:text-white hover:border-status-info text-status-info transition-colors"
                        >
                            <Globe size={12} />{language === "en" ? "FR" : "EN"}
                        </button>
                        <div className="w-px h-8 bg-surface-line" />
                        <div className="text-right">
                            <div className="text-sm font-semibold text-ink">{user.name}</div>
                            <span className={`inline-block text-[10px] font-semibold px-3 py-0.5 rounded-full mt-0.5 ${rc}`}>
                                {roleLabels[user.role]}
                            </span>
                        </div>
                        <button
                            onClick={logout}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-surface-panel border border-surface-line rounded-lg text-ink-dim hover:bg-status-critical/10 hover:border-status-critical/30 hover:text-status-critical transition-colors"
                        >
                            <LogOut size={13} />{t("logout")}
                        </button>
                    </div>
                </header>

                <SystemStatusBar />

                <main className="flex-1 p-7 max-w-[1400px] w-full mx-auto">
                    {tab === "kpis"       && <KpiCards userRole={user.role} />}
                    {tab === "health"     && <HealthView userRole={user.role} />}
                    {tab === "energy"     && <EnergyView userRole={user.role} />}
                    {tab === "workorders" && <WorkOrdersView userRole={user.role} />}
                    {tab === "alerts"     && <AlertsPanel userRole={user.role} />}
                    {tab === "user"       && <UserManagement />}
                    {tab === "audit"      && <AuditLogView />}
                    {tab === "mqtt"       && <MqttMonitorView userRole={user.role} />}
                    {tab === "ml"         && <MLDashboardView userRole={user.role} />}
                    {tab === "calendar"   && <PredictiveCalendar userRole={user.role} />}
                    {tab === "anomaly"    && <AnomalyPlayground userRole={user.role} />}
                </main>
            </div>

            <ChatWidget />
            <FailureInjectorDrawer
                open={injectorOpen}
                onClose={() => setInjectorOpen(false)}
                alarmEnabled={alarmEnabled}
                onToggleAlarm={setAlarmEnabled}
            />
        </div>
    );
}

function LoginPage() {
    const navigate = useNavigate();
    return <Login onLogin={() => navigate("/", { replace: true })} />;
}

export default function App() {
    return (
        <LanguageProvider>
            <SocketProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                        <Route path="/mqtt-monitor" element={<MqttMonitorView />} />
                    </Routes>
                </BrowserRouter>
            </SocketProvider>
        </LanguageProvider>
    );
}
