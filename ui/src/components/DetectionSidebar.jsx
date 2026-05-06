import { motion, AnimatePresence } from 'framer-motion'

export default function DetectionSidebar({ detections, alerts, metrics }) {
  const normal = detections.filter(d => !d.defect)
  const defects = detections.filter(d => d.defect)

  return (
    <div style={{
      width: 280, flexShrink: 0, background: '#FFFFFF',
      borderLeft: '1px solid #E2E8F0', display: 'flex',
      flexDirection: 'column', overflow: 'hidden'
    }}>

      {/* ── A. Live Detections ── */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #F1F5F9' }}>
        <div className="flex items-center gap-2 mb-3">
          <div style={{ width: 3, height: 14, background: '#0EA5E9', borderRadius: 2 }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#64748B' }}>
            LIVE DETECTIONS
          </span>
          <span style={{
            marginLeft: 'auto', fontSize: 10, fontWeight: 600,
            background: '#F0F9FF', color: '#0EA5E9',
            padding: '1px 6px', borderRadius: 10, border: '1px solid #BAE6FD'
          }}>
            {detections.length}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <AnimatePresence mode="popLayout">
            {normal.map(det => (
              <motion.div
                key={det.track_id}
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                style={{
                  background: '#F8FAFC', border: '1px solid #E2E8F0',
                  borderRadius: 8, padding: '8px 10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A' }}>{det.label}</div>
                  <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>Track #{det.track_id}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0EA5E9' }}>
                    {Math.round(det.confidence * 100)}%
                  </div>
                  <ConfBar value={det.confidence} color="#0EA5E9" />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {normal.length === 0 && (
            <div style={{ fontSize: 11, color: '#CBD5E1', textAlign: 'center', padding: '8px 0' }}>
              No detections
            </div>
          )}
        </div>
      </div>

      {/* ── B. Defect Alerts ── */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #F1F5F9' }}>
        <div className="flex items-center gap-2 mb-3">
          <div style={{ width: 3, height: 14, background: '#EF4444', borderRadius: 2 }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#64748B' }}>
            DEFECT ALERTS
          </span>
          {defects.length > 0 && (
            <span style={{
              marginLeft: 'auto', fontSize: 10, fontWeight: 600,
              background: '#FEF2F2', color: '#EF4444',
              padding: '1px 6px', borderRadius: 10, border: '1px solid #FECACA'
            }}>
              {defects.length}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <AnimatePresence mode="popLayout">
            {defects.map(det => (
              <motion.div
                key={det.track_id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="defect-alert-card"
                style={{
                  background: '#FEF2F2', border: '1px solid #FECACA',
                  borderRadius: 8, padding: '10px 12px'
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>⚠</span> {det.label}
                    </div>
                    <div style={{ fontSize: 10, color: '#F87171', marginTop: 2 }}>
                      Severity: {det.severity || 'MEDIUM'}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#DC2626' }}>
                    {Math.round(det.confidence * 100)}%
                  </div>
                </div>
                <ConfBar value={det.confidence} color="#EF4444" />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Persistent alert history */}
          {alerts.slice(-3).map((a, i) => (
            <div key={i} style={{
              background: '#FFF7ED', border: '1px solid #FED7AA',
              borderRadius: 8, padding: '8px 10px', opacity: 0.7
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#EA580C' }}>⚠ {a.label}</div>
              <div style={{ fontSize: 10, color: '#FB923C', marginTop: 1 }}>{a.time} — {a.severity}</div>
            </div>
          ))}

          {defects.length === 0 && alerts.length === 0 && (
            <div style={{
              fontSize: 11, color: '#BBF7D0', textAlign: 'center', padding: '8px 0',
              background: '#F0FDF4', borderRadius: 8, border: '1px solid #BBF7D0'
            }}>
              ✓ No defects detected
            </div>
          )}
        </div>
      </div>

      {/* ── C. System Metrics ── */}
      <div style={{ padding: '14px 16px', flex: 1 }}>
        <div className="flex items-center gap-2 mb-3">
          <div style={{ width: 3, height: 14, background: '#8B5CF6', borderRadius: 2 }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#64748B' }}>
            SYSTEM METRICS
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <MetricRow label="FPS" value={metrics.fps} unit="" color="#2563EB" />
          <MetricRow label="Inference" value={`${metrics.latency}ms`} unit="" color="#0EA5E9" />
          <MetricRow label="Frames" value={metrics.frames.toLocaleString()} unit="" color="#8B5CF6" />
          <MetricRow label="Detections" value={metrics.detectionCount} unit="" color="#22C55E" />
          <MetricRow label="Active Tracks" value={metrics.activeTracks} unit="" color="#F59E0B" />
          <MetricRow label="Defects Found" value={metrics.defectCount} unit="" color={metrics.defectCount > 0 ? "#EF4444" : "#22C55E"} />
        </div>

        {/* Model info */}
        <div style={{
          marginTop: 16, background: '#F8FAFC', border: '1px solid #E2E8F0',
          borderRadius: 8, padding: '10px 12px'
        }}>
          <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 4, letterSpacing: '0.08em' }}>MODEL</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#0F172A' }}>YOLOv8 — Vande Bharat v1</div>
          <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>31 component classes • 1280×720</div>
        </div>
      </div>
    </div>
  )
}

function MetricRow({ label, value, color }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ fontSize: 11, color: '#64748B' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}</span>
    </div>
  )
}

function ConfBar({ value, color }) {
  return (
    <div style={{ width: 60, height: 3, background: '#E2E8F0', borderRadius: 2, marginTop: 4 }}>
      <div style={{ width: `${value * 100}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.3s' }} />
    </div>
  )
}
