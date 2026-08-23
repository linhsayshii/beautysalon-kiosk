import { useState } from 'react';
import './PropagateModal.css';

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog propagate-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Cập nhật lịch tuần {weekLabel}</h3>
          <button type="button" onClick={onClose} className="modal-close-btn">
            <i className="ph ph-x" />
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-description">
            Bạn đang sửa lịch của tuần {weekLabel}. Áp dụng thay đổi như thế nào?
          </p>

          <div className="radio-group">
            <label className="radio-label">
              <input
                type="radio"
                name="propagate"
                value="true"
                checked={propagate === true}
                onChange={() => setPropagate(true)}
              />
              <span className="radio-content">
                <strong>Áp dụng cho các tuần sau</strong>
                <small>
                  Thay đổi sẽ được áp dụng cho tuần {weekLabel} và tất cả tuần tiếp theo trong nhóm
                </small>
              </span>
            </label>

            <label className="radio-label">
              <input
                type="radio"
                name="propagate"
                value="false"
                checked={propagate === false}
                onChange={() => setPropagate(false)}
              />
              <span className="radio-content">
                <strong>Chỉ cập nhật tuần này</strong>
                <small>Tuần {weekLabel} sẽ tách khỏi nhóm và hoạt động độc lập</small>
              </span>
            </label>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn-secondary">
            Hủy
          </button>
          <button type="button" onClick={handleConfirm} className="btn-primary">
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}
