import React, { useState, useEffect, useCallback } from 'react';
import KPICard from './KPICard';
import DetectionLogTable from './DetectionLogTable';
import JsonViewer from './JsonViewer';
import Button from '../../components/common/Button';
import { useToast } from '../../context/ToastContext';
import { AnimatePresence, motion } from 'framer-motion';

// ── Data helpers ───────────────────────────────────────────────────────────────

function resultsToTableData(results) {
  if (!results || results.length === 0) return [];
  return results.map((r, i) => {
    const detections = r.detections ?? [];
    const defects    = detections.filter(d => d.type === 'defect');
    const firstDet   = detections[0];
    return {
      imageId:    r.id ?? `IMG_${String(i + 1).padStart(5, '0')}`,
      bogieNo:    `B${Math.ceil((i + 1) / 4)}-A`,
      camera:     i % 2 === 0 ? 'LC_CAM_01' : 'RC_CAM_02',
      component:  detections.length > 0 ? detections.map(d => d.label).join(', ') : 'None detected',
      defect:     defects.length > 0 ? defects.map(d => d.label).join(', ') : 'None',
      bbox:       firstDet?.bbox ? `[${Object.values(firstDet.bbox).join(', ')}]` : '—',
      thumbnail:  r.thumbnail ?? null,
      detections,
    };
  });
}

const MOCK_DATA = [
  { imageId: 'IMG_00124', bogieNo: 'B2-A', camera: 'LC_CAM_01', component: 'Brake Pad',        defect: 'Surface Crack', bbox: '[124, 452, 45, 12]', thumbnail: null, detections: [] },
  { imageId: 'IMG_00125', bogieNo: 'B2-A', camera: 'LC_CAM_01', component: 'Secondary Spring', defect: 'None',          bbox: '[890, 112, 120, 120]', thumbnail: null, detections: [] },
  { imageId: 'IMG_00128', bogieNo: 'B2-B', camera: 'RC_CAM_02', component: 'Axle Box',         defect: 'Oil Seepage',   bbox: '[445, 320, 80, 80]',  thumbnail: null, detections: [] },
  { imageId: 'IMG_00130', bogieNo: 'B3-A', camera: 'LC_CAM_01', component: 'Wheel Flange',     defect: 'None',          bbox: '[210, 560, 200, 150]', thumbnail: null, detections: [] },
];

