import React from 'react';
import { useNavigate } from 'react-router-dom';
import OCRPanel from '../../components/OCRPanel';
import useInspectionStore from '../../store/useInspectionStore';

export default function TrainNumberOCR() {
  const navigate = useNavigate();
  const completeOCR = useInspectionStore((s) => s.completeOCR);

  const handleComplete = (detectedTrainNumber) => {
    completeOCR(detectedTrainNumber);
    navigate('/inspect/detect');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Stage header */}
      <div className="flex items-center gap-sm px-lg py-md border-b border-outline-variant bg-surface-container-low flex-shrink-0">
        <span className="material-symbols-outlined text-primary text-[24px]">tag</span>
        <div className="min-w-0">
          <h1 className="font-h2 text-on-surface leading-none text-[20px] lg:text-[22px]">Bogie No. OCR</h1>
          <p className="font-body-sm text-on-surface-variant mt-[4px] truncate text-[13px] lg:text-[14px]">
            Upload the video or an image — detect the bogie number before running defect detection
          </p>
        </div>
        <div className="ml-auto flex items-center gap-xs flex-shrink-0">
          <span className="font-label-caps text-[11px] lg:text-[12px] text-primary bg-primary/10 border border-primary/30 px-sm py-[4px] rounded-sm">
            OCR SERVICE · PORT 5000
          </span>
        </div>
      </div>

      <OCRPanel onComplete={handleComplete} />
    </div>
  );
}
