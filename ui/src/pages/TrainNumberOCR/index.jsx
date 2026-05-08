import OCRPanel from '../../components/OCRPanel';

export default function TrainNumberOCR({ onComplete }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Stage header */}
      <div className="flex items-center gap-sm px-lg py-sm border-b border-outline-variant bg-surface-container-low flex-shrink-0">
        <span className="material-symbols-outlined text-primary text-[20px]">tag</span>
        <div>
          <h1 className="font-h3 text-on-surface leading-none">Bogie No. OCR</h1>
          <p className="font-body-sm text-on-surface-variant mt-[2px]">
            Upload the video or an image — detect the bogie number before running defect detection
          </p>
        </div>
        <div className="ml-auto flex items-center gap-xs">
          <span className="font-label-caps text-[10px] text-primary bg-primary/10 border border-primary/30 px-sm py-[2px] rounded-sm">
            OCR SERVICE · PORT 5000
          </span>
        </div>
      </div>

      <OCRPanel onComplete={onComplete} />
    </div>
  );
}
