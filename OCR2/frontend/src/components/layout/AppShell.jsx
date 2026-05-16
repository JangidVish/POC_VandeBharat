import React from 'react';
import { Activity, BarChart2, Settings, History } from 'lucide-react';

export default function AppShell({ children, activeStep, activeModule, onModuleChange }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navbar */}
      <header className="h-16 border-b border-slate-800 bg-surface/50 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <Activity className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">VANDE BHARAT</h1>
            <p className="text-[10px] text-primary font-bold uppercase tracking-widest">OCR Inspection Module</p>
          </div>
        </div>

        <nav className="flex items-center gap-6">
          <NavItem 
            icon={<BarChart2 size={18} />} 
            label="Live Benchmarks" 
            active={activeModule === 'inspections'} 
            onClick={() => onModuleChange('inspections')}
          />
          <NavItem 
            icon={<History size={18} />} 
            label="Logs" 
            active={activeModule === 'logs'} 
            onClick={() => onModuleChange('logs')}
          />
          <NavItem 
            icon={<Settings size={18} />} 
            label="Settings" 
            active={activeModule === 'settings'} 
            onClick={() => onModuleChange('settings')}
          />
        </nav>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs font-semibold">Rohit Huge</p>
            <p className="text-[10px] text-success font-bold uppercase">System Admin</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600" />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>

      {/* Footer Status Bar */}
      <footer className="h-8 border-t border-slate-800 bg-surface flex items-center justify-between px-6 text-[10px] text-slate-500 font-mono">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            BACKEND: CONNECTED (PORT 5001)
          </span>
          <span>|</span>
          <span>GPU: RTX 4050 ACTIVE</span>
        </div>
        <div>
          V1.2.0-STABLE | PIPELINE STAGE: {activeStep}
        </div>
      </footer>
    </div>
  );
}

function NavItem({ icon, label, active = false, onClick }) {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center gap-2 cursor-pointer transition-colors ${active ? 'text-primary' : 'text-slate-400 hover:text-slate-200'}`}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
