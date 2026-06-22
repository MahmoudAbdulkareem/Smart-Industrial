import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';

// Simple icons
const Icon = {
  Broadcast: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2E86C1" strokeWidth="2">
      <circle cx="12" cy="12" r="2"/>
      <path d="M16.24 7.76a6 6 0 0 1 0 8.48M7.76 7.76a6 6 0 0 0 0 8.48M4.93 4.93a10 10 0 0 0 0 14.14M19.07 4.93a10 10 0 0 1 0 14.14"/>
    </svg>
  ),
  Pause: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16"/>
      <rect x="14" y="4" width="4" height="16"/>
    </svg>
  ),
  Play: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  ),
  Clear: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  ),
  Activity: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  Close: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Filter: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="22 3 2 3 10 13 10 21 14 18 14 13 22 3"/>
    </svg>
  )
};

const BUFFER = 500;

// Sensor configs
const SENSOR_CONFIG = {
  temperature: {
    label: '🌡️ Temperature',
    color: '#E74C3C',
    unit: '°C',
    warn: (v) => v > 85 ? '⚠ HIGH' : null
  },
  vibration: {
    label: '📳 Vibration',
    color: '#F39C12',
    unit: 'mm/s',
    warn: (v) => v > 8 ? '⚠ HIGH' : null
  },
  pressure: {
    label: '📊 Pressure',
    color: '#9B59B6',
    unit: 'bar',
    warn: (v) => (v < 1.0 || v > 5.0) ? '⚠ OUT OF RANGE' : null
  }
};

const getSensor = (type) => SENSOR_CONFIG[type] || { 
  label: '📡 ' + type, 
  color: '#5DADE2', 
  unit: '',
  warn: () => null 
};

