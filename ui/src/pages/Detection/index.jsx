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

// Build a result object from a WebSocket payload.
// Uses backend's `defect` boolean and `severity` directly — no guessing.
function buildResultFromWS(wsPayload, framePool) {
  const { detections, meta } = wsPayload;
  const idx = meta?.frame ?? 0;
  const poolFrame = framePool[idx % Math.max(framePool.length, 1)];

  const mapped = (detections ?? []).map(d => ({
    label:      d.label ?? 'UNKNOWN',
    confidence: d.confidence ?? 0,
    type:       d.defect ? 'defect' : 'normal',
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
  }));

  const defectCount = mapped.filter(d => d.type === 'defect').length;

  return {
    id:         `Frame_${String(idx).padStart(3, '0')}.jpg`,
    status:     defectCount > 0 ? 'DEFECT DETECTED' : 'NOMINAL',
    defects:    defectCount,
    thumbnail:  poolFrame?.thumbnail ?? null,
    meta:       { frame: idx, fps: meta?.fps, latency_ms: meta?.latency_ms },
    detections: mapped,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

const Detection = ({ frames = [], onComplete }) => {
  const toast = useToast();
  const [running, setRunning]           = useState(false);
  const [results, setResults]           = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [confidence, setConfidence]     = useState(0.35);
  const [statusText, setStatusText]     = useState('Ready — click RUN DETECTION');
  const [frameCount, setFrameCount]     = useState(0);
  const abortRef = useRef(null);

  // WebSocket is active whenever detection is running
  const { detections: wsDet, meta: wsMeta, isConnected, connState, disconnect: wsDisconnect }
    = useDetectionStream(running);

  // ── Handle each incoming WS frame ──────────────────────────────────────────
  useEffect(() => {
    if (!running || !isConnected) return;
    if (!wsDet) return;

    // Filter by confidence threshold before building result
    const filtered = wsDet.filter(d => (d.confidence ?? 0) >= confidence);
    const result = buildResultFromWS({ detections: filtered, meta: wsMeta }, frames);

    setResults(prev => [...prev, result]);
    setFrameCount(wsMeta?.frame ?? 0);
    setStatusText(`Streaming — frame ${wsMeta?.frame ?? '?'}  ·  ${wsMeta?.fps ?? '?'} fps  ·  ${wsMeta?.latency_ms ?? '?'} ms latency`);
  }, [wsDet, wsMeta]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Connection status toasts ────────────────────────────────────────────────
  useEffect(() => {
    if (isConnected && running) {
      toast({ type: 'success', message: 'Connected to AI detection backend.' });
      setStatusText('Streaming from YOLO backend…');
    }
  }, [isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (connState === 'error') {
      toast({ type: 'error', message: 'Backend connection failed. Is the server running on port 8000?' });
      setRunning(false);
    }
  }, [connState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleRun = () => {
    setResults([]);
    setFrameCount(0);
    setStatusText('Connecting to backend…');
    setRunning(true);
    toast({ type: 'info', message: 'Starting live detection stream…' });
  };

  const handleStop = () => {
    wsDisconnect();
    setRunning(false);
    setStatusText(`Stopped — ${results.length} frames received`);
    toast({ type: 'info', message: 'Detection stopped.' });
  };

  const handleComplete = () => {
    wsDisconnect();
    setRunning(false);
    if (results.length === 0) {
      toast({ type: 'warning', message: 'No results yet. Run detection first.' });
      return;
    }
    const defects = results.filter(r => r.defects > 0).length;
    toast({ type: 'success', message: `Inspection complete — ${results.length} frames, ${defects} defect(s) found.` });
    onComplete?.(results);
  };

  // ── Derived stats ───────────────────────────────────────────────────────────
  const defectFrames     = results.filter(r => r.defects > 0).length;
  const totalDetections  = results.reduce((sum, r) => sum + r.detections.length, 0);

  const modeLabel = (() => {
    if (running) {
      return {
        label:   { connecting: 'CONNECTING…', connected: 'LIVE DETECTION', closed: 'RECONNECTING…', error: 'CONNECTION ERROR' }[connState] ?? 'CONNECTING…',
        variant: { connecting: 'warning', connected: 'success', closed: 'warning', error: 'error' }[connState] ?? 'warning',
      };
    }
    if (results.length > 0) return { label: 'DETECTION COMPLETE', variant: 'success' };
    return { label: 'READY', variant: 'neutral' };
  })();

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
                    {frames.length > 0 ? `${frames.length} frames loaded` : 'Live backend stream'}
                  </span>
                  <span className="text-body-sm text-on-surface-variant">
                    {frames.length > 0 ? 'Thumbnails from Stage 1' : 'Video_2.mp4 via YOLO service'}
                  </span>
                </div>
              </div>
            </Card>

            <Card title="DETECTION CONTROLS" padding={true}>
              <div className="flex flex-col gap-lg">
                <div className="flex flex-col gap-sm">
                  <div className="flex items-center gap-sm bg-surface-container-low p-sm border border-outline-variant rounded-sm">
                    <span className="material-symbols-outlined text-on-secondary-container text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>model_training</span>
                    <div className="flex flex-col">
                      <span className="font-label-caps text-[10px] text-on-surface-variant">ACTIVE MODEL</span>
                      <span className="font-code text-[11px] text-primary font-bold">railway_inspection_v1-4 / best.pt</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-sm">
                  <div className="flex justify-between items-center">
                    <label className="text-body-sm font-medium text-primary">Confidence Threshold</label>
                    <span className="text-code text-on-primary-container font-bold">{confidence.toFixed(2)}</span>
                  </div>
                  <input
                    type="range" min="0.1" max="1" step="0.01"
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
                    <span className="font-label-caps text-[10px]">YOLO SERVICE</span>
                  </div>
                </div>

                {!running ? (
                  <Button variant="primary" icon="play_arrow" className="w-full" onClick={handleRun}>
                    RUN DETECTION
                  </Button>
                ) : (
                  <Button variant="outline" icon="stop" className="w-full" onClick={handleStop}>
                    STOP
                  </Button>
                )}

                {results.length > 0 && !running && (
                  <Button variant="secondary" icon="check_circle" className="w-full" onClick={handleComplete}>
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
                  {results.length} frames
                </span>
              </div>
              {running
                ? <div className="h-2 bg-surface-container-high rounded overflow-hidden"><div className="h-full bg-primary animate-pulse w-full" /></div>
                : <ProgressBar progress={results.length > 0 ? 100 : 0} height="h-2" />
              }
            </div>

            {/* Results Gallery */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg flex-1 overflow-hidden flex flex-col shadow-sm">
              <div className="px-panel-padding py-md border-b border-outline-variant flex justify-between items-center bg-surface-container-low/30">
                <span className="font-label-caps text-on-surface-variant text-[11px]">DETECTION RESULTS GALLERY</span>
                {running && (
                  <span className="font-label-caps text-[10px] text-primary animate-pulse">● LIVE</span>
                )}
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
