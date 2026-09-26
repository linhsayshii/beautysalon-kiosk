import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { Select } from '@/components/ui/Select/Select';
import { DatePickerField } from '@/components/ui/DateTimePicker';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { getAccounts } from '@/features/accounts/accounts.api';
import type { ApiRecord } from '@/types/api';
import { createStaff, updateStaff } from '../staff.api';
import { Modal } from '@/components/ui/Modal/Modal';
import { todayIso } from '@/lib/date';

interface StaffCreateDialogProps {
  onClose: () => void;
  staff?: ApiRecord;
  initialTab?: 'info' | 'salary';
  onSaved?: () => void;
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
  startDate: todayIso(),
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
  baseSalary: '',
  hourlyRate: '',
  salaryTemplate: 'default',
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
  baseSalary: String(staff.baseSalary ?? ''),
  hourlyRate: String(staff.hourlyRate ?? ''),
  avatarUrl: String(staff.avatarUrl ?? ''),
  department: String(staff.department ?? ''),
  startDate: String(staff.startDate ?? initialForm.startDate),
  accountId: String(staff.accountId ?? ''),
  note: String(staff.note ?? ''),
  bankAccountNumber: String(staff.bankAccountNumber ?? ''),
  bankName: String(staff.bankName ?? ''),
  bankAccountHolder: String(staff.bankAccountHolder ?? ''),
  idNumber: String(staff.idNumber ?? ''),
  dob: String(staff.dob ?? ''),
  gender: String(staff.gender ?? initialForm.gender),
  address: String(staff.address ?? ''),
  province: String(staff.province ?? ''),
  district: String(staff.district ?? ''),
  email: String(staff.email ?? ''),
  facebook: String(staff.facebook ?? ''),
  enableAllowance: staff.enableAllowance !== false,
  enableDeduction: staff.enableDeduction !== false,
} : initialForm;

/** Allowance/deduction rows saved in the staff profile; a new staff member starts with none. */
function savedRows<T extends { id: string; amount: string }>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value.map((row, index) => ({ ...row, id: String(row?.id ?? index), amount: String(row?.amount ?? '') }));
}

const named = <T extends { name: string }>(rows: T[]) => rows.filter((row) => row.name.trim());

