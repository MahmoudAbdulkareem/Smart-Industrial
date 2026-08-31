// frontend/src/components/DigitalTwin.js
import React, { useState, useEffect } from 'react';
import { Factory, LayoutGrid, Box, Crosshair, MousePointerClick, BarChart3, Wrench, MapPin } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useSocket } from '../hooks/useSocket';

const TYPE_ICON = { compressor: Box, pump: Box, motor: Box, conveyor: Box, hvac: Box, generic: Factory };

const STATUS_COLOR = {
    healthy: { hex: '#12B886', tw: 'status-normal' },
    caution: { hex: '#F0A93A', tw: 'status-elevated' },
    critical: { hex: '#E6484B', tw: 'status-critical' },
    operating: { hex: '#12B886', tw: 'status-normal' },
    down: { hex: '#E6484B', tw: 'status-critical' },
    maintenance: { hex: '#5AA9E6', tw: 'status-info' },
};

function normaliseStatus(raw) {
    const s = (raw || 'healthy').toString().toLowerCase();
    if (s === 'critical' || s === 'down') return 'critical';
    if (s === 'caution' || s === 'warning' || s === 'warn') return 'caution';
    if (s === 'maintenance') return 'maintenance';
    return 'healthy';
}

function healthColor(score) {
    if (score >= 70) return '#12B886';
    if (score >= 40) return '#F0A93A';
    return '#E6484B';
}

// Component-level breakdown derived from the asset's REAL sensor readings — mirrors the
// "Stator / Rotor / Bearing / Fan Housing" hotspot logic from the brief, but computed
// from actual vibration/temperature values rather than invented ones.
function deriveHotspots(asset) {
    const vib = asset.sensors?.vibration ?? 0;
    const temp = asset.sensors?.temperature ?? 0;
    return [
        { part: 'Drive-End Bearing', hot: temp > 70 || vib > 0.38 },
        { part: 'Stator Winding', hot: temp > 80 },
        { part: 'Rotor Shaft', hot: vib > 0.42 },
        { part: 'Fan Housing', hot: false },
    ];
}

