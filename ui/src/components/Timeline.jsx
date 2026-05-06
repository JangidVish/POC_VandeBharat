import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const TYPE_STYLES = {
  normal:   { color: '#0EA5E9', bg: '#F0F9FF', border: '#BAE6FD', dot: '#0EA5E9' },
  warning:  { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', dot: '#F59E0B' },
  critical: { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', dot: '#EF4444' },
}

export default function Timeline({ events }) {
  const scrollRef = useRef(null)

  // Auto-scroll to latest
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [events])

  return (
    <div style={{
      height: 110, flexShrink: 0,
      background: '#FFFFFF', borderTop: '1px solid #E2E8F0',
      display: 'flex', flexDirection: 'column'
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px 4px', borderBottom: '1px solid #F1F5F9'
      }}>
        <div className="flex items-center gap-2">
          <div style={{ width: 3, height: 12, background: '#2563EB', borderRadius: 2 }} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#64748B' }}>
            INSPECTION TIMELINE
          </span>
        </div>
        <span style={{ fontSize: 10, color: '#94A3B8' }}>{events.length} events</span>
      </div>

      {/* Scrollable events */}
      <div
        ref={scrollRef}
        className="timeline-feed"
        style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 16px', overflowX: 'auto', overflowY: 'hidden',
          scrollBehavior: 'smooth'
        }}
      >
        {events.length === 0 && (
          <span style={{ fontSize: 11, color: '#CBD5E1' }}>Awaiting inspection events…</span>
        )}

        <AnimatePresence initial={false}>
          {events.map((event, i) => {
            const style = TYPE_STYLES[event.type] || TYPE_STYLES.normal
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.85, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                style={{
                  flexShrink: 0,
                  background: style.bg,
                  border: `1px solid ${style.border}`,
                  borderRadius: 8,
                  padding: '6px 10px',
                  minWidth: 160,
                  position: 'relative'
                }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: style.dot, display: 'inline-block', flexShrink: 0
                  }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', fontFamily: 'monospace' }}>
                    {event.time}
                  </span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 500, color: style.color, lineHeight: 1.3 }}>
                  {event.message}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {/* Trailing indicator */}
        {events.length > 0 && (
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 4 }}>
            <span className="pulse-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#0EA5E9', display: 'inline-block' }} />
            <span style={{ fontSize: 10, color: '#0EA5E9' }}>LIVE</span>
          </div>
        )}
      </div>
    </div>
  )
}
