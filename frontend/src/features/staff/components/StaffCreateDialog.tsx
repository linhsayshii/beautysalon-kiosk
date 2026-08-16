import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Select } from '@/components/ui/Select/Select';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { getAccounts } from '@/features/accounts/accounts.api';
import type { ApiRecord } from '@/types/api';
import { createStaff, updateStaff } from '../staff.api';

interface StaffCreateDialogProps {
  onClose: () => void;
  staff?: ApiRecord;
  initialTab?: 'info' | 'salary';
}

interface CommissionItem {
  id: string;
  type: 'service' | 'consulting';
  minRevenue: string;
  table: string;
}

interface AllowanceItem {
  id: string;
  name: string;
  type: string;
  amount: string;
}

interface DeductionItem {
  id: string;
  name: string;
  type: string;
  unit: string;
  amount: string;
}

const initialForm = {
  // Tab 1: Thông tin
  name: '',
  code: '',
  phone: '',
  avatarUrl: '',
  avatarTone: 'blue',
  department: '',
  role: 'Kỹ thuật viên',
  startDate: new Date().toISOString().slice(0, 10),
  accountId: '',
  note: '',
  // Bank info
  bankAccountNumber: '',
  bankName: '',
  bankAccountHolder: '',
  // Personal info
  idNumber: '',
  dob: '',
  gender: 'female',
  address: '',
  province: '',
  district: '',
  email: '',
  facebook: '',
  active: true,

  // Tab 2: Thiết lập lương
  salaryType: 'monthly',
  baseSalary: '7000000',
  hourlyRate: '35000',
  salaryTemplate: 'default',
  // Thưởng
  enableBonus: false,
  // Hoa hồng
  enableCommission: true,
  // Phụ cấp
  enableAllowance: true,
  // Giảm trừ
  enableDeduction: true,
};

const numeric = (value: string) => Number(value) || 0;

const getInitialForm = (staff?: ApiRecord) => staff ? {
  ...initialForm,
  name: String(staff.name ?? ''),
  code: String(staff.code ?? ''),
  phone: String(staff.phone ?? ''),
  avatarTone: String(staff.avatarTone ?? initialForm.avatarTone),
  role: String(staff.role ?? initialForm.role),
  active: staff.active !== false,
  salaryType: String(staff.salaryType ?? initialForm.salaryType),
  baseSalary: String(staff.baseSalary ?? 7000000),
  hourlyRate: String(staff.hourlyRate ?? 35000),
  enableCommission: Number(staff.defaultCommissionRate ?? 0) > 0,
} : initialForm;

