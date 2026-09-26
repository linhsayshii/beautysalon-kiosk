import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal/Modal';

interface ApplyWeeksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: { weeks: number; skipLeaves: boolean; skipHolidays: boolean }) => void;
  currentWeekLabel: string;
}

type ApplyMode = 'forever' | 'one' | 'custom';

export function ApplyWeeksModal({
  isOpen,
  onClose,
  onConfirm,
  currentWeekLabel,
}: ApplyWeeksModalProps) {
  const [mode, setMode] = useState<ApplyMode>('forever');
  const [customWeeks, setCustomWeeks] = useState(4);
  const [skipLeaves, setSkipLeaves] = useState(true);
  const [skipHolidays, setSkipHolidays] = useState(true);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode('forever');
      setCustomWeeks(4);
      setSkipLeaves(true);
      setSkipHolidays(true);
    }
  }, [isOpen]);

  const getWeeks = (): number => {
    switch (mode) {
      case 'forever':
        return 52;
      case 'one':
        return 1;
      case 'custom':
        return customWeeks;
    }
  };

  const getButtonLabel = (): string => {
    switch (mode) {
      case 'forever':
        return 'Gán lịch';
      case 'one':
        return 'Gán lịch';
      case 'custom':
        return customWeeks === 1 ? 'Gán lịch' : `Gán cho ${customWeeks} tuần`;
    }
  };

  const handleConfirm = () => {
    const weeks = getWeeks();
    onConfirm({ weeks, skipLeaves, skipHolidays });
    onClose();
  };

  const showSkipOptions = mode !== 'one';
  const showCustomRange = mode === 'custom';

  return (
    <Modal open={isOpen} onClose={onClose} title={`Áp dụng lịch tuần ${currentWeekLabel}`} size="sm">
      <div className="modal-body">
        <p className="modal-description">Bạn muốn lặp lại lịch này như thế nào?</p>

        <div className="choice-list">
          <label className="choice">
            <input type="radio" name="applyMode" checked={mode === 'forever'} onChange={() => setMode('forever')} />
            <span className="choice-body">
              <strong className="choice-title">Lặp mãi mãi</strong>
              <small className="choice-text">Copy lịch sang 52 tuần tới (≈ 1 năm)</small>
            </span>
          </label>
          <label className="choice">
            <input type="radio" name="applyMode" checked={mode === 'one'} onChange={() => setMode('one')} />
            <span className="choice-body">
              <strong className="choice-title">Chỉ tuần này</strong>
              <small className="choice-text">Áp dụng cho 1 tuần duy nhất</small>
            </span>
          </label>
          <label className="choice">
            <input type="radio" name="applyMode" checked={mode === 'custom'} onChange={() => setMode('custom')} />
            <span className="choice-body">
              <strong className="choice-title">Chọn số tuần</strong>
              <small className="choice-text">Tự chọn số tuần muốn áp dụng</small>
            </span>
          </label>
        </div>

        {showCustomRange && (
          <div className="card-inset apply-weeks-range">
            <div className="apply-weeks-range-label">
              <span>Số tuần:</span>
              <strong>{customWeeks} tuần</strong>
            </div>
            <input
              type="range"
              min={2}
              max={52}
              value={customWeeks}
              onChange={(e) => setCustomWeeks(parseInt(e.target.value))}
              aria-label="Số tuần áp dụng"
            />
            <div className="apply-weeks-range-scale">
              <span>2 tuần</span>
              <span>52 tuần</span>
            </div>
          </div>
        )}

        {showSkipOptions && (
          <div className="apply-weeks-skip">
            <label className="check">
              <input type="checkbox" checked={skipLeaves} onChange={(e) => setSkipLeaves(e.target.checked)} />
              Bỏ qua ngày nghỉ phép đã đăng ký
            </label>
            <label className="check">
              <input type="checkbox" checked={skipHolidays} onChange={(e) => setSkipHolidays(e.target.checked)} />
              Bỏ qua ngày lễ
            </label>
          </div>
        )}
      </div>

      <footer className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
        <button type="button" className="btn btn-primary" onClick={handleConfirm}>{getButtonLabel()}</button>
      </footer>
    </Modal>
  );
}
