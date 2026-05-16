import React from 'react';
import { Check, Loader2 } from 'lucide-react';

const STAGES = [
  { id: 'upload', label: 'Upload Data' },
  { id: 'framing', label: 'Video Framing' },
  { id: 'analysis', label: 'Dual Analysis' },
  { id: 'comparison', label: 'Final Report' },
];

export default function PipelineProgress({ currentStage }) {
  const currentIdx = STAGES.findIndex(s => s.id === currentStage);

  return (
    <div className="flex items-center justify-center gap-4 py-6 bg-slate-900/50 border-b border-slate-800">
      {STAGES.map((stage, idx) => {
        const isCompleted = idx < currentIdx;
        const isActive = idx === currentIdx;

        return (
          <React.Fragment key={stage.id}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                isCompleted ? 'bg-success border-success text-white' :
                isActive ? 'bg-primary border-primary text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' :
                'bg-slate-800 border-slate-700 text-slate-500'
              }`}>
                {isCompleted ? <Check size={16} strokeWidth={3} /> : 
                 isActive ? <Loader2 size={16} className="animate-spin" /> : 
                 <span className="text-xs font-bold">{idx + 1}</span>}
              </div>
              <span className={`text-xs font-bold tracking-tight uppercase ${
                isActive ? 'text-white' : 'text-slate-500'
              }`}>
                {stage.label}
              </span>
            </div>
            {idx < STAGES.length - 1 && (
              <div className={`w-12 h-0.5 rounded-full ${
                idx < currentIdx ? 'bg-success' : 'bg-slate-800'
              }`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
