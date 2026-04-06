import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const [checking, setChecking] = useState(true);
  const [hasToken,  setHasToken] = useState(false);

  useEffect(() => {
    setHasToken(!!localStorage.getItem("token"));
    setChecking(false);
  }, []);

  if (checking) return (
    <div style={{ minHeight:"100vh", background:"#f0f4f8", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:36, height:36, border:"3px solid #dde3ec", borderTop:"3px solid #1d6fcc", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
    </div>
  );

  if (!hasToken) return <Navigate to="/login" replace />;
  return children;
}
