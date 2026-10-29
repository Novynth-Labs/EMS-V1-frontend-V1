/**
 * Modern notification chime and phone ringtone synthesizer using Web Audio API.
 * Pure Web Audio ensures 0ms latency, zero external asset dependencies, 
 * and reliable playback across web browsers and Electron even if audio files fail.
 */

let audioCtx: AudioContext | null = null;
let ringInterval: ReturnType<typeof setInterval> | null = null;
let isRinging = false;

export const getAudioContext = (): AudioContext | null => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch (e) {
    return null;
  }
};

// Global unlock listener for browser autoplay restriction
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  };
  window.addEventListener('pointerdown', unlockAudio, { once: false, passive: true });
  window.addEventListener('keydown', unlockAudio, { once: false, passive: true });
}

/**
 * Plays a pleasant, modern dual-tone notification chime.
 */
export const playNotificationSound = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Chime Tone 1: F#5 (740 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(740, now);
    osc1.frequency.exponentialRampToValueAtTime(784, now + 0.08);

    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    // Chime Tone 2: B5 (987.77 Hz) to C6 (1046.5 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, now + 0.08);
    osc2.frequency.exponentialRampToValueAtTime(1046.5, now + 0.16);

    gain2.gain.setValueAtTime(0.0001, now);
    gain2.gain.setValueAtTime(0.1, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.45);
  } catch (e) {
    console.warn('Could not play notification chime:', e);
  }
};

/**
 * Plays one burst of telephone ring cadence (440Hz + 480Hz).
 */
const playRingBurst = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 1.6; // 1.6s ring burst

    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscA.type = 'sine';
    oscB.type = 'sine';
    oscA.frequency.setValueAtTime(440, now);
    oscB.frequency.setValueAtTime(480, now);

    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.linearRampToValueAtTime(0.15, now + 0.05);
    gainNode.gain.setValueAtTime(0.15, now + duration - 0.1);
    gainNode.gain.linearRampToValueAtTime(0.001, now + duration);

    oscA.connect(gainNode);
    oscB.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscA.start(now);
    oscB.start(now);
    oscA.stop(now + duration);
    oscB.stop(now + duration);
  } catch (e) {
    console.warn('[RingtoneSynth] Failed to play burst:', e);
  }
};

/**
 * Starts continuous phone ringtone until stopPhoneRingtone is called.
 */
export const startPhoneRingtone = () => {
  if (isRinging) return;
  isRinging = true;
  playRingBurst();
  ringInterval = setInterval(() => {
    if (isRinging) {
      playRingBurst();
    }
  }, 3000); // Ring 1.6s, pause 1.4s
};

/**
 * Stops continuous phone ringtone.
 */
export const stopPhoneRingtone = () => {
  isRinging = false;
  if (ringInterval) {
    clearInterval(ringInterval);
    ringInterval = null;
  }
};
