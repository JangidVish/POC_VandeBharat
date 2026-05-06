import { useState, useEffect, useRef, useCallback } from 'react'
import Header from './components/Header'
import VideoPanel from './components/VideoPanel'
import DetectionSidebar from './components/DetectionSidebar'
import Timeline from './components/Timeline'
import SummaryModal from './components/SummaryModal'
import { useDetectionStream } from './hooks/useDetectionStream'
import { DETECTION_SEQUENCES, TIMELINE_EVENTS } from './data/mockDetections'
import './index.css'

// ─── TOGGLE: set to false when backend is running ────────────────────────────
const USE_MOCK = true
// ─────────────────────────────────────────────────────────────────────────────

const FRAME_INTERVAL    = 800
const TIMELINE_INTERVAL = 2200

export default function App() {
  // ── Shared state ──
  const [detections, setDetections]       = useState([])
  const [alerts, setAlerts]               = useState([])
  const [timelineEvents, setTimelineEvents] = useState([])
  const [showSummary, setShowSummary]     = useState(false)
  const [frameCount, setFrameCount]       = useState(0)
  const [fps, setFps]                     = useState(0)
  const [latency, setLatency]             = useState(0)
  const [defectCount, setDefectCount]     = useState(0)
  const [totalDetections, setTotalDetections] = useState(0)
  const [hasDefect, setHasDefect]         = useState(false)
  const [isActive, setIsActive]           = useState(false)

  // ── Live stream ──
  const [streamEnabled, setStreamEnabled] = useState(!USE_MOCK)
  const { detections: liveDetections, meta, isConnected, connState, reconnect } =
    useDetectionStream(streamEnabled)

  // ── Mock refs ──
  const seqIndexRef       = useRef(0)
  const timelineIndexRef  = useRef(0)
  const frameIntervalRef  = useRef(null)
  const timelineIntervalRef = useRef(null)
  const fpsIntervalRef    = useRef(null)
  const fpsCountRef       = useRef(0)

  // ── Shared defect processor ──
  const processDefects = useCallback((dets) => {
    const defectsNow = dets.filter(d => d.defect)
    if (defectsNow.length > 0) {
      setHasDefect(true)
      setDefectCount(c => c + defectsNow.length)
      setAlerts(prev => {
        const newAlerts = defectsNow.map(d => ({
          label: d.label, severity: d.severity || 'HIGH',
          time: new Date().toLocaleTimeString('en-IN', {
            hour: '2-digit', minute: '2-digit', second: '2-digit'
          })
        }))
        return [...prev, ...newAlerts].slice(-10)
      })
      // Add critical events to timeline
      defectsNow.forEach(d => {
        setTimelineEvents(prev => [...prev, {
          time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          message: `🔴 ${d.label} — ${d.severity || 'HIGH'} — ${Math.round(d.confidence * 100)}%`,
          type: d.severity === 'CRITICAL' ? 'critical' : 'warning'
        }])
      })
      setTimeout(() => setHasDefect(false), 1500)
    } else {
      setHasDefect(false)
    }
  }, [])

  // ── Live mode: wire stream → state ──
  useEffect(() => {
    if (USE_MOCK || !isConnected) return
    setDetections(liveDetections)
    setTotalDetections(c => c + liveDetections.length)
    setFrameCount(f => f + 1)
    setFps(meta.fps)
    setLatency(meta.latency_ms)
    processDefects(liveDetections)
  }, [liveDetections, isConnected, meta, processDefects])

  useEffect(() => {
    if (!USE_MOCK) setIsActive(isConnected)
  }, [isConnected])

  // ── Mock simulation ──
  const stopSimulation = useCallback(() => {
    clearInterval(frameIntervalRef.current)
    clearInterval(timelineIntervalRef.current)
    clearInterval(fpsIntervalRef.current)
    setIsActive(false)
    setHasDefect(false)
  }, [])

  const startSimulation = useCallback(() => {
    if (!USE_MOCK) return
    clearInterval(frameIntervalRef.current)
    clearInterval(timelineIntervalRef.current)
    clearInterval(fpsIntervalRef.current)

    setIsActive(true)
    seqIndexRef.current = 0
    timelineIndexRef.current = 0
    fpsCountRef.current = 0
    setDetections([])
    setAlerts([])
    setTimelineEvents([])
    setFrameCount(0)
    setDefectCount(0)
    setTotalDetections(0)
    setShowSummary(false)

    frameIntervalRef.current = setInterval(() => {
      const seq = DETECTION_SEQUENCES[seqIndexRef.current % DETECTION_SEQUENCES.length]
      setDetections(seq.detections)
      setFrameCount(f => f + 1)
      fpsCountRef.current += 1
      setTotalDetections(c => c + seq.detections.length)
      setLatency(Math.floor(20 + Math.random() * 15))
      processDefects(seq.detections)
      seqIndexRef.current += 1
    }, FRAME_INTERVAL)

    timelineIntervalRef.current = setInterval(() => {
      const idx = timelineIndexRef.current
      if (idx < TIMELINE_EVENTS.length) {
        setTimelineEvents(prev => [...prev, TIMELINE_EVENTS[idx]])
        timelineIndexRef.current += 1
      }
    }, TIMELINE_INTERVAL)

    fpsIntervalRef.current = setInterval(() => {
      setFps(fpsCountRef.current)
      fpsCountRef.current = 0
    }, 1000)
  }, [processDefects])

  useEffect(() => {
    if (!USE_MOCK) return
    const t = setTimeout(startSimulation, 1200)
    return () => { clearTimeout(t); stopSimulation() }
  }, []) // eslint-disable-line

  const handleShowSummary = () => {
    if (USE_MOCK) stopSimulation()
    setShowSummary(true)
  }

  const summary = {
    frames:        Math.max(frameCount * 12, USE_MOCK ? 18240 : frameCount),
    detections:    Math.max(totalDetections * (USE_MOCK ? 8 : 1), USE_MOCK ? 1248 : 0),
    defects:       defectCount,
    avgConfidence: 96,
    defectList:    alerts.slice(0, 3).map(a => ({
      label: a.label, severity: a.severity,
      confidence: 94 + Math.floor(Math.random() * 5)
    }))
  }

  const metrics = {
    fps,
    latency,
    frames:         frameCount * (USE_MOCK ? 12 : 1),
    detectionCount: totalDetections,
    activeTracks:   detections.length,
    defectCount,
  }

  // Connection status badge for live mode
  const connBadge = !USE_MOCK && (
    <div style={{
      position: 'fixed', bottom: 56, right: 16, zIndex: 50,
      background: isConnected ? '#F0FDF4' : '#FEF2F2',
      border: `1px solid ${isConnected ? '#BBF7D0' : '#FECACA'}`,
      borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 600,
      color: isConnected ? '#22C55E' : '#EF4444',
      display: 'flex', alignItems: 'center', gap: 6
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: isConnected ? '#22C55E' : '#EF4444', display: 'inline-block'
      }} />
      {isConnected ? `Live — ${meta.mode === 'stub' ? 'STUB' : 'MODEL'}` : `Backend ${connState}`}
      {!isConnected && (
        <button onClick={reconnect}
          style={{ marginLeft: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontWeight: 700 }}>
          ↺
        </button>
      )}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#F8FAFC', overflow: 'hidden' }}>
      <Header fps={fps} isActive={isActive} frameCount={frameCount * (USE_MOCK ? 12 : 1)} />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <VideoPanel
          detections={detections}
          isActive={isActive}
          hasDefect={hasDefect}
          onVideoEnd={handleShowSummary}
        />
        <DetectionSidebar
          detections={detections}
          alerts={alerts}
          metrics={metrics}
        />
      </div>

      <Timeline events={timelineEvents} />

      {/* Control bar */}
      <div style={{
        height: 44, background: '#FFFFFF', borderTop: '1px solid #E2E8F0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', flexShrink: 0
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {USE_MOCK ? (
            <>
              <button onClick={isActive ? stopSimulation : startSimulation} style={{
                fontSize: 11, fontWeight: 600, padding: '5px 14px', borderRadius: 6,
                border: 'none', cursor: 'pointer',
                background: isActive ? '#FEF2F2' : '#EFF6FF',
                color: isActive ? '#DC2626' : '#2563EB'
              }}>
                {isActive ? '■ Stop' : '▶ Start'}
              </button>
              <button onClick={startSimulation} style={{
                fontSize: 11, fontWeight: 600, padding: '5px 14px', borderRadius: 6,
                border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#64748B', cursor: 'pointer'
              }}>
                ↺ Reset
              </button>
            </>
          ) : (
            <button onClick={isConnected ? () => { setStreamEnabled(false); setIsActive(false) } : () => setStreamEnabled(true)}
              style={{
                fontSize: 11, fontWeight: 600, padding: '5px 14px', borderRadius: 6,
                border: 'none', cursor: 'pointer',
                background: isConnected ? '#FEF2F2' : '#EFF6FF',
                color: isConnected ? '#DC2626' : '#2563EB'
              }}>
              {isConnected ? '■ Disconnect' : '▶ Connect'}
            </button>
          )}

          {/* Mode badge */}
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
            background: USE_MOCK ? '#FFFBEB' : '#F0FDF4',
            color: USE_MOCK ? '#D97706' : '#22C55E',
            border: `1px solid ${USE_MOCK ? '#FDE68A' : '#BBF7D0'}`
          }}>
            {USE_MOCK ? 'MOCK MODE' : 'LIVE MODE'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>
            {detections.length} active tracks • {defectCount} defects flagged
          </span>
          <button onClick={handleShowSummary} style={{
            fontSize: 11, fontWeight: 600, padding: '5px 14px', borderRadius: 6,
            border: 'none', background: '#2563EB', color: '#FFFFFF', cursor: 'pointer'
          }}>
            View Summary
          </button>
        </div>
      </div>

      {connBadge}

      <SummaryModal
        show={showSummary}
        summary={summary}
        onClose={() => { setShowSummary(false); if (USE_MOCK) startSimulation() }}
      />
    </div>
  )
}
