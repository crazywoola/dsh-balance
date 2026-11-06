import { readFileSync } from 'node:fs'
import { satisfies, valid } from 'semver'
import { describe, expect, it } from 'vitest'

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as {
  name?: unknown
  dsh?: { client?: { inject?: unknown[] } }
  engines?: { dsh?: string }
  peerDependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}
const cordisPatch = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
const clientSource = readFileSync(new URL('../src/client/index.tsx', import.meta.url), 'utf8')
const dshPeers = Object.entries(packageJson.peerDependencies ?? {})
  .filter(([name]) => name.startsWith('@deepseek-ai/dsh-'))
const dshRanges = [
  ['engines.dsh', packageJson.engines?.dsh ?? ''],
  ...dshPeers,
] as const
// DSH's compatibility gate opts prereleases into semver range matching.
const dshSemverOptions = { includePrerelease: true }

describe('published package metadata', () => {
  it('keeps reproducible development pins within the declared runtime range', () => {
    expect(packageJson.engines?.dsh).toBeTruthy()
    expect(dshPeers).not.toHaveLength(0)
    for (const [name, range] of dshPeers) {
      const version = packageJson.devDependencies?.[name] ?? ''
      expect(range, name).toBe(packageJson.engines?.dsh)
      expect(valid(version), name).toBe(version)
      expect(satisfies(version, range, dshSemverOptions), name).toBe(true)
    }
  })

  it.each([
    '0.2.2-rc.1', '0.2.2-rc.2', '0.2.2',
    '0.2.3-rc.1', '0.2.3', '0.3.0-rc.1', '0.3.0', '0.9.0-rc.1', '0.99.0',
  ])('admits DSH %s without an exact-version exemption', (version) => {
    for (const [name, range] of dshRanges) {
      expect(satisfies(version, range, dshSemverOptions), name).toBe(true)
    }
  })

  it.each([
    '0.1.0', '0.2.1-rc.5', '0.2.1', '0.2.2-rc.0',
    '1.0.0-alpha.1', '1.0.0-rc.1', '1.0.0', '2.0.0',
  ])('keeps DSH %s outside the supported range', (version) => {
    for (const [name, range] of dshRanges) {
      expect(satisfies(version, range, dshSemverOptions), name).toBe(false)
    }
  })

  it('accepts later Cordis 4.x versions while retaining the 4.1 minimum', () => {
    const range = packageJson.peerDependencies?.['@deepseek-ai/cordis'] ?? ''
    for (const version of ['4.1.0', '4.1.1', '4.2.0', '4.99.0']) {
      expect(satisfies(version, range), version).toBe(true)
    }
    for (const version of ['4.0.5', '5.0.0']) {
      expect(satisfies(version, range), version).toBe(false)
    }
  })

  it('loads the scoped package from the Cordis patch', () => {
    expect(packageJson.name).toBe('@pinkbanana/dsh-balance')
    expect(cordisPatch).toContain("name: '@pinkbanana/dsh-balance'")
    expect(cordisPatch).not.toMatch(/^\s+name: dsh-balance$/m)
  })

  it('uses native sidebar, main, Settings, and composer-dock surfaces', () => {
    expect(packageJson.dsh?.client?.inject).toContain('@deepseek-ai/dsh-client-ui-conversation')
    expect(packageJson.dsh?.client?.inject).not.toContain('@deepseek-ai/dsh-client-ui-settings-plugins')
    expect(packageJson.peerDependencies).toHaveProperty('@deepseek-ai/dsh-client-ui-conversation')
    expect(packageJson.peerDependencies).not.toHaveProperty('@deepseek-ai/dsh-client-ui-settings-plugins')
    expect(packageJson.dsh?.client?.inject).toContain('@deepseek-ai/dsh-client-ui-layout')
    expect(packageJson.dsh?.client?.inject).toContain('@deepseek-ai/dsh-client-ui-sidebar')
    expect(clientSource).toContain("ctx.slots.inject('main'")
    expect(clientSource).toContain("ctx.slots.inject('sidebar.panellist'")
    expect(clientSource).toContain("ctx.slots.inject('settings.section'")
    expect(clientSource).toContain("ctx.slots.inject('conversation.composer.dock'")
    expect(clientSource).not.toContain('settings.plugins.tab')
  })
})
