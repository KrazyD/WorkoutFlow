const UUID_BYTE_LENGTH = 16

const createRandomBytes = (): Uint8Array => {
  const bytes = new Uint8Array(UUID_BYTE_LENGTH)
  const crypto = globalThis.crypto

  if (typeof crypto?.getRandomValues === 'function') {
    return crypto.getRandomValues(bytes)
  }

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256)
  }

  return bytes
}

const formatUuidV4 = (bytes: Uint8Array): string => {
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-')
}

export function createId(): string {
  const crypto = globalThis.crypto

  if (typeof crypto?.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return formatUuidV4(createRandomBytes())
}
