import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatNumber, initials } from '@/lib/format';
import { getPosStaff } from '@/features/pos/pos.api';
import { MobileTimePickerSheet } from './MobileTimePickerSheet';
import './mobile-common.css';

export interface ConfiguredServiceItem {
  itemId: number;
  itemType: 'product' | 'service' | 'package' | 'account_card';
  name: string;
  unitPrice: number;
  quantity: number;
  durationMinutes?: number;
  startsAt?: Date | string | null;
  staffId?: number | null;
  staffName?: string | null;
  position?: string | null;
  note?: string;
}

export interface MobileServiceItemDetailSheetProps {
  isOpen: boolean;
  item: ConfiguredServiceItem | null;
  staffList?: Array<{ id: number; name: string; role: string; avatarTone?: string }>;
  onClose: () => void;
  onSaveItem: (item: ConfiguredServiceItem) => void;
}

const PRESET_POSITIONS = [
  'Giường 1',
  'Giường 2',
  'Giường 3',
  'Giường 4',
  'Phòng VIP 1',
  'Phòng VIP 2',
  'Phòng VIP 3',
  'Ghế Spa 1',
  'Ghế Spa 2',
  'Bàn Nail 1',
  'Bàn Nail 2',
];

const WEEKDAY_NAMES = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

function padZero(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export function formatDurationLabel(minutes: number | undefined | null): string {
  if (!minutes || minutes <= 0) return "30'";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) {
    return `${hours}h${mins}'`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${mins}'`;
}

export function MobileServiceItemDetailSheet({
  isOpen,
  item,
  staffList: propStaffList,
  onClose,
  onSaveItem,
}: MobileServiceItemDetailSheetProps) {
  // Query fallback if staffList is not provided
  const { data: posStaffResponse } = useQuery({
    queryKey: ['pos-staff'],
    queryFn: getPosStaff,
    enabled: isOpen && (!propStaffList || propStaffList.length === 0),
  });

  const availableStaff = useMemo(() => {
    if (propStaffList && propStaffList.length > 0) return propStaffList;
    return ((posStaffResponse?.data || []) as unknown as Array<{
      id: number;
      name: string;
      role: string;
      avatarTone?: string;
    }>);
  }, [propStaffList, posStaffResponse]);

  // Form State
  const [quantity, setQuantity] = useState<number>(1);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [startsAt, setStartsAt] = useState<Date>(new Date());
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [selectedStaffName, setSelectedStaffName] = useState<string | null>(null);
  const [position, setPosition] = useState<string | null>(null);

  // Sub-sheet pickers
  const [isStaffPickerOpen, setIsStaffPickerOpen] = useState(false);
  const [isPositionPickerOpen, setIsPositionPickerOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [staffSearch, setStaffSearch] = useState('');
  const [customPosition, setCustomPosition] = useState('');

  // Sync state with incoming item
  useEffect(() => {
    if (isOpen && item) {
      setQuantity(item.quantity || 1);
      setDurationMinutes(item.durationMinutes || 60);
      const initialDate = item.startsAt ? new Date(item.startsAt) : new Date();
      setStartsAt(isNaN(initialDate.getTime()) ? new Date() : initialDate);
      setSelectedStaffId(item.staffId ?? null);
      setSelectedStaffName(item.staffName ?? null);
      setPosition(item.position ?? null);
      setCustomPosition(item.position ?? '');
    }
  }, [isOpen, item]);

  const endsAt = useMemo(() => {
    return new Date(startsAt.getTime() + durationMinutes * 60_000);
  }, [startsAt, durationMinutes]);

  const totalPrice = useMemo(() => {
    if (!item) return 0;
    return (item.unitPrice || 0) * quantity;
  }, [item, quantity]);

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    if (!staffSearch.trim()) return availableStaff;
    const q = staffSearch.toLowerCase();
    return availableStaff.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.role && s.role.toLowerCase().includes(q))
    );
  }, [availableStaff, staffSearch]);

  if (!isOpen || !item) return null;

  const handleSave = () => {
    onSaveItem({
      ...item,
      quantity,
      durationMinutes,
      startsAt,
      staffId: selectedStaffId,
      staffName: selectedStaffName,
      position,
    });
    onClose();
  };

  const formattedDateStr = `${WEEKDAY_NAMES[startsAt.getDay()]}, ${padZero(
    startsAt.getDate()
  )}/${padZero(startsAt.getMonth() + 1)}`;
  const formattedTimeRangeStr = `${padZero(startsAt.getHours())}:${padZero(
    startsAt.getMinutes()
  )} - ${padZero(endsAt.getHours())}:${padZero(endsAt.getMinutes())}`;

  return (
    <div
      className="mobile-bottom-sheet-backdrop"
      style={{ zIndex: 95 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Chi tiết lịch dịch vụ"
    >
      <div className="mobile-item-detail-sheet">
        {/* Header */}
        <header className="mobile-item-detail-header">
          <button
            type="button"
            className="mobile-item-detail-back-btn"
            onClick={onClose}
            aria-label="Quay lại"
          >
            <i className="ph ph-caret-left" />
          </button>
          <h2 className="mobile-item-detail-title">Chi tiết lịch dịch vụ</h2>
          <div style={{ width: 36 }} />
        </header>

        <div className="mobile-item-detail-body">
          {/* Item Info Card */}
          <div className="mobile-item-info-card">
            <div className="mobile-item-info-icon">
              <i
                className={
                  item.itemType === 'service'
                    ? 'ph ph-sparkle'
                    : item.itemType === 'package'
                    ? 'ph ph-gift'
                    : item.itemType === 'account_card'
                    ? 'ph ph-credit-card'
                    : 'ph ph-package'
                }
              />
            </div>
            <div className="mobile-item-info-meta">
              <h3 className="mobile-item-info-name">{item.name}</h3>
              <p className="mobile-item-info-duration">
                Thời lượng: {formatDurationLabel(durationMinutes)}
              </p>
            </div>
          </div>

          {/* Quantity & Total Price Strip */}
          <div className="mobile-item-calc-strip">
            <div className="mobile-item-quantity-group">
              <span className="mobile-item-field-label">Số lượng</span>
              <div className="mobile-item-stepper">
                <button
                  type="button"
                  className="mobile-stepper-btn"
                  onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                  aria-label="-"
                >
                  -
                </button>
                <span className="mobile-stepper-value">{quantity}</span>
                <button
                  type="button"
                  className="mobile-stepper-btn"
                  onClick={() => setQuantity((prev) => prev + 1)}
                  aria-label="+"
                >
                  +
                </button>
              </div>
            </div>

            <div className="mobile-item-total-group">
              <span className="mobile-item-field-label">Thành tiền</span>
              <div className="mobile-item-total-pill">
                {formatNumber(totalPrice)}
              </div>
            </div>
          </div>

          {/* Section: LỊCH LÀM DỊCH VỤ */}
          <div className="mobile-item-section">
            <h4 className="mobile-item-section-title">LỊCH LÀM DỊCH VỤ</h4>

            {/* Date & Time Range Pills */}
            <div className="mobile-item-pills-row">
              <button
                type="button"
                className="mobile-item-schedule-pill"
                onClick={() => setIsTimePickerOpen(true)}
              >
                <span>{formattedDateStr}</span>
                <i className="ph ph-calendar-blank" />
              </button>

              <button
                type="button"
                className="mobile-item-schedule-pill"
                onClick={() => setIsTimePickerOpen(true)}
              >
                <span>{formattedTimeRangeStr}</span>
                <i className="ph ph-clock" />
              </button>
            </div>

            {/* Row: Chọn nhân viên */}
            <div
              className="mobile-item-picker-row"
              onClick={() => setIsStaffPickerOpen(true)}
              role="button"
              tabIndex={0}
            >
              <div className="mobile-picker-row-left">
                <i className="ph ph-user-circle mobile-picker-row-icon" />
                <div className="mobile-picker-row-text">
                  <span className="mobile-picker-row-label">Chọn nhân viên</span>
                  {selectedStaffName && (
                    <span className="mobile-picker-row-sub">Đã chọn kỹ thuật viên</span>
                  )}
                </div>
              </div>
              <div className="mobile-picker-row-right">
                <span className="mobile-picker-row-val">
                  {selectedStaffName || 'Chưa chọn'}
                </span>
                <i className="ph ph-caret-right" />
              </div>
            </div>

            {/* Row: Chọn vị trí */}
            <div
              className="mobile-item-picker-row"
              onClick={() => setIsPositionPickerOpen(true)}
              role="button"
              tabIndex={0}
            >
              <div className="mobile-picker-row-left">
                <i className="ph ph-map-pin mobile-picker-row-icon" />
                <div className="mobile-picker-row-text">
                  <span className="mobile-picker-row-label">Chọn vị trí</span>
                  {position && (
                    <span className="mobile-picker-row-sub">Vị trí phòng / giường</span>
                  )}
                </div>
              </div>
              <div className="mobile-picker-row-right">
                <span className="mobile-picker-row-val">
                  {position || 'Chưa chọn'}
                </span>
                <i className="ph ph-caret-right" />
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Bottom Action */}
        <footer className="mobile-item-detail-footer">
          <button
            type="button"
            className="mobile-item-detail-submit-btn"
            onClick={handleSave}
          >
            Xong
          </button>
        </footer>
      </div>

      {/* Staff Picker Sheet */}
      {isStaffPickerOpen && (
        <div
          className="mobile-sub-sheet-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsStaffPickerOpen(false);
          }}
        >
          <div className="mobile-sub-sheet">
            <header className="mobile-sub-sheet-header">
              <button
                type="button"
                className="mobile-item-detail-back-btn"
                onClick={() => setIsStaffPickerOpen(false)}
                aria-label="Quay lại"
              >
                <i className="ph ph-caret-left" />
              </button>
              <h3 className="mobile-sub-sheet-title">Chọn nhân viên</h3>
              <div style={{ width: 36 }} />
            </header>

            <div className="mobile-sub-sheet-search">
              <i className="ph ph-magnifying-glass" />
              <input
                type="text"
                placeholder="Tìm nhân viên..."
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                autoFocus
              />
            </div>

            <div className="mobile-sub-sheet-list">
              <button
                type="button"
                className={`mobile-staff-picker-item ${
                  selectedStaffId === null ? 'is-selected' : ''
                }`}
                onClick={() => {
                  setSelectedStaffId(null);
                  setSelectedStaffName(null);
                  setIsStaffPickerOpen(false);
                }}
              >
                <div className="mobile-staff-avatar no-staff">
                  <i className="ph ph-user-minus" />
                </div>
                <div className="mobile-staff-info">
                  <span className="mobile-staff-name">Chưa chọn nhân viên</span>
                  <span className="mobile-staff-role">Tự động phân bổ sau</span>
                </div>
                {selectedStaffId === null && (
                  <i className="ph ph-check-circle mobile-staff-check" />
                )}
              </button>

              {filteredStaff.map((staff) => {
                const isSelected = selectedStaffId === staff.id;
                return (
                  <button
                    key={staff.id}
                    type="button"
                    className={`mobile-staff-picker-item ${
                      isSelected ? 'is-selected' : ''
                    }`}
                    onClick={() => {
                      setSelectedStaffId(staff.id);
                      setSelectedStaffName(staff.name);
                      setIsStaffPickerOpen(false);
                    }}
                  >
                    <div className="mobile-staff-avatar">
                      {initials(staff.name)}
                    </div>
                    <div className="mobile-staff-info">
                      <span className="mobile-staff-name">{staff.name}</span>
                      <span className="mobile-staff-role">
                        {staff.role || 'Kỹ thuật viên'}
                      </span>
                    </div>
                    {isSelected && (
                      <i className="ph ph-check-circle mobile-staff-check" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Position Picker Sheet */}
      {isPositionPickerOpen && (
        <div
          className="mobile-sub-sheet-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsPositionPickerOpen(false);
          }}
        >
          <div className="mobile-sub-sheet">
            <header className="mobile-sub-sheet-header">
              <button
                type="button"
                className="mobile-item-detail-back-btn"
                onClick={() => setIsPositionPickerOpen(false)}
                aria-label="Quay lại"
              >
                <i className="ph ph-caret-left" />
              </button>
              <h3 className="mobile-sub-sheet-title">Chọn vị trí làm dịch vụ</h3>
              <div style={{ width: 36 }} />
            </header>

            <div className="mobile-sub-sheet-content">
              <div className="mobile-position-custom-row">
                <input
                  type="text"
                  placeholder="Nhập tên phòng / giường..."
                  value={customPosition}
                  onChange={(e) => setCustomPosition(e.target.value)}
                />
                <button
                  type="button"
                  className="mobile-position-apply-btn"
                  onClick={() => {
                    setPosition(customPosition.trim() || null);
                    setIsPositionPickerOpen(false);
                  }}
                >
                  Áp dụng
                </button>
              </div>

              <div className="mobile-position-presets-grid">
                {PRESET_POSITIONS.map((pos) => {
                  const isSelected = position === pos;
                  return (
                    <button
                      key={pos}
                      type="button"
                      className={`mobile-position-pill ${
                        isSelected ? 'is-selected' : ''
                      }`}
                      onClick={() => {
                        setPosition(pos);
                        setCustomPosition(pos);
                        setIsPositionPickerOpen(false);
                      }}
                    >
                      <i className="ph ph-map-pin" />
                      <span>{pos}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Time Picker Sub-sheet */}
      {isTimePickerOpen && (
        <MobileTimePickerSheet
          isOpen={isTimePickerOpen}
          value={startsAt}
          onClose={() => setIsTimePickerOpen(false)}
          onSelectTime={(newDate) => {
            setStartsAt(newDate);
            setIsTimePickerOpen(false);
          }}
        />
      )}
    </div>
  );
}
