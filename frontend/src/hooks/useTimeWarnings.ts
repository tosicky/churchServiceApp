import { useEffect, useRef } from 'react';

interface TimeWarnings {
  isFinalMinute: boolean;
  justHitZero: boolean;
}

export function useTimeWarnings(remaining: number | null): TimeWarnings {
  const prevRemainingRef = useRef<number | null>(null);
  const finalMinuteAlertedRef = useRef(false);
  const zeroAlertedRef = useRef(false);

  const warnings: TimeWarnings = {
    isFinalMinute: false,
    justHitZero: false,
  };

  useEffect(() => {
    if (remaining === null || remaining === undefined) return;

    // Check for entering final minute (crossing from >60 to <=60)
    if (
      prevRemainingRef.current !== null &&
      prevRemainingRef.current > 60 &&
      remaining <= 60 &&
      !finalMinuteAlertedRef.current
    ) {
      warnings.isFinalMinute = true;
      finalMinuteAlertedRef.current = true;
      playBeep(800, 200); // High beep, 200ms
    }

    // Check for hitting zero (crossing from >0 to <=0)
    if (
      prevRemainingRef.current !== null &&
      prevRemainingRef.current > 0 &&
      remaining <= 0 &&
      !zeroAlertedRef.current
    ) {
      warnings.justHitZero = true;
      zeroAlertedRef.current = true;
      playBeep(400, 400); // Lower beep, 400ms
    }

    // Check for entering final minute state (for visual indicator)
    if (remaining > 0 && remaining <= 60) {
      warnings.isFinalMinute = true;
    }

    // Check for overtime state
    if (remaining < 0) {
      warnings.isFinalMinute = true;
    }

    // Reset alerts when timer restarts (remaining resets to initial duration)
    if (prevRemainingRef.current !== null && remaining > 60) {
      finalMinuteAlertedRef.current = false;
      zeroAlertedRef.current = false;
    }

    prevRemainingRef.current = remaining;
  }, [remaining]);

  return warnings;
}

function playBeep(frequency: number, duration: number) {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration / 1000);
  } catch (e) {
    console.error('Failed to play beep:', e);
  }
}
