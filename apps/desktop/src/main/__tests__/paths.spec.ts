import { normalize } from 'node:path'
import { describe, expect, it } from 'vitest'
import { bootstrapDataDir, dataPaths } from '../paths'

describe('dataPaths', () => {
  it('derives the home/profiles/active/state layout under userData', () => {
    const p = dataPaths(normalize('/u/data'))
    expect(p).toEqual({
      homeDir: normalize('/u/data/mihomo-home'),
      profilesDir: normalize('/u/data/mihomo-home/profiles'),
      activeConfigPath: normalize('/u/data/mihomo-home/config.yaml'),
      stateFile: normalize('/u/data/mihomo-home/state.json'),
    })
  })
})

function fakeFs(existing: Set<string>) {
  const writes: Record<string, string> = {}
  const made: string[] = []
  return {
    writes,
    made,
    io: {
      existsSync: (p: string) => existing.has(p),
      mkdirSync: (p: string) => {
        made.push(p)
        existing.add(p)
      },
      readFileSync: (p: string) => {
        if (p === normalize('/res/default-config.yaml'))
          return 'mixed-port: 7890\n'
        throw new Error(`unexpected read ${p}`)
      },
      writeFileSync: (p: string, data: string) => {
        writes[p] = data
        existing.add(p)
      },
    },
  }
}

describe('bootstrapDataDir', () => {
  it('creates dirs and copies default config on first run', () => {
    const { io, writes, made } = fakeFs(new Set())
    const result = bootstrapDataDir(
      normalize('/u/data'),
      normalize('/res/default-config.yaml'),
      io,
    )

    expect(made).toContain(normalize('/u/data/mihomo-home'))
    expect(made).toContain(normalize('/u/data/mihomo-home/profiles'))
    expect(writes[normalize('/u/data/mihomo-home/config.yaml')]).toBe(
      'mixed-port: 7890\n',
    )
    expect(result.copiedDefault).toBe(true)
    expect(result.activeConfigPath).toBe(
      normalize('/u/data/mihomo-home/config.yaml'),
    )
  })

  it('does NOT overwrite an existing active config (idempotent)', () => {
    const existing = new Set([
      normalize('/u/data/mihomo-home'),
      normalize('/u/data/mihomo-home/profiles'),
      normalize('/u/data/mihomo-home/config.yaml'),
    ])
    const { io, writes } = fakeFs(existing)
    const result = bootstrapDataDir(
      normalize('/u/data'),
      normalize('/res/default-config.yaml'),
      io,
    )

    expect(writes[normalize('/u/data/mihomo-home/config.yaml')]).toBeUndefined()
    expect(result.copiedDefault).toBe(false)
  })
})
