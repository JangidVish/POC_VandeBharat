import React, { useState, useRef, useCallback } from 'react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import ProgressBar from '../../components/common/ProgressBar';
import StatusChip from '../../components/common/StatusChip';
import FrameCard from './FrameCard';
import FrameDetailDrawer from './FrameDetailDrawer';
import { useToast } from '../../context/ToastContext';

// Simulate a Vande Bharat route: New Delhi → Agra (≈200 km, ~1h 20m)
function simulateGps(frameTimeSec) {
  const START_LAT = 28.6408, START_LON = 77.2195; // New Delhi station
  const END_LAT   = 27.1767, END_LON   = 78.0081; // Agra Cantt
  const ROUTE_SEC = 4800; // 80 minutes
  const frac = Math.min(frameTimeSec / ROUTE_SEC, 1);
  // Small deterministic jitter (no random — stays stable on re-render)
  const jLat = Math.sin(frameTimeSec * 0.7) * 0.0003;
  const jLon = Math.cos(frameTimeSec * 0.5) * 0.0003;
  const lat = (START_LAT + (END_LAT - START_LAT) * frac + jLat).toFixed(4);
  const lon = (START_LON + (END_LON - START_LON) * frac + jLon).toFixed(4);
  return `${lat}°N, ${lon}°E`;
}

async function extractFramesFromVideo(file, intervalMs, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.src = url;
    video.muted = true;
    video.preload = 'metadata';

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load video file'));
    };

    video.onloadedmetadata = () => {
      const duration = video.duration;
      if (!isFinite(duration) || duration === 0) {
        URL.revokeObjectURL(url);
        reject(new Error('Invalid video duration'));
        return;
      }

      // intervalMs is the sole driver — directly sets time between captured frames
      const stepSec = Math.max(intervalMs / 1000, 0.04); // floor at 25fps to avoid freezing browser
      const totalFrames = Math.floor(duration / stepSec);
      const frames = [];
      let seekIndex = 0;
      let seeking = false;

      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 180;
      const ctx = canvas.getContext('2d');

      const captureNext = () => {
        if (signal?.aborted) {
          URL.revokeObjectURL(url);
          resolve(frames);
          return;
        }
        const t = seekIndex * stepSec;
        if (t > duration) {
          URL.revokeObjectURL(url);
          resolve(frames);
          return;
        }
        seeking = true;
        video.currentTime = t;
      };

      video.onseeked = () => {
        if (!seeking) return;
        seeking = false;

        ctx.drawImage(video, 0, 0, 320, 180);
        const thumbnail = canvas.toDataURL('image/jpeg', 0.75);
        const t = seekIndex * stepSec;
        const h = Math.floor(t / 3600);
        const m = Math.floor((t % 3600) / 60);
        const s = Math.floor(t % 60);
        const ts = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;

        frames.push({
          id: `img_${String(frames.length + 1).padStart(3, '0')}`,
          timestamp: ts,
          frameTime: t,
          gps: simulateGps(t),
          iso: '—',
          thumbnail,
        });

        onProgress(Math.min((seekIndex + 1) / Math.max(totalFrames, 1), 1));
        seekIndex++;
        requestAnimationFrame(captureNext);
      };

      captureNext();
    };
  });
}

