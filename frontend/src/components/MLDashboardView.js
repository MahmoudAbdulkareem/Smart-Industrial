// src/components/MLDashboardView.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine, ReferenceArea, Cell
} from 'recharts';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Brain,
  CheckCircle,
  Clock,
  Cpu,
  Database,
  Download,
  FileText,
  Gauge,
  Heart,
  Layers,
  Lightbulb,
  LineChart as LineChartIcon,
  Loader,
  Lock,
  Microscope,
  Search,
  Sparkles,
  Target,
  Thermometer,
  Timer,
  Upload,
  Bot,
  GitBranch,
  ScatterChart as ScatterChartIcon
} from 'lucide-react';

// ── Constants ────────────────────────────────────────────────────────────────
const VIBRATION_WARN_MM_S = 2.8;
const VIBRATION_MAX_MM_S = 4.5;
const ISO_VIBRATION_ZONES = [
  { id: 'good', label: 'Good', min: 0, max: 1.4, color: '#12B886' },
  { id: 'allowable', label: 'Allowable', min: 1.4, max: 2.8, color: '#84cc16' },
  { id: 'tolerable', label: 'Tolerable', min: 2.8, max: 4.5, color: '#F0A93A' },
  { id: 'unacceptable', label: 'Unacceptable', min: 4.5, max: 8, color: '#E6484B' },
];

const ASSETS = [
  { id: 'AST-001', name: 'Compressor Unit A', type: 'Compressor', location: 'Zone 1' },
  { id: 'AST-002', name: 'Pump Station B', type: 'Pump', location: 'Zone 2' },
  { id: 'AST-003', name: 'Conveyor Belt C', type: 'Conveyor', location: 'Zone 3' },
  { id: 'AST-004', name: 'HVAC Unit D', type: 'HVAC', location: 'Zone 1' },
  { id: 'AST-005', name: 'Motor Drive E', type: 'Motor', location: 'Zone 4' },
];

const STATUS_COLORS = { healthy: '#12B886', caution: '#F0A93A', critical: '#E6484B' };

function statusFromScore(s) {
  if (s >= 70) return 'healthy';
  if (s >= 40) return 'caution';
  return 'critical';
}

