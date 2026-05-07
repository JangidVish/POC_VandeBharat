import React from 'react';

const ResultCard = ({ id, status, defects, thumbnail, detections, onClick }) => {
  const isDefect = defects > 0;

  return (
    <div 
      onClick={onClick}
      className="group relative cursor-pointer border border-outline-variant rounded overflow-hidden hover:border-primary transition-all bg-surface-container-lowest"
    >
      <div className="aspect-video relative bg-surface-container-high overflow-hidden">
        <img className="w-full h-full object-cover" src={thumbnail} alt={id} />
        
        {/* Bounding Boxes */}
        {detections && detections.map((det, idx) => det.bbox && (
          <div
            key={idx}
            className={`absolute border-2 flex flex-col ${det.type === 'defect' ? 'border-error' : 'border-blue-500'}`}
            style={{ top: det.bbox.top, left: det.bbox.left, width: det.bbox.width, height: det.bbox.height }}
          >
            <span className={`${det.type === 'defect' ? 'bg-error' : 'bg-blue-500'} text-white text-[8px] px-1 font-bold absolute -top-4 left-0 whitespace-nowrap`}>
              {det.label} {Math.round(det.confidence * 100)}%
            </span>
          </div>
        ))}
      </div>
      
      <div className="p-sm flex justify-between items-center">
        <div className="flex flex-col">
          <span className="text-body-sm font-medium text-primary">{id}</span>
          <span className={`text-[10px] font-bold ${isDefect ? 'text-error' : 'text-on-surface-variant'}`}>
            {isDefect ? `${defects} DEFECT${defects > 1 ? 'S' : ''} DETECTED` : status}
          </span>
        </div>
        <span className="material-symbols-outlined text-outline group-hover:text-primary text-[18px]">visibility</span>
      </div>
    </div>
  );
};

export default ResultCard;
