import React, { useState } from "react";
import Login        from "./components/Login";
import HealthView   from "./components/HealthView";
import EnergyView   from "./components/EnergyView";
import KpiCards     from "./components/KpiCards";
import AlertsPanel  from "./components/AlertsPanel";

// Tabs visible to each role
const ROLE_TABS = {
  maintenance_engineer: [
    { id: "kpis",    label: "KPI Overview" },
    { id: "health",  label: "Health View"  },
    { id: "alerts",  label: "Alerts"       },
  ],
  energy_manager: [
    { id: "kpis",    label: "KPI Overview" },
    { id: "energy",  label: "Energy View"  },
    { id: "alerts",  label: "Alerts"       },
  ],
};

// Role display labels
const ROLE_LABELS = {
  maintenance_engineer: "Maintenance Engineer",
  energy_manager:       "Energy Manager",
};

export default function App() {
  // Try to restore user from localStorage on first load
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [tab, setTab] = useState("kpis");

  // Called by Login component after successful login
  function handleLogin(loggedInUser) {
    setUser(loggedInUser);
    setTab("kpis");
  }

  // Logout
  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setTab("kpis");
  }

  // Not logged in → show login page
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const tabs = ROLE_TABS[user.role] || [];

  // If current tab is not available for this role, reset to first
  const activeTab = tabs.find(t => t.id === tab) ? tab : tabs[0]?.id;

  return (
    <div style={{ fontFamily: "Arial, sans-serif", minHeight: "100vh", backgroundColor: "#f5f5f5" }}>

      {/* Navbar */}
      <nav style={{
        backgroundColor: "#343a40",
        padding:         "0 24px",
        display:         "flex",
        alignItems:      "center",
        height:          52,
        gap:             8,
      }}>
        {/* App name */}
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 15, marginRight: 16, whiteSpace: "nowrap" }}>
          Smart Dashboard
        </span>

        {/* Tabs — only what this role can see */}
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background:   "none",
              border:       "none",
              color:        activeTab === t.id ? "#fff" : "#adb5bd",
              fontSize:     14,
              cursor:       "pointer",
              padding:      "0 8px",
              height:       52,
              borderBottom: activeTab === t.id ? "2px solid #007bff" : "2px solid transparent",
            }}
          >
            {t.label}
          </button>
        ))}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* User info + role badge + logout */}
        <span style={{ color: "#adb5bd", fontSize: 13 }}>{user.name}</span>
        <span style={{
          backgroundColor: user.role === "maintenance_engineer" ? "#007bff" : "#28a745",
          color:           "#fff",
          fontSize:        11,
          fontWeight:      600,
          padding:         "3px 8px",
          borderRadius:    10,
        }}>
          {ROLE_LABELS[user.role]}
        </span>
        <button
          onClick={handleLogout}
          style={{
            marginLeft:      8,
            padding:         "5px 12px",
            fontSize:        12,
            backgroundColor: "transparent",
            border:          "1px solid #6c757d",
            color:           "#adb5bd",
            borderRadius:    4,
            cursor:          "pointer",
          }}
        >
          Logout
        </button>
      </nav>

      {/* Page content */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>
          {tabs.find(t => t.id === activeTab)?.label}
        </h2>
        <p style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>
          {activeTab === "kpis"   && "Summary of all asset and energy KPIs."}
          {activeTab === "health" && "Asset health scores, RUL, MTBF, and live sensor readings."}
          {activeTab === "energy" && "Energy consumption vs baseline, PUE, EER, and CO₂."}
          {activeTab === "alerts" && "Active predictive alerts and acknowledged notifications."}
        </p>

        {activeTab === "kpis"   && <KpiCards />}
        {activeTab === "health" && <HealthView  userRole={user.role} />}
        {activeTab === "energy" && <EnergyView  userRole={user.role} />}
        {activeTab === "alerts" && <AlertsPanel userRole={user.role} />}
      </main>
    </div>
  );
}
