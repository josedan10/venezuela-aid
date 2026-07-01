import React from 'react';

export default function CollapsiblePanel({
  title,
  collapsed = false,
  onToggle,
  onRefresh,
  headerExtra = null,
  children,
  className = '',
  headingLevel = 'h3',
}) {
  const Heading = headingLevel;

  return (
    <div className={`collapsible-panel ${collapsed ? 'is-collapsed' : ''} ${className}`}>
      <div className="collapsible-panel-header">
        <button
          type="button"
          className="collapse-toggle-btn"
          onClick={onToggle}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expandir lista' : 'Minimizar lista'}
        >
          {collapsed ? '▸' : '▾'}
        </button>
        <Heading className="collapsible-panel-title">{title}</Heading>
        <div className="collapsible-panel-actions">
          {headerExtra}
          {onRefresh && (
            <button onClick={onRefresh} className="refresh-btn" type="button" title="Actualizar">
              ↻
            </button>
          )}
        </div>
      </div>
      {!collapsed && <div className="collapsible-panel-body">{children}</div>}

      <style jsx>{`
        .collapsible-panel {
          background: rgba(0, 0, 0, 1);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 20px;
          box-sizing: border-box;
        }
        .collapsible-panel:global(.margin-top) {
          margin-top: 16px;
        }
        .collapsible-panel:global(.selected-point-details-card) {
          margin: 14px;
        }
        .collapsible-panel:global(.nested) {
          background: transparent;
          border: none;
          box-shadow: none;
          padding: 0;
        }
        .collapsible-panel.is-collapsed .collapsible-panel-header {
          margin-bottom: 0;
        }
        .collapsible-panel-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }
        .collapse-toggle-btn {
          flex-shrink: 0;
          width: 26px;
          height: 26px;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.04);
          color: #94a3b8;
          cursor: pointer;
          font-size: 12px;
          line-height: 1;
          transition: all 0.2s;
        }
        .collapse-toggle-btn:hover {
          color: #f8fafc;
          background: rgba(255, 255, 255, 0.08);
        }
        .collapsible-panel-title {
          flex: 1;
          min-width: 0;
          margin: 0;
          font-size: 14px;
          font-weight: 800;
          color: #f8fafc;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        :global(h4.collapsible-panel-title) {
          font-size: 13px;
        }
        .collapsible-panel-actions {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .collapsible-panel-actions :global(button.close-point-btn) {
          background: none;
          border: none;
          color: #94a3b8;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          padding: 2px 6px;
        }
        .collapsible-panel-actions :global(button.close-point-btn:hover) {
          color: #f8fafc;
        }
        .refresh-btn {
          background: none;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #94a3b8;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 12px;
        }
        .refresh-btn:hover {
          color: #f8fafc;
          border-color: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
