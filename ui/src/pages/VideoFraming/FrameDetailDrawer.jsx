import React from 'react';
import Button from '../../components/common/Button';

const FrameDetailDrawer = ({ isOpen, onClose, frame, onSendToDetection }) => {
  if (!frame) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-primary/20 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      
      {/* Drawer */}
      <aside className={`fixed right-0 top-[72px] bottom-[60px] w-full md:w-[400px] bg-surface-container-lowest border-l border-outline-variant flex flex-col shadow-lg z-50 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-md border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
          <span className="font-h2 text-h2 text-primary">Frame Detail: {frame.id}</span>
          <button 
            onClick={onClose}
            className="material-symbols-outlined text-on-surface-variant hover:text-primary"
          >
            close
          </button>
        </div>
        
        <div className="p-md flex flex-col gap-lg overflow-y-auto">
          <div className="aspect-video bg-primary-container border border-outline overflow-hidden">
            <img className="w-full h-full object-cover" src={frame.thumbnail} alt={frame.id} />
          </div>
          
          <div className="flex flex-col gap-sm">
            <h4 className="font-label-caps text-on-surface-variant text-[11px]">DIAGNOSTIC METADATA</h4>
            <div className="grid grid-cols-2 gap-md bg-surface-container-low p-md rounded-sm border border-outline-variant">
              <div>
                <p className="font-label-caps text-on-surface-variant text-[10px]">TIMESTAMP</p>
                <p className="font-code text-primary text-body-sm">{frame.fullTimestamp || '00:00:01:14'}</p>
              </div>
              <div>
                <p className="font-label-caps text-on-surface-variant text-[10px]">SECTION ID</p>
                <p className="font-code text-primary text-body-sm">{frame.sectionId || 'BLR-MYS-74'}</p>
              </div>
              <div>
                <p className="font-label-caps text-on-surface-variant text-[10px]">EXPOSURE</p>
                <p className="font-code text-primary text-body-sm">{frame.exposure || '1/1000s'}</p>
              </div>
              <div>
                <p className="font-label-caps text-on-surface-variant text-[10px]">GAIN</p>
                <p className="font-code text-primary text-body-sm">{frame.gain || '2.4 dB'}</p>
              </div>
            </div>
          </div>
          
          <Button
            variant="primary"
            icon="send"
            className="w-full"
            onClick={onSendToDetection}
          >
            SEND TO DETECTION MODULE
          </Button>
        </div>
      </aside>
    </>
  );
};

export default FrameDetailDrawer;
