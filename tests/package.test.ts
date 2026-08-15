import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as {
  name?: unknown
  dsh?: { client?: { inject?: unknown[] } }
  peerDependencies?: Record<string, unknown>
}
const cordisPatch = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
const clientSource = readFileSync(new URL('../src/client/index.tsx', import.meta.url), 'utf8')

describe('published package metadata', () => {
  it('loads the scoped package from the Cordis patch', () => {
    expect(packageJson.name).toBe('@pinkbanana/dsh-balance')
    expect(cordisPatch).toContain("name: '@pinkbanana/dsh-balance'")
    expect(cordisPatch).not.toMatch(/^\s+name: dsh-balance$/m)
  })

  it('uses standalone Settings and composer-dock surfaces', () => {
    expect(packageJson.dsh?.client?.inject).toContain('@deepseek-ai/dsh-client-ui-conversation')
    expect(packageJson.dsh?.client?.inject).not.toContain('@deepseek-ai/dsh-client-ui-settings-plugins')
    expect(packageJson.peerDependencies).toHaveProperty('@deepseek-ai/dsh-client-ui-conversation')
    expect(packageJson.peerDependencies).not.toHaveProperty('@deepseek-ai/dsh-client-ui-settings-plugins')
    expect(clientSource).toContain("ctx.slots.inject('settings.section'")
    expect(clientSource).toContain("ctx.slots.inject('conversation.composer.dock'")
    expect(clientSource).not.toContain('settings.plugins.tab')
  })
})
