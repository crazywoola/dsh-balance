export const balanceStyles = `
.dsh-deepseek-panel {
  --ledger-ink: var(--dsw-alias-label-primary, #202421);
  --ledger-muted: var(--dsw-alias-label-secondary, #60665f);
  --ledger-line: var(--dsw-alias-border-l2, #d7dbd3);
  --ledger-paper: var(--dsw-alias-bg-layer-3, #f5f6f0);
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 1040px;
  min-width: 0;
  color: var(--ledger-ink);
  container-type: inline-size;
}
.dsh-deepseek-panel *, .dsh-deepseek-panel *::before, .dsh-deepseek-panel *::after { box-sizing: border-box; }
.dsh-ledger-header { border-top: 2px solid var(--ledger-ink); padding-top: 14px; }
.dsh-ledger-eyebrow, .dsh-ledger-section-label, .dsh-ledger-kicker {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  letter-spacing: .08em;
  line-height: 1.6;
  color: var(--ledger-muted);
}
.dsh-ledger-eyebrow, .dsh-ledger-section-label { display: flex; justify-content: space-between; gap: 16px; }
.dsh-ledger-intro { display: grid; grid-template-columns: 1fr 150px; align-items: center; gap: 24px; padding: 32px 0 20px; }
.dsh-ledger-intro h1 { max-width: 650px; margin: 0; font-size: 24px; font-weight: 500; line-height: 1.4; }
.dsh-ledger-intro p { margin: 18px 0 0; color: var(--ledger-muted); font-size: 13px; line-height: 1.7; }
.dsh-ledger-orbit { position: relative; display: grid; place-items: center; width: 148px; height: 148px; }
.dsh-ledger-orbit i { position: absolute; width: 112px; height: 112px; border: 1px solid var(--ledger-muted); border-radius: 50%; transform: rotate(-35deg) scaleX(.5); }
.dsh-ledger-orbit i:nth-child(2) { transform: rotate(25deg) scaleX(.5); }
.dsh-ledger-orbit i:nth-child(3) { transform: rotate(85deg) scaleX(.5); }
.dsh-ledger-orbit span { display: grid; place-items: center; width: 40px; height: 40px; background: #d7ed9d; color: #233316; border-radius: 50%; font-size: 24px; transition: transform .4s ease; }
.dsh-ledger-header:hover .dsh-ledger-orbit span { transform: rotate(45deg); }
.dsh-provider-switch { display: flex; gap: 8px; padding-bottom: 24px; border-bottom: 1px solid var(--ledger-line); }
.dsh-provider-switch button { display: flex; align-items: center; gap: 14px; flex: 1; max-width: 270px; min-height: 58px; padding: 12px 18px; border: 1px solid var(--ledger-line); border-radius: 4px; color: var(--ledger-ink); background: transparent; font: inherit; font-size: 16px; cursor: pointer; transition: background .2s, transform .2s; }
.dsh-provider-switch button:hover { background: var(--ledger-paper); transform: translateY(-2px); }
.dsh-provider-switch button[aria-pressed='true'] { color: #e5f6bd; background: #25352e; border-color: #25352e; }
.dsh-provider-index { font-family: ui-monospace, monospace; font-size: 10px; opacity: .7; }
.dsh-provider-arrow { margin-left: auto; transition: transform .2s; }
.dsh-provider-switch button[aria-pressed='true'] .dsh-provider-arrow { transform: rotate(45deg); }
.dsh-ledger-kicker { margin: 0 0 8px; }
.dsh-ledger-section-label { border-top: 1px solid var(--ledger-line); padding-top: 18px; margin-top: 12px; }
.dsh-balance-section,
.dsh-models-section,
.dsh-billing-section,
.dsh-billing-view { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.dsh-balance-section { animation: dsh-ledger-reveal .3s ease-out; }
.dsh-balance-summary { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.dsh-balance-heading { margin: 0; font-size: 20px; font-weight: 550; line-height: 1.4; letter-spacing: -.025em; }
.dsh-balance-copy { margin: 4px 0 0; color: var(--dsw-alias-label-secondary, #60665f); font-size: 12px; line-height: 1.7; }
.dsh-balance-refresh { flex: none; appearance: none; border: 1px solid var(--dsw-alias-border-l2, #d7dbd3); border-radius: 4px; min-height: 36px; padding: 0 14px; background: transparent; color: var(--dsw-alias-label-primary, #202421); font: inherit; font-size: 12px; cursor: pointer; transition: background .2s; }
.dsh-balance-refresh:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, #e9edde); }
.dsh-balance-refresh:focus-visible, .dsh-provider-switch button:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #628537); outline-offset: 3px; }
.dsh-balance-refresh:disabled { cursor: default; opacity: .55; }
.dsh-balance-status, .dsh-balance-error { margin: 0; border: 1px solid var(--dsw-alias-border-l2, #d7dbd3); border-radius: 4px; padding: 24px; background: var(--dsw-alias-bg-layer-3, #f5f6f0); color: var(--dsw-alias-label-secondary, #60665f); font-size: 13px; line-height: 1.7; }
.dsh-balance-error { border-left: 3px solid var(--dsw-alias-state-error-primary, #b04734); }
.dsh-balance-error strong { color: var(--dsw-alias-state-error-primary, #b04734); }
.dsh-balance-error p { margin: 10px 0 0; }
.dsh-balance-availability { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--ledger-muted); }
.dsh-balance-dot { flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-state-error-primary, #b04734); }
.dsh-balance-availability[data-available='true'] .dsh-balance-dot { background: var(--dsw-alias-state-success-primary, #568434); }
.dsh-balance-availability[data-available='null'] .dsh-balance-dot { background: var(--ledger-muted); }
.dsh-balance-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 12px; }
.dsh-balance-card { position: relative; min-width: 0; overflow: hidden; border: 1px solid var(--ledger-line); border-radius: 4px; padding: 26px; background: var(--ledger-paper); }
.dsh-balance-card:first-child { background: #25352e; border-color: #25352e; color: #f2f5eb; }
.dsh-balance-card::before { content: ''; position: absolute; top: 0; right: 22px; height: 9px; width: 30px; border-left: 1px solid currentColor; border-right: 1px solid currentColor; opacity: .4; }
.dsh-balance-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 12px; }
.dsh-balance-currency { font-family: ui-monospace, monospace; font-size: 11px; letter-spacing: .1em; padding: 4px 7px; border: 1px solid currentColor; border-radius: 3px; }
.dsh-balance-total { margin: 24px 0 32px; font-size: clamp(32px, 6cqi, 64px); font-weight: 450; letter-spacing: -.045em; line-height: 1.1; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.dsh-balance-card:first-child .dsh-balance-total { color: #d7ed9d; }
.dsh-balance-breakdown { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin: 0; padding-top: 18px; border-top: 1px solid color-mix(in srgb, currentColor 20%, transparent); }
.dsh-balance-breakdown dt { font-size: 11px; opacity: .75; line-height: 1.5; }
.dsh-balance-breakdown dd { margin: 8px 0 0; font-size: 17px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.dsh-balance-meta { margin: 0; color: var(--dsw-alias-label-secondary, #60665f); font-size: 11px; line-height: 1.6; }
.dsh-balance-footer { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; color: var(--ledger-muted); font-size: 11px; }
.dsh-balance-skeleton { min-height: 245px; display: flex; flex-direction: column; align-items: flex-start; gap: 28px; padding: 26px; border: 1px solid var(--ledger-line); background: var(--ledger-paper); font-size: 12px; color: var(--ledger-muted); }
.dsh-balance-skeleton i { width: 60%; height: 42px; background: var(--ledger-line); animation: dsh-ledger-pulse 1.4s ease-in-out infinite alternate; }
.dsh-balance-skeleton i:last-child { width: 35%; height: 16px; }
@keyframes dsh-ledger-reveal { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes dsh-ledger-pulse { to { opacity: .4; } }
@container (max-width: 540px) {
  .dsh-ledger-intro { grid-template-columns: 1fr; padding-top: 24px; }
  .dsh-ledger-orbit { display: none; }
  .dsh-provider-switch button { padding: 12px; gap: 10px; }
  .dsh-balance-grid, .dsh-deepseek-panel .dsh-model-grid, .dsh-deepseek-panel .dsh-billing-card-grid, .dsh-deepseek-panel .dsh-billing-table-grid { grid-template-columns: 1fr; }
  .dsh-balance-card { padding: 20px; }
  .dsh-deepseek-panel .dsh-balance-summary { flex-wrap: wrap; }
}
@media (prefers-reduced-motion: reduce) {
  .dsh-deepseek-panel *, .dsh-deepseek-panel *::before, .dsh-deepseek-panel *::after { animation: none !important; transition: none !important; }
}
.dsh-deepseek-panel .dsh-model-card, .dsh-deepseek-panel .dsh-billing-card, .dsh-deepseek-panel .dsh-billing-list-section { border-radius: 4px; }
.dsh-billing-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.dsh-billing-actions select {
  min-height: 32px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 16px;
  padding: 0 12px;
  background: var(--dsw-alias-bg-layer-3);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
}
.dsh-billing-card-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.dsh-billing-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 104px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  padding: 16px;
  background: var(--dsw-alias-bg-layer-3);
}
.dsh-billing-card > span,
.dsh-billing-card > small { color: var(--dsw-alias-label-tertiary); font-size: 12px; }
.dsh-billing-card > small { margin-top: auto; line-height: 1.45; }
.dsh-billing-card-primary { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 35%, var(--dsw-alias-border-l2)); }
.dsh-billing-card[data-warning='true'] { border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 45%, var(--dsw-alias-border-l2)); }
.dsh-billing-card > strong { font-size: 22px; font-weight: 650; line-height: 1.2; font-variant-numeric: tabular-nums; }
.dsh-billing-cost-value { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.dsh-billing-cost-value strong { font-size: 20px; font-weight: 650; line-height: 1.2; font-variant-numeric: tabular-nums; }
.dsh-billing-cost-value span { color: var(--dsw-alias-label-tertiary); font-size: 11px; line-height: 1.35; }
.dsh-billing-table-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.dsh-billing-list-section {
  min-width: 0;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  padding: 16px;
  background: var(--dsw-alias-bg-layer-3);
}
.dsh-billing-list-section h3,
.dsh-billing-session-breakdown h3 { margin: 0 0 12px; font-size: 14px; font-weight: 600; }
.dsh-billing-list-wide { grid-column: 1 / -1; }
.dsh-billing-list { display: flex; flex-direction: column; gap: 2px; }
.dsh-billing-list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 54px;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
  padding: 9px 0;
}
.dsh-billing-list-row:last-child { border-bottom: 0; }
.dsh-billing-list-row > div:first-child { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.dsh-billing-list-row code { color: var(--dsw-alias-label-primary); font-size: 12px; overflow-wrap: anywhere; }
.dsh-billing-secondary { color: var(--dsw-alias-label-tertiary); font-size: 11px; line-height: 1.35; }
.dsh-billing-list-value { display: flex; flex: none; flex-direction: column; align-items: flex-end; gap: 3px; text-align: right; }
.dsh-billing-list-value > small { color: var(--dsw-alias-label-tertiary); font-size: 11px; }
.dsh-billing-session-title { overflow: hidden; color: var(--dsw-alias-label-primary); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.dsh-billing-session-breakdown { border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px; padding: 16px; background: var(--dsw-alias-bg-layer-3); }
.dsh-billing-request-list { display: flex; flex-direction: column; }
.dsh-billing-request-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
  padding: 11px 0;
  font-size: 12px;
}
.dsh-billing-request-row:last-child { border-bottom: 0; }
.dsh-billing-request-row > div { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.dsh-billing-request-row > div:last-child { align-items: flex-end; text-align: right; }
.dsh-billing-request-row span { color: var(--dsw-alias-label-tertiary); }
.dsh-billing-request-row code { color: var(--dsw-alias-label-secondary); overflow-wrap: anywhere; }
.dsh-billing-request-row strong { font-variant-numeric: tabular-nums; }
.dsh-model-count { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.dsh-model-count .dsh-balance-dot { background: var(--dsw-alias-state-success-primary); }
.dsh-model-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
.dsh-model-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  padding: 16px;
  background: var(--dsw-alias-bg-layer-3);
}
.dsh-model-id {
  color: var(--dsw-alias-label-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 15px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.dsh-model-owner { color: var(--dsw-alias-label-tertiary); font-size: 12px; }
.dsh-balance-dock {
  box-sizing: border-box;
  display: block;
  width: 100%;
  max-width: var(--dsh-chat-content-width);
  margin: 0 auto;
  padding: 4px calc(var(--dsh-composer-side-clearance) + 16px) 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 20px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dsh-balance-dock-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 6px;
  border-radius: 999px;
  background: var(--dsw-alias-label-dimmed);
  vertical-align: 1px;
}
.dsh-balance-dock-dot[data-state='available'] { background: var(--dsw-alias-state-success-primary); }
.dsh-balance-dock-dot[data-state='available'][data-peak='true'] { background: var(--dsw-alias-state-warn-primary); }
.dsh-balance-dock-dot[data-state='empty'],
.dsh-balance-dock-dot[data-state='error'] { background: var(--dsw-alias-state-error-primary); }
.dsh-balance-dock-separator {
  margin: 0 10px;
  color: var(--dsw-alias-separator-primary);
}
.dsh-balance-dock-value {
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
}
@media (max-width: 640px) {
  .dsh-balance-summary { align-items: flex-start; }
  .dsh-balance-grid,
  .dsh-model-grid,
  .dsh-billing-card-grid,
  .dsh-billing-table-grid { grid-template-columns: 1fr; }
  .dsh-billing-list-wide { grid-column: auto; }
  .dsh-billing-actions { justify-content: flex-start; }
  .dsh-billing-request-row { align-items: flex-start; flex-direction: column; }
  .dsh-billing-request-row > div:last-child { align-items: flex-start; text-align: left; }
}
`
