import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import GlassCard from './ui/GlassCard';
import Badge from './ui/Badge';
import Spinner from './ui/Spinner';
import Button from './common/Button';
import useInspectionStore from '../store/useInspectionStore';
import { useToast } from '../store/useToastStore';

const OCR_SERVER = 'http://127.0.0.1:5000';

function ProgressBar({ value }) {
  return (
    <div className="h-1.5 bg-outline-variant rounded-full overflow-hidden">
      <div
        className="h-full bg-primary transition-all duration-300 ease-out"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

// Convert base64 to Blob
function b64ToBlob(dataUrl) {
  if (!dataUrl) return null;
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export default function OCRPanel() {
  const navigate = useNavigate();
  const toast = useToast();
  const completeOCR = useInspectionStore((s) => s.completeOCR);
  const setOcrResults = useInspectionStore((s) => s.setOcrResults);
  const extractedFrames = useInspectionStore((s) => s.extractedFrames);
  
  const [activeTab, setActiveTab] = useState(extractedFrames.length > 0 ? 'extracted' : 'image');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [voteThresh, setVoteThresh] = useState(5);

  const [intervalMs, setIntervalMs] = useState(500);
  const [videoDuration, setVideoDuration] = useState(null);
  const estimatedFrames = videoDuration != null
    ? Math.floor(videoDuration / (Math.max(intervalMs, 40) / 1000))
    : null;

  const [streamMeta, setStreamMeta] = useState(null);
  const [streamFrame, setStreamFrame] = useState(null);
  const [streamLogs, setStreamLogs] = useState([]);
  const [liveVotes, setLiveVotes] = useState({});
  const [liveThumb, setLiveThumb] = useState(null);

  const imageInputRef = useRef();
  const videoInputRef = useRef();
  const logsEndRef = useRef();
  const abortRef = useRef(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamLogs]);

  const handleFile = useCallback((f) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);
    setStreamMeta(null);
    setStreamFrame(null);
    setStreamLogs([]);
    setLiveVotes({});
    setLiveThumb(null);
    if (activeTab === 'image') {
      setPreview(URL.createObjectURL(f));
      setVideoDuration(null);
    } else if (activeTab === 'video') {
      setPreview(null);
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.src = URL.createObjectURL(f);
      v.onloadedmetadata = () => { setVideoDuration(v.duration); URL.revokeObjectURL(v.src); };
    }
  }, [activeTab]);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setStreamMeta(null);
    setStreamFrame(null);
    setStreamLogs([]);
    setLiveVotes({});
    setLiveThumb(null);
    setBatchProgress(0);
    setVideoDuration(null);
  };

  const pushLog = (msg) => {
    const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setStreamLogs(prev => [...prev.slice(-49), { time, message: msg }]);
  };

  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop = (e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); };

  const runImageOCR = async (customFile = null) => {
    const targetFile = customFile || file;
    if (!targetFile) return;
    setLoading(true);
    setError(null);
    setResult(null);
    const fd = new FormData();
    fd.append('file', targetFile);
    try {
      const res = await fetch(`${OCR_SERVER}/api/ocr/image`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Server error');
      setResult({ ...data, mode: 'image' });
      if (data.best) {
        completeOCR(data.best);
        toast({ type: 'success', message: `OCR complete. Detected Bogie: ${data.best}` });
        setTimeout(() => {
          navigate('/inspect/detect');
        }, 1500);
      }
    } catch (err) {
      setError(err.message.includes('Failed to fetch')
        ? 'Cannot reach OCR server on port 5000 — make sure it is running.'
        : err.message);
    } finally {
      setLoading(false);
    }
  };

  const runVideoOCR = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setStreamMeta(null);
    setStreamFrame(null);
    setStreamLogs([]);
    setLiveVotes({});
    setLiveThumb(null);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('interval_ms', intervalMs);
    fd.append('vote_threshold', voteThresh);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${OCR_SERVER}/api/ocr/video/stream`, {
        method: 'POST', body: fd, signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      const pushLog = (line) =>
        setStreamLogs(prev => [...prev.slice(-199), line]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop();

        for (const part of parts) {
          const dataLine = part.split('\n').find(l => l.startsWith('data:'));
          if (!dataLine) continue;
          let evt;
          try { evt = JSON.parse(dataLine.slice(5).trim()); } catch { continue; }

          if (evt.type === 'init') {
            setStreamMeta(evt);
            pushLog(`▶ Video opened — processing ${evt.total_frames} frames`);
          } else if (evt.type === 'frame') {
            setStreamFrame(evt);
            setLiveVotes(evt.votes || {});
            if (evt.thumbnail) setLiveThumb(evt.thumbnail);
          } else if (evt.type === 'done') {
            pushLog(`✓ Done — best result: ${evt.best || 'None'}`);
            setResult({ ...evt, mode: 'video' });
            if (evt.best) {
              completeOCR(evt.best);
              toast({ type: 'success', message: `Video OCR complete. Detected Bogie: ${evt.best}` });
              setTimeout(() => {
                navigate('/inspect/detect');
              }, 1500);
            }
            setLoading(false);
          } else if (evt.type === 'error') {
            throw new Error(evt.message);
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message.includes('Failed to fetch')
        ? 'Cannot reach OCR server on port 5000 — make sure it is running.'
        : err.message);
    } finally {
      setLoading(false);
    }
  };

  const stopVideo = () => {
    abortRef.current?.abort();
    setLoading(false);
    if (Object.keys(liveVotes).length > 0) {
      const best = Object.entries(liveVotes).sort((a, b) => b[1] - a[1])[0][0];
      setResult({ best, votes: liveVotes, mode: 'video' });
      completeOCR(best);
    }
  };

  const runExtractedOCR = (frame) => {
    const blob = b64ToBlob(frame.thumbnail);
    const f = new File([blob], `${frame.id}.jpg`, { type: 'image/jpeg' });
    runImageOCR(f);
  };

  const [batchProgress, setBatchProgress] = useState(0);

  const runBatchOCR = async () => {
    if (extractedFrames.length === 0) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setLiveVotes({});
    setBatchProgress(0);
    setStreamLogs([]);
    
    const votes = {};
    const total = extractedFrames.length;
    pushLog(`▶ Starting Batch OCR on ${total} frames...`);

    try {
      for (let i = 0; i < total; i++) {
        const frame = extractedFrames[i];
        setLiveThumb(frame.thumbnail); // Show current frame being processed
        setBatchProgress(Math.round(((i + 1) / total) * 100));
        
        const blob = b64ToBlob(frame.thumbnail);
        const fd = new FormData();
        fd.append('file', blob, `frame_${i}.jpg`);
        
        const res = await fetch(`${OCR_SERVER}/api/ocr/image`, { method: 'POST', body: fd });
        const data = await res.json();
        
        if (data.best) {
          votes[data.best] = (votes[data.best] || 0) + 1;
          setLiveVotes({ ...votes });
          pushLog(`[Frame ${i+1}/${total}]: Detected "${data.best}"`);
        } else {
          pushLog(`[Frame ${i+1}/${total}]: No text detected`);
        }
      }

      const sorted = Object.entries(votes).sort((a,b) => b[1] - a[1]);
      if (sorted.length > 0) {
        const best = sorted[0][0];
        const resObj = { best, votes, mode: 'batch' };
        setResult(resObj);
        setOcrResults(resObj);
        completeOCR(best);
        pushLog(`✓ Batch Complete. Primary Candidate: ${best}`);
        toast({ type: 'success', message: `Batch OCR complete. Detected Bogie: ${best}` });
        setTimeout(() => {
          navigate('/inspect/detect');
        }, 1500);
      } else {
        setError("No clear text detected in any frames.");
        pushLog(`⚠ Batch finished with no results.`);
      }
    } catch (err) {
      setError("Batch processing interrupted. Check OCR service connection.");
      pushLog(`✖ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const runOCR = () => {
    if (activeTab === 'image') runImageOCR();
    else if (activeTab === 'video') runVideoOCR();
  };

  const progressValue = activeTab === 'video' ? (streamFrame ? streamFrame.progress : 0) : batchProgress;
  const processedCnt = activeTab === 'video' ? (streamFrame?.processed ?? 0) : Math.floor((batchProgress/100) * extractedFrames.length);

  return (
    <div className="flex-1 flex flex-col gap-lg bg-surface p-panel-padding overflow-y-auto custom-scrollbar">
      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-lg flex-1 min-h-0">
        
        {/* LEFT: Controls & Frame Selection */}
        <div className="lg:col-span-3 flex flex-col gap-md min-w-0">
          <div className="flex bg-surface-container-low p-1 rounded-sm gap-1">
            {['extracted', 'image', 'video'].map(t => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                disabled={t === 'extracted' && extractedFrames.length === 0}
                className={`flex-1 py-1.5 px-2 rounded-sm font-label-caps text-[9px] transition-all whitespace-nowrap
                  ${activeTab === t ? 'bg-surface shadow-sm text-primary font-bold' : 'text-on-surface-variant hover:text-primary'}
                  ${t === 'extracted' && extractedFrames.length === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            {activeTab === 'extracted' ? (
              <div className="flex flex-col gap-sm h-full overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="font-label-caps text-[10px] text-outline uppercase tracking-wider">Select Frame from S1</span>
                  <button 
                    onClick={runBatchOCR}
                    disabled={loading || extractedFrames.length === 0}
                    className="font-label-caps text-[9px] text-primary hover:underline disabled:opacity-30 disabled:no-underline font-bold"
                  >
                    PROCESS ALL FRAMES
                  </button>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-2 overflow-y-auto custom-scrollbar pr-1">
                  {extractedFrames.map(f => (
                    <button 
                      key={f.id}
                      onClick={() => runExtractedOCR(f)}
                      className="group relative aspect-video rounded-md overflow-hidden border border-outline-variant hover:border-primary transition-all bg-black"
                    >
                      <img src={f.thumbnail} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors" />
                      <div className="absolute bottom-0 left-0 right-0 bg-surface-container-lowest/90 px-1.5 py-1 flex justify-between text-[8px] font-code text-on-surface border-t border-outline-variant/30">
                        <span className="font-bold">{f.id}</span>
                        <span className="opacity-70">{f.timestamp}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-md">
                <GlassCard
                  onClick={() => (activeTab === 'image' ? imageInputRef : videoInputRef).current.click()}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  className={`group cursor-pointer border-2 border-dashed flex flex-col items-center justify-center py-xl px-lg text-center transition-all
                    ${dragging ? 'border-primary bg-primary/5' : 'border-outline-variant hover:border-primary/50'}`}
                >
                  <span className="material-symbols-outlined text-[32px] text-primary/40 group-hover:text-primary transition-colors mb-sm">
                    {activeTab === 'image' ? 'image' : 'video_library'}
                  </span>
                  <p className="font-label-caps text-[10px] text-primary mb-1">
                    {file ? file.name : `DROP ${activeTab.toUpperCase()}`}
                  </p>
                  <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={e => handleFile(e.target.files[0])} />
                  <input ref={videoInputRef} type="file" accept="video/*" hidden onChange={e => handleFile(e.target.files[0])} />
                </GlassCard>

                {activeTab === 'image' && preview && (
                  <div className="rounded-md overflow-hidden border border-outline-variant aspect-video bg-black shadow-inner">
                    <img src={preview} alt="preview" className="w-full h-full object-contain" />
                  </div>
                )}

                {activeTab === 'video' && (
                  <GlassCard className="p-sm flex flex-col gap-sm bg-surface-container-low/50">
                    <div className="grid grid-cols-2 gap-sm">
                      <div className="flex flex-col gap-1">
                        <span className="font-label-caps text-[9px] text-outline uppercase">Interval (ms)</span>
                        <input
                          type="number"
                          value={intervalMs}
                          onChange={e => setIntervalMs(Math.max(40, Number(e.target.value)))}
                          className="bg-surface border border-outline-variant rounded-sm px-2 py-1 font-code text-[11px] focus:border-primary outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="font-label-caps text-[9px] text-outline uppercase">Threshold</span>
                        <input
                          type="number"
                          value={voteThresh}
                          onChange={e => setVoteThresh(Number(e.target.value))}
                          className="bg-surface border border-outline-variant rounded-sm px-2 py-1 font-code text-[11px] focus:border-primary outline-none"
                        />
                      </div>
                    </div>
                  </GlassCard>
                )}
              </div>
            )}
          </div>

          <div className="mt-md pt-md border-t border-outline-variant/30">
            {activeTab !== 'extracted' && (
              loading && activeTab === 'video' ? (
                <Button variant="danger" className="w-full" onClick={stopVideo}>STOP OCR</Button>
              ) : (
                <Button variant="primary" className="w-full" onClick={runOCR} disabled={!file || loading}>
                  {loading ? 'RUNNING...' : 'RUN OCR'}
                </Button>
              )
            )}
            {error && (
              <div className="mt-sm p-2 bg-error/10 text-error text-[10px] rounded-sm border border-error/20 font-medium">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Results & Visualization */}
        <div className="lg:col-span-9 flex flex-col gap-lg min-w-0">
          <GlassCard className="flex flex-col items-center justify-center py-xl px-2 bg-surface-container-lowest border-primary/20 relative overflow-hidden shadow-sm">
             {/* Background glow */}
             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-primary/5 blur-[80px] rounded-full" />
             
             <span className="font-label-caps text-[10px] text-outline tracking-[0.3em] mb-md uppercase relative z-10">Detected Bogie Identification</span>
             <div className="relative z-10 flex flex-col items-center">
               {loading ? (
                 <div className="flex items-center gap-lg">
                   <div className="relative">
                      <Spinner size="lg" />
                      <div className="absolute inset-0 animate-ping border border-primary/30 rounded-full" />
                   </div>
                   <span className="font-display text-display text-primary/30 animate-pulse tracking-[0.2em] uppercase">Scanning...</span>
                 </div>
               ) : result?.best ? (
                 <div className="flex flex-col items-center">
                   <span className="font-display text-[80px] font-bold text-primary tracking-[0.15em] leading-none drop-shadow-md tabular-nums">
                     {result.best}
                   </span>
                   <div className="mt-md flex items-center gap-xs">
                      <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                      <span className="font-label-caps text-[10px] text-success font-bold tracking-widest uppercase">Verified Candidate</span>
                   </div>
                 </div>
               ) : (
                 <span className="font-display text-[56px] text-outline/10 uppercase tracking-[0.2em] select-none">Waiting...</span>
               )}
             </div>

             {(loading || result?.mode === 'batch' || result?.mode === 'video') && Object.keys(liveVotes).length > 0 && (
               <div className="mt-lg flex items-center gap-sm bg-surface-container-high/50 px-4 py-1.5 rounded-full border border-outline-variant/30">
                 <Badge variant="warning">VOTING LIVE</Badge>
                 <span className="font-code text-[11px] text-on-surface-variant font-medium">
                    Current Leader: <span className="text-primary font-bold">{Object.entries(liveVotes).sort((a,b) => b[1]-a[1])[0]?.[0]}</span>
                 </span>
               </div>
             )}

          </GlassCard>

           {(loading || result) && (activeTab === 'video' || activeTab === 'extracted') && (

            <div className="grid grid-cols-1 md:grid-cols-12 gap-md flex-1 min-h-0">
              <GlassCard className="md:col-span-4 p-md flex flex-col gap-md">
                <span className="font-label-caps text-[10px] text-on-surface-variant uppercase">Stream Status</span>
                 <div className="aspect-video bg-black rounded-sm overflow-hidden flex items-center justify-center relative">
                  {liveThumb ? (
                    <img 
                      src={liveThumb.startsWith('data:') ? liveThumb : `data:image/jpeg;base64,${liveThumb}`} 
                      className="w-full h-full object-cover" 
                      alt="Current Frame"
                    />
                  ) : <Spinner />}
                  <div className="absolute top-2 left-2 bg-black/60 px-2 py-0.5 rounded-sm border border-white/10">
                     <span className="font-code text-[8px] text-white uppercase tracking-widest">{activeTab === 'video' ? 'Live Stream' : 'Batch Sync'}</span>
                  </div>
                </div>
                 <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] font-label-caps text-on-surface-variant uppercase tracking-wider">
                    <span>{result ? 'Analysis Complete' : 'AI Processing Progress'}</span>
                    <span className="text-primary font-bold">{result ? 100 : progressValue.toFixed(0)}%</span>
                  </div>
                  <ProgressBar value={result ? 100 : progressValue} />
                </div>
                <div className="grid grid-cols-2 gap-sm">
                   <div className="bg-surface-container-low p-sm rounded-sm text-center">
                      <p className="font-label-caps text-[9px] text-on-surface-variant">Processed</p>
                      <p className="font-code text-[14px] text-primary">{processedCnt}</p>
                   </div>
                   <div className="bg-surface-container-low p-sm rounded-sm text-center">
                      <p className="font-label-caps text-[9px] text-on-surface-variant">Detections</p>
                      <p className="font-code text-[14px] text-primary">{Object.keys(liveVotes).length}</p>
                   </div>
                </div>
              </GlassCard>

              <GlassCard className="md:col-span-8 overflow-hidden flex flex-col border-none bg-surface-container-lowest/50">
                <div className="px-md py-sm border-b border-outline-variant flex justify-between items-center bg-surface-container-low/50">
                  <span className="font-label-caps text-[10px] text-on-surface-variant">VOTE TALLY</span>
                  <span className="font-label-caps text-[9px] text-on-surface-variant">THRESHOLD: {voteThresh}</span>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-surface-container-low text-[10px] font-label-caps text-on-surface-variant">
                      <tr>
                        <th className="px-md py-sm">Candidate</th>
                        <th className="px-md py-sm">Votes</th>
                        <th className="px-md py-sm text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="text-[12px]">
                      {Object.entries(liveVotes).sort((a,b) => b[1]-a[1]).map(([num, votes]) => (
                        <tr key={num} className="border-b border-outline-variant/30 hover:bg-primary/5 transition-colors">
                          <td className="px-md py-sm font-code font-bold text-primary">{num}</td>
                          <td className="px-md py-sm">
                            <div className="flex items-center gap-md">
                              <span className="font-code w-6">{votes}</span>
                              <div className="flex-1 h-1 bg-outline-variant rounded-full overflow-hidden max-w-[100px]">
                                <div 
                                  className={`h-full ${votes >= voteThresh ? 'bg-success' : 'bg-primary'}`}
                                  style={{ width: `${Math.min(votes/voteThresh * 100, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-md py-sm text-right">
                            {votes >= voteThresh ? (
                               <Badge variant="success">CONFIRMED</Badge>
                            ) : <Badge variant="neutral">VOTING</Badge>}
                          </td>
                        </tr>
                      ))}
                      {Object.keys(liveVotes).length === 0 && (
                        <tr>
                          <td colSpan="3" className="px-md py-xl text-center text-on-surface-variant italic opacity-50 uppercase tracking-widest text-[10px]">
                            Waiting for candidates...
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </div>
          )}

          {activeTab === 'video' && streamLogs.length > 0 && (
            <div className="bg-black/90 text-success p-md font-code text-[11px] rounded-sm max-h-[120px] overflow-y-auto custom-scrollbar border border-outline-variant/20">
              {streamLogs.map((log, i) => (
                <div key={i} className="mb-0.5 opacity-80 hover:opacity-100">{log}</div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}

          {result && (
            <GlassCard className="p-md flex items-center justify-between bg-primary/5 border-primary/20">
              <div className="flex flex-col">
                <span className="font-label-caps text-[10px] text-primary uppercase">OCR Stage Complete</span>
                <p className="text-[11px] text-on-surface-variant">Bogie {result.best || 'Unknown'} locked in for inspection.</p>
              </div>
              <Button 
                variant="primary" 
                size="sm" 
                icon="arrow_forward" 
                onClick={() => navigate('/inspect/detect')}
              >
                PROCEED TO DETECTION
              </Button>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}
