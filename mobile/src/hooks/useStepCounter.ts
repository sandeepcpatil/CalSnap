import { useEffect } from 'react';
import { Pedometer } from 'expo-sensors';
import { useHealthStore } from '../store/healthStore';

/**
 * Mount this hook once in a top-level screen (e.g. DashboardScreen or ProfileScreen)
 * to start counting today's steps from midnight.
 */
export function useStepCounter() {
  const setSteps = useHealthStore((s) => s.setSteps);

  useEffect(() => {
    let subscription: ReturnType<typeof Pedometer.watchStepCount> | null = null;

    (async () => {
      const isAvailable = await Pedometer.isAvailableAsync();
      if (!isAvailable) return;

      const { status } = await Pedometer.requestPermissionsAsync();
      if (status !== 'granted') return;

      // Load today's historic count first
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      try {
        const { steps } = await Pedometer.getStepCountAsync(midnight, new Date());
        setSteps(steps);
      } catch {
        // Pedometer history not supported on all devices — fall back to live watch
      }

      // Keep updating in real-time while app is foregrounded
      subscription = Pedometer.watchStepCount((result) => {
        setSteps(result.steps);
      });
    })();

    return () => {
      subscription?.remove();
    };
  }, [setSteps]);
}
