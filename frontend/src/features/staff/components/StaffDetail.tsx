import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { StatusBadge } from '@/components/data-display/Badges';
import { formatDate, formatMoney, formatPercent } from '@/lib/format';
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
    <div className="staff-detail-panel" style={{ padding: '16px 20px' }}>
      <div className="staff-detail-heading" style={{ marginBottom: 12 }}>
        <div>
          <strong style={{ fontSize: 14.5, color: '#1e293b' }}>Lịch làm việc trong tuần</strong>
          <span style={{ fontSize: 13, color: '#64748b', marginLeft: 8 }}>
            {formatDate(weekStart)} - {formatDate(days[6])}
          </span>
        </div>
      </div>
      <div className="table-scroll">
        <table className="kiotviet-payroll-table">
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
    <div className="staff-detail-panel staff-salary-detail" style={{ padding: '16px 20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px 24px', fontSize: 14.5, marginBottom: 16 }}>
        <div>
          <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Hình thức lương:</span>
          <strong>{statusLabels[staff.salaryType] ?? salaryDescriptions[String(staff.salaryType)] ?? '-'}</strong>
        </div>
        <div>
          <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Mức lương cơ bản:</span>
          <strong style={{ color: '#0052cc' }}>{formatMoney(staff.baseSalary)} / kỳ lương</strong>
        </div>
        <div>
          <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Lương làm thêm giờ:</span>
          <strong>{Number(staff.hourlyRate) > 0 ? `${formatMoney(staff.hourlyRate)} / giờ` : 'Không áp dụng'}</strong>
        </div>
        <div>
          <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Hoa hồng mặc định:</span>
          <strong>{Number(staff.defaultCommissionRate) > 0 ? formatPercent(staff.defaultCommissionRate) : 'Không áp dụng'}</strong>
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Quyền thao tác:</span>
          <strong>{staff.canSell ? 'Bán hàng' : 'Không bán hàng'}{staff.canManageInventory ? ', Quản lý kho' : ''}</strong>
        </div>
      </div>
      <div className="staff-detail-actions">
        <button
          className="primary-button"
          type="button"
          onClick={() => onEdit('salary')}
          style={{ background: '#0052cc', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontWeight: 600, fontSize: 13 }}
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
    <div className="staff-detail-panel" style={{ padding: '16px 20px' }}>
      <div className="table-scroll">
        <table className="kiotviet-payroll-table">
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
    <div className="staff-detail" style={{ background: '#ffffff', borderTop: '2px solid #0052cc', borderBottom: '1px solid #cbd5e1' }}>
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

      {tab === 'info' ? (
        <div className="staff-detail-panel staff-information" style={{ padding: '16px 20px' }}>
          <div className="staff-profile-head" style={{ marginBottom: 16 }}>
            <span className={`staff-profile-avatar ${staff.avatarTone ?? 'blue'}`}>
              <i className="ph ph-user" />
            </span>
            <div>
              <strong style={{ fontSize: 16 }}>{staff.name}</strong>
              <span style={{ fontSize: 13, color: '#64748b' }}>Mã nhân viên: {staff.code}</span>
              <small style={{ fontSize: 12, color: '#0052cc', fontWeight: 600 }}>{staff.role}</small>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px 24px', fontSize: 14.5, marginBottom: 16 }}>
            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Số điện thoại:</span>
              <strong>{staff.phone ?? 'Chưa có'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Phòng ban:</span>
              <strong>{staff.department ?? 'Chưa thiết lập'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Chức danh:</span>
              <strong>{staff.role}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Chi nhánh làm việc:</span>
              <strong>{staff.branchName ?? 'Chi nhánh hiện tại'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Hình thức lương:</span>
              <strong>{statusLabels[staff.salaryType] ?? '-'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Trạng thái:</span>
              <strong>{staff.active === false ? 'Ngừng hoạt động' : 'Đang hoạt động'}</strong>
            </div>
          </div>
          <div className="staff-detail-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => onEdit('info')}
              style={{ background: '#0052cc', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontWeight: 600, fontSize: 13 }}
            >
              <i className="ph ph-pencil-simple" />
              <span>Cập nhật</span>
            </button>
          </div>
        </div>
      ) : tab === 'schedule' ? (
        <StaffScheduleTab staff={staff} />
      ) : tab === 'salary' ? (
        <StaffSalaryTab staff={staff} onEdit={onEdit} />
      ) : tab === 'payslips' ? (
        <StaffPayslipsTab staff={staff} />
      ) : (
        <div className="staff-detail-panel" style={{ padding: 24 }}>
          <EmptyState message="Nhân viên chưa có phiếu nợ hoặc tạm ứng." />
        </div>
      )}
    </div>
  );
}