function formatDuration(seconds) {
  if (!isFinite(seconds)) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

const VideoFraming = ({ onComplete }) => {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const abortRef = useRef(null);

  const [isDragging, setIsDragging] = useState(false);
  const [videoFile, setVideoFile] = useState(null);
  const [videoDuration, setVideoDuration] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [frames, setFrames] = useState([]);
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  // Single source of truth — interval and FPS are the same thing expressed differently
  const [intervalMs, setIntervalMs] = useState(500);
  const fps = parseFloat((1000 / Math.max(intervalMs, 40)).toFixed(2));

  const handleIntervalChange = (val) => {
    const n = Math.max(40, Number(val) || 40); // min 40ms = 25fps
    setIntervalMs(n);
  };

  const handleFpsChange = (val) => {
    const f = Math.max(0.1, Number(val) || 1);
    setIntervalMs(Math.round(1000 / f));
  };

  const estimatedFrames = videoDuration != null
    ? Math.floor(videoDuration / (Math.max(intervalMs, 40) / 1000))
    : null;

  const loadVideoMeta = (file) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.src = URL.createObjectURL(file);
    v.onloadedmetadata = () => {
      setVideoDuration(v.duration);
      URL.revokeObjectURL(v.src);
    };
  };

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith('video/')) {
      toast({ type: 'error', message: 'Please select a valid video file (MP4, AVI, MOV).' });
      return;
    }
    setVideoFile(file);
    setFrames([]);
    setProgress(0);
    loadVideoMeta(file);
    toast({ type: 'info', message: `Video loaded: ${file.name}` });
  }, [toast]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }, [handleFile]);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const startExtraction = async () => {
    if (!videoFile) {
      toast({ type: 'warning', message: 'Please upload a video file first.' });
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setIsExtracting(true);
    setFrames([]);
    setProgress(0);

    try {
      const extracted = await extractFramesFromVideo(
        videoFile,
        Math.max(Number(intervalMs), 40),
        (p) => setProgress(Math.round(p * 100)),
        controller.signal,
      );
      setFrames(extracted);
      setProgress(100);
      toast({ type: 'success', message: `Extracted ${extracted.length} frames successfully.` });
    } catch (err) {
      if (!controller.signal.aborted) {
        toast({ type: 'error', message: `Extraction failed: ${err.message}` });
      }
    } finally {
      setIsExtracting(false);
    }
  };

  const stopExtraction = () => {
    abortRef.current?.abort();
    setIsExtracting(false);
    toast({ type: 'info', message: 'Frame extraction paused.' });
  };

  const handleReset = () => {
    abortRef.current?.abort();
    setIsExtracting(false);
    setFrames([]);
    setProgress(0);
    setVideoFile(null);
    setVideoDuration(null);
  };

  const handleProceed = () => {
    if (frames.length === 0) {
      toast({ type: 'warning', message: 'No frames to proceed with. Extract frames first.' });
      return;
    }
    toast({ type: 'success', message: `${frames.length} frames sent to Detection module.` });
    onComplete?.(frames);
  };

  const handleFrameClick = (frame) => {
    setSelectedFrame(frame);
    setIsDrawerOpen(true);
  };

  const handleSendToDetection = () => {
    setIsDrawerOpen(false);
    handleProceed();
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
      {/* Left Column: Controls */}
      <aside className="w-full md:w-[380px] border-r border-outline-variant bg-surface-container-low p-panel-padding overflow-y-auto custom-scrollbar">
        <div className="flex flex-col gap-lg">
          {/* Video Upload Card */}
          <Card title="Video Source" icon="videocam" padding={false}>
            <div className="p-md flex flex-col gap-md">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files[0])}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-lg p-lg flex flex-col items-center justify-center gap-sm transition-colors cursor-pointer group
                  ${isDragging
                    ? 'border-primary bg-surface-container-high'
                    : 'border-outline-variant bg-surface-container-low hover:bg-surface-container-high'
                  }`}
              >
                <span className="material-symbols-outlined text-on-surface-variant text-[32px] group-hover:text-primary transition-colors">upload_file</span>
                <div className="text-center">
                  <p className="font-body-base text-primary font-medium">
                    {isDragging ? 'Drop video here' : 'Drag & drop or click to upload'}
                  </p>
                  <p className="font-label-caps text-on-surface-variant mt-xs text-[10px]">MP4, AVI, MOV (MAX 2GB)</p>
                </div>
              </div>

              <div className="flex flex-col gap-xs pt-xs">
                <div className="flex justify-between font-label-caps text-on-surface-variant text-[10px]">
                  <span>FILENAME</span>
                  <span className="text-primary truncate max-w-[180px]">{videoFile?.name ?? '—'}</span>
                </div>
                <div className="flex justify-between font-label-caps text-on-surface-variant text-[10px]">
                  <span>DURATION</span>
                  <span className="text-primary">{videoDuration != null ? formatDuration(videoDuration) : '—'}</span>
                </div>
                <div className="flex justify-between font-label-caps text-on-surface-variant text-[10px]">
                  <span>SIZE</span>
                  <span className="text-primary">{videoFile ? `${(videoFile.size / 1024 / 1024).toFixed(1)} MB` : '—'}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Extraction Controls */}
          <Card title="Extraction Params" icon="tune" padding={false}>
            <div className="p-md flex flex-col gap-md">
              <div className="grid grid-cols-2 gap-md">
                <Input
                  label="INTERVAL (MS)"
                  type="number"
                  min="40"
                  value={intervalMs}
                  onChange={(e) => handleIntervalChange(e.target.value)}
                  disabled={isExtracting}
                />
                <Input
                  label="FPS EQUIVALENT"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={fps}
                  onChange={(e) => handleFpsChange(e.target.value)}
                  disabled={isExtracting}
                />
              </div>
              <p className="font-label-caps text-on-surface-variant text-[10px]">
                Changing either field updates the other — they represent the same setting.
              </p>
              {estimatedFrames != null && (
                <div className="flex justify-between items-center bg-surface-container-high px-sm py-xs rounded-sm border border-outline-variant">
                  <span className="font-label-caps text-on-surface-variant text-[10px]">EST. FRAMES</span>
                  <span className="font-code text-primary text-[12px] font-bold">~{estimatedFrames.toLocaleString()}</span>
                </div>
              )}
              <div className="flex flex-col gap-sm pt-sm">
                <Button
                  variant="primary"
                  icon={isExtracting ? 'pause' : 'play_arrow'}
                  className="w-full"
                  onClick={isExtracting ? stopExtraction : startExtraction}
                  disabled={!videoFile && !isExtracting}
                >
                  {isExtracting ? 'PAUSE FRAMING' : 'START FRAMING'}
                </Button>
                <Button variant="outline" className="w-full" onClick={handleReset} disabled={isExtracting}>
                  RESET
                </Button>
              </div>
            </div>
          </Card>

          {/* Progress */}
          <Card padding={true}>
            <ProgressBar
              progress={progress}
              label={isExtracting ? 'EXTRACTING FRAMES...' : progress === 100 ? 'COMPLETE' : 'IDLE'}
              value={`${progress}%`}
            />
            <div className="flex justify-between items-center mt-md">
              <span className="font-body-sm text-on-surface-variant text-[12px]">
                {frames.length > 0 ? `Last: ${frames[frames.length - 1].id}` : 'No frames yet'}
              </span>
              <span className="font-body-sm text-on-surface-variant text-[12px]">{frames.length} frames</span>
            </div>
            {isExtracting && (
              <div className="flex gap-xs mt-md">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="w-8 h-8 bg-surface-container-high rounded-sm animate-pulse" />
                ))}
              </div>
            )}
          </Card>

          {/* Proceed Button */}
          {frames.length > 0 && !isExtracting && (
            <Button variant="primary" icon="arrow_forward" className="w-full" onClick={handleProceed}>
              PROCEED TO DETECTION ({frames.length} frames)
            </Button>
          )}
        </div>
      </aside>

      {/* Right Column: Workspace */}
      <div className="flex-1 flex flex-col min-w-0 bg-surface">
        <header className="px-lg py-lg border-b border-outline-variant bg-surface-container-lowest">
          <nav className="flex items-center gap-xs font-label-caps text-on-surface-variant text-[11px] mb-xs">
            <span>Pipeline Overview</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-primary">Video Framing</span>
          </nav>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-md">
            <div>
              <h1 className="font-display text-display text-primary">Video Framing Module</h1>
              <p className="font-body-base text-on-surface-variant mt-xs">
                Extract structured image frames from railway inspection videos for downstream defect detection.
              </p>
            </div>
            <StatusChip label="LOCAL PROCESSING ENABLED" variant="info" icon="memory" />
          </div>
        </header>

        <div className="p-lg flex-1 overflow-y-auto custom-scrollbar">
          {frames.length === 0 && !isExtracting ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-md opacity-50 select-none">
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant">video_file</span>
              <p className="font-body-base text-on-surface-variant">Upload a video and click START FRAMING to extract frames.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-md">
              {frames.map((frame) => (
                <FrameCard
                  key={frame.id}
                  {...frame}
                  onClick={() => handleFrameClick(frame)}
                />
              ))}
              {isExtracting && (
                <div className="border border-outline-variant bg-surface-container-low flex flex-col animate-pulse rounded-default overflow-hidden">
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

      <FrameDetailDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        frame={selectedFrame}
        onSendToDetection={handleSendToDetection}
      />
    </div>
  );
};

export default VideoFraming;
