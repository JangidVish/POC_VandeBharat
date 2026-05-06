import { motion, AnimatePresence } from 'framer-motion'

export default function SummaryModal({ show, summary, onClose }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            style={{
              background: '#FFFFFF', borderRadius: 16,
              padding: '36px 40px', minWidth: 420, maxWidth: 500,
              border: '1px solid #E2E8F0',
              boxShadow: '0 25px 50px rgba(15,23,42,0.3)'
            }}
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{
                width: 52, height: 52, background: '#F0FDF4', border: '2px solid #BBF7D0',
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0F172A' }}>
                Inspection Complete
              </h2>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748B' }}>
                AI analysis summary for this session
              </p>
            </div>

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              <StatCard label="Frames Processed" value={summary.frames.toLocaleString()} color="#2563EB" />
              <StatCard label="Components Detected" value={summary.detections.toLocaleString()} color="#0EA5E9" />
              <StatCard
                label="Defects Found"
                value={summary.defects}
                color={summary.defects > 0 ? "#EF4444" : "#22C55E"}
                highlight={summary.defects > 0}
              />
              <StatCard label="Avg. Confidence" value={`${summary.avgConfidence}%`} color="#8B5CF6" />
            </div>

            {/* Defect breakdown */}
            {summary.defects > 0 && (
              <div style={{
                background: '#FEF2F2', border: '1px solid #FECACA',
                borderRadius: 10, padding: '12px 16px', marginBottom: 20
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', marginBottom: 8 }}>
                  ⚠ Defects Requiring Attention
                </div>
                {summary.defectList?.map((d, i) => (
                  <div key={i} style={{
                    fontSize: 12, color: '#B91C1C', paddingLeft: 8,
                    borderLeft: '2px solid #FECACA', marginBottom: 4
                  }}>
                    {d.label} — {d.severity} — {d.confidence}% confidence
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
              <button
                style={{
                  flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: '#2563EB', border: 'none', color: '#FFFFFF',
                  cursor: 'pointer'
                }}
              >
                Export Report
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function StatCard({ label, value, color, highlight }) {
  return (
    <div style={{
      background: highlight ? '#FEF2F2' : '#F8FAFC',
      border: `1px solid ${highlight ? '#FECACA' : '#E2E8F0'}`,
      borderRadius: 10, padding: '14px 16px', textAlign: 'center'
    }}>
      <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{label}</div>
    </div>
  )
}