const PLACEHOLDER = 'https://lh3.googleusercontent.com/aida-public/AB6AXuCHIreT1_XIkocw5wqa9uPm5RWvhpr5WkPazqwrHltPc-IDgSbLxG9E84qHKLEfTfkjcX9tIVVI049dsLmNLmnSnghVkVPszS4wRFtdOwlx8j1pBh9MZ9OSMakGJioqxb8znozkRPQSZKn7cVsObJjRU7f9baGasbTqMjty53VDOMrt7Yjfgr5yAop3H8qoxgERSwGDgf5Y2PvUqrOGLiyDPtlWXg8aqfSqvTifVPmdTNF_ZdI3BGNBG-m66yLXWiASVouUwHWboA';

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
      className={`flex justify-between items-center px-sm py-xs rounded-sm border text-[12px]
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

function DetectionPreviewModal({ row, allRows, onClose, onNavigate, onApprove, onFlag }) {
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
        <div className="flex items-center justify-between px-lg py-md border-b border-outline-variant bg-surface-container-low flex-shrink-0">
          <div className="flex items-center gap-md">
            <span className="font-h2 text-primary">{row.imageId}</span>
            <span className={`font-label-caps text-[10px] px-sm py-xs rounded-sm ${row.defect !== 'None' ? 'bg-error text-white' : 'bg-primary/10 text-primary'}`}>
              {row.defect !== 'None' ? '⚠ DEFECT' : '✓ NOMINAL'}
            </span>
          </div>
          <div className="flex items-center gap-sm">
            {/* Frame counter */}
            <span className="font-code text-[11px] text-on-surface-variant">{idx + 1} / {allRows.length}</span>
            {/* Keyboard hint */}
            <span className="hidden md:flex items-center gap-xs font-label-caps text-[9px] text-on-surface-variant border border-outline-variant px-sm py-xs rounded-sm">
              <span>←</span><span>→</span> navigate · <span>ESC</span> close
            </span>
            <button onClick={onClose} className="material-symbols-outlined text-on-surface-variant hover:text-primary text-[20px] p-xs">close</button>
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
          <div className="w-full md:w-[340px] border-t md:border-t-0 md:border-l border-outline-variant flex flex-col bg-surface-container-low/20 flex-shrink-0 overflow-hidden">
            <div className="p-lg flex flex-col gap-md overflow-y-auto custom-scrollbar flex-1">
              {/* Meta */}
              <div className="flex flex-col gap-xs">
                <p className="font-label-caps text-[10px] text-on-surface-variant">FRAME INFO</p>
                {[['IMAGE ID', row.imageId], ['BOGIE NO', row.bogieNo], ['CAMERA', row.camera]].map(([l, v]) => (
                  <div key={l} className="flex justify-between font-body-sm text-[12px]">
                    <span className="text-on-surface-variant">{l}</span>
                    <span className="font-code text-primary">{v}</span>
                  </div>
                ))}
              </div>

              <hr className="border-outline-variant" />

              {/* All labels */}
              <div className="flex flex-col gap-xs">
                <p className="font-label-caps text-[10px] text-on-surface-variant">
                  DETECTED LABELS ({(row.detections ?? []).length})
                </p>
                <div className="flex flex-col gap-xs">
                  <DetectionList detections={row.detections} />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-sm p-lg border-t border-outline-variant flex-shrink-0">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => { onFlag(row); onClose(); }}>FLAG</Button>
              <Button variant="primary" size="sm" className="flex-1" onClick={() => { onApprove(row); onClose(); }}>APPROVE</Button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Gallery view ───────────────────────────────────────────────────────────────

function GalleryView({ data, onApprove, onFlag }) {
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
    <div className="bg-surface-container-lowest border border-outline-variant flex flex-col overflow-hidden shadow-sm">
      {/* Gallery header */}
      <div className="px-lg py-md border-b border-outline-variant flex items-center justify-between bg-surface-container-low/30 flex-shrink-0">
        <div className="flex items-center gap-md">
          <span className="font-h2 text-primary">{row.imageId}</span>
          <span className={`font-label-caps text-[10px] px-sm py-xs rounded-sm ${defectCount > 0 ? 'bg-error text-white' : 'bg-primary/10 text-primary'}`}>
            {defectCount > 0 ? `⚠ ${defectCount} DEFECT${defectCount > 1 ? 'S' : ''}` : '✓ NOMINAL'}
          </span>
        </div>
        <div className="flex items-center gap-sm">
          <span className="font-code text-[12px] text-on-surface-variant">{idx + 1} / {data.length}</span>
          <span className="hidden md:flex items-center gap-xs font-label-caps text-[9px] text-on-surface-variant border border-outline-variant px-sm py-xs rounded-sm">
            ← → to navigate
          </span>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0" style={{ minHeight: 520 }}>
        {/* Image with bboxes */}
        <div className="flex-1 bg-black relative overflow-hidden min-h-[320px]">
          <img
            key={row.imageId}
            className="absolute inset-0 w-full h-full object-cover"
            src={row.thumbnail || PLACEHOLDER}
            alt={row.imageId}
          />
          <BBoxOverlay detections={row.detections} />

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
        <div className="w-full lg:w-[320px] border-t lg:border-t-0 lg:border-l border-outline-variant flex flex-col bg-surface-container-low/20 flex-shrink-0">
          <div className="p-lg flex flex-col gap-md overflow-y-auto custom-scrollbar flex-1">
            <div className="flex flex-col gap-xs">
              <p className="font-label-caps text-[10px] text-on-surface-variant">FRAME INFO</p>
              {[['IMAGE ID', row.imageId], ['BOGIE NO', row.bogieNo], ['CAMERA', row.camera]].map(([l, v]) => (
                <div key={l} className="flex justify-between font-body-sm text-[12px]">
                  <span className="text-on-surface-variant">{l}</span>
                  <span className="font-code text-primary">{v}</span>
                </div>
              ))}
            </div>

            <hr className="border-outline-variant" />

            <div className="flex flex-col gap-xs">
              <p className="font-label-caps text-[10px] text-on-surface-variant">
                DETECTED LABELS ({(row.detections ?? []).length})
              </p>
              <div className="flex flex-col gap-xs">
                <DetectionList detections={row.detections} />
              </div>
            </div>
          </div>

          <div className="flex gap-sm p-lg border-t border-outline-variant flex-shrink-0">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => onFlag(row)}>FLAG</Button>
            <Button variant="primary" size="sm" className="flex-1" onClick={() => onApprove(row)}>APPROVE</Button>
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
              className={`flex-shrink-0 w-16 h-10 rounded-sm overflow-hidden border-2 transition-all relative
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

const InspectionOutput = ({ results = [] }) => {
  const toast = useToast();
  const [previewRow, setPreviewRow]   = useState(null);
  const [viewMode, setViewMode]       = useState('list');   // 'list' | 'gallery'
  const [showSyncPopup, setShowSyncPopup] = useState(true);

  const tableData = results.length > 0 ? resultsToTableData(results) : MOCK_DATA;

  const framesProcessed = results.length > 0 ? results.length : 12840;
  const totalDetections = results.length > 0
    ? results.reduce((sum, r) => sum + (r.detections?.length ?? 0), 0) : 852;
  const defectFrames = results.length > 0
    ? results.filter(r => r.defects > 0).length
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

  return (
    <div className="flex-1 h-full overflow-y-auto custom-scrollbar bg-surface">
      <div className="flex flex-col gap-lg p-lg min-h-full">

        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-md flex-shrink-0">
          <div>
            <nav className="flex items-center gap-xs text-on-surface-variant font-label-caps text-[10px] mb-xs uppercase">
              <span>Pipeline Overview</span>
              <span className="material-symbols-outlined text-[12px]">chevron_right</span>
              <span>Video Framing</span>
              <span className="material-symbols-outlined text-[12px]">chevron_right</span>
              <span>Detection</span>
              <span className="material-symbols-outlined text-[12px]">chevron_right</span>
              <span className="text-primary">Output Review</span>
            </nav>
            <div className="flex items-center gap-md">
              <h1 className="font-display text-display text-primary">Structured Inspection Output</h1>
              <span className="bg-primary text-white font-label-caps text-[10px] px-md py-1 rounded-sm flex items-center gap-xs">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                INSPECTION COMPLETE
              </span>
            </div>
            <p className="font-body-base text-on-surface-variant mt-xs">
              {results.length > 0
                ? `${results.length} frames from live detection session.`
                : 'Review AI-generated railway inspection results.'}
            </p>
          </div>
          <div className="flex gap-sm flex-wrap">
            <Button variant="outline" size="sm" icon="file_download" onClick={handleDownloadJson}>DOWNLOAD JSON</Button>
            <Button variant="outline" size="sm" icon="ios_share" onClick={handleExport}>EXPORT CSV</Button>
            <Button variant="primary" size="sm" icon="assignment" onClick={handleDownloadJson}>GENERATE REPORT</Button>
          </div>
        </header>

        {/* KPIs */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter flex-shrink-0">
          <KPICard label="TOTAL FRAMES PROCESSED"    value={framesProcessed.toLocaleString()} subValue="Stage 1 → Stage 2" subLabel="" />
          <KPICard label="TOTAL COMPONENTS DETECTED" value={totalDetections.toLocaleString()} subValue={`${avgConf}%`} subLabel="AVG CONF" />
          <KPICard label="DEFECT FRAMES"             value={defectFrames.toLocaleString()}     subLabel="REQUIRE ATTENTION" variant={defectFrames > 0 ? 'error' : 'success'} />
          <KPICard label="INSPECTION STATUS"         value={inspectionStatus}                  subValue={defectFrames > 0 ? `${defectFrames} frame(s) flagged` : 'All clear'} />
        </section>

        {/* View toggle + workspace */}
        <section className="flex flex-col gap-md flex-shrink-0">
          {/* Toggle bar */}
          <div className="flex items-center gap-sm">
            <span className="font-label-caps text-[10px] text-on-surface-variant">VIEW MODE:</span>
            {[
              { key: 'list',    icon: 'table_rows',    label: 'LIST' },
              { key: 'gallery', icon: 'view_carousel', label: 'GALLERY' },
            ].map(({ key, icon, label }) => (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                className={`flex items-center gap-xs px-sm py-xs font-label-caps text-[10px] border rounded-sm transition-all
                  ${viewMode === key
                    ? 'bg-primary text-white border-primary'
                    : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-low'}`}
              >
                <span className="material-symbols-outlined text-[14px]">{icon}</span>
                {label}
              </button>
            ))}
          </div>

          {viewMode === 'list' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
              <div className="lg:col-span-8 min-h-[400px] flex flex-col">
                <DetectionLogTable data={tableData} onViewRow={setPreviewRow} />
              </div>
              <div className="lg:col-span-4 min-h-[400px] flex flex-col">
                <JsonViewer data={jsonOutput} />
              </div>
            </div>
          ) : (
            <GalleryView data={tableData} onApprove={handleApprove} onFlag={handleFlag} />
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
