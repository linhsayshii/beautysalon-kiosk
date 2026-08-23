import React, { useState } from 'react';

export interface DeleteScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (deleteFuture: boolean) => void;
  weekLabel: string;
  hasFutureSchedules: boolean;
  isSourceWeek?: boolean; // True if this schedule is the source of a recurring group
}

export function DeleteScheduleModal({
  isOpen,
  onClose,
  onConfirm,
  weekLabel,
  hasFutureSchedules,
  isSourceWeek = false,
}: DeleteScheduleModalProps) {
  const [deleteOption, setDeleteOption] = useState<'future' | 'current'>('current');

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(deleteOption === 'future');
    onClose();
  };

  // Source week with copies cannot be deleted alone - must cascade delete
  const canDeleteCurrentOnly = !isSourceWeek && hasFutureSchedules;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>Xóa lịch tuần {weekLabel}</h3>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </div>

        <div style={styles.body}>
          {isSourceWeek ? (
            <p style={styles.description}>
              <span style={styles.warningIcon}>⚠️</span>
              Tuần {weekLabel} là tuần nguồn của lịch lặp. Bạn chỉ có thể xóa cùng tất cả các tuần đã copy.
            </p>
          ) : hasFutureSchedules ? (
            <p style={styles.description}>
              Lịch tuần {weekLabel} đang được copy từ tuần trước. Bạn muốn xóa như thế nào?
            </p>
          ) : (
            <p style={styles.description}>
              Bạn có chắc muốn xóa lịch tuần {weekLabel}?
            </p>
          )}

          <div style={styles.radioGroup}>
            {/* Only show "chỉ tuần này" if not a source week */}
            {canDeleteCurrentOnly && (
              <label style={{ ...styles.radioLabel, ...(deleteOption === 'current' ? styles.radioLabelChecked : {}) }}>
                <input
                  type="radio"
                  name="deleteOption"
                  value="current"
                  checked={deleteOption === 'current'}
                  onChange={() => setDeleteOption('current')}
                  style={styles.radioInput}
                />
                <span style={styles.radioContent}>
                  <strong style={styles.radioTitle}>Chỉ xóa tuần này</strong>
                  <small style={styles.radioDesc}>Các tuần sau vẫn giữ nguyên lịch đã copy</small>
                </span>
              </label>
            )}

            {/* Always show cascade delete option */}
            {(hasFutureSchedules || isSourceWeek) && (
              <label style={{ ...styles.radioLabel, ...styles.radioLabelWarning, ...(deleteOption === 'future' ? styles.radioLabelChecked : {}) }}>
                <input
                  type="radio"
                  name="deleteOption"
                  value="future"
                  checked={deleteOption === 'future'}
                  onChange={() => setDeleteOption('future')}
                  style={styles.radioInput}
                />
                <span style={styles.radioContent}>
                  <strong style={styles.radioTitleWarning}>
                    {isSourceWeek ? 'Xóa tuần này và tất cả các tuần đã copy' : 'Xóa tuần này và các tuần sau'}
                  </strong>
                  <small style={styles.radioDescWarning}>
                    {isSourceWeek
                      ? `Cảnh báo: Tất cả lịch copy từ tuần ${weekLabel} sẽ bị xóa`
                      : `Cảnh báo: Tất cả lịch từ tuần ${weekLabel} trở đi sẽ bị xóa`
                    }
                  </small>
                </span>
              </label>
            )}
          </div>
        </div>

        <div style={styles.footer}>
          <button style={styles.cancelBtn} onClick={onClose}>
            Hủy
          </button>
          <button style={styles.deleteBtn} onClick={handleConfirm}>
            Xóa
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '16px',
  },
  modal: {
    background: '#ffffff',
    borderRadius: '14px',
    boxShadow: '0 12px 36px rgba(15, 23, 42, 0.16)',
    width: '100%',
    maxWidth: '420px',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #cbd5e1',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#0f172a',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    lineHeight: 1,
    color: '#64748b',
    cursor: 'pointer',
    padding: '0',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
  },
  body: {
    padding: '20px',
  },
  description: {
    fontSize: '14px',
    color: '#475569',
    marginBottom: '16px',
    lineHeight: 1.5,
  },
  radioGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '12px 14px',
    border: '2px solid #cbd5e1',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'border-color 0.2s, background 0.2s',
  },
  radioLabelChecked: {
    borderColor: '#0062eb',
    background: '#f2f7ff',
  },
  radioLabelWarning: {
    borderColor: '#d97706',
    background: '#fef3c7',
  },
  radioInput: {
    marginTop: '2px',
    width: '18px',
    height: '18px',
    accentColor: '#0062eb',
    cursor: 'pointer',
    flexShrink: 0,
  },
  radioContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  radioTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#0f172a',
  },
  radioDesc: {
    fontSize: '12px',
    color: '#64748b',
  },
  radioTitleWarning: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#856404',
  },
  radioDescWarning: {
    fontSize: '12px',
    color: '#92400e',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    padding: '16px 20px',
    borderTop: '1px solid #cbd5e1',
    background: '#f8fafc',
  },
  cancelBtn: {
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    background: '#ffffff',
    color: '#475569',
    border: '1px solid #cbd5e1',
    transition: 'background 0.2s',
  },
  deleteBtn: {
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    background: '#dc2626',
    color: '#ffffff',
    border: 'none',
    transition: 'background 0.2s',
  },
};
