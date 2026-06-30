import { create } from 'zustand';

interface HealthState {
  /** Live step count from Pedometer (not persisted — refreshed on each app open) */
  steps: number;
  setSteps: (steps: number) => void;
}

export const useHealthStore = create<HealthState>()((set) => ({
  steps: 0,
  setSteps: (steps) => set({ steps }),
}));

