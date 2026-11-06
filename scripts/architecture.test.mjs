import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
const packages = {
  'packages/config-editor': ['config-editor', []],
  'packages/agent': ['agent', ['config-editor']],
  'packages/ui': ['ui', ['config-editor']],
  'apps/server': ['server', ['agent']],
  'apps/desktop': ['desktop', ['agent']],
}
function check(files) {
  const root = mkdtempSync(join(tmpdir(), 'workspace-architecture-'))
  try {
    for (const [dir, [name, deps]] of Object.entries(packages)) {
      mkdirSync(join(root, dir), { recursive: true })
      writeFileSync(
        join(root, dir, 'package.json'),
        JSON.stringify({
          name: '@metacubexd/' + name,
          dependencies: Object.fromEntries(
            deps.map((d) => ['@metacubexd/' + d, 'workspace:*']),
          ),
          exports: { '.': './src/index.ts' },
        }),
      )
    }
    for (const [name, source] of Object.entries(files)) {
      const f = join(root, name)
      mkdirSync(dirname(f), { recursive: true })
      writeFileSync(f, source)
    }
    return spawnSync(
      process.execPath,
      ['scripts/check-architecture.mjs', root],
      { encoding: 'utf8' },
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}
test('accepts declared public imports and ignores comments', () => {
  const r = check({
    'packages/ui/composables/a.ts':
      "import type { X } from '@metacubexd/config-editor'; // import '@metacubexd/agent'",
  })
  assert.equal(r.status, 0, r.stderr)
})
test('rejects privileged workspace imports in UI', () => {
  const r = check({ 'packages/ui/a.ts': "import '@metacubexd/agent'" })
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /forbidden workspace/)
})
test('rejects relative cross-workspace imports', () => {
  const r = check({ 'packages/ui/a.ts': "import '../agent/src/index'" })
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /relative import crosses/)
})
test('rejects unexported shared package subpaths', () => {
  const r = check({
    'packages/ui/a.ts':
      "type X=import('@metacubexd/config-editor/src/private').X",
  })
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /declared export/)
})
test('Vue generic script attributes use the SFC parser', () => {
  const r = check({
    'packages/ui/components/a.vue':
      '<script setup lang="ts" generic="T extends Record<string, unknown>">import type { X } from "@metacubexd/config-editor"</script>',
  })
  assert.equal(r.status, 0, r.stderr)
})
