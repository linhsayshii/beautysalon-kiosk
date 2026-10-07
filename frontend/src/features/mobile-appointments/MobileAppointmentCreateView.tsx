import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatMoney } from '@/lib/format';
import {
  createPosAppointment,
  getPosAppointmentEditor,
  savePosAppointmentEditor,
  getPosCatalog,
  getPosCustomerServicePackages,
  getPosStaff,
  type ServicePackageOption,
} from '@/features/pos/pos.api';
import { UsePackageModal } from '@/features/pos/components/UsePackageModal';
import {
  MobileCustomerSelectSheet,
  type MobileCustomer,
} from '@/features/mobile-common/MobileCustomerSelectSheet';
import { MobileTimePickerSheet } from '@/features/mobile-common/MobileTimePickerSheet';
import {
  MobileServiceItemDetailSheet,
  type ConfiguredServiceItem,
} from '@/features/mobile-common/MobileServiceItemDetailSheet';
import { MobileHeaderAction, MobilePageHeader } from '@/components/ui/MobilePageHeader/MobilePageHeader';
import { BottomSheet } from '@/components/ui/Sheet/BottomSheet';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { APPOINTMENT_STATUS_LABELS } from '@/lib/appointment-status';

interface AppointmentStatusOption {
  value: string;
  label: string;
}

const APPOINTMENT_STATUSES: AppointmentStatusOption[] = (['pending', 'confirmed', 'waiting', 'in_service', 'completed'] as const)
  .map((value) => ({ value, label: APPOINTMENT_STATUS_LABELS[value] }));

const WEEKDAY_NAMES = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

