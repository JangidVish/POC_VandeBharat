import React, { useState, useRef, useEffect } from 'react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import ProgressBar from '../../components/common/ProgressBar';
import StatusChip from '../../components/common/StatusChip';
import ResultCard from './ResultCard';
import AnalysisDetailDrawer from './AnalysisDetailDrawer';
import { useToast } from '../../context/ToastContext';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

const DEFECT_KEYWORDS = ['crack', 'shelling', 'binding', 'defect', 'damage', 'seepage', 'fault', 'sparking', 'wear']
function classifyType(label = '') {
  return DEFECT_KEYWORDS.some(kw => label.toLowerCase().includes(kw)) ? 'defect' : 'normal'
}

function mapDetections(rawDets, confidenceThreshold) {
  return rawDets
    .filter(d => d.confidence >= confidenceThreshold)
    .map(d => ({
      label:      d.label ?? 'UNKNOWN',
      confidence: d.confidence ?? 0,
      type:       d.defect ? 'defect' : classifyType(d.label),
      severity:   d.severity ?? null,
      bbox:       d.bbox
        ? {
            top:    `${(d.bbox[1] * 100).toFixed(1)}%`,
            left:   `${(d.bbox[0] * 100).toFixed(1)}%`,
            width:  `${(d.bbox[2] * 100).toFixed(1)}%`,
            height: `${(d.bbox[3] * 100).toFixed(1)}%`,
          }
        : null,
      track_id: d.track_id,
    }))
}

