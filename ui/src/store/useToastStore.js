import { create } from 'zustand';

let toastId = 0;

const useToastStore = create((set) => ({
  toasts: [],

  addToast: ({ type = 'info', message, duration = 4000 }) => {
    const id = ++toastId;
    set((state) => ({
      toasts: [...state.toasts, { id, type, message }],
    }));
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }
    return id;
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

// Convenience hook that matches the old useToast() API
export const useToast = () => {
  const addToast = useToastStore((s) => s.addToast);
  return addToast;
};

export default useToastStore;
