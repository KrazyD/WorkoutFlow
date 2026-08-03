export interface AudioActionResult {
  readonly success: boolean
  readonly error?: unknown
}

export interface WorkoutAudioService {
  isSupported(): boolean
  prepare(): Promise<AudioActionResult>
  playRestFinishedSignal(): Promise<AudioActionResult>
}

type AudioContextConstructor = new () => AudioContext

const getAudioContextConstructor = (): AudioContextConstructor | undefined => {
  if (typeof window === 'undefined') return undefined
  return window.AudioContext
}

class WebWorkoutAudioService implements WorkoutAudioService {
  private context?: AudioContext

  isSupported(): boolean {
    return Boolean(getAudioContextConstructor())
  }

  private getContext(): AudioContext | undefined {
    if (this.context?.state === 'closed') this.context = undefined
    if (!this.context) {
      const AudioContextClass = getAudioContextConstructor()
      if (AudioContextClass) this.context = new AudioContextClass()
    }
    return this.context
  }

  async prepare(): Promise<AudioActionResult> {
    try {
      const context = this.getContext()
      if (!context) return { success: false, error: new Error('Web Audio API is unavailable.') }
      if (context.state !== 'running') await context.resume()
      return context.state === 'running'
        ? { success: true }
        : { success: false, error: new Error(`AudioContext is ${context.state}.`) }
    } catch (error) {
      console.warn('Could not prepare workout audio.', error)
      return { success: false, error }
    }
  }

  async playRestFinishedSignal(): Promise<AudioActionResult> {
    const prepared = await this.prepare()
    if (!prepared.success) return prepared

    try {
      const context = this.context
      if (!context) return { success: false }
      const start = context.currentTime
      const gain = context.createGain()
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.12, start + 0.015)
      gain.gain.setValueAtTime(0.12, start + 0.12)
      gain.gain.linearRampToValueAtTime(0, start + 0.18)
      gain.gain.setValueAtTime(0, start + 0.27)
      gain.gain.linearRampToValueAtTime(0.12, start + 0.285)
      gain.gain.setValueAtTime(0.12, start + 0.39)
      gain.gain.linearRampToValueAtTime(0, start + 0.46)
      gain.connect(context.destination)

      for (const [offset, frequency] of [[0, 880], [0.27, 1046]] as const) {
        const oscillator = context.createOscillator()
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(frequency, start + offset)
        oscillator.connect(gain)
        oscillator.start(start + offset)
        oscillator.stop(start + offset + 0.19)
        oscillator.addEventListener('ended', () => oscillator.disconnect(), { once: true })
      }
      window.setTimeout(() => gain.disconnect(), 550)
      return { success: true }
    } catch (error) {
      console.warn('Could not play the rest-finished signal.', error)
      return { success: false, error }
    }
  }
}

export const workoutAudioService: WorkoutAudioService = new WebWorkoutAudioService()

