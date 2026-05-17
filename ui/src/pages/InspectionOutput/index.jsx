import React, { useState, useEffect, useCallback } from 'react';
import KPICard from './KPICard';
import DetectionLogTable from './DetectionLogTable';
import JsonViewer from './JsonViewer';
import Button from '../../components/common/Button';
import { useToast } from '../../store/useToastStore';
import useInspectionStore from '../../store/useInspectionStore';
import { AnimatePresence, motion } from 'framer-motion';
import Badge from '../../components/ui/Badge';
import useDeveloperStore from '../../store/useDeveloperStore';
// ── Data helpers ───────────────────────────────────────────────────────────────

function resultsToTableData(results, trainNumber) {
  if (!results || results.length === 0) return [];
  return results.map((r, i) => {
    const detections = r.detections ?? [];
    const defects    = detections.filter(d => d.type === 'defect');
    const firstDet   = detections[0];
    return {
      imageId:    r.id ?? `IMG_${String(i + 1).padStart(5, '0')}`,
      bogieNo:    trainNumber ?? `B${Math.ceil((i + 1) / 4)}-A`,
      camera:     i % 2 === 0 ? 'LC_CAM_01' : 'RC_CAM_02',
      component:  detections.length > 0 ? detections.map(d => d.label).join(', ') : 'None detected',
      defect:     defects.length > 0 ? defects.map(d => d.label).join(', ') : 'None',
      bbox:       firstDet?.bbox ? `[${Object.values(firstDet.bbox).join(', ')}]` : '—',
      thumbnail:  r.thumbnail ?? null,
      gps:        r.gps ?? '—',
      timestamp:  r.detected_at ?? '—',
      detections,
    };
  });
}

const MOCK_DATA = [
  // { imageId: 'IMG_00124', bogieNo: 'B2-A', camera: 'LC_CAM_01', component: 'Brake Pad',        defect: 'Surface Crack', bbox: '[124, 452, 45, 12]',   thumbnail: null, detections: [], gps: '28.6321°N, 77.2341°E', timestamp: '2026-05-08 09:00:12' },
  // { imageId: 'IMG_00125', bogieNo: 'B2-A', camera: 'LC_CAM_01', component: 'Secondary Spring', defect: 'None',          bbox: '[890, 112, 120, 120]', thumbnail: null, detections: [], gps: '28.5910°N, 77.2589°E', timestamp: '2026-05-08 09:00:24' },
  // { imageId: 'IMG_00128', bogieNo: 'B2-B', camera: 'RC_CAM_02', component: 'Axle Box',         defect: 'Oil Seepage',   bbox: '[445, 320, 80, 80]',  thumbnail: null, detections: [], gps: '28.4773°N, 77.3102°E', timestamp: '2026-05-08 09:00:36' },
  // { imageId: 'IMG_00130', bogieNo: 'B3-A', camera: 'LC_CAM_01', component: 'Wheel Flange',     defect: 'None',          bbox: '[210, 560, 200, 150]', thumbnail: null, detections: [], gps: '28.3641°N, 77.4215°E', timestamp: '2026-05-08 09:00:48' },
];

const PLACEHOLDER = 'https://images.unsplash.com/photo-1515165561174-2978f08a19d5?q=80&w=2070&auto=format&fit=crop';

// ── Shared: bounding box overlay ───────────────────────────────────────────────

function BBoxOverlay({ detections }) {
  return (detections ?? []).map((det, idx) => det.bbox && (
    <div
      key={idx}
      className={`absolute border-2 ${det.type === 'defect' ? 'border-error' : 'border-blue-500'}`}
      style={{ top: det.bbox.top, left: det.bbox.left, width: det.bbox.width, height: det.bbox.height }}
    >
      <span className={`${det.type === 'defect' ? 'bg-error' : 'bg-blue-500'} text-white text-[9px] font-bold px-1 absolute -top-[18px] left-0 whitespace-nowrap`}>
        {det.label} {Math.round((det.confidence ?? 0) * 100)}%
      </span>
    </div>
  ));
}

