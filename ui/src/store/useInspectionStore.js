import { create } from 'zustand';

const useInspectionStore = create((set, get) => ({
  // ─── Multi-Session Management ──────────────────────────
  sessions: [], // { id, name, videoFile, extractedFrames, ocrResults, trainNumber, detectionResults, activeStep, timestamp }
  currentSessionId: null,

  // ─── Legacy/Direct Access (Mirrors Current Session) ─────
  activeStep: 1,
  videoFile: null,
  extractedFrames: [],
  ocrResults: null,
  trainNumber: null,
  detectionResults: [],
  
  // ─── Actions ───────────────────────────────────────────
  
  createSession: (name, file) => set((state) => {
    const id = `SESSION_${Date.now()}`;
    const newSession = {
      id,
      name: name || `Inspection ${state.sessions.length + 1}`,
      videoFile: file,
      extractedFrames: [],
      ocrResults: null,
      trainNumber: null,
      detectionResults: [],
      activeStep: 1,
      timestamp: new Date().toISOString()
    };
    return {
      sessions: [...state.sessions, newSession],
      currentSessionId: id,
      videoFile: file,
      extractedFrames: [],
      ocrResults: null,
      trainNumber: null,
      detectionResults: [],
      activeStep: 1
    };
  }),

  switchSession: (id) => set((state) => {
    const session = state.sessions.find(s => s.id === id);
    if (!session) return state;
    return {
      currentSessionId: id,
      videoFile: session.videoFile,
      extractedFrames: session.extractedFrames,
      ocrResults: session.ocrResults,
      trainNumber: session.trainNumber,
      detectionResults: session.detectionResults,
      activeStep: session.activeStep
    };
  }),

  setVideoFile: (file) => set((state) => {
    const updatedSessions = state.sessions.map(s => 
      s.id === state.currentSessionId ? { ...s, videoFile: file } : s
    );
    return { videoFile: file, sessions: updatedSessions };
  }),

  completeFraming: (frames) => set((state) => {
    const updatedSessions = state.sessions.map(s => 
      s.id === state.currentSessionId ? { ...s, extractedFrames: frames, activeStep: Math.max(s.activeStep, 2) } : s
    );
    return {
      extractedFrames: frames,
      activeStep: Math.max(state.activeStep, 2),
      sessions: updatedSessions
    };
  }),

  setOcrResults: (results) => set((state) => {
    const updatedSessions = state.sessions.map(s => 
      s.id === state.currentSessionId ? { ...s, ocrResults: results } : s
    );
    return { ocrResults: results, sessions: updatedSessions };
  }),

  completeOCR: (trainNumber) => set((state) => {
    const updatedSessions = state.sessions.map(s => 
      s.id === state.currentSessionId ? { ...s, trainNumber, activeStep: Math.max(s.activeStep, 3) } : s
    );
    return {
      trainNumber,
      activeStep: Math.max(state.activeStep, 3),
      sessions: updatedSessions
    };
  }),

  completeDetection: (results) => set((state) => {
    const updatedSessions = state.sessions.map(s => 
      s.id === state.currentSessionId ? { ...s, detectionResults: results, activeStep: Math.max(s.activeStep, 4) } : s
    );
    return {
      detectionResults: results,
      activeStep: Math.max(state.activeStep, 4),
      sessions: updatedSessions
    };
  }),

  goToStep: (step) => set((state) => {
    const updatedSessions = state.sessions.map(s => 
      s.id === state.currentSessionId ? { ...s, activeStep: step } : s
    );
    return { activeStep: step, sessions: updatedSessions };
  }),

  canAccessStep: (step) => true,

  resetSession: () => set({
    currentSessionId: null,
    activeStep: 1,
    videoFile: null,
    extractedFrames: [],
    ocrResults: null,
    trainNumber: null,
    detectionResults: [],
  }),
}));

export default useInspectionStore;