export default function MqttMonitorView() {
  const [messages, setMessages] = useState([]);
  const [paused, setPaused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState('all');
  const [selectedSensor, setSelectedSensor] = useState('all');
  const [selected, setSelected] = useState(null);
  const [stats, setStats] = useState({ total: 0, rate: 0, byAsset: {}, byType: {} });

  const counter = useRef(0);
  const lastCount = useRef(0);
  const feedRef = useRef(null);
  const pausedRef = useRef(false);

  // Get unique assets and sensor types from messages
  const getUniqueAssets = () => {
    const assets = new Set();
    messages.forEach(m => assets.add(m.assetId));
    return Array.from(assets).sort();
  };

  const getUniqueSensorTypes = () => {
    const types = new Set();
    messages.forEach(m => types.add(m.sensorType));
    return Array.from(types).sort();
  };

  // Socket handlers
  const handlers = {
    'sensor:reading': (data) => {
      if (pausedRef.current) return;

      console.log('[MQTT] Received sensor reading:', data);
      
      const now = Date.now();
      const assetId = data.assetId || 'unknown';
      const sensors = data.sensors || {};
      
      Object.entries(sensors).forEach(([sensorType, value]) => {
        const numVal = parseFloat(value);
        if (isNaN(numVal)) return;

        counter.current += 1;
        
        const config = getSensor(sensorType);
        const warning = config.warn ? config.warn(numVal) : null;

        setStats(prev => ({
          total: prev.total + 1,
          rate: prev.rate,
          byAsset: { ...prev.byAsset, [assetId]: (prev.byAsset[assetId] || 0) + 1 },
          byType: { ...prev.byType, [sensorType]: (prev.byType[sensorType] || 0) + 1 }
        }));

        const msg = {
          id: counter.current,
          assetId,
          sensorType,
          value: numVal,
          unit: config.unit,
          color: config.color,
          label: config.label,
          warning,
          timestamp: now,
          time: new Date(now).toLocaleTimeString('en', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
          }),
          raw: data,
          topic: `sensor_readings/${assetId}/${sensorType}`
        };

        setMessages(prev => {
          const updated = [msg, ...prev];
          return updated.slice(0, BUFFER);
        });
      });
    },
    'mqtt:packet': (data) => {
      console.log('[MQTT] MQTT Packet:', data);
    }
  };

  const { isConnected } = useSocket(handlers);

  // Pause
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // Rate counter
  useEffect(() => {
    const interval = setInterval(() => {
      const current = counter.current;
      setStats(prev => ({ ...prev, rate: current - lastCount.current }));
      lastCount.current = current;
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (!paused && feedRef.current) feedRef.current.scrollTop = 0;
  }, [messages, paused]);

  // Apply all filters
  const filtered = messages.filter(m => {
    // Search query filter
    if (searchQuery && !m.assetId.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !m.sensorType.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    // Asset filter
    if (selectedAsset !== 'all' && m.assetId !== selectedAsset) {
      return false;
    }
    // Sensor type filter
    if (selectedSensor !== 'all' && m.sensorType !== selectedSensor) {
      return false;
    }
    return true;
  });

  const clearAll = () => {
    setMessages([]);
    setStats({ total: 0, rate: 0, byAsset: {}, byType: {} });
    counter.current = 0;
    lastCount.current = 0;
    setSelected(null);
    setSelectedAsset('all');
    setSelectedSensor('all');
    setSearchQuery('');
  };

  const statusDot = () => {
    if (!isConnected) return { label: 'OFFLINE', color: '#E74C3C' };
    if (messages.length === 0) return { label: 'WAITING', color: '#F39C12' };
    return { label: 'LIVE', color: '#27AE60' };
  };

  const dot = statusDot();
  const uniqueAssets = getUniqueAssets();
  const uniqueSensorTypes = getUniqueSensorTypes();

  return (
    <div style={styles.wrap}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.left}>
          <Icon.Broadcast />
          <h1 style={styles.title}>MQTT Broadcast Monitor</h1>
          <div style={styles.badge}>
            <span style={{ ...styles.dot, background: dot.color }} />
            <span style={styles.badgeText}>{dot.label}</span>
          </div>
        </div>
        <div style={styles.right}>
          <span style={styles.stat}>📊 {stats.total}</span>
          <span style={styles.stat}>💾 {messages.length}/{BUFFER}</span>
        </div>
      </header>

      {/* Stats Bar */}
      <div style={styles.statsBar}>
        <div style={styles.statsSection}>
          <span style={styles.statsLabel}>Assets:</span>
          {Object.entries(stats.byAsset).slice(0, 5).map(([asset, count]) => (
            <span key={asset} style={styles.assetTag}>
              {asset} <span style={styles.countBadge}>{count}</span>
            </span>
          ))}
          {Object.keys(stats.byAsset).length > 5 && (
            <span style={styles.moreTag}>+{Object.keys(stats.byAsset).length - 5}</span>
          )}
        </div>
        <div style={styles.statsSection}>
          <span style={styles.statsLabel}>Sensors:</span>
          {Object.entries(stats.byType).map(([type, count]) => {
            const config = getSensor(type);
            return (
              <span key={type} style={{ ...styles.sensorTag, color: config.color }}>
                {config.label} ×{count}
              </span>
            );
          })}
        </div>
      </div>

      {/* Main Layout */}
      <div style={styles.main}>
        {/* Feed */}
        <div style={styles.feedWrap}>
          {/* Controls with filters */}
          <div style={styles.controls}>
            {/* Search input */}
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 Search by asset or sensor..."
              style={styles.search}
            />

            {/* Asset filter dropdown */}
            <select
              value={selectedAsset}
              onChange={(e) => setSelectedAsset(e.target.value)}
              style={styles.select}
            >
              <option value="all">🏭 All Assets</option>
              {uniqueAssets.map(asset => (
                <option key={asset} value={asset}>{asset}</option>
              ))}
            </select>

            {/* Sensor filter dropdown */}
            <select
              value={selectedSensor}
              onChange={(e) => setSelectedSensor(e.target.value)}
              style={styles.select}
            >
              <option value="all">📡 All Sensors</option>
              {uniqueSensorTypes.map(type => {
                const config = getSensor(type);
                return (
                  <option key={type} value={type}>{config.label}</option>
                );
              })}
            </select>

            {/* Clear filters button */}
            {(selectedAsset !== 'all' || selectedSensor !== 'all' || searchQuery) && (
              <button 
                onClick={() => {
                  setSelectedAsset('all');
                  setSelectedSensor('all');
                  setSearchQuery('');
                }} 
                style={styles.clearFiltersBtn}
              >
                <Icon.Close /> Clear Filters
              </button>
            )}

            {/* Pause button */}
            <button onClick={() => setPaused(!paused)} style={styles.pauseBtn}>
              {paused ? <Icon.Play /> : <Icon.Pause />}
              {paused ? 'Resume' : 'Pause'}
            </button>

            {/* Clear all button */}
            <button onClick={clearAll} style={styles.clearAllBtn}>
              <Icon.Clear /> Clear
            </button>
          </div>

          {/* Filter info bar */}
          {(selectedAsset !== 'all' || selectedSensor !== 'all' || searchQuery) && (
            <div style={styles.filterInfo}>
              <span style={styles.filterInfoText}>
                <Icon.Filter /> Filtered: 
                {selectedAsset !== 'all' && <span style={styles.filterTag}>Asset: {selectedAsset}</span>}
                {selectedSensor !== 'all' && <span style={styles.filterTag}>Sensor: {getSensor(selectedSensor).label}</span>}
                {searchQuery && <span style={styles.filterTag}>Search: "{searchQuery}"</span>}
                <span style={styles.filterCount}>{filtered.length} messages</span>
              </span>
            </div>
          )}

          <div ref={feedRef} style={styles.feed}>
            {filtered.length === 0 ? (
              <div style={styles.empty}>
                <div style={styles.emptyIcon}>📡</div>
                <p style={styles.emptyText}>
                  {isConnected ? 'Waiting for sensor readings...' : 'Not connected'}
                </p>
                <p style={styles.emptySub}>
                  {isConnected ? 'Messages will appear here as they arrive' : 'Check your connection'}
                </p>
                {messages.length > 0 && filtered.length === 0 && (
                  <p style={styles.emptySub}>Try adjusting your filters</p>
                )}
              </div>
            ) : (
              filtered.map((msg) => (
                <div
                  key={msg.id}
                  onClick={() => setSelected(msg)}
                  style={{
                    ...styles.row,
                    borderLeftColor: msg.color,
                    background: selected?.id === msg.id ? 'rgba(46, 204, 113, 0.08)' : 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    if (selected?.id !== msg.id) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selected?.id !== msg.id) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <span style={styles.rowId}>#{msg.id}</span>
                  <span style={{ ...styles.rowAsset, color: msg.color }}>
                    {msg.assetId}
                  </span>
                  <span style={styles.rowType}>{msg.label}</span>
                  <span style={styles.rowValue}>
                    {msg.value.toFixed(2)} {msg.unit}
                  </span>
                  <span style={styles.rowTime}>{msg.time}</span>
                  {msg.warning && (
                    <span style={styles.warningBadge}>{msg.warning}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Inspector */}
        <div style={styles.inspector}>
          <h3 style={styles.inspectorTitle}>
            <span>🔍</span> Packet Inspector
            {selected && <span style={styles.inspectorId}>#{selected.id}</span>}
          </h3>

          {selected ? (
            <div style={styles.inspectorContent}>
              <div style={styles.field}>
                <label style={styles.fieldLabel}>📋 Topic</label>
                <div style={{ ...styles.fieldValue, color: selected.color, fontWeight: 600 }}>
                  {selected.topic || `sensor_readings/${selected.assetId}/${selected.sensorType}`}
                </div>
              </div>

              <div style={styles.grid}>
                <div style={styles.field}>
                  <label style={styles.fieldLabel}>🏷️ Asset</label>
                  <div style={styles.fieldValue}>{selected.assetId}</div>
                </div>
                <div style={styles.field}>
                  <label style={styles.fieldLabel}>📊 Value</label>
                  <div style={{ ...styles.fieldValue, color: '#27AE60', fontWeight: 700 }}>
                    {selected.value.toFixed(2)} {selected.unit}
                  </div>
                </div>
              </div>

              <div style={styles.grid}>
                <div style={styles.field}>
                  <label style={styles.fieldLabel}>📡 Sensor</label>
                  <div style={{ ...styles.fieldValue, color: selected.color }}>
                    {selected.label}
                  </div>
                </div>
                <div style={styles.field}>
                  <label style={styles.fieldLabel}>⏱️ Received</label>
                  <div style={styles.fieldValue}>
                    {new Date(selected.timestamp).toISOString().replace('T', ' ').slice(0, 23)}
                  </div>
                </div>
              </div>

              {selected.warning && (
                <div style={styles.warningBox}>
                  ⚠️ {selected.warning}
                </div>
              )}

              <div style={styles.field}>
                <label style={styles.fieldLabel}>📦 Raw Payload</label>
                <pre style={styles.payload}>
                  {JSON.stringify(selected.raw, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div style={styles.emptyInspector}>
              <div style={styles.emptyInspectorIcon}>👆</div>
              <p>Select a message to inspect</p>
              <p style={styles.emptyInspectorSub}>Click any message for details</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }
        select { appearance: auto; }
      `}</style>
    </div>
  );
}

// Styles
const styles = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 80px)',
    padding: '16px',
    background: 'linear-gradient(135deg, #0a1628, #1a2a4a)',
    borderRadius: '12px',
    gap: '12px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#e0e0e0'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.08)',
    flexWrap: 'wrap',
    gap: '8px'
  },
  left: { display: 'flex', alignItems: 'center', gap: '12px' },
  title: {
    fontSize: '18px',
    fontWeight: 700,
    margin: 0,
    background: 'linear-gradient(135deg, #5DADE2, #2E86C1)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent'
  },
  badge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 12px',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 600
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block',
    animation: 'pulse 1.5s ease-in-out infinite'
  },
  badgeText: { color: '#e0e0e0', letterSpacing: '0.5px' },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '12px',
    color: '#95A5A6'
  },
  stat: { display: 'flex', alignItems: 'center', gap: '4px' },
  statsBar: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.05)',
    fontSize: '12px'
  },
  statsSection: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
  statsLabel: { color: '#95A5A6', fontWeight: 600 },
  assetTag: {
    padding: '2px 8px',
    background: 'rgba(52, 152, 219, 0.15)',
    borderRadius: '12px',
    color: '#3498DB',
    fontSize: '11px'
  },
  countBadge: { color: '#95A5A6', marginLeft: '2px' },
  moreTag: {
    padding: '2px 8px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '12px',
    color: '#95A5A6',
    fontSize: '11px'
  },
  sensorTag: {
    padding: '2px 8px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '12px',
    fontSize: '11px'
  },
  main: {
    display: 'flex',
    gap: '12px',
    flex: 1,
    overflow: 'hidden',
    minHeight: 0
  },
  feedWrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(0,0,0,0.3)',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.06)',
    overflow: 'hidden'
  },
  controls: {
    display: 'flex',
    gap: '8px',
    padding: '10px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    flexWrap: 'wrap',
    alignItems: 'center'
  },
  search: {
    flex: 1,
    padding: '6px 12px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    color: '#e0e0e0',
    fontSize: '12px',
    outline: 'none',
    minWidth: '120px'
  },
  select: {
    padding: '6px 12px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    color: '#e0e0e0',
    fontSize: '12px',
    outline: 'none',
    cursor: 'pointer',
    minWidth: '120px'
  },
  clearFiltersBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    background: 'rgba(231, 76, 60, 0.15)',
    border: '1px solid rgba(231, 76, 60, 0.2)',
    borderRadius: '6px',
    color: '#E74C3C',
    cursor: 'pointer',
    fontSize: '11px',
    whiteSpace: 'nowrap'
  },
  pauseBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    color: '#e0e0e0',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    whiteSpace: 'nowrap'
  },
  clearAllBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    color: '#95A5A6',
    cursor: 'pointer',
    fontSize: '12px',
    whiteSpace: 'nowrap'
  },
  filterInfo: {
    padding: '6px 12px',
    background: 'rgba(52, 152, 219, 0.08)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '6px'
  },
  filterInfoText: {
    fontSize: '11px',
    color: '#95A5A6',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap'
  },
  filterTag: {
    padding: '2px 8px',
    background: 'rgba(52, 152, 219, 0.15)',
    borderRadius: '12px',
    color: '#5DADE2',
    fontSize: '10px'
  },
  filterCount: {
    marginLeft: '4px',
    color: '#e0e0e0',
    fontWeight: 600
  },
  feed: {
    flex: 1,
    overflow: 'auto',
    padding: '4px 8px'
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#5D6D7E'
  },
  emptyIcon: { fontSize: '48px', marginBottom: '16px', opacity: 0.5 },
  emptyText: { fontSize: '16px', margin: 0 },
  emptySub: { fontSize: '12px', margin: '4px 0 0', opacity: 0.6 },
  row: {
    display: 'grid',
    gridTemplateColumns: '60px 120px 100px 100px 80px auto',
    gap: '8px',
    padding: '6px 10px',
    borderLeft: '3px solid transparent',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    alignItems: 'center',
    transition: 'background 0.15s',
    animation: 'slideIn 0.2s ease-out'
  },
  rowId: { color: '#5D6D7E', fontSize: '10px' },
  rowAsset: { fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowType: { fontSize: '11px' },
  rowValue: { color: '#27AE60', fontWeight: 700, fontSize: '13px' },
  rowTime: { color: '#5D6D7E', fontSize: '10px' },
  warningBadge: {
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '9px',
    fontWeight: 700,
    background: '#E74C3C',
    color: 'white',
    animation: 'blink 1s ease-in-out infinite',
    whiteSpace: 'nowrap'
  },
  inspector: {
    width: '340px',
    flexShrink: 0,
    background: 'rgba(0,0,0,0.3)',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '16px',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column'
  },
  inspectorTitle: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#5DADE2',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    margin: '0 0 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  inspectorId: { marginLeft: 'auto', fontSize: '10px', color: '#5D6D7E', fontWeight: 400 },
  inspectorContent: { flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  field: { display: 'flex', flexDirection: 'column', gap: '4px' },
  fieldLabel: {
    fontSize: '10px',
    color: '#95A5A6',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.3px'
  },
  fieldValue: { fontSize: '13px', color: '#e0e0e0', wordBreak: 'break-word' },
  warningBox: {
    padding: '8px 12px',
    background: 'rgba(231, 76, 60, 0.15)',
    border: '1px solid #E74C3C',
    borderRadius: '4px',
    color: '#E74C3C',
    fontSize: '11px',
    fontWeight: 600,
    textAlign: 'center'
  },
  payload: {
    background: 'rgba(0,0,0,0.4)',
    padding: '10px',
    borderRadius: '4px',
    fontSize: '11px',
    color: '#5DADE2',
    fontFamily: 'monospace',
    overflow: 'auto',
    maxHeight: '150px',
    margin: 0,
    border: '1px solid rgba(255,255,255,0.05)'
  },
  emptyInspector: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#5D6D7E'
  },
  emptyInspectorIcon: { fontSize: '32px', marginBottom: '12px', opacity: 0.4 },
  emptyInspectorSub: { fontSize: '11px', opacity: 0.6, margin: '4px 0 0' }
};