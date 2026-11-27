import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const root = new URL('../', import.meta.url)
const readme = readFileSync(new URL('./README.md', root), 'utf8')
const readmeEn = readFileSync(new URL('./README_EN.md', root), 'utf8')
const estimatesZh = readFileSync(new URL('./docs/estimates.md', root), 'utf8')
const estimatesEn = readFileSync(new URL('./docs/estimates.en.md', root), 'utf8')
const preview = readFileSync(new URL('./scripts/preview/main.jsx', root), 'utf8')

describe('advisor documentation', () => {
  it('links the estimates guide from both READMEs and keeps the four next steps in sync', () => {
    expect(readme).toContain('./docs/estimates.md')
    expect(readmeEn).toContain('./docs/estimates.en.md')
    for (const body of [estimatesZh, estimatesEn, readme, readmeEn]) {
      expect(body).toMatch(/\/compact/)
      expect(body).toContain('dsh_balance_advise')
      expect(body).toContain('/dsh-balance/api/advice')
    }
  })

  it('embeds current advisor and session drill-down screenshots', () => {
    expect(readme).toContain('./docs/dsh-advisor-card.png')
    expect(readme).toContain('./docs/dsh-session-drilldown.png')
    expect(readmeEn).toContain('./docs/dsh-advisor-card-en.png')
    expect(readmeEn).toContain('./docs/dsh-session-drilldown-en.png')
    for (const relative of [
      'docs/dsh-advisor-card.png',
      'docs/dsh-session-drilldown.png',
      'docs/dsh-advisor-card-en.png',
      'docs/dsh-session-drilldown-en.png',
    ]) {
      expect(existsSync(new URL(relative, root)), relative).toBe(true)
    }
  })

  it('embeds the narrow dark-theme screenshots', () => {
    for (const name of ['advisor-dark-narrow-zh-tw', 'usage-dark-narrow-zh-tw']) {
      expect(readme).toContain(`./docs/dsh-${name}.png`)
      expect(existsSync(new URL(`docs/dsh-${name}.png`, root)), name).toBe(true)
    }
    for (const name of ['advisor-dark-narrow-en', 'usage-dark-narrow-en']) {
      expect(readmeEn).toContain(`./docs/dsh-${name}.png`)
      expect(existsSync(new URL(`docs/dsh-${name}.png`, root)), name).toBe(true)
    }
  })

  it('keeps the preview fixture aligned with the four-way advisor', () => {
    expect(preview).toMatch(/compact:\s*estimate\(/)
    expect(preview).toContain('compact-assumptions')
    expect(preview).toContain('sampleLimit: 8')
  })
})
