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
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, password }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Login failed");
        return;
      }

      // Save token and user to localStorage
      localStorage.setItem("token", json.token);
      localStorage.setItem("user",  JSON.stringify(json.user));

      // Tell App.js login succeeded
      onLogin(json.user);

    } catch (err) {
      setError("Cannot connect to server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.title}>Smart Industrial Dashboard</h2>
        <p style={styles.sub}>ESPRIT PFE 2025–2026 · Sign in to continue</p>

        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={styles.input}
            />
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            style={styles.btn}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        {/* Test credentials hint */}
        <div style={styles.hint}>
          <p style={{ margin: "0 0 4px", fontWeight: 600 }}>Test accounts:</p>
          <p style={{ margin: "0 0 2px" }}>maintenance@dashboard.com / maintenance123</p>
          <p style={{ margin: 0 }}>energy@dashboard.com / energy123</p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight:       "100vh",
    backgroundColor: "#f5f5f5",
    display:         "flex",
    alignItems:      "center",
    justifyContent:  "center",
    fontFamily:      "Arial, sans-serif",
  },
  card: {
    backgroundColor: "#fff",
    border:          "1px solid #ddd",
    borderRadius:    8,
    padding:         32,
    width:           "100%",
    maxWidth:        400,
    boxShadow:       "0 2px 8px rgba(0,0,0,0.08)",
  },
  title: { margin: "0 0 4px", fontSize: 20, color: "#333" },
  sub:   { margin: "0 0 24px", fontSize: 13, color: "#888" },
  field: { marginBottom: 16 },
  label: { display: "block", fontSize: 13, marginBottom: 4, color: "#555" },
  input: {
    width:        "100%",
    padding:      "9px 12px",
    fontSize:     14,
    border:       "1px solid #ccc",
    borderRadius: 4,
    boxSizing:    "border-box",
  },
  error: {
    color:           "#721c24",
    backgroundColor: "#f8d7da",
    border:          "1px solid #f5c6cb",
    borderRadius:    4,
    padding:         "8px 12px",
    fontSize:        13,
    marginBottom:    12,
  },
  btn: {
    width:           "100%",
    padding:         "10px",
    fontSize:        14,
    fontWeight:      600,
    backgroundColor: "#007bff",
    color:           "#fff",
    border:          "none",
    borderRadius:    4,
    cursor:          "pointer",
  },
  hint: {
    marginTop:       20,
    padding:         12,
    backgroundColor: "#f8f9fa",
    borderRadius:    4,
    fontSize:        12,
    color:           "#666",
    borderLeft:      "3px solid #007bff",
  },
};
