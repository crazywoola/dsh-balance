export const balanceStyles = `
.dsh-balance-tab {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 760px;
  color: var(--dsw-alias-label-primary);
}
.dsh-balance-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.dsh-balance-heading { margin: 0; font-size: 18px; font-weight: 600; }
.dsh-balance-copy { margin: 4px 0 0; color: var(--dsw-alias-label-tertiary); font-size: 13px; line-height: 1.5; }
.dsh-balance-refresh {
  flex: none;
  appearance: none;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  padding: 6px 13px;
  background: var(--dsw-alias-bg-layer-3);
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
`
