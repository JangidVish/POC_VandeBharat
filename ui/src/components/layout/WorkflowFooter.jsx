import React from 'react';

const WorkflowFooter = ({ currentStep = 1 }) => {
  const steps = [
    { id: 1, label: 'Video Uploaded' },
    { id: 2, label: 'Framing Complete' },
    { id: 3, label: 'Ready For Detection' },
  ];

  return (
    <footer className="fixed bottom-0 w-full bg-surface-container-low border-t border-outline-variant z-50">
      <div className="flex justify-between items-center w-full px-lg py-sm">
        {/* Progress Stepper */}
        <div className="flex items-center gap-lg">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className="flex items-center gap-xs">
                {currentStep > step.id ? (
                  <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                ) : (
                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                    currentStep === step.id ? 'border-primary text-primary' : 'border-outline-variant text-on-surface-variant'
                  }`}>
                    {step.id}
                  </span>
                )}
                <span className={`font-label-caps ${currentStep >= step.id ? 'text-primary' : 'text-on-surface-variant'}`}>
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && <div className="w-8 h-px bg-outline-variant"></div>}
            </React.Fragment>
          ))}
        </div>

        {/* Branding/System Status */}
        <div className="flex items-center gap-lg">
          <span className="font-label-caps text-on-surface-variant">
            SYSTEM STATUS: <span className="text-primary font-bold">READY</span>
          </span>
          <span className="font-label-caps text-primary">
            © 2026 | VER. 4.2.0-STABLE
          </span>
        </div>
      </div>
    </footer>
  );
};

export default WorkflowFooter;
