import React, { useEffect, useState } from 'react';
import { useMobileDialog } from '@/features/mobile-common/useMobileDialog';

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
  const { dialogRef, titleId } = useMobileDialog({ isOpen, onClose });

  useEffect(() => {
    if (isOpen) setDeleteOption('current');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(deleteOption === 'all');
    onClose();
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div ref={dialogRef as React.RefObject<HTMLDivElement>} style={styles.modal} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div style={styles.header}>
          <h3 id={titleId} style={styles.title}>Xóa lịch tuần {weekLabel}</h3>
          <button type="button" style={styles.closeBtn} onClick={onClose} aria-label="Đóng">×</button>
        </div>

        <div style={styles.body}>
          <p style={styles.description}>
            {isRecurring
              ? 'Bạn muốn xóa một tuần hay toàn bộ chuỗi lịch lặp?'
              : 'Bạn có chắc muốn xóa lịch của tuần này?'}
          </p>

          {isRecurring && (
            <div style={styles.radioGroup}>
              <label style={{ ...styles.radioLabel, ...(deleteOption === 'current' ? styles.radioLabelChecked : {}) }}>
                <input type="radio" name="deleteOption" value="current" checked={deleteOption === 'current'} onChange={() => setDeleteOption('current')} style={styles.radioInput} />
                <span style={styles.radioContent}>
                  <strong style={styles.radioTitle}>Chỉ xóa tuần này</strong>
                  <small style={styles.radioDesc}>Các tuần còn lại trong chuỗi vẫn được giữ.</small>
                </span>
              </label>

              <label style={{ ...styles.radioLabel, ...styles.radioLabelWarning, ...(deleteOption === 'all' ? styles.radioLabelChecked : {}) }}>
                <input type="radio" name="deleteOption" value="all" checked={deleteOption === 'all'} onChange={() => setDeleteOption('all')} style={styles.radioInput} />
                <span style={styles.radioContent}>
                  <strong style={styles.radioTitleWarning}>Xóa tất cả lịch lặp lại</strong>
                  <small style={styles.radioDescWarning}>Tất cả các tuần trong chuỗi lịch này sẽ bị xóa.</small>
                </span>
              </label>
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <button type="button" style={styles.cancelBtn} onClick={onClose}>Hủy</button>
          <button type="button" style={styles.deleteBtn} onClick={handleConfirm}>Xóa</button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' },
  modal: { background: '#ffffff', borderRadius: '14px', boxShadow: '0 12px 36px rgba(15, 23, 42, 0.16)', width: '100%', maxWidth: '420px', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #cbd5e1' },
  title: { fontSize: '16px', fontWeight: 600, color: '#0f172a', margin: 0 },
  closeBtn: { background: 'none', border: 'none', fontSize: '24px', lineHeight: 1, color: '#64748b', cursor: 'pointer', padding: 0, width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' },
  body: { padding: '20px' },
  description: { fontSize: '14px', color: '#475569', margin: '0 0 16px', lineHeight: 1.5 },
  radioGroup: { display: 'flex', flexDirection: 'column', gap: '10px' },
  radioLabel: { display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 14px', border: '2px solid #cbd5e1', borderRadius: '10px', cursor: 'pointer', transition: 'border-color 0.2s, background 0.2s' },
  radioLabelChecked: { borderColor: '#0062eb', background: '#f2f7ff' },
  radioLabelWarning: { borderColor: '#d97706', background: '#fef3c7' },
  radioInput: { marginTop: '2px', width: '18px', height: '18px', accentColor: '#0062eb', cursor: 'pointer', flexShrink: 0 },
  radioContent: { display: 'flex', flexDirection: 'column', gap: '2px' },
  radioTitle: { fontSize: '14px', fontWeight: 600, color: '#0f172a' },
  radioDesc: { fontSize: '12px', color: '#64748b' },
  radioTitleWarning: { fontSize: '14px', fontWeight: 600, color: '#856404' },
  radioDescWarning: { fontSize: '12px', color: '#92400e' },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 20px', borderTop: '1px solid #cbd5e1', background: '#f8fafc' },
  cancelBtn: { padding: '8px 16px', borderRadius: '6px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1' },
  deleteBtn: { padding: '8px 16px', borderRadius: '6px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', background: '#dc2626', color: '#ffffff', border: 'none' },
};
