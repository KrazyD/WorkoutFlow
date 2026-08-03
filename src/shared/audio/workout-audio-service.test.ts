import { afterEach, describe, expect, it, vi } from 'vitest'

interface FakeNode {
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}

const contexts: FakeAudioContext[] = []

class FakeAudioContext {
  state: AudioContextState = 'suspended'
  currentTime = 10
  destination = {}
  resume = vi.fn(async () => { this.state = 'running' })
  oscillators: Array<FakeNode & { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }> = []
  gains: FakeNode[] = []

  constructor() { contexts.push(this) }

  createGain() {
    const node = {
      connect: vi.fn(), disconnect: vi.fn(),
      gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    }
    this.gains.push(node)
    return node
  }

  createOscillator() {
    const node = {
      connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(),
      addEventListener: vi.fn(), type: 'sine', frequency: { setValueAtTime: vi.fn() },
    }
    this.oscillators.push(node)
    return node
  }
}

const loadService = async () => {
  vi.resetModules()
  return (await import('./workout-audio-service')).workoutAudioService
}

afterEach(() => {
  contexts.length = 0
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('workout audio service', () => {
  it('reports unsupported without Web Audio API', async () => {
    vi.stubGlobal('AudioContext', undefined)
    expect((await loadService()).isSupported()).toBe(false)
  })

  it('creates lazily, resumes, and reuses an active context', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const service = await loadService()
    expect(contexts).toHaveLength(0)
    expect((await service.prepare()).success).toBe(true)
    expect(contexts).toHaveLength(1)
    expect(contexts[0]?.resume).toHaveBeenCalledOnce()
    await service.prepare()
    expect(contexts).toHaveLength(1)
  })

  it('creates two bounded oscillator tones and one gain node', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const service = await loadService()
    expect((await service.playRestFinishedSignal()).success).toBe(true)
    const context = contexts[0]
    expect(context?.oscillators).toHaveLength(2)
    expect(context?.gains).toHaveLength(1)
    expect(context?.oscillators[0]?.stop).toHaveBeenCalledWith(10.19)
    expect(context?.oscillators[1]?.stop.mock.calls[0]?.[0]).toBeCloseTo(10.46)
  })

  it('contains constructor errors and replaces a closed context', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    class BrokenAudioContext { constructor() { throw new Error('blocked') } }
    vi.stubGlobal('AudioContext', BrokenAudioContext)
    expect((await (await loadService()).prepare()).success).toBe(false)

    vi.stubGlobal('AudioContext', FakeAudioContext)
    const service = await loadService()
    await service.prepare()
    if (contexts[0]) contexts[0].state = 'closed'
    await service.prepare()
    expect(contexts).toHaveLength(2)
  })
})
