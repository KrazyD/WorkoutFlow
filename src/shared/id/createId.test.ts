// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createId } from './createId'

const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'crypto',
)

const setCrypto = (crypto: Partial<Crypto> | undefined) => {
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: crypto,
  })
}

const createGetRandomValues = (fill: (bytes: Uint8Array) => void) =>
  vi.fn((array: ArrayBufferView) => {
    const bytes = new Uint8Array(
      array.buffer,
      array.byteOffset,
      array.byteLength,
    )
    fill(bytes)
    return array
  }) as Crypto['getRandomValues']

afterEach(() => {
  vi.restoreAllMocks()

  if (originalCryptoDescriptor) {
    Object.defineProperty(globalThis, 'crypto', originalCryptoDescriptor)
  } else {
    Reflect.deleteProperty(globalThis, 'crypto')
  }
})

describe('createId', () => {
  it('uses crypto.randomUUID when it is available', () => {
    const randomUUID = vi.fn(
      (): `${string}-${string}-${string}-${string}-${string}` =>
        '12345678-1234-4123-8123-123456789abc',
    )
    setCrypto({ randomUUID })

    expect(createId()).toBe('12345678-1234-4123-8123-123456789abc')
    expect(randomUUID).toHaveBeenCalledOnce()
  })

  it('uses getRandomValues when randomUUID is unavailable', () => {
    const getRandomValues = createGetRandomValues((bytes) => bytes.fill(0xab))
    setCrypto({ getRandomValues })

    expect(createId()).toBe('abababab-abab-4bab-abab-abababababab')
    expect(getRandomValues).toHaveBeenCalledOnce()
  })

  it('returns a UUID v4 with a valid variant from the fallback', () => {
    setCrypto({
      getRandomValues: createGetRandomValues((bytes) => bytes.fill(0xff)),
    })

    const id = createId()

    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
    expect(id[14]).toBe('4')
    expect(['8', '9', 'a', 'b']).toContain(id[19])
  })

  it('returns different values on sequential fallback calls', () => {
    let fillValue = 0
    setCrypto({
      getRandomValues: createGetRandomValues((bytes) => {
        bytes.fill(fillValue)
        fillValue += 1
      }),
    })

    const firstId = createId()
    const secondId = createId()

    expect(firstId).not.toBe(secondId)
    expect(firstId).not.toBe('')
    expect(secondId).not.toBe('')
  })

  it('works without window or a crypto object', () => {
    expect('window' in globalThis).toBe(false)
    setCrypto(undefined)
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValue(0.5)

    expect(createId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })

  it('falls back to Math.random when Web Crypto has no random functions', () => {
    setCrypto({})
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.25)

    const id = createId()

    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
    expect(random).toHaveBeenCalledTimes(16)
  })
})