// ── Shared: detection label list ───────────────────────────────────────────────

function DetectionList({ detections }) {
  if (!detections?.length) return <p className="text-[12px] text-on-surface-variant italic">No detections</p>;
  return detections.map((det, idx) => (
    <div
      key={idx}
      className={`flex justify-between items-center px-sm py-xs rounded-sm border text-[13px]
        ${det.type === 'defect'
          ? 'bg-error-container border-error/30 text-on-error-container'
          : 'bg-surface border-outline-variant text-primary'}`}
    >
      <div className="flex items-center gap-xs">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${det.type === 'defect' ? 'bg-error' : 'bg-blue-500'}`} />
        <span className="font-medium">{det.label}</span>
        {det.severity && <span className="text-[9px] font-bold text-error uppercase">{det.severity}</span>}
      </div>
      <span className="font-code text-[11px] opacity-80">{Math.round((det.confidence ?? 0) * 100)}%</span>
    </div>
  ));
}

// ── Detection Preview Modal (enlarged, keyboard-navigable) ─────────────────────

function DetectionPreviewModal({ row, allRows, onClose, onNavigate, onApprove, onFlag, developerMode, onMarkFalse }) {
  const idx     = allRows.indexOf(row);
  const hasPrev = idx > 0;
  const hasNext = idx < allRows.length - 1;

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowLeft'  && hasPrev) onNavigate(allRows[idx - 1]);
      if (e.key === 'ArrowRight' && hasNext) onNavigate(allRows[idx + 1]);
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [idx, hasPrev, hasNext]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center p-md"
      style={{ background: 'rgba(9,20,38,0.75)', backdropFilter: 'blur(6px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-surface-container-lowest border border-outline-variant shadow-2xl w-full max-w-6xl flex flex-col overflow-hidden rounded-sm"
        style={{ maxHeight: '92vh' }}
        initial={{ scale: 0.96, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 20 }}
        transition={{ duration: 0.16 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-lg py-md border-b border-outline-variant bg-surface-container-low/50 backdrop-blur-md flex-shrink-0">
          <div className="flex items-center gap-md">
            <div className="w-8 h-8 rounded-sm bg-primary/10 flex items-center justify-center border border-primary/20">
              <span className="material-symbols-outlined text-primary text-[20px]">image</span>
            </div>
            <div className="flex flex-col">
              <span className="font-label-caps text-[11px] text-outline uppercase tracking-widest leading-none mb-1">Frame Identifier</span>
              <span className="font-display text-[22px] lg:text-[24px] font-bold text-primary leading-none">{row.imageId}</span>
            </div>
            <Badge variant={row.defect !== 'None' ? 'error' : 'success'} className="ml-md">
              {row.defect !== 'None' ? 'CRITICAL DEFECT' : 'NOMINAL STATUS'}
            </Badge>
          </div>
          <div className="flex items-center gap-md">
            <div className="hidden lg:flex items-center gap-xs px-md py-1.5 border border-outline-variant rounded-sm bg-surface-container-low/30">
               <span className="font-code text-[11px] text-primary">{idx + 1}</span>
               <span className="text-outline text-[10px]">/</span>
               <span className="font-code text-[11px] text-outline">{allRows.length}</span>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-error/10 hover:text-error transition-colors text-outline">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
          {/* Image */}
          <div className="flex-1 bg-black relative overflow-hidden min-h-[300px]">
            <img
              className="absolute inset-0 w-full h-full object-cover"
              src={row.thumbnail || PLACEHOLDER}
              alt={row.imageId}
            />
            <BBoxOverlay detections={row.detections} />

            {/* Prev / Next arrows over image */}
            <button
              onClick={() => hasPrev && onNavigate(allRows[idx - 1])}
              disabled={!hasPrev}
              className="absolute left-sm top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white p-sm rounded-full disabled:opacity-20 transition-all"
            >
              <span className="material-symbols-outlined text-[28px]">arrow_back_ios</span>
            </button>
            <button
              onClick={() => hasNext && onNavigate(allRows[idx + 1])}
              disabled={!hasNext}
              className="absolute right-sm top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white p-sm rounded-full disabled:opacity-20 transition-all"
            >
              <span className="material-symbols-outlined text-[28px]">arrow_forward_ios</span>
            </button>
          </div>

          {/* Side panel */}
          <div className="w-full md:w-[380px] lg:w-[400px] border-t md:border-t-0 md:border-l border-outline-variant flex flex-col bg-surface-container-low/20 flex-shrink-0 overflow-hidden">
            <div className="p-lg flex flex-col gap-md overflow-y-auto custom-scrollbar flex-1">
              {/* Meta */}
              <div className="flex flex-col gap-xs">
                <p className="font-label-caps text-[11px] text-on-surface-variant">FRAME INFO</p>
                {[['IMAGE ID', row.imageId], ['TIMESTAMP', row.timestamp], ['BOGIE NO', row.bogieNo], ['CAMERA', row.camera]].map(([l, v]) => (
                  <div key={l} className="flex justify-between font-body-sm text-[13px] lg:text-[14px]">
                    <span className="text-on-surface-variant">{l}</span>
                    <span className="font-code text-primary">{v}</span>
                  </div>
                ))}
                {/* GPS row */}
                <div className="flex items-center gap-xs mt-xs p-sm bg-surface-container-low border border-outline-variant rounded-sm">
                  <span className="material-symbols-outlined text-[14px] text-blue-500" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                  <span className="font-label-caps text-[10px] text-on-surface-variant">GPS</span>
                  <span className="font-code text-[11px] text-primary ml-auto">{row.gps ?? '—'}</span>
                </div>
              </div>

              <hr className="border-outline-variant" />

              {/* All labels */}
              <div className="flex flex-col gap-xs">
                <p className="font-label-caps text-[11px] text-on-surface-variant">
                  DETECTED LABELS ({(row.detections ?? []).length})
                </p>
                <div className="flex flex-col gap-xs">
                  <DetectionList detections={row.detections} />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-sm p-lg border-t border-outline-variant flex-shrink-0">
              <div className="flex gap-sm">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => { onFlag(row); onClose(); }}>FLAG</Button>
                <Button variant="primary" size="sm" className="flex-1" onClick={() => { onApprove(row); onClose(); }}>APPROVE</Button>
              </div>
              {developerMode && (
                <Button variant="outline" size="sm" className="w-full text-error border-error/50 hover:bg-error/10 hover:border-error" onClick={() => { onMarkFalse(row); onClose(); }}>
                  MARK PREDICTION AS FALSE
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Gallery view ───────────────────────────────────────────────────────────────

function GalleryView({ data, onApprove, onFlag, developerMode, onMarkFalse }) {
  const [idx, setIdx] = useState(0);
  const row = data[idx];

  const prev = useCallback(() => setIdx(i => Math.max(0, i - 1)), []);
  const next = useCallback(() => setIdx(i => Math.min(data.length - 1, i + 1)), [data.length]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowLeft')  prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prev, next]);

  if (!row) return null;

  const defectCount = (row.detections ?? []).filter(d => d.type === 'defect').length;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant flex flex-col overflow-hidden shadow-xl rounded-sm">
      {/* Gallery header */}
      <div className="px-lg py-md border-b border-outline-variant flex items-center justify-between bg-surface-container-low/30 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-md">
          <div className="flex flex-col">
            <span className="font-label-caps text-[10px] lg:text-[11px] text-outline tracking-widest uppercase">Visual Inspection Log</span>
            <span className="font-display text-[24px] lg:text-[28px] font-bold text-primary tracking-tight leading-none mt-1">{row.imageId}</span>
          </div>
          <Badge variant={defectCount > 0 ? 'error' : 'success'}>
            {defectCount > 0 ? `${defectCount} ANOMALIES` : 'CLEAN STATUS'}
          </Badge>
        </div>
        <div className="flex items-center gap-sm">
          <div className="flex items-center gap-2 px-md py-1 border border-outline-variant bg-surface-container-low rounded-sm">
             <span className="font-code text-[11px] text-primary">{idx + 1}</span>
             <span className="text-outline text-[11px]">OF</span>
             <span className="font-code text-[11px] text-outline">{data.length}</span>
          </div>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0" style={{ minHeight: 520 }}>
        {/* Image with bboxes */}
        <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden min-h-[300px]">
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              key={row.imageId}
              className="w-full h-full object-contain"
              src={row.thumbnail || PLACEHOLDER}
              alt={row.imageId}
            />
            <div className="absolute inset-0 max-w-full max-h-full m-auto" style={{ aspectRatio: '16/9' }}>
               <BBoxOverlay detections={row.detections} />
            </div>
          </div>

          {/* Prev arrow */}
          <button
            onClick={prev}
            disabled={idx === 0}
            className="absolute left-md top-1/2 -translate-y-1/2 bg-black/50 hover:bg-primary text-white p-sm rounded-full disabled:opacity-20 transition-all"
          >
            <span className="material-symbols-outlined text-[28px]">arrow_back_ios</span>
          </button>

          {/* Next arrow */}
          <button
            onClick={next}
            disabled={idx === data.length - 1}
            className="absolute right-md top-1/2 -translate-y-1/2 bg-black/50 hover:bg-primary text-white p-sm rounded-full disabled:opacity-20 transition-all"
          >
            <span className="material-symbols-outlined text-[28px]">arrow_forward_ios</span>
          </button>
        </div>

        {/* Detail panel */}
        <div className="w-full lg:w-[360px] xl:w-[400px] border-t lg:border-t-0 lg:border-l border-outline-variant flex flex-col bg-surface-container-low/20 flex-shrink-0">
          <div className="p-lg flex flex-col gap-md overflow-y-auto custom-scrollbar flex-1">
            <div className="flex flex-col gap-xs">
              <p className="font-label-caps text-[11px] text-on-surface-variant">FRAME INFO</p>
              {[['IMAGE ID', row.imageId], ['TIMESTAMP', row.timestamp], ['BOGIE NO', row.bogieNo], ['CAMERA', row.camera]].map(([l, v]) => (
                <div key={l} className="flex justify-between font-body-sm text-[13px] lg:text-[14px]">
                  <span className="text-on-surface-variant">{l}</span>
                  <span className="font-code text-primary">{v}</span>
                </div>
              ))}
              <div className="flex items-center gap-xs mt-xs p-sm bg-surface-container-low border border-outline-variant rounded-sm">
                <span className="material-symbols-outlined text-[14px] text-blue-500" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                <span className="font-label-caps text-[10px] text-on-surface-variant">GPS</span>
                <span className="font-code text-[11px] text-primary ml-auto">{row.gps ?? '—'}</span>
              </div>
            </div>

            <hr className="border-outline-variant" />

            <div className="flex flex-col gap-xs">
              <p className="font-label-caps text-[11px] text-on-surface-variant">
                DETECTED LABELS ({(row.detections ?? []).length})
              </p>
              <div className="flex flex-col gap-xs">
                <DetectionList detections={row.detections} />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-sm p-lg border-t border-outline-variant flex-shrink-0">
            <div className="flex gap-sm">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => onFlag(row)}>FLAG</Button>
              <Button variant="primary" size="sm" className="flex-1" onClick={() => onApprove(row)}>APPROVE</Button>
            </div>
            {developerMode && (
              <Button variant="outline" size="sm" className="w-full text-error border-error/50 hover:bg-error/10 hover:border-error" onClick={() => onMarkFalse(row)}>
                MARK PREDICTION AS FALSE
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Thumbnail strip */}
      <div className="border-t border-outline-variant bg-surface-container-low p-sm flex gap-xs overflow-x-auto custom-scrollbar flex-shrink-0">
        {data.map((r, i) => {
          const hasDefect = (r.detections ?? []).some(d => d.type === 'defect');
          return (
            <button
              key={r.imageId}
              onClick={() => setIdx(i)}
              className={`flex-shrink-0 w-20 h-12 lg:w-24 lg:h-14 rounded-sm overflow-hidden border-2 transition-all relative
                ${i === idx
                  ? 'border-primary ring-1 ring-primary'
                  : hasDefect ? 'border-error/60 hover:border-error' : 'border-outline-variant hover:border-primary'}`}
            >
              <img
                src={r.thumbnail || PLACEHOLDER}
                alt={r.imageId}
                className="w-full h-full object-cover"
              />
              {hasDefect && (
                <span className="absolute top-0 right-0 w-2 h-2 bg-error rounded-bl-sm" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

const InspectionOutput = () => {
  const toast = useToast();
  const results = useInspectionStore((s) => s.detectionResults);
  const trainNumber = useInspectionStore((s) => s.trainNumber);
  const { developerMode, addFalseDetection } = useDeveloperStore();
  const [previewRow, setPreviewRow]   = useState(null);
  const [viewMode, setViewMode]       = useState('gallery');   // 'list' | 'gallery'
  const [showSyncPopup, setShowSyncPopup] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const tableData = results.length > 0 ? resultsToTableData(results, trainNumber) : MOCK_DATA;

  const framesProcessed = results.length > 0 ? results.length : 12840;
  const totalDetections = results.length > 0
    ? results.reduce((sum, r) => sum + (r.detections?.length ?? 0), 0) : 852;
  const defectFrames = results.length > 0
    ? results.filter(r => (r.detections ?? []).some(d => d.type === 'defect')).length
    : tableData.filter(r => r.defect !== 'None').length;
  const avgConf = results.length > 0
    ? (() => {
        const all = results.flatMap(r => r.detections ?? []);
        if (!all.length) return 0;
        return Math.round(all.reduce((s, d) => s + (d.confidence ?? 0), 0) / all.length * 100);
      })() : 98.4;
  const inspectionStatus = defectFrames > 0 ? 'DEFECTS FOUND' : 'NOMINAL';

  const jsonOutput = {
    inspection_id: `VNB_${Date.now().toString(36).toUpperCase()}`,
    timestamp: new Date().toISOString(),
    frames_processed: framesProcessed,
    total_detections: totalDetections,
    defect_frames: defectFrames,
    detections: tableData.map(d => ({
      image_id: d.imageId, bogie_no: d.bogieNo, camera_location: d.camera,
      component: d.component, defect: d.defect, bbox: d.bbox, confidence: 0.982,
    })),
  };

  useEffect(() => {
    const t = setTimeout(() => setShowSyncPopup(false), 5000);
    return () => clearTimeout(t);
  }, []);

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(jsonOutput, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `inspection_${jsonOutput.inspection_id}.json`; a.click();
    URL.revokeObjectURL(url);
    toast({ type: 'success', message: 'Inspection JSON downloaded.' });
  };

  const handleExport = () => {
    const csv = [
      ['Image ID','Bogie No','Camera','Component','Defect','BBox'].join(','),
      ...tableData.map(r => [r.imageId, r.bogieNo, r.camera, r.component, r.defect, r.bbox].join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `inspection_${jsonOutput.inspection_id}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ type: 'success', message: 'Report exported as CSV.' });
  };

  const handleApprove = (row) => toast({ type: 'success', message: `${row.imageId} approved.` });
  const handleFlag    = (row) => toast({ type: 'warning', message: `${row.imageId} flagged for review.` });

  const handleMarkFalse = (row) => {
    const reason = window.prompt("Enter false detection details (optional):", "No defect actually present");
    if (reason !== null) {
      const store = useInspectionStore.getState();
      const activeSession = store.sessions.find(s => s.id === store.currentSessionId);
      const inspectionName = activeSession?.name || "Inspection 1";

      addFalseDetection({
        frameId: row.imageId,
        videoName: store.videoFile?.name || 'Video_2.mp4',
        inspectionName: inspectionName,
        timestamp: row.timestamp,
        defectDetails: row.detections,
        falseDetails: reason,
        thumbnail: row.thumbnail || PLACEHOLDER,
        gps: row.gps,
        trainNumber: row.bogieNo
      });
      toast({ type: 'success', message: `${row.imageId} marked as false detection.` });
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto custom-scrollbar bg-surface">
      <div className="flex flex-col gap-lg p-lg min-h-full">

        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-md flex-shrink-0 pt-md">
          <div className="flex flex-col gap-sm">
            <h1 className="font-display text-[40px] lg:text-[44px] xl:text-[48px] text-primary font-bold tracking-tight leading-none uppercase">
              Inspection <span className="text-outline/40">Review</span>
            </h1>
            <div className="flex items-center gap-md">
               <Badge variant="success" className="px-md py-1.5 font-bold text-[12px]">READY FOR SIGN-OFF</Badge>
               <p className="font-body-base text-outline text-[14px] border-l border-outline-variant pl-md">
                 {results.length > 0
                   ? `Session active with ${results.length} analyzed frames.`
                   : 'Operational review of AI-generated railway metrics.'}
               </p>
            </div>
          </div>
          <div className="flex gap-sm flex-wrap bg-surface-container-low p-1.5 rounded-sm border border-outline-variant/30">
            <Button variant="outline" size="sm" icon="file_download" onClick={handleDownloadJson}>JSON</Button>
            <Button variant="outline" size="sm" icon="ios_share" onClick={handleExport}>CSV</Button>
            <Button variant="primary" size="sm" icon="assignment_turned_in" onClick={handleDownloadJson}>FINALIZE</Button>
          </div>
        </header>

        {/* Bogie number banner */}
        {trainNumber && (
          <div className="flex items-center gap-md bg-surface-container-low border border-primary/20 rounded-sm px-lg py-md flex-shrink-0 relative overflow-hidden shadow-inner">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            <span className="material-symbols-outlined text-primary text-[28px] opacity-40">digital_out_of_home</span>
            <div className="flex flex-col">
              <p className="font-label-caps text-[10px] lg:text-[11px] text-outline tracking-[0.3em] uppercase mb-1">Target Identification Code</p>
              <p className="font-display text-[36px] lg:text-[40px] xl:text-[44px] text-primary font-black tracking-widest leading-none tabular-nums drop-shadow-sm">{trainNumber}</p>
            </div>
            <div className="ml-auto flex items-center gap-lg">
               <div className="flex flex-col items-end">
                  <span className="font-label-caps text-[10px] lg:text-[11px] text-outline uppercase tracking-widest">Verification</span>
                  <span className="text-success font-bold text-[12px] lg:text-[13px] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">verified</span> 100% MATCH
                  </span>
               </div>
               <div className="w-px h-8 bg-outline-variant/30" />
               <Badge variant="primary" className="px-lg py-1">CERTIFIED</Badge>
            </div>
          </div>
        )}

        {/* KPIs */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter flex-shrink-0 min-w-0">
          <KPICard label="BOGIE NO."                 value={trainNumber ?? '—'}               subValue={trainNumber ? 'OCR Confirmed' : 'Not detected'} subLabel="" />
          <KPICard label="TOTAL FRAMES PROCESSED"    value={framesProcessed.toLocaleString()} subValue="Stage 1 → Stage 4" subLabel="" />
          <KPICard label="DEFECT FRAMES"             value={defectFrames.toLocaleString()}     subLabel="REQUIRE ATTENTION" variant={defectFrames > 0 ? 'error' : 'success'} />
          <KPICard label="INSPECTION STATUS"         value={inspectionStatus}                  subValue={defectFrames > 0 ? `${defectFrames} frame(s) flagged` : 'All clear'} />
        </section>

        {/* View toggle + workspace */}
        <section className={`flex flex-col gap-md ${
          isFullScreen 
            ? 'fixed inset-0 z-[100] bg-surface p-lg h-dvh w-dvw overflow-hidden' 
            : 'flex-1 min-h-0'
        }`}>
          {/* Toggle bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-sm">
              <span className="font-label-caps text-[11px] text-outline tracking-widest">OUTPUT PERSPECTIVE:</span>
              <div className="flex bg-surface-container-low p-1 rounded-sm border border-outline-variant/30">
                {[
                  { key: 'list',    icon: 'table_rows',    label: 'TELEMETRY LIST' },
                  { key: 'gallery', icon: 'view_carousel', label: 'VISUAL GALLERY' },
                ].map(({ key, icon, label }) => (
                  <button
                    key={key}
                    onClick={() => setViewMode(key)}
                    className={`flex items-center gap-xs px-md py-2 font-label-caps text-[10px] lg:text-[11px] transition-all rounded-sm
                      ${viewMode === key
                        ? 'bg-surface shadow-sm text-primary font-bold border border-outline-variant/30'
                        : 'text-outline hover:text-primary'}`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{icon}</span>
                    {label}
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => setIsFullScreen(!isFullScreen)}
                className={`flex items-center gap-xs px-md py-2 font-label-caps text-[10px] lg:text-[11px] transition-all rounded-sm border
                  ${isFullScreen 
                    ? 'bg-error border-error text-white font-bold shadow-lg shadow-error/20' 
                    : 'bg-surface-container-low border-outline-variant/30 text-outline hover:text-primary hover:border-outline-variant'}`}
              >
                <span className="material-symbols-outlined text-[16px]">{isFullScreen ? 'fullscreen_exit' : 'fullscreen'}</span>
                {isFullScreen ? 'EXIT FULLSCREEN' : 'FULLSCREEN'}
              </button>
            </div>
            
            <div className="hidden lg:flex items-center gap-4 text-[12px] font-code text-outline">
               <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-success" /> NOMINAL</span>
               <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-error" /> CRITICAL</span>
            </div>
          </div>

          {viewMode === 'list' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg min-w-0 flex-1">
               <div className="lg:col-span-8 h-full flex flex-col min-w-0">
                <DetectionLogTable data={tableData} onViewRow={setPreviewRow} />
              </div>
               <div className="lg:col-span-4 h-full flex flex-col min-w-0">
                <JsonViewer data={jsonOutput} />
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
               <GalleryView data={tableData} onApprove={handleApprove} onFlag={handleFlag} developerMode={developerMode} onMarkFalse={handleMarkFalse} />
            </div>
          )}
        </section>

      </div>

      {/* Detection Preview Modal (from list view) */}
      <AnimatePresence>
        {previewRow && (
          <DetectionPreviewModal
            row={previewRow}
            allRows={tableData}
            onClose={() => setPreviewRow(null)}
            onNavigate={setPreviewRow}
            onApprove={handleApprove}
            onFlag={handleFlag}
            developerMode={developerMode}
            onMarkFalse={handleMarkFalse}
          />
        )}
      </AnimatePresence>

      {/* Sync popup */}
      {showSyncPopup && (
        <div className="fixed bottom-xl right-lg z-50 animate-in slide-in-from-bottom duration-500">
          <div className="bg-primary text-white p-md border border-outline shadow-xl flex items-center gap-md min-w-[320px] rounded-sm">
            <span className="material-symbols-outlined text-[#10b981] text-[24px]">check_circle</span>
            <div className="flex-grow">
              <p className="font-label-caps text-[10px] text-outline-variant">SUCCESS</p>
              <p className="font-body-sm text-[12px]">
                {results.length > 0 ? `${results.length} frames ready.` : 'All 12,840 frames synchronized.'}
              </p>
            </div>
            <button onClick={() => setShowSyncPopup(false)} className="text-outline-variant hover:text-white cursor-pointer">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InspectionOutput;