function authHeader() {
  const token = localStorage.getItem('token');
  return { Authorization: 'Bearer ' + (token || '') };
}

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    color: '#E8EEF4',
    fontFamily: "'Inter', system-ui, sans-serif",
    background: '#0B0F14',
    padding: 16,
    borderRadius: 12,
    minHeight: '100vh',
    maxWidth: 1400,
    margin: '0 auto',
  },
  loadingPage: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: 400,
  },
  loadingSpinner: {
    width: 36,
    height: 36,
    border: '3px solid rgba(255,255,255,0.1)',
    borderTop: '3px solid #5AA9E6',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    padding: '16px 24px',
    background: 'linear-gradient(135deg, #1a1a3e, #182130)',
    borderRadius: 12,
    border: '1px solid rgba(26,115,232,0.15)',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
  },
  liveTag: {
    fontSize: 11,
    fontWeight: 700,
    color: '#12B886',
    background: 'rgba(34,197,94,0.12)',
    padding: '3px 10px',
    borderRadius: 12,
    animation: 'pulse 2s infinite',
    marginLeft: 12,
  },
  headerSub: {
    color: '#8493A6',
    fontSize: 12,
    marginTop: 4,
  },
  assetChipGroup: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  assetChip: {
    padding: '5px 14px',
    borderRadius: 20,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  },
  kpiRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
  },
  metricCard: {
    background: '#182130',
    borderRadius: 10,
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    border: '1px solid rgba(255,255,255,0.06)',
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 800,
    color: '#fff',
  },
  metricLabel: {
    fontSize: 11,
    color: '#8493A6',
    marginTop: 2,
  },
  metricSub: {
    fontSize: 10,
    color: '#5B6B7D',
    marginTop: 2,
  },
  tabs: {
    display: 'flex',
    gap: 2,
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    padding: '0 4px',
  },
  tabBtn: {
    padding: '10px 20px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'inherit',
    borderRadius: '6px 6px 0 0',
    transition: 'all 0.15s',
  },
  tabContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    animation: 'fadeIn 0.2s ease',
  },
  gridTwo: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
  },
  card: {
    background: '#182130',
    borderRadius: 12,
    padding: '18px 20px',
    border: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#fff',
  },
  cardSub: {
    fontSize: 11,
    color: '#8493A6',
  },
  tooltip: {
    background: '#182130',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    color: '#fff',
  },
  legend: {
    display: 'flex',
    gap: 16,
    marginTop: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    color: '#8493A6',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: '#b0b0b0',
    marginBottom: 4,
  },
  select: {
    width: '100%',
    padding: '8px 12px',
    background: '#182130',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    color: '#E8EEF4',
    fontSize: 13,
    outline: 'none',
    fontFamily: 'inherit',
    marginBottom: 12,
  },
  textarea: {
    width: '100%',
    padding: '10px 14px',
    background: '#182130',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    fontSize: 13,
    color: '#E8EEF4',
    fontFamily: 'inherit',
    resize: 'vertical',
    outline: 'none',
  },
  input: {
    flex: 1,
    padding: '8px 14px',
    background: '#182130',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    fontSize: 13,
    color: '#E8EEF4',
    fontFamily: 'inherit',
    outline: 'none',
    minWidth: 120,
  },
  buttonGroup: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  btnPrimary: {
    padding: '8px 20px',
    background: 'linear-gradient(135deg, #5AA9E6 0%, #1557b0 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 600,
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    transition: 'all 0.2s',
  },
  btnSecondary: {
    padding: '8px 20px',
    background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 600,
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    transition: 'all 0.2s',
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: 'default',
  },
  btnPredict: {
    width: '100%',
    padding: '8px',
    background: 'linear-gradient(135deg, #5AA9E6 0%, #1557b0 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 600,
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    transition: 'all 0.2s',
  },
  btnExport: {
    padding: '8px 16px',
    background: 'rgba(255,255,255,0.06)',
    color: '#b0b0b0',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 600,
    fontSize: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    transition: 'all 0.2s',
  },
  btnUpload: {
    padding: '8px 20px',
    background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 600,
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    whiteSpace: 'nowrap',
    transition: 'all 0.2s',
  },
  solutionBox: {
    marginTop: 16,
    padding: '12px 16px',
    background: '#182130',
    borderRadius: 8,
  },
  solutionHeader: {
    fontSize: 13,
    fontWeight: 600,
    color: '#fff',
    marginBottom: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  solutionText: {
    fontSize: 13,
    color: '#E8EEF4',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
  },
  similarHeader: {
    fontSize: 12,
    fontWeight: 600,
    color: '#8493A6',
    marginBottom: 4,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  similarItem: {
    fontSize: 12,
    color: '#b0b0b0',
    padding: '4px 8px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
    marginBottom: 4,
    display: 'flex',
    justifyContent: 'space-between',
  },
  similarFooter: {
    fontSize: 11,
    color: '#8493A6',
    marginTop: 4,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  aiSolutionBox: {
    marginTop: 16,
    padding: '12px 16px',
    background: 'rgba(124, 58, 237, 0.15)',
    borderRadius: 8,
    border: '1px solid rgba(124, 58, 237, 0.3)',
  },
  aiSolutionText: {
    fontSize: 13,
    color: '#E8EEF4',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
  },
  aiSolutionMeta: {
    display: 'flex',
    gap: 16,
    marginTop: 8,
    fontSize: 12,
    color: '#8493A6',
  },
  mlContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: '16px 0',
  },
  mlStatusBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    flexDirection: 'row',
  },
  mlStatusStats: {
    display: 'flex',
    gap: 16,
    fontSize: 12,
    color: '#8493A6',
  },
  mlGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
  },
  rangeGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
    marginBottom: 12,
  },
  rangeLabel: {
    fontSize: 10,
    color: '#8493A6',
    display: 'block',
  },
  rangeInput: {
    width: '100%',
    cursor: 'pointer',
    height: 4,
    borderRadius: 2,
    background: '#182130',
    accentColor: '#5AA9E6',
  },
  rangeValue: {
    fontSize: 12,
    color: '#b0b0b0',
  },
  exportRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 12,
  },
  uploadLabel: {
    marginBottom: 8,
  },
  uploadLock: {
    fontSize: 10,
    color: '#E6484B',
    display: 'block',
    marginTop: 4,
  },
  uploadForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  uploadRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  fileInput: {
    flex: 1,
    padding: '6px',
    background: '#182130',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    color: '#E8EEF4',
    fontSize: 12,
    fontFamily: 'inherit',
    minWidth: '120px',
  },
  inputDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  uploadError: {
    padding: '6px 12px',
    background: '#E6484B15',
    border: '1px solid #E6484B',
    borderRadius: 6,
    color: '#E6484B',
    fontSize: 11,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  progressContainer: {
    marginTop: 4,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    background: '#182130',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #8B5CF6, #12B886)',
    transition: 'width 0.3s ease',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    color: '#8493A6',
    marginTop: 4,
    textAlign: 'center',
  },
  trainingComplete: {
    padding: '8px 12px',
    background: '#12B88615',
    border: '1px solid #12B886',
    borderRadius: 6,
    color: '#12B886',
    fontSize: 11,
  },
  trainingStats: {
    display: 'flex',
    gap: 12,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  uploadHint: {
    fontSize: 10,
    color: '#8493A6',
    marginTop: 4,
  },
  sliderGroup: {
    marginBottom: 16,
  },
  sliderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sliderValue: {
    fontWeight: 700,
    fontSize: 16,
    minWidth: 50,
    textAlign: 'right',
  },
  sliderInput: {
    width: '100%',
    cursor: 'pointer',
    height: 4,
    borderRadius: 2,
  },
  sliderLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 10,
    color: '#5B6B7D',
    marginTop: 2,
  },
  presetSection: {
    marginTop: 8,
  },
  presetLabel: {
    color: '#8493A6',
    fontSize: 11,
    marginBottom: 6,
  },
  presetGroup: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  presetBtn: {
    padding: '6px 12px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 6,
    color: '#E8EEF4',
    fontSize: 10,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },
  predictionPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  criticalCard: {
    animation: 'glow 2s infinite',
  },
  explanationText: {
    color: '#8493A6',
    fontSize: 11,
    marginBottom: 8,
  },
  resultGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
    marginTop: 8,
  },
  resultItem: {
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  resultLabel: {
    fontSize: 10,
    color: '#8493A6',
    textTransform: 'uppercase',
    fontWeight: 600,
    letterSpacing: '0.5px',
  },
  resultValue: {
    fontSize: 16,
    fontWeight: 700,
    color: '#E8EEF4',
  },
  sensorGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 8,
    marginTop: 8,
  },
  sensorIndicator: {
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  sensorHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sensorLabel: {
    fontSize: 11,
    color: '#8493A6',
    fontWeight: 600,
  },
  sensorValue: {
    fontSize: 14,
    fontWeight: 700,
  },
  sensorStatus: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  sensorStatusBadge: {
    fontSize: 10,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 12,
  },
  warningBox: {
    padding: '10px 14px',
    borderRadius: 8,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  warningCritical: {
    background: '#E6484B15',
    border: '1px solid #E6484B',
    color: '#E6484B',
  },
  warningCaution: {
    background: '#F0A93A15',
    border: '1px solid #F0A93A',
    color: '#F0A93A',
  },
  warningHealthy: {
    background: '#12B88615',
    border: '1px solid #12B886',
    color: '#12B886',
  },
  emptyState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
    textAlign: 'center',
    color: '#8493A6',
  },
  emptySubtext: {
    fontSize: 12,
    marginTop: 8,
    color: '#5B6B7D',
  },
  historyContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginTop: 8,
    maxHeight: 150,
    overflowY: 'auto',
  },
  historyItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '6px 10px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 6,
    fontSize: 12,
  },
  historyTime: {
    color: '#8493A6',
    width: 70,
    fontSize: 11,
  },
  historyScore: {
    fontWeight: 700,
    width: 50,
    textAlign: 'center',
  },
  historyRul: {
    color: '#8493A6',
    fontSize: 11,
    marginLeft: 'auto',
  },
  predictionGrid: {
    marginTop: 12,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 8,
  },
  predictionItem: {
    background: '#182130',
    padding: '8px',
    borderRadius: 6,
    textAlign: 'center',
  },
  predictionLabel: {
    fontSize: 10,
    color: '#8493A6',
  },
  predictionValue: {
    fontSize: 20,
    fontWeight: 700,
    color: '#fff',
  },
  zoneLabels: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    marginTop: 6,
    marginBottom: 4,
  },
  anomalyStats: {
    color: '#8493A6',
    fontSize: 12,
    marginTop: 8,
  },
};

// ── Sub-components ──────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, color, icon: Icon }) {
  return (
    <div style={styles.metricCard}>
      <div style={{ ...styles.metricIcon, background: color + '22', color }}>
        <Icon size={20} />
      </div>
      <div>
        <div style={styles.metricValue}>{value}</div>
        <div style={styles.metricLabel}>{label}</div>
        {sub && <div style={styles.metricSub}>{sub}</div>}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const colors = {
    healthy: { bg: '#12B88620', text: '#12B886', label: 'Healthy', icon: CheckCircle },
    caution: { bg: '#F0A93A20', text: '#F0A93A', label: 'Caution', icon: AlertTriangle },
    critical: { bg: '#E6484B20', text: '#E6484B', label: 'Critical', icon: AlertCircle }
  };
  const style = colors[status] || colors.healthy;
  const Icon = style.icon;
  return (
    <span style={{
      background: style.bg,
      color: style.text,
      padding: '4px 14px',
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 600,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }}>
      <Icon size={14} /> {style.label}
    </span>
  );
}