function DigitalTwin({ assets: assetsProp = [], userRole }) {
    const [selectedAsset, setSelectedAsset] = useState(null);
    const [rotation, setRotation] = useState(0);
    const [viewMode, setViewMode] = useState('3d');

    // Real asset feed — same endpoint HealthView uses — instead of a static prop, so the
    // twin reflects the actual fleet even though App.js historically passed assets={[]}.
    const { data: apiAssets } = useApi('/assets/health', 15000);
    const [liveAssets, setLiveAssets] = useState([]);

    useEffect(() => {
        if (Array.isArray(apiAssets)) setLiveAssets(apiAssets);
    }, [apiAssets]);

    useSocket({
        'sensor:reading': (reading) => {
            if (!reading?.assetId) return;
            setLiveAssets(prev => prev.map(a => a.id === reading.assetId
                ? { ...a, healthScore: reading.healthScore ?? a.healthScore, status: reading.status ?? a.status, sensors: { ...a.sensors, ...reading.sensors } }
                : a));
        },
    });

    const source = assetsProp.length > 0 ? assetsProp : liveAssets;
    const displayAssets = source.length > 0 ? source : null;

    useEffect(() => {
        const interval = setInterval(() => setRotation(prev => (prev + 0.3) % 360), 100);
        return () => clearInterval(interval);
    }, []);

    if (!displayAssets) {
        return (
            <div className="bg-base rounded-2xl p-6 flex items-center justify-center min-h-[300px] text-ink-invertedDim text-sm">
                Awaiting live asset telemetry from the backend…
            </div>
        );
    }

    const counts = {
        healthy: displayAssets.filter(a => normaliseStatus(a.status) === 'healthy').length,
        caution: displayAssets.filter(a => normaliseStatus(a.status) === 'caution').length,
        critical: displayAssets.filter(a => normaliseStatus(a.status) === 'critical').length,
    };

    return (
        <div className="flex flex-col gap-4 p-5 bg-base rounded-2xl">
            <div className="flex justify-between items-center flex-wrap gap-3">
                <div>
                    <h2 className="text-xl font-extrabold text-ink-inverted flex items-center gap-2"><Factory size={20} /> Digital Twin Factory</h2>
                    <p className="text-[13px] text-ink-invertedDim mt-1">Interactive visualization with real-time asset monitoring</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setViewMode(viewMode === '3d' ? '2d' : '3d')}
                        className="flex items-center gap-1.5 px-4 py-2 bg-base-raised text-ink-inverted border border-white/10 rounded-lg text-xs font-semibold">
                        {viewMode === '3d' ? <><LayoutGrid size={13} /> 2D View</> : <><Box size={13} /> 3D View</>}
                    </button>
                    <button onClick={() => setSelectedAsset(null)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-base-raised text-ink-inverted border border-white/10 rounded-lg text-xs font-semibold">
                        <Crosshair size={13} /> Reset View
                    </button>
                </div>
            </div>

            <div className="grid gap-3 px-4 py-3 bg-base-raised rounded-xl border border-white/5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))' }}>
                <div className="flex flex-col items-center gap-0.5">
                    <span className="text-xl font-extrabold text-ink-inverted font-mono">{displayAssets.length}</span>
                    <span className="text-[11px] text-ink-invertedDim">Total Assets</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                    <span className="text-xl font-extrabold text-status-normal font-mono">{counts.healthy}</span>
                    <span className="text-[11px] text-ink-invertedDim">Healthy</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                    <span className="text-xl font-extrabold text-status-elevated font-mono">{counts.caution}</span>
                    <span className="text-[11px] text-ink-invertedDim">Caution</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                    <span className="text-xl font-extrabold text-status-critical font-mono">{counts.critical}</span>
                    <span className="text-[11px] text-ink-invertedDim">Critical</span>
                </div>
            </div>

            <div className="w-full min-h-[400px] rounded-xl border border-white/5 p-5 relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #121822 0%, #0B0F14 100%)' }}>
                <div className="grid gap-4" style={{
                    gridTemplateColumns: `repeat(auto-fit, minmax(${viewMode === '3d' ? 180 : 200}px, 1fr))`,
                    perspective: viewMode === '3d' ? '1000px' : 'none',
                }}>
                    {displayAssets.map((asset, index) => {
                        const statusKey = normaliseStatus(asset.status);
                        const status = STATUS_COLOR[statusKey];
                        const Icon = TYPE_ICON[asset.type?.toLowerCase()] || Factory;
                        const isSelected = selectedAsset?.id === asset.id;
                        const hotspots = deriveHotspots(asset);
                        const anyHot = hotspots.some(h => h.hot);

                        return (
                            <div
                                key={asset.id}
                                onClick={() => setSelectedAsset(isSelected ? null : asset)}
                                className="rounded-xl text-center text-ink-inverted flex flex-col items-center gap-1.5 p-4 cursor-pointer"
                                style={{
                                    background: `linear-gradient(135deg, ${status.hex}20, ${status.hex}08)`,
                                    border: `2px solid ${isSelected ? '#5AA9E6' : status.hex}`,
                                    transform: viewMode === '3d'
                                        ? `rotateY(${rotation + index * 15}deg) translateY(${Math.sin((rotation + index * 30) * Math.PI / 180) * 5}px)`
                                        : isSelected ? 'scale(1.05)' : 'scale(1)',
                                    boxShadow: `0 4px 20px ${status.hex}30`,
                                    zIndex: isSelected ? 20 : 1,
                                    transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
                                }}
                            >
                                <div className="relative mb-1">
                                    <Icon size={32} style={{ color: status.hex }} />
                                    {anyHot && <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full status-ring`} style={{ background: '#E6484B', color: '#E6484B' }} />}
                                </div>
                                <div className="text-sm font-bold">{asset.name}</div>
                                <div className="text-[11px] text-ink-invertedDim font-mono">{asset.id}</div>
                                <div className="flex items-center gap-1.5 text-xs mt-1">
                                    <span className="w-2 h-2 rounded-full" style={{ background: status.hex }} />
                                    <span className="font-semibold capitalize" style={{ color: status.hex }}>{statusKey}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1 px-3 py-1 bg-white/5 rounded-md">
                                    <span className="text-[11px] text-ink-invertedDim">Health</span>
                                    <span className="text-sm font-bold font-mono" style={{ color: healthColor(asset.healthScore || 0) }}>{Math.round(asset.healthScore || 0)}%</span>
                                </div>
                                <div className="text-[11px] text-ink-invertedDim mt-0.5 flex items-center gap-1"><MapPin size={10} /> {asset.location || 'N/A'}</div>

                                {isSelected && (
                                    <div className="w-full mt-2 flex flex-col gap-1.5 text-left">
                                        {hotspots.map(h => (
                                            <div key={h.part} className={`flex items-center justify-between text-[11px] px-2 py-1 rounded ${h.hot ? "bg-status-critical/15 text-status-critical" : "bg-white/5 text-ink-invertedDim"}`}>
                                                <span>{h.part}</span>
                                                <span className="font-mono">{h.hot ? 'HOTSPOT' : 'nominal'}</span>
                                            </div>
                                        ))}
                                        <div className="flex gap-1.5 mt-1">
                                            <button className="flex-1 flex items-center justify-center gap-1 py-1 text-[11px] font-semibold rounded-md bg-status-info/20 text-status-info">
                                                <BarChart3 size={11} /> Details
                                            </button>
                                            <button className="flex-1 flex items-center justify-center gap-1 py-1 text-[11px] font-semibold rounded-md bg-status-critical/20 text-status-critical">
                                                <Wrench size={11} /> Maintain
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="flex gap-5 justify-center px-4 py-3 bg-base-raised rounded-lg border border-white/5 flex-wrap">
                {[['Healthy', '#12B886'], ['Caution', '#F0A93A'], ['Critical', '#E6484B'], ['Maintenance', '#5AA9E6']].map(([label, hex]) => (
                    <span key={label} className="flex items-center gap-1.5 text-xs text-ink-inverted">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: hex }} /> {label}
                    </span>
                ))}
                <span className="ml-auto text-ink-invertedDim text-[11px] flex items-center gap-1"><MousePointerClick size={12} /> Click asset for details</span>
            </div>
        </div>
    );
}

export default DigitalTwin;
