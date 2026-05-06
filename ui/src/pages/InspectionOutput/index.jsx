import React, { useState, useEffect } from 'react';
import KPICard from './KPICard';
import DetectionLogTable from './DetectionLogTable';
import JsonViewer from './JsonViewer';
import Button from '../../components/common/Button';
import { useToast } from '../../context/ToastContext';
import { AnimatePresence, motion } from 'framer-motion';

function resultsToTableData(results) {
  if (!results || results.length === 0) return [];
  return results.map((r, i) => {
    const firstDefect = r.detections?.find(d => d.type === 'defect');
    const firstDet = r.detections?.[0];
    return {
      imageId: r.id ?? `IMG_${String(i + 1).padStart(5, '0')}`,
      bogieNo: `B${Math.ceil((i + 1) / 4)}-A`,
      camera: i % 2 === 0 ? 'LC_CAM_01' : 'RC_CAM_02',
      component: firstDet?.label ?? 'Unknown',
      defect: firstDefect?.label ?? 'None',
      bbox: firstDet?.bbox
        ? `[${Object.values(firstDet.bbox).join(', ')}]`
        : '—',
      thumbnail: r.thumbnail ?? null,
    };
  });
}

const MOCK_DATA = [
  { imageId: 'IMG_00124', bogieNo: 'B2-A', camera: 'LC_CAM_01', component: 'Brake Pad', defect: 'Surface Crack', bbox: '[124, 452, 45, 12]' },
  { imageId: 'IMG_00125', bogieNo: 'B2-A', camera: 'LC_CAM_01', component: 'Secondary Spring', defect: 'None', bbox: '[890, 112, 120, 120]' },
  { imageId: 'IMG_00128', bogieNo: 'B2-B', camera: 'RC_CAM_02', component: 'Axle Box', defect: 'Oil Seepage', bbox: '[445, 320, 80, 80]' },
  { imageId: 'IMG_00130', bogieNo: 'B3-A', camera: 'LC_CAM_01', component: 'Wheel Flange', defect: 'None', bbox: '[210, 560, 200, 150]' },
];

const PLACEHOLDER = 'https://lh3.googleusercontent.com/aida-public/AB6AXuCHIreT1_XIkocw5wqa9uPm5RWvhpr5WkPazqwrHltPc-IDgSbLxG9E84qHKLEfTfkjcX9tIVVI049dsLmNLmnSnghVkVPszS4wRFtdOwlx8j1pBh9MZ9OSMakGJioqxb8znozkRPQSZKn7cVsObJjRU7f9baGasbTqMjty53VDOMrt7Yjfgr5yAop3H8qoxgERSwGDgf5Y2PvUqrOGLiyDPtlWXg8aqfSqvTifVPmdTNF_ZdI3BGNBG-m66yLXWiASVouUwHWboA';

