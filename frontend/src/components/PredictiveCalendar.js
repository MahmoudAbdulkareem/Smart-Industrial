// frontend/src/components/PredictiveCalendar.js
import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { 
    Calendar as CalendarIcon, 
    Clock, 
    AlertCircle, 
    CheckCircle, 
    XCircle, 
    Wrench, 
    Zap, 
    AlertTriangle, 
    MapPin,
    Brain,
    TrendingUp,
    TrendingDown,
    Activity,
    BarChart3,
    Users,
    Settings,
    Shield,
    Award,
    Target,
    Sun,
    Moon,
    Cloud,
    CloudSun,
    CloudMoon,
    ChevronRight,
    ChevronLeft,
    Info,
    BookOpen,
    FileText,
    Download,
    RefreshCw,
    Bell,
    BellOff,
    Eye,
    EyeOff,
    Star,
    StarOff,
    Heart,
    HeartOff,
    Flag,
    FlagOff,
    Plus,
    Minus,
    Maximize2,
    Minimize2,
    MoreHorizontal,
    MoreVertical,
    CalendarDays,
    CalendarRange,
    CalendarClock,
    Timer,
    Stopwatch,
    Gauge,
    Thermometer,
    Droplet,
    Wind,
    Compass,
    Navigation,
    Home,
    Building,
    Factory,
    Warehouse,
    Truck,
    Package,
    Box,
    Cpu,
    HardDrive,
    Server,
    Database,
    Cloud as CloudIcon,
    Wifi,
    WifiOff,
    Signal,
    Bluetooth,
    Battery,
    BatteryCharging,
    Plug,
    Power,
    Zap as ZapIcon,
    Flame,
    Droplet as DropletIcon,
    Activity as ActivityIcon
} from 'lucide-react';

const localizer = momentLocalizer(moment);

