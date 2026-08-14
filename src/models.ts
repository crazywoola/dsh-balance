import type { DeepSeekApiErrorCode, ModelInfo } from './types.ts'

interface DeepSeekModelsPayload {
  models: ModelInfo[]
}

/** A safe, classified model-list failure suitable for the Host boundary. */
export class ModelQueryError extends Error {
  constructor(
    readonly code: DeepSeekApiErrorCode,
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
    throw new ModelQueryError('INVALID_RESPONSE', `DeepSeek model response has an invalid ${key}`, 502)
  }
  return value
}

/** Parse the documented `{ object: "list", data: Model[] }` response. */
export function parseDeepSeekModels(value: unknown): DeepSeekModelsPayload {
  if (!isRecord(value) || value.object !== 'list' || !Array.isArray(value.data)) {
    throw new ModelQueryError('INVALID_RESPONSE', 'DeepSeek 返回了无效的模型列表', 502)
  }

  const models = value.data.map((item): ModelInfo => {
    if (!isRecord(item) || item.object !== 'model') {
      throw new ModelQueryError('INVALID_RESPONSE', 'DeepSeek 返回了无效的模型条目', 502)
    }
    return {
      id: requiredString(item, 'id'),
      ownedBy: requiredString(item, 'owned_by'),
    }
  })

  return { models }
}

function modelsEndpoint(baseUrl: string): URL {
  const normalized = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return new URL('models', normalized)
}

function upstreamFailure(status: number): ModelQueryError {
  if (status === 401 || status === 403) {
    return new ModelQueryError('INVALID_API_KEY', 'DeepSeek API 密钥无效或无权查询模型', 401)
  }
  if (status === 429) {
    return new ModelQueryError('RATE_LIMITED', 'DeepSeek API 请求过于频繁，请稍后重试', 429)
  }
  if (status >= 500) {
    return new ModelQueryError('UPSTREAM_UNAVAILABLE', 'DeepSeek API 暂时不可用，请稍后重试', 502)
  }
  return new ModelQueryError('UPSTREAM_ERROR', `DeepSeek API 返回了 HTTP ${status}`, 502)
}

export interface QueryModelsOptions {
  apiKey: string
  baseUrl: string
  timeoutMs: number
  fetchImpl?: typeof fetch
}

/** Query the official `/models` endpoint with Bearer authentication and strict validation. */
export async function queryDeepSeekModels(options: QueryModelsOptions): Promise<DeepSeekModelsPayload> {
  const fetchImpl = options.fetchImpl ?? fetch
  let response: Response
  try {
    response = await fetchImpl(modelsEndpoint(options.baseUrl), {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${options.apiKey}`,
      },
      signal: AbortSignal.timeout(options.timeoutMs),
    })
  } catch (error) {
    if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
      throw new ModelQueryError('UPSTREAM_TIMEOUT', '查询 DeepSeek 模型列表超时', 504, { cause: error })
    }
    throw new ModelQueryError('UPSTREAM_UNAVAILABLE', '无法连接到 DeepSeek API', 502, { cause: error })
  }

  if (!response.ok) throw upstreamFailure(response.status)

  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    throw new ModelQueryError('INVALID_RESPONSE', 'DeepSeek 返回了无法解析的模型列表', 502, { cause: error })
  }
  return parseDeepSeekModels(payload)
}
