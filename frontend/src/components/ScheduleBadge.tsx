
export interface ScheduleBadgeProps {
  groupStartDate: string;
  onClick?: () => void;
}

export function ScheduleBadge({ groupStartDate, onClick }: ScheduleBadgeProps) {
  if (!groupStartDate) return null;

  const weekLabel = formatWeekLabel(groupStartDate);

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 6px',
        background: '#e3f2fd',
        color: '#1565c0',
        borderRadius: '4px',
        fontSize: '11px',
        cursor: 'pointer',
        transition: 'background 0.2s',
        userSelect: 'none',
      }}
      onClick={onClick}
      title={`Copy từ tuần ${weekLabel} - Click để quản lý`}
    >
      <span style={{ fontSize: '10px' }}>↻</span>
      <span>Tuần {weekLabel}</span>
    </span>
  );
}

function formatWeekLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const weekNumber = getWeekNumber(date);
  return `${weekNumber}`;
}

function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}