function PredictiveCalendar({ userRole }) {
  const [events, setEvents] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [view, setView] = useState('month');
  const [date, setDate] = useState(new Date());

  const API_BASE_URL = process.env.REACT_APP_API_URL || "";

  function authHeaders() {
    const token = localStorage.getItem("token");
    return { 
      Authorization: token ? "Bearer " + token : "", 
      "Content-Type": "application/json" 
    };
  }

  // ── Load Calendar Data ────────────────────────────────────────────────────
  const loadCalendarData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/maintenance/predictions`, {
        headers: authHeaders()
      });
      
      if (res.ok) {
        const data = await res.json();
        setPredictions(data.predictions || []);
        setSuggestions(data.suggestions || []);
        
        const calendarEvents = (data.predictions || []).map(p => ({
          id: p.id,
          title: p.maintenance_type,
          start: new Date(p.recommended_date),
          end: new Date(new Date(p.recommended_date).getTime() + (p.estimated_duration || 2) * 60 * 60 * 1000),
          resource: p,
          priority: p.priority || 'Medium',
          status: p.status || 'Scheduled',
          allDay: false,
          assetName: p.asset_name || 'Unknown Asset',
          assetId: p.asset_id || 'N/A'
        }));
        
        setEvents(calendarEvents);
      } else {
        setFallbackData();
      }
    } catch (error) {
      console.error("Failed to load calendar data:", error);
      setFallbackData();
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL]);

  // ── Fallback Data ────────────────────────────────────────────────────────
  const setFallbackData = () => {
    const now = Date.now();
    const fallbackEvents = [
      {
        id: 1,
        title: 'Bearing Replacement',
        start: new Date(now + 2 * 24 * 60 * 60 * 1000),
        end: new Date(now + 2 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
        priority: 'High',
        status: 'Scheduled',
        assetName: 'Compressor A',
        assetId: 'AST-001',
        resource: { 
          asset_id: 'AST-001', 
          asset_name: 'Compressor A',
          asset_type: 'Compressor',
          location: 'Zone 1',
          health_score: 72,
          description: 'Bearing wear detected. Recommended replacement to prevent failure.'
        }
      },
      {
        id: 2,
        title: 'Energy Efficiency Audit',
        start: new Date(now + 5 * 24 * 60 * 60 * 1000),
        end: new Date(now + 5 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        priority: 'Medium',
        status: 'Recommended',
        assetName: 'Motor Drive E',
        assetId: 'AST-005',
        resource: { 
          asset_id: 'AST-005', 
          asset_name: 'Motor Drive E',
          asset_type: 'Motor',
          location: 'Zone 4',
          health_score: 64,
          description: 'Energy consumption above optimal levels. Audit recommended.'
        }
      },
      {
        id: 3,
        title: 'Emergency Pump Repair',
        start: new Date(now + 1 * 24 * 60 * 60 * 1000),
        end: new Date(now + 1 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000),
        priority: 'Critical',
        status: 'Urgent',
        assetName: 'Pump Station B',
        assetId: 'AST-002',
        resource: { 
          asset_id: 'AST-002', 
          asset_name: 'Pump Station B',
          asset_type: 'Pump',
          location: 'Zone 2',
          health_score: 66,
          description: 'Critical pump failure imminent. Immediate intervention required.'
        }
      },
      {
        id: 4,
        title: 'Routine Conveyor Inspection',
        start: new Date(now + 7 * 24 * 60 * 60 * 1000),
        end: new Date(now + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        priority: 'Low',
        status: 'Scheduled',
        assetName: 'Conveyor Belt C',
        assetId: 'AST-003',
        resource: { 
          asset_id: 'AST-003', 
          asset_name: 'Conveyor Belt C',
          asset_type: 'Conveyor',
          location: 'Zone 3',
          health_score: 86,
          description: 'Standard preventative maintenance inspection.'
        }
      },
      {
        id: 5,
        title: 'Filter Replacement',
        start: new Date(now + 4 * 24 * 60 * 60 * 1000),
        end: new Date(now + 4 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000),
        priority: 'Medium',
        status: 'Scheduled',
        assetName: 'HVAC Unit D',
        assetId: 'AST-004',
        resource: { 
          asset_id: 'AST-004', 
          asset_name: 'HVAC Unit D',
          asset_type: 'HVAC',
          location: 'Zone 1',
          health_score: 87,
          description: 'Filter maintenance and system check.'
        }
      }
    ];
    
    setEvents(fallbackEvents);
    setPredictions(fallbackEvents.map(e => e.resource));
    setSuggestions([
      'Critical maintenance requires immediate attention for Pump Station B',
      'Schedule high-priority tasks during off-peak hours to minimize production impact',
      'Consider grouping maintenance for assets in Zone 1 to reduce downtime',
      'Optimal maintenance window: Night shift (10PM-6AM) for critical assets'
    ]);
  };

  useEffect(() => {
    loadCalendarData();
  }, [loadCalendarData]);

  // ── Event Style Getter ──────────────────────────────────────────────────
  const eventStyleGetter = (event) => {
    const priorityConfig = {
      Critical: { bg: '#E6484B', lightBg: '#E6484B20', border: '#E6484B' },
      High: { bg: '#F0A93A', lightBg: '#F0A93A20', border: '#C97F1E' },
      Medium: { bg: '#5AA9E6', lightBg: '#5AA9E620', border: '#5AA9E6' },
      Low: { bg: '#12B886', lightBg: '#12B88620', border: '#12B886' }
    };

    const config = priorityConfig[event.priority] || priorityConfig.Medium;

    return {
      style: {
        backgroundColor: config.bg,
        borderColor: config.border,
        borderRadius: '6px',
        color: 'white',
        padding: '4px 8px',
        fontWeight: 600,
        fontSize: '11px',
        cursor: 'pointer',
        border: '1px solid ' + config.border,
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        opacity: event.status === 'Completed' ? 0.6 : 1
      }
    };
  };

  // ── Event Selection ─────────────────────────────────────────────────────
  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
  };

  // ── Custom Event Component ─────────────────────────────────────────────
  const EventComponent = ({ event }) => {
    const priorityIcons = {
      Critical: <AlertCircle size={10} style={{ marginRight: 4 }} />,
      High: <AlertTriangle size={10} style={{ marginRight: 4 }} />,
      Medium: <Zap size={10} style={{ marginRight: 4 }} />,
      Low: <CheckCircle size={10} style={{ marginRight: 4 }} />
    };

    return (
      <div style={{ display: 'flex', alignItems: 'center', fontSize: '11px' }}>
        {priorityIcons[event.priority] || priorityIcons.Medium}
        <span style={{ fontWeight: 600 }}>{event.title}</span>
        <span style={{ 
          marginLeft: 4, 
          opacity: 0.8,
          fontSize: '9px',
          fontWeight: 'normal'
        }}>
          {event.assetName}
        </span>
      </div>
    );
  };

  // ── Format Date Info ────────────────────────────────────────────────────
  const formatDateInfo = (date) => {
    return {
      date: moment(date).format('dddd, MMMM D, YYYY'),
      time: moment(date).format('h:mm A'),
      fromNow: moment(date).fromNow(),
      isToday: moment(date).isSame(moment(), 'day'),
      isTomorrow: moment(date).isSame(moment().add(1, 'day'), 'day'),
      isThisWeek: moment(date).isSame(moment(), 'week')
    };
  };

  // ── Loading State ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner}></div>
        <p style={styles.loadingText}>Loading maintenance predictions...</p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={styles.container}>
      <style>{`
        .rbc-event {
          border-radius: 6px !important;
          font-weight: 600 !important;
          transition: all 0.2s ease !important;
          border: none !important;
        }
        .rbc-event:hover {
          transform: scale(1.02);
          box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
        }
        .rbc-toolbar {
          color: #E8EEF4 !important;
          padding: 8px 0 !important;
        }
        .rbc-toolbar button {
          color: #E8EEF4 !important;
          background: rgba(255,255,255,0.05) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          border-radius: 6px !important;
          padding: 6px 16px !important;
          transition: all 0.2s ease !important;
        }
        .rbc-toolbar button:hover {
          background: rgba(90, 169, 230, 0.2) !important;
          border-color: #5AA9E6 !important;
        }
        .rbc-toolbar button.rbc-active {
          background: #5AA9E6 !important;
          border-color: #5AA9E6 !important;
        }
        .rbc-toolbar-label {
          font-weight: 700 !important;
          font-size: 18px !important;
        }
        .rbc-month-view, .rbc-time-view {
          background: rgba(24, 33, 48, 0.6) !important;
          border-radius: 12px !important;
          border: 1px solid rgba(255,255,255,0.06) !important;
        }
        .rbc-header {
          color: #8493A6 !important;
          padding: 12px !important;
          border-bottom: 1px solid rgba(255,255,255,0.06) !important;
          font-weight: 600 !important;
          font-size: 12px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
        }
        .rbc-day-bg {
          background: transparent !important;
        }
        .rbc-off-range-bg {
          background: rgba(0,0,0,0.2) !important;
        }
        .rbc-date-cell {
          color: #E8EEF4 !important;
          font-size: 13px !important;
        }
        .rbc-date-cell.rbc-now {
          color: #5AA9E6 !important;
          font-weight: 700 !important;
        }
        .rbc-today {
          background: rgba(90, 169, 230, 0.08) !important;
        }
        .rbc-month-row {
          min-height: 80px !important;
        }
        .rbc-row-content {
          z-index: 1 !important;
        }
        .rbc-show-more {
          color: #5AA9E6 !important;
          font-weight: 600 !important;
          background: rgba(90, 169, 230, 0.1) !important;
          padding: 2px 8px !important;
          border-radius: 4px !important;
        }
        .rbc-show-more:hover {
          background: rgba(90, 169, 230, 0.2) !important;
        }
        .rbc-event-label {
          display: none !important;
        }
        .rbc-row-segment {
          padding: 2px 4px !important;
        }
      `}</style>

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.headerIcon}>
            <CalendarIcon size={24} />
          </div>
          <div>
           <h1 style={{ ...styles.title, display: 'inline-flex', alignItems: 'center' }}>
  <Brain size={20} style={{ marginRight: 8, color: '#5AA9E6' }} />
  Predictive Maintenance Calendar
</h1>
           
          </div>
        </div>
        <div style={styles.headerStats}>
          <div style={styles.statItem}>
            <Wrench size={14} style={{ color: '#5AA9E6' }} />
            <span>{predictions.length} Predictions</span>
          </div>
          <div style={styles.statItem}>
            <Brain size={14} style={{ color: '#12B886' }} />
            <span>{suggestions.length} AI Suggestions</span>
          </div>
        </div>
      </div>

      {/* AI Suggestions Bar */}
      {suggestions.length > 0 && (
        <div style={styles.suggestionsBar}>
          <div style={styles.suggestionsIcon}>
            <Brain size={24} />
          </div>
          <div style={styles.suggestionsContent}>
            <strong>AI Recommendations:</strong>
            {suggestions.slice(0, 4).map((s, i) => (
              <span key={i} style={styles.suggestionTag}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Calendar */}
      <div style={styles.calendarWrapper}>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={styles.calendar}
          eventPropGetter={eventStyleGetter}
          onSelectEvent={handleSelectEvent}
          views={['month', 'week', 'day']}
          view={view}
          onView={setView}
          date={date}
          onNavigate={setDate}
          components={{
            event: EventComponent
          }}
          popup
          messages={{
            next: "Next",
            previous: "Prev",
            today: "Today",
            month: "Month",
            week: "Week",
            day: "Day"
          }}
        />
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div style={styles.modalOverlay} onClick={() => setSelectedEvent(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            {/* Priority Badge */}
            <div style={styles.modalPriorityBadge}>
              <span style={{
                ...styles.priorityBadge,
                backgroundColor: 
                  selectedEvent.priority === 'Critical' ? '#E6484B20' :
                  selectedEvent.priority === 'High' ? '#F0A93A20' :
                  selectedEvent.priority === 'Medium' ? '#5AA9E620' : '#12B88620',
                color: 
                  selectedEvent.priority === 'Critical' ? '#E6484B' :
                  selectedEvent.priority === 'High' ? '#F0A93A' :
                  selectedEvent.priority === 'Medium' ? '#5AA9E6' : '#12B886',
                border: `1px solid ${
                  selectedEvent.priority === 'Critical' ? '#E6484B40' :
                  selectedEvent.priority === 'High' ? '#F0A93A40' :
                  selectedEvent.priority === 'Medium' ? '#5AA9E640' : '#12B88640'
                }`,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}>
                {selectedEvent.priority === 'Critical' ? <AlertCircle size={12} /> :
                 selectedEvent.priority === 'High' ? <AlertTriangle size={12} /> :
                 selectedEvent.priority === 'Medium' ? <ZapIcon size={12} /> :
                 <CheckCircle size={12} />}
                {selectedEvent.priority} Priority
              </span>
              <span style={{
                ...styles.statusBadge,
                backgroundColor: 
                  selectedEvent.status === 'Urgent' ? '#E6484B20' :
                  selectedEvent.status === 'Scheduled' ? '#5AA9E620' :
                  selectedEvent.status === 'Recommended' ? '#F0A93A20' : '#12B88620',
                color: 
                  selectedEvent.status === 'Urgent' ? '#E6484B' :
                  selectedEvent.status === 'Scheduled' ? '#5AA9E6' :
                  selectedEvent.status === 'Recommended' ? '#F0A93A' : '#12B886',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}>
                {selectedEvent.status === 'Urgent' ? <Bell size={12} /> :
                 selectedEvent.status === 'Scheduled' ? <CalendarClock size={12} /> :
                 selectedEvent.status === 'Recommended' ? <TrendingUp size={12} /> :
                 <CheckCircle size={12} />}
                {selectedEvent.status}
              </span>
            </div>

            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                <Wrench size={18} style={{ marginRight: 8, color: '#5AA9E6', verticalAlign: 'middle' }} />
                {selectedEvent.title}
              </h2>
              <button style={styles.modalClose} onClick={() => setSelectedEvent(null)}>
                <XCircle size={20} />
              </button>
            </div>

            <div style={styles.modalBody}>
              {/* Asset Info */}
              <div style={styles.modalSection}>
                <h3 style={styles.modalSectionTitle}>
                  <Box size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  Asset Information
                </h3>
                <div style={styles.modalGrid}>
                  <div style={styles.modalGridItem}>
                    <label style={styles.modalLabel}>Asset Name</label>
                    <span style={styles.modalValue}>{selectedEvent.assetName}</span>
                  </div>
                  <div style={styles.modalGridItem}>
                    <label style={styles.modalLabel}>Asset ID</label>
                    <span style={{ ...styles.modalValue, fontFamily: "'IBM Plex Mono', monospace" }}>
                      {selectedEvent.assetId}
                    </span>
                  </div>
                  <div style={styles.modalGridItem}>
                    <label style={styles.modalLabel}>Type</label>
                    <span style={styles.modalValue}>{selectedEvent.resource?.asset_type || 'N/A'}</span>
                  </div>
                  <div style={styles.modalGridItem}>
                    <label style={styles.modalLabel}>Location</label>
                    <span style={styles.modalValue}>
                      <MapPin size={12} style={{ marginRight: 4, display: 'inline', verticalAlign: 'middle' }} />
                      {selectedEvent.resource?.location || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Date & Time Info */}
              <div style={styles.modalSection}>
                <h3 style={styles.modalSectionTitle}>
                  <CalendarClock size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  Schedule Information
                </h3>
                <div style={styles.dateInfoGrid}>
                  <div style={styles.dateInfoCard}>
                    <CalendarIcon size={16} style={{ color: '#5AA9E6' }} />
                    <div>
                      <div style={styles.dateInfoLabel}>Date</div>
                      <div style={styles.dateInfoValue}>
                        {formatDateInfo(selectedEvent.start).date}
                      </div>
                      <div style={styles.dateInfoMeta}>
                        {formatDateInfo(selectedEvent.start).isToday && <span>● Today</span>}
                        {formatDateInfo(selectedEvent.start).isTomorrow && <span>● Tomorrow</span>}
                        {formatDateInfo(selectedEvent.start).isThisWeek && !formatDateInfo(selectedEvent.start).isToday && !formatDateInfo(selectedEvent.start).isTomorrow && <span>● This Week</span>}
                        <span style={{ marginLeft: 8, color: '#8493A6' }}>
                          {formatDateInfo(selectedEvent.start).fromNow}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={styles.dateInfoCard}>
                    <Clock size={16} style={{ color: '#12B886' }} />
                    <div>
                      <div style={styles.dateInfoLabel}>Time</div>
                      <div style={styles.dateInfoValue}>
                        {formatDateInfo(selectedEvent.start).time}
                      </div>
                      <div style={styles.dateInfoMeta}>
                        <Timer size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                        Duration: {moment.duration(moment(selectedEvent.end).diff(moment(selectedEvent.start))).humanize()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Health Score */}
              {selectedEvent.resource?.health_score && (
                <div style={styles.modalSection}>
                  <h3 style={styles.modalSectionTitle}>
                    <Gauge size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                    Asset Health
                  </h3>
                  <div style={styles.healthScoreContainer}>
                    <div style={styles.healthScoreBar}>
                      <div style={{
                        ...styles.healthScoreFill,
                        width: `${selectedEvent.resource.health_score}%`,
                        backgroundColor: 
                          selectedEvent.resource.health_score >= 70 ? '#12B886' :
                          selectedEvent.resource.health_score >= 40 ? '#F0A93A' : '#E6484B'
                      }} />
                    </div>
                    <span style={styles.healthScoreText}>
                      {selectedEvent.resource.health_score}%
                    </span>
                  </div>
                </div>
              )}

              {/* Description */}
              {selectedEvent.resource?.description && (
                <div style={styles.modalSection}>
                  <h3 style={styles.modalSectionTitle}>
                    <FileText size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                    Description
                  </h3>
                  <p style={styles.modalDescription}>{selectedEvent.resource.description}</p>
                </div>
              )}

              {/* Optimal Times */}
              <div style={styles.modalSection}>
                <h3 style={styles.modalSectionTitle}>
                  <Award size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  AI Recommended Times
                </h3>
                <div style={styles.optimalTimes}>
                  {[
                    { label: 'Morning Shift (8AM - 12PM)', time: '08:00', icon: Sun },
                    { label: 'Afternoon Shift (1PM - 5PM)', time: '13:00', icon: CloudSun },
                    { label: 'Night Shift (10PM - 6AM)', time: '22:00', icon: Moon }
                  ].map((time, i) => {
                    const Icon = time.icon;
                    return (
                      <button 
                        key={i} 
                        style={styles.optimalTimeBtn}
                        onClick={() => {
                          const newStart = new Date(selectedEvent.start);
                          const [hours] = time.time.split(':').map(Number);
                          newStart.setHours(hours, 0, 0, 0);
                          alert(`✅ Selected ${time.label} for this maintenance task.`);
                        }}
                      >
                        <Icon size={16} style={{ marginRight: 8 }} />
                        {time.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              {userRole === 'maintenance_engineer' && (
                <div style={styles.modalActions}>
                  <button style={styles.modalBtnPrimary}>
                    <CheckCircle size={14} style={{ marginRight: 6 }} />
                    Confirm Schedule
                  </button>
                  <button style={styles.modalBtnSecondary}>
                    <Clock size={14} style={{ marginRight: 6 }} />
                    Reschedule
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    padding: '24px',
    background: '#0B0F14',
    borderRadius: '16px',
    minHeight: '100vh'
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '400px',
    gap: '16px'
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    border: '3px solid rgba(255,255,255,0.1)',
    borderTop: '3px solid #5AA9E6',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite'
  },
  loadingText: {
    color: '#8493A6',
    fontSize: '14px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px'
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  headerIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '44px',
    height: '44px',
    background: 'rgba(90, 169, 230, 0.1)',
    borderRadius: '10px',
    color: '#5AA9E6'
  },
  title: {
    fontSize: '22px',
    fontWeight: 800,
    color: '#fff',
    margin: 0
  },
  subtitle: {
    fontSize: '13px',
    color: '#8493A6',
    margin: '4px 0 0 0'
  },
  headerStats: {
    display: 'flex',
    gap: '12px'
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.06)',
    color: '#E8EEF4',
    fontSize: '13px',
    fontWeight: 500
  },
  suggestionsBar: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '14px 18px',
    background: 'rgba(124, 58, 237, 0.08)',
    borderRadius: '10px',
    border: '1px solid rgba(124, 58, 237, 0.15)'
  },
  suggestionsIcon: {
    fontSize: '20px',
    lineHeight: 1.4,
    color: '#8B5CF6'
  },
  suggestionsContent: {
    color: '#E8EEF4',
    fontSize: '13px',
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    alignItems: 'center',
    lineHeight: 1.6
  },
  suggestionTag: {
    padding: '2px 12px',
    background: 'rgba(124, 58, 237, 0.15)',
    borderRadius: '12px',
    fontSize: '12px',
    border: '1px solid rgba(124, 58, 237, 0.1)'
  },
  calendarWrapper: {
    height: '650px',
    color: '#E8EEF4',
    borderRadius: '12px',
    overflow: 'hidden'
  },
  calendar: {
    height: '100%'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    animation: 'fadeIn 0.25s ease'
  },
  modal: {
    background: '#182130',
    borderRadius: '16px',
    padding: '28px',
    maxWidth: '560px',
    width: '92%',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 32px 64px rgba(0,0,0,0.6)',
    maxHeight: '90vh',
    overflowY: 'auto'
  },
  modalPriorityBadge: {
    display: 'flex',
    gap: '10px',
    marginBottom: '16px',
    flexWrap: 'wrap'
  },
  priorityBadge: {
    padding: '4px 14px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  statusBadge: {
    padding: '4px 14px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px'
  },
  modalTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#fff',
    margin: 0,
    lineHeight: 1.3
  },
  modalClose: {
    background: 'none',
    border: 'none',
    color: '#8493A6',
    cursor: 'pointer',
    padding: '4px',
    transition: 'color 0.2s'
  },
  modalBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px'
  },
  modalSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  modalSectionTitle: {
    fontSize: '12px',
    color: '#8493A6',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    margin: 0
  },
  modalGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px'
  },
  modalGridItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  modalLabel: {
    fontSize: '11px',
    color: '#8493A6',
    fontWeight: 500
  },
  modalValue: {
    fontSize: '13px',
    color: '#E8EEF4',
    fontWeight: 600
  },
  dateInfoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px'
  },
  dateInfoCard: {
    display: 'flex',
    gap: '12px',
    padding: '12px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.05)',
    alignItems: 'flex-start'
  },
  dateInfoLabel: {
    fontSize: '10px',
    color: '#8493A6',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontWeight: 600
  },
  dateInfoValue: {
    fontSize: '14px',
    color: '#E8EEF4',
    fontWeight: 600,
    marginTop: '2px'
  },
  dateInfoMeta: {
    fontSize: '11px',
    color: '#5AA9E6',
    marginTop: '4px'
  },
  healthScoreContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  healthScoreBar: {
    flex: 1,
    height: '8px',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  healthScoreFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.6s ease'
  },
  healthScoreText: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#E8EEF4',
    minWidth: '44px',
    textAlign: 'right'
  },
  modalDescription: {
    fontSize: '13px',
    lineHeight: 1.6,
    color: '#E8EEF4',
    margin: 0,
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.05)'
  },
  optimalTimes: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  optimalTimeBtn: {
    padding: '8px 14px',
    background: 'rgba(255,255,255,0.04)',
    color: '#E8EEF4',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    transition: 'all 0.2s ease',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center'
  },
  modalActions: {
    display: 'flex',
    gap: '10px',
    marginTop: '4px'
  },
  modalBtnPrimary: {
    flex: 1,
    padding: '10px 20px',
    background: '#5AA9E6',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease'
  },
  modalBtnSecondary: {
    flex: 1,
    padding: '10px 20px',
    background: 'rgba(255,255,255,0.05)',
    color: '#E8EEF4',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease'
  }
};

// Add keyframes
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
document.head.appendChild(styleSheet);

export default PredictiveCalendar;