const Detection = ({ frames = [], onComplete }) => {
  const toast = useToast()

  const [running, setRunning]         = useState(false)
  const [progress, setProgress]       = useState(0)
  const [results, setResults]         = useState([])
  const [selectedResult, setSelected] = useState(null)
  const [isDrawerOpen, setDrawerOpen] = useState(false)
  const [confidence, setConfidence]   = useState(0.85)
  const [modelInfo, setModelInfo]     = useState(null)
  const [statusText, setStatusText]   = useState('Ready — click RUN DETECTION')
  const [backendError, setBackendError] = useState(false)

  const abortRef = useRef(null)

  // Fetch model info on mount
  useEffect(() => {
    fetch(`${API_URL}/api/info`)
      .then(r => r.json())
      .then(data => { setModelInfo(data); setBackendError(false) })
      .catch(() => {
        setBackendError(true)
        console.warn('[Detection] Cannot reach backend at', API_URL)
      })
  }, [])

  const runDetection = async () => {
    if (frames.length === 0) {
      toast({ type: 'warning', message: 'No frames to process. Extract frames in Step 1 first.' })
      return
    }

    const controller = new AbortController()
    abortRef.current = controller

    setResults([])
    setProgress(0)
    setRunning(true)
    setStatusText(`Processing 0 / ${frames.length} frames…`)
    toast({ type: 'info', message: `Running YOLO detection on ${frames.length} frames…` })

    const accumulated = []

    for (let i = 0; i < frames.length; i++) {
      if (controller.signal.aborted) break

      const frame = frames[i]
      setStatusText(`Processing frame ${i + 1} / ${frames.length}…`)

      try {
        const res = await fetch(`${API_URL}/api/detect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: frame.thumbnail }),
          signal: controller.signal,
        })

        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const data = await res.json()
        const detections = mapDetections(data.detections ?? [], confidence)
        const defectCount = detections.filter(d => d.type === 'defect').length

        const result = {
          id:         frame.id,
          timestamp:  frame.timestamp,
          status:     defectCount > 0 ? 'DEFECT DETECTED' : 'NOMINAL',
          defects:    defectCount,
          thumbnail:  frame.thumbnail,   // real frame image from step 1
          detections,
        }

        accumulated.push(result)
        // Batch UI updates every 5 frames to reduce re-renders
        if (i % 5 === 0 || i === frames.length - 1) {
          setResults([...accumulated])
        }
        setProgress(Math.round(((i + 1) / frames.length) * 100))

      } catch (err) {
        if (controller.signal.aborted) break
        console.error(`[Detection] Frame ${i} failed:`, err)
        toast({ type: 'error', message: `Backend error on frame ${i + 1}: ${err.message}` })
        // Continue to next frame rather than aborting the whole run
      }
    }

    if (!controller.signal.aborted) {
      setRunning(false)
      setProgress(100)
      const defects = accumulated.filter(r => r.defects > 0).length
      setStatusText(`Complete — ${accumulated.length} frames, ${defects} with defects`)
      toast({ type: 'success', message: `Detection complete — ${accumulated.length} frames, ${defects} defect(s) found.` })
      onComplete?.(accumulated)
    } else {
      setRunning(false)
      setStatusText(`Stopped at ${accumulated.length} / ${frames.length} frames`)
    }
  }

  const handleStop = () => {
    abortRef.current?.abort()
  }

  const handleComplete = () => {
    if (results.length === 0) {
      toast({ type: 'warning', message: 'No results yet. Run detection first.' })
      return
    }
    toast({ type: 'success', message: `Inspection complete — ${results.length} frames reviewed.` })
    onComplete?.(results)
  }

  const defectFrames    = results.filter(r => r.defects > 0).length
  const totalDetections = results.reduce((sum, r) => sum + r.detections.length, 0)

  const chipLabel   = backendError ? 'BACKEND OFFLINE' : modelInfo ? (modelInfo.mode === 'stub' ? 'STUB MODE' : 'MODEL LOADED') : 'CHECKING…'
  const chipVariant = backendError ? 'error' : modelInfo ? (modelInfo.mode === 'stub' ? 'warning' : 'success') : 'neutral'

  const modelLabel = modelInfo
    ? `${modelInfo.mode === 'stub' ? '[STUB] ' : ''}${modelInfo.classes?.length ?? 0} classes · ${modelInfo.defect_labels?.length ?? 0} defect types`
    : backendError ? 'Cannot reach backend' : 'Fetching model info…'

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      <header className="max-w-[1440px] w-full mx-auto px-lg py-md border-b border-outline-variant bg-surface-container-lowest">
        <div className="flex justify-between items-end">
          <div className="flex flex-col gap-xs">
            <nav className="flex items-center gap-xs font-label-caps text-on-surface-variant text-[11px]">
              <span>Pipeline Overview</span>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              <span>Video Framing</span>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              <span className="text-primary">Detection</span>
            </nav>
            <h1 className="font-h1 text-h1 text-primary">Component &amp; Defect Detection</h1>
          </div>
          <StatusChip label={chipLabel} variant={chipVariant} icon="radio_button_checked" />
        </div>
      </header>

      <main className="max-w-[1440px] w-full mx-auto px-lg py-lg flex-1 overflow-hidden flex flex-col gap-lg">
        <div className="grid grid-cols-12 gap-lg h-full">

          {/* Left: Controls */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-lg overflow-y-auto custom-scrollbar pr-xs">

            {/* Input source summary */}
            <Card title="INPUT SOURCE" padding={true}>
              <div className="flex items-center gap-md bg-surface p-md border border-dashed border-outline-variant rounded">
                <div className="bg-primary-container text-white p-sm rounded-sm shrink-0">
                  <span className="material-symbols-outlined">video_file</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-h2 text-primary text-body-base font-bold">
                    {frames.length > 0 ? `${frames.length} frames loaded` : 'No frames — go back to Step 1'}
                  </span>
                  <span className="text-body-sm text-on-surface-variant">
                    {frames.length > 0 ? 'Extracted in Video Framing step' : 'Extract frames first'}
                  </span>
                </div>
              </div>
            </Card>

            {/* Model info */}
            <Card title="MODEL INFO" padding={true}>
              <div className="flex flex-col gap-sm">
                <div className="flex items-center gap-md bg-surface p-md border border-dashed border-outline-variant rounded">
                  <div className="bg-primary-container text-white p-sm rounded-sm shrink-0">
                    <span className="material-symbols-outlined">model_training</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-h2 text-primary text-body-base font-bold truncate">
                      {modelInfo ? (modelInfo.mode === 'stub' ? 'Stub Mode' : 'best.pt') : '…'}
                    </span>
                    <span className="text-body-sm text-on-surface-variant">{modelLabel}</span>
                  </div>
                </div>
                {modelInfo?.defect_labels?.length > 0 && (
                  <div className="flex flex-wrap gap-xs">
                    {modelInfo.defect_labels.map(l => (
                      <span key={l} className="text-[10px] font-code bg-error-container text-on-error-container px-xs py-[2px] rounded-sm">{l}</span>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {/* Controls */}
            <Card title="DETECTION CONTROLS" padding={true}>
              <div className="flex flex-col gap-lg">
                <div className="flex flex-col gap-sm">
                  <div className="flex justify-between items-center">
                    <label className="text-body-sm font-medium text-primary">Confidence Threshold</label>
                    <span className="text-code text-on-primary-container font-bold">{confidence.toFixed(2)}</span>
                  </div>
                  <input
                    type="range" min="0.5" max="1" step="0.01"
                    value={confidence}
                    onChange={e => setConfidence(parseFloat(e.target.value))}
                    disabled={running}
                    className="w-full accent-primary h-1 bg-surface-container-high rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-sm">
                  <div className="flex items-center gap-sm bg-surface p-sm border border-outline-variant rounded-sm">
                    <span className="material-symbols-outlined text-on-secondary-container" style={{ fontVariationSettings: "'FILL' 1" }}>memory</span>
                    <span className="font-label-caps text-[10px]">GPU ACTIVE</span>
                  </div>
                  <div className="flex items-center gap-sm bg-surface p-sm border border-outline-variant rounded-sm">
                    <span className="material-symbols-outlined text-on-secondary-container" style={{ fontVariationSettings: "'FILL' 1" }}>dns</span>
                    <span className="font-label-caps text-[10px]">LOCAL AI</span>
                  </div>
                </div>

                {!running ? (
                  <Button
                    variant="primary" icon="play_arrow" className="w-full"
                    onClick={runDetection}
                    disabled={frames.length === 0 || backendError}
                  >
                    RUN DETECTION
                  </Button>
                ) : (
                  <Button variant="outline" icon="stop" className="w-full" onClick={handleStop}>
                    STOP
                  </Button>
                )}

                {results.length > 0 && !running && (
                  <Button variant="secondary" icon="check_circle" className="w-full" onClick={handleComplete}>
                    COMPLETE &amp; REVIEW
                  </Button>
                )}
              </div>
            </Card>
          </div>

          {/* Right: Results */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-lg overflow-hidden h-full">

            {/* Status bar */}
            <div className="bg-surface-container-lowest border border-outline-variant p-panel-padding rounded-lg border-l-4 border-l-primary shadow-sm">
              <div className="flex items-center justify-between mb-sm">
                <div className="flex items-center gap-sm">
                  <span className={`material-symbols-outlined text-primary ${running ? 'animate-spin' : ''}`}>
                    {running ? 'settings_backup_restore' : results.length > 0 ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  <span className="font-h2 text-primary">{statusText}</span>
                </div>
                <span className="text-body-sm font-code text-on-surface-variant font-bold">
                  {results.length}{frames.length > 0 ? ` / ${frames.length}` : ''} frames
                </span>
              </div>
              <ProgressBar progress={progress} height="h-2" />
            </div>

            {/* Results Gallery */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg flex-1 overflow-hidden flex flex-col shadow-sm">
              <div className="px-panel-padding py-md border-b border-outline-variant flex justify-between items-center bg-surface-container-low/30">
                <span className="font-label-caps text-on-surface-variant text-[11px]">DETECTION RESULTS GALLERY</span>
                {results.length > 0 && (
                  <span className="font-code text-[10px] text-on-surface-variant">
                    {defectFrames} defect frame{defectFrames !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="p-panel-padding overflow-y-auto custom-scrollbar flex-1">
                {results.length === 0 && !running ? (
                  <div className="flex flex-col items-center justify-center h-40 opacity-50 gap-sm">
                    <span className="material-symbols-outlined text-[40px] text-on-surface-variant">image_search</span>
                    <p className="font-body-sm text-on-surface-variant">
                      {frames.length === 0
                        ? 'No frames loaded — go back to Step 1 and extract frames.'
                        : 'Click RUN DETECTION to start.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-md">
                    {results.map((result, idx) => (
                      <ResultCard
                        key={idx}
                        {...result}
                        onClick={() => { setSelected(result); setDrawerOpen(true) }}
                      />
                    ))}
                    {running && (
                      <div className="border border-outline-variant bg-surface-container-low flex flex-col animate-pulse rounded overflow-hidden">
                        <div className="aspect-video bg-surface-container-highest" />
                        <div className="p-sm flex flex-col gap-xs">
                          <div className="h-4 bg-surface-container-highest w-1/2 rounded-sm" />
                          <div className="h-2 bg-surface-container-highest w-full mt-xs rounded-sm" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-md">
              <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-lg shadow-sm">
                <span className="font-label-caps text-on-surface-variant block mb-base text-[10px]">TOTAL DETECTIONS</span>
                <span className="font-display text-display text-primary">{totalDetections.toLocaleString()}</span>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-lg shadow-sm">
                <span className="font-label-caps text-on-surface-variant block mb-base text-[10px]">FRAMES ANALYSED</span>
                <span className="font-display text-display text-primary">{results.length.toLocaleString()}</span>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-lg border-b-4 border-b-error shadow-sm">
                <span className="font-label-caps text-on-surface-variant block mb-base text-[10px]">DEFECT FRAMES</span>
                <span className="font-display text-display text-error">{defectFrames.toLocaleString()}</span>
              </div>
            </div>
          </div>

        </div>
      </main>

      <AnalysisDetailDrawer
        isOpen={isDrawerOpen}
        onClose={() => setDrawerOpen(false)}
        result={selectedResult}
      />
    </div>
  )
}

export default Detection
