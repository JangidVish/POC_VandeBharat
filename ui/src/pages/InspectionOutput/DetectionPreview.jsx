import React from 'react';
import Button from '../../components/common/Button';

const DetectionPreview = ({ selectedRow }) => {
  if (!selectedRow) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant flex items-center justify-center h-[400px] text-on-surface-variant font-label-caps">
        Select a row to preview detection
      </div>
    );
  }

  return (
    <section className="bg-surface-container-lowest border border-outline-variant flex flex-col md:flex-row h-[400px] overflow-hidden shadow-sm">
      <div className="flex-grow bg-surface-container-highest relative group overflow-hidden">
        <img 
          className="w-full h-full object-cover" 
          src={selectedRow.thumbnail || 'https://lh3.googleusercontent.com/aida-public/AB6AXuCHIreT1_XIkocw5wqa9uPm5RWvhpr5WkPazqwrHltPc-IDgSbLxG9E84qHKLEfTfkjcX9tIVVI049dsLmNLmnSnghVkVPszS4wRFtdOwlx8j1pBh9MZ9OSMakGJioqxb8znozkRPQSZKn7cVsObJjRU7f9baGasbTqMjty53VDOMrt7Yjfgr5yAop3H8qoxgERSwGDgf5Y2PvUqrOGLiyDPtlWXg8aqfSqvTifVPmdTNF_ZdI3BGNBG-m66yLXWiASVouUwHWboA'} 
          alt={selectedRow.imageId} 
        />
        
        {/* Bounding Box Simulation */}
        <div className="absolute top-[45%] left-[45%] w-[100px] h-[50px] border-2 border-primary bg-primary/10 flex items-start justify-start">
          <span className="bg-primary text-white text-[10px] font-bold px-1 -mt-[20px] whitespace-nowrap">
            {selectedRow.component.toUpperCase()}: 0.98
          </span>
        </div>
        
        <div className="absolute bottom-md right-md flex gap-sm opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="bg-primary/80 text-white p-sm flex items-center justify-center hover:bg-primary rounded-sm"><span className="material-symbols-outlined text-[18px]">zoom_in</span></button>
          <button className="bg-primary/80 text-white p-sm flex items-center justify-center hover:bg-primary rounded-sm"><span className="material-symbols-outlined text-[18px]">fullscreen</span></button>
        </div>
      </div>
      
      <div className="w-full md:w-80 border-l border-outline-variant p-panel-padding flex flex-col gap-md bg-surface-container-low/20">
        <div className="flex justify-between items-start">
          <h3 className="font-h2 text-h2 text-primary text-body-base">DETECTION PREVIEW</h3>
          <span className="material-symbols-outlined text-on-surface-variant text-[18px]">info</span>
        </div>
        
        <div className="flex flex-col gap-sm">
          <div className="flex justify-between font-body-sm text-[12px]">
            <span className="text-on-surface-variant">SELECTED ID</span>
            <span className="font-code text-primary">{selectedRow.imageId}</span>
          </div>
          <div className="flex justify-between font-body-sm text-[12px]">
            <span className="text-on-surface-variant">COMPONENT</span>
            <span className="font-medium text-primary">{selectedRow.component}</span>
          </div>
          <div className="flex justify-between font-body-sm text-[12px]">
            <span className="text-on-surface-variant">LOCALIZATION</span>
            <span className="font-medium text-primary">{selectedRow.bogieNo}</span>
          </div>
          
          <hr className="border-outline-variant my-xs"/>
          
          <div className="space-y-xs">
            <p className="font-label-caps text-[10px] text-on-surface-variant uppercase">DETECTION NOTES</p>
            <p className="font-body-sm text-on-surface text-[12px] leading-relaxed">
              {selectedRow.defect !== 'None' 
                ? `Critical defect identified: ${selectedRow.defect}. Component requires immediate inspection.` 
                : 'Component appears within nominal tolerance. No immediate action required.'}
            </p>
          </div>
        </div>
        
        <div className="mt-auto flex gap-sm">
          <Button variant="outline" size="sm" className="flex-1">FLAG INCORRECT</Button>
          <Button variant="primary" size="sm" className="flex-1">APPROVE</Button>
        </div>
      </div>
    </section>
  );
};

export default DetectionPreview;
