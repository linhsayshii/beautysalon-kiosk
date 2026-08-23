import { useEffect, useState } from 'react';

interface ApplyWeeksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: { weeks: number; skipLeaves: boolean; skipHolidays: boolean }) => void;
  currentWeekLabel: string;
}

type ApplyMode = 'forever' | 'one' | 'custom';

const styles = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  content: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-inner)',
    width: '90%',
    maxWidth: '400px',
    boxShadow: 'var(--shadow-float)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--line)',
  },
  headerTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--ink-950)',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: 'var(--ink-400)',
    padding: 0,
    lineHeight: 1,
  },
  body: {
    padding: '20px',
  },
  description: {
    margin: '0 0 16px',
    color: 'var(--ink-500)',
    fontSize: '14px',
  },
  radioGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  radioOption: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '12px',
    border: '1px solid var(--line)',
    borderRadius: 'var(--radius-inner)',
    cursor: 'pointer',
    transition: 'border-color 0.15s, background-color 0.15s',
  },
  radioOptionSelected: {
    borderColor: 'var(--blue-600)',
    backgroundColor: 'var(--blue-50)',
  },
  radioLabel: {
    flex: 1,
  },
  radioTitle: {
    fontWeight: 500,
    color: 'var(--ink-900)',
    marginBottom: '2px',
  },
  radioDesc: {
    fontSize: '13px',
    color: 'var(--ink-500)',
  },
  customSection: {
    marginTop: '12px',
    padding: '12px',
    background: 'var(--gray-50)',
    borderRadius: 'var(--radius-inner)',
  },
  rangeWrapper: {
    marginTop: '8px',
  },
  rangeLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '14px',
    color: 'var(--ink-700)',
    marginBottom: '8px',
  },
  rangeInput: {
    width: '100%',
    accentColor: 'var(--blue-600)',
  },
  rangeLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: 'var(--ink-400)',
    marginTop: '4px',
  },
  skipSection: {
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid var(--line)',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    color: 'var(--ink-800)',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '16px 20px',
    borderTop: '1px solid var(--line)',
  },
  buttonBase: {
    padding: '8px 16px',
    borderRadius: 'var(--radius-inner)',
    fontSize: '14px',
    cursor: 'pointer',
    fontWeight: 500,
  },
  buttonSecondary: {
    background: 'var(--surface)',
    border: '1px solid var(--line)',
    color: 'var(--ink-600)',
  },
  buttonPrimary: {
    background: 'var(--blue-600)',
    border: 'none',
    color: 'white',
  },
};

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

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const showSkipOptions = mode !== 'one';
  const showCustomRange = mode === 'custom';

  return (
    <div style={styles.overlay} role="presentation" onMouseDown={handleOverlayClick}>
      <div style={styles.content} role="dialog" aria-modal="true" aria-labelledby="apply-weeks-modal-title">
        <div style={styles.header}>
          <h3 id="apply-weeks-modal-title" style={styles.headerTitle}>
            Áp dụng lịch tuần {currentWeekLabel}
          </h3>
          <button
            type="button"
            style={styles.closeButton}
            onClick={onClose}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        <div style={styles.body}>
          <p style={styles.description}>
            Bạn muốn lặp lại lịch này như thế nào?
          </p>

          <div style={styles.radioGroup}>
            {/* Option 1: Lặp mãi mãi */}
            <label
              style={{
                ...styles.radioOption,
                ...(mode === 'forever' ? styles.radioOptionSelected : {}),
              }}
            >
              <input
                type="radio"
                name="applyMode"
                checked={mode === 'forever'}
                onChange={() => setMode('forever')}
                style={{ marginTop: '3px' }}
              />
              <div style={styles.radioLabel}>
                <div style={styles.radioTitle}>Lặp mãi mãi</div>
                <div style={styles.radioDesc}>Copy lịch sang 52 tuần tới (≈ 1 năm)</div>
              </div>
            </label>

            {/* Option 2: Chỉ tuần này */}
            <label
              style={{
                ...styles.radioOption,
                ...(mode === 'one' ? styles.radioOptionSelected : {}),
              }}
            >
              <input
                type="radio"
                name="applyMode"
                checked={mode === 'one'}
                onChange={() => setMode('one')}
                style={{ marginTop: '3px' }}
              />
              <div style={styles.radioLabel}>
                <div style={styles.radioTitle}>Chỉ tuần này</div>
                <div style={styles.radioDesc}>Áp dụng cho 1 tuần duy nhất</div>
              </div>
            </label>

            {/* Option 3: Chọn số tuần */}
            <label
              style={{
                ...styles.radioOption,
                ...(mode === 'custom' ? styles.radioOptionSelected : {}),
              }}
            >
              <input
                type="radio"
                name="applyMode"
                checked={mode === 'custom'}
                onChange={() => setMode('custom')}
                style={{ marginTop: '3px' }}
              />
              <div style={styles.radioLabel}>
                <div style={styles.radioTitle}>Chọn số tuần</div>
                <div style={styles.radioDesc}>Tự chọn số tuần muốn áp dụng</div>
              </div>
            </label>
          </div>

          {/* Custom weeks slider */}
          {showCustomRange && (
            <div style={styles.customSection}>
              <div style={styles.rangeWrapper}>
                <div style={styles.rangeLabel}>
                  <span>Số tuần:</span>
                  <strong>{customWeeks} tuần</strong>
                </div>
                <input
                  type="range"
                  min={2}
                  max={52}
                  value={customWeeks}
                  onChange={(e) => setCustomWeeks(parseInt(e.target.value))}
                  style={styles.rangeInput}
                />
                <div style={styles.rangeLabels}>
                  <span>2 tuần</span>
                  <span>52 tuần</span>
                </div>
              </div>
            </div>
          )}

          {/* Skip options */}
          {showSkipOptions && (
            <div style={styles.skipSection}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={skipLeaves}
                  onChange={(e) => setSkipLeaves(e.target.checked)}
                />
                Bỏ qua ngày nghỉ phép đã đăng ký
              </label>

              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={skipHolidays}
                  onChange={(e) => setSkipHolidays(e.target.checked)}
                />
                Bỏ qua ngày lễ
              </label>
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <button
            type="button"
            style={{ ...styles.buttonBase, ...styles.buttonSecondary }}
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            type="button"
            style={{ ...styles.buttonBase, ...styles.buttonPrimary }}
            onClick={handleConfirm}
          >
            {getButtonLabel()}
          </button>
        </div>
      </div>
    </div>
  );
}
