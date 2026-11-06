import { normalize } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveHelperEntry } from '../helper/paths'

const base = {
  resourcesPath: normalize('/app/resources'),
  appPath: normalize('/repo/apps/desktop'),
}

describe('resolveHelperEntry', () => {
  it('packaged -> the asarUnpack-ed helper entry under resourcesPath', () => {
    expect(resolveHelperEntry({ ...base, isPackaged: true })).toBe(
      normalize('/app/resources/app.asar.unpacked/out/helper/index.js'),
    )
  })

  it('dev -> <appPath>/out/helper/index.js', () => {
    expect(resolveHelperEntry({ ...base, isPackaged: false })).toBe(
      normalize('/repo/apps/desktop/out/helper/index.js'),
    )
  })
})
