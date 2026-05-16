import React from 'react';
import TopNavBar from './TopNavBar';
import PipelineBar from './PipelineBar';
import WorkflowFooter from './WorkflowFooter';
import ToastContainer from '../ui/ToastContainer';

/**
 * AppShell — Root layout using CSS Grid.
 * 
 * Grid rows:
 *   1. TopNavBar     (auto height — sticky)
 *   2. PipelineBar   (auto height — breadcrumb + stage nav)
 *   3. Workspace     (1fr — only this scrolls)
 *   4. WorkflowFooter(auto height — sticky)
 */
const AppShell = ({ children }) => {
  return (
    <div className="grid grid-rows-[auto_auto_1fr_auto] h-dvh overflow-hidden bg-background">
      <TopNavBar />
      <PipelineBar />

      <main className="overflow-hidden flex flex-col min-h-0">
        {children}
      </main>

      <WorkflowFooter />
      <ToastContainer />
    </div>
  );
};

export default AppShell;
