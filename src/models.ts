import type { ApiErrorCode, ModelInfo } from './types.ts'
import { findBalanceProvider } from './providers.ts'

interface ModelsPayload {
  models: ModelInfo[]
}

/** A safe, classified model-list failure suitable for the Host boundary. */
export class ModelQueryError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly httpStatus: number,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'ModelQueryError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(row: Record<string, unknown>, key: string): string {
  const value = row[key]
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ModelQueryError('INVALID_RESPONSE', `Model response has an invalid ${key}`, 502)
  }
  return value
}

/** Shared Model object returned by both list and retrieve APIs. */
export function parseModel(value: unknown): ModelInfo {
  if (!isRecord(value) || value.object !== 'model') {
    throw new ModelQueryError('INVALID_RESPONSE', '提供方返回了无效的模型条目', 502)
  }
  const created = value.created
  if (created !== undefined && (typeof created !== 'number' || !Number.isSafeInteger(created) || created < 0 || created > 8_640_000_000_000)) {
    throw new ModelQueryError('INVALID_RESPONSE', '提供方返回了无效的模型创建时间', 502)
  }
  return {
    id: requiredString(value, 'id'),
    ownedBy: requiredString(value, 'owned_by'),
    ...(created === undefined ? {} : { created }),
  }
}

/** Parse the documented `{ object: "list", data: Model[] }` response. */
export function parseModels(value: unknown): ModelsPayload {
  if (!isRecord(value) || value.object !== 'list' || !Array.isArray(value.data)) {
    throw new ModelQueryError('INVALID_RESPONSE', '提供方返回了无效的模型列表', 502)
  }
  return { models: value.data.map(parseModel) }
}

function modelsEndpoint(baseUrl: string): URL {
  const normalized = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return new URL('models', normalized)
}

function upstreamFailure(status: number, provider: string): ModelQueryError {
  if (status === 401 || status === 403) {
    return new ModelQueryError('INVALID_API_KEY', `${provider} API 密钥无效或无权查询模型`, 401)
  }
  if (status === 429) {
    return new ModelQueryError('RATE_LIMITED', `${provider} API 请求过于频繁，请稍后重试`, 429)
  }
  if (status >= 500) {
    return new ModelQueryError('UPSTREAM_UNAVAILABLE', `${provider} API 暂时不可用，请稍后重试`, 502)
  }
  return new ModelQueryError('UPSTREAM_ERROR', `${provider} API 返回了 HTTP ${status}`, 502)
}

export interface QueryModelsOptions {
  apiKey: string
  baseUrl: string
  timeoutMs: number
  fetchImpl?: typeof fetch
}

/** Query the official `/models` endpoint with Bearer authentication and strict validation. */
export async function queryProviderModels(providerId: string, options: QueryModelsOptions): Promise<ModelsPayload> {
  const provider = findBalanceProvider(providerId)
  if (provider === undefined) throw new ModelQueryError('UNSUPPORTED_PROVIDER', '不支持此提供方的模型查询', 400)
  const fetchImpl = options.fetchImpl ?? fetch
  let response: Response
  try {
    response = await fetchImpl(modelsEndpoint(options.baseUrl), {
      method: 'GET',
      redirect: 'error',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${options.apiKey}`,
      },
      signal: AbortSignal.timeout(options.timeoutMs),
    })
  } catch (error) {
    if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
      throw new ModelQueryError('UPSTREAM_TIMEOUT', `查询 ${provider.name} 模型列表超时`, 504, { cause: error })
    }
    throw new ModelQueryError('UPSTREAM_UNAVAILABLE', `无法连接到 ${provider.name} API`, 502, { cause: error })
  }

  if (!response.ok) throw upstreamFailure(response.status, provider.name)

  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
      throw new ModelQueryError('UPSTREAM_TIMEOUT', `查询 ${provider.name} 模型列表超时`, 504, { cause: error })
    }
    throw new ModelQueryError('INVALID_RESPONSE', `${provider.name} 返回了无法解析的模型列表`, 502, { cause: error })
  }
  return parseModels(payload)
}

/** Backward-compatible entry points for DeepSeek consumers. */
export const parseDeepSeekModels = parseModels
export function queryDeepSeekModels(options: QueryModelsOptions): Promise<ModelsPayload> {
  return queryProviderModels('deepseek', options)
}
