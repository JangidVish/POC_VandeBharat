import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './useInspectionStore';

const useDeveloperStore = create(
  persist(
    (set, get) => ({
      developerMode: false,
      falseDetections: [], // { id, videoName, timestamp, frameId, defectDetails, falseDetails, thumbnail, gps, trainNumber }
      
      toggleDeveloperMode: () => set((state) => ({ developerMode: !state.developerMode })),
      
      addFalseDetection: (detection) => set((state) => {
        // Prevent duplicates based on frameId/imageId
        if (state.falseDetections.find(d => d.frameId === detection.frameId)) {
          return state;
        }
        return {
          falseDetections: [detection, ...state.falseDetections]
        };
      }),

      removeFalseDetection: (frameId) => set((state) => ({
        falseDetections: state.falseDetections.filter(d => d.frameId !== frameId)
      })),
      
      clearFalseDetections: () => set({ falseDetections: [] })
    }),
    {
      name: 'vande-bharat-developer-storage',
      storage: createJSONStorage(() => idbStorage),
    }
  )
);

export default useDeveloperStore;
