import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal/Modal';

export interface DeleteScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (deleteAllRecurring: boolean) => void;
  weekLabel: string;
  isRecurring: boolean;
}

export function DeleteScheduleModal({
  isOpen,
  onClose,
  onConfirm,
  weekLabel,
  isRecurring,
}: DeleteScheduleModalProps) {
  const [deleteOption, setDeleteOption] = useState<'current' | 'all'>('current');

  useEffect(() => {
    if (isOpen) setDeleteOption('current');
  }, [isOpen]);

  const handleConfirm = () => {
    onConfirm(deleteOption === 'all');
    onClose();
  };

  return (
    <Modal open={isOpen} onClose={onClose} title={`Xóa lịch tuần ${weekLabel}`} size="sm">
      <div className="modal-body">
        <p className="modal-description">
          {isRecurring
            ? 'Bạn muốn xóa một tuần hay toàn bộ chuỗi lịch lặp?'
            : 'Bạn có chắc muốn xóa lịch của tuần này?'}
        </p>

        {isRecurring && (
          <div className="choice-list">
            <label className="choice">
              <input type="radio" name="deleteOption" value="current" checked={deleteOption === 'current'} onChange={() => setDeleteOption('current')} />
              <span className="choice-body">
                <strong className="choice-title">Chỉ xóa tuần này</strong>
                <small className="choice-text">Các tuần còn lại trong chuỗi vẫn được giữ.</small>
              </span>
            </label>
            <label className="choice is-warning">
              <input type="radio" name="deleteOption" value="all" checked={deleteOption === 'all'} onChange={() => setDeleteOption('all')} />
              <span className="choice-body">
                <strong className="choice-title">Xóa tất cả lịch lặp lại</strong>
                <small className="choice-text">Tất cả các tuần trong chuỗi lịch này sẽ bị xóa.</small>
              </span>
            </label>
          </div>
        )}
      </div>

      <footer className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
        <button type="button" className="btn btn-danger" onClick={handleConfirm}>Xóa</button>
      </footer>
    </Modal>
  );
}
