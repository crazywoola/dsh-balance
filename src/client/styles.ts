export const balanceStyles = `
.dsh-deepseek-panel {
  display: flex;
  flex-direction: column;
  gap: 28px;
  max-width: 720px;
  color: var(--dsw-alias-label-primary);
}
.dsh-balance-section,
.dsh-models-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.dsh-deepseek-divider {
  height: 1px;
  background: var(--dsw-alias-border-l2);
}
.dsh-balance-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.dsh-balance-heading { margin: 0; font-size: 18px; font-weight: 600; line-height: 24px; }
.dsh-balance-copy { margin: 4px 0 0; color: var(--dsw-alias-label-tertiary); font-size: 13px; line-height: 1.5; }
.dsh-balance-refresh {
  flex: none;
  appearance: none;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 16px;
  min-height: 32px;
  padding: 0 14px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.dsh-balance-refresh:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.dsh-balance-refresh:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
.dsh-balance-refresh:disabled { cursor: default; opacity: .55; }
.dsh-balance-status,
.dsh-balance-error {
  margin: 0;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  padding: 18px;
  background: var(--dsw-alias-bg-layer-3);
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 1.6;
}
.dsh-balance-error { color: var(--dsw-alias-state-error-primary); }
.dsh-balance-availability { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.dsh-balance-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--dsw-alias-state-error-primary); }
.dsh-balance-availability[data-available='true'] .dsh-balance-dot { background: var(--dsw-alias-state-success-primary); }
.dsh-balance-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.dsh-balance-card {
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  padding: 16px;
  background: var(--dsw-alias-bg-layer-3);
}
.dsh-balance-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.dsh-balance-currency { color: var(--dsw-alias-label-tertiary); font-size: 12px; font-weight: 600; letter-spacing: .04em; }
.dsh-balance-total { margin: 12px 0 16px; font-size: 28px; font-weight: 650; line-height: 1.15; }
.dsh-balance-breakdown { display: grid; grid-template-columns: 1fr auto; gap: 7px 12px; margin: 0; font-size: 12px; }
.dsh-balance-breakdown dt { color: var(--dsw-alias-label-tertiary); }
.dsh-balance-breakdown dd { margin: 0; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
.dsh-balance-meta { margin: 0; color: var(--dsw-alias-label-tertiary); font-size: 12px; }
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
  .dsh-model-grid { grid-template-columns: 1fr; }
}
`
