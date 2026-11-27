# How estimates are computed

The next-turn advisor compares four next steps: continue in the current period, wait for the next peak/off-peak change, run `/compact` now, or start a fresh session. The figures are published-rate estimates, **not an official bill**. The plugin never switches models or runs `/compact` on its own, and session text never leaves this machine.

For the shorter product summary see the [README](../README_EN.md#next-turn-estimates). 简体中文版见 [估算是怎么算的](./estimates.md).

## Sampling and token shape

Estimates use only this session’s **most recent 8 priced requests** (or all of them if there are fewer). The advisor takes a median for each usage bucket and prices that shape through the same billing engines as the usage totals — not a second pricing path:

- uncached input
- cache read (hit)
- cache write
- output

The four medians are independent, so the synthetic “typical turn” may not match any single historical request. The next turn may also differ after compaction, a large paste, or vision input.

If the session has no priced requests, the card explains that it cannot estimate. It does not show $0.

## The four next steps

| Option | How it is priced |
| --- | --- |
| Continue in the current period | The median usage, priced at **now** (peak, off-peak, or the provider’s standard rate). |
| Wait for the next peak change | The same usage, priced at the next peak↔off-peak switch. Only official DeepSeek rates have a peak window; StepFun and Tokener do not use that multiplier, so this row is omitted. |
| Compact now | Cost of the **summarizer request** plus the **first turn after compaction**. The summarizer reads the whole history (the already-cached prefix still hits) and is assumed to write about 4,000 output tokens, capped at one quarter of the history. After compaction, only the **smallest cache-hit prefix** seen in the session still hits; the summary and the new input miss. Output stays at the median. Actual summary length and the model used to compact may differ. |
| Fresh session | Cache reads are treated as cache misses; output and cache writes are unchanged. This simulates a new session with no reusable prefix. |

“Saved by continuing this session vs starting over” is the difference between the fresh-session estimate and the current-period estimate. The card may also compare other official models already configured in this Harness that can actually be priced (same median usage, current period). Unpriced models are omitted rather than shown as $0. Tokener models are compared only when they are already in the session or current selection; they are not expanded from a built-in alternative catalog.

## Prices, peak hours, and limits

- **DeepSeek**: [official USD rates](https://api-docs.deepseek.com/quick_start/pricing/) with Beijing-time peak hours. Peak is Monday–Friday 09:00–12:00 and 14:00–18:00, excluding Chinese public holidays; weekends and those holidays are all-day off-peak. The built-in holiday calendar currently runs through 2027; later dates are estimated as ordinary weekdays and the card says so.
- **StepFun**: official standard CNY rates. The standard `step-5-preview` cache-hit rate is 0.70 CNY per million tokens from 2026-10-14; accounts that had already used the pay-as-you-go API before then may still be grandfathered at 0.35. The plugin cannot detect that, so it applies the standard effective-from date and notes the limitation.
- **Tokener**: USD reference rates from the 2026-11-03 catalog snapshot, without vendor rates or the DeepSeek peak multiplier. A turn that includes an unpublished cache-write price is omitted from the estimate.
- `pricingOverrides` are shared with usage accounting. A combined CNY total appears only when `usdToCny` is configured (or a display rate is entered on the usage page), and it is labeled as a fixed-rate conversion.

Plans, discounts, account-specific rates, or unrecorded historical price changes can make the actual charge differ from the estimate.

## Where to find it

- The current session’s Usage tab, and the usage-page drill-down after you click a session name, both show the full estimate card.
- The balance dock under the composer can expand the same estimate on demand; it stays collapsed by default.
- Local read-only API: `GET /dsh-balance/api/advice?session=…` (`sessionId` is also accepted; optional `provider`, `model`, and repeated `compare=provider:model`). Loopback only; the payload never includes prompt or session text.

This version has **no** agent tool the model can call. A read-only `dsh_balance_advise` tool is still on the [roadmap](../ROADMAP.md). Until then, use the UI or the local HTTP route above.

Local preview (no credentials):

```bash
pnpm preview
```

Then open `?page=session` for the conversation usage view and advisor card, or `?page=usage` for the statistics overview and session drill-down. Add `&lang=en`, `&lang=zh-tw`, or `&theme=dark` as needed.
