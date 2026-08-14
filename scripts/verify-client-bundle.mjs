import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const clientBundle = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
const expectedRegistration = `id: ${JSON.stringify(packageJson.name)}`

if (!clientBundle.includes(expectedRegistration)) {
  throw new Error(`client bundle does not register ${packageJson.name} via ModuleLoader.load`)
}

process.stdout.write(`verified client ModuleLoader id: ${packageJson.name}\n`)
