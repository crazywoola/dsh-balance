# dsh-balance

[简体中文](./README.md) | [English](./README_EN.md)

A DeepSeek Harness plugin for checking DeepSeek / StepFun / Tokener API balances, available provider models, and multidimensional usage costs. The API key is used only by the local Host and is never sent to the browser.

The redesigned account ledger switches between DeepSeek, StepFun, and Tokener. Run `pnpm preview` to explore it with sample data.

The composer readout follows the current session’s provider and model. The Settings provider selection is independent.

## Features

- DeepSeek: total, topped-up, and granted balances
- StepFun: available balance, total cash credited, total vouchers granted, and prepaid / postpaid account type
- Tokener: available USD, purchased and granted balances, with separate management and inference credentials
- Independent provider caches and case-insensitive Provider IDs
- Show the current provider, model, and balance below the composer, following both the selector and `/model`
- Fetch available models, owners, and creation dates from the selected provider’s `/models` API
- View actual usage costs by selected provider, model, session, and day in Settings, plus request details in the current session's Usage tab
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

Existing top-level `apiKeyRef` / `baseUrl` settings continue to serve DeepSeek. The `providers` entries override both balance and model queries. Custom model base URLs are not read automatically; balance queries default to official APIs. Balances, models, and Settings usage follow the selected provider. The composer follows the live session selection; the session Usage tab preserves historical usage across all providers.

Model lists use the [StepFun list API](https://platform.stepfun.com/docs/zh/api-reference/models/list) at `GET /v1/models`, parsing `id`, `owned_by`, and `created` (Unix seconds) from each [Model object](https://platform.stepfun.com/docs/zh/api-reference/models/object). These fields are already returned in the list, so individual model retrieval is unnecessary. The Host route is `GET /dsh-balance/api/models?provider=StepFun`, with isolated provider caches and `refresh=1` to force a refresh.

## Tokener setup

Add a custom provider with ID `Tokener` (case-insensitive), base URL `https://api.tokener.ai/v1`, and its inference API key (default reference `TOKENER_API_KEY`). Available models are read from `GET /v1/models`.

For balances, create a personal access token (PAT) in Tokener account settings and configure `TOKENER_MANAGEMENT_TOKEN` in the Harness launch environment or credential store. **An inference API key cannot replace this token.** Balances use Bearer authentication at `GET https://console.tokener.ai/api/v1/billing/balance`. Integer USD millionths are converted exactly; purchased and granted amounts are remaining balances.

Override credentials or self-hosted endpoints separately:

```yaml
providers:
  - id: Tokener
    apiKeyRef: MY_TOKENER_API_KEY
    baseUrl: https://api.tokener.ai/v1
    balanceApiKeyRef: MY_TOKENER_PAT
    balanceBaseUrl: https://console.tokener.ai/api/v1
```

Tokener’s inference overrides do not change its management credentials or endpoint. See [Tokener documentation](https://www.tokener.ai/zh/docs), the [official balance route](https://github.com/langgenius/ai-gateway/blob/main/apps/console/src/app/api/v1/billing/balance/route.ts), and [response fields](https://github.com/langgenius/ai-gateway/blob/main/apps/console/src/server/billing.ts).

## Usage accounting

Each request is attributed to its actual message source, with request headers as a fallback for older logs. Request time determines date grouping and peak pricing. Token totals include uncached input, output, cache reads, and cache writes. Settings defaults to the selected provider, with an All providers option; the session view keeps mixed-provider history.

Built-in prices currently cover official DeepSeek pricing only. StepFun, Tokener, and other requests without reliable historical pricing keep their token and request counts and show as unpriced. A similarly named DeepSeek model does not inherit official DeepSeek pricing on another provider. Entirely unpriced totals do not show $0; mixed totals include only known charges and carry a partial-cost label. Live account balances are separate from local usage estimates.

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

The preview uses no real credentials. Use `?lang=en&theme=dark` for English/dark mode, or `?state=missing`, `error`, `empty`, or `loading` to inspect those states. The sample model selector also exercises the composer readout. StepFun balance and model queries and the redesigned account page are available starting with `0.6.0`.

## License

[MIT](./LICENSE)

<a href="https://www.buymeacoffee.com/pinkbanana"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Crazywoola a coffee" width="199" height="55" /></a>
