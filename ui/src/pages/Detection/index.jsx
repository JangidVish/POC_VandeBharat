import React, { useState, useRef, useEffect, useCallback } from 'react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Select from '../../components/common/Select';
import ProgressBar from '../../components/common/ProgressBar';
import StatusChip from '../../components/common/StatusChip';
import ResultCard from './ResultCard';
import AnalysisDetailDrawer from './AnalysisDetailDrawer';
import { useDetectionStream } from '../../hooks/useDetectionStream';
import { useToast } from '../../context/ToastContext';

// ── Simulation data ──────────────────────────────────────────────────────────
const NORMAL_COMPONENTS = [
  { label: 'Wheel Assembly',    confidence: 0.98 },
  { label: 'Axle Box Cover',    confidence: 0.95 },
  { label: 'Brake Pad',         confidence: 0.96 },
  { label: 'Secondary Spring',  confidence: 0.94 },
  { label: 'Wheel Flange',      confidence: 0.97 },
  { label: 'Anchor Bolt',       confidence: 0.93 },
];

const DEFECT_COMPONENTS = [
  { label: 'Crack Detected',  confidence: 0.97, severity: 'CRITICAL' },
  { label: 'Wheel Shelling',  confidence: 0.91, severity: 'HIGH' },
  { label: 'Brake Binding',   confidence: 0.88, severity: 'HIGH' },
  { label: 'Oil Seepage',     confidence: 0.85, severity: 'MEDIUM' },
];

function fakeBbox(seed) {
  const x = ((seed * 37) % 60) + 5;
  const y = ((seed * 53) % 50) + 10;
  return { top: `${y}%`, left: `${x}%`, width: '18%', height: '15%' };
}

// Deterministic: every 6th frame (starting at index 2) has a defect
function simulateDetections(frameIndex, confidenceThreshold) {
  const hasDefect = frameIndex % 6 === 2;
  const normalCount = (frameIndex % 3) + 1;

  const detections = [];
  for (let i = 0; i < normalCount; i++) {
    const c = NORMAL_COMPONENTS[(frameIndex + i) % NORMAL_COMPONENTS.length];
    if (c.confidence >= confidenceThreshold) {
      detections.push({ ...c, type: 'normal', bbox: fakeBbox(frameIndex + i) });
    }
  }
  if (hasDefect) {
    const d = DEFECT_COMPONENTS[Math.floor(frameIndex / 6) % DEFECT_COMPONENTS.length];
    if (d.confidence >= confidenceThreshold) {
      detections.push({ ...d, type: 'defect', bbox: fakeBbox(frameIndex + 100) });
    }
  }
  return detections;
}

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

// ── WebSocket helpers (fallback when no Stage-1 frames) ──────────────────────
const DEFECT_KEYWORDS = ['crack', 'corrosion', 'defect', 'damage', 'wear', 'fault', 'break', 'seepage', 'shelling'];
function classifyType(label = '') {
  return DEFECT_KEYWORDS.some(kw => label.toLowerCase().includes(kw)) ? 'defect' : 'normal';
}
function buildResultFromWS(wsPayload, framePool) {
  const { detections, meta } = wsPayload;
  const idx = meta?.frame ?? 0;
  const poolFrame = framePool[idx % Math.max(framePool.length, 1)];
  const mapped = (detections ?? []).map(d => ({
    label: d.label ?? 'UNKNOWN',
    confidence: d.confidence ?? 0,
    type: d.type ?? classifyType(d.label),
    bbox: d.bbox ? { top: `${(d.bbox[1]*100).toFixed(1)}%`, left: `${(d.bbox[0]*100).toFixed(1)}%`, width: `${(d.bbox[2]*100).toFixed(1)}%`, height: `${(d.bbox[3]*100).toFixed(1)}%` } : null,
    track_id: d.track_id,
  }));
  const defectCount = mapped.filter(d => d.type === 'defect').length;
  return {
    id: `Frame_${String(idx).padStart(3,'0')}.jpg`,
    status: defectCount > 0 ? 'DEFECT DETECTED' : 'NOMINAL',
    defects: defectCount,
    thumbnail: poolFrame?.thumbnail ?? null,
    meta: { frame: idx, fps: meta?.fps, latency_ms: meta?.latency_ms },
    detections: mapped,
  };
}

