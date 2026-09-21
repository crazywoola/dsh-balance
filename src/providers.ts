/** Browser-safe provider metadata. Credentials and wire parsers stay on the Host. */
export const BALANCE_PROVIDERS = [
  { id: 'deepseek', name: 'DeepSeek', apiKeyRef: 'DEEPSEEK_API_KEY', baseUrl: 'https://api.deepseek.com' },
  { id: 'stepfun', name: 'StepFun', apiKeyRef: 'STEPFUN_API_KEY', baseUrl: 'https://api.stepfun.com/v1' },
] as const

export type BalanceProviderId = typeof BALANCE_PROVIDERS[number]['id']

export function findBalanceProvider(id: string) {
  return BALANCE_PROVIDERS.find(provider => provider.id === id.trim().toLowerCase())
}
