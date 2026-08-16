import { useState, useMemo } from 'react';
import './AttendanceTimekeeping.css';

export interface ShiftFormValues {
  name: string;
  startsAt: string;
  endsAt: string;
  allowCheckInFrom: string;
  allowCheckInTo: string;
}

interface AddShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: ShiftFormValues) => void;
}

export function AddShiftModal({ isOpen, onClose, onSubmit }: AddShiftModalProps) {
  const [name, setName] = useState('');
  const [startsAt, setStartsAt] = useState('07:00');
  const [endsAt, setEndsAt] = useState('11:00');
  const [allowCheckInFrom, setAllowCheckInFrom] = useState('04:00');
  const [allowCheckInTo, setAllowCheckInTo] = useState('14:00');

  // Calculate total hours difference
  const durationText = useMemo(() => {
    if (!startsAt || !endsAt) return '';
    const [h1, m1] = startsAt.split(':').map(Number);
    const [h2, m2] = endsAt.split(':').map(Number);
    let diffMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diffMinutes < 0) diffMinutes += 24 * 60; // next day wrap
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}p`;
  }, [startsAt, endsAt]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      startsAt,
      endsAt,
      allowCheckInFrom,
      allowCheckInTo,
    });
    setName('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <h3 className="modal-title">Thêm ca làm việc</h3>
          <button
            type="button"
            onClick={onClose}
            className="modal-close-btn"
          >
            <i className="ph ph-x" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Tên ca */}
            <div className="form-group-row">
              <label className="form-label-col">
                Tên
              </label>
              <div className="form-control-col">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VD: Ca sáng Smile"
                  required
                  className="form-input-text"
                />
              </div>
            </div>

            {/* Giờ làm việc */}
            <div className="form-group-row">
              <div className="form-label-col">
                <span>Giờ làm việc</span>
                <i className="ph ph-info" title="Thời gian tính công của ca" />
              </div>
              <div className="form-control-col">
                <input
                  type="time"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  required
                  className="form-input-time"
                />
                <span style={{ fontSize: 12, color: '#64748b' }}>Đến</span>
                <input
                  type="time"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  required
                  className="form-input-time"
                />
                {durationText && (
                  <span className="duration-tag">
                    {durationText}
                  </span>
                )}
              </div>
            </div>

            {/* Giờ cho phép chấm công */}
            <div className="form-group-row">
              <div className="form-label-col">
                <span>Giờ cho phép chấm công</span>
                <i className="ph ph-info" title="Khoảng thời gian nhân viên có thể điểm danh ca này" />
              </div>
              <div className="form-control-col">
                <input
                  type="time"
                  value={allowCheckInFrom}
                  onChange={(e) => setAllowCheckInFrom(e.target.value)}
                  className="form-input-time"
                />
                <span style={{ fontSize: 12, color: '#64748b' }}>Đến</span>
                <input
                  type="time"
                  value={allowCheckInTo}
                  onChange={(e) => setAllowCheckInTo(e.target.value)}
                  className="form-input-time"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              Bỏ qua
            </button>
            <button
              type="submit"
              className="btn-primary"
            >
              Lưu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
