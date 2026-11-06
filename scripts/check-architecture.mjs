import { createRequire } from 'node:module'
import { parse } from '@babel/parser'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const toolRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = process.argv[2] ? resolve(process.argv[2]) : toolRoot

const { parse: parseVue } = createRequire(
  resolve(toolRoot, 'packages/ui/package.json'),
)('vue/compiler-sfc')
const dirs = [
  'packages/config-editor',
  'packages/agent',
  'packages/ui',
  'apps/server',
  'apps/desktop',
]
const allowed = {
  '@metacubexd/config-editor': [],
  '@metacubexd/agent': ['@metacubexd/config-editor'],
  '@metacubexd/ui': ['@metacubexd/config-editor'],
  '@metacubexd/server': ['@metacubexd/agent'],
  '@metacubexd/desktop': ['@metacubexd/agent'],
}
const packages = dirs.map((d) => ({
  dir: resolve(root, d),
  ...JSON.parse(readFileSync(resolve(root, d, 'package.json'), 'utf8')),
}))
const skip = new Set([
  'node_modules',
  '.nuxt',
  '.nitro',
  '.output',
  'out',
  'renderer',
  'dist',
  'coverage',
  'build',
  'resources',
  '__tests__',
  'e2e',
  'test',
  'scripts',
])
const walk = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? skip.has(e.name)
        ? []
        : walk(resolve(d, e.name))
      : [resolve(d, e.name)],
  )
let count = 0
for (const pkg of packages) {
  const fail = (f, m) => {
    throw new Error(relative(root, f) + ': ' + m)
  }
  for (const name of Object.keys({
    ...pkg.dependencies,
    ...pkg.devDependencies,
  }).filter((n) => n.startsWith('@metacubexd/')))
    if (!allowed[pkg.name].includes(name))
      fail(pkg.dir, 'forbidden workspace dependency ' + name)
  for (const file of walk(pkg.dir).filter(
    (f) =>
      /\.(?:ts|vue)$/.test(f) &&
      !f.endsWith('.d.ts') &&
      !f.endsWith('.config.ts') &&
      !/\.(?:test|spec)\.ts$/.test(f),
  )) {
    let source = readFileSync(file, 'utf8')
    if (file.endsWith('.vue')) {
      const { descriptor } = parseVue(source, { filename: file })
      source = [descriptor.script?.content, descriptor.scriptSetup?.content]
        .filter(Boolean)
        .join('\n')
    }
    let tree
    try {
      tree = parse(source, {
        sourceType: 'module',
        plugins: ['typescript', 'decorators-legacy'],
        createImportExpressions: true,
      })
    } catch (error) {
      fail(file, error.message)
    }
    count++
    const visit = (node) => {
      let spec
      if (
        [
          'ImportDeclaration',
          'ExportNamedDeclaration',
          'ExportAllDeclaration',
        ].includes(node.type) &&
        node.source
      )
        spec = node.source.value
      if (node.type === 'TSImportType')
        spec = (node.argument ?? node.source).value
      if (node.type === 'ImportExpression') {
        if (node.source.type !== 'StringLiteral')
          fail(file, 'dynamic import must be literal')
        spec = node.source.value
      }
      if (typeof spec === 'string') {
        if (spec.startsWith('@metacubexd/')) {
          const target = packages.find(
            (p) => spec === p.name || spec.startsWith(p.name + '/'),
          )
          if (!target || !allowed[pkg.name].includes(target.name))
            fail(file, 'forbidden workspace import ' + spec)
          const sub =
            spec === target.name
              ? '.'
              : './' + spec.slice(target.name.length + 1)
          if (!target.exports?.[sub])
            fail(file, 'workspace import must use a declared export ' + spec)
          if (
            !pkg.dependencies?.[target.name] &&
            !pkg.devDependencies?.[target.name]
          )
            fail(file, 'undeclared workspace dependency ' + spec)
        }
        if (spec.startsWith('.')) {
          const target = resolve(dirname(file), spec)
          const owner = packages.find(
            (p) =>
              target === p.dir ||
              target.startsWith(p.dir + '/') ||
              target.startsWith(p.dir + '\\'),
          )
          if (owner && owner.name !== pkg.name)
            fail(file, 'relative import crosses workspace; use public exports')
        }
        if (
          (pkg.name === '@metacubexd/ui' ||
            pkg.name === '@metacubexd/config-editor') &&
          (spec.startsWith('node:') || spec === 'electron')
        )
          fail(file, 'browser/pure package imports privileged runtime ' + spec)
      }
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) {
          for (const child of value)
            if (child && typeof child === 'object' && child.type) visit(child)
        } else if (value && typeof value === 'object' && value.type)
          visit(value)
      }
    }
    visit(tree)
  }
}
console.log(
  'Workspace architecture passed:',
  count,
  'modules; public exports and declared directed package graph',
)
