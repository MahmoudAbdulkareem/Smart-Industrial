import React, { useEffect, useState } from "react";
import { Zap, X, Play, Square, Volume2, VolumeX, Radio } from "lucide-react";
import api from "../../services/api";
import { useApi } from "../../hooks/useApi";

/**
 * Presentation control panel. Every button here calls a real backend endpoint
 * (backend/routes/demoRoutes.js) that publishes real MQTT messages onto the actual
 * broker your mqttService already listens to - so triggering "Bearing Wear
 * Degradation" here produces genuine ML inference, rule-engine evaluation, and (if
 * thresholds are crossed) a genuine Maximo work order, exactly as real sensor data would.
 */
export default function FailureInjectorDrawer({ open, onClose, alarmEnabled, onToggleAlarm }) {
    const { data: assets } = useApi("/assets/health", 20000);
    const [scenarios, setScenarios] = useState([]);
    const [running, setRunning] = useState([]);
    const [assetId, setAssetId] = useState("");
    const [busy, setBusy] = useState(false);
    const [lastAction, setLastAction] = useState(null);

    useEffect(() => {
        api.get("/api/demo/scenarios").then((d) => setScenarios(d.scenarios || [])).catch(() => {});
    }, []);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        async function poll() {
            try {
                const d = await api.get("/api/demo/status");
                if (!cancelled) setRunning(d.running || []);
            } catch { /* ignore */ }
        }
        poll();
        const id = setInterval(poll, 3000);
        return () => { cancelled = true; clearInterval(id); };
    }, [open]);

    useEffect(() => {
        if (!assetId && Array.isArray(assets) && assets.length) setAssetId(assets[0].id);
    }, [assets, assetId]);

    async function trigger(scenarioKey) {
        if (!assetId) return;
        setBusy(true);
        try {
            await api.post("/api/demo/start", { assetId, scenario: scenarioKey });
            setLastAction(`${scenarioKey} started on ${assetId} - publishing real MQTT telemetry`);
        } catch (err) {
            setLastAction(`Failed: ${err?.data?.error || err.message}`);
        } finally {
            setBusy(false);
        }
    }

    async function stop(id) {
        try {
            await api.post("/api/demo/stop", { assetId: id });
            setLastAction(`Stopped injection for ${id}`);
        } catch { /* ignore */ }
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[300] flex justify-end">
            <div className="flex-1 bg-black/40" onClick={onClose} />
            <div className="w-full max-w-[380px] h-full bg-base text-ink-inverted shadow-2xl flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                    <h3 className="text-sm font-bold flex items-center gap-2"><Zap size={16} className="text-status-elevated" /> Failure Injector</h3>
                    <button onClick={onClose} className="text-ink-invertedDim hover:text-white"><X size={18} /></button>
                </div>

                <div className="px-5 py-3 text-[11px] text-ink-invertedDim border-b border-white/5 leading-relaxed">
                    Publishes real MQTT messages onto the live broker. The real ML model, rule engine, and Maximo dispatcher process them exactly as physical sensor data.
                </div>

                <div className="px-5 py-4 border-b border-white/5">
                    <label className="text-[11px] font-semibold text-ink-invertedDim uppercase tracking-wide block mb-1.5">Target asset</label>
                    <select value={assetId} onChange={(e) => setAssetId(e.target.value)}
                        className="w-full bg-base-raised border border-white/10 rounded-lg px-3 py-2 text-sm text-ink-inverted">
                        {(Array.isArray(assets) ? assets : []).map((a) => (
                            <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                        ))}
                    </select>
                </div>

                <div className="px-5 py-4 flex flex-col gap-2 border-b border-white/5">
                    <label className="text-[11px] font-semibold text-ink-invertedDim uppercase tracking-wide mb-0.5">Scenarios</label>
                    {scenarios.map((s) => (
                        <button key={s.key} disabled={busy || !assetId} onClick={() => trigger(s.key)}
                            className="flex items-center gap-2 justify-between px-3.5 py-2.5 bg-base-raised hover:bg-white/10 border border-white/10 rounded-lg text-sm disabled:opacity-40">
                            <span className="flex items-center gap-2"><Play size={13} className="text-status-normal" /> {s.label}</span>
                        </button>
                    ))}
                </div>

                <div className="px-5 py-4 flex-1 overflow-y-auto scroll-thin">
                    <label className="text-[11px] font-semibold text-ink-invertedDim uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <Radio size={12} /> Active injections
                    </label>
                    {running.length === 0 ? (
                        <p className="text-[11px] text-ink-invertedDim/70">None running.</p>
                    ) : running.map((r) => (
                        <div key={r.assetId} className="flex items-center justify-between bg-base-raised border border-white/10 rounded-lg px-3 py-2 mb-1.5 text-xs">
                            <div>
                                <div className="font-semibold">{r.assetId}</div>
                                <div className="text-ink-invertedDim text-[10px] font-mono">{r.label} - tick {r.tick}</div>
                            </div>
                            <button onClick={() => stop(r.assetId)} className="flex items-center gap-1 text-status-critical text-[11px] font-semibold">
                                <Square size={11} /> Stop
                            </button>
                        </div>
                    ))}
                    {lastAction && <p className="text-[10px] text-ink-invertedDim/70 mt-3 font-mono">{lastAction}</p>}
                </div>

                <div className="px-5 py-4 border-t border-white/10">
                    <button onClick={() => onToggleAlarm(!alarmEnabled)}
                        className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 bg-base-raised border border-white/10 rounded-lg text-sm">
                        {alarmEnabled ? <Volume2 size={14} className="text-status-normal" /> : <VolumeX size={14} className="text-ink-invertedDim" />}
                        Audible alarm: {alarmEnabled ? "ON" : "OFF"}
                    </button>
                </div>
            </div>
        </div>
    );
}
