import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Custom IndexedDB storage for Zustand with seamless automatic lossless migration from localStorage
export const idbStorage = {
  getItem: (name) => {
    return new Promise((resolve) => {
      const request = indexedDB.open('inspection-db', 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('store')) {
          db.createObjectStore('store');
        }
      };
      request.onsuccess = (e) => {
        const db = e.target.result;
        const transaction = db.transaction('store', 'readwrite');
        const store = transaction.objectStore('store');
        const getRequest = store.get(name);
        getRequest.onsuccess = () => {
          if (getRequest.result) {
            // Already migrated/saved to IndexedDB
            resolve(getRequest.result);
          } else {
            // Check if there is legacy localStorage data to migrate
            try {
              const legacyData = localStorage.getItem(name);
              if (legacyData) {
                store.put(legacyData, name);
                transaction.oncomplete = () => {
                  try {
                    // Safe cleanup only after verified DB write completion
                    localStorage.removeItem(name);
                  } catch (err) {}
                  resolve(legacyData);
                };
                return;
              }
            } catch (err) {
              console.warn('Failed to migrate legacy localStorage data:', err);
            }
            resolve(null);
          }
        };
        getRequest.onerror = () => resolve(null);
      };
      request.onerror = () => resolve(null);
    });
  },
  setItem: (name, value) => {
    return new Promise((resolve) => {
      const request = indexedDB.open('inspection-db', 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('store')) {
          db.createObjectStore('store');
        }
      };
      request.onsuccess = (e) => {
        const db = e.target.result;
        const transaction = db.transaction('store', 'readwrite');
        transaction.objectStore('store').put(value, name);
        transaction.oncomplete = () => resolve();
      };
      request.onerror = () => resolve();
    });
  },
  removeItem: (name) => {
    return new Promise((resolve) => {
      const request = indexedDB.open('inspection-db', 1);
      request.onsuccess = (e) => {
        const db = e.target.result;
        const transaction = db.transaction('store', 'readwrite');
        transaction.objectStore('store').delete(name);
        transaction.oncomplete = () => resolve();
      };
      request.onerror = () => resolve();
    });
  }
};

const useInspectionStore = create(
  persist(
    (set, get) => ({
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

      deleteSession: (id) => set((state) => {
        const remaining = state.sessions.filter(s => s.id !== id);
        if (state.currentSessionId === id) {
          if (remaining.length > 0) {
            const first = remaining[0];
            return {
              sessions: remaining,
              currentSessionId: first.id,
              videoFile: first.videoFile,
              extractedFrames: first.extractedFrames,
              ocrResults: first.ocrResults,
              trainNumber: first.trainNumber,
              detectionResults: first.detectionResults,
              activeStep: first.activeStep
            };
          } else {
            return {
              sessions: remaining,
              currentSessionId: null,
              videoFile: null,
              extractedFrames: [],
              ocrResults: null,
              trainNumber: null,
              detectionResults: [],
              activeStep: 1
            };
          }
        }
        return { sessions: remaining };
      }),

      renameSession: (id, newName) => set((state) => {
        const updated = state.sessions.map(s => s.id === id ? { ...s, name: newName } : s);
        return { sessions: updated };
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
    }),
    {
      name: 'inspection-store', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => {
        // Exclude videoFile (File object) from being serialized as it will fail or be meaningless
        const { videoFile, sessions, ...rest } = state;
        const serializableSessions = sessions.map(s => {
          const { videoFile: _vf, ...sessionRest } = s;
          return sessionRest;
        });
        return { ...rest, sessions: serializableSessions };
      },
    }
  )
);

export const exportBackup = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('inspection-db', 1);
    request.onsuccess = (e) => {
      const db = e.target.result;
      const transaction = db.transaction('store', 'readonly');
      const store = transaction.objectStore('store');
      
      const backup = {};
      const keys = ['inspection-store', 'vande-bharat-developer-storage'];
      let completed = 0;
      
      keys.forEach(key => {
        const getReq = store.get(key);
        getReq.onsuccess = () => {
          if (getReq.result) {
            backup[key] = getReq.result;
          }
          completed++;
          if (completed === keys.length) {
            resolve(backup);
          }
        };
        getReq.onerror = () => {
          completed++;
          if (completed === keys.length) {
            resolve(backup);
          }
        };
      });
    };
    request.onerror = (err) => reject(err);
  });
};

export const restoreBackup = (backupObj) => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('inspection-db', 1);
    request.onsuccess = (e) => {
      const db = e.target.result;
      const transaction = db.transaction('store', 'readwrite');
      const store = transaction.objectStore('store');
      
      for (const [key, value] of Object.entries(backupObj)) {
        if (key === 'inspection-store' || key === 'vande-bharat-developer-storage') {
          store.put(value, key);
        }
      }
      
      transaction.oncomplete = () => {
        resolve();
      };
      transaction.onerror = (err) => {
        reject(err);
      };
    };
    request.onerror = (err) => reject(err);
  });
};

export default useInspectionStore;
