import React, { useState, useEffect, useCallback } from 'react';
import useDeveloperStore from '../../store/useDeveloperStore';
import useInspectionStore, { exportBackup, restoreBackup } from '../../store/useInspectionStore';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/ui/Badge';
import { useToast } from '../../store/useToastStore';
import { AnimatePresence, motion } from 'framer-motion';

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

const DeveloperMode = () => {
  const { developerMode, toggleDeveloperMode, falseDetections, removeFalseDetection, clearFalseDetections } = useDeveloperStore();
  const toast = useToast();
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [idx, setIdx] = useState(0);

  const selectedDetection = falseDetections[idx];

  const prev = useCallback(() => setIdx(i => Math.max(0, i - 1)), []);
  const next = useCallback(() => setIdx(i => Math.min(falseDetections.length - 1, i + 1)), [falseDetections.length]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (falseDetections.length === 0) return;
      if (e.key === 'ArrowLeft')  prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prev, next, falseDetections.length]);

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear all logged false detections?')) {
      clearFalseDetections();
      setIdx(0);
      toast({ type: 'info', message: 'Cleared all false detections.' });
    }
  };

  const handleClearInspectionCache = () => {
    if (window.confirm('WARNING: This will clear all locally saved extracted frames, OCR results, and detections. Proceed?')) {
      useInspectionStore.persist.clearStorage();
      window.location.reload();
    }
  };

  const handleExportBackup = async () => {
    try {
      const backup = await exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vande_bharat_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ type: 'success', message: 'System backup file downloaded successfully.' });
    } catch (err) {
      toast({ type: 'error', message: `Export failed: ${err.message}` });
    }
  };

  const handleRestoreBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backup = JSON.parse(event.target.result);
        
        // Validate backup schema quickly
        if (!backup['inspection-store'] && !backup['vande-bharat-developer-storage']) {
          throw new Error('Invalid backup file. Could not find Vande Bharat store keys.');
        }

        const confirmRestore = window.confirm(
          'Are you sure you want to restore this backup? This will overwrite your current data and reload the page.'
        );
        if (!confirmRestore) return;

        await restoreBackup(backup);
        toast({ type: 'success', message: 'Restore complete. Reloading...' });
        
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } catch (err) {
        toast({ type: 'error', message: `Restore failed: ${err.message}` });
      }
    };
    reader.readAsText(file);
  };

  const handleExport = () => {
    if (falseDetections.length === 0) return;
    const blob = new Blob([JSON.stringify(falseDetections, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `false_detections_${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ type: 'success', message: 'Exported false detections successfully.' });
  };

  const handleDeleteLog = () => {
    if (selectedDetection) {
      removeFalseDetection(selectedDetection.frameId);
      if (idx >= falseDetections.length - 1) setIdx(Math.max(0, falseDetections.length - 2));
      toast({ type: 'info', message: 'False detection log removed.' });
    }
  };

  return (
    <div className={`flex-1 flex flex-col bg-surface ${isFullScreen ? 'fixed inset-0 z-[100] h-dvh w-dvw overflow-hidden' : 'h-full overflow-hidden'}`}>
      
      {!isFullScreen && (
        <header className="px-lg py-md border-b border-outline-variant bg-surface-container-lowest flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="font-display text-[32px] text-primary font-bold">Developer Mode</h1>
            <p className="text-body-sm text-outline">Manage system settings and review flagged false detections.</p>
          </div>
          <div className="flex items-center gap-md">
            <span className="font-label-caps text-[12px] text-outline">STATUS:</span>
            <button 
              onClick={toggleDeveloperMode}
              className={`px-md py-1.5 rounded-full font-bold text-[12px] transition-colors border ${developerMode ? 'bg-error/10 text-error border-error/30' : 'bg-surface-container-high text-outline border-outline-variant'}`}
            >
              {developerMode ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>
        </header>
      )}

      <main className="flex-1 p-lg flex flex-col gap-lg min-h-0 overflow-y-auto custom-scrollbar">
        {!isFullScreen && (
          <div className="flex-shrink-0 flex flex-col md:flex-row justify-between gap-xl">
            <div className="flex-1 max-w-2xl flex flex-col gap-md">
              <div>
                <h2 className="font-h2 text-primary mb-sm">System Storage</h2>
                <Card padding={true} className="bg-error/5 border-error/20">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-md">
                    <div>
                      <h3 className="font-bold text-error">Clear Inspection Cache</h3>
                      <p className="text-body-sm text-on-surface-variant">Purge all persistent local storage (frames, OCR, detections).</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleClearInspectionCache} className="text-error border-error/50 hover:bg-error/10 flex-shrink-0 whitespace-nowrap">
                      PURGE CACHE
                    </Button>
                  </div>
                </Card>
              </div>

              <div>
                <h2 className="font-h2 text-primary mb-sm">Backup & Restore</h2>
                <Card padding={true} className="bg-surface-container-low border border-outline-variant/30">
                  <div className="flex flex-col gap-md">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-md">
                      <div>
                        <h3 className="font-bold text-primary">Export System Backup</h3>
                        <p className="text-body-sm text-on-surface-variant">Download a complete backup of all inspection sessions, frames, detections, and developer logs as a JSON file.</p>
                      </div>
                      <Button variant="primary" size="sm" onClick={handleExportBackup} icon="download" className="flex-shrink-0">
                        DOWNLOAD BACKUP
                      </Button>
                    </div>
                    
                    <hr className="border-outline-variant/30" />
                    
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-md">
                      <div>
                        <h3 className="font-bold text-primary">Restore System Backup</h3>
                        <p className="text-body-sm text-on-surface-variant">Restore all sessions and settings from a previously exported JSON backup file. WARNING: This will overwrite your current data.</p>
                      </div>
                      <label className="flex-shrink-0">
                        <input 
                          type="file" 
                          accept=".json" 
                          onChange={handleRestoreBackup} 
                          className="hidden" 
                        />
                        <span className="inline-flex items-center gap-sm px-md py-1.5 border border-primary text-primary hover:bg-primary/5 rounded-sm cursor-pointer font-bold text-[12px] uppercase transition-colors">
                          <span className="material-symbols-outlined text-[16px]">upload</span>
                          UPLOAD BACKUP
                        </span>
                      </label>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
            <div className="flex-1 flex flex-col items-start md:items-end justify-end pb-sm">
              <div className="flex gap-sm">
                <Button variant="outline" size="sm" onClick={handleClear} disabled={falseDetections.length === 0}>CLEAR ALL</Button>
                <Button variant="primary" size="sm" onClick={handleExport} disabled={falseDetections.length === 0} icon="download">EXPORT JSON</Button>
              </div>
            </div>
          </div>
        )}

        {falseDetections.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 border border-dashed border-outline-variant rounded bg-surface-container-low/30">
            <span className="material-symbols-outlined text-[48px] text-outline/50 mb-sm">inventory_2</span>
            <p className="text-outline">No false detections logged yet.</p>
          </div>
        ) : (
          <div className="bg-surface-container-lowest border border-outline-variant flex flex-col overflow-hidden shadow-xl rounded-sm min-h-[580px] lg:h-[580px] flex-shrink-0">
            
            {/* Gallery Header */}
            <div className="p-lg border-b border-outline-variant flex justify-between items-center bg-surface-container-low/50 backdrop-blur-sm flex-shrink-0">
              <div>
                <span className="font-label-caps text-[10px] lg:text-[11px] text-outline tracking-widest uppercase">
                  {selectedDetection?.inspectionName || "Inspection 1"} — {selectedDetection?.videoName || "Video"}
                </span>
                <span className="font-display text-[24px] lg:text-[28px] font-bold text-primary tracking-tight leading-none mt-1 block">{selectedDetection?.frameId}</span>
              </div>
              <div className="flex items-center gap-md">
                <Button variant="outline" size="sm" icon={isFullScreen ? 'fullscreen_exit' : 'fullscreen'} onClick={() => setIsFullScreen(!isFullScreen)}>
                  {isFullScreen ? 'EXIT FULLSCREEN' : 'FULLSCREEN'}
                </Button>
                <div className="flex items-center gap-2 px-md py-1 border border-outline-variant bg-surface-container-low rounded-sm">
                   <span className="font-code text-[11px] text-primary">{idx + 1}</span>
                   <span className="text-outline text-[11px]">OF</span>
                   <span className="font-code text-[11px] text-outline">{falseDetections.length}</span>
                </div>
              </div>
            </div>

            {/* Gallery Main Area */}
            <div className="flex flex-col lg:flex-row flex-1 min-h-0" style={{ minHeight: 520 }}>
              {/* Image View */}
              <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden min-h-[300px]">
                {selectedDetection && (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img src={selectedDetection.thumbnail} alt="Full frame" className="w-full h-full object-contain" />
                    <div className="absolute inset-0 max-w-full max-h-full m-auto" style={{ aspectRatio: '16/9' }}>
                       <BBoxOverlay detections={selectedDetection.defectDetails} />
                    </div>
                  </div>
                )}
                
                <button
                  onClick={prev}
                  disabled={idx === 0}
                  className="absolute left-md top-1/2 -translate-y-1/2 bg-black/50 hover:bg-primary text-white p-sm rounded-full disabled:opacity-20 transition-all z-10"
                >
                  <span className="material-symbols-outlined text-[28px]">arrow_back_ios</span>
                </button>
      
                <button
                  onClick={next}
                  disabled={idx === falseDetections.length - 1}
                  className="absolute right-md top-1/2 -translate-y-1/2 bg-black/50 hover:bg-primary text-white p-sm rounded-full disabled:opacity-20 transition-all z-10"
                >
                  <span className="material-symbols-outlined text-[28px]">arrow_forward_ios</span>
                </button>
              </div>

              {/* Detail Panel */}
              {selectedDetection && (
                <div className="w-full lg:w-[360px] xl:w-[400px] border-t lg:border-t-0 lg:border-l border-outline-variant flex flex-col bg-surface-container-low/20 flex-shrink-0">
                  <div className="p-lg flex flex-col gap-md overflow-y-auto custom-scrollbar flex-1">
                    <div className="flex flex-col gap-xs">
                      <p className="font-label-caps text-[11px] text-on-surface-variant">FRAME INFO</p>
                      {[
                        ['IMAGE ID', selectedDetection.frameId],
                        ['INSPECTION NAME', selectedDetection.inspectionName || "Inspection 1"],
                        ['VIDEO SOURCE', selectedDetection.videoName],
                        ['TIMESTAMP', selectedDetection.timestamp],
                        ['BOGIE NO', selectedDetection.trainNumber]
                      ].map(([l, v]) => (
                        <div key={l} className="flex justify-between font-body-sm text-[13px] lg:text-[14px]">
                          <span className="text-on-surface-variant">{l}</span>
                          <span className="font-code text-primary truncate max-w-[180px]">{v}</span>
                        </div>
                      ))}
                      <div className="flex items-center gap-xs mt-xs p-sm bg-surface-container-low border border-outline-variant rounded-sm">
                        <span className="material-symbols-outlined text-[14px] text-blue-500" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                        <span className="font-label-caps text-[10px] text-on-surface-variant">GPS</span>
                        <span className="font-code text-[11px] text-primary ml-auto">{selectedDetection.gps ?? '—'}</span>
                      </div>
                    </div>

                    <hr className="border-outline-variant" />

                    <div className="flex flex-col gap-xs">
                      <span className="font-label-caps text-[11px] text-on-surface-variant block mb-1">DEVELOPER NOTES</span>
                      <p className="text-body-sm text-on-surface-variant bg-surface p-sm border border-outline-variant rounded-sm italic">
                        {selectedDetection.falseDetails || 'No notes provided.'}
                      </p>
                    </div>
                    
                    <hr className="border-outline-variant" />

                    <div className="flex flex-col gap-xs">
                      <p className="font-label-caps text-[11px] text-on-surface-variant">
                        ORIGINAL DETECTIONS ({(selectedDetection.defectDetails ?? []).length})
                      </p>
                      <div className="flex flex-col gap-xs">
                        <DetectionList detections={selectedDetection.defectDetails} />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-sm p-lg border-t border-outline-variant flex-shrink-0">
                     <Button variant="outline" size="sm" className="w-full text-error border-error/50 hover:bg-error/10 hover:border-error hover:text-error" onClick={handleDeleteLog}>
                       DELETE FALSE LOG
                     </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Thumbnail Strip */}
            <div className="border-t border-outline-variant bg-surface-container-low p-sm flex gap-xs overflow-x-auto custom-scrollbar flex-shrink-0">
              {falseDetections.map((r, i) => (
                <button
                  key={r.frameId}
                  onClick={() => setIdx(i)}
                  className={`flex-shrink-0 w-20 h-12 lg:w-24 lg:h-14 rounded-sm overflow-hidden border-2 transition-all relative
                    ${i === idx
                      ? 'border-primary ring-1 ring-primary'
                      : 'border-outline-variant hover:border-primary'}`}
                >
                  <img src={r.thumbnail} alt={r.frameId} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>

          </div>
        )}
      </main>
    </div>
  );
};

export default DeveloperMode;
