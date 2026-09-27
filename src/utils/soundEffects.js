// Web Audio API Sound Synthesizer for Notifications
// Produces crisp, beautiful, zero-latency notification sounds with zero external asset dependencies

const STORAGE_KEY_SOUND = 'ideate_sound_settings_v1';

let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function getSoundSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_SOUND);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (_) {}
  return {
    enabled: true,
    soundType: 'chime', // 'chime' | 'ding' | 'pop' | 'bell'
    volume: 0.8
  };
}

export function setSoundSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY_SOUND, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('ideate_sound_settings_changed', { detail: settings }));
  } catch (_) {}
}

/**
 * Play a notification sound effect using Web Audio API
 * @param {string} [overrideSoundType] - Optional sound type ('chime', 'ding', 'pop', 'bell')
 * @param {boolean} [forcePlay] - If true, plays even if sound is currently toggled off (useful for sound test buttons)
 */
export function playNotificationSound(overrideSoundType, forcePlay = false) {
  const settings = getSoundSettings();
  if (!forcePlay && !settings.enabled) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    const volume = Math.min(1, Math.max(0, settings.volume ?? 0.8));
    masterGain.gain.setValueAtTime(volume * 0.25, now);
    masterGain.connect(ctx.destination);

    const type = overrideSoundType || settings.soundType || 'chime';

    if (type === 'chime') {
      // Modern 3-note harmonic chime (E5 -> A5 -> C#6)
      const chordNotes = [
        { freq: 659.25, timeOffset: 0.00, dur: 0.35 },
        { freq: 880.00, timeOffset: 0.07, dur: 0.38 },
        { freq: 1108.73, timeOffset: 0.14, dur: 0.45 }
      ];

      chordNotes.forEach(({ freq, timeOffset, dur }) => {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + timeOffset);

        noteGain.gain.setValueAtTime(0, now + timeOffset);
        noteGain.gain.linearRampToValueAtTime(0.7, now + timeOffset + 0.02);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + dur);

        osc.connect(noteGain);
        noteGain.connect(masterGain);

        osc.start(now + timeOffset);
        osc.stop(now + timeOffset + dur + 0.05);
      });
    } else if (type === 'ding') {
      // Crisp metallic bell ding with overtone
      const baseFreq = 987.77; // B5
      [baseFreq, baseFreq * 2.76].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        const initialVol = idx === 0 ? 0.9 : 0.25;
        noteGain.gain.setValueAtTime(initialVol, now);
        noteGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.55);

        osc.connect(noteGain);
        noteGain.connect(masterGain);

        osc.start(now);
        osc.stop(now + 0.6);
      });
    } else if (type === 'pop') {
      // Bubbly modern pop
      const osc = ctx.createOscillator();
      const popGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(950, now + 0.06);

      popGain.gain.setValueAtTime(0.85, now);
      popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(popGain);
      popGain.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'bell') {
      // Warm subtle marimba / bell chime
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.05);

        gain.gain.setValueAtTime(0, now + i * 0.05);
        gain.gain.linearRampToValueAtTime(0.6, now + i * 0.05 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.35);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(now + i * 0.05);
        osc.stop(now + i * 0.05 + 0.4);
      });
    }
  } catch (err) {
    console.warn('Unable to play notification sound:', err);
  }
}
