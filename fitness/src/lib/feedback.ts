import { getState } from './store'

/**
 * Audio and spoken cues. iOS Safari does not support the Vibration API, so cues are
 * sounds (Web Audio) and optional speech. The audio context is unlocked on first tap.
 */
let ctx: AudioContext | null = null

export function unlockAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
  } catch {
    ctx = null
  }
}

export function beep(kind: 'tick' | 'go' | 'done' = 'tick') {
  const s = getState().settings
  if (!s.sound) return
  try {
    unlockAudio()
    if (!ctx) return
    const now = ctx.currentTime
    const tones = kind === 'tick' ? [[880, 0.08]] : kind === 'go' ? [[660, 0.12], [990, 0.18]] : [[523, 0.12], [659, 0.12], [784, 0.22]]
    let t = now
    for (const [freq, dur] of tones) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = freq
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      o.connect(g).connect(ctx.destination)
      o.start(t)
      o.stop(t + dur + 0.02)
      t += dur + 0.03
    }
  } catch {
    /* audio unavailable */
  }
  if (getState().settings.haptics && 'vibrate' in navigator) {
    try {
      navigator.vibrate(kind === 'tick' ? 30 : 80)
    } catch {
      /* unsupported */
    }
  }
}

export function speak(text: string) {
  if (!getState().settings.voice || !('speechSynthesis' in window)) return
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 1.02
    window.speechSynthesis.speak(u)
  } catch {
    /* ignore */
  }
}
