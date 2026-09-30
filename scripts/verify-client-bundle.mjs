import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const clientBundle = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
const registrations = []

runInNewContext(clientBundle, {
  window: { __ModuleLoader__: { load: entry => registrations.push(entry) } },
}, { filename: 'client.js', timeout: 1000 })

assert.equal(registrations.length, 1, 'client bundle must register exactly one module')
const registration = registrations[0]
assert.equal(registration.id, packageJson.name)
const client = registration.factory(createRequire(import.meta.url))
assert.equal(typeof client.apply, 'function', 'client factory must export its plugin entry')
assert.deepEqual(Array.from(client.inject), ['slots', 'locale', 'modelDirectories'])

process.stdout.write(`verified executable client ModuleLoader factory: ${packageJson.name}\n`)
