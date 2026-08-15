import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
import type { DeepSeekApiErrorCode } from '../types.ts'

export const LOCALE_NS = 'dsh-balance'

/** Simplified Chinese dictionary and source of truth for the namespace key set. */
export const zh = {
  'locale.tag': 'zh-CN',
  'nav.balance': 'DeepSeek 余额',
  'action.loading': '查询中…',
  'balance.title': 'DeepSeek API 余额',
  'balance.copy': '余额由本机 Host 使用已保存的 API 密钥查询，密钥不会发送到浏览器。',
  'balance.refresh': '刷新余额',
  'balance.loading': '正在查询 DeepSeek 账户余额…',
  'balance.available': '当前账户有可用余额',
  'balance.unavailable': '当前账户没有可用余额',
  'balance.empty': 'DeepSeek 未返回任何币种余额。',
  'balance.toppedUp': '充值余额',
  'balance.granted': '赠送余额',
  'dock.label': 'DeepSeek 余额',
  'dock.loading': '查询中…',
  'dock.unavailable': '暂时无法获取',
  'dock.empty': '暂无余额信息',
  'models.title': 'DeepSeek 可用模型',
  'models.copy': '从 DeepSeek 官方 /models 接口读取当前 API Key 可访问的模型。',
  'models.refresh': '刷新模型',
  'models.loading': '正在查询 DeepSeek 模型列表…',
  'models.count': '当前可用 {count} 个模型',
  'models.empty': 'DeepSeek 未返回任何可用模型。',
  'models.owner': '由 {owner} 提供',
  'meta.updated': '更新于 {time}',
  'meta.cached': ' · 缓存',
  'error.FORBIDDEN': '此查询仅允许从本机访问',
  'error.INVALID_API_KEY': 'DeepSeek API 密钥无效或没有查询权限',
  'error.INVALID_RESPONSE': 'DeepSeek 返回了无法识别的响应',
  'error.METHOD_NOT_ALLOWED': '请求方法不受支持',
  'error.MISSING_API_KEY': '未配置 DeepSeek API 密钥，请先在“模型”设置中保存',
  'error.RATE_LIMITED': 'DeepSeek API 请求过于频繁，请稍后重试',
  'error.UPSTREAM_ERROR': 'DeepSeek API 返回了错误',
  'error.UPSTREAM_TIMEOUT': '查询 DeepSeek API 超时',
  'error.UPSTREAM_UNAVAILABLE': '无法连接到 DeepSeek API',
} as const

export type DshBalanceLocaleKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Balance and model-list settings copy owned by this plugin. */
    'dsh-balance': DshBalanceLocaleKey
  }
}

/** English dictionary, checked complete against the Chinese key set. */
export const en: LocaleDictOf<typeof LOCALE_NS> = {
  'locale.tag': 'en-US',
  'nav.balance': 'DeepSeek Balance',
  'action.loading': 'Loading…',
  'balance.title': 'DeepSeek API Balance',
  'balance.copy': 'The local Host queries your balance with the saved API key. The key is never sent to the browser.',
  'balance.refresh': 'Refresh balance',
  'balance.loading': 'Loading your DeepSeek API balance…',
  'balance.available': 'This account has available balance',
  'balance.unavailable': 'This account has no available balance',
  'balance.empty': 'DeepSeek returned no currency balances.',
  'balance.toppedUp': 'Topped-up balance',
  'balance.granted': 'Granted balance',
  'dock.label': 'DeepSeek Balance',
  'dock.loading': 'Loading…',
  'dock.unavailable': 'Temporarily unavailable',
  'dock.empty': 'No balance information',
  'models.title': 'Available DeepSeek Models',
  'models.copy': 'Lists the models available to the current API key using the official DeepSeek /models endpoint.',
  'models.refresh': 'Refresh models',
  'models.loading': 'Loading the DeepSeek model list…',
  'models.count': '{count} models available',
  'models.empty': 'DeepSeek returned no available models.',
  'models.owner': 'Provided by {owner}',
  'meta.updated': 'Updated {time}',
  'meta.cached': ' · Cached',
  'error.FORBIDDEN': 'This query is available only from the local machine',
  'error.INVALID_API_KEY': 'The DeepSeek API key is invalid or lacks permission',
  'error.INVALID_RESPONSE': 'DeepSeek returned an unrecognized response',
  'error.METHOD_NOT_ALLOWED': 'This request method is not supported',
  'error.MISSING_API_KEY': 'No DeepSeek API key is configured. Save one in Models settings first.',
  'error.RATE_LIMITED': 'Too many DeepSeek API requests. Try again later.',
  'error.UPSTREAM_ERROR': 'The DeepSeek API returned an error',
  'error.UPSTREAM_TIMEOUT': 'The DeepSeek API request timed out',
  'error.UPSTREAM_UNAVAILABLE': 'Could not connect to the DeepSeek API',
}

export function errorLocaleKey(code: DeepSeekApiErrorCode): DshBalanceLocaleKey {
  return `error.${code}`
}
