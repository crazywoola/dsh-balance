import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { name?: unknown }
const cordisPatch = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8')

describe('published package metadata', () => {
  it('loads the scoped package from the Cordis patch', () => {
    expect(packageJson.name).toBe('@pinkbanana/dsh-balance')
    expect(cordisPatch).toContain("name: '@pinkbanana/dsh-balance'")
    expect(cordisPatch).not.toMatch(/^\s+name: dsh-balance$/m)
  })
})
