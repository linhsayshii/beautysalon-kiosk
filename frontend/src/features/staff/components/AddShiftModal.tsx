import { useState, useMemo } from 'react';
import { TimePickerField } from '@/components/ui/DateTimePicker';
import { Modal } from '@/components/ui/Modal/Modal';

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
    <Modal
      open
      onClose={onClose}
      title="Thêm ca làm việc"
      size="md"
    >
      {/* Body */}
      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          {/* Tên ca */}
          <div className="field-row">
            <label className="field-label">
              Tên
            </label>
            <div className="field-row-control">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Ca sáng Smile"
                required
                className="input"
              />
            </div>
          </div>

          {/* Giờ làm việc */}
          <div className="field-row">
            <div className="field-label">
              <span>Giờ làm việc</span>
              <i className="ph ph-info" title="Thời gian tính công của ca" />
            </div>
            <div className="field-row-control">
              <TimePickerField
                value={startsAt}
                onChange={setStartsAt}
                className="input"
              />
              <span className="field-hint">Đến</span>
              <TimePickerField
                value={endsAt}
                onChange={setEndsAt}
                className="input"
              />
              {durationText && (
                <span className="duration-tag">
                  {durationText}
                </span>
              )}
            </div>
          </div>

          {/* Giờ cho phép chấm công */}
          <div className="field-row">
            <div className="field-label">
              <span>Giờ cho phép chấm công</span>
              <i className="ph ph-info" title="Khoảng thời gian nhân viên có thể điểm danh ca này" />
            </div>
            <div className="field-row-control">
              <TimePickerField
                value={allowCheckInFrom}
                onChange={setAllowCheckInFrom}
                className="input"
              />
              <span className="field-hint">Đến</span>
              <TimePickerField
                value={allowCheckInTo}
                onChange={setAllowCheckInTo}
                className="input"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
          >
            Bỏ qua
          </button>
          <button
            type="submit"
            className="btn btn-primary"
          >
            Lưu
          </button>
        </div>
      </form>
      
    </Modal>
  );
}
