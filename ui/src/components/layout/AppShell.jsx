import React from 'react';
import TopNavBar from './TopNavBar';
import WorkflowFooter from './WorkflowFooter';

const AppShell = ({ children, activeModule, onModuleChange, currentStep }) => {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <TopNavBar activeModule={activeModule} onModuleChange={onModuleChange} />
      
      <main className="flex-1 mt-[72px] mb-[60px] overflow-hidden flex flex-col">
        {children}
      </main>

      <WorkflowFooter currentStep={currentStep} />
    </div>
  );
};

export default AppShell;
