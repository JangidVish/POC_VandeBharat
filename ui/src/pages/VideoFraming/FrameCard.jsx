import React from 'react';
import Card from '../../components/common/Card';

const FrameCard = ({ id, timestamp, gps, iso, thumbnail, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="group bg-surface-container-lowest border border-outline-variant overflow-hidden cursor-pointer hover:border-primary transition-colors"
    >
      <div className="aspect-video relative overflow-hidden bg-primary-container">
        <img 
          className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-300" 
          src={thumbnail} 
          alt={id}
        />
        <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="bg-primary text-on-primary px-sm py-xs font-label-caps text-[10px]">PREVIEW</span>
        </div>
      </div>
      <div className="p-sm flex flex-col gap-xs">
        <div className="flex justify-between items-center">
          <span className="font-code text-primary font-bold text-body-sm">{id}</span>
          <span className="font-label-caps text-on-surface-variant text-[10px]">{timestamp}</span>
        </div>
        <div className="flex items-center gap-sm text-[10px] font-label-caps text-on-surface-variant border-t border-outline-variant pt-xs mt-xs">
          <span>GPS: {gps}</span>
          <span className="ml-auto">{iso}</span>
        </div>
      </div>
    </div>
  );
};

export default FrameCard;