// ── Component ────────────────────────────────────────────────────────────────
const WS_STUB_MIN = 25;
const WS_STUB_MAX = 50;

const Detection = ({ frames = [], onComplete }) => {
  const toast = useToast();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [confidence, setConfidence] = useState(0.85);
  const [model, setModel] = useState('v4-hp');
  const [statusText, setStatusText] = useState('Ready — click RUN DETECTION');
  const abortRef = useRef(null);

  // WebSocket (fallback only — used when no Stage-1 frames)
  const wsEnabled = running && frames.length === 0;
  const wsStopAtRef = useRef(0);
  const { detections: wsDet, meta: wsMeta, isConnected, connState, disconnect: wsDisconnect } = useDetectionStream(wsEnabled);

  // ── Simulation mode (Stage-1 frames present) ─────────────────────────────
  const runSimulation = useCallback(async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    const accumulated = [];

    for (let i = 0; i < frames.length; i++) {
      if (controller.signal.aborted) break;

      // 80-120ms per frame simulated inference
      await delay(80 + ((i * 37) % 40));

      const detections = simulateDetections(i, confidence);
      const defectCount = detections.filter(d => d.type === 'defect').length;
      const result = {
        id: frames[i].id,
        status: defectCount > 0 ? 'DEFECT DETECTED' : 'NOMINAL',
        defects: defectCount,
        thumbnail: frames[i].thumbnail,
        detections,
      };

      accumulated.push(result);
      // Batch UI updates every 5 frames to limit re-renders
      if (i % 5 === 0 || i === frames.length - 1) {
        setResults([...accumulated]);
        setProgress(Math.round(((i + 1) / frames.length) * 100));
        setStatusText(`Processing frame ${i + 1} / ${frames.length}…`);
      }
    }

    if (!controller.signal.aborted) {
      setRunning(false);
      setProgress(100);
      const defects = accumulated.filter(r => r.defects > 0).length;
      setStatusText(`Complete — ${accumulated.length} frames processed, ${defects} with defects`);
      toast({ type: 'success', message: `Scan complete — ${accumulated.length} frames, ${defects} defect(s) found.` });
      onComplete?.(accumulated);
    }
  }, [frames, confidence, onComplete, toast]);

  useEffect(() => {
    if (running && frames.length > 0) {
      runSimulation();
    }
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── WebSocket fallback mode ───────────────────────────────────────────────
  useEffect(() => {
    if (!wsEnabled || !isConnected) return;
    if (!wsDet?.length && !wsMeta?.frame) return;

    const result = buildResultFromWS({ detections: wsDet, meta: wsMeta }, frames);
    setResults(prev => {
      const next = [...prev, result];
      if (next.length >= wsStopAtRef.current) {
        setTimeout(() => {
          setRunning(false);
          wsDisconnect();
          setStatusText(`Complete — ${next.length} frames streamed`);
          toast({ type: 'success', message: `Stream complete — ${next.length} frames analysed.` });
          onComplete?.(next);
        }, 0);
      }
      setProgress(Math.min(Math.round((next.length / wsStopAtRef.current) * 100), 99));
      return next;
    });
  }, [wsDet, wsMeta]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isConnected && wsEnabled) {
      toast({ type: 'success', message: 'Connected to AI detection backend.' });
      setStatusText('Streaming from backend…');
    }
  }, [isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (connState === 'error') {
      toast({ type: 'error', message: 'Backend connection failed. Is the server running?' });
      setRunning(false);
    }
  }, [connState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleRun = () => {
    setResults([]);
    setProgress(0);
    wsStopAtRef.current = Math.floor(Math.random() * (WS_STUB_MAX - WS_STUB_MIN + 1)) + WS_STUB_MIN;
    setStatusText(frames.length > 0 ? `Starting simulation over ${frames.length} frames…` : 'Connecting to backend…');
    setRunning(true);
    toast({ type: 'info', message: frames.length > 0
      ? `Running detection on ${frames.length} extracted frames…`
      : 'Starting WebSocket detection stream…'
    });
  };

  const handlePause = () => {
    abortRef.current?.abort();
    wsDisconnect();
    setRunning(false);
    setStatusText('Paused');
    toast({ type: 'info', message: 'Detection paused.' });
  };

  const handleManualComplete = () => {
    abortRef.current?.abort();
    wsDisconnect();
    setRunning(false);
    if (results.length === 0) {
      toast({ type: 'warning', message: 'No results yet. Run detection first.' });
      return;
    }
    toast({ type: 'success', message: `Inspection complete — ${results.length} frames reviewed.` });
    onComplete?.(results);
  };

  // ── Derived stats ─────────────────────────────────────────────────────────
  const defectFrames = results.filter(r => r.defects > 0).length;
  const totalDetections = results.reduce((sum, r) => sum + r.detections.length, 0);

  const modeLabel = frames.length > 0
    ? { label: running ? 'SIMULATING…' : results.length > 0 ? 'SIMULATION DONE' : 'READY', variant: running ? 'warning' : results.length > 0 ? 'success' : 'neutral' }
    : { label: { connecting: 'CONNECTING…', connected: 'BACKEND LIVE', closed: 'NOT CONNECTED', error: 'CONNECTION ERROR' }[connState] ?? connState.toUpperCase(),
        variant: { connecting: 'warning', connected: 'success', closed: 'neutral', error: 'error' }[connState] ?? 'neutral' };

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
            <h1 className="font-h1 text-h1 text-primary">Component & Defect Detection</h1>
          </div>
          <StatusChip label={modeLabel.label} variant={modeLabel.variant} icon="radio_button_checked" />
        </div>
      </header>

      <main className="max-w-[1440px] w-full mx-auto px-lg py-lg flex-1 overflow-hidden flex flex-col gap-lg">
        <div className="grid grid-cols-12 gap-lg h-full">

          {/* Left: Controls */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-lg overflow-y-auto custom-scrollbar pr-xs">
            <Card title="INPUT SOURCE" padding={true}>
              <div className="flex items-center gap-md bg-surface p-md border border-dashed border-outline-variant rounded mb-md">
                <div className="bg-primary-container text-white p-sm rounded-sm">
                  <span className="material-symbols-outlined">video_file</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-h2 text-primary text-body-base font-bold">
                    {frames.length > 0 ? `${frames.length} frames loaded` : 'No frames loaded'}
                  </span>
                  <span className="text-body-sm text-on-surface-variant">
                    {frames.length > 0 ? 'From Stage 1 extraction' : 'Will stream from backend video source'}
                  </span>
                </div>
              </div>
            </Card>

            <Card title="DETECTION CONTROLS" padding={true}>
              <div className="flex flex-col gap-lg">
                <Select
                  label="Model Selector"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  options={[
                    { label: 'RailTrack-V4-HighPrecision', value: 'v4-hp' },
                    { label: 'Structural-Defect-Lite', value: 'sd-lite' },
                  ]}
                />
                <div className="flex flex-col gap-sm">
                  <div className="flex justify-between items-center">
                    <label className="text-body-sm font-medium text-primary">Confidence Threshold</label>
                    <span className="text-code text-on-primary-container font-bold">{confidence.toFixed(2)}</span>
                  </div>
                  <input
                    type="range" min="0.5" max="1" step="0.01"
                    value={confidence}
                    onChange={(e) => setConfidence(parseFloat(e.target.value))}
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
                  <Button variant="primary" icon="play_arrow" className="w-full" onClick={handleRun}>
                    RUN DETECTION
                  </Button>
                ) : (
                  <Button variant="outline" icon="pause" className="w-full" onClick={handlePause}>
                    PAUSE
                  </Button>
                )}

                {results.length > 0 && !running && (
                  <Button variant="secondary" icon="check_circle" className="w-full" onClick={handleManualComplete}>
                    COMPLETE & REVIEW
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
              </div>
              <div className="p-panel-padding overflow-y-auto custom-scrollbar flex-1">
                {results.length === 0 && !running ? (
                  <div className="flex flex-col items-center justify-center h-40 opacity-50 gap-sm">
                    <span className="material-symbols-outlined text-[40px] text-on-surface-variant">image_search</span>
                    <p className="font-body-sm text-on-surface-variant">No results yet — run detection to start.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-md">
                    {results.map((result, idx) => (
                      <ResultCard
                        key={idx}
                        {...result}
                        onClick={() => { setSelectedResult(result); setIsDrawerOpen(true); }}
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
        onClose={() => setIsDrawerOpen(false)}
        result={selectedResult}
      />
    </div>
  );
};

export default Detection;
