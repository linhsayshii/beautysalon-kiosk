import './mobile-common.css';

export interface MobileMetricItem {
  label: string;
  value: string | number;
  note?: string;
  tone?: 'blue' | 'green' | 'orange' | 'red' | 'violet';
}

export interface MobileMetricCardsProps {
  items: MobileMetricItem[];
}

export function MobileMetricCards({ items }: MobileMetricCardsProps) {
  if (!items || items.length === 0) return null;

  return (
    <div className="mobile-metric-cards-grid">
      {items.map((item, idx) => (
        <div
          key={idx}
          className={`mobile-metric-card ${item.tone ? `tone-${item.tone}` : 'tone-blue'}`}
        >
          <span className="mobile-metric-label">{item.label}</span>
          <span className="mobile-metric-value">{item.value}</span>
          {item.note && <span className="mobile-metric-note">{item.note}</span>}
        </div>
      ))}
    </div>
  );
}
