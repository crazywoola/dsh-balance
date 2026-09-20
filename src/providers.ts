/** Browser-safe provider metadata. Credentials and wire parsers stay on the Host. */
export const BALANCE_PROVIDERS = [
  { id: 'deepseek', name: 'DeepSeek', apiKeyRef: 'DEEPSEEK_API_KEY', baseUrl: 'https://api.deepseek.com' },
  { id: 'stepfun', name: 'StepFun', apiKeyRef: 'STEPFUN_API_KEY', baseUrl: 'https://api.stepfun.com/v1' },
  { id: 'tokener', name: 'Tokener', apiKeyRef: 'TOKENER_API_KEY', baseUrl: 'https://api.tokener.ai/v1', balanceApiKeyRef: 'TOKENER_MANAGEMENT_TOKEN', balanceBaseUrl: 'https://console.tokener.ai/api/v1' },
] as const

export type BalanceProviderId = typeof BALANCE_PROVIDERS[number]['id']

export function findBalanceProvider(id: string) {
  return BALANCE_PROVIDERS.find(provider => provider.id === id.trim().toLowerCase())
}

/** Management APIs may use a separate credential and origin from inference APIs. */
export function balanceDefaults(provider: typeof BALANCE_PROVIDERS[number]) {
  return {
    apiKeyRef: 'balanceApiKeyRef' in provider ? provider.balanceApiKeyRef : provider.apiKeyRef,
    baseUrl: 'balanceBaseUrl' in provider ? provider.balanceBaseUrl : provider.baseUrl,
  }
}
