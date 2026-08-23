
export function ScheduleBadge() {
  return (
    <span
      aria-label="Lịch lặp lại"
      role="img"
      title="Lịch lặp lại"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '20px',
        height: '20px',
        color: '#1565c0',
        flexShrink: 0,
        pointerEvents: 'none',
      }}
    >
      <i className="ph ph-arrow-counter-clockwise" aria-hidden="true" />
    </span>
  );
}
