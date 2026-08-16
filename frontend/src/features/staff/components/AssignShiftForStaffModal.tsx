import { useState } from 'react';
import type { ApiRecord } from '@/types/api';
import './AttendanceTimekeeping.css';

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

  if (!isOpen || !staff) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const shift = workShifts.find((s) => s.name === selectedShiftName);
    if (shift) {
      onAssign(shift);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Xếp lịch làm việc</h3>
            <p className="modal-subtitle">
              {staff.name} ({staff.code}) · {dayLabel}, {shiftDate}
            </p>
          </div>
          <button type="button" onClick={onClose} className="modal-close-btn">
            <i className="ph ph-x" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group-row">
              <label className="form-label-col" style={{ width: 110 }}>
                Chọn ca làm:
              </label>
              <div className="form-control-col">
                <select
                  value={selectedShiftName}
                  onChange={(e) => setSelectedShiftName(e.target.value)}
                  className="form-input-text"
                  style={{ cursor: 'pointer' }}
                >
                  {workShifts.map((shift, idx) => (
                    <option key={idx} value={shift.name}>
                      {shift.name} ({shift.startsAt} - {shift.endsAt})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {currentShiftName && (
              <div style={{ fontSize: 12, color: '#64748b', background: '#f8fafc', padding: '8px 12px', borderRadius: 8 }}>
                Ca hiện tại: <strong>{currentShiftName}</strong>
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
            <div>
              {currentShiftName && onRemove && (
                <button
                  type="button"
                  onClick={onRemove}
                  className="btn-secondary"
                  style={{ color: '#ef4444', borderColor: '#fca5a5' }}
                >
                  Xóa ca này
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={onClose} className="btn-secondary">
                Bỏ qua
              </button>
              <button type="submit" className="btn-primary">
                Lưu lịch
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
