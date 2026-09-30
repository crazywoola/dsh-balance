export const balanceStyles = `
.dsh-deepseek-panel, .dsh-usage-content, .dsh-billing-view {
  --ledger-ink: var(--dsw-alias-label-primary, #202124);
  --ledger-muted: var(--dsw-alias-label-secondary, #686b70);
  --ledger-line: var(--dsw-alias-border-l2, #e3e4e7);
  --ledger-paper: var(--dsw-alias-bg-layer-3, #fafafa);
  color: var(--ledger-ink);
  min-width: 0;
  container-type: inline-size;
}
.dsh-deepseek-panel { display: flex; flex-direction: column; gap: 24px; max-width: 1040px; }
.dsh-deepseek-panel *, .dsh-usage-page *, .dsh-billing-view * { box-sizing: border-box; }
.dsh-usage-page { height: 100%; min-height: 0; overflow: auto; padding: 32px 24px; padding-top: max(32px, var(--dsh-frame-top-clearance, 0px)); padding-left: max(24px, var(--dsh-frame-leading-clearance, 0px)); }
.dsh-billing-view { box-sizing: border-box; width: 100%; max-width: 1088px; margin: 0 auto; padding: 24px 24px calc(var(--dsh-composer-height, 152px) + 24px); }
.dsh-usage-content { max-width: 1040px; margin: 0 auto; }
.dsh-ledger-header h1 { margin: 0; font-size: 22px; line-height: 1.4; font-weight: 600; }
.dsh-ledger-section-label { display: flex; justify-content: space-between; gap: 16px; color: var(--ledger-muted); font-size: 13px; border-top: 1px solid var(--ledger-line); padding-top: 20px; }
.dsh-ledger-kicker { margin: 0 0 8px; font-size: 12px; color: var(--ledger-muted); }
.dsh-provider-switch { display: flex; gap: 8px; flex-wrap: wrap; }
.dsh-provider-switch button { min-height: 34px; padding: 6px 16px; border: 1px solid transparent; border-radius: var(--dsw-radius-md, 8px); color: var(--ledger-muted); background: transparent; font: inherit; font-size: 13px; cursor: pointer; }
.dsh-provider-switch button:hover, .dsh-provider-switch button[aria-pressed='true'] { background: var(--dsw-alias-interactive-bg-hover, color-mix(in srgb, currentColor 6%, transparent)); color: var(--ledger-ink); }
.dsh-provider-switch button[aria-pressed='true'] { border-color: var(--ledger-line); }
.dsh-balance-section, .dsh-models-section, .dsh-billing-section, .dsh-billing-view { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.dsh-balance-summary { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
.dsh-balance-heading { margin: 0; font-size: 18px; font-weight: 600; line-height: 1.4; }
.dsh-balance-copy { margin: 6px 0 0; color: var(--ledger-muted); font-size: 13px; line-height: 1.6; }
.dsh-balance-refresh { flex: none; border: 1px solid var(--ledger-line); border-radius: var(--dsw-radius-md, 8px); min-height: 32px; padding: 0 12px; background: transparent; color: var(--ledger-ink); font: inherit; font-size: 13px; cursor: pointer; }
.dsh-balance-refresh:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, color-mix(in srgb, currentColor 6%, transparent)); }
.dsh-balance-refresh:disabled { cursor: default; opacity: .55; }
.dsh-balance-refresh:focus-visible, .dsh-provider-switch button:focus-visible, .dsh-usage-select:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary, #4d6bfe); outline-offset: 2px; }
.dsh-balance-status, .dsh-balance-error { margin: 0; border: 1px solid var(--ledger-line); border-radius: var(--dsw-radius-lg, 12px); padding: 20px; background: var(--ledger-paper); color: var(--ledger-muted); font-size: 13px; line-height: 1.6; }
.dsh-balance-error { border-left: 3px solid var(--dsw-alias-state-error-primary, #c33); }
.dsh-balance-error strong { color: var(--dsw-alias-state-error-primary, #c33); }
.dsh-balance-error p { margin: 10px 0 0; }
.dsh-balance-availability { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--ledger-muted); }
.dsh-balance-dot { flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-state-error-primary, #c33); }
.dsh-balance-availability[data-available='true'] .dsh-balance-dot { background: var(--dsw-alias-state-success-primary, #35a16b); }
.dsh-balance-availability[data-available='null'] .dsh-balance-dot { background: var(--ledger-muted); }
.dsh-balance-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 12px; }
.dsh-balance-card { min-width: 0; border: 1px solid var(--ledger-line); border-radius: var(--dsw-radius-lg, 12px); padding: 20px; background: var(--ledger-paper); }
.dsh-balance-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 13px; color: var(--ledger-muted); }
.dsh-balance-currency { font-size: 12px; padding: 3px 6px; border: 1px solid var(--ledger-line); border-radius: 4px; }
.dsh-balance-total { margin: 20px 0; font-size: 36px; font-weight: 600; line-height: 1.2; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.dsh-balance-breakdown { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin: 0; padding-top: 16px; border-top: 1px solid var(--ledger-line); }
.dsh-balance-breakdown dt { font-size: 12px; color: var(--ledger-muted); line-height: 1.5; }
.dsh-balance-breakdown dd { margin: 6px 0 0; font-size: 16px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.dsh-balance-meta, .dsh-balance-footer { margin: 0; color: var(--ledger-muted); font-size: 11px; line-height: 1.6; }
.dsh-balance-footer { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; }
.dsh-balance-skeleton { min-height: 180px; display: flex; flex-direction: column; gap: 24px; padding: 20px; border: 1px solid var(--ledger-line); border-radius: 12px; background: var(--ledger-paper); font-size: 12px; color: var(--ledger-muted); }
.dsh-balance-skeleton i { width: 60%; height: 32px; border-radius: 4px; background: var(--ledger-line); }
.dsh-balance-skeleton i:last-child { width: 35%; height: 16px; }
@container (max-width: 700px) { .dsh-billing-card-grid, .dsh-billing-table-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } }
@container (max-width: 480px) {
  .dsh-billing-request-row { align-items: flex-start; flex-direction: column; }
  .dsh-billing-request-row > div:last-child { align-items: flex-start; text-align: left; }
  .dsh-billing-card-grid, .dsh-billing-table-grid, .dsh-model-grid { grid-template-columns: 1fr !important; }
  .dsh-billing-list-row { flex-wrap: wrap; }
  .dsh-billing-list-value { text-align: left; align-items: flex-start; }
}
.dsh-billing-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.dsh-usage-select { display: inline-flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 34px; padding: 6px 12px; border: 1px solid var(--dsw-alias-border-l2, #e3e4e7); border-radius: var(--dsw-radius-md, 8px); background: var(--dsw-alias-bg-layer-3, #fafafa); color: var(--dsw-alias-label-primary, #202124); font: inherit; font-size: 13px; cursor: pointer; }
.dsh-usage-select:hover, .dsh-usage-select[aria-expanded='true'] { background: var(--dsw-alias-interactive-bg-hover, color-mix(in srgb, currentColor 6%, transparent)); }
.dsh-usage-select svg { flex: none; color: var(--dsw-alias-label-tertiary, #8b8e94); transition: transform .15s ease; }
.dsh-usage-select[aria-expanded='true'] svg { transform: rotate(180deg); }
.dsh-usage-select:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary, #4d6bfe); outline-offset: 2px; }
.dsh-usage-select-menu { position: fixed; z-index: 1100; padding: 6px; box-sizing: border-box; border: 1px solid var(--dsw-alias-border-l2, #e3e4e7); border-radius: var(--dsw-radius-lg, 12px); background: var(--dsw-specific-menu, var(--dsw-alias-bg-layer-3, #fafafa)); color: var(--dsw-alias-label-primary, #202124); box-shadow: var(--dsw-elevation-prominent, 0 8px 32px #0002); backdrop-filter: var(--dsw-menu-backdrop-filter, none); overflow-y: auto; overscroll-behavior: contain; font-family: inherit; }
.dsh-usage-select-option { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 36px; box-sizing: border-box; border-radius: var(--dsw-radius-md, 8px); padding: 6px 10px; font-size: 13px; line-height: 24px; cursor: pointer; }
.dsh-usage-select-option > span { min-width: 0; overflow-wrap: anywhere; }
.dsh-usage-select-option svg { flex: none; }
.dsh-usage-select-option[data-active='true'] { background: var(--dsw-alias-interactive-bg-hover, color-mix(in srgb, currentColor 6%, transparent)); }
.dsh-usage-select-option[aria-selected='true'] { font-weight: 500; }
@media (prefers-reduced-motion: reduce) { .dsh-usage-select svg { transition: none; } }
.dsh-punchcard { min-width: 0; padding: 20px; border: 1px solid var(--ledger-line); border-radius: var(--dsw-radius-lg, 12px); background: var(--ledger-paper); }
.dsh-punchcard-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
.dsh-punchcard-header h3 { margin: 0; font-size: 14px; font-weight: 600; }
.dsh-punchcard-header p { margin: 6px 0 0; color: var(--ledger-muted); font-size: 12px; line-height: 1.5; }
.dsh-punchcard-legend { display: flex; align-items: center; gap: 8px; color: var(--ledger-muted); font-size: 11px; }
.dsh-punchcard-legend i { width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-state-success-primary, #35a16b); }
.dsh-punchcard-legend i:nth-of-type(2) { width: 10px; height: 10px; }
.dsh-punchcard-legend i:nth-of-type(3) { width: 16px; height: 16px; }
.dsh-punchcard-scroll { overflow-x: auto; margin-top: 8px; }
.dsh-punchcard-chart { display: block; width: 100%; min-width: 700px; overflow: visible; }
.dsh-punchcard-label { fill: var(--ledger-muted); font-size: 11px; font-family: inherit; }
.dsh-punchcard-line { stroke: var(--ledger-line); stroke-dasharray: 2 6; opacity: .5; }
.dsh-punchcard-dot { fill: var(--dsw-alias-state-success-primary, #35a16b); outline: none; }
.dsh-punchcard-dot[data-empty='true'] { fill: var(--ledger-line); }
.dsh-punchcard-dot[data-active='true'], .dsh-punchcard-dot:focus-visible { stroke: var(--ledger-ink); stroke-width: 2; }
.dsh-punchcard-footer { display: flex; justify-content: space-between; gap: 8px 20px; flex-wrap: wrap; min-height: 20px; color: var(--ledger-muted); font-size: 11px; line-height: 1.6; }
@media (max-width: 480px) { .dsh-punchcard { padding: 16px; } }
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
.dsh-billing-card-primary { border-color: color-mix(in srgb, var(--dsw-alias-state-business-primary, #4d6bfe) 20%, var(--dsw-alias-border-l2)); }
.dsh-billing-card[data-warning='true'] { border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #d99525) 35%, var(--dsw-alias-border-l2)); }
.dsh-billing-card > strong { font-size: 22px; font-weight: 650; line-height: 1.2; font-variant-numeric: tabular-nums; }
.dsh-billing-cost-value { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.dsh-billing-cost-value strong { font-size: 20px; font-weight: 650; line-height: 1.2; font-variant-numeric: tabular-nums; }
.dsh-billing-cost-value small, .dsh-billing-cost-value span { color: var(--dsw-alias-label-tertiary); font-size: 11px; line-height: 1.35; }
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
.dsh-billing-list-value .dsh-billing-cost-value strong { font-size: 16px; overflow-wrap: anywhere; }
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
.dsh-model-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 12px; }
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
  padding: 4px calc(var(--dsh-composer-side-clearance, 0px) + 16px) 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 20px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dsh-balance-dock-model { display: inline-block; max-width: 40%; margin-left: 8px; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; vertical-align: bottom; }
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
  display: inline-block;
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
}
@media (max-width: 640px) {
  .dsh-billing-view { padding: 20px 16px calc(var(--dsh-composer-height, 152px) + 20px); }
  .dsh-balance-dock { white-space: normal; }
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