function padZero(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export function MobileAppointmentCreateView() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editingId = id ? Number(id) : null;
  const loadedId = useRef<number | null>(null);
  const editorQuery = useQuery({ queryKey: ['appointment-editor', editingId], queryFn: () => getPosAppointmentEditor(editingId!), enabled: Boolean(editingId) });
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { account } = useAuth();

  // Selected State
  const [customer, setCustomer] = useState<MobileCustomer | null>(null);
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [configuredItems, setConfiguredItems] = useState<ConfiguredServiceItem[]>([]);
  const [status, setStatus] = useState<string>('confirmed');
  const [note, setNote] = useState<string>('');

  useEffect(() => {
    if (!editingId || !editorQuery.data?.data || loadedId.current === editingId) return;
    const data = editorQuery.data.data;
    loadedId.current = editingId;
    setCustomer(data.customer);
    setStartTime(new Date(data.startsAt));
    setConfiguredItems(data.items.map((item: ConfiguredServiceItem) => ({ ...item, startsAt: new Date(item.startsAt!) })));
    setStatus(data.status);
    setNote(data.note || '');
  }, [editingId, editorQuery.data]);

  // Modals / Sheets State
  const [isCustomerSheetOpen, setIsCustomerSheetOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [isCatalogSheetOpen, setIsCatalogSheetOpen] = useState(false);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [packagePromptCustomerId, setPackagePromptCustomerId] = useState<number | null>(null);
  const [tempNote, setTempNote] = useState('');
  const catalogSearchRef = useRef<HTMLInputElement>(null);

  // Currently editing service item in detail sheet
  const [activeEditingItem, setActiveEditingItem] = useState<ConfiguredServiceItem | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Catalog search state
  const [catalogSearch, setCatalogSearch] = useState('');

  // Fetch Catalog & Staff queries
  const catalogQuery = useQuery({
    queryKey: ['pos-catalog', catalogSearch, 'service', customer?.id ?? null],
    queryFn: () => getPosCatalog(catalogSearch, 'service', customer?.id),
  });
  const catalogResponse = catalogQuery.data;

  const servicePackagesQuery = useQuery({
    queryKey: ['pos-customer-service-packages', customer?.id ?? null],
    queryFn: () => getPosCustomerServicePackages(customer!.id),
    enabled: Boolean(customer?.id),
  });
  const servicePackages = (servicePackagesQuery.data?.data || []) as ServicePackageOption[];

  useEffect(() => {
    if (editingId || !customer?.id || servicePackagesQuery.isPending || packagePromptCustomerId === customer.id) return;

    setPackagePromptCustomerId(customer.id);
    if (servicePackages.length > 0) setIsPackageModalOpen(true);
  }, [customer?.id, packagePromptCustomerId, servicePackages, servicePackagesQuery.isPending]);

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
    mutationFn: (payload: Parameters<typeof createPosAppointment>[0]) => editingId ? savePosAppointmentEditor(editingId, payload) : createPosAppointment(payload),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['pos-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['my-work-items'] });
      queryClient.invalidateQueries({ queryKey: ['pos-invoice'] });
      queryClient.invalidateQueries({ queryKey: ['pos-payment-requests'] });
      queryClient.invalidateQueries({ queryKey: ['appointment-editor'] });
      const count = response.data?.appointments?.length || configuredItems.length;
      notify(editingId ? 'Đã lưu thay đổi lịch hẹn' : 'Tạo lịch hẹn thành công', `${customer?.name || 'Khách hàng'} có ${count} công việc dịch vụ trong cùng hóa đơn nháp.`);
      navigate('/m/appointments');
    },
    onError: (err: any) => {
      notify(editingId ? 'Không thể lưu thay đổi' : 'Lỗi tạo lịch hẹn', err?.message || 'Không thể tạo lịch hẹn. Vui lòng thử lại.');
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
    };
    setActiveEditingItem(newItem);
    setEditingIndex(null); // Adding new
    setIsCatalogSheetOpen(false);
    setIsDetailSheetOpen(true);
  };

  const handlePackageServiceSelect = (customerPackageId: number, serviceId: number) => {
    const selectedPackage = servicePackages.find((pkg) => pkg.customerPackageId === customerPackageId);
    const selectedService = selectedPackage?.services.find((service) => service.serviceId === serviceId);
    if (!selectedPackage || !selectedService) {
      notify('Gói dịch vụ không khả dụng', 'Vui lòng chọn lại gói dịch vụ còn lượt.');
      return;
    }

    const existingItemIndex = configuredItems.findIndex(
      (item) => item.usePackageId === customerPackageId && item.usePackageServiceId === serviceId,
    );
    if (existingItemIndex >= 0) {
      setActiveEditingItem({
        ...configuredItems[existingItemIndex],
        maxQuantity: selectedService.availableUnits,
      });
      setEditingIndex(existingItemIndex);
    } else {
      setActiveEditingItem({
        itemId: selectedService.serviceId,
        itemType: 'service',
        name: selectedService.serviceName,
        unitPrice: 0,
        quantity: 1,
        durationMinutes: 60,
        startsAt: startTime,
        staffId: null,
        staffName: null,
        usePackageId: customerPackageId,
        usePackageServiceId: selectedService.serviceId,
        packageName: selectedPackage.packageName,
        maxQuantity: selectedService.availableUnits,
      });
      setEditingIndex(null);
    }

    setIsPackageModalOpen(false);
    setIsDetailSheetOpen(true);
  };

  const handleCustomerSelected = (selectedCustomer: MobileCustomer) => {
    if (customer && customer.id !== selectedCustomer.id) {
      setConfiguredItems((items) => items.filter((item) => !item.usePackageId));
    }
    setCustomer(selectedCustomer);
    setPackagePromptCustomerId(null);
    setIsPackageModalOpen(false);
    setIsCustomerSheetOpen(false);
  };

  const handleCustomerCleared = () => {
    setCustomer(null);
    setConfiguredItems((items) => items.filter((item) => !item.usePackageId));
    setPackagePromptCustomerId(null);
    setIsPackageModalOpen(false);
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
      notify('Chưa có dịch vụ', 'Vui lòng thêm ít nhất một dịch vụ.');
      return;
    }

    const payload = {
      customerId: customer.id,
      status,
      note: note.trim(),
      items: configuredItems.map((item) => {
        const itemStartsAt = item.startsAt ? new Date(item.startsAt) : startTime;
        const endsAt = new Date(itemStartsAt.getTime() + (item.durationMinutes || 60) * 60_000);
        return {
          appointmentId: item.appointmentId,
          status: editingId && status === editorQuery.data?.data?.status ? item.status || status : status,
          note: editingId && note === editorQuery.data?.data?.note ? item.note ?? note : note,
          serviceId: item.itemId,
          staffId: item.staffId || null,
          consultantStaffId: item.consultantStaffId || null,
          quantity: item.quantity,
          usePackageId: item.usePackageId || null,
          usePackageServiceId: item.usePackageServiceId || null,
          startsAt: itemStartsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        };
      }),
    };

    createMutation.mutate(payload);
  };

  if (editingId && (editorQuery.isPending || editorQuery.isError || editorQuery.data?.data?.invoiceStatus !== 'draft')) {
    return (
      <div className="mobile-form-view-container">
        <MobilePageHeader title="Sửa lịch hẹn" backTo="/m/appointments" />
        {editorQuery.isPending ? (
          <LoadingState compact label="Đang tải lịch hẹn…" />
        ) : editorQuery.isError ? (
          <ErrorState compact error={editorQuery.error} onRetry={() => editorQuery.refetch()} />
        ) : (
          <EmptyState
            compact
            icon="ph ph-receipt"
            title="Không thể chỉnh sửa lịch"
            message="Hóa đơn đã ghi nhận thanh toán. Vui lòng mở hóa đơn để xử lý điều chỉnh."
            action={<button type="button" className="btn btn-secondary" onClick={() => navigate('/m/appointments')}>Về lịch dịch vụ</button>}
          />
        )}
      </div>
    );
  }

  return (
    <div className="m-page mobile-form-view-container">
      <MobilePageHeader
        title={editingId ? 'Sửa lịch hẹn' : 'Tạo lịch hẹn'}
        onBack={() => navigate(-1)}
        actions={(
          <MobileHeaderAction
            icon="ph ph-note"
            label="Ghi chú lịch hẹn"
            tone={note ? 'soft' : 'ghost'}
            onClick={() => {
              setTempNote(note);
              setIsNoteDialogOpen(true);
            }}
          />
        )}
      />

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
            onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setIsCustomerSheetOpen(true); } }}
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
                        <span> · Còn {customer.remainingPackageUnits} buổi DV</span>
                      )}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="mobile-form-row-title">Chọn khách hàng</span>
                    <span className="mobile-form-row-subtitle">
                      Chạm để tìm hoặc thêm khách hàng
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
                    handleCustomerCleared();
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
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setIsTimePickerOpen(true); } }}
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
              <div className="mobile-form-empty-text">Chưa có dịch vụ</div>
              <button
                type="button"
                className="mobile-form-add-btn"
                onClick={handleOpenCatalog}
              >
                <i className="ph ph-plus-circle" />
                <span>Thêm dịch vụ</span>
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
                        {formatMoney((item.unitPrice || 0) * item.quantity)}
                      </div>
                    </div>

                    {/* Assigned tags */}
                    <div className="mobile-form-item-tags">
                      <div className="mobile-form-item-tag-list">
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

                        {item.consultantStaffName && (
                          <span className="mobile-form-tag is-staff">
                            <i className="ph ph-handshake" />
                            Tư vấn: {item.consultantStaffName}
                          </span>
                        )}

                        {item.usePackageId && (
                          <span
                            className="mobile-form-tag is-package"
                            title={item.packageName ? `Dùng gói: ${item.packageName}` : 'Dùng gói dịch vụ'}
                          >
                            <i className="ph ph-ticket" />
                            <span className="mobile-form-package-tag-label">
                              {item.packageName ? `Dùng gói: ${item.packageName}` : 'Dùng gói dịch vụ'}
                            </span>
                          </span>
                        )}
                      </div>

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
                <span>Thêm dịch vụ</span>
              </button>
            </div>
          )}
        </section>

        {/* Card 3: Status Selection Pills */}
        <section className="mobile-form-card mobile-form-status-card m-section">
          <span className="m-section-title">Trạng thái lịch hẹn</span>
          <div className="mobile-form-status-grid">
            {APPOINTMENT_STATUSES.map((st) => {
              const isActive = status === st.value;
              return (
                <button
                  key={st.value}
                  type="button"
                  className={`mobile-form-status-pill ${isActive ? 'is-active' : ''}`}
                  data-status={st.value}
                  aria-pressed={isActive}
                  onClick={() => setStatus(st.value)}
                >
                  {st.label}
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <div className="m-footer">
        <button
          type="button"
          className="btn btn-primary btn-lg btn-block"
          onClick={handleSubmit}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? (
            <>
              <i className="ph ph-spinner spin" />
              <span>Đang lưu...</span>
            </>
          ) : (
            <span>{editingId ? 'Lưu thay đổi' : 'Lưu'}</span>
          )}
        </button>
      </div>

      {/* Customer Select Sheet */}
      <MobileCustomerSelectSheet
        isOpen={isCustomerSheetOpen}
        selectedCustomerId={customer?.id}
        onClose={() => setIsCustomerSheetOpen(false)}
        onSelectCustomer={handleCustomerSelected}
      />

      <UsePackageModal
        isOpen={isPackageModalOpen}
        packages={servicePackages}
        onClose={() => setIsPackageModalOpen(false)}
        onSelect={handlePackageServiceSelect}
      />

      {/* Time Picker Sheet */}
      <MobileTimePickerSheet
        isOpen={isTimePickerOpen}
        value={startTime}
        timeZone={account?.branchTimezone}
        onClose={() => setIsTimePickerOpen(false)}
        onSelectTime={(date) => {
          const delta = date.getTime() - startTime.getTime();
          setConfiguredItems(items => items.map(item => ({ ...item, startsAt: new Date(new Date(item.startsAt || startTime).getTime() + delta) })));
          setStartTime(date);
          setIsTimePickerOpen(false);
        }}
      />

      <BottomSheet
        open={isCatalogSheetOpen}
        onClose={() => setIsCatalogSheetOpen(false)}
        title="Chọn dịch vụ"
        height="full"
        initialFocusRef={catalogSearchRef}
        headerExtra={(
          <div className="sheet-toolbar">
            <label className="input-group">
              <i className="ph ph-magnifying-glass" aria-hidden="true" />
              <input
                ref={catalogSearchRef}
                type="search"
                aria-label="Tìm dịch vụ"
                placeholder="Tìm tên dịch vụ..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
              />
            </label>
          </div>
        )}
      >
        <div className="mobile-catalog-items-list">
        {catalogQuery.isPending ? (
          <LoadingState compact />
        ) : catalogQuery.error ? (
          <ErrorState compact error={catalogQuery.error} onRetry={() => catalogQuery.refetch()} />
        ) : catalogItems.length === 0 ? (
          <EmptyState compact title="Không tìm thấy mặt hàng nào" message={null} />
        ) : (
          catalogItems.map((cat) => (
            <button
              type="button"
              key={`${cat.itemType}-${cat.itemId}`}
              className="mobile-catalog-item-row"
              onClick={() => handleSelectCatalogItem(cat)}
            >
              <div className="mobile-catalog-item-info">
                <span className="mobile-catalog-item-name">{cat.name}</span>
                <span className="mobile-catalog-item-cat">
                  {[cat.code, cat.category].filter(Boolean).join(' · ')}
                </span>
              </div>
              <span className="mobile-catalog-item-price">
                {formatMoney(cat.salePrice)}
              </span>
            </button>
          ))
        )}
        </div>
      </BottomSheet>

      {/* Service Item Detail Sheet */}
      <MobileServiceItemDetailSheet
        isOpen={isDetailSheetOpen}
        item={activeEditingItem}
        staffList={staffList}
        timeZone={account?.branchTimezone}
        onClose={() => {
          setIsDetailSheetOpen(false);
          setActiveEditingItem(null);
          setEditingIndex(null);
        }}
        onSaveItem={handleSaveConfiguredItem}
      />

      <BottomSheet
        open={isNoteDialogOpen}
        onClose={() => setIsNoteDialogOpen(false)}
        title="Ghi chú lịch hẹn"
        footer={(
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setIsNoteDialogOpen(false)}>Hủy</button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setNote(tempNote);
                setIsNoteDialogOpen(false);
              }}
            >
              Lưu ghi chú
            </button>
          </>
        )}
      >
        <textarea
          className="textarea"
          rows={5}
          aria-label="Ghi chú lịch hẹn"
          placeholder="Nhập ghi chú cho lịch hẹn (yêu cầu riêng của khách, dặn dò thợ...)"
          value={tempNote}
          onChange={(e) => setTempNote(e.target.value)}
          autoFocus
        />
      </BottomSheet>
    </div>
  );
}
