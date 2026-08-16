export interface SummaryItem { label: string; value: string; note: string; tone?: string }

export function SummaryStrip({ items }: { items: SummaryItem[] }) {
  return <div className="summary-strip">{items.map((item) => <article className={`summary-tile ${item.tone ?? ''}`} key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.note}</small></article>)}</div>;
}
