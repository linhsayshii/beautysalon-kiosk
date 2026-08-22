import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { StatusBadge } from '@/components/data-display/Badges';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';
import type { ApiRecord } from '@/types/api';
import { statusLabels } from '@/types/api';
import { getPayroll, getSchedule } from '../staff.api';

type StaffTab = 'info' | 'schedule' | 'salary' | 'payslips' | 'debt';

const salaryDescriptions: Record<string, string> = {
  monthly: 'Lương tháng',
  hourly: 'Theo giờ làm việc',
  shift: 'Theo ca làm việc',
};

function currentMonday() {
  const date = new Date();
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return date.toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function StaffScheduleTab({ staff }: { staff: ApiRecord }) {
  const weekStart = currentMonday();
  const query = useQuery({
    queryKey: ['staff-detail-schedule', staff.id, weekStart],
    queryFn: () => getSchedule(weekStart),
  });
  if (query.isPending) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const shifts = (query.data.data?.shifts ?? []).filter((shift: ApiRecord) => Number(shift.staffId) === Number(staff.id));
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  return (
    <div className="staff-detail-panel" style={{ padding: '16px 0' }}>
      <div className="staff-detail-heading" style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong style={{ fontSize: 14.5, color: '#1e293b' }}>Lịch làm việc trong tuần</strong>
          <span style={{ fontSize: 13, color: '#64748b', marginLeft: 8 }}>
            {formatDate(weekStart)} - {formatDate(days[6])}
          </span>
        </div>
      </div>
      <div className="table-scroll" style={{ width: '100%' }}>
        <table className="kiotviet-payroll-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Ca làm việc</th>
              <th>Thời gian</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {days.map((date) => {
              const shift = shifts.find((item: ApiRecord) => item.date === date);
              return (
                <tr key={date}>
                  <td><strong>{formatDate(date)}</strong></td>
                  <td>{shift?.shiftName ?? 'Chưa xếp ca'}</td>
                  <td>{shift ? `${shift.startsAt} - ${shift.endsAt}` : '-'}</td>
                  <td>
                    {shift ? (
                      <StatusBadge status={shift.status ?? 'scheduled'} />
                    ) : (
                      <span style={{ color: '#94a3b8' }}>Chưa có lịch</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StaffSalaryTab({ staff, onEdit }: { staff: ApiRecord; onEdit: (initialTab: 'info' | 'salary') => void }) {
  return (
    <div className="staff-detail-panel staff-salary-detail" style={{ padding: '16px 0' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px 24px',
          fontSize: 14.5,
          marginBottom: 16,
        }}
      >
        <div>
          <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Hình thức lương:</span>
          <strong style={{ color: '#1e293b' }}>
            {statusLabels[staff.salaryType] ?? salaryDescriptions[String(staff.salaryType)] ?? staff.salaryType ?? '-'}
          </strong>
        </div>
        <div>
          <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Mức lương cơ bản:</span>
          <strong style={{ color: '#0052cc' }}>{formatMoney(staff.baseSalary || 0)} / kỳ lương</strong>
        </div>
        <div>
          <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Lương làm thêm giờ:</span>
          <strong style={{ color: '#1e293b' }}>
            {Number(staff.hourlyRate) > 0 ? `${formatMoney(staff.hourlyRate)} / giờ` : 'Không áp dụng'}
          </strong>
        </div>
        <div style={{ gridColumn: 'span 4' }}>
          <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Quyền thao tác:</span>
          <strong style={{ color: '#1e293b' }}>
            {staff.canSell ? 'Bán hàng' : 'Không bán hàng'}{staff.canManageInventory ? ', Quản lý kho' : ''}
          </strong>
        </div>
      </div>
      <div
        className="staff-detail-actions"
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: 16,
          paddingTop: 12,
          borderTop: '1px solid #f1f5f9',
        }}
      >
        <button
          className="primary-button"
          type="button"
          onClick={() => onEdit('salary')}
          style={{
            background: '#0052cc',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '7px 16px',
            fontWeight: 600,
            fontSize: 13,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
          }}
        >
          <i className="ph ph-pencil-simple" />
          <span>Cập nhật</span>
        </button>
      </div>
    </div>
  );
}

function StaffPayslipsTab({ staff }: { staff: ApiRecord }) {
  const query = useQuery({ queryKey: ['staff-detail-payroll', staff.id], queryFn: () => getPayroll('') });
  if (query.isPending) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const data = query.data.data;
  const rows = (data?.rows ?? []).filter((row: ApiRecord) => Number(row.staff?.id) === Number(staff.id));
  if (!rows.length) return <EmptyState message="Nhân viên chưa có phiếu lương trong kỳ gần nhất." />;

  return (
    <div className="staff-detail-panel" style={{ padding: '16px 0' }}>
      <div className="table-scroll" style={{ width: '100%' }}>
        <table className="kiotviet-payroll-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Mã phiếu</th>
              <th>Kỳ làm việc</th>
              <th style={{ textAlign: 'right' }}>Lương chính</th>
              <th style={{ textAlign: 'right' }}>Hoa hồng</th>
              <th style={{ textAlign: 'right' }}>Phụ cấp</th>
              <th style={{ textAlign: 'right' }}>Thực lĩnh</th>
              <th style={{ textAlign: 'center' }}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row: ApiRecord) => (
              <tr key={row.id}>
                <td style={{ fontWeight: 600, color: '#0052cc' }}>PL{String(row.id).padStart(6, '0')}</td>
                <td>{data.period ? `${formatDate(data.period.startsOn)} - ${formatDate(data.period.endsOn)}` : '-'}</td>
                <td style={{ textAlign: 'right' }}>{formatMoney(row.baseSalary)}</td>
                <td style={{ textAlign: 'right' }}>{formatMoney(row.commission)}</td>
                <td style={{ textAlign: 'right' }}>{formatMoney(row.allowance)}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>{formatMoney(row.netSalary)}</td>
                <td style={{ textAlign: 'center' }}><StatusBadge status={row.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StaffDebtTab({ staff }: { staff: ApiRecord }) {
  const debtBalance = Number(staff.debtBalance || 0);
  const advanceBalance = Number(staff.advanceBalance || 0);

  return (
    <div className="staff-detail-panel staff-debt-panel" style={{ padding: '16px 0' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px 24px',
          fontSize: 14.5,
          marginBottom: 16,
        }}
      >
        <div>
          <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Dư nợ hiện tại:</span>
          <strong style={{ color: debtBalance > 0 ? '#e11d48' : '#059669', fontSize: 16 }}>
            {formatMoney(debtBalance)}
          </strong>
        </div>
        <div>
          <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Tạm ứng trong kỳ:</span>
          <strong style={{ color: '#1e293b', fontSize: 16 }}>{formatMoney(advanceBalance)}</strong>
        </div>
        <div>
          <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Trạng thái công nợ:</span>
          <strong style={{ color: debtBalance > 0 ? '#e11d48' : '#059669' }}>
            {debtBalance > 0 ? 'Đang có khoản nợ cần thu' : 'Không có công nợ'}
          </strong>
        </div>
      </div>
      {debtBalance === 0 && advanceBalance === 0 && (
        <EmptyState message="Nhân viên chưa có khoản tạm ứng hoặc công nợ phát sinh." />
      )}
    </div>
  );
}

export function StaffDetail({ staff, onEdit }: { staff: ApiRecord; onEdit: (initialTab: 'info' | 'salary') => void }) {
  const [tab, setTab] = useState<StaffTab>('info');

  const tabs: { value: StaffTab; label: string }[] = [
    { value: 'info', label: 'Thông tin' },
    { value: 'schedule', label: 'Lịch làm việc' },
    { value: 'salary', label: 'Thiết lập lương' },
    { value: 'payslips', label: 'Phiếu lương' },
    { value: 'debt', label: 'Nợ và tạm ứng' },
  ];

  return (
    <div
      className="staff-detail"
      style={{
        background: '#ffffff',
        borderTop: '2px solid #0052cc',
        borderBottom: '1px solid #cbd5e1',
        padding: 0,
      }}
    >
      {/* Layer 2: Inline Detail Tabs */}
      <div className="inline-detail-tabs" role="tablist" aria-label={`Chi tiết nhân viên ${staff.name}`}>
        {tabs.map((item) => (
          <button
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            className={tab === item.value ? 'is-active' : ''}
            key={item.value}
            onClick={() => setTab(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '16px 20px' }}>
        {/* Layer 3: Profile Head */}
        <div
          className="staff-profile-head"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span
              className={`staff-profile-avatar ${staff.avatarTone ?? 'blue'}`}
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 48,
                height: 48,
                borderRadius: '50%',
                fontSize: 24,
                flexShrink: 0,
              }}
            >
              <i className="ph ph-user" />
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 16, color: '#1e293b' }}>{staff.name}</strong>
                <span
                  style={{
                    fontSize: 12,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: '#e0f2fe',
                    color: '#0052cc',
                    fontWeight: 600,
                  }}
                >
                  {staff.role}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>
                <span>Mã nhân viên: </span>
                <strong style={{ color: '#1e293b' }}>{staff.code}</strong>
                {staff.department && (
                  <span style={{ color: '#64748b' }}> • {staff.department}</span>
                )}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
            <div>
              <strong style={{ color: '#1e293b' }}>{staff.branchName || 'Chi nhánh trung tâm'}</strong>
            </div>
            <div>Ngày tạo: {formatDate(staff.createdAt)}</div>
          </div>
        </div>

        {/* Layer 4: 4-Column Value Strip */}
        <div
          className="staff-value-strip"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            background: '#f8fafc',
            padding: 12,
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            marginBottom: 16,
            fontSize: 14,
          }}
        >
          <div>
            <span style={{ color: '#64748b' }}>Doanh thu tháng: </span>
            <strong style={{ color: '#0052cc' }}>{formatMoney(staff.monthRevenue || 0)}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Đơn tháng này: </span>
            <strong style={{ color: '#1e293b' }}>{formatNumber(staff.monthOrders || 0)}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Lương cơ bản: </span>
            <strong style={{ color: '#059669' }}>{formatMoney(staff.baseSalary || 0)}</strong>
          </div>
        </div>

        {/* Layer 5: Tab Contents */}
        {tab === 'info' && (
          <div className="staff-detail-panel staff-information" style={{ padding: 0 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '16px 24px',
                fontSize: 14.5,
                marginBottom: 16,
              }}
            >
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Số điện thoại:</span>
                <strong style={{ color: '#1e293b' }}>{staff.phone ?? 'Chưa có'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Phòng ban:</span>
                <strong style={{ color: '#1e293b' }}>{staff.department ?? 'Chưa thiết lập'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Chức danh:</span>
                <strong style={{ color: '#1e293b' }}>{staff.role}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Chi nhánh làm việc:</span>
                <strong style={{ color: '#1e293b' }}>{staff.branchName ?? 'Chi nhánh hiện tại'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Hình thức lương:</span>
                <strong style={{ color: '#1e293b' }}>
                  {statusLabels[staff.salaryType] ?? salaryDescriptions[String(staff.salaryType)] ?? staff.salaryType ?? '-'}
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Trạng thái hoạt động:</span>
                <strong style={{ color: '#1e293b' }}>{staff.active === false ? 'Ngừng hoạt động' : 'Đang hoạt động'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Ngày vào làm:</span>
                <strong style={{ color: '#1e293b' }}>
                  {staff.startDate ? formatDate(staff.startDate) : (staff.createdAt ? formatDate(staff.createdAt) : 'Chưa có')}
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Quyền thao tác:</span>
                <strong style={{ color: '#1e293b' }}>
                  {staff.canSell ? 'Bán hàng' : 'Không bán hàng'}{staff.canManageInventory ? ', Quản lý kho' : ''}
                </strong>
              </div>
            </div>
            <div
              className="staff-detail-actions"
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: 16,
                paddingTop: 12,
                borderTop: '1px solid #f1f5f9',
              }}
            >
              <button
                className="primary-button"
                type="button"
                onClick={() => onEdit('info')}
                style={{
                  background: '#0052cc',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '7px 16px',
                  fontWeight: 600,
                  fontSize: 13,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
              >
                <i className="ph ph-pencil-simple" />
                <span>Cập nhật</span>
              </button>
            </div>
          </div>
        )}

        {tab === 'schedule' && <StaffScheduleTab staff={staff} />}
        {tab === 'salary' && <StaffSalaryTab staff={staff} onEdit={onEdit} />}
        {tab === 'payslips' && <StaffPayslipsTab staff={staff} />}
        {tab === 'debt' && <StaffDebtTab staff={staff} />}
      </div>
    </div>
  );
}
