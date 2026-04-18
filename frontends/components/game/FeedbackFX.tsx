"use client";

import { useEffect, useRef } from "react";

type SoundType = "click" | "win" | "bigwin" | "daily";

function createSoundPattern(type: SoundType) {
  if (type === "click") {
    return [
      { frequency: 320, durationMs: 45, gain: 0.05, wave: "square" as OscillatorType },
      { frequency: 480, durationMs: 40, gain: 0.04, wave: "square" as OscillatorType },
    ];
  }

  if (type === "daily") {
    return [
      { frequency: 392, durationMs: 100, gain: 0.06, wave: "triangle" as OscillatorType },
      { frequency: 523, durationMs: 130, gain: 0.07, wave: "triangle" as OscillatorType },
    ];
  }

  if (type === "bigwin") {
    return [
      { frequency: 523, durationMs: 140, gain: 0.07, wave: "sawtooth" as OscillatorType },
      { frequency: 659, durationMs: 140, gain: 0.08, wave: "sawtooth" as OscillatorType },
      { frequency: 784, durationMs: 180, gain: 0.08, wave: "sawtooth" as OscillatorType },
    ];
  }

  return [
    { frequency: 440, durationMs: 90, gain: 0.06, wave: "sine" as OscillatorType },
    { frequency: 587, durationMs: 120, gain: 0.07, wave: "sine" as OscillatorType },
  ];
}

function playPattern(audioContext: AudioContext, type: SoundType) {
  const steps = createSoundPattern(type);
  let offsetSec = 0;

  for (const step of steps) {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = step.wave;
    oscillator.frequency.value = step.frequency;

    gain.gain.value = 0.0001;
    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    const startAt = audioContext.currentTime + offsetSec;
    const endAt = startAt + step.durationMs / 1000;

    gain.gain.exponentialRampToValueAtTime(Math.max(step.gain, 0.001), startAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

    oscillator.start(startAt);
    oscillator.stop(endAt + 0.01);

    offsetSec += step.durationMs / 1000;
  }
}

export function FeedbackFX() {
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    const getContext = () => {
      if (!audioRef.current) {
        audioRef.current = new AudioContextClass();
      }
      return audioRef.current;
    };

    const handleSound = (event: Event) => {
      const customEvent = event as CustomEvent<{ type?: SoundType }>;
      const type = customEvent.detail?.type;

      if (!type) {
        return;
      }

      try {
        const audioContext = getContext();
        if (audioContext.state === "suspended") {
          void audioContext.resume();
        }
        playPattern(audioContext, type);
      } catch {
        // Ignore non-critical sound playback errors.
      }
    };

    window.addEventListener("app:sound", handleSound as EventListener);

    return () => {
      window.removeEventListener("app:sound", handleSound as EventListener);
    };
  }, []);

  return null;
}
