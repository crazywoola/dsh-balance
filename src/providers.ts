/** Browser-safe provider metadata. Credentials and wire parsers stay on the Host. */
export const BALANCE_PROVIDERS = [
  { id: 'deepseek', aliases: ['deepseek-official'], name: 'DeepSeek', apiKeyRef: 'DEEPSEEK_API_KEY', baseUrl: 'https://api.deepseek.com' },
  { id: 'stepfun', aliases: [], name: 'StepFun', apiKeyRef: 'STEPFUN_API_KEY', baseUrl: 'https://api.stepfun.com/v1' },
] as const

export type BalanceProviderId = typeof BALANCE_PROVIDERS[number]['id']

export function findBalanceProvider(id: string) {
  const normalized = id.trim().toLowerCase()
  return BALANCE_PROVIDERS.find(provider => provider.id === normalized || provider.aliases.some(alias => alias === normalized))
}
