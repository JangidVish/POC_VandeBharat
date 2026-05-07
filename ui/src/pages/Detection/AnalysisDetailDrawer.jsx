import React from 'react';
import Button from '../../components/common/Button';
import { useToast } from '../../context/ToastContext';

const AnalysisDetailDrawer = ({ isOpen, onClose, result }) => {
  const toast = useToast();

  const handleExport = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `annotation_${result.id?.replace(/[^a-zA-Z0-9_]/g, '_') ?? 'frame'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ type: 'success', message: `Annotation exported: ${result.id}` });
  };
  if (!result) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-primary/20 z-[60] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      
      {/* Drawer */}
      <aside className={`fixed right-0 top-0 h-full w-full md:w-[400px] bg-surface-container-lowest border-l border-outline-variant shadow-xl z-[70] transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
        <div className="p-lg border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
          <h3 className="font-h2 text-primary">Image Analysis Detail</h3>
          <button 
            onClick={onClose}
            className="material-symbols-outlined cursor-pointer hover:bg-surface-container-high rounded p-xs"
          >
            close
          </button>
        </div>
        
        <div className="p-lg flex flex-col gap-lg overflow-y-auto custom-scrollbar flex-1">
          <div className="aspect-square bg-surface border border-outline-variant rounded relative overflow-hidden">
            <img className="w-full h-full object-cover" src={result.thumbnail} alt={result.id} />
            <div className={`absolute inset-0 border-2 ${result.defects > 0 ? 'border-error/50' : 'border-blue-500/30'}`}></div>
          </div>
          
          <div className="flex flex-col gap-md">
            <span className="font-label-caps text-on-surface-variant text-[11px]">DETECTED ENTITIES ({result.detections?.length || 0})</span>
            <div className="flex flex-col gap-sm">
              {result.detections?.map((det, idx) => (
                <div key={idx} className={`flex justify-between items-center p-md border rounded-sm ${det.type === 'defect' ? 'bg-error-container border-error/20' : 'bg-surface border-outline-variant'}`}>
                  <div className="flex items-center gap-sm">
                    <span className={`w-3 h-3 rounded-full ${det.type === 'defect' ? 'bg-error' : 'bg-blue-500'}`}></span>
                    <span className={`font-medium text-body-base ${det.type === 'defect' ? 'text-on-error-container' : 'text-primary'}`}>{det.label}</span>
                  </div>
                  <span className={`font-code text-body-sm ${det.type === 'defect' ? 'text-on-error-container' : 'text-on-surface-variant'}`}>
                    {Math.round(det.confidence * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex flex-col gap-sm">
            <span className="font-label-caps text-on-surface-variant text-[11px]">METADATA</span>
            <div className="grid grid-cols-2 gap-y-md gap-x-md text-body-sm bg-surface-container-low p-md rounded-sm border border-outline-variant">
              <div className="text-on-surface-variant">Capture Time</div>
              <div className="text-right font-medium text-primary">12:44:02.04</div>
              <div className="text-on-surface-variant">GPS Coordinates</div>
              <div className="text-right font-medium text-primary">28.61, 77.21</div>
              <div className="text-on-surface-variant">Exposure</div>
              <div className="text-right font-medium text-primary">1/2000s</div>
            </div>
          </div>
        </div>
        
        <div className="p-lg border-t border-outline-variant bg-surface-container-low">
          <Button variant="primary" className="w-full" onClick={handleExport}>
            EXPORT ANNOTATION
          </Button>
        </div>
      </aside>
    </>
  );
};

export default AnalysisDetailDrawer;
