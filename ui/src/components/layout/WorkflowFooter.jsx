import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useInspectionStore from '../../store/useInspectionStore';

const steps = [
  { id: 1, label: 'Video Framing', path: '/inspect' },
  { id: 2, label: 'Train No. OCR', path: '/inspect/ocr' },
  { id: 3, label: 'Detection', path: '/inspect/detect' },
  { id: 4, label: 'Inspection Output', path: '/inspect/report' },
];

const WorkflowFooter = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const activeStep = useInspectionStore((s) => s.activeStep);
  const canAccessStep = useInspectionStore((s) => s.canAccessStep);

  const currentStep = steps.find((s) => s.path === location.pathname)?.id ?? 1;

  return (
    <footer className="bg-surface-container-low border-t border-outline-variant z-50 flex-shrink-0">
      <div className="flex justify-between items-center w-full px-lg py-sm">
        {/* Progress Stepper */}
        <div className="flex items-center gap-xs sm:gap-md overflow-x-auto">
          {steps.map((step, index) => {
            const isCompleted = step.id < activeStep;
            const isCurrent = step.id === currentStep;
            const isAccessible = canAccessStep(step.id);

            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => navigate(step.path)}
                  className={`flex items-center gap-xs cursor-pointer transition-colors whitespace-nowrap`}
                >
                  {isCompleted ? (
                    <span
                      className="material-symbols-outlined text-primary text-[18px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                  ) : (
                    <span
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                        isCurrent
                          ? 'border-primary text-primary'
                          : 'border-outline-variant text-on-surface-variant'
                      }`}
                    >
                      {step.id}
                    </span>
                  )}
                  <span
                    className={`font-label-caps text-[10px] hidden sm:inline ${
                      isCurrent || isCompleted ? 'text-primary' : 'text-on-surface-variant'
                    }`}
                  >
                    {step.label}
                  </span>
                </button>
                {index < steps.length - 1 && (
                  <div
                    className={`w-6 sm:w-8 h-px flex-shrink-0 transition-colors ${
                      isCompleted ? 'bg-primary' : 'bg-outline-variant'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Branding/System Status */}
        <div className="hidden sm:flex items-center gap-lg flex-shrink-0">
          <span className="font-label-caps text-[10px] text-on-surface-variant">
            SYSTEM STATUS: <span className="text-primary font-bold">READY</span>
          </span>
          <span className="font-label-caps text-[10px] text-primary">
            © 2026 | VER. 4.2.0-STABLE
          </span>
        </div>
      </div>
    </footer>
  );
};

export default WorkflowFooter;
