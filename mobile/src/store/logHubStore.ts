import { create } from 'zustand';

/**
 * Visibility of the log hub sheet. Lives in a tiny store rather than local
 * state so screens under the tab bar (Home's empty state) can open the very
 * same sheet the centre "+" opens, without prop drilling through navigation
 * and without Dashboard importing the navigator that renders it.
 */
interface LogHubState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useLogHubStore = create<LogHubState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

export const openLogHub = () => useLogHubStore.getState().setOpen(true);
