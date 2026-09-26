import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { Select } from '@/components/ui/Select/Select';
import { DatePickerField } from '@/components/ui/DateTimePicker';
import { todayIso } from '@/lib/date';
import { updateCustomer } from '@/features/operations/operations.api';
import type { ApiRecord } from '@/types/api';
import { BottomSheet } from '@/components/ui/Sheet/BottomSheet';

export interface MobileCustomerEditSheetProps {
  isOpen: boolean;
  customer: ApiRecord | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function MobileCustomerEditSheet({
  isOpen,
  customer,
  onClose,
  onSuccess,
}: MobileCustomerEditSheetProps) {
  const queryClient = useQueryClient();
  let notify = (_title: string, _msg: string = '') => {};
  try {
    const toast = useToast();
    if (toast && toast.notify) {
      notify = (t: string, m?: string) => toast.notify(t, m || '');
    }
  } catch {
    // Fallback if rendered outside ToastProvider in tests
  }

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [customerGroup, setCustomerGroup] = useState('Cá nhân');
  const [email, setEmail] = useState('');
  const [facebook, setFacebook] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (customer) {
      setName(String(customer.name || ''));
      setCode(String(customer.code || ''));
      setPhone(String(customer.phone || ''));
      setDob(customer.dob ? String(customer.dob).slice(0, 10) : '');
      setGender(String(customer.gender || ''));
      setCustomerGroup(String(customer.group || customer.customerGroup || 'Cá nhân'));
      setEmail(String(customer.email || ''));
      setFacebook(String(customer.facebook || ''));
      setErrors({});
    }
  }, [customer]);

  const mutation = useMutation({
    mutationFn: (body: Parameters<typeof updateCustomer>[1]) => {
      if (!customer) throw new Error('Không có thông tin khách hàng');
      return updateCustomer(Number(customer.id), body);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['mobile-customers'] });
      queryClient.invalidateQueries({ queryKey: ['mobile-customer-detail', customer?.id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', customer?.id] });
      notify('Thành công', `Đã cập nhật khách hàng ${res.data?.name || name}`);
      if (onSuccess) onSuccess();
      onClose();
    },
  });

  if (!isOpen || !customer) return null;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Vui lòng nhập tên khách hàng';
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Email không đúng định dạng';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    mutation.mutate({
      name: name.trim(),
      code: code.trim().toUpperCase() || undefined,
      phone: phone.trim() || undefined,
      dob: dob || null,
      gender: gender || null,
      customerGroup: customerGroup || 'Cá nhân',
      email: email.trim() || null,
      facebook: facebook.trim() || null,
    });
  };

  return (
    <BottomSheet
      open={isOpen && Boolean(customer)}
      onClose={() => { if (!mutation.isPending) onClose(); }}
      title="Sửa thông tin khách hàng"
      height="full"
      tone="muted"
      testId="mobile-customer-edit-sheet"
      footer={(
        <button type="button" className="btn btn-primary btn-lg" onClick={handleSave} disabled={mutation.isPending}>
          {mutation.isPending ? 'Đang lưu...' : 'Lưu'}
        </button>
      )}
    >
      <form onSubmit={handleSave} className="form-stack">
        {mutation.error && (
          <div className="mobile-form-card-field has-error">
            <span className="mobile-form-card-error">
              <i className="ph ph-warning-circle" /> {(mutation.error as Error).message || 'Có lỗi xảy ra khi lưu khách hàng'}
            </span>
          </div>
        )}

        {/* Tên khách hàng */}
        <div className={`mobile-form-card-field ${errors.name ? 'has-error' : ''}`}>
          <label htmlFor="customer-edit-name" className="mobile-form-card-label">
            Tên khách hàng<span className="required-star">*</span>
          </label>
          <div className="mobile-form-card-row">
            <input
              id="customer-edit-name"
              className="mobile-form-card-input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
              }}
              placeholder="Nhập tên khách hàng"
            />
          </div>
          {errors.name && <span className="mobile-form-card-error">{errors.name}</span>}
        </div>

        {/* Mã khách hàng */}
        <div className="mobile-form-card-field">
          <label htmlFor="customer-edit-code" className="mobile-form-card-label">
            Mã khách hàng
          </label>
          <div className="mobile-form-card-row">
            <input
              id="customer-edit-code"
              className="mobile-form-card-input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="KH000000"
            />
            <div className="mobile-form-card-accessory">
              <i className="ph ph-identification-card" />
            </div>
          </div>
        </div>

        {/* Số điện thoại */}
        <div className="mobile-form-card-field">
          <label htmlFor="customer-edit-phone" className="mobile-form-card-label">
            Số điện thoại
          </label>
          <div className="mobile-form-card-row">
            <input
              id="customer-edit-phone"
              type="tel"
              className="mobile-form-card-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09xx xxx xxx"
            />
            <div className="mobile-form-card-accessory">
              <i className="ph ph-phone" />
            </div>
          </div>
        </div>

        {/* 2-col Grid: Ngày sinh & Giới tính */}
        <div className="mobile-form-card-grid-2">
          <div className="mobile-form-card-field">
            <label htmlFor="customer-edit-dob" className="mobile-form-card-label">
              Ngày sinh
            </label>
            <div className="mobile-form-card-row">
              <DatePickerField
                id="customer-edit-dob"
                className="mobile-form-card-input"
                value={dob}
                max={todayIso()}
                onChange={setDob}
              />
            </div>
          </div>

          <div className="mobile-form-card-field">
            <label htmlFor="customer-edit-gender" className="mobile-form-card-label">
              Giới tính
            </label>
            <div className="mobile-form-card-row">
              <Select
                id="customer-edit-gender"
                triggerClassName="mobile-form-card-select"
                fullWidth
                value={gender}
                onChange={setGender}
                options={[{ value: '', label: 'Chưa chọn' }, { value: 'Nữ', label: 'Nữ' }, { value: 'Nam', label: 'Nam' }, { value: 'Khác', label: 'Khác' }]}
              />
            </div>
          </div>
        </div>

        {/* Nhóm khách hàng */}
        <div className="mobile-form-card-field">
          <label htmlFor="customer-edit-group" className="mobile-form-card-label">
            Nhóm khách hàng
          </label>
          <div className="mobile-form-card-row">
            <Select
              id="customer-edit-group"
              triggerClassName="mobile-form-card-select"
              fullWidth
              value={customerGroup}
              onChange={setCustomerGroup}
              options={[{ value: 'Cá nhân', label: 'Cá nhân' }, { value: 'Công ty', label: 'Công ty' }]}
            />
          </div>
        </div>

        {/* Email */}
        <div className={`mobile-form-card-field ${errors.email ? 'has-error' : ''}`}>
          <label htmlFor="customer-edit-email" className="mobile-form-card-label">
            Email
          </label>
          <div className="mobile-form-card-row">
            <input
              id="customer-edit-email"
              type="email"
              className="mobile-form-card-input"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
              }}
              placeholder="example@mail.com"
            />
            <div className="mobile-form-card-accessory">
              <i className="ph ph-envelope-simple" />
            </div>
          </div>
          {errors.email && <span className="mobile-form-card-error">{errors.email}</span>}
        </div>

        {/* Facebook */}
        <div className="mobile-form-card-field">
          <label htmlFor="customer-edit-facebook" className="mobile-form-card-label">
            Facebook
          </label>
          <div className="mobile-form-card-row">
            <input
              id="customer-edit-facebook"
              className="mobile-form-card-input"
              value={facebook}
              onChange={(e) => setFacebook(e.target.value)}
              placeholder="Link hoặc tên Facebook"
            />
            <div className="mobile-form-card-accessory">
              <i className="ph ph-facebook-logo" />
            </div>
          </div>
        </div>
      </form>
    </BottomSheet>
  );
}