export function StaffCreateDialog({ onClose, staff, initialTab = 'info', onSaved }: StaffCreateDialogProps) {
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

  // Allowance dynamic rows
  const [allowances, setAllowances] = useState<AllowanceItem[]>(() => savedRows<AllowanceItem>(staff?.allowances));

  // Deduction dynamic rows
  const [deductions, setDeductions] = useState<DeductionItem[]>(() => savedRows<DeductionItem>(staff?.deductions));

  const nameRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const accountsQuery = useQuery({
    queryKey: ['auth-accounts'],
    queryFn: getAccounts,
  });
  const availableAccounts = accountsQuery.data?.data ?? [];

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
      onSaved?.();
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

  const addAllowance = () => {
    setAllowances((prev) => [
      ...prev,
      { id: String(Date.now()), name: '', type: 'Phụ cấp cố định theo ngày', amount: '' },
    ]);
  };

  const removeAllowance = (id: string) => {
    setAllowances((prev) => prev.filter((item) => item.id !== id));
  };

  const addDeduction = () => {
    setDeductions((prev) => [
      ...prev,
      { id: String(Date.now()), name: '', unit: 'Theo số lần', amount: '' },
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
      canSell: staff?.canSell !== false,
      canManageInventory: staff
        ? staff.canManageInventory === true
        : form.role.toLowerCase().includes('quản lý'),
      accountId: form.accountId || null,
      profile: {
        phone: form.phone.trim(), avatarUrl: form.avatarUrl, department: form.department,
        startDate: form.startDate, note: form.note, bankAccountNumber: form.bankAccountNumber,
        bankName: form.bankName, bankAccountHolder: form.bankAccountHolder, idNumber: form.idNumber,
        dob: form.dob, gender: form.gender, address: form.address, province: form.province,
        district: form.district, email: form.email.trim(), facebook: form.facebook.trim(),
        enableAllowance: form.enableAllowance, enableDeduction: form.enableDeduction,
        allowances: named(allowances), deductions: named(deductions),
      },
    });
  };

  const setAllowance = (id: string, changes: Partial<AllowanceItem>) =>
    setAllowances((prev) => prev.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  const setDeduction = (id: string, changes: Partial<DeductionItem>) =>
    setDeductions((prev) => prev.map((item) => (item.id === id ? { ...item, ...changes } : item)));

  return (
    <Modal
      open
      onClose={() => { if (!mutation.isPending) onClose(); }}
      title={isEditing ? 'Cập nhật nhân viên' : 'Thêm mới nhân viên'}
      subtitle={isEditing ? form.name : undefined}
      size="lg"
      className="modal-fill"
      nested
      closeOnBackdrop={!mutation.isPending}
      initialFocusRef={initialTab === 'info' ? nameRef : undefined}
      headerExtra={(
        <div className="tabs" role="tablist">
          <button type="button" role="tab" className="tab" aria-selected={activeTab === 'info'} onClick={() => setActiveTab('info')}>
            Thông tin
          </button>
          <button type="button" role="tab" className="tab" aria-selected={activeTab === 'salary'} onClick={() => setActiveTab('salary')}>
            Thiết lập lương
          </button>
        </div>
      )}
    >
      <form onSubmit={submit} noValidate>
        <div className="modal-body">
          {mutation.error && (
            <div className="alert alert-danger" role="alert">
              <i className="ph ph-warning-circle" />
              <div>
                <strong>{isEditing ? 'Không thể cập nhật nhân viên:' : 'Không thể thêm nhân viên:'}</strong> {mutation.error.message}
              </div>
            </div>
          )}

          {activeTab === 'info' ? (
            <>
              <section className="form-section staff-identity">
                <div className="form-stack">
                  <h3 className="form-section-title">Thông tin khởi tạo</h3>
                  <div className="field">
                    <label className="field-label" htmlFor="staff-name">Tên nhân viên <span className="field-required">*</span></label>
                    <input ref={nameRef} id="staff-name" className="input" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Bắt buộc" aria-invalid={Boolean(errors.name)} />
                    {errors.name && <small className="field-error">{errors.name}</small>}
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="staff-code">Mã nhân viên</label>
                    <input id="staff-code" className="input" value={form.code} onChange={(e) => update('code', e.target.value.toUpperCase())} placeholder="Tự động" aria-invalid={Boolean(errors.code)} />
                    {errors.code && <small className="field-error">{errors.code}</small>}
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="staff-phone">Số điện thoại <span className="field-required">*</span></label>
                    <input id="staff-phone" className="input" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="Bắt buộc" aria-invalid={Boolean(errors.phone)} />
                    {errors.phone && <small className="field-error">{errors.phone}</small>}
                  </div>
                </div>

                <div className="staff-avatar-field">
                  <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/jpeg,image/png,image/webp" hidden />
                  <button type="button" className="staff-avatar-picker" onClick={() => fileInputRef.current?.click()} aria-label={form.avatarUrl ? 'Đổi ảnh nhân viên' : 'Thêm ảnh nhân viên'}>
                    {form.avatarUrl ? (
                      <img src={form.avatarUrl} alt="" />
                    ) : (
                      <>
                        <span className="btn btn-secondary btn-sm">Thêm ảnh</span>
                        <small>Mỗi ảnh không vượt quá 2Mb</small>
                      </>
                    )}
                  </button>
                </div>
              </section>

              <CollapsibleSection title="Thông tin công việc" open={openSections.job} onToggle={() => toggleSection('job')}>
                <div className="field">
                  <label className="field-label" htmlFor="staff-dept">Phòng ban</label>
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
                <div className="field">
                  <label className="field-label" htmlFor="staff-role">Chức danh</label>
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
                <div className="field">
                  <label className="field-label" htmlFor="staff-start-date">Ngày bắt đầu làm việc</label>
                  <DatePickerField id="staff-start-date" value={form.startDate} onChange={(startDate) => update('startDate', startDate)} className="input" />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="staff-account">Tài khoản đăng nhập</label>
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
                <div className="field form-grid-full">
                  <label className="field-label" htmlFor="staff-note">Ghi chú</label>
                  <input id="staff-note" className="input" value={form.note} onChange={(e) => update('note', e.target.value)} placeholder="Nhập ghi chú thêm..." />
                </div>
              </CollapsibleSection>

              <CollapsibleSection title="Thông tin ngân hàng" open={openSections.bank} onToggle={() => toggleSection('bank')}>
                <div className="field">
                  <label className="field-label" htmlFor="staff-bank-number">Số tài khoản</label>
                  <input id="staff-bank-number" className="input" value={form.bankAccountNumber} onChange={(e) => update('bankAccountNumber', e.target.value)} placeholder="Nhập số tài khoản ngân hàng" />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="staff-bank">Ngân hàng</label>
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
                <div className="field form-grid-full">
                  <label className="field-label" htmlFor="staff-bank-holder">Chủ tài khoản</label>
                  <input id="staff-bank-holder" className="input" value={form.bankAccountHolder} onChange={(e) => update('bankAccountHolder', e.target.value.toUpperCase())} placeholder="Tên chủ tài khoản in hoa không dấu" />
                </div>
              </CollapsibleSection>

              <CollapsibleSection title="Thông tin cá nhân" open={openSections.personal} onToggle={() => toggleSection('personal')}>
                <div className="field">
                  <label className="field-label" htmlFor="staff-id-number">Số CMND/CCCD</label>
                  <input id="staff-id-number" className="input" value={form.idNumber} onChange={(e) => update('idNumber', e.target.value)} placeholder="Số căn cước công dân" />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="staff-dob">Ngày sinh</label>
                  <DatePickerField id="staff-dob" value={form.dob} max={todayIso()} onChange={(dob) => update('dob', dob)} className="input" />
                </div>
                <fieldset className="field">
                  <legend className="field-label">Giới tính</legend>
                  <div className="staff-gender-options">
                    <label className="check">
                      <input type="radio" name="gender" value="male" checked={form.gender === 'male'} onChange={() => update('gender', 'male')} />
                      Nam
                    </label>
                    <label className="check">
                      <input type="radio" name="gender" value="female" checked={form.gender === 'female'} onChange={() => update('gender', 'female')} />
                      Nữ
                    </label>
                  </div>
                </fieldset>
                <div className="field">
                  <label className="field-label" htmlFor="staff-email">Email</label>
                  <input id="staff-email" type="email" className="input" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="Địa chỉ email" />
                </div>
                <div className="field form-grid-full">
                  <label className="field-label" htmlFor="staff-address">Địa chỉ</label>
                  <input id="staff-address" className="input" value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="Địa chỉ thường trú / tạm trú" />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="staff-province">Tỉnh/Thành phố</label>
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
                <div className="field">
                  <label className="field-label" htmlFor="staff-district">Xã/Phường/Đặc khu</label>
                  <input id="staff-district" className="input" value={form.district} onChange={(e) => update('district', e.target.value)} placeholder="Chọn Xã/Phường/Đặc khu" />
                </div>
                <div className="field form-grid-full">
                  <label className="field-label" htmlFor="staff-facebook">Facebook</label>
                  <input id="staff-facebook" className="input" value={form.facebook} onChange={(e) => update('facebook', e.target.value)} placeholder="Link trang cá nhân Facebook" />
                </div>
              </CollapsibleSection>
            </>
          ) : (
            <>
              <section className="form-section">
                <h3 className="form-section-title">Lương chính</h3>
                <div className="field-row">
                  <label className="field-label" htmlFor="staff-sal-type">Loại lương</label>
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
                  <div className="field-row">
                    <label className="field-label" htmlFor="staff-base-salary">Mức lương tháng</label>
                    <MoneyInput id="staff-base-salary" suffix="đ" value={form.baseSalary} onChange={(val) => update('baseSalary', String(val))} className="input" />
                  </div>
                ) : (
                  <div className="field-row">
                    <label className="field-label" htmlFor="staff-hourly-rate">Lương theo giờ</label>
                    <MoneyInput id="staff-hourly-rate" suffix="đ/giờ" value={form.hourlyRate} onChange={(val) => update('hourlyRate', String(val))} className="input" />
                  </div>
                )}
                <div className="field-row">
                  <label className="field-label" htmlFor="staff-sal-template">Mẫu lương <i className="ph ph-info" /></label>
                  <Select
                    id="staff-sal-template"
                    value={form.salaryTemplate}
                    onChange={(val) => update('salaryTemplate', val)}
                    fullWidth
                    options={[
                      { value: 'default', label: 'Chọn mẫu lương có sẵn' },
                      { value: 'ktv', label: 'Mẫu Kỹ thuật viên (Lương cơ bản)' },
                      { value: 'letan', label: 'Mẫu Lễ tân (Cố định + Phụ cấp ăn trưa)' },
                    ]}
                  />
                </div>
              </section>

              <section className="form-section">
                <div className="form-section-head">
                  <div>
                    <h3 className="form-section-title">Phụ cấp</h3>
                    <p className="form-section-text">Thiết lập khoản hỗ trợ làm việc như ăn trưa, đi lại, điện thoại, ...</p>
                  </div>
                  <label className="switch">
                    <input type="checkbox" role="switch" aria-label="Áp dụng phụ cấp" checked={form.enableAllowance} onChange={(e) => update('enableAllowance', e.target.checked)} />
                    <span className="switch-track" aria-hidden="true" />
                  </label>
                </div>
                {form.enableAllowance && (
                  <div className="staff-compensation-table">
                    {allowances.length > 0 && (
                      <div className="staff-compensation-table-head">
                        <span>Tên phụ cấp</span>
                        <span>Loại phụ cấp</span>
                        <span>Phụ cấp thụ hưởng</span>
                        <span />
                      </div>
                    )}
                    {allowances.map((item) => (
                      <div key={item.id} className="staff-compensation-table-row">
                        <Select
                          id={`allow-name-${item.id}`}
                          value={item.name}
                          onChange={(val) => setAllowance(item.id, { name: val })}
                          fullWidth
                          placeholder="Chọn phụ cấp"
                          aria-label="Tên phụ cấp"
                          options={[
                            { value: 'Ăn trưa', label: 'Ăn trưa' },
                            { value: 'Đi lại', label: 'Đi lại, xăng xe' },
                            { value: 'Điện thoại', label: 'Điện thoại' },
                          ]}
                        />
                        <Select
                          id={`allow-type-${item.id}`}
                          value={item.type}
                          onChange={(val) => setAllowance(item.id, { type: val })}
                          fullWidth
                          aria-label="Loại phụ cấp"
                          options={[
                            { value: 'Phụ cấp cố định theo ngày', label: 'Phụ cấp cố định theo ngày' },
                            { value: 'Phụ cấp theo tháng', label: 'Phụ cấp cố định theo tháng' },
                          ]}
                        />
                        <MoneyInput className="input" aria-label="Phụ cấp thụ hưởng" value={item.amount} onChange={(val) => setAllowance(item.id, { amount: String(val) })} />
                        <button type="button" className="btn btn-ghost btn-icon" onClick={() => removeAllowance(item.id)} aria-label="Xóa phụ cấp" title="Xóa phụ cấp">
                          <i className="ph ph-trash" />
                        </button>
                      </div>
                    ))}
                    <button type="button" className="btn btn-link btn-sm" onClick={addAllowance}>
                      <i className="ph ph-plus" /> Thêm phụ cấp
                    </button>
                  </div>
                )}
              </section>

              <section className="form-section">
                <div className="form-section-head">
                  <div>
                    <h3 className="form-section-title">Giảm trừ</h3>
                    <p className="form-section-text">Thiết lập khoản giảm trừ như đi muộn, về sớm, vi phạm nội quy, ...</p>
                  </div>
                  <label className="switch">
                    <input type="checkbox" role="switch" aria-label="Áp dụng giảm trừ" checked={form.enableDeduction} onChange={(e) => update('enableDeduction', e.target.checked)} />
                    <span className="switch-track" aria-hidden="true" />
                  </label>
                </div>
                {form.enableDeduction && (
                  <div className="staff-compensation-table">
                    {deductions.length > 0 && (
                      <div className="staff-compensation-table-head">
                        <span>Tên giảm trừ</span>
                        <span>Cách tính</span>
                        <span>Khoản giảm trừ</span>
                        <span />
                      </div>
                    )}
                    {deductions.map((item) => (
                      <div key={item.id} className="staff-compensation-table-row">
                        <Select
                          id={`deduct-name-${item.id}`}
                          value={item.name}
                          onChange={(val) => setDeduction(item.id, { name: val })}
                          fullWidth
                          placeholder="Chọn giảm trừ"
                          aria-label="Tên giảm trừ"
                          options={[
                            { value: 'Đi muộn', label: 'Đi muộn' },
                            { value: 'Về sớm', label: 'Về sớm' },
                            { value: 'Vi phạm khác', label: 'Vi phạm khác' },
                          ]}
                        />
                        <Select
                          id={`deduct-unit-${item.id}`}
                          value={item.unit}
                          onChange={(val) => setDeduction(item.id, { unit: val })}
                          fullWidth
                          aria-label="Cách tính"
                          options={[
                            { value: 'Theo số lần', label: 'Theo số lần' },
                            { value: 'Theo số phút', label: 'Theo số phút' },
                            { value: 'Cố định tháng', label: 'Cố định tháng' },
                          ]}
                        />
                        <MoneyInput className="input" aria-label="Khoản giảm trừ" value={item.amount} onChange={(val) => setDeduction(item.id, { amount: String(val) })} />
                        <button type="button" className="btn btn-ghost btn-icon" onClick={() => removeDeduction(item.id)} aria-label="Xóa giảm trừ" title="Xóa giảm trừ">
                          <i className="ph ph-trash" />
                        </button>
                      </div>
                    ))}
                    <button type="button" className="btn btn-link btn-sm" onClick={addDeduction}>
                      <i className="ph ph-plus" /> Thêm giảm trừ
                    </button>
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        <footer className="modal-footer">
          <button className="btn btn-secondary" type="button" onClick={onClose} disabled={mutation.isPending}>
            Bỏ qua
          </button>
          {activeTab === 'salary' && !isEditing && (
            <button className="btn btn-secondary" type="button" disabled={mutation.isPending} onClick={(e) => submit(e)}>
              Lưu và tạo mẫu lương mới
            </button>
          )}
          <button className="btn btn-primary" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Đang lưu...' : isEditing ? 'Lưu thay đổi' : 'Lưu'}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

function CollapsibleSection({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <section className="form-section is-collapsible">
      <button type="button" className="form-section-toggle" aria-expanded={open} onClick={onToggle}>
        {title}
        <i className="ph ph-caret-down" aria-hidden="true" />
      </button>
      {open && <div className="form-section-body form-grid">{children}</div>}
    </section>
  );
}
