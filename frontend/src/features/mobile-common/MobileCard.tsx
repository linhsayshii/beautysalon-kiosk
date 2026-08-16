import type { ReactNode } from 'react';
import './mobile-common.css';

export interface MobileCardDetail {
  label: string;
  value: string | ReactNode;
}

export interface MobileCardProps {
  title: string;
  subtitle?: string;
  badge?: {
    text: string;
    tone?: string;
  };
  avatar?: ReactNode;
  details?: MobileCardDetail[];
  action?: ReactNode;
  onClick?: () => void;
}

export function MobileCard({
  title,
  subtitle,
  badge,
  avatar,
  details,
  action,
  onClick,
}: MobileCardProps) {
  return (
    <div
      className={`mobile-card ${onClick ? 'is-clickable' : ''}`}
      onClick={onClick}
    >
      <div className="mobile-card-header">
        <div className="mobile-card-header-left">
          {avatar && <div className="mobile-card-avatar">{avatar}</div>}
          <div className="mobile-card-titles">
            <span className="mobile-card-title">{title}</span>
            {subtitle && <span className="mobile-card-subtitle">{subtitle}</span>}
          </div>
        </div>

        <div className="mobile-card-header-right">
          {badge && (
            <span
              className={`mobile-card-badge ${badge.tone ? `tone-${badge.tone}` : ''}`}
            >
              {badge.text}
            </span>
          )}
          {onClick && <i className="ph ph-caret-right" style={{ color: 'var(--ink-400)', fontSize: '18px' }} />}
        </div>
      </div>

      {details && details.length > 0 && (
        <div className="mobile-card-details">
          {details.map((item, idx) => (
            <div key={idx} className="mobile-card-detail-item">
              <span className="mobile-card-detail-label">{item.label}</span>
              <span className="mobile-card-detail-val">{item.value}</span>
            </div>
          ))}
        </div>
      )}

      {action && (
        <div
          className="mobile-card-footer"
          onClick={(e) => e.stopPropagation()}
        >
          {action}
        </div>
      )}
    </div>
  );
}