export function StaffCreateDialog({ onClose, staff, initialTab = 'info' }: StaffCreateDialogProps) {
  const isEditing = Boolean(staff);
  const [activeTab, setActiveTab] = useState<'info' | 'salary'>(initialTab);
  const [form, setForm] = useState(() => getInitialForm(staff));
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Accordion state for Tab 1
  const [openSections, setOpenSections] = useState({
    job: true,
    bank: false,
    personal: false,
  });

  // Commission dynamic rows
  const [commissions, setCommissions] = useState<CommissionItem[]>([
    { id: '1', type: 'service', minRevenue: '0', table: 'bang tua dich vu' },
    { id: '2', type: 'consulting', minRevenue: '0', table: 'Bảng hoa hồng chung' },
  ]);

  // Allowance dynamic rows
  const [allowances, setAllowances] = useState<AllowanceItem[]>([
    { id: '1', name: 'Ăn trưa', type: 'Phụ cấp cố định theo ngày', amount: '35000' },
  ]);

  // Deduction dynamic rows
  const [deductions, setDeductions] = useState<DeductionItem[]>([
    { id: '1', name: 'Đi muộn', type: 'Đi muộn', unit: 'Theo số lần', amount: '50000' },
  ]);

  const nameRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const accountsQuery = useQuery({
    queryKey: ['auth-accounts'],
    queryFn: getAccounts,
  });
  const availableAccounts = accountsQuery.data?.data ?? [];

  useEffect(() => {
    if (initialTab === 'info') nameRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: (payload: Parameters<typeof createStaff>[0]) => isEditing
      ? updateStaff(Number(staff?.id), payload)
      : createStaff(payload),
    onSuccess: (payload) => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['staff-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['staff-commissions'] });
      notify(
        isEditing ? 'Đã cập nhật nhân viên' : 'Đã thêm nhân viên mới',
        `${payload.data.name} (${payload.data.code}) đã được lưu.`,
      );
      onClose();
    },
  });

  const update = (key: keyof typeof initialForm, value: any) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  };

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        notify('Định dạng ảnh không hỗ trợ', 'Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.');
        e.target.value = '';
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        notify('Kích thước ảnh quá lớn', 'Vui lòng chọn ảnh dung lượng dưới 2MB.');
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        update('avatarUrl', event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const addCommission = () => {
    setCommissions((prev) => [
      ...prev,
      { id: String(Date.now()), type: 'service', minRevenue: '0', table: 'Bảng hoa hồng chung' },
    ]);
  };

  const removeCommission = (id: string) => {
    setCommissions((prev) => prev.filter((item) => item.id !== id));
  };

  const addAllowance = () => {
    setAllowances((prev) => [
      ...prev,
      { id: String(Date.now()), name: '', type: 'Phụ cấp cố định theo ngày', amount: '0' },
    ]);
  };

  const removeAllowance = (id: string) => {
    setAllowances((prev) => prev.filter((item) => item.id !== id));
  };

  const addDeduction = () => {
    setDeductions((prev) => [
      ...prev,
      { id: String(Date.now()), name: '', type: 'Đi muộn', unit: 'Theo số lần', amount: '0' },
    ]);
  };

  const removeDeduction = (id: string) => {
    setDeductions((prev) => prev.filter((item) => item.id !== id));
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Hãy nhập tên nhân viên.';
    if (!isEditing && !form.phone.trim()) next.phone = 'Hãy nhập số điện thoại.';
    if (!form.role.trim()) next.role = 'Hãy chọn hoặc nhập chức danh/vai trò.';
    if (form.code && !/^[A-Z0-9._-]+$/.test(form.code)) {
      next.code = 'Mã nhân viên chỉ gồm chữ, số, dấu chấm, gạch ngang.';
    }
    if (form.salaryType === 'monthly' && numeric(form.baseSalary) < 0) {
      next.baseSalary = 'Lương cơ bản không được âm.';
    }
    if (form.salaryType === 'hourly' && numeric(form.hourlyRate) < 0) {
      next.hourlyRate = 'Lương theo giờ không được âm.';
    }
    setErrors(next);
    return next;
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      if (nextErrors.name || nextErrors.phone || nextErrors.code || nextErrors.role) {
        setActiveTab('info');
      }
      return;
    }
    mutation.mutate({
      name: form.name.trim(),
      code: form.code.trim(),
      role: form.role.trim(),
      phone: form.phone.trim(),
      avatarTone: form.avatarTone,
      active: form.active,
      salaryType: form.salaryType,
      baseSalary: form.salaryType === 'monthly' ? numeric(form.baseSalary) : 0,
      hourlyRate: form.salaryType === 'hourly' ? numeric(form.hourlyRate) : 0,
      defaultCommissionRate: form.enableCommission
        ? Number(staff?.defaultCommissionRate || 0.05)
        : 0,
      canSell: staff?.canSell !== false,
      canManageInventory: staff
        ? staff.canManageInventory === true
        : form.role.toLowerCase().includes('quản lý'),
    });
  };

  return (
    <div
      className="goods-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !mutation.isPending) onClose();
      }}
    >
      <section
        className="goods-dialog staff-kiot-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="staff-dialog-title"
        style={{ width: 'min(860px, 98vw)', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        <header className="goods-dialog-header" style={{ padding: '16px 24px 12px', borderBottom: '1px solid var(--line)' }}>
          <div>
            <h2 id="staff-dialog-title" style={{ fontSize: '18px', fontWeight: 800, color: 'var(--ink-950)' }}>
              {isEditing ? 'Cập nhật nhân viên' : 'Thêm mới nhân viên'}
            </h2>
            {isEditing && <p style={{ marginTop: '3px', color: 'var(--ink-500)', fontSize: '11px' }}>{form.name}</p>}
          </div>
          <button type="button" onClick={onClose} disabled={mutation.isPending} aria-label="Đóng">
            <i className="ph ph-x" style={{ fontSize: '18px' }} />
          </button>
        </header>

        {/* Tab Navigation */}
        <div className="goods-dialog-tabs" style={{ padding: '0 24px', background: '#fafbfc' }}>
          <button
            type="button"
            className={activeTab === 'info' ? 'is-active' : ''}
            onClick={() => setActiveTab('info')}
            style={{ fontSize: '13px', padding: '12px 4px' }}
          >
            Thông tin
          </button>
          <button
            type="button"
            className={activeTab === 'salary' ? 'is-active' : ''}
            onClick={() => setActiveTab('salary')}
            style={{ fontSize: '13px', padding: '12px 4px' }}
          >
            Thiết lập lương
          </button>
        </div>

        <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="goods-dialog-body" style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
            {mutation.error && (
              <div className="goods-form-alert" role="alert" style={{ marginBottom: 16 }}>
                <i className="ph ph-warning-circle" />
                <span>
                  <strong>{isEditing ? 'Không thể cập nhật nhân viên:' : 'Không thể thêm nhân viên:'}</strong> {mutation.error.message}
                </span>
              </div>
            )}

            {activeTab === 'info' ? (
              <div className="staff-tab-info" style={{ display: 'grid', gap: '20px' }}>
                {/* 1. Thông tin khởi tạo */}
                <div
                  className="staff-section-card"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) 180px',
                    gap: '24px',
                    alignItems: 'start',
                  }}
                >
                  <div className="goods-form-grid" style={{ display: 'grid', gap: '14px' }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--ink-900)' }}>
                      Thông tin khởi tạo
                    </div>

                    <div className="goods-field">
                      <label htmlFor="staff-name" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)' }}>
                        Tên nhân viên <span style={{ color: 'var(--red)' }}>*</span>
                      </label>
                      <input
                        ref={nameRef}
                        id="staff-name"
                        value={form.name}
                        onChange={(e) => update('name', e.target.value)}
                        placeholder="Bắt buộc"
                        className="filter-control"
                        style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                      />
                      {errors.name && <small className="field-error">{errors.name}</small>}
                    </div>

                    <div className="goods-field">
                      <label htmlFor="staff-code" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)' }}>
                        Mã nhân viên
                      </label>
                      <input
                        id="staff-code"
                        value={form.code}
                        onChange={(e) => update('code', e.target.value.toUpperCase())}
                        placeholder="Tự động"
                        className="filter-control"
                        style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                      />
                      {errors.code && <small className="field-error">{errors.code}</small>}
                    </div>

                    <div className="goods-field">
                      <label htmlFor="staff-phone" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)' }}>
                        Số điện thoại <span style={{ color: 'var(--red)' }}>*</span>
                      </label>
                      <input
                        id="staff-phone"
                        value={form.phone}
                        onChange={(e) => update('phone', e.target.value)}
                        placeholder="Bắt buộc"
                        className="filter-control"
                        style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                      />
                      {errors.phone && <small className="field-error">{errors.phone}</small>}
                    </div>
                  </div>

                  {/* Avatar Upload Circle (KiotViet style) */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '16px 0',
                    }}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      accept="image/jpeg,image/png,image/webp"
                      style={{ display: 'none' }}
                    />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        width: '140px',
                        height: '140px',
                        borderRadius: '50%',
                        border: '2px dashed var(--line-strong)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        background: form.avatarUrl ? `url(${form.avatarUrl}) center/cover no-repeat` : '#fafbfc',
                        transition: 'all 0.2s',
                        textAlign: 'center',
                        padding: '10px',
                      }}
                    >
                      {!form.avatarUrl && (
                        <>
                          <button
                            type="button"
                            className="secondary-button"
                            style={{
                              fontSize: '11px',
                              padding: '4px 10px',
                              height: '28px',
                              borderRadius: '6px',
                              marginBottom: '6px',
                            }}
                          >
                            Thêm ảnh
                          </button>
                          <span style={{ fontSize: '10px', color: 'var(--ink-400)', lineHeight: 1.2 }}>
                            Mỗi ảnh không vượt quá 2Mb
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Accordion: Thông tin công việc */}
                <div style={{ border: '1px solid var(--line)', borderRadius: '10px', overflow: 'hidden' }}>
                  <div
                    onClick={() => toggleSection('job')}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      background: '#fafbfc',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--ink-900)' }}>
                      Thông tin công việc
                    </span>
                    <i
                      className={`ph ph-caret-${openSections.job ? 'up' : 'down'}`}
                      style={{ color: 'var(--ink-500)' }}
                    />
                  </div>

                  {openSections.job && (
                    <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div className="goods-field">
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)' }}>Phòng ban</label>
                        <Select
                          id="staff-dept"
                          value={form.department}
                          onChange={(val) => update('department', val)}
                          fullWidth
                          options={[
                            { value: '', label: 'Chọn Phòng ban' },
                            { value: 'salon', label: 'Khối Salon / Kỹ thuật' },
                            { value: 'reception', label: 'Lễ tân & Chăm sóc' },
                            { value: 'management', label: 'Ban Quản trị' },
                          ]}
                        />
                      </div>

                      <div className="goods-field">
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)' }}>Chức danh</label>
                        <Select
                          id="staff-role"
                          value={form.role}
                          onChange={(val) => update('role', val)}
                          fullWidth
                          options={[
                            { value: 'Kỹ thuật viên', label: 'Kỹ thuật viên' },
                            { value: 'Chuyên viên chăm sóc da', label: 'Chuyên viên chăm sóc da' },
                            { value: 'Lễ tân', label: 'Lễ tân' },
                            { value: 'Quản lý salon', label: 'Quản lý salon' },
                            { value: 'Tư vấn viên', label: 'Tư vấn viên' },
                          ]}
                        />
                      </div>

                      <div className="goods-field">
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)' }}>
                          Ngày bắt đầu làm việc
                        </label>
                        <input
                          type="date"
                          value={form.startDate}
                          onChange={(e) => update('startDate', e.target.value)}
                          className="filter-control"
                          style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                        />
                      </div>

                      <div className="goods-field">
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)' }}>
                          Tài khoản đăng nhập
                        </label>
                        <Select
                          id="staff-account"
                          value={form.accountId}
                          onChange={(val) => update('accountId', val)}
                          fullWidth
                          options={[
                            { value: '', label: 'Chọn Tài khoản' },
                            ...availableAccounts.map((acc: any) => ({
                              value: String(acc.id),
                              label: `${acc.username} (${acc.role})`,
                            })),
                          ]}
                        />
                      </div>

                      <div className="goods-field" style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)' }}>Ghi chú</label>
                        <input
                          value={form.note}
                          onChange={(e) => update('note', e.target.value)}
                          placeholder="Nhập ghi chú thêm..."
                          className="filter-control"
                          style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Accordion: Thông tin ngân hàng */}
                <div style={{ border: '1px solid var(--line)', borderRadius: '10px', overflow: 'hidden' }}>
                  <div
                    onClick={() => toggleSection('bank')}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      background: '#fafbfc',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--ink-900)' }}>
                      Thông tin ngân hàng
                    </span>
                    <i
                      className={`ph ph-caret-${openSections.bank ? 'up' : 'down'}`}
                      style={{ color: 'var(--ink-500)' }}
                    />
                  </div>

                  {openSections.bank && (
                    <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div className="goods-field">
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)' }}>Số tài khoản</label>
                        <input
                          value={form.bankAccountNumber}
                          onChange={(e) => update('bankAccountNumber', e.target.value)}
                          placeholder="Nhập số tài khoản ngân hàng"
                          className="filter-control"
                          style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                        />
                      </div>

                      <div className="goods-field">
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)' }}>Ngân hàng</label>
                        <Select
                          id="staff-bank"
                          value={form.bankName}
                          onChange={(val) => update('bankName', val)}
                          fullWidth
                          options={[
                            { value: '', label: 'Chọn ngân hàng' },
                            { value: 'VCB', label: 'Vietcombank (VCB)' },
                            { value: 'TCB', label: 'Techcombank (TCB)' },
                            { value: 'MB', label: 'MB Bank' },
                            { value: 'ACB', label: 'ACB' },
                            { value: 'BIDV', label: 'BIDV' },
                            { value: 'CTG', label: 'Vietinbank' },
                          ]}
                        />
                      </div>

                      <div className="goods-field" style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)' }}>Chủ tài khoản</label>
                        <input
                          value={form.bankAccountHolder}
                          onChange={(e) => update('bankAccountHolder', e.target.value.toUpperCase())}
                          placeholder="Tên chủ tài khoản in hoa không dấu"
                          className="filter-control"
                          style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Accordion: Thông tin cá nhân */}
                <div style={{ border: '1px solid var(--line)', borderRadius: '10px', overflow: 'hidden' }}>
                  <div
                    onClick={() => toggleSection('personal')}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      background: '#fafbfc',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--ink-900)' }}>
                      Thông tin cá nhân
                    </span>
                    <i
                      className={`ph ph-caret-${openSections.personal ? 'up' : 'down'}`}
                      style={{ color: 'var(--ink-500)' }}
                    />
                  </div>

                  {openSections.personal && (
                    <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div className="goods-field">
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)' }}>Số CMND/CCCD</label>
                        <input
                          value={form.idNumber}
                          onChange={(e) => update('idNumber', e.target.value)}
                          placeholder="Số căn cước công dân"
                          className="filter-control"
                          style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                        />
                      </div>

                      <div className="goods-field">
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)' }}>Ngày sinh</label>
                        <input
                          type="date"
                          value={form.dob}
                          onChange={(e) => update('dob', e.target.value)}
                          className="filter-control"
                          style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                        />
                      </div>

                      <div className="goods-field">
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)' }}>Giới tính</label>
                        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', height: '38px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name="gender"
                              value="male"
                              checked={form.gender === 'male'}
                              onChange={() => update('gender', 'male')}
                            />
                            Nam
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name="gender"
                              value="female"
                              checked={form.gender === 'female'}
                              onChange={() => update('gender', 'female')}
                            />
                            Nữ
                          </label>
                        </div>
                      </div>

                      <div className="goods-field">
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)' }}>Email</label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => update('email', e.target.value)}
                          placeholder="Địa chỉ email"
                          className="filter-control"
                          style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                        />
                      </div>

                      <div className="goods-field" style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)' }}>Địa chỉ</label>
                        <input
                          value={form.address}
                          onChange={(e) => update('address', e.target.value)}
                          placeholder="Địa chỉ thường trú / tạm trú"
                          className="filter-control"
                          style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                        />
                      </div>

                      <div className="goods-field">
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)' }}>Tỉnh/Thành phố</label>
                        <Select
                          id="staff-province"
                          value={form.province}
                          onChange={(val) => update('province', val)}
                          fullWidth
                          options={[
                            { value: '', label: 'Chọn Tỉnh/Thành phố' },
                            { value: 'HCM', label: 'TP. Hồ Chí Minh' },
                            { value: 'HN', label: 'Hà Nội' },
                            { value: 'DN', label: 'Đà Nẵng' },
                            { value: 'BD', label: 'Bình Dương' },
                          ]}
                        />
                      </div>

                      <div className="goods-field">
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)' }}>Xã/Phường/Đặc khu</label>
                        <input
                          value={form.district}
                          onChange={(e) => update('district', e.target.value)}
                          placeholder="Chọn Xã/Phường/Đặc khu"
                          className="filter-control"
                          style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                        />
                      </div>

                      <div className="goods-field" style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)' }}>Facebook</label>
                        <input
                          value={form.facebook}
                          onChange={(e) => update('facebook', e.target.value)}
                          placeholder="Link trang cá nhân Facebook"
                          className="filter-control"
                          style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* TAB 2: THIẾT LẬP LƯƠNG */
              <div className="staff-tab-salary" style={{ display: 'grid', gap: '22px' }}>
                {/* 1. Lương chính */}
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--ink-900)' }}>Lương chính</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '14px', alignItems: 'center' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)' }}>Loại lương</label>
                    <Select
                      id="staff-sal-type"
                      value={form.salaryType}
                      onChange={(val) => update('salaryType', val)}
                      fullWidth
                      options={[
                        { value: 'monthly', label: 'Theo ngày công chuẩn' },
                        { value: 'hourly', label: 'Theo giờ làm việc' },
                      ]}
                    />
                  </div>

                  {form.salaryType === 'monthly' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '14px', alignItems: 'center' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)' }}>Mức lương tháng</label>
                      <div className="input-suffix" style={{ width: '100%' }}>
                        <input
                          type="number"
                          min="0"
                          step="50000"
                          value={form.baseSalary}
                          onChange={(e) => update('baseSalary', e.target.value)}
                          className="filter-control"
                          style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                        />
                        <span>đ</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '14px', alignItems: 'center' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)' }}>Lương theo giờ</label>
                      <div className="input-suffix" style={{ width: '100%' }}>
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={form.hourlyRate}
                          onChange={(e) => update('hourlyRate', e.target.value)}
                          className="filter-control"
                          style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                        />
                        <span>đ/giờ</span>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '14px', alignItems: 'center' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-700)' }}>
                      Mẫu lương <i className="ph ph-info" style={{ color: 'var(--ink-400)' }} />
                    </label>
                    <Select
                      id="staff-sal-template"
                      value={form.salaryTemplate}
                      onChange={(val) => update('salaryTemplate', val)}
                      fullWidth
                      options={[
                        { value: 'default', label: 'Chọn mẫu lương có sẵn' },
                        { value: 'ktv', label: 'Mẫu Kỹ thuật viên (Cơ bản + Hoa hồng DV 5%)' },
                        { value: 'letan', label: 'Mẫu Lễ tân (Cố định + Phụ cấp ăn trưa)' },
                      ]}
                    />
                  </div>
                </div>

                <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '4px 0' }} />

                {/* 2. Thưởng */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--ink-900)' }}>Thưởng</div>
                      <small style={{ color: 'var(--ink-500)', fontSize: '11px' }}>
                        Thiết lập thưởng theo doanh thu cho nhân viên
                      </small>
                    </div>
                    <label className="toggle-switch" style={{ cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.enableBonus}
                        onChange={(e) => update('enableBonus', e.target.checked)}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--blue-600)' }}
                      />
                    </label>
                  </div>
                </div>

                <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '4px 0' }} />

                {/* 3. Hoa hồng (KiotViet Style với 2 bảng dịch vụ & tư vấn) */}
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--ink-900)' }}>Hoa hồng</div>
                      <small style={{ color: 'var(--ink-500)', fontSize: '11px' }}>
                        Thiết lập mức hoa hồng theo sản phẩm hoặc dịch vụ
                      </small>
                    </div>
                    <label className="toggle-switch" style={{ cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.enableCommission}
                        onChange={(e) => update('enableCommission', e.target.checked)}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--blue-600)' }}
                      />
                    </label>
                  </div>

                  {form.enableCommission && (
                    <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid var(--line)' }}>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.2fr 1fr 1.6fr 36px 36px',
                          gap: '10px',
                          marginBottom: '8px',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: 'var(--ink-600)',
                        }}
                      >
                        <div>Loại hình</div>
                        <div>Doanh thu <i className="ph ph-info" /></div>
                        <div>Hoa hồng thụ hưởng</div>
                        <div />
                        <div />
                      </div>

                      {commissions.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1.2fr 1fr 1.6fr 36px 36px',
                            gap: '10px',
                            alignItems: 'center',
                            marginBottom: '8px',
                          }}
                        >
                          <Select
                            id={`comm-type-${item.id}`}
                            value={item.type}
                            onChange={(val) => {
                              setCommissions((prev) =>
                                prev.map((c) => (c.id === item.id ? { ...c, type: val as any } : c))
                              );
                            }}
                            fullWidth
                            options={[
                              { value: 'service', label: 'Thực hiện dịch vụ' },
                              { value: 'consulting', label: 'Tư vấn bán hàng' },
                            ]}
                          />

                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: '12px', color: 'var(--ink-500)' }}>Từ</span>
                            <input
                              type="number"
                              value={item.minRevenue}
                              onChange={(e) => {
                                setCommissions((prev) =>
                                  prev.map((c) => (c.id === item.id ? { ...c, minRevenue: e.target.value } : c))
                                );
                              }}
                              className="filter-control"
                              style={{ width: '100%', height: '36px', borderRadius: '8px' }}
                            />
                          </div>

                          <Select
                            id={`comm-table-${item.id}`}
                            value={item.table}
                            onChange={(val) => {
                              setCommissions((prev) =>
                                prev.map((c) => (c.id === item.id ? { ...c, table: val } : c))
                              );
                            }}
                            fullWidth
                            options={[
                              { value: 'bang tua dich vu', label: 'bang tua dich vu' },
                              { value: 'Bảng hoa hồng chung', label: 'Bảng hoa hồng chung' },
                              { value: 'Hoa hồng VIP', label: 'Bảng hoa hồng VIP' },
                            ]}
                          />

                          <button
                            type="button"
                            className="row-action"
                            style={{ width: '36px', height: '36px' }}
                            title="Mở bảng hoa hồng"
                          >
                            <i className="ph ph-arrow-square-out" />
                          </button>

                          <button
                            type="button"
                            className="row-action"
                            onClick={() => removeCommission(item.id)}
                            style={{ width: '36px', height: '36px', color: 'var(--ink-400)' }}
                            title="Xóa dòng"
                          >
                            <i className="ph ph-trash" />
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={addCommission}
                        style={{
                          border: 0,
                          background: 'transparent',
                          color: 'var(--blue-600)',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          marginTop: '6px',
                        }}
                      >
                        + Thêm hoa hồng
                      </button>
                    </div>
                  )}
                </div>

                <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '4px 0' }} />

                {/* 4. Phụ cấp */}
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--ink-900)' }}>Phụ cấp</div>
                      <small style={{ color: 'var(--ink-500)', fontSize: '11px' }}>
                        Thiết lập khoản hỗ trợ làm việc như ăn trưa, đi lại, điện thoại, ...
                      </small>
                    </div>
                    <label className="toggle-switch" style={{ cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.enableAllowance}
                        onChange={(e) => update('enableAllowance', e.target.checked)}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--blue-600)' }}
                      />
                    </label>
                  </div>

                  {form.enableAllowance && (
                    <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid var(--line)' }}>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.2fr 1.5fr 1fr 36px',
                          gap: '10px',
                          marginBottom: '8px',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: 'var(--ink-600)',
                        }}
                      >
                        <div>Tên phụ cấp</div>
                        <div>Loại phụ cấp</div>
                        <div>Phụ cấp thụ hưởng</div>
                        <div />
                      </div>

                      {allowances.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1.2fr 1.5fr 1fr 36px',
                            gap: '10px',
                            alignItems: 'center',
                            marginBottom: '8px',
                          }}
                        >
                          <Select
                            id={`allow-name-${item.id}`}
                            value={item.name || 'Ăn trưa'}
                            onChange={(val) => {
                              setAllowances((prev) =>
                                prev.map((a) => (a.id === item.id ? { ...a, name: val } : a))
                              );
                            }}
                            fullWidth
                            options={[
                              { value: 'Ăn trưa', label: 'Ăn trưa' },
                              { value: 'Đi lại', label: 'Đi lại, xăng xe' },
                              { value: 'Điện thoại', label: 'Điện thoại' },
                            ]}
                          />

                          <Select
                            id={`allow-type-${item.id}`}
                            value={item.type}
                            onChange={(val) => {
                              setAllowances((prev) =>
                                prev.map((a) => (a.id === item.id ? { ...a, type: val } : a))
                              );
                            }}
                            fullWidth
                            options={[
                              { value: 'Phụ cấp cố định theo ngày', label: 'Phụ cấp cố định theo ngày' },
                              { value: 'Phụ cấp theo tháng', label: 'Phụ cấp cố định theo tháng' },
                            ]}
                          />

                          <input
                            type="number"
                            value={item.amount}
                            onChange={(e) => {
                              setAllowances((prev) =>
                                prev.map((a) => (a.id === item.id ? { ...a, amount: e.target.value } : a))
                              );
                            }}
                            className="filter-control"
                            style={{ width: '100%', height: '36px', borderRadius: '8px' }}
                          />

                          <button
                            type="button"
                            className="row-action"
                            onClick={() => removeAllowance(item.id)}
                            style={{ width: '36px', height: '36px', color: 'var(--ink-400)' }}
                            title="Xóa phụ cấp"
                          >
                            <i className="ph ph-trash" />
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={addAllowance}
                        style={{
                          border: 0,
                          background: 'transparent',
                          color: 'var(--blue-600)',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          marginTop: '6px',
                        }}
                      >
                        + Thêm phụ cấp
                      </button>
                    </div>
                  )}
                </div>

                <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '4px 0' }} />

                {/* 5. Giảm trừ */}
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--ink-900)' }}>Giảm trừ</div>
                      <small style={{ color: 'var(--ink-500)', fontSize: '11px' }}>
                        Thiết lập khoản giảm trừ như đi muộn, về sớm, vi phạm nội quy, ...
                      </small>
                    </div>
                    <label className="toggle-switch" style={{ cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.enableDeduction}
                        onChange={(e) => update('enableDeduction', e.target.checked)}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--blue-600)' }}
                      />
                    </label>
                  </div>

                  {form.enableDeduction && (
                    <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid var(--line)' }}>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.1fr 1.2fr 1fr 1fr 36px',
                          gap: '10px',
                          marginBottom: '8px',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: 'var(--ink-600)',
                        }}
                      >
                        <div>Tên giảm trừ</div>
                        <div>Loại giảm trừ</div>
                        <div>Cách tính</div>
                        <div>Khoản giảm trừ</div>
                        <div />
                      </div>

                      {deductions.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1.1fr 1.2fr 1fr 1fr 36px',
                            gap: '10px',
                            alignItems: 'center',
                            marginBottom: '8px',
                          }}
                        >
                          <Select
                            id={`deduct-name-${item.id}`}
                            value={item.name || 'Đi muộn'}
                            onChange={(val) => {
                              setDeductions((prev) =>
                                prev.map((d) => (d.id === item.id ? { ...d, name: val } : d))
                              );
                            }}
                            fullWidth
                            options={[
                              { value: 'Đi muộn', label: 'Đi muộn' },
                              { value: 'Về sớm', label: 'Về sớm' },
                              { value: 'Nghỉ không phép', label: 'Nghỉ không phép' },
                              { value: 'Vi phạm quy định', label: 'Vi phạm quy định' },
                            ]}
                          />

                          <Select
                            id={`deduct-type-${item.id}`}
                            value={item.type}
                            onChange={(val) => {
                              setDeductions((prev) =>
                                prev.map((d) => (d.id === item.id ? { ...d, type: val } : d))
                              );
                            }}
                            fullWidth
                            options={[
                              { value: 'Đi muộn', label: 'Đi muộn' },
                              { value: 'Về sớm', label: 'Về sớm' },
                              { value: 'Vi phạm', label: 'Vi phạm nội quy' },
                            ]}
                          />

                          <Select
                            id={`deduct-unit-${item.id}`}
                            value={item.unit}
                            onChange={(val) => {
                              setDeductions((prev) =>
                                prev.map((d) => (d.id === item.id ? { ...d, unit: val } : d))
                              );
                            }}
                            fullWidth
                            options={[
                              { value: 'Theo số lần', label: 'Theo số lần' },
                              { value: 'Theo số phút', label: 'Theo số phút' },
                              { value: 'Cố định tháng', label: 'Cố định tháng' },
                            ]}
                          />

                          <input
                            type="number"
                            value={item.amount}
                            onChange={(e) => {
                              setDeductions((prev) =>
                                prev.map((d) => (d.id === item.id ? { ...d, amount: e.target.value } : d))
                              );
                            }}
                            className="filter-control"
                            style={{ width: '100%', height: '36px', borderRadius: '8px' }}
                          />

                          <button
                            type="button"
                            className="row-action"
                            onClick={() => removeDeduction(item.id)}
                            style={{ width: '36px', height: '36px', color: 'var(--ink-400)' }}
                            title="Xóa giảm trừ"
                          >
                            <i className="ph ph-trash" />
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={addDeduction}
                        style={{
                          border: 0,
                          background: 'transparent',
                          color: 'var(--blue-600)',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          marginTop: '6px',
                        }}
                      >
                        + Thêm giảm trừ
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <footer
            className="goods-dialog-footer"
            style={{
              padding: '14px 24px',
              borderTop: '1px solid var(--line)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              background: '#ffffff',
            }}
          >
            <button
              className="secondary-button"
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              style={{ minWidth: '80px' }}
            >
              Bỏ qua
            </button>
            {activeTab === 'salary' && !isEditing && (
              <button
                className="secondary-button"
                type="button"
                disabled={mutation.isPending}
                onClick={(e) => submit(e)}
              >
                Lưu và tạo mẫu lương mới
              </button>
            )}
            <button
              className="primary-button"
              type="submit"
              disabled={mutation.isPending}
              style={{ minWidth: '90px' }}
            >
              {mutation.isPending ? 'Đang lưu...' : isEditing ? 'Lưu thay đổi' : 'Lưu'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
