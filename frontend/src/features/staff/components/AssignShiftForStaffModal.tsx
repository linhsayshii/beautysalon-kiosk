import { useEffect, useState } from 'react';
import { Select } from '@/components/ui/Select/Select';
import type { ApiRecord } from '@/types/api';
import { Modal } from '@/components/ui/Modal/Modal';
import { formatDateOnly } from '@/lib/date';

interface AssignShiftForStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: ApiRecord | null;
  shiftDate: string;
  dayLabel: string;
  workShifts: Array<{ name: string; startsAt: string; endsAt: string }>;
  currentShiftName?: string;
  onAssign: (shift: { name: string; startsAt: string; endsAt: string }) => void;
  onRemove?: () => void;
}

export function AssignShiftForStaffModal({
  isOpen,
  onClose,
  staff,
  shiftDate,
  dayLabel,
  workShifts,
  currentShiftName,
  onAssign,
  onRemove,
}: AssignShiftForStaffModalProps) {
  const [selectedShiftName, setSelectedShiftName] = useState(currentShiftName || workShifts[0]?.name || '');

  useEffect(() => {
    if (!isOpen) return;
    setSelectedShiftName(currentShiftName || workShifts[0]?.name || '');
  }, [isOpen, currentShiftName, workShifts]);

  if (!isOpen || !staff) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const shift = workShifts.find((s) => s.name === selectedShiftName);
    if (shift) {
      onAssign(shift);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Xếp lịch làm việc"
      subtitle={<>{staff.name} ({staff.code}) · {dayLabel}, {formatDateOnly(shiftDate)}</>}
      size="sm"
    >
      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          <div className="field-row">
            <label className="field-label" htmlFor="assign-shift-select">
              Chọn ca làm:
            </label>
            <div className="field-row-control">
              <Select
                id="assign-shift-select"
                value={selectedShiftName}
                onChange={setSelectedShiftName}
                fullWidth
                options={workShifts.map((shift) => ({ value: shift.name, label: `${shift.name} (${shift.startsAt} - ${shift.endsAt})` }))}
              />
            </div>
          </div>

          {currentShiftName && (
            <p className="alert">
              <i className="ph ph-info" />
              <span>Ca hiện tại: <strong>{currentShiftName}</strong></span>
            </p>
          )}
        </div>

        <div className="modal-footer">
          {currentShiftName && onRemove && (
            <button type="button" onClick={onRemove} className="btn btn-danger-soft modal-footer-start">
              Xóa ca này
            </button>
          )}
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Bỏ qua
          </button>
          <button type="submit" className="btn btn-primary" disabled={!selectedShiftName}>
            Lưu lịch
          </button>
        </div>
      </form>
      
    </Modal>
  );
}
