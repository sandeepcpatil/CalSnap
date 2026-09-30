import { create } from 'zustand';

export interface ToastAction {
  label: string;
  onPress: () => void | Promise<void>;
}

export interface Toast {
  id: number;
  message: string;
  action?: ToastAction;
  /** ms; defaults to 4000, or 6000 when there is an action to give time to tap it. */
  duration?: number;
}

interface ToastState {
  current: Toast | null;
  show: (message: string, opts?: { action?: ToastAction; duration?: number }) => void;
  dismiss: () => void;
}

let nextId = 1;

/**
 * One app-wide snackbar, rendered once by `ToastHost` at the root.
 *
 * Use it for confirmation after an action the user cannot otherwise see the
 * result of (a meal saved from the camera lands on Home; a log deleted from a
 * list), and for undo. Never for errors that need a decision: those stay as
 * inline states or alerts.
 *
 *   useToastStore.getState().show('Logged to Lunch · 540 kcal', {
 *     action: { label: 'Undo', onPress: () => removeLog(id) },
 *   });
 */
export const useToastStore = create<ToastState>((set) => ({
  current: null,
  show: (message, opts) =>
    set({ current: { id: nextId++, message, action: opts?.action, duration: opts?.duration } }),
  dismiss: () => set({ current: null }),
}));

/** Convenience for non-React callers (stores, services). */
export const toast = (message: string, opts?: { action?: ToastAction; duration?: number }) =>
  useToastStore.getState().show(message, opts);