function DetectionPreviewModal({ row, onClose, onApprove, onFlag }) {
  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center p-lg"
      style={{ background: 'rgba(9,20,38,0.7)', backdropFilter: 'blur(4px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-surface-container-lowest border border-outline-variant shadow-2xl w-full max-w-3xl flex flex-col md:flex-row overflow-hidden rounded-sm"
        style={{ maxHeight: '90vh' }}
        initial={{ scale: 0.95, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 16 }}
        transition={{ duration: 0.18 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Image side */}
        <div className="flex-1 bg-surface-container-highest relative group overflow-hidden min-h-[240px]">
          <img
            className="w-full h-full object-cover"
            src={row.thumbnail || PLACEHOLDER}
            alt={row.imageId}
          />
          <div className="absolute top-[40%] left-[40%] w-[100px] h-[50px] border-2 border-primary bg-primary/10 flex items-start">
            <span className="bg-primary text-white text-[10px] font-bold px-1 -mt-[20px] whitespace-nowrap">
              {row.component.toUpperCase()}: 0.98
            </span>
          </div>
        </div>

        {/* Detail side */}
        <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-outline-variant p-lg flex flex-col gap-md bg-surface-container-low/20">
          <div className="flex justify-between items-start">
            <h3 className="font-h2 text-primary">DETECTION DETAIL</h3>
            <button onClick={onClose} className="material-symbols-outlined text-on-surface-variant hover:text-primary text-[20px]">close</button>
          </div>

          <div className="flex flex-col gap-sm flex-1">
            {[
              ['IMAGE ID', row.imageId],
              ['BOGIE NO', row.bogieNo],
              ['CAMERA', row.camera],
              ['COMPONENT', row.component],
              ['BBOX', row.bbox],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between font-body-sm text-[12px]">
                <span className="text-on-surface-variant">{label}</span>
                <span className="font-code text-primary">{val}</span>
              </div>
            ))}

            <hr className="border-outline-variant my-xs" />

            <div>
              <p className="font-label-caps text-[10px] text-on-surface-variant mb-xs">DEFECT STATUS</p>
              {row.defect !== 'None' ? (
                <span className="inline-flex items-center gap-xs text-error font-medium text-[13px]">
                  <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
                  {row.defect}
                </span>
              ) : (
                <span className="inline-flex items-center gap-xs text-[#166534] font-medium text-[13px]">
                  <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  Nominal — no defect
                </span>
              )}
            </div>

            <div>
              <p className="font-label-caps text-[10px] text-on-surface-variant mb-xs">NOTES</p>
              <p className="font-body-sm text-on-surface text-[12px] leading-relaxed">
                {row.defect !== 'None'
                  ? `Critical defect identified: ${row.defect}. Component requires immediate inspection.`
                  : 'Component appears within nominal tolerance. No immediate action required.'}
              </p>
            </div>
          </div>

          <div className="flex gap-sm mt-auto pt-md border-t border-outline-variant">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => { onFlag(row); onClose(); }}>FLAG INCORRECT</Button>
            <Button variant="primary" size="sm" className="flex-1" onClick={() => { onApprove(row); onClose(); }}>APPROVE</Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

const InspectionOutput = ({ results = [] }) => {
  const toast = useToast();
  const [previewRow, setPreviewRow] = useState(null);
  const [showSyncPopup, setShowSyncPopup] = useState(true);

  const tableData = results.length > 0 ? resultsToTableData(results) : MOCK_DATA;

  // Metrics derived from actual results, not from the table row count
  const framesProcessed  = results.length > 0 ? results.length : 12840;
  const totalDetections  = results.length > 0
    ? results.reduce((sum, r) => sum + (r.detections?.length ?? 0), 0)
    : 852;
  const defectFrames     = results.length > 0
    ? results.filter(r => r.defects > 0).length
    : tableData.filter(r => r.defect !== 'None').length;
  const avgConf          = results.length > 0
    ? (() => {
        const all = results.flatMap(r => r.detections ?? []);
        if (all.length === 0) return 0;
        return Math.round(all.reduce((s, d) => s + (d.confidence ?? 0), 0) / all.length * 100);
      })()
    : 98.4;
  const inspectionStatus = defectFrames > 0 ? 'DEFECTS FOUND' : 'NOMINAL';

  const jsonOutput = {
    inspection_id: `VNB_${Date.now().toString(36).toUpperCase()}`,
    timestamp: new Date().toISOString(),
    frames_processed: framesProcessed,
    total_detections: totalDetections,
    defect_frames: defectFrames,
    detections: tableData.map(d => ({
      image_id: d.imageId,
      bogie_no: d.bogieNo,
      camera_location: d.camera,
      component: d.component,
      defect: d.defect,
      bbox: d.bbox,
      confidence: 0.982,
    })),
  };

  // Auto-dismiss sync popup after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowSyncPopup(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(jsonOutput, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inspection_${jsonOutput.inspection_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ type: 'success', message: 'Inspection JSON downloaded successfully.' });
  };

  const handleExport = () => {
    const csv = [
      ['Image ID', 'Bogie No', 'Camera', 'Component', 'Defect', 'BBox'].join(','),
      ...tableData.map(r => [r.imageId, r.bogieNo, r.camera, r.component, r.defect, r.bbox].join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inspection_${jsonOutput.inspection_id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ type: 'success', message: 'Report exported as CSV.' });
  };

  const handleGenerateReport = () => {
    handleDownloadJson();
    toast({ type: 'info', message: 'Full report generation: connect to report service for PDF output.' });
  };

  const handleApprove = (row) => {
    toast({ type: 'success', message: `${row.imageId} approved — marked as reviewed.` });
  };

  const handleFlag = (row) => {
    toast({ type: 'warning', message: `${row.imageId} flagged for manual review.` });
  };

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
                ? `Review AI-generated inspection results — ${results.length} frames from live detection session.`
                : 'Review AI-generated railway inspection results and defect metadata.'}
            </p>
          </div>
          <div className="flex gap-sm">
            <Button variant="outline" size="sm" icon="file_download" onClick={handleDownloadJson}>DOWNLOAD JSON</Button>
            <Button variant="outline" size="sm" icon="ios_share" onClick={handleExport}>EXPORT CSV</Button>
            <Button variant="primary" size="sm" icon="assignment" onClick={handleGenerateReport}>GENERATE REPORT</Button>
          </div>
        </header>

        {/* KPIs */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter flex-shrink-0">
          <KPICard label="TOTAL FRAMES PROCESSED"   value={framesProcessed.toLocaleString()}  subValue="Stage 1 → Stage 2" subLabel="" />
          <KPICard label="TOTAL COMPONENTS DETECTED" value={totalDetections.toLocaleString()}  subValue={`${avgConf}%`} subLabel="AVG CONF" />
          <KPICard label="DEFECT FRAMES"             value={defectFrames.toLocaleString()}      subLabel="REQUIRE ATTENTION" variant={defectFrames > 0 ? 'error' : 'success'} />
          <KPICard label="INSPECTION STATUS"         value={inspectionStatus}                   subValue={defectFrames > 0 ? `${defectFrames} frame(s) flagged` : 'All clear'} />
        </section>

        {/* Main Workspace */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-lg flex-shrink-0">
          <div className="lg:col-span-8 flex flex-col gap-lg overflow-hidden">
            <div className="min-h-[400px] flex flex-col">
              <DetectionLogTable data={tableData} onViewRow={setPreviewRow} />
            </div>
          </div>
          <div className="lg:col-span-4 flex flex-col min-h-[800px]">
            <JsonViewer data={jsonOutput} />
          </div>
        </section>
      </div>

      {/* Detection Preview Modal */}
      <AnimatePresence>
        {previewRow && (
          <DetectionPreviewModal
            row={previewRow}
            onClose={() => setPreviewRow(null)}
            onApprove={handleApprove}
            onFlag={handleFlag}
          />
        )}
      </AnimatePresence>

      {/* Sync status toast */}
      {showSyncPopup && (
        <div className="fixed bottom-xl right-lg flex flex-col gap-sm z-50 animate-in slide-in-from-bottom duration-500">
          <div className="bg-primary text-white p-md border border-outline shadow-xl flex items-center gap-md min-w-[320px] rounded-sm">
            <span className="material-symbols-outlined text-[#10b981] text-[24px]">check_circle</span>
            <div className="flex-grow">
              <p className="font-label-caps text-[10px] text-outline-variant">SUCCESS</p>
              <p className="font-body-sm text-[12px]">
                {results.length > 0
                  ? `${results.length} frames from detection session ready.`
                  : 'All 12,840 frames successfully synchronized.'}
              </p>
            </div>
            <button onClick={() => setShowSyncPopup(false)} className="text-outline-variant hover:text-white transition-colors cursor-pointer">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InspectionOutput;