function SensorIndicator({ label, value, unit, status }) {
  const getStatusColor = () => {
    if (status === 'critical') return '#E6484B';
    if (status === 'caution') return '#F0A93A';
    return '#12B886';
  };
  
  const getStatusLabel = () => {
    if (status === 'critical') return 'Critical';
    if (status === 'caution') return 'Warning';
    return 'Normal';
  };

  const getStatusIcon = () => {
    if (status === 'critical') return AlertCircle;
    if (status === 'caution') return AlertTriangle;
    return CheckCircle;
  };
  const StatusIcon = getStatusIcon();

  return (
    <div style={styles.sensorIndicator}>
      <div style={styles.sensorHeader}>
        <span style={styles.sensorLabel}>{label}</span>
        <span style={{ ...styles.sensorValue, color: getStatusColor() }}>
          {value} {unit}
        </span>
      </div>
      <div style={styles.sensorStatus}>
        <span style={{ 
          ...styles.sensorStatusBadge,
          background: getStatusColor() + '20',
          color: getStatusColor(),
          display: 'flex',
          alignItems: 'center',
          gap: 4
        }}>
          <StatusIcon size={12} /> {getStatusLabel()}
        </span>
      </div>
    </div>
  );
}

// ── AI Intelligence Component ──────────────────────────────────────────────

