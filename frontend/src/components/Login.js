import React, { useState } from "react";

export default function Login({ onLogin }) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res  = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Login failed"); return; }
      localStorage.setItem("token", json.token);
      localStorage.setItem("user",  JSON.stringify(json.user));
      onLogin(json.user);
    } catch {
      setError("Cannot connect to server. Is the backend running on port 5000?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg, #e8f0fe 0%, #f0f4f8 60%, #e0f2fe 100%)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"#fff", border:"1px solid #dde3ec", borderRadius:14, padding:"40px 36px", width:"100%", maxWidth:420, boxShadow:"0 6px 32px rgba(29,111,204,0.1)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:28, paddingBottom:24, borderBottom:"1px solid #f0f4f8" }}>
          <div style={{ width:44, height:44, borderRadius:10, background:"#1d6fcc", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="2" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
              <rect x="13" y="2" width="9" height="9" rx="2" fill="white" opacity="0.55"/>
              <rect x="2" y="13" width="9" height="9" rx="2" fill="white" opacity="0.55"/>
              <rect x="13" y="13" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize:17, fontWeight:700, color:"#1a2332", letterSpacing:-0.2 }}>Smart Industrial Dashboard</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {[{ label:"Email address", type:"email", value:email, set:setEmail, placeholder:"your@email.com", auto:"email" },
            { label:"Password",      type:"password", value:password, set:setPassword, placeholder:"••••••••", auto:"current-password" }].map(f => (
            <div key={f.label} style={{ marginBottom:16 }}>
              <label style={{ display:"block", fontSize:13, fontWeight:500, color:"#374151", marginBottom:6 }}>{f.label}</label>
              <input type={f.type} value={f.value} onChange={e => f.set(e.target.value)}
                placeholder={f.placeholder} required autoComplete={f.auto}
                style={{ width:"100%", padding:"10px 13px", fontSize:14, border:"1px solid #d1d9e6", borderRadius:8, color:"#1a2332", fontFamily:"inherit", outline:"none" }} />
            </div>
          ))}
          {error && (
            <div style={{ display:"flex", alignItems:"center", gap:8, background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"10px 13px", fontSize:13, color:"#dc2626", marginBottom:14 }}>
              ⚠ {error}
            </div>
          )}
          <button type="submit" disabled={loading}
            style={{ width:"100%", padding:"11px", fontSize:14, fontWeight:600, background:"#1d6fcc", color:"#fff", border:"none", borderRadius:8, cursor:loading?"not-allowed":"pointer", fontFamily:"inherit", marginTop:4, opacity:loading?0.75:1 }}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <div style={{
  marginTop: 24,
  padding: 20,
  background: "#f8faff",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)"
}}>
  <p style={{
    fontSize: 11,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    marginBottom: 14
  }}>
    Test Accounts
  </p>

  <div style={{ display: "flex", flexDirection: "column" }}>
    {[
      {
        role: "Maintenance",
        color: "#1d4ed8",
        bg: "#dbeafe",
        email: "maintenance@dashboard.com",
        pwd: "maintenance123"
      },
      {
        role: "Energy Mgr",
        color: "#166534",
        bg: "#dcfce7",
        email: "energy@dashboard.com",
        pwd: "energy123"
      }
    ].map((account) => (
      <div
        key={account.role}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 14px",
          background: "#ffffff",
          borderRadius: 10,
          border: "1px solid #f1f5f9"
        }}
      >
        {/* Role Badge */}
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          padding: "4px 12px",
          borderRadius: 9999,
          background: account.bg,
          color: account.color,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          whiteSpace: "nowrap"
        }}>
          {account.role}
        </span>

        {/* Credentials */}
        <div style={{ fontSize: 13, color: "#1e2937", fontFamily: "monospace" }}>
          <code>{account.email} / {account.pwd}</code>
        </div>
      </div>
    ))}
  </div>
</div>
      </div>
    </div>
  );
}
