import React, { useState } from 'react';
import AppShell from './components/layout/AppShell';
import VideoFraming from './pages/VideoFraming';
import Detection from './pages/Detection';
import InspectionOutput from './pages/InspectionOutput';

const Dashboard = () => (
  <div className="flex-1 flex flex-col items-center justify-center bg-surface gap-md">
    <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center border border-outline-variant animate-pulse">
      <span className="material-symbols-outlined text-primary text-[32px]">dashboard</span>
    </div>
    <div className="text-center">
      <h2 className="text-on-surface-variant font-h2">Dashboard Overview</h2>
      <p className="text-body-sm text-outline mt-xs">System-wide metrics and historical reports will appear here.</p>
    </div>
  </div>
);

export default function App() {
  const [activeModule, setActiveModule] = useState('inspections');
  const [workflowStep, setWorkflowStep] = useState(1);

  const [extractedFrames, setExtractedFrames] = useState([]);
  const [detectedResults, setDetectedResults] = useState([]);

  const handleFramingComplete = (frames) => {
    setExtractedFrames(frames);
    setWorkflowStep(2);
  };

  const handleDetectionComplete = (results) => {
    setDetectedResults(results);
    setExtractedFrames([]); // free base64 frame thumbnails from RAM — no longer needed after detection
    setWorkflowStep(3);
  };

  const renderModule = () => {
    return (
      <div className="flex-1 flex flex-col animate-in fade-in duration-500 overflow-hidden">
        {(() => {
          switch (activeModule) {
            case 'dashboard':
              return <Dashboard />;
            case 'inspections':
              if (workflowStep === 1) return (
                <VideoFraming onComplete={handleFramingComplete} />
              );
              if (workflowStep === 2) return (
                <Detection
                  frames={extractedFrames}
                  onComplete={handleDetectionComplete}
                />
              );
              if (workflowStep === 3) return (
                <InspectionOutput results={detectedResults} />
              );
              return <VideoFraming onComplete={handleFramingComplete} />;
            default:
              return <Dashboard />;
          }
        })()}
      </div>
    );
  };

  return (
    <AppShell
      activeModule={activeModule}
      onModuleChange={setActiveModule}
      currentStep={workflowStep}
    >
      {/* POC Step Toggle */}
      <div className="absolute top-20 right-lg z-50 flex gap-sm bg-surface-container-highest/80 backdrop-blur-md p-xs border border-outline-variant shadow-lg rounded-sm">
        <span className="font-label-caps text-[10px] self-center px-sm text-primary">PIPELINE STAGE:</span>
        {[1, 2, 3].map(step => (
          <button
            key={step}
            onClick={() => setWorkflowStep(step)}
            className={`px-sm py-1 font-code text-[11px] border transition-all rounded-sm ${
              workflowStep === step
                ? 'bg-primary text-on-primary border-primary'
                : 'bg-surface-container-lowest text-primary border-outline-variant hover:bg-surface-container-low'
            }`}
          >
            S{step}
          </button>
        ))}
      </div>

      {renderModule()}
    </AppShell>
  );
}
