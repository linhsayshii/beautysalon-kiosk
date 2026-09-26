import type { ReactNode } from 'react';

// Building blocks for the panel under an expanded table row (styles/ui/detail.css).

export type DetailTone = 'primary' | 'success' | 'danger' | 'warning' | 'violet' | 'muted';

export interface InlineDetailTab<T extends string> {
  value: T;
  label: ReactNode;
}

interface InlineDetailProps<T extends string> {
  /** Accessible name of the tab list, e.g. "Chi tiết đơn hàng HD0001". */
  label: string;
  tabs?: InlineDetailTab<T>[];
  tab?: T;
  onTabChange?: (tab: T) => void;
  className?: string;
  children: ReactNode;
}

export function InlineDetail<T extends string>({ label, tabs, tab, onTabChange, className, children }: InlineDetailProps<T>) {
  return (
    <div className={className ? `inline-detail ${className}` : 'inline-detail'}>
      {tabs && (
        <div className="tabs inline-detail-tabs" role="tablist" aria-label={label}>
          {tabs.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              className="tab"
              aria-selected={tab === item.value}
              onClick={() => onTabChange?.(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      <div className="inline-detail-body">{children}</div>
    </div>
  );
}

interface DetailHeadProps {
  /** Phosphor icon class, e.g. "ph-receipt". */
  icon: string;
  /** Avatar colour: blue (default), violet, green, orange, pink or mint; anything else falls back to blue. */
  tone?: string;
  title: ReactNode;
  /** Badges shown after the title. */
  tags?: ReactNode;
  meta?: ReactNode;
  aside?: ReactNode;
}

const AVATAR_TONES = new Set(['violet', 'green', 'orange', 'pink', 'mint']);

export function DetailHead({ icon, tone, title, tags, meta, aside }: DetailHeadProps) {
  return (
    <div className="detail-head">
      <div className="detail-head-main">
        <span className={tone && AVATAR_TONES.has(tone) ? `detail-avatar tone-${tone}` : 'detail-avatar'} aria-hidden="true">
          <i className={`ph ${icon}`} />
        </span>
        <div>
          <div className="detail-head-title">
            <strong>{title}</strong>
            {tags}
          </div>
          {meta && <div className="detail-head-meta">{meta}</div>}
        </div>
      </div>
      {aside && <div className="detail-head-aside">{aside}</div>}
    </div>
  );
}

export interface DetailValue {
  label: ReactNode;
  value: ReactNode;
  tone?: DetailTone;
  /** Facts only: span two columns (wide) or the whole row (full). */
  span?: 'wide' | 'full';
  /** Facts only: render the value as secondary text instead of a bold value. */
  variant?: 'note' | 'placeholder';
}

type MaybeValue = DetailValue | false | null | undefined;

function valueClass(item: DetailValue) {
  return [item.tone && `is-${item.tone}`, item.variant && `is-${item.variant}`].filter(Boolean).join(' ') || undefined;
}

export function ValueStrip({ items }: { items: DetailValue[] }) {
  return (
    <dl className="value-strip">
      {items.map((item, index) => (
        <div key={index}>
          <dt>{item.label}</dt>
          <dd className={valueClass(item)}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DetailFacts({ items, columns = 4 }: { items: MaybeValue[]; columns?: 3 | 4 }) {
  return (
    <dl className={columns === 3 ? 'detail-facts detail-facts-3' : 'detail-facts'}>
      {items.filter((item): item is DetailValue => Boolean(item)).map((item, index) => (
        <div key={index} className={item.span ? `is-${item.span}` : undefined}>
          <dt>{item.label}</dt>
          <dd className={valueClass(item)}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
