import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import RouteTransition from './components/layout/RouteTransition';
import VideoFraming from './pages/VideoFraming';
import TrainNumberOCR from './pages/TrainNumberOCR';
import Detection from './pages/Detection';
import InspectionOutput from './pages/InspectionOutput';
import DeveloperMode from './pages/DeveloperMode';

const Dashboard = () => (
  <div className="flex-1 flex flex-col items-center justify-center bg-surface gap-md">
    <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center border border-outline-variant">
      <span className="material-symbols-outlined text-primary text-[32px]">dashboard</span>
    </div>
    <div className="text-center">
      <h2 className="text-on-surface-variant font-h2">Dashboard Overview</h2>
      <p className="text-body-sm text-outline mt-xs">System-wide metrics and historical reports will appear here.</p>
    </div>
  </div>
);

export default function App() {
  return (
    <AppShell>
      <RouteTransition>
        <Routes>
          <Route path="/" element={<Navigate to="/inspect" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/inspect" element={<VideoFraming />} />
          <Route path="/inspect/ocr" element={<TrainNumberOCR />} />
          <Route path="/inspect/detect" element={<Detection />} />
          <Route path="/inspect/report" element={<InspectionOutput />} />
          <Route path="/developer" element={<DeveloperMode />} />
          <Route path="*" element={<Navigate to="/inspect" replace />} />
        </Routes>
      </RouteTransition>
    </AppShell>
  );
}
