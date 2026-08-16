import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Select } from '@/components/ui/Select/Select';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { createCustomer } from '../operations.api';
import type { ApiRecord } from '@/types/api';

interface CustomerCreateDialogProps {
  onClose: () => void;
  onSuccess?: (createdCustomer: ApiRecord) => void;
  customMutationFn?: (body: {
    name: string;
    code?: string;
    phone?: string;
    dob?: string | null;
    gender?: string | null;
    email?: string | null;
    facebook?: string | null;
  }) => Promise<{ data: ApiRecord }>;
}

const initialForm = {
  name: '',
  code: '',
  phone: '',
  dob: '',
  gender: '',
  email: '',
  facebook: '',
};

export function CustomerCreateDialog({ onClose, onSuccess, customMutationFn }: CustomerCreateDialogProps) {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const nameRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { notify } = useToast();

  useEffect(() => {
    nameRef.current?.focus();
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
    mutationFn: customMutationFn ?? createCustomer,
    onSuccess: (payload) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['pos-customers'] });
      queryClient.invalidateQueries({ queryKey: ['pos-appointment-customers'] });
      notify('Đã thêm khách hàng', `${payload.data.name} (${payload.data.code}) đã được lưu vào hệ thống.`);
      if (onSuccess) {
        onSuccess(payload.data);
      }
      onClose();
    },
  });

  const update = (key: keyof typeof initialForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) {
      next.name = 'Hãy nhập Tên khách hàng';
    }
    if (form.code && !/^[A-Za-z0-9._-]+$/.test(form.code)) {
      next.code = 'Mã chỉ dùng chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.';
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      next.email = 'Email không hợp lệ.';
    }
    setErrors(next);
    return !Object.keys(next).length;
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    mutation.mutate({
      name: form.name.trim(),
      code: form.code.trim() || undefined,
      phone: form.phone.trim() || undefined,
      dob: form.dob || null,
      gender: form.gender || null,
      email: form.email.trim() || null,
      facebook: form.facebook.trim() || null,
    });
  };

  return (
    <div
      className="goods-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !mutation.isPending) onClose();
      }}
    >
      <section className="goods-dialog customer-create-dialog" role="dialog" aria-modal="true" aria-labelledby="customer-dialog-title">
        <header className="goods-dialog-header">
          <h2 id="customer-dialog-title">Thêm khách hàng</h2>
          <button type="button" onClick={onClose} disabled={mutation.isPending} aria-label="Đóng">
            <i className="ph ph-x" />
          </button>
        </header>

        <form onSubmit={submit} noValidate>
          <div className="goods-dialog-body customer-dialog-body">
            {mutation.error && (
              <div className="goods-form-alert" role="alert">
                <i className="ph ph-warning-circle" />
                <span>
                  <strong>Không thể thêm khách hàng</strong>
                  <small>{mutation.error.message}</small>
                </span>
              </div>
            )}

            <div className="customer-form-top">
              <div className="customer-avatar-box">
                <div className="customer-avatar-circle">
                  <i className="ph-fill ph-user" />
                </div>
              </div>

              <div className="customer-top-fields">
                <div className="customer-field-row">
                  <div className={`goods-field ${errors.name ? 'has-error' : ''}`}>
                    <label htmlFor="customer-name">
                      Tên khách hàng <span>*</span>
                    </label>
                    <input
                      ref={nameRef}
                      id="customer-name"
                      value={form.name}
                      onChange={(event) => update('name', event.target.value)}
                      placeholder="Bắt buộc"
                      aria-invalid={Boolean(errors.name)}
                    />
                    {errors.name && <small className="field-error">{errors.name}</small>}
                  </div>

                  <div className="goods-field">
                    <label htmlFor="customer-code">Mã khách hàng</label>
                    <input
                      id="customer-code"
                      value={form.code}
                      onChange={(event) => update('code', event.target.value.toUpperCase())}
                      placeholder="Tự động"
                    />
                    {errors.code && <small className="field-error">{errors.code}</small>}
                  </div>
                </div>

                <div className="customer-field-row three-cols">
                  <div className="goods-field">
                    <label htmlFor="customer-phone">Số điện thoại</label>
                    <input
                      id="customer-phone"
                      type="tel"
                      value={form.phone}
                      onChange={(event) => update('phone', event.target.value)}
                      placeholder="Nhập số điện thoại"
                    />
                  </div>

                  <div className="goods-field">
                    <label htmlFor="customer-dob">Ngày sinh</label>
                    <div className="customer-date-input-wrap">
                      <input
                        id="customer-dob"
                        type="date"
                        value={form.dob}
                        onChange={(event) => update('dob', event.target.value)}
                        placeholder="--/--/----"
                      />
                    </div>
                  </div>

                  <div className="goods-field">
                    <label htmlFor="customer-gender">Giới tính</label>
                    <Select
                      id="customer-gender"
                      value={form.gender}
                      onChange={(val) => update('gender', val)}
                      placeholder="Chọn giới tính"
                      fullWidth
                      options={[
                        { value: '', label: 'Chọn giới tính' },
                        { value: 'Nam', label: 'Nam' },
                        { value: 'Nữ', label: 'Nữ' },
                        { value: 'Khác', label: 'Khác' },
                      ]}
                    />
                  </div>
                </div>

                <div className="customer-field-row">
                  <div className={`goods-field ${errors.email ? 'has-error' : ''}`}>
                    <label htmlFor="customer-email">Email</label>
                    <input
                      id="customer-email"
                      type="email"
                      value={form.email}
                      onChange={(event) => update('email', event.target.value)}
                      placeholder="Nhập email"
                    />
                    {errors.email && <small className="field-error">{errors.email}</small>}
                  </div>

                  <div className="goods-field">
                    <label htmlFor="customer-facebook">Facebook</label>
                    <input
                      id="customer-facebook"
                      value={form.facebook}
                      onChange={(event) => update('facebook', event.target.value)}
                      placeholder="Nhập link Facebook"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <footer className="goods-dialog-footer">
            <button className="secondary-button" type="button" onClick={onClose} disabled={mutation.isPending}>
              Bỏ qua
            </button>
            <button className="primary-button" type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Đang lưu...' : 'Lưu'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
