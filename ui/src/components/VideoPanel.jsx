import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import DetectionOverlay from './DetectionOverlay'

export default function VideoPanel({ detections, isActive, hasDefect, onVideoEnd }) {
  const videoRef = useRef(null)
  const [videoLoaded, setVideoLoaded] = useState(false)

  return (
    <div className="relative flex-1 overflow-hidden" style={{ background: '#0F172A' }}>

      {/* Video */}
      <div ref={videoRef} style={{ position: 'relative', width: '100%', height: '100%' }} id="video-container">
        {/* Placeholder background — hidden once video loads */}
        <div style={{
          position: 'absolute', inset: 0,
          display: videoLoaded ? 'none' : undefined,
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {/* Grid overlay for industrial feel */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.04 }}>
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#94A3B8" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* Train silhouette placeholder */}
          <div style={{ textAlign: 'center', color: '#334155' }}>
            <svg width="120" height="60" viewBox="0 0 120 60" fill="none" opacity="0.4">
              <rect x="10" y="20" width="100" height="30" rx="4" fill="#475569"/>
              <rect x="20" y="12" width="35" height="18" rx="3" fill="#475569"/>
              <rect x="60" y="12" width="35" height="18" rx="3" fill="#475569"/>
              <circle cx="28" cy="52" r="8" fill="#334155" stroke="#475569" strokeWidth="2"/>
              <circle cx="92" cy="52" r="8" fill="#334155" stroke="#475569" strokeWidth="2"/>
              <circle cx="60" cy="52" r="8" fill="#334155" stroke="#475569" strokeWidth="2"/>
            </svg>
            <p style={{ marginTop: 12, fontSize: 13, color: '#475569', letterSpacing: '0.1em' }}>
              AWAITING VIDEO FEED
            </p>
            <p style={{ marginTop: 4, fontSize: 11, color: '#334155' }}>
              Connect camera or load inspection video
            </p>
          </div>
        </div>

        {/* Actual video (shows when file loaded) */}
        <video
          ref={videoRef}
          src="/Video_2.mp4"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', zIndex: 2 }}
          loop
          muted
          autoPlay
          playsInline
          onLoadedData={() => setVideoLoaded(true)}
          onEnded={onVideoEnd}
        />

        {/* Scan line — only when AI active */}
        <AnimatePresence>
          {isActive && (
            <motion.div
              className="scan-line"
              style={{ zIndex: 6 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          )}
        </AnimatePresence>

        {/* Detection overlay canvas */}
        <DetectionOverlay detections={detections} videoRef={videoRef} />

        {/* Corner decorations */}
        <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 8, pointerEvents: 'none' }}>
          <svg width="20" height="20" viewBox="0 0 20 20">
            <path d="M 0 10 L 0 0 L 10 0" stroke="#0EA5E9" strokeWidth="2" fill="none"/>
          </svg>
        </div>
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 8, pointerEvents: 'none' }}>
          <svg width="20" height="20" viewBox="0 0 20 20">
            <path d="M 20 10 L 20 0 L 10 0" stroke="#0EA5E9" strokeWidth="2" fill="none"/>
          </svg>
        </div>
        <div style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 8, pointerEvents: 'none' }}>
          <svg width="20" height="20" viewBox="0 0 20 20">
            <path d="M 0 10 L 0 20 L 10 20" stroke="#0EA5E9" strokeWidth="2" fill="none"/>
          </svg>
        </div>
        <div style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 8, pointerEvents: 'none' }}>
          <svg width="20" height="20" viewBox="0 0 20 20">
            <path d="M 20 10 L 20 20 L 10 20" stroke="#0EA5E9" strokeWidth="2" fill="none"/>
          </svg>
        </div>

        {/* LIVE badge */}
        <div style={{
          position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
          zIndex: 8, display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(14,165,233,0.3)',
          borderRadius: 6, padding: '4px 10px', backdropFilter: 'blur(4px)'
        }}>
          <span className="pulse-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444', display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#F8FAFC', letterSpacing: '0.12em' }}>LIVE</span>
        </div>

        {/* Defect flash overlay */}
        <AnimatePresence>
          {hasDefect && (
            <motion.div
              style={{
                position: 'absolute', inset: 0, zIndex: 7, pointerEvents: 'none',
                border: '3px solid #EF4444',
                boxShadow: 'inset 0 0 40px rgba(239,68,68,0.2)'
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.5, 1] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
