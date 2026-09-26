import { useState } from 'react';
import { Modal } from '@/components/ui/Modal/Modal';

interface PropagateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (propagate: boolean) => void;
  weekLabel: string;
}

export function PropagateModal({
  isOpen,
  onClose,
  onConfirm,
  weekLabel,
}: PropagateModalProps) {
  const [propagate, setPropagate] = useState(true);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(propagate);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Cập nhật lịch tuần ${weekLabel}`}
      size="sm"
    >
      <div className="modal-body">
        <p className="modal-description">
          Bạn đang sửa lịch của tuần {weekLabel}. Áp dụng thay đổi như thế nào?
        </p>

        <div className="choice-list">
          <label className="choice">
            <input
              type="radio"
              name="propagate"
              value="true"
              checked={propagate === true}
              onChange={() => setPropagate(true)}
            />
            <span className="choice-body">
              <strong className="choice-title">Áp dụng cho các tuần sau</strong>
              <small className="choice-text">
                Thay đổi sẽ được áp dụng cho tuần {weekLabel} và tất cả tuần tiếp theo trong nhóm
              </small>
            </span>
          </label>

          <label className="choice">
            <input
              type="radio"
              name="propagate"
              value="false"
              checked={propagate === false}
              onChange={() => setPropagate(false)}
            />
            <span className="choice-body">
              <strong className="choice-title">Chỉ cập nhật tuần này</strong>
              <small className="choice-text">Tuần {weekLabel} sẽ tách khỏi nhóm và hoạt động độc lập</small>
            </span>
          </label>
        </div>
      </div>

      <footer className="modal-footer">
        <button type="button" onClick={onClose} className="btn btn-secondary">
          Hủy
        </button>
        <button type="button" onClick={handleConfirm} className="btn btn-primary">
          Xác nhận
        </button>
      </footer>
    </Modal>
  );
}