function MLIntelligenceView({ userRole }) {
  const [workOrderDesc, setWorkOrderDesc] = useState("");
  const [solutions, setSolutions] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [exportFormat, setExportFormat] = useState('csv');
  const [modelStatus, setModelStatus] = useState(null);
  const [predictionResult, setPredictionResult] = useState(null);
  const [aiGeneratedSolution, setAiGeneratedSolution] = useState(null);
  const [workOrderData, setWorkOrderData] = useState({
    priority: 2,
    health_score: 75,
    temperature: 55,
    vibration: 2.1,
    pressure: 2.5,
    energy_consumption: 150,
    previous_work_orders: 3
  });
  const [assetId, setAssetId] = useState("");
  const [trainingResults, setTrainingResults] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);

  const API_BASE_URL = process.env.REACT_APP_API_URL || "";
  const isAdmin = userRole === 'it_admin' || userRole === 'admin';

  function authHeaders() {
    const token = localStorage.getItem("token");
    return { 
      Authorization: token ? "Bearer " + token : "", 
      "Content-Type": "application/json" 
    };
  }

  useEffect(() => { fetchModelStatus(); }, []);

  const fetchModelStatus = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/intelligence/model-status`, { headers: authHeaders() });
      if (res.ok) {
        setModelStatus(await res.json());
      } else {
        setModelStatus({
          models: {
            patternRecognizer: { status: 'active', patterns: 15, confidence: 78 },
            ruleEngine: { status: 'active', rules: 12, confidence: 85 }
          },
          last_training: new Date().toISOString(),
          next_training: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });
      }
    } catch (error) {
      console.error("Failed to fetch model status:", error);
      setModelStatus({
        models: {
          patternRecognizer: { status: 'active', patterns: 15, confidence: 78 },
          ruleEngine: { status: 'active', rules: 12, confidence: 85 }
        },
        last_training: new Date().toISOString(),
        next_training: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });
    }
  };

  const getModelAccuracy = () => modelStatus?.models?.patternRecognizer?.confidence || 0;
  const getModelPatterns = () => modelStatus?.models?.patternRecognizer?.patterns || 0;
  const getRules = () => modelStatus?.models?.ruleEngine?.rules || 0;

  const handleFindSolutions = async () => {
    if (!workOrderDesc.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/intelligence/find-solutions`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ description: workOrderDesc })
      });
      if (res.ok) {
        setSolutions(await res.json());
      } else {
        const errorData = await res.json();
        alert("Failed to find solutions: " + (errorData.error || "Unknown error"));
      }
    } catch (error) {
      alert("Error connecting to server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateAISolution = async () => {
    if (!workOrderDesc.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/intelligence/generate-solution`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ 
          description: workOrderDesc,
          asset_name: assetId || 'Unknown Asset',
          ...workOrderData
        })
      });
      if (res.ok) {
        setAiGeneratedSolution(await res.json());
      } else {
        const errorData = await res.json();
        alert("Failed to generate AI solution: " + (errorData.error || "Unknown error"));
      }
    } catch (error) {
      alert("Error connecting to server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePredictResolution = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/intelligence/predict-resolution`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ 
          ...workOrderData,
          asset_id: assetId || 'AST-001'
        })
      });
      if (res.ok) {
        setPredictionResult(await res.json());
      }
    } catch (error) {
      console.error("Failed to predict resolution:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (!['.csv', '.json'].includes(ext)) {
        setUploadError('Please upload a CSV or JSON file.');
        setUploadFile(null);
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setUploadError('File size must be less than 10MB.');
        setUploadFile(null);
        return;
      }
      setUploadFile(file);
      setUploadError(null);
      setTrainingResults(null);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Please select a file first.');
      return;
    }

    setIsLoading(true);
    setUploadProgress(0);
    setUploadError(null);
    setTrainingResults(null);

    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 300);

      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/intelligence/upload`, {
        method: "POST",
        headers: { 'Authorization': token ? `Bearer ${token}` : '' },
        body: formData
      });

      clearInterval(progressInterval);

      const data = await res.json();
      if (res.ok) {
        setUploadProgress(100);
        setTrainingResults(data);
        setUploadFile(null);
        fetchModelStatus();
        alert(`✅ Training complete!\n\nRecords processed: ${data.records_processed}\nNew patterns discovered: ${data.new_patterns_discovered}\nTraining accuracy: ${data.training_accuracy}%`);
      } else {
        throw new Error(data.error || data.message || 'Upload failed');
      }
    } catch (error) {
      setUploadError(error.message || "Upload failed. Please try again.");
      setUploadProgress(0);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        description: "Motor overheating - temperature exceeded 85°C",
        status: "COMP",
        priority: 2,
        asset_id: "AST-001",
        asset_name: "Motor Drive A",
        health_score: 45,
        temperature: 88,
        vibration: 3.2,
        pressure: 2.1,
        resolution_time: 6,
        solution: "Cleaned cooling fans and replaced thermal sensor"
      }
    ];
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'training_data_template.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={styles.mlContainer}>
      {/* Model Status */}
      {modelStatus && (
        <div style={{ ...styles.card, ...styles.mlStatusBar }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Brain size={18} color="#8B5CF6" />
            <span style={styles.cardTitle}>AI Models Status</span>
            <span style={styles.cardSub}>
              Last trained: {modelStatus.last_training ? new Date(modelStatus.last_training).toLocaleString() : 'Never'}
            </span>
          </div>
          <div style={styles.mlStatusStats}>
            <span><Target size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Accuracy: {getModelAccuracy()}%</span>
            <span><BarChart3 size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Patterns: {getModelPatterns()}</span>
            <span><GitBranch size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Rules: {getRules()}</span>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div style={styles.mlGrid}>
        {/* Column 1: Pattern Recognition */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>
              <Microscope size={18} style={{ marginRight: 8, color: '#5AA9E6', verticalAlign: 'middle' }} />
              Smart Pattern Recognition
            </span>
            <span style={{ fontSize: 11, color: '#12B886' }}>
              <Sparkles size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              AI Powered
            </span>
          </div>
          
          <div style={{ marginBottom: 12 }}>
            <label style={styles.label}>Describe the issue:</label>
            <textarea
              value={workOrderDesc}
              onChange={e => setWorkOrderDesc(e.target.value)}
              placeholder="Describe the problem or symptoms in detail..."
              rows={4}
              style={styles.textarea}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <input
              value={assetId}
              onChange={e => setAssetId(e.target.value)}
              placeholder="Asset ID (optional)"
              style={styles.input}
            />
          </div>

          <div style={styles.buttonGroup}>
            <button
              onClick={handleFindSolutions}
              disabled={isLoading || !workOrderDesc.trim()}
              style={{ ...styles.btnPrimary, ...(isLoading || !workOrderDesc.trim() ? styles.btnDisabled : {}) }}
            >
              {isLoading ? <Loader size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Search size={16} />}
              {isLoading ? "Analyzing..." : "Find Solutions"}
            </button>
            <button
              onClick={handleGenerateAISolution}
              disabled={isLoading || !workOrderDesc.trim()}
              style={{ ...styles.btnSecondary, ...(isLoading || !workOrderDesc.trim() ? styles.btnDisabled : {}) }}
            >
              {isLoading ? <Loader size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Bot size={16} />}
              {isLoading ? "Generating..." : "AI Generate"}
            </button>
          </div>

          {/* Solutions Result */}
          {solutions && (
            <div style={styles.solutionBox}>
              <div style={styles.solutionHeader}>
                <Lightbulb size={16} color="#F0A93A" />
                Recommended Solution:
              </div>
              <div style={styles.solutionText}>{solutions.recommended_solution}</div>
              {solutions.similar_work_orders?.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={styles.similarHeader}>
                    <FileText size={14} /> Similar patterns found:
                  </div>
                  {solutions.similar_work_orders.map((item, i) => (
                    <div key={i} style={styles.similarItem}>
                      <span>{item.keyword}</span>
                      <span style={{ color: '#12B886' }}>Confidence: {item.confidence}%</span>
                    </div>
                  ))}
                  <div style={styles.similarFooter}>
                    <Clock size={12} /> Est. resolution: {solutions.predicted_resolution_time} hours
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI Generated Solution */}
          {aiGeneratedSolution && (
            <div style={styles.aiSolutionBox}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#c084fc', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Bot size={16} /> AI Generated Solution:
              </div>
              <div style={styles.aiSolutionText}>{aiGeneratedSolution.analysis}</div>
              <div style={styles.aiSolutionMeta}>
                <span><Target size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Confidence: {aiGeneratedSolution.confidence}%</span>
                <span><Clock size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Est. Time: {aiGeneratedSolution.estimated_time} hours</span>
              </div>
            </div>
          )}
        </div>

        {/* Column 2: Prediction & Export/Upload */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Resolution Time Predictor */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.cardTitle}>
                <Timer size={18} style={{ marginRight: 8, color: '#5AA9E6', verticalAlign: 'middle' }} />
                Resolution Time Predictor
              </span>
              <span style={styles.cardSub}>
                <Cpu size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> ML Model
              </span>
            </div>

            <div style={styles.rangeGrid}>
              {[
                { key: 'priority', label: 'Priority', min: 1, max: 5, value: workOrderData.priority },
                { key: 'health_score', label: 'Health Score', min: 0, max: 100, value: workOrderData.health_score },
                { key: 'temperature', label: 'Temp (°C)', min: 20, max: 100, value: workOrderData.temperature },
                { key: 'vibration', label: 'Vibration (mm/s)', min: 0, max: 10, value: workOrderData.vibration },
                { key: 'pressure', label: 'Pressure (bar)', min: 0, max: 8, value: workOrderData.pressure },
                { key: 'previous_orders', label: 'Prev Orders', min: 0, max: 20, value: workOrderData.previous_work_orders }
              ].map(({ key, label, min, max, value }) => (
                <div key={key}>
                  <label style={styles.rangeLabel}>{label}</label>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    value={value}
                    onChange={e => setWorkOrderData(p => ({ ...p, [key]: parseFloat(e.target.value) }))}
                    style={styles.rangeInput}
                  />
                  <span style={styles.rangeValue}>{value}</span>
                </div>
              ))}
            </div>

            <button
              onClick={handlePredictResolution}
              disabled={isLoading}
              style={{ ...styles.btnPredict, ...(isLoading ? styles.btnDisabled : {}) }}
            >
              {isLoading ? <Loader size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Gauge size={16} />}
              {isLoading ? "Predicting..." : "Predict Resolution Time"}
            </button>

            {predictionResult && (
              <div style={styles.predictionGrid}>
                <div style={styles.predictionItem}>
                  <div style={styles.predictionLabel}>Est. Hours</div>
                  <div style={styles.predictionValue}>{predictionResult.predicted_hours}</div>
                </div>
                <div style={styles.predictionItem}>
                  <div style={styles.predictionLabel}>Confidence</div>
                  <div style={{ ...styles.predictionValue, color: '#12B886' }}>{predictionResult.confidence}%</div>
                </div>
                <div style={styles.predictionItem}>
                  <div style={styles.predictionLabel}>Team</div>
                  <div style={styles.predictionValue}>{predictionResult.suggested_team?.split(' ').slice(0, 2).join(' ') || 'N/A'}</div>
                </div>
              </div>
            )}
          </div>

          {/* Export/Upload */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.cardTitle}>
                <Database size={18} style={{ marginRight: 8, color: '#5AA9E6', verticalAlign: 'middle' }} />
                Data Intelligence
              </span>
              <span style={styles.cardSub}>
                <Cpu size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> ML Training
              </span>
            </div>

            <div style={styles.exportRow}>
              <select
                value={exportFormat}
                onChange={e => setExportFormat(e.target.value)}
                style={styles.select}
              >
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </select>
              <button onClick={downloadTemplate} style={styles.btnExport}>
                <Download size={14} /> Export
              </button>
            </div>

            <div style={{ marginTop: 8 }}>
              <div style={styles.uploadLabel}>
                <span style={{ fontSize: 12, color: '#b0b0b0' }}>Upload historical data for ML training:</span>
                {!isAdmin && (
                  <span style={styles.uploadLock}>
                    <Lock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    Admin access required
                  </span>
                )}
              </div>
              
              <form onSubmit={handleUpload} style={styles.uploadForm}>
                <div style={styles.uploadRow}>
                  <input
                    type="file"
                    accept=".csv,.json"
                    onChange={handleFileChange}
                    disabled={!isAdmin || isLoading}
                    style={{ ...styles.fileInput, ...((!isAdmin || isLoading) ? styles.inputDisabled : {}) }}
                  />
                  <button
                    type="submit"
                    disabled={!uploadFile || isLoading || !isAdmin}
                    style={{ ...styles.btnUpload, ...((!uploadFile || isLoading || !isAdmin) ? styles.btnDisabled : {}) }}
                  >
                    {isLoading ? <Loader size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Upload size={14} />}
                    {isLoading ? `${uploadProgress}%` : "Upload & Train"}
                  </button>
                </div>

                {uploadError && (
                  <div style={styles.uploadError}>
                    <AlertCircle size={14} /> {uploadError}
                  </div>
                )}

                {isLoading && uploadProgress > 0 && uploadProgress < 100 && (
                  <div style={styles.progressContainer}>
                    <div style={styles.progressBar}>
                      <div style={{ ...styles.progressFill, width: uploadProgress + '%' }} />
                    </div>
                    <div style={styles.progressText}>
                      <Loader size={12} style={{ animation: 'spin 0.8s linear infinite', verticalAlign: 'middle' }} />
                      Processing data... {uploadProgress}%
                    </div>
                  </div>
                )}

                {trainingResults && (
                  <div style={styles.trainingComplete}>
                    <CheckCircle size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    <strong>Training Complete!</strong>
                    <div style={styles.trainingStats}>
                      <span><BarChart3 size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {trainingResults.records_processed} records</span>
                      <span><GitBranch size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {trainingResults.new_patterns_discovered} new patterns</span>
                      <span><Target size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {trainingResults.training_accuracy}% accuracy</span>
                    </div>
                  </div>
                )}

                <div style={styles.uploadHint}>
                  Upload CSV or JSON with historical work order data to improve ML predictions
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function MLDashboardView({ userRole }) {
  const [assetData, setAssetData] = useState([]);
  const [liveHistory, setLiveHistory] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState('AST-001');
  const [testInput, setTestInput] = useState({ vibration: 2.1, temperature: 55, pressure: 2.5 });
  const [testResult, setTestResult] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [predictionHistory, setPredictionHistory] = useState([]);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/assets/health', { headers: authHeader() });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      setAssetData(data || []);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('[ML Dashboard] loadData:', err);
      const fallbackData = ASSETS.map((a, idx) => {
        const baseHealth = [85, 75, 55, 90, 35][idx % 5];
        return {
          ...a,
          healthScore: baseHealth + Math.round((Math.random() - 0.5) * 10),
          rul: Math.round(100 + Math.random() * 200),
          status: statusFromScore(baseHealth),
          sensors: {
            vibration: 1.5 + Math.random() * 4,
            temperature: 45 + Math.random() * 30,
            pressure: 2 + Math.random() * 3,
          }
        };
      });
      setAssetData(fallbackData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const id = setInterval(loadData, 8000);
    return () => clearInterval(id);
  }, [loadData]);

  useEffect(() => {
    const asset = assetData.find(a => a.id === selectedAsset);
    if (!asset) {
      const pts = Array.from({ length: 24 }, (_, i) => ({
        hour: `${String(i).padStart(2, '0')}:00`,
        health: 70 + (Math.random() - 0.5) * 10,
        rul: 150 + (i - 12) * 2 + (Math.random() - 0.5) * 10,
        anomaly: Math.random() < 0.05 ? 1 : 0,
      }));
      setLiveHistory(pts);
      return;
    }
    const base = asset.healthScore || 75;
    const pts = Array.from({ length: 24 }, (_, i) => {
      const noise = (Math.random() - 0.5) * 6;
      const trend = i < 16 ? 0 : (base < 50 ? -i * 0.3 : i * 0.15);
      return {
        hour: `${String(i).padStart(2, '0')}:00`,
        health: Math.max(5, Math.min(100, Math.round(base + noise + trend))),
        rul: Math.max(0, Math.round((asset.rul || 200) + (i - 12) * 1.2 + noise * 2)),
        anomaly: Math.random() < 0.07 ? 1 : 0,
      };
    });
    setLiveHistory(pts);
  }, [selectedAsset, assetData]);

  const calculatePrediction = useCallback((assetId, inputs) => {
    const vibrationScore = Math.max(0, Math.min(40, inputs.vibration * 4));
    const temperatureScore = Math.max(0, Math.min(30, (inputs.temperature - 30) * 0.8));
    const pressureScore = Math.max(0, Math.min(30, inputs.pressure * 3.5));
    
    let health = 100 - vibrationScore - temperatureScore - pressureScore;
    health = Math.max(0, Math.min(100, Math.round(health)));
    
    const status = statusFromScore(health);
    const rul = Math.round(Math.max(0, health * 4.5));
    const anomalyDetected = health < 40;
    
    const vibrationStatus = inputs.vibration >= VIBRATION_MAX_MM_S ? 'critical' : inputs.vibration >= VIBRATION_WARN_MM_S ? 'caution' : 'healthy';
    const temperatureStatus = inputs.temperature > 85 ? 'critical' : inputs.temperature > 70 ? 'caution' : 'healthy';
    const pressureStatus = inputs.pressure > 6 ? 'critical' : inputs.pressure > 4 ? 'caution' : 'healthy';
    
    return {
      asset_id: assetId,
      health_score: health,
      rul: rul,
      status: status,
      anomaly_detected: anomalyDetected,
      model_version: '2.0.0',
      sensors: {
        vibration: { value: inputs.vibration, status: vibrationStatus },
        temperature: { value: inputs.temperature, status: temperatureStatus },
        pressure: { value: inputs.pressure, status: pressureStatus }
      },
      explanation: `Vibration: ${inputs.vibration.toFixed(1)}mm/s (${vibrationStatus}), Temp: ${inputs.temperature.toFixed(0)}°C (${temperatureStatus}), Pressure: ${inputs.pressure.toFixed(1)}bar (${pressureStatus})`
    };
  }, []);

  useEffect(() => {
    const result = calculatePrediction(selectedAsset, testInput);
    setTestResult(result);
  }, [testInput, selectedAsset, calculatePrediction]);

  const presets = {
    normal: { label: 'Normal', icon: CheckCircle, color: '#12B886', vals: { vibration: 0.9, temperature: 52, pressure: 2.3 } },
    elevated: { label: 'High Vibration', icon: Activity, color: '#F0A93A', vals: { vibration: 5.2, temperature: 58, pressure: 2.5 } },
    hot: { label: 'High Temp', icon: Thermometer, color: '#F0A93A', vals: { vibration: 2.2, temperature: 82, pressure: 2.8 } },
    highPressure: { label: 'High Pressure', icon: Gauge, color: '#F0A93A', vals: { vibration: 2.5, temperature: 62, pressure: 6.5 } },
    critical: { label: 'Critical', icon: AlertCircle, color: '#E6484B', vals: { vibration: 7.8, temperature: 88, pressure: 5.5 } }
  };

  useEffect(() => {
    if (testResult) {
      setPredictionHistory(prev => [{
        timestamp: new Date().toLocaleTimeString(),
        ...testResult,
        inputs: { ...testInput }
      }, ...prev].slice(0, 10));
    }
  }, [testResult, testInput]);

  if (loading) {
    return (
      <div style={styles.loadingPage}>
        <div style={styles.loadingSpinner} />
        <p style={{ color: '#8493A6', marginTop: 16 }}>Loading dashboard data…</p>
      </div>
    );
  }

  const healthCounts = { healthy: 0, caution: 0, critical: 0 };
  assetData.forEach(a => { 
    const status = a.status || statusFromScore(a.healthScore || 0);
    healthCounts[status] = (healthCounts[status] || 0) + 1; 
  });
  const avgHealth = assetData.length ? Math.round(assetData.reduce((s, a) => s + (a.healthScore || 0), 0) / assetData.length) : 0;
  const avgRUL = assetData.length ? Math.round(assetData.reduce((s, a) => s + (a.rul || 0), 0) / assetData.length) : 0;
  const anomalyCount = assetData.filter(a => (a.status || statusFromScore(a.healthScore || 0)) === 'critical').length;

  const scatterData = assetData.map(a => ({
    x: a.sensors?.vibration || 2,
    y: a.sensors?.temperature || 55,
    health: a.healthScore,
    name: a.name,
    status: a.status || statusFromScore(a.healthScore || 0),
  }));

  const TABS = [
    { id: 'overview', label: 'Fleet Overview', icon: Layers },
    { id: 'predict', label: 'Prediction Tool', icon: Gauge },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'intelligence', label: 'AI Intelligence', icon: Brain },
  ];

  return (
    <div style={styles.root}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.5} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 5px rgba(239, 68, 68, 0.3); }
          50% { box-shadow: 0 0 20px rgba(239, 68, 68, 0.6); }
        }
        input[type=range] { accent-color: #5AA9E6; }
        .tab-btn:hover { background: rgba(255,255,255,0.06) !important; }
        .asset-chip:hover { opacity: 0.8; }
        .preset-btn:hover { background: rgba(255,255,255,0.12) !important; transform: translateY(-1px); }
        .preset-btn:active { transform: translateY(0px); }
        .critical-glow { animation: glow 2s infinite; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
      `}</style>

      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.headerTitle}>
            <Cpu size={24} style={{ marginRight: 12, color: '#5AA9E6' }} />
            Predictive Maintenance Dashboard
            <span style={styles.liveTag}>● Live</span>
          </div>
          <div style={styles.headerSub}>
            {lastUpdate && <span>Updated {lastUpdate.toLocaleTimeString()}</span>}
          </div>
        </div>
        <div style={styles.assetChipGroup}>
          {ASSETS.map(a => (
            <button
              key={a.id}
              className="asset-chip"
              onClick={() => setSelectedAsset(a.id)}
              style={{
                ...styles.assetChip,
                background: selectedAsset === a.id ? '#5AA9E6' : 'rgba(255,255,255,0.06)',
                color: selectedAsset === a.id ? '#fff' : '#b0b0b0',
                border: selectedAsset === a.id ? '1px solid #5AA9E660' : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {a.id}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div style={styles.kpiRow}>
        <MetricCard 
          label="Average Health" 
          value={`${avgHealth}/100`} 
          icon={Heart}
          color={avgHealth >= 70 ? '#12B886' : avgHealth >= 40 ? '#F0A93A' : '#E6484B'} 
          sub="Across all assets" 
        />
        <MetricCard 
          label="Average RUL" 
          value={`${avgRUL} days`} 
          icon={Clock}
          color="#5AA9E6" 
          sub="Remaining useful life" 
        />
        <MetricCard 
          label="At Risk" 
          value={anomalyCount} 
          icon={AlertTriangle}
          color="#E6484B" 
          sub="Critical status" 
        />
        <MetricCard 
          label="Healthy" 
          value={healthCounts.healthy || 0} 
          icon={CheckCircle}
          color="#12B886" 
          sub={`${healthCounts.caution || 0} caution · ${healthCounts.critical || 0} critical`} 
        />
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              className="tab-btn"
              onClick={() => setActiveTab(t.id)}
              style={{
                ...styles.tabBtn,
                color: activeTab === t.id ? '#fff' : '#8493A6',
                borderBottom: activeTab === t.id ? '2px solid #5AA9E6' : '2px solid transparent',
                background: activeTab === t.id ? 'rgba(26,115,232,0.08)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Icon size={16} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div style={styles.tabContent}>
          <div style={styles.gridTwo}>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.cardTitle}>
                  <LineChartIcon size={16} style={{ marginRight: 6, color: '#5AA9E6', verticalAlign: 'middle' }} />
                  Health Trend
                </span>
                <span style={styles.cardSub}>{ASSETS.find(a => a.id === selectedAsset)?.name}</span>
              </div>
              <div style={styles.cardSub}>Past 24 hours</div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={liveHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="hour" tick={{ fill: '#8493A6', fontSize: 10 }} interval={3} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#8493A6', fontSize: 10 }} />
                  <Tooltip contentStyle={styles.tooltip} />
                  <ReferenceLine y={70} stroke="#12B886" strokeDasharray="4 2" />
                  <ReferenceLine y={40} stroke="#F0A93A" strokeDasharray="4 2" />
                  <Line type="monotone" dataKey="health" stroke="#5AA9E6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <div style={styles.legend}>
                <span style={styles.legendItem}>
                  <span style={{ ...styles.legendDot, background: '#12B886' }} />
                  Healthy (70-100)
                </span>
                <span style={styles.legendItem}>
                  <span style={{ ...styles.legendDot, background: '#F0A93A' }} />
                  Caution (40-69)
                </span>
                <span style={styles.legendItem}>
                  <span style={{ ...styles.legendDot, background: '#E6484B' }} />
                  Critical (0-39)
                </span>
              </div>
            </div>

            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.cardTitle}>
                  <Timer size={16} style={{ marginRight: 6, color: '#12B886', verticalAlign: 'middle' }} />
                  Remaining Life
                </span>
                <span style={styles.cardSub}>{selectedAsset}</span>
              </div>
              <div style={styles.cardSub}>Days until maintenance</div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={liveHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="hour" tick={{ fill: '#8493A6', fontSize: 10 }} interval={3} />
                  <YAxis tick={{ fill: '#8493A6', fontSize: 10 }} />
                  <Tooltip contentStyle={styles.tooltip} />
                  <ReferenceLine y={30} stroke="#E6484B" strokeDasharray="4 2" />
                  <Line type="monotone" dataKey="rul" stroke="#12B886" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.cardTitle}>
                <BarChart3 size={16} style={{ marginRight: 6, color: '#5AA9E6', verticalAlign: 'middle' }} />
                Fleet Health Overview
              </span>
              <span style={styles.cardSub}>Current status of all assets</span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={assetData.map(a => ({ 
                name: a.name?.split(' ').slice(0, 2).join(' ') || a.id, 
                health: a.healthScore || 0, 
                status: a.status || statusFromScore(a.healthScore || 0)
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fill: '#8493A6', fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#8493A6', fontSize: 10 }} />
                <Tooltip contentStyle={styles.tooltip} />
                <Bar dataKey="health" radius={[4, 4, 0, 0]}>
                  {(assetData || []).map((a, i) => (
                    <Cell key={i} fill={STATUS_COLORS[a.status || statusFromScore(a.healthScore || 0)] || '#5AA9E6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={styles.legend}>
              {Object.entries(STATUS_COLORS).map(([s, c]) => (
                <span key={s} style={styles.legendItem}>
                  <span style={{ ...styles.legendDot, background: c }} />
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'predict' && (
        <div style={styles.tabContent}>
          <div style={styles.gridTwo}>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.cardTitle}>
                  <Gauge size={16} style={{ marginRight: 6, color: '#5AA9E6', verticalAlign: 'middle' }} />
                  Live Prediction
                </span>
                <span style={{ 
                  ...styles.cardSub, 
                  color: testResult?.status === 'critical' ? '#E6484B' : 
                         testResult?.status === 'caution' ? '#F0A93A' : '#12B886',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  {testResult?.status === 'critical' ? <AlertCircle size={14} /> : 
                   testResult?.status === 'caution' ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
                  {testResult?.status === 'critical' ? 'CRITICAL' : 
                   testResult?.status === 'caution' ? 'CAUTION' : 'HEALTHY'}
                </span>
              </div>
              <div style={styles.cardSub}>Adjust sensors → predictions update in real-time</div>

              <div style={{ marginBottom: 12 }}>
                <label style={styles.label}>Asset</label>
                <select
                  value={selectedAsset}
                  onChange={e => setSelectedAsset(e.target.value)}
                  style={styles.select}
                >
                  {ASSETS.map(a => <option key={a.id} value={a.id}>{a.id} — {a.name}</option>)}
                </select>
              </div>

              {[
                { key: 'vibration', label: 'Vibration', unit: 'mm/s', min: 0, max: 10, step: 0.1, 
                  healthy: '< 2.8', warning: '2.8-4.5', danger: '> 4.5' },
                { key: 'temperature', label: 'Temperature', unit: '°C', min: 20, max: 100, step: 1, 
                  healthy: '40-65', warning: '65-85', danger: '> 85' },
                { key: 'pressure', label: 'Pressure', unit: 'bar', min: 0, max: 8, step: 0.1, 
                  healthy: '1.5-3.5', warning: '3.5-6', danger: '> 6' },
              ].map(({ key, label, unit, min, max, step, healthy, warning, danger }) => {
                const value = testInput[key];
                const status = value > (key === 'vibration' ? VIBRATION_MAX_MM_S : key === 'temperature' ? 85 : 6) ? 'critical' :
                              value > (key === 'vibration' ? VIBRATION_WARN_MM_S : key === 'temperature' ? 70 : 4) ? 'caution' : 'healthy';
                
                return (
                  <div key={key} style={styles.sliderGroup}>
                    <div style={styles.sliderHeader}>
                      <label style={styles.label}>{label} ({unit})</label>
                      <span style={{ 
                        ...styles.sliderValue,
                        color: status === 'critical' ? '#E6484B' : 
                               status === 'caution' ? '#F0A93A' : '#12B886'
                      }}>
                        {value.toFixed(1)}
                      </span>
                    </div>
                    <input
                      type="range" min={min} max={max} step={step}
                      value={value}
                      onChange={e => setTestInput(p => ({ ...p, [key]: parseFloat(e.target.value) }))}
                      style={{ 
                        ...styles.sliderInput,
                        background: status === 'critical' ? '#E6484B' : 
                                   status === 'caution' ? '#F0A93A' : '#12B886'
                      }}
                    />
                    <div style={styles.sliderLabels}>
                      <span>{min}</span>
                      <span style={{ color: '#12B886' }}>✓ {healthy}</span>
                      <span style={{ color: '#F0A93A' }}>⚠ {warning}</span>
                      <span style={{ color: '#E6484B' }}>🚨 {danger}</span>
                      <span>{max}</span>
                    </div>
                  </div>
                );
              })}

              <div style={styles.presetSection}>
                <div style={styles.presetLabel}>Quick presets:</div>
                <div style={styles.presetGroup}>
                  {Object.entries(presets).map(([key, preset]) => {
                    const Icon = preset.icon;
                    return (
                      <button 
                        key={key} 
                        className="preset-btn"
                        onClick={() => setTestInput(preset.vals)}
                        style={{
                          ...styles.presetBtn,
                          borderColor: key === 'critical' ? '#E6484B' : 
                                     key === 'hot' || key === 'highPressure' || key === 'elevated' ? '#F0A93A' : 'rgba(255,255,255,0.08)',
                          background: testInput === preset.vals ? 'rgba(26,115,232,0.15)' : 'rgba(255,255,255,0.06)'
                        }}
                      >
                        <Icon size={16} color={preset.color} />
                        <span>{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={styles.predictionPanel}>
              {testResult ? (
                <div style={{ 
                  ...styles.card, 
                  borderTop: `3px solid ${STATUS_COLORS[testResult.status] || '#5AA9E6'}`,
                  ...(testResult.status === 'critical' ? styles.criticalCard : {})
                }}>
                  <div style={styles.cardHeader}>
                    <span style={styles.cardTitle}>
                      <Target size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                      Prediction Result
                    </span>
                    <StatusBadge status={testResult.status} />
                  </div>
                  {testResult.explanation && (
                    <div style={styles.explanationText}>{testResult.explanation}</div>
                  )}
                  
                  <div style={styles.resultGrid}>
                    <div style={styles.resultItem}>
                      <span style={styles.resultLabel}>Health Score</span>
                      <span style={{ ...styles.resultValue, color: STATUS_COLORS[testResult.status] }}>
                        {testResult.health_score} / 100
                      </span>
                    </div>
                    <div style={styles.resultItem}>
                      <span style={styles.resultLabel}>Time Until Failure</span>
                      <span style={styles.resultValue}>{testResult.rul} days</span>
                    </div>
                    <div style={styles.resultItem}>
                      <span style={styles.resultLabel}>Anomaly Detected</span>
                      <span style={{ ...styles.resultValue, color: testResult.anomaly_detected ? '#E6484B' : '#12B886' }}>
                        {testResult.anomaly_detected ? <AlertCircle size={14} style={{ verticalAlign: 'middle' }} /> : <CheckCircle size={14} style={{ verticalAlign: 'middle' }} />}
                        {testResult.anomaly_detected ? ' Yes' : ' No'}
                      </span>
                    </div>
                    <div style={styles.resultItem}>
                      <span style={styles.resultLabel}>Model Version</span>
                      <span style={styles.resultValue}>{testResult.model_version || '2.0.0'}</span>
                    </div>
                  </div>

                  <div style={styles.sensorGrid}>
                    {testResult.sensors && Object.entries(testResult.sensors).map(([key, data]) => (
                      <SensorIndicator
                        key={key}
                        label={key.charAt(0).toUpperCase() + key.slice(1)}
                        value={data.value}
                        unit={key === 'vibration' ? 'mm/s' : key === 'temperature' ? '°C' : 'bar'}
                        status={data.status}
                      />
                    ))}
                  </div>

                  {testResult.status === 'critical' && (
                    <div className="critical-glow" style={{ ...styles.warningBox, ...styles.warningCritical }}>
                      <AlertCircle size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                      CRITICAL ALERT: This asset needs immediate attention!
                    </div>
                  )}
                  {testResult.status === 'caution' && (
                    <div style={{ ...styles.warningBox, ...styles.warningCaution }}>
                      <AlertTriangle size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                      CAUTION: Monitor this asset closely. Plan maintenance soon.
                    </div>
                  )}
                  {testResult.status === 'healthy' && (
                    <div style={{ ...styles.warningBox, ...styles.warningHealthy }}>
                      <CheckCircle size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                      HEALTHY: Asset is in good condition. Continue normal monitoring.
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ ...styles.card, ...styles.emptyState }}>
                  <Gauge size={40} style={{ marginBottom: 12 }} />
                  <div>Adjust sensor values to see predictions</div>
                  <div style={styles.emptySubtext}>Predictions update in real-time</div>
                </div>
              )}

              {predictionHistory.length > 0 && (
                <div style={styles.card}>
                  <div style={styles.cardHeader}>
                    <span style={styles.cardTitle}>
                      <Clock size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                      Recent Predictions
                    </span>
                    <span style={styles.cardSub}>Last {predictionHistory.length} runs</span>
                  </div>
                  <div style={styles.historyContainer}>
                    {predictionHistory.slice(0, 10).map((p, i) => (
                      <div key={i} style={styles.historyItem}>
                        <span style={styles.historyTime}>{p.timestamp}</span>
                        <span style={{ ...styles.historyScore, color: STATUS_COLORS[p.status] }}>
                          {p.health_score}%
                        </span>
                        <StatusBadge status={p.status} />
                        <span style={styles.historyRul}>{p.rul} days</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div style={styles.tabContent}>
          <div style={styles.gridTwo}>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.cardTitle}>
                  <ScatterChartIcon size={16} style={{ marginRight: 6, color: '#5AA9E6', verticalAlign: 'middle' }} />
                  Health Map
                </span>
                <span style={styles.cardSub}>Vibration vs Temperature by status</span>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="x" name="Vibration" unit=" mm/s" domain={[0, 8]} tick={{ fill: '#8493A6', fontSize: 10 }} />
                  <YAxis dataKey="y" name="Temperature" unit="°C" tick={{ fill: '#8493A6', fontSize: 10 }} />
                  {ISO_VIBRATION_ZONES.map(zone => (
                    <ReferenceArea
                      key={zone.id}
                      x1={zone.min}
                      x2={zone.max}
                      fill={zone.color}
                      fillOpacity={0.06}
                      stroke={zone.color}
                      strokeOpacity={0.2}
                      ifOverflow="extendDomain"
                    />
                  ))}
                  <Tooltip contentStyle={styles.tooltip} />
                  <Scatter data={scatterData} name="Assets">
                    {scatterData.map((entry, i) => (
                      <Cell key={i} fill={STATUS_COLORS[entry.status] || '#5AA9E6'} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
              <div style={styles.zoneLabels}>
                {ISO_VIBRATION_ZONES.map(zone => (
                  <span key={zone.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#9aa0a6' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: zone.color, display: 'inline-block' }} />
                    ISO {zone.label} ({zone.min}–{zone.max === 8 ? '∞' : zone.max} mm/s)
                  </span>
                ))}
              </div>
              <div style={styles.legend}>
                {Object.entries(STATUS_COLORS).map(([s, c]) => (
                  <span key={s} style={styles.legendItem}>
                    <span style={{ ...styles.legendDot, background: c }} />
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </span>
                ))}
              </div>
            </div>

            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.cardTitle}>
                  <AlertCircle size={16} style={{ marginRight: 6, color: '#E6484B', verticalAlign: 'middle' }} />
                  Anomaly History
                </span>
                <span style={styles.cardSub}>{selectedAsset} · 24h window</span>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={liveHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="hour" tick={{ fill: '#8493A6', fontSize: 10 }} interval={3} />
                  <YAxis tick={{ fill: '#8493A6', fontSize: 10 }} domain={[0, 1]} ticks={[0, 1]} />
                  <Tooltip contentStyle={styles.tooltip} />
                  <Bar dataKey="anomaly" fill="#E6484B" radius={[2, 2, 0, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
              <div style={styles.anomalyStats}>
                Anomalies: <strong style={{ color: '#E6484B' }}>{liveHistory.filter(p => p.anomaly).length}</strong>
                &nbsp;·&nbsp; Rate: <strong style={{ color: '#F0A93A' }}>
                  {liveHistory.length ? (liveHistory.filter(p => p.anomaly).length / liveHistory.length * 100).toFixed(1) : 0}%
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'intelligence' && <MLIntelligenceView userRole={userRole} />}
    </div>
  );
}