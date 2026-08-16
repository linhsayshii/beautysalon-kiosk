import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { formatNumber } from '@/lib/format';
import {
  createPosAppointment,
  getPosCatalog,
  getPosStaff,
} from '@/features/pos/pos.api';
import {
  MobileCustomerSelectSheet,
  type MobileCustomer,
} from '@/features/mobile-common/MobileCustomerSelectSheet';
import { MobileTimePickerSheet } from '@/features/mobile-common/MobileTimePickerSheet';
import {
  MobileServiceItemDetailSheet,
  type ConfiguredServiceItem,
} from '@/features/mobile-common/MobileServiceItemDetailSheet';
import './mobile-appointments.css';

interface AppointmentStatusOption {
  value: string;
  label: string;
}

const APPOINTMENT_STATUSES: AppointmentStatusOption[] = [
  { value: 'pending', label: 'Chờ xác nhận' },
  { value: 'confirmed', label: 'Chưa tới' },
  { value: 'waiting', label: 'Đang chờ' },
  { value: 'in_service', label: 'Đang làm' },
  { value: 'completed', label: 'Hoàn thành' },
];

const WEEKDAY_NAMES = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

function padZero(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export function MobileAppointmentCreateView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify } = useToast();

  // Selected State
  const [customer, setCustomer] = useState<MobileCustomer | null>(null);
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [configuredItems, setConfiguredItems] = useState<ConfiguredServiceItem[]>([]);
  const [status, setStatus] = useState<string>('confirmed');
  const [note, setNote] = useState<string>('');

  // Modals / Sheets State
  const [isCustomerSheetOpen, setIsCustomerSheetOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [isCatalogSheetOpen, setIsCatalogSheetOpen] = useState(false);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [tempNote, setTempNote] = useState('');

  // Currently editing service item in detail sheet
  const [activeEditingItem, setActiveEditingItem] = useState<ConfiguredServiceItem | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Catalog search state
  const [catalogSearch, setCatalogSearch] = useState('');

  // Fetch Catalog & Staff queries
  const { data: catalogResponse } = useQuery({
    queryKey: ['pos-catalog', catalogSearch, 'service'],
    queryFn: () => getPosCatalog(catalogSearch, 'service'),
  });

  const { data: staffResponse } = useQuery({
    queryKey: ['pos-staff'],
    queryFn: getPosStaff,
  });

  const catalogItems = useMemo(() => {
    return (catalogResponse?.data || []) as unknown as Array<{
      itemId: number;
      itemType: 'product' | 'service' | 'package' | 'account_card';
      code: string;
      name: string;
      category: string;
      unit: string;
      salePrice: number;
      stockQuantity: number | null;
    }>;
  }, [catalogResponse]);

  const staffList = useMemo(() => {
    return (staffResponse?.data || []) as unknown as Array<{
      id: number;
      name: string;
      role: string;
      avatarTone?: string;
    }>;
  }, [staffResponse]);

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof createPosAppointment>[0]) => createPosAppointment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-appointments'] });
      notify('Tạo lịch hẹn thành công', `${customer?.name || 'Khách hàng'} đã được thêm vào lịch.`);
      navigate(-1);
    },
    onError: (err: any) => {
      notify('Lỗi tạo lịch hẹn', err?.message || 'Không thể tạo lịch hẹn. Vui lòng thử lại.');
    },
  });

  // Calculate formatted start time string: "Bắt đầu làm HH:MM - Thứ X, DD/MM"
  const formattedStartTimeTitle = useMemo(() => {
    const hours = padZero(startTime.getHours());
    const mins = padZero(startTime.getMinutes());
    const weekday = WEEKDAY_NAMES[startTime.getDay()];
    const day = padZero(startTime.getDate());
    const month = padZero(startTime.getMonth() + 1);
    return `Bắt đầu làm ${hours}:${mins} - ${weekday}, ${day}/${month}`;
  }, [startTime]);

  // Handle open catalog to add service
  const handleOpenCatalog = () => {
    setIsCatalogSheetOpen(true);
  };

  // When catalog item is tapped, prepare configured item and open detail sheet immediately
  const handleSelectCatalogItem = (catItem: (typeof catalogItems)[0]) => {
    const newItem: ConfiguredServiceItem = {
      itemId: catItem.itemId,
      itemType: catItem.itemType,
      name: catItem.name,
      unitPrice: catItem.salePrice,
      quantity: 1,
      durationMinutes: 60,
      startsAt: startTime,
      staffId: null,
      staffName: null,
      position: null,
    };
    setActiveEditingItem(newItem);
    setEditingIndex(null); // Adding new
    setIsCatalogSheetOpen(false);
    setIsDetailSheetOpen(true);
  };

  // When tapping an already added item in the list
  const handleEditItem = (item: ConfiguredServiceItem, index: number) => {
    setActiveEditingItem(item);
    setEditingIndex(index);
    setIsDetailSheetOpen(true);
  };

  // Saving item from detail sheet
  const handleSaveConfiguredItem = (savedItem: ConfiguredServiceItem) => {
    if (editingIndex !== null && editingIndex >= 0) {
      setConfiguredItems((prev) =>
        prev.map((item, idx) => (idx === editingIndex ? savedItem : item))
      );
    } else {
      setConfiguredItems((prev) => [...prev, savedItem]);
    }
  };

  // Remove item
  const handleRemoveItem = (index: number) => {
    setConfiguredItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Save / Submit Appointment
  const handleSubmit = () => {
    if (!customer) {
      notify('Chưa chọn khách hàng', 'Vui lòng chọn khách hàng cho lịch hẹn.');
      return;
    }
    if (configuredItems.length === 0) {
      notify('Chưa có dịch vụ', 'Vui lòng thêm ít nhất một dịch vụ hoặc sản phẩm.');
      return;
    }

    const firstItem = configuredItems[0];
    const totalDuration = configuredItems.reduce(
      (sum, item) => sum + (item.durationMinutes || 60) * item.quantity,
      0
    );
    const itemStartsAt = firstItem.startsAt ? new Date(firstItem.startsAt) : startTime;
    const endsAt = new Date(itemStartsAt.getTime() + totalDuration * 60_000);

    const payload = {
      customerId: customer.id,
      serviceId: firstItem.itemId,
      staffId: firstItem.staffId || null,
      startsAt: itemStartsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      status,
      note: note.trim() || undefined,
    };

    createMutation.mutate(payload);
  };

  return (
    <div className="mobile-form-view-container">
      {/* Top Header */}
      <header className="mobile-form-header">
        <div className="mobile-form-header-left">
          <button
            type="button"
            className="mobile-form-back-btn"
            onClick={() => navigate(-1)}
            aria-label="Quay lại"
          >
            <i className="ph ph-caret-left" />
          </button>
          <h1 className="mobile-form-header-title">Tạo lịch</h1>
        </div>

        <div className="mobile-form-header-actions">
          <button
            type="button"
            className={`mobile-form-icon-btn ${note ? 'has-note' : ''}`}
            onClick={() => {
              setTempNote(note);
              setIsNoteDialogOpen(true);
            }}
            aria-label="Ghi chú lịch hẹn"
            title="Ghi chú"
          >
            <i className="ph ph-note" />
          </button>
        </div>
      </header>

      {/* Main Body Form Cards */}
      <div className="mobile-form-body">
        {/* Card 1: Customer & Time Information */}
        <section className="mobile-form-card">
          {/* Customer Row */}
          <div
            className="mobile-form-row"
            onClick={() => setIsCustomerSheetOpen(true)}
            role="button"
            tabIndex={0}
          >
            <div className="mobile-form-row-left">
              <div className="mobile-form-row-icon is-customer">
                <i className="ph ph-user" />
              </div>
              <div className="mobile-form-row-info">
                {customer ? (
                  <>
                    <span className="mobile-form-row-title">{customer.name}</span>
                    <span className="mobile-form-row-subtitle">
                      {customer.phone || 'Chưa lưu số điện thoại'}
                      {customer.remainingPackageUnits !== undefined && customer.remainingPackageUnits > 0 && (
                        <span> • Còn {customer.remainingPackageUnits} buổi DV</span>
                      )}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="mobile-form-row-title">Thêm khách hàng</span>
                    <span className="mobile-form-row-subtitle">
                      Chọn hoặc tạo khách hàng mới
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="mobile-form-row-right">
              {customer ? (
                <button
                  type="button"
                  className="mobile-form-row-clear"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCustomer(null);
                  }}
                  aria-label="Xóa khách hàng"
                >
                  <i className="ph ph-x" />
                </button>
              ) : (
                <i className="ph ph-caret-right" />
              )}
            </div>
          </div>

          {/* Time Picker Row */}
          <div
            className="mobile-form-row"
            onClick={() => setIsTimePickerOpen(true)}
            role="button"
            tabIndex={0}
          >
            <div className="mobile-form-row-left">
              <div className="mobile-form-row-icon is-time">
                <i className="ph ph-calendar" />
              </div>
              <div className="mobile-form-row-info">
                <span className="mobile-form-row-title">{formattedStartTimeTitle}</span>
                <span className="mobile-form-row-subtitle">
                  Chạm để thay đổi ngày giờ bắt đầu
                </span>
              </div>
            </div>

            <div className="mobile-form-row-right">
              <i className="ph ph-caret-right" />
            </div>
          </div>
        </section>

        {/* Card 2: Services & Products List */}
        <section className="mobile-form-card mobile-form-items-card">
          {configuredItems.length === 0 ? (
            /* Empty State */
            <div className="mobile-form-empty-items">
              <div className="mobile-form-empty-icon">
                <i className="ph ph-calendar-x" />
              </div>
              <div className="mobile-form-empty-text">Chưa có dịch vụ, sản phẩm</div>
              <button
                type="button"
                className="mobile-form-add-btn"
                onClick={handleOpenCatalog}
              >
                <i className="ph ph-plus-circle" />
                <span>Thêm dịch vụ, sản phẩm</span>
              </button>
            </div>
          ) : (
            /* Non-Empty State */
            <div>
              <div className="mobile-form-items-list">
                {configuredItems.map((item, idx) => (
                  <div
                    key={`${item.itemId}-${idx}`}
                    className="mobile-form-item-card"
                    onClick={() => handleEditItem(item, idx)}
                  >
                    <div className="mobile-form-item-main">
                      <div className="mobile-form-item-left">
                        <div className="mobile-form-item-icon">
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
                        <div>
                          <div className="mobile-form-item-name">
                            {item.quantity > 1 ? `${item.quantity}x ` : ''}
                            {item.name}
                          </div>
                        </div>
                      </div>
                      <div className="mobile-form-item-price">
                        {formatNumber((item.unitPrice || 0) * item.quantity)}
                      </div>
                    </div>

                    {/* Assigned tags */}
                    <div className="mobile-form-item-tags">
                      {item.staffName ? (
                        <span className="mobile-form-tag is-staff">
                          <i className="ph ph-user-check" />
                          {item.staffName}
                        </span>
                      ) : (
                        <span className="mobile-form-tag">
                          <i className="ph ph-user" />
                          Chưa phân thợ
                        </span>
                      )}

                      {item.position && (
                        <span className="mobile-form-tag is-pos">
                          <i className="ph ph-map-pin" />
                          {item.position}
                        </span>
                      )}

                      <button
                        type="button"
                        className="mobile-form-item-remove-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveItem(idx);
                        }}
                        aria-label="Xóa mặt hàng"
                      >
                        <i className="ph ph-trash" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="mobile-form-add-btn"
                onClick={handleOpenCatalog}
              >
                <i className="ph ph-plus" />
                <span>Thêm dịch vụ, sản phẩm</span>
              </button>
            </div>
          )}
        </section>

        {/* Card 3: Status Selection Pills */}
        <section className="mobile-form-card mobile-form-status-card">
          <div className="mobile-form-section-label">Trạng thái lịch hẹn</div>
          <div className="mobile-form-status-grid">
            {APPOINTMENT_STATUSES.map((st) => {
              const isActive = status === st.value;
              return (
                <button
                  key={st.value}
                  type="button"
                  className={`mobile-form-status-pill ${isActive ? 'is-active' : ''}`}
                  onClick={() => setStatus(st.value)}
                >
                  {st.label}
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Fixed Bottom Save Button */}
      <footer className="mobile-form-footer">
        <button
          type="button"
          className="mobile-form-submit-btn"
          onClick={handleSubmit}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? (
            <>
              <i className="ph ph-spinner spin" />
              <span>Đang lưu...</span>
            </>
          ) : (
            <span>Lưu</span>
          )}
        </button>
      </footer>

      {/* Customer Select Sheet */}
      <MobileCustomerSelectSheet
        isOpen={isCustomerSheetOpen}
        selectedCustomerId={customer?.id}
        onClose={() => setIsCustomerSheetOpen(false)}
        onSelectCustomer={(c) => {
          setCustomer(c);
          setIsCustomerSheetOpen(false);
        }}
      />

      {/* Time Picker Sheet */}
      <MobileTimePickerSheet
        isOpen={isTimePickerOpen}
        value={startTime}
        onClose={() => setIsTimePickerOpen(false)}
        onSelectTime={(date) => {
          setStartTime(date);
          setIsTimePickerOpen(false);
        }}
      />

      {/* Catalog Sheet */}
      {isCatalogSheetOpen && (
        <div
          className="mobile-catalog-sheet-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCatalogSheetOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Chọn dịch vụ, sản phẩm"
        >
          <div className="mobile-catalog-sheet">
            <header className="mobile-catalog-sheet-header">
              <h3>Chọn dịch vụ, sản phẩm</h3>
              <button
                type="button"
                className="mobile-appointment-back-btn"
                onClick={() => setIsCatalogSheetOpen(false)}
                aria-label="Đóng"
              >
                <i className="ph ph-x" />
              </button>
            </header>

            <div className="mobile-catalog-sheet-search">
              <i className="ph ph-magnifying-glass" />
              <input
                type="text"
                placeholder="Tìm tên dịch vụ, sản phẩm..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                autoFocus
              />
            </div>

            <div className="mobile-catalog-items-list">
              {catalogItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
                  Không tìm thấy mặt hàng nào
                </div>
              ) : (
                catalogItems.map((cat) => (
                  <div
                    key={`${cat.itemType}-${cat.itemId}`}
                    className="mobile-catalog-item-row"
                    onClick={() => handleSelectCatalogItem(cat)}
                  >
                    <div className="mobile-catalog-item-info">
                      <span className="mobile-catalog-item-name">{cat.name}</span>
                      <span className="mobile-catalog-item-cat">
                        {cat.category || 'Dịch vụ'} {cat.code ? `• ${cat.code}` : ''}
                      </span>
                    </div>
                    <span className="mobile-catalog-item-price">
                      {formatNumber(cat.salePrice)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Service Item Detail Sheet */}
      <MobileServiceItemDetailSheet
        isOpen={isDetailSheetOpen}
        item={activeEditingItem}
        staffList={staffList}
        onClose={() => {
          setIsDetailSheetOpen(false);
          setActiveEditingItem(null);
          setEditingIndex(null);
        }}
        onSaveItem={handleSaveConfiguredItem}
      />

      {/* Note Dialog */}
      {isNoteDialogOpen && (
        <div
          className="mobile-note-dialog-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsNoteDialogOpen(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="mobile-note-dialog">
            <div className="mobile-note-dialog-header">
              <h3>Ghi chú lịch hẹn</h3>
              <button
                type="button"
                className="mobile-appointment-back-btn"
                onClick={() => setIsNoteDialogOpen(false)}
              >
                <i className="ph ph-x" />
              </button>
            </div>
            <div className="mobile-note-dialog-body">
              <textarea
                placeholder="Nhập ghi chú cho lịch hẹn (yêu cầu riêng của khách, dặn dò thợ...)"
                value={tempNote}
                onChange={(e) => setTempNote(e.target.value)}
                autoFocus
              />
            </div>
            <div className="mobile-note-dialog-footer">
              <button
                type="button"
                className="mobile-note-cancel-btn"
                onClick={() => setIsNoteDialogOpen(false)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="mobile-note-save-btn"
                onClick={() => {
                  setNote(tempNote);
                  setIsNoteDialogOpen(false);
                }}
              >
                Lưu ghi chú
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
