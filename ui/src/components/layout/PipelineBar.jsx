import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useInspectionStore from '../../store/useInspectionStore';

const steps = [
  { id: 1, label: 'Video Framing', path: '/inspect', icon: 'videocam' },
  { id: 2, label: 'Train No. OCR', path: '/inspect/ocr', icon: 'tag' },
  { id: 3, label: 'Detection', path: '/inspect/detect', icon: 'search' },
  { id: 4, label: 'Inspection Output', path: '/inspect/report', icon: 'assignment' },
];

const PipelineBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const activeStep = useInspectionStore((s) => s.activeStep);
  const canAccessStep = useInspectionStore((s) => s.canAccessStep);

  const currentStep = steps.find((s) => s.path === location.pathname)?.id ?? 1;

  // Build breadcrumb from current step
  const currentStepData = steps.find((s) => s.id === currentStep);

  return (
    <div className="bg-surface-container-lowest border-b border-outline-variant px-md lg:px-lg py-sm lg:py-md flex items-center justify-between gap-md flex-shrink-0">
      {/* Left: Breadcrumb */}
      <div className="flex items-center gap-xs min-w-0 overflow-hidden">
        <nav className="flex items-center gap-xs font-label-caps text-[11px] lg:text-[12px] text-outline whitespace-nowrap">
          <span className="hidden sm:inline">Pipeline</span>
          <span className="material-symbols-outlined text-[14px] lg:text-[16px]">chevron_right</span>
          <span className="text-primary font-bold">{currentStepData?.label ?? 'Video Framing'}</span>
        </nav>
      </div>

      {/* Right: Step Buttons */}
      <div className="flex items-center gap-xs flex-shrink-0">
        <span className="font-label-caps text-[10px] lg:text-[11px] text-outline mr-1 hidden xl:inline">PROCESS STAGE:</span>
        {steps.map((step, index) => {
          const isCompleted = step.id < activeStep;
          const isCurrent = step.id === currentStep;
          
          return (
            <React.Fragment key={step.id}>
              {index > 0 && (
                <div className={`w-3 lg:w-6 xl:w-8 h-px hidden sm:block ${isCompleted ? 'bg-primary' : 'bg-outline-variant'}`} />
              )}
              <button
                onClick={() => navigate(step.path)}
                className={`flex items-center gap-xs px-3 lg:px-sm xl:px-md py-1.5 lg:py-2 font-label-caps text-[10px] lg:text-[11px] xl:text-[12px] border transition-all rounded-sm cursor-pointer whitespace-nowrap
                  ${isCurrent
                    ? 'bg-primary text-on-primary border-primary font-bold shadow-sm'
                    : isCompleted
                      ? 'bg-surface-container-low text-primary border-primary/30 hover:bg-primary/5'
                      : 'bg-surface-container-lowest text-outline border-outline-variant hover:bg-surface-container-low'
                  }`}
              >
                {isCompleted && (
                  <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                )}
                <span className="hidden lg:inline">{step.label}</span>
                <span className="lg:hidden">{step.id}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default PipelineBar;
