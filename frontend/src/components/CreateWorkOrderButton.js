// frontend/src/components/CreateWorkOrderButton.js
import React, { useState, useEffect } from "react";
import { useApi } from "../hooks/useApi";

const API_BASE_URL = process.env.REACT_APP_API_URL || "";

function authHeaders() {
    const token = localStorage.getItem("token");
    return { Authorization: token ? "Bearer " + token : "", "Content-Type": "application/json" };
}

export default function CreateWorkOrderButton({ onCreated, iconOnly = true }) {
    const [isOpen, setIsOpen] = useState(false);
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        assetId: "",
        description: "",
        priority: 2,
    });
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const { data: assetsData, refresh: refreshAssets } = useApi("/maximo/assets", 60000);

    useEffect(() => {
        if (isOpen) {
            refreshAssets();
        }
    }, [isOpen, refreshAssets]);

    useEffect(() => {
        if (assetsData && Array.isArray(assetsData)) {
            setAssets(assetsData);
        }
    }, [assetsData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        setSuccess(null);

        try {
            const res = await fetch(`${API_BASE_URL}/api/maximo/work-orders`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify(formData),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to create work order");
            }

            const data = await res.json();
            setSuccess(`Work order ${data.wonum} created successfully`);
            setFormData({ assetId: "", description: "", priority: 2 });
            
            if (onCreated) {
                onCreated(data);
            }

            setTimeout(() => {
                setIsOpen(false);
                setSuccess(null);
            }, 1500);
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Icon-only button (default)
    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                title="New Work Order"
                style={{
                    width: 38,
                    height: 38,
                    fontSize: 20,
                    fontWeight: 700,
                    background: "linear-gradient(135deg, #5AA9E6 0%, #3E7FB0 100%)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "50%",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s",
                    boxShadow: "0 2px 8px rgba(29,111,204,0.3)"
                }}
                onMouseEnter={e => {
                    e.currentTarget.style.transform = "scale(1.05)";
                    e.currentTarget.style.boxShadow = "0 4px 16px rgba(29,111,204,0.4)";
                }}
                onMouseLeave={e => {
                    e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.boxShadow = "0 2px 8px rgba(29,111,204,0.3)";
                }}
            >
                +
            </button>

            {isOpen && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "rgba(0,0,0,0.4)",
                        backdropFilter: "blur(4px)",
                        zIndex: 9999,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        animation: "fadeIn 0.2s ease-out"
                    }}
                    onClick={() => setIsOpen(false)}
                >
                    <div
                        style={{
                            background: "#fff",
                            borderRadius: 16,
                            padding: 32,
                            width: "100%",
                            maxWidth: 480,
                            boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
                            position: "relative",
                            maxHeight: "90vh",
                            overflowY: "auto"
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setIsOpen(false)}
                            style={{
                                position: "absolute",
                                top: 12,
                                right: 16,
                                background: "none",
                                border: "none",
                                fontSize: 24,
                                color: "#8493A6",
                                cursor: "pointer",
                                padding: "4px 8px",
                                transition: "color 0.2s"
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = "#5B6B7D"}
                            onMouseLeave={e => e.currentTarget.style.color = "#8493A6"}
                        >
                            ×
                        </button>

                        <h3 style={{ margin: "0 0 6px 0", fontSize: 20, fontWeight: 700, color: "#0B0F14" }}>
                            ➕ New Work Order
                        </h3>
                        <p style={{ margin: "0 0 20px 0", fontSize: 13, color: "#5B6B7D" }}>
                            Create a work order and sync it with Maximo
                        </p>

                        {error && (
                            <div style={{
                                background: "#FBEAEA",
                                border: "1px solid #F3B7B8",
                                borderRadius: 8,
                                padding: "10px 14px",
                                color: "#B23A3D",
                                fontSize: 13,
                                marginBottom: 16
                            }}>
                                ❌ {error}
                            </div>
                        )}

                        {success && (
                            <div style={{
                                background: "#E8F8F2",
                                border: "1px solid #A8E6CC",
                                borderRadius: 8,
                                padding: "10px 14px",
                                color: "#0E9370",
                                fontSize: 13,
                                marginBottom: 16
                            }}>
                                ✅ {success}
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: 16 }}>
                                <label style={{
                                    display: "block",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: "#374151",
                                    marginBottom: 4
                                }}>
                                    Asset *
                                </label>
                                <select
                                    value={formData.assetId}
                                    onChange={e => setFormData({ ...formData, assetId: e.target.value })}
                                    required
                                    style={{
                                        width: "100%",
                                        padding: "10px 14px",
                                        border: "1px solid #E2E8F0",
                                        borderRadius: 8,
                                        fontSize: 13,
                                        fontFamily: "inherit",
                                        background: "#fff",
                                        outline: "none",
                                        transition: "border-color 0.2s"
                                    }}
                                    onFocus={e => e.target.style.borderColor = "#5AA9E6"}
                                    onBlur={e => e.target.style.borderColor = "#E2E8F0"}
                                >
                                    <option value="">Select an asset...</option>
                                    {assets.map(asset => (
                                        <option key={asset.assetnum} value={asset.assetnum}>
                                            {asset.assetnum} - {asset.description || "No description"}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ marginBottom: 16 }}>
                                <label style={{
                                    display: "block",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: "#374151",
                                    marginBottom: 4
                                }}>
                                    Description *
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    required
                                    rows={3}
                                    style={{
                                        width: "100%",
                                        padding: "10px 14px",
                                        border: "1px solid #E2E8F0",
                                        borderRadius: 8,
                                        fontSize: 13,
                                        fontFamily: "inherit",
                                        resize: "vertical",
                                        outline: "none",
                                        transition: "border-color 0.2s"
                                    }}
                                    onFocus={e => e.target.style.borderColor = "#5AA9E6"}
                                    onBlur={e => e.target.style.borderColor = "#E2E8F0"}
                                    placeholder="Describe the work required..."
                                />
                            </div>

                            <div style={{ marginBottom: 20 }}>
                                <label style={{
                                    display: "block",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: "#374151",
                                    marginBottom: 4
                                }}>
                                    Priority
                                </label>
                                <div style={{ display: "flex", gap: 8 }}>
                                    {[1, 2, 3, 4, 5].map(p => {
                                        const labels = { 1: "Critical", 2: "High", 3: "Medium", 4: "Low", 5: "Lowest" };
                                        const colors = { 1: "#B23A3D", 2: "#B4791F", 3: "#5B6B7D", 4: "#0d9488", 5: "#6b7280" };
                                        const isSelected = formData.priority === p;
                                        return (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, priority: p })}
                                                style={{
                                                    flex: 1,
                                                    padding: "6px 8px",
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    border: isSelected ? `2px solid ${colors[p]}` : "1px solid #E2E8F0",
                                                    borderRadius: 8,
                                                    background: isSelected ? "#F5F7FA" : "#fff",
                                                    color: isSelected ? colors[p] : "#5B6B7D",
                                                    cursor: "pointer",
                                                    fontFamily: "inherit",
                                                    transition: "all 0.2s"
                                                }}
                                            >
                                                {p}
                                                <span style={{ fontSize: 8, display: "block", fontWeight: 400 }}>
                                                    {labels[p]}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                style={{
                                    width: "100%",
                                    padding: "12px",
                                    fontSize: 14,
                                    fontWeight: 700,
                                    background: submitting ? "#94a3b8" : "linear-gradient(135deg, #5AA9E6 0%, #3E7FB0 100%)",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: 10,
                                    cursor: submitting ? "default" : "pointer",
                                    fontFamily: "inherit",
                                    transition: "all 0.2s",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 8
                                }}
                            >
                                {submitting ? "⏳ Creating..." : "➕ Create Work Order"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}