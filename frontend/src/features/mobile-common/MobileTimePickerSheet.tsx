import { DateTimePickerModal } from '@/components/ui/DateTimePicker';
import { DEFAULT_BRANCH_TIME_ZONE, localDateTimeFromInstant, zonedLocalDateTimeToIso } from '@/lib/date';

export interface MobileTimePickerSheetProps {
  isOpen: boolean;
  value?: Date | string | null;
  onClose: () => void;
  onSelectTime: (date: Date) => void;
  title?: string;
  timeZone?: string;
}

/**
 * Compatibility wrapper for mobile appointment flows. The picker itself is
 * shared with desktop so both surfaces use the same calendar and time rules.
 */
export function MobileTimePickerSheet({
  isOpen,
  value,
  onClose,
  onSelectTime,
  title = 'Chọn thời gian',
  timeZone = DEFAULT_BRANCH_TIME_ZONE,
}: MobileTimePickerSheetProps) {
  const localValue = value
    ? localDateTimeFromInstant(value, timeZone)
    : localDateTimeFromInstant(new Date(), timeZone);

  return (
    <DateTimePickerModal
      isOpen={isOpen}
      value={localValue}
      onClose={onClose}
      title={title}
      timeZone={timeZone}
      onApply={(localDateTime) => {
        const iso = zonedLocalDateTimeToIso(localDateTime, timeZone);
        if (!iso) return;
        onSelectTime(new Date(iso));
      }}
    />
  );
}
