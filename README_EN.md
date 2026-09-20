# dsh-balance

[简体中文](./README.md) | [English](./README_EN.md)

A DeepSeek Harness plugin for checking DeepSeek / StepFun API balances, available provider models, and multidimensional usage costs. The API key is used only by the local Host and is never sent to the browser.

The redesigned account ledger switches between DeepSeek and StepFun. Run `pnpm preview` to explore it with sample data.

![DeepSeek balance below the chat composer](./docs/dsh-balance-composer-v040.png)

## Features

- DeepSeek: total, topped-up, and granted balances
- StepFun: available balance, total cash credited, total vouchers granted, and prepaid / postpaid account type
- Independent provider caches and case-insensitive Provider IDs
- Keep a compact DeepSeek balance summary below the chat composer
- Fetch available models, owners, and creation dates from the selected provider’s `/models` API
- View actual usage costs by model, session, and day in Settings, plus request details in the current session's Usage tab
- Mark missing usage, unknown providers, and unknown models as unpriced without estimating tokens
- Group dates in the browser's IANA timezone while applying DeepSeek peak pricing in Beijing time
- Show USD by default, with optional fixed-rate CNY conversion through `usdToCny`
- Cache query results with manual refresh support
- Follows DeepSeek peak/off-peak pricing: the balance indicator below the composer turns orange during peak hours (09:00–12:00, 14:00–18:00 Beijing time)
- Native Simplified Chinese and English that follows the Harness system language
- Use the `DEEPSEEK_API_KEY` saved by Harness

## Install

```bash
dsh plugin --profile web add @pinkbanana/dsh-balance@latest
dsh --profile web
```

Open <http://127.0.0.1:3080/> and go to Settings → Model Balances. The panel sits directly below Agent presets, and the balance summary also appears below the composer in existing sessions. Save the API key in Settings → Models or provide it through the `DEEPSEEK_API_KEY` environment variable.

Usage statistics read saved sessions and prefer the current live session. Prompt content is never exposed. To show a fixed-rate CNY conversion, add for example:

```yaml
usdToCny: 7.2
```

## StepFun setup

Add a custom provider in Settings → Models with Provider ID `StepFun` (`stepfun`, `STEPFUN`, and other case variants work) and save its API key. Harness derives the credential reference `STEPFUN_API_KEY`; setting that environment variable also works. Select StepFun in Settings → Model Balances.

The [StepFun account API](https://platform.stepfun.com/docs/zh/api-reference/accounts/get) uses Bearer authentication at `GET https://api.stepfun.com/v1/accounts`. Amounts are shown in CNY. Cash and voucher totals are cumulative amounts as documented, not remaining balance components. The API does not report service availability, so a zero or negative postpaid balance is not labeled as unavailable service.

To use another credential reference, override the balance provider in this plugin's configuration (`baseUrl` is an API prefix; include `/v1` for StepFun):

```yaml
providers:
  - id: StepFun
    apiKeyRef: MY_STEPFUN_KEY
    baseUrl: https://api.stepfun.com/v1
```

Existing top-level `apiKeyRef` / `baseUrl` settings continue to serve DeepSeek. The `providers` entries override both balance and model queries. Custom model base URLs are not read automatically; balance queries default to official APIs. Available models follow the selected provider; the composer summary remains DeepSeek-specific. Usage pricing coverage is unchanged; unsupported StepFun prices remain unpriced.

Model lists use the [StepFun list API](https://platform.stepfun.com/docs/zh/api-reference/models/list) at `GET /v1/models`, parsing `id`, `owned_by`, and `created` (Unix seconds) from each [Model object](https://platform.stepfun.com/docs/zh/api-reference/models/object). These fields are already returned in the list, so individual model retrieval is unnecessary. The Host route is `GET /dsh-balance/api/models?provider=StepFun`, with isolated provider caches and `refresh=1` to force a refresh.

## Extension and design

- `src/providers.ts` holds shared provider metadata. The adapter table in `src/balance.ts` defines endpoints and response parsers; transport, errors, and caching are shared.
- `GET /dsh-balance/api/balance?provider=StepFun` selects StepFun. Omitting provider preserves DeepSeek compatibility; `refresh=1` bypasses that provider's cache. Unknown providers return `UNSUPPORTED_PROVIDER`.
- The layout draws on [Codrops' Kononenko case study](https://tympanus.net/codrops/2026/09/18/kononenko-architectural-bureau/): oversized type, negative space, architectural grids, and geometric linework, implemented in original CSS with light/dark themes, narrow layouts, and reduced-motion support.

## Development

```bash
pnpm install
pnpm check
pnpm preview
```

The preview uses no real credentials. Use `?lang=en&theme=dark` for English/dark mode, or `?state=missing`, `error`, `empty`, or `loading` to inspect those states. The StepFun integration and redesign on main have not been published to npm; the `@latest` installation command above still installs the published version.

## License

[MIT](./LICENSE)

<a href="https://www.buymeacoffee.com/pinkbanana"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Crazywoola a coffee" width="199" height="55" /></a>
