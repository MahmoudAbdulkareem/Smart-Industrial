import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Login          from "./components/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import KpiCards       from "./components/KpiCards";
import HealthView     from "./components/HealthView";
import EnergyView     from "./components/EnergyView";
import AlertsPanel    from "./components/AlertsPanel";
import UserManagement from "./components/UserManagement";
import Chatbot        from "./components/Chatbot";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";

const ROLE_NAV = {
    maintenance_engineer: [
        { id: "kpis",   icon: "" },
        { id: "health", icon: "" },
        { id: "alerts", icon: "" },
    ],
    energy_manager: [
        { id: "kpis",   icon: "" },
        { id: "energy", icon: "" },
        { id: "alerts", icon: "" },
    ],
    it_admin: [
        { id: "kpis",   icon: "" },
        { id: "health", icon: "" },
        { id: "energy", icon: "" },
        { id: "alerts", icon: "" },
        { id: "user",   icon: "" },
    ],
};

function Clock() {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);
    const date = now.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
    const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return (
        <div style={{ textAlign: "right", lineHeight: 1.3 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1a2332", letterSpacing: 0.5, fontVariantNumeric: "tabular-nums" }}>{time}</div>
            <div style={{ fontSize: 11, color: "#6b7a99" }}>{date}</div>
        </div>
    );
}

function Dashboard() {
    const navigate = useNavigate();
    const { t, language, setLanguage } = useLanguage();
    const [user]     = useState(() => { try { return JSON.parse(localStorage.getItem("user")); } catch { return null; } });
    const [tab,      setTab]      = useState("kpis");
    const [sideOpen, setSideOpen] = useState(true);

    if (!user) return <Navigate to="/login" replace />;

    const navItems = ROLE_NAV[user.role] || [];

    const navLabels = {
        kpis:   t("kpiOverview"),
        health: t("healthView"),
        energy: t("energyView"),
        alerts: t("alerts"),
        user:   t("userManagement"),
    };

    
    const navDescs = {
        kpis:   "Summary of all asset and energy KPIs.",
        health: "Asset health scores, RUL, MTBF, and live sensor readings.",
        energy: "Energy consumption vs baseline, PUE, EER, and CO₂.",
        alerts: "Active predictive alerts and acknowledged notifications.",
        user:   "Manage user accounts and permissions.",
    };

    const roleLabels = {
        maintenance_engineer: t("maintenanceEngineer"),
        energy_manager:       t("energyManager"),
        it_admin:             t("itAdmin"),
    };

    const roleColors = {
        maintenance_engineer: { bg: "#dbeafe", color: "#1d4ed8" },
        energy_manager:       { bg: "#dcfce7", color: "#166534" },
        it_admin:             { bg: "#ede9fe", color: "#6d28d9" },
    };

    function logout() {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
    }

    const SIDE_W = sideOpen ? 220 : 60;
    const rc = roleColors[user.role] || { bg: "#f3f4f6", color: "#374151" };

    return (
        <div style={{ display: "flex", minHeight: "100vh", background: "#f0f4f8", fontFamily: "'Inter', Arial, sans-serif" }}>
            <style>{`@keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }`}</style>

            <aside style={{ width: SIDE_W, flexShrink: 0, background: "#fff", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", transition: "width 0.22s ease", position: "sticky", top: 0, height: "100vh", overflow: "hidden" }}>
                <div style={{ padding: "18px 14px", borderBottom: "1px solid #f0f4f8", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: "#1d6fcc", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                            <rect x="1" y="1" width="7" height="7" rx="1.5" fill="white" opacity="0.9"/>
                            <rect x="10" y="1" width="7" height="7" rx="1.5" fill="white" opacity="0.55"/>
                            <rect x="1" y="10" width="7" height="7" rx="1.5" fill="white" opacity="0.55"/>
                            <rect x="10" y="10" width="7" height="7" rx="1.5" fill="white" opacity="0.9"/>
                        </svg>
                    </div>
                    {sideOpen && (
                        <div style={{ overflow: "hidden", whiteSpace: "nowrap" }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#1a2332", letterSpacing: -0.2 }}>Smart</div>
                            <div style={{ fontSize: 10, color: "#9aa5b4" }}>Industrial Monitor</div>
                        </div>
                    )}
                </div>

                <nav style={{ padding: "12px 8px", flex: 1 }}>
                    {navItems.map(item => {
                        const isActive = tab === item.id;
                        return (
                            <button key={item.id} onClick={() => setTab(item.id)} title={!sideOpen ? navLabels[item.id] : ""}
                                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: sideOpen ? "10px 12px" : "10px 14px", marginBottom: 4, borderRadius: 8, border: "none", cursor: "pointer", background: isActive ? "#eff6ff" : "transparent", color: isActive ? "#1d6fcc" : "#6b7a99", fontWeight: isActive ? 600 : 400, fontSize: 13, fontFamily: "inherit", textAlign: "left", justifyContent: sideOpen ? "flex-start" : "center", transition: "all 0.15s" }}>
                                <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                                {sideOpen && <span style={{ overflow: "hidden", whiteSpace: "nowrap" }}>{navLabels[item.id]}</span>}
                                {isActive && sideOpen && <span style={{ marginLeft: "auto", width: 4, height: 4, borderRadius: "50%", background: "#1d6fcc", flexShrink: 0 }} />}
                            </button>
                        );
                    })}
                </nav>

                <div style={{ padding: "12px 8px", borderTop: "1px solid #f0f4f8" }}>
                    <button onClick={() => setSideOpen(v => !v)}
                        style={{ width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8faff", cursor: "pointer", fontSize: 12, color: "#6b7a99", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <span style={{ fontSize: 14, transform: sideOpen ? "rotate(180deg)" : "rotate(0deg)", display: "inline-block", transition: "transform 0.2s" }}>❮</span>
                        {sideOpen && <span>{t("collapse")}</span>}
                    </button>
                </div>
            </aside>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                <header style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 28px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                    <div>
                        <h1 style={{ fontSize: 16, fontWeight: 700, color: "#1a2332", letterSpacing: -0.2 }}>{navLabels[tab]}</h1>
                        <p style={{ fontSize: 11, color: "#9aa5b4", marginTop: 1 }}>{navDescs[tab]}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <Clock />
                        <button onClick={() => setLanguage(language === "en" ? "fr" : "en")}
                            style={{ padding: "4px 12px", fontSize: 11, fontWeight: 700, border: "1px solid #d1d9e6", borderRadius: 20, background: "#f8faff", cursor: "pointer", color: "#1d6fcc", fontFamily: "inherit" }}>
                            {language === "en" ? "FR" : "EN"}
                        </button>
                        <div style={{ width: 1, height: 32, background: "#e2e8f0" }} />
                        <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#1a2332" }}>{user.name}</div>
                            <span style={{ display: "inline-block", fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10, marginTop: 2, background: rc.bg, color: rc.color }}>
                                {roleLabels[user.role]}
                            </span>
                        </div>
                        <button onClick={logout} style={{ padding: "6px 14px", fontSize: 12, fontWeight: 500, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 7, cursor: "pointer", color: "#374151", fontFamily: "inherit" }}>
                            {t("logout")}
                        </button>
                    </div>
                </header>

                <main style={{ flex: 1, padding: 28, maxWidth: 1200, width: "100%" }}>
                    {tab === "kpis"   && <KpiCards />}
                    {tab === "health" && <HealthView  userRole={user.role} />}
                    {tab === "energy" && <EnergyView  userRole={user.role} />}
                    {tab === "alerts" && <AlertsPanel userRole={user.role} />}
                    {tab === "user"   && <UserManagement />}
                </main>
            </div>
            <Chatbot />
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
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </LanguageProvider>
    );
}
