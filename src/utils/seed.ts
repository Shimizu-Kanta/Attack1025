export const createDefaultSeed = (): string => {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replaceAll('-', '')
  const time = now.toTimeString().slice(0, 8).replaceAll(':', '')
  return `attack1025-${date}-${time}`
}

export const hashSeed = (seed: string): number => {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export const seededRandom = (seed: string): (() => number) => {
  let state = hashSeed(seed)
  return () => {
    state = (1664525 * state + 1013904223) >>> 0
    return state / 0x100000000
  }
}
