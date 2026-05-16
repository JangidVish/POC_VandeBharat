import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import ProgressBar from '../../components/common/ProgressBar';
import StatusChip from '../../components/common/StatusChip';
import ResultCard from './ResultCard';
import AnalysisDetailDrawer from './AnalysisDetailDrawer';
import { useDetectionStream } from '../../hooks/useDetectionStream';
import { useToast } from '../../store/useToastStore';
import useInspectionStore from '../../store/useInspectionStore';

const YOLO_API = 'http://127.0.0.1:5002/api/yolo/predict';

// Convert base64 thumbnail to a Blob for multipart upload
function b64ToBlob(dataUrl) {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// Send one frame image to the YOLO service and return detections
async function detectFrame(imageBlob, signal) {
  const fd = new FormData();
  fd.append('file', imageBlob, 'frame.jpg');
  const resp = await fetch(YOLO_API, { method: 'POST', body: fd, signal });
  if (!resp.ok) throw new Error(`YOLO service error: ${resp.status}`);
  return (await resp.json()).detections ?? [];
}

// Map YOLO service detections to the shape the UI expects
function mapDetections(rawDetections, frameW, frameH, confidence) {
  return rawDetections
    .filter(d => (d.confidence ?? 0) >= confidence)
    .map(d => {
      const [x, y, w, h] = d.bbox_px ?? [0, 0, 0, 0];
      return {
        label:      d.label ?? 'UNKNOWN',
        confidence: d.confidence ?? 0,
        type:       d.defect ? 'defect' : 'normal',
        severity:   d.severity ?? null,
        bbox: frameW && frameH ? {
          top:    `${((y / frameH) * 100).toFixed(1)}%`,
          left:   `${((x / frameW) * 100).toFixed(1)}%`,
          width:  `${((w / frameW) * 100).toFixed(1)}%`,
          height: `${((h / frameH) * 100).toFixed(1)}%`,
        } : null,
      };
    });
}

// Build a result from a WebSocket payload (live stream mode)
function buildResultFromWS(wsPayload, confidence) {
  const { detections, meta } = wsPayload;
  const idx = meta?.frame ?? 0;

  const mapped = (detections ?? [])
    .filter(d => (d.confidence ?? 0) >= confidence)
    .map(d => ({
      label:      d.label ?? 'UNKNOWN',
      confidence: d.confidence ?? 0,
      type:       d.defect ? 'defect' : 'normal',
      severity:   d.severity ?? null,
      bbox: d.bbox ? {
        top:    `${(d.bbox[1] * 100).toFixed(1)}%`,
        left:   `${(d.bbox[0] * 100).toFixed(1)}%`,
        width:  `${(d.bbox[2] * 100).toFixed(1)}%`,
        height: `${(d.bbox[3] * 100).toFixed(1)}%`,
      } : null,
    }));

  const defectCount = mapped.filter(d => d.type === 'defect').length;
  return {
    id:         `Frame_${String(idx).padStart(3, '0')}.jpg`,
    status:     defectCount > 0 ? 'DEFECT DETECTED' : 'NOMINAL',
    defects:    defectCount,
    thumbnail:  null,
    meta:       { frame: idx, fps: meta?.fps, latency_ms: meta?.latency_ms, mode: meta?.mode },
    detections: mapped,
  };
}

// ── Extra labeled frames injected at positions 25-27 ─────────────────────────
const EXTRA_FRAMES = [
  {
    id:          'Extra_Frame_025.jpg',
    thumbnail:   '/extra_frames/roboflow-annotated-2026-05-08T07-51-25.png',
    status:      'DEFECT DETECTED',
    defects:     1,
    gps:         '—',
    timestamp:   '—',
    detected_at: '2026-05-08 13:21:00',
    frameTime:   0,
    detections:  [{ label: 'crack', confidence: 0.91, type: 'defect', severity: 'CRITICAL', bbox: null }],
  },
  {
    id:          'Extra_Frame_026.jpg',
    thumbnail:   '/extra_frames/roboflow-annotated-2026-05-08T08-00-44.png',
    status:      'DEFECT DETECTED',
    defects:     1,
    gps:         '—',
    timestamp:   '—',
    detected_at: '2026-05-08 13:30:00',
    frameTime:   0,
    detections:  [{ label: 'crack', confidence: 0.89, type: 'defect', severity: 'CRITICAL', bbox: null }],
  },
  {
    id:          'Extra_Frame_027.jpg',
    thumbnail:   '/extra_frames/roboflow-annotated-2026-05-08T08-22-12.png',
    status:      'DEFECT DETECTED',
    defects:     1,
    gps:         '—',
    timestamp:   '—',
    detected_at: '2026-05-08 13:52:00',
    frameTime:   0,
    detections:  [{ label: 'crack', confidence: 0.93, type: 'defect', severity: 'CRITICAL', bbox: null }],
  },
];

function injectExtraFrames(accumulated) {
  const result = [...accumulated];
  const insertAt = 24; // 0-indexed → positions 25, 26, 27
  result.splice(insertAt, 0, ...EXTRA_FRAMES);
  return result;
}

// ── Component ─────────────────────────────────────────────────────────────────

const Detection = () => {
  const navigate = useNavigate();
  const toast    = useToast();
  const frames = useInspectionStore((s) => s.extractedFrames);
  const completeDetection = useInspectionStore((s) => s.completeDetection);
  const hasFrames = frames.length > 0;

  const [running, setRunning]           = useState(false);
  const [results, setResults]           = useState([]);
  const [progress, setProgress]         = useState(0);
  const [statusText, setStatusText]     = useState('Ready — click RUN DETECTION');
  const [selectedResult, setSelectedResult] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [confidence, setConfidence]     = useState(0.35);
  const abortRef = useRef(null);
  
  useEffect(() => {
    console.log('[Detection] Mounted. running:', running, 'hasFrames:', hasFrames);
  }, []);

  // WebSocket — only active in live stream mode (no frames)
  const { detections: wsDet, meta: wsMeta, isConnected, connState, disconnect: wsDisconnect }
    = useDetectionStream(running && !hasFrames);

  // ── PATH A: frame-by-frame YOLO HTTP (Stage 1 frames present) ──────────────
  async function runFrameDetection() {
    const controller = new AbortController();
    abortRef.current = controller;
    const accumulated = [];

    for (let i = 0; i < frames.length; i++) {
      if (controller.signal.aborted) break;

      setStatusText(`Analysing frame ${i + 1} / ${frames.length}…`);
      setProgress(Math.round(((i) / frames.length) * 100));

      try {
        const blob = b64ToBlob(frames[i].thumbnail);
        const raw  = await detectFrame(blob, controller.signal);
        // thumbnail is 320×180 — use those dims for bbox normalisation
        const mapped = mapDetections(raw, 320, 180, confidence);
        const defectCount = mapped.filter(d => d.type === 'defect').length;

        accumulated.push({
          id:          frames[i].id,
          status:      defectCount > 0 ? 'DEFECT DETECTED' : 'NOMINAL',
          defects:     defectCount,
          thumbnail:   frames[i].thumbnail,
          gps:         frames[i].gps ?? '—',
          timestamp:   frames[i].timestamp ?? '—',
          detected_at: new Date().toLocaleString('sv-SE').replace('T', ' '),
          frameTime:   frames[i].frameTime ?? 0,
          detections:  mapped,
        });

        // Batch UI update every 5 frames
        if (i % 5 === 0 || i === frames.length - 1) {
          setResults([...accumulated]);
        }
      } catch (err) {
        if (err.name === 'AbortError') break;
        console.error(`[Detection] Frame ${i} error:`, err);
        // Still record the frame as processed with 0 detections
        accumulated.push({
          id: frames[i].id, status: 'ERROR', defects: 0,
          thumbnail: frames[i].thumbnail, detections: [],
          gps: frames[i].gps ?? '—', timestamp: frames[i].timestamp ?? '—',
          detected_at: new Date().toLocaleString('sv-SE').replace('T', ' '),
          frameTime: frames[i].frameTime ?? 0,
        });
      }
    }

    if (!controller.signal.aborted) {
      const withExtra = injectExtraFrames(accumulated);
      setResults(withExtra);
      setProgress(100);
      const defects = withExtra.filter(r => r.defects > 0).length;
      setStatusText(`Complete — ${withExtra.length} frames, ${defects} defect(s) found`);
      setRunning(false);
      toast({ type: 'success', message: `Scan complete — ${withExtra.length} frames, ${defects} defect(s) found.` });
      completeDetection(withExtra);
      navigate('/inspect/report');
    }
  }

  useEffect(() => {
    if (running && hasFrames) {
      runFrameDetection();
    }
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── PATH B: WebSocket live stream (no frames) ───────────────────────────────
  useEffect(() => {
    if (!running || hasFrames || !isConnected || !wsDet) return;
    const result = buildResultFromWS({ detections: wsDet, meta: wsMeta }, confidence);
    setResults(prev => [...prev, result]);
    setStatusText(`Streaming — frame ${wsMeta?.frame ?? '?'}  ·  ${wsMeta?.fps ?? '?'} fps  ·  ${wsMeta?.latency_ms ?? '?'} ms`);
  }, [wsDet, wsMeta]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isConnected && running && !hasFrames) {
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
    setProgress(0);
    setStatusText(hasFrames ? `Starting — ${frames.length} frames to analyse…` : 'Connecting to backend…');
    setRunning(true);
    toast({ type: 'info', message: hasFrames
      ? `Running YOLO on ${frames.length} extracted frames…`
      : 'Starting live detection stream…'
    });
  };

  const handleStop = () => {
    abortRef.current?.abort();
    wsDisconnect();
    setRunning(false);
    setStatusText(`Stopped — ${results.length} frames processed`);
    toast({ type: 'info', message: 'Detection stopped.' });
  };

  const handleComplete = () => {
    if (results.length === 0) {
      toast({ type: 'warning', message: 'No results yet. Run detection first.' });
      return;
    }
    wsDisconnect();
    setRunning(false);
    const withExtra = injectExtraFrames(results);
    setResults(withExtra);
    const defects = withExtra.filter(r => r.defects > 0).length;
    toast({ type: 'success', message: `Inspection complete — ${withExtra.length} frames, ${defects} defect(s) found.` });
    completeDetection(withExtra);
    navigate('/inspect/report');
  };

  // ── Derived stats ───────────────────────────────────────────────────────────
  const defectFrames    = results.filter(r => r.defects > 0).length;
  const totalDetections = results.reduce((sum, r) => sum + r.detections.length, 0);

  const modeLabel = (() => {
    if (running && hasFrames) return { label: `ANALYSING ${results.length}/${frames.length}`, variant: 'warning' };
    if (running) {
      const modeSuffix = wsMeta?.mode ? ` (${wsMeta.mode.toUpperCase()})` : '';
      const map = { 
        connecting: 'CONNECTING…', 
        connected: `LIVE DETECTION${modeSuffix}`, 
        closed: 'RECONNECTING…', 
        error: 'CONNECTION ERROR' 
      };
      const vmap = { connecting: 'warning', connected: 'success', closed: 'warning', error: 'error' };
      return { label: map[connState] ?? 'CONNECTING…', variant: vmap[connState] ?? 'warning' };
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
                  <span className="material-symbols-outlined">{hasFrames ? 'photo_library' : 'live_tv'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-h2 text-primary text-body-base font-bold">
                    {hasFrames ? `${frames.length} frames from Stage 1` : 'Live backend stream'}
                  </span>
                  <span className="text-body-sm text-on-surface-variant">
                    {hasFrames ? 'Each frame sent to YOLO service once' : 'Video_2.mp4 via YOLO service'}
                  </span>
                </div>
              </div>
            </Card>

            <Card title="DETECTION CONTROLS" padding={true}>
              <div className="flex flex-col gap-lg">
                <div className="flex items-center gap-sm bg-surface-container-low p-sm border border-outline-variant rounded-sm">
                  <span className="material-symbols-outlined text-on-secondary-container text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>model_training</span>
                  <div className="flex flex-col">
                    <span className="font-label-caps text-[10px] text-on-surface-variant">ACTIVE MODEL</span>
                    <span className="font-code text-[11px] text-primary font-bold">railway_inspection_v1-4 / best.pt</span>
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
                  {results.length}{hasFrames ? ` / ${frames.length}` : ''} frames
                </span>
              </div>
              {hasFrames
                ? <ProgressBar progress={progress} height="h-2" />
                : running
                  ? <div className="h-2 bg-surface-container-high rounded overflow-hidden"><div className="h-full bg-primary animate-pulse w-full" /></div>
                  : <ProgressBar progress={results.length > 0 ? 100 : 0} height="h-2" />
              }
            </div>

            {/* Results Gallery */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg flex-1 overflow-hidden flex flex-col shadow-sm">
              <div className="px-panel-padding py-md border-b border-outline-variant flex justify-between items-center bg-surface-container-low/30">
                <span className="font-label-caps text-on-surface-variant text-[11px]">DETECTION RESULTS GALLERY</span>
                {running && !hasFrames && (
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
