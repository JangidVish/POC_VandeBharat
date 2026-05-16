import React, { useState, useEffect } from 'react';
import AppShell from './components/layout/AppShell';
import PipelineProgress from './components/pipeline/PipelineProgress';
import { Upload, Play, CheckCircle, Timer, Zap, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:5001';

function getBestValue(method) {
  return method?.best
    ?? method?.train_number
    ?? method?.train_no
    ?? method?.trainNumber
    ?? null;
}

function getBestSource(method) {
  return method?.best_source ?? method?.bestSource ?? null;
}

function getDetectionMap(method) {
  const detections = method?.detections;
  if (!detections) return {};
  if (Array.isArray(detections)) {
    return detections.reduce((acc, item) => {
      const key = item?.text ?? item?.number ?? item?.candidate;
      if (!key) return acc;
      acc[key] = item?.count ?? 1;
      return acc;
    }, {});
  }
  return detections;
}

export default function App() {
  const [activeModule, setActiveModule] = useState('inspections'); // inspections, logs, settings
  const [stage, setStage] = useState('upload');
  const [file, setFile] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [framingProgress, setFramingProgress] = useState(0);
  const [history, setHistory] = useState([]);
  
  // Settings
  const [settings, setSettings] = useState({
    maxFrames: 5,
    frameSkip: 15,
    yoloConf: 0.25
  });

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setError(null);
    }
  };

  const startPipeline = async () => {
    if (!file) return;
    
    setLoading(true);
    setStage('framing');
    setFramingProgress(0);

    for (let i = 1; i <= 10; i++) {
      await new Promise(r => setTimeout(r, 200));
      setFramingProgress(i * 10);
    }

    setStage('analysis');
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('frame_skip', settings.frameSkip.toString());
    formData.append('max_frames', settings.maxFrames.toString());

    try {
      const endpoint = file.type.startsWith('video') ? '/api/ocr/video_compare' : '/api/ocr/compare';
      const response = await axios.post(`${BASE_URL}${endpoint}`, formData);
      
      const data = response.data;
      setResults(data);
      setHistory(prev => [{
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        fileName: file.name,
        saving: data.saving_avg || data.saving,
        m1: data.method1.avg_ms || data.method1.total_ms,
        m2: data.method2.avg_ms || data.method2.total_ms
      }, ...prev]);
      
      setStage('comparison');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to connect to backend server');
      setStage('upload');
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    switch (activeModule) {
      case 'settings':
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto space-y-6 p-8">
            <h2 className="text-2xl font-bold">Pipeline Configuration</h2>
            <div className="industrial-card p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Max Frames to Benchmark</label>
                <input 
                  type="number" 
                  value={settings.maxFrames}
                  onChange={(e) => setSettings({...settings, maxFrames: parseInt(e.target.value)})}
                  className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white"
                />
                <p className="text-[10px] text-slate-500 italic">Total sampled frames per video for average latency calculation.</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Frame Skip Interval</label>
                <input 
                  type="number" 
                  value={settings.frameSkip}
                  onChange={(e) => setSettings({...settings, frameSkip: parseInt(e.target.value)})}
                  className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white"
                />
              </div>
            </div>
          </motion.div>
        );
      
      case 'logs':
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto p-8 space-y-6">
            <h2 className="text-2xl font-bold">Inference History</h2>
            <div className="industrial-card overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-800/50 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="p-4">Time</th>
                    <th className="p-4">Filename</th>
                    <th className="p-4">Legacy</th>
                    <th className="p-4">Optimized</th>
                    <th className="p-4">Savings</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-mono divide-y divide-slate-800">
                  {history.map(item => (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 text-slate-500">{item.timestamp}</td>
                      <td className="p-4 text-white font-semibold">{item.fileName}</td>
                      <td className="p-4 text-danger">{Math.round(item.m1)}ms</td>
                      <td className="p-4 text-success">{Math.round(item.m2)}ms</td>
                      <td className="p-4 font-bold text-primary">-{Math.round(item.saving)}ms</td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr><td colSpan="5" className="p-12 text-center text-slate-600 italic">No historical data available</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        );

      case 'inspections':
      default:
        return (
          <div className="flex-1 overflow-auto p-8">
            <div className="max-w-6xl mx-auto space-y-8">
              <AnimatePresence mode="wait">
                {stage === 'upload' && (
                  <motion.div 
                    key="upload" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                    className="flex flex-col items-center justify-center min-h-[400px] bg-slate-900/30 border-2 border-dashed border-slate-800 rounded-2xl p-12 text-center"
                  >
                    <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6">
                      <Upload className="text-primary w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Initialize Benchmark Pipeline</h2>
                    <p className="text-slate-400 mb-8 max-w-md">Running {settings.maxFrames} frames per video at {settings.frameSkip}x skip.</p>
                    <input type="file" id="file-input" hidden onChange={handleFileUpload} accept="image/*,video/*" />
                    <div className="flex items-center gap-4">
                      <label htmlFor="file-input" className="btn-primary cursor-pointer">Select File</label>
                      {file && (
                        <button onClick={startPipeline} className="bg-success hover:bg-emerald-600 text-white px-6 py-2 rounded-md font-bold transition-all flex items-center gap-2">
                          <Play size={18} fill="currentColor" /> Run Analysis
                        </button>
                      )}
                    </div>
                    {file && <p className="mt-4 text-xs font-mono text-success">SELECTED: {file.name}</p>}
                    {error && <div className="mt-6 p-4 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-3 text-danger"><AlertCircle size={20} /><span>{error}</span></div>}
                  </motion.div>
                )}

                {stage === 'framing' && (
                  <motion.div key="framing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                    <div className="industrial-card p-8 text-center bg-slate-900/80">
                      <h3 className="text-xl font-bold mb-6">Extracting Frames from Sequence</h3>
                      <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden mb-4">
                        <motion.div className="absolute top-0 left-0 h-full bg-primary" style={{ width: `${framingProgress}%` }} />
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                        <span>{framingProgress}% Complete</span>
                        <span>Sampling {settings.maxFrames} Target Points</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {stage === 'analysis' && (
                  <div key="analysis" className="flex flex-col items-center justify-center min-h-[400px]">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                    <h3 className="text-xl font-bold">Dual-Method Benchmarking...</h3>
                  </div>
                )}

                {stage === 'comparison' && results && (
                  <motion.div key="comparison" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-12 gap-8 pb-12">
                    <div className="col-span-8 space-y-6">
                      <div className="industrial-card p-6">
                        <div className="flex items-center justify-between mb-8">
                          <div>
                            <h3 className="text-lg font-bold">Latency Benchmark</h3>
                            <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">Average Response Time (ms)</p>
                          </div>
                          <div className="bg-success/20 text-success px-3 py-1 rounded-md flex items-center gap-2">
                            <Zap size={14} />
                            <span className="text-xs font-bold">
                              {results.method1.avg_ms ? Math.round((results.method1.avg_ms - results.method2.avg_ms) / results.method1.avg_ms * 100) : 0}% FASTER
                            </span>
                          </div>
                        </div>
                        <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[
                              { name: 'Legacy (Full)', time: results.method1.avg_ms || results.method1.total_ms },
                              { name: 'YOLO (Crop)', time: results.method2.avg_ms || results.method2.total_ms }
                            ]}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                              <YAxis stroke="#94a3b8" fontSize={12} unit="ms" />
                              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                              <Bar dataKey="time" radius={[4, 4, 0, 0]} barSize={60}>
                                <Cell fill="#ef4444" />
                                <Cell fill="#10b981" />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <MethodStatsCard title="Legacy Method" time={results.method1.avg_ms || results.method1.total_ms} best={getBestValue(results.method1)} desc="Full 1080p Image Processing" type="legacy" />
                        <MethodStatsCard title="Optimized Method" time={results.method2.avg_ms || results.method2.total_ms} best={getBestValue(results.method2)} source={getBestSource(results.method2)} desc="YOLO-Cropped (Targeted) OCR" type="optimized" breakdown={results.method2} />
                      </div>

                      <div className="industrial-card p-6">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-6">Detection Accuracy Comparison</h3>
                        <div className="grid grid-cols-2 gap-8">
                          <div>
                            <h4 className="text-xs font-bold text-danger mb-3 uppercase tracking-wider">Method 1 Detections</h4>
                            <DetectionList detections={getDetectionMap(results.method1)} />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-success mb-3 uppercase tracking-wider">Method 2 Detections</h4>
                            <DetectionList detections={getDetectionMap(results.method2)} />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="col-span-4 space-y-6">
                      <div className="industrial-card p-6 bg-primary/10 border-primary/20">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-4">Performance ROI</h3>
                        <div className="space-y-4">
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase font-bold">Latency Reduction</p>
                            <p className="text-3xl font-black text-white">-{Math.round(results.saving_avg || results.saving)}ms</p>
                          </div>
                        </div>
                        <button onClick={() => setStage('upload')} className="w-full mt-8 btn-primary justify-center">Run New Test</button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        );
    }
  };

  return (
    <AppShell 
      activeStep={stage.toUpperCase()} 
      activeModule={activeModule}
      onModuleChange={setActiveModule}
    >
      <PipelineProgress currentStage={activeModule === 'inspections' ? stage : 'upload'} />
      {renderContent()}
    </AppShell>
  );
}

function DetectionList({ detections }) {
  const entries = Object.entries(detections || {});
  if (entries.length === 0) return <div className="text-xs text-slate-600 italic">No train numbers detected</div>;
  return (
    <div className="space-y-2">
      {entries.map(([number, count]) => (
        <div key={number} className="flex items-center justify-between bg-slate-800/40 p-2 rounded border border-slate-700/50">
          <span className="font-mono text-sm font-bold text-white tracking-wider">{number}</span>
          <span className="text-[9px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded uppercase font-bold">Found {count}x</span>
        </div>
      ))}
    </div>
  );
}

function MethodStatsCard({ title, time, desc, type, breakdown, best, source }) {
  const isLegacy = type === 'legacy';
  return (
    <div className={`industrial-card p-6 ${isLegacy ? 'border-l-4 border-l-danger' : 'border-l-4 border-l-success'}`}>
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-bold">{title}</h4>
        <Timer size={16} className={isLegacy ? 'text-danger' : 'text-success'} />
      </div>
      <div className="mb-4">
        <p className="text-2xl font-black">{Math.round(time)} ms</p>
        <p className="text-[10px] text-slate-500 uppercase font-bold">{desc}</p>
      </div>
      <div className="mb-4">
        <p className="text-[9px] text-slate-500 uppercase font-bold mb-1">Detected Train No.</p>
        <p className="text-lg font-black tracking-wider text-white">{best || 'Not detected'}</p>
        {source && (
          <p className="text-[9px] text-slate-500 uppercase font-bold mt-1">Source: {source}</p>
        )}
      </div>
      {breakdown && (
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
          <div><p className="text-[9px] text-slate-500 uppercase font-bold">Detection</p><p className="text-xs font-bold text-success">{Math.round(breakdown.avg_det_ms || breakdown.det_ms)} ms</p></div>
          <div><p className="text-[9px] text-slate-500 uppercase font-bold">OCR (Target)</p><p className="text-xs font-bold text-success">{Math.round(breakdown.avg_ocr_ms || breakdown.ocr_ms)} ms</p></div>
        </div>
      )}
    </div>
  );
}
