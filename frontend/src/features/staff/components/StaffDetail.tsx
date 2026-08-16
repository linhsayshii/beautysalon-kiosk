import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { StatusBadge } from '@/components/data-display/Badges';
import { formatDate, formatMoney, formatPercent } from '@/lib/format';
import type { ApiRecord } from '@/types/api';
import { statusLabels } from '@/types/api';
import { getPayroll, getSchedule } from '../staff.api';

type StaffTab = 'info' | 'schedule' | 'salary' | 'payslips' | 'debt';

const tabs: { value: StaffTab; label: string }[] = [
  { value: 'info', label: 'Thông tin' },
  { value: 'schedule', label: 'Lịch làm việc' },
  { value: 'salary', label: 'Thiết lập lương' },
  { value: 'payslips', label: 'Phiếu lương' },
  { value: 'debt', label: 'Nợ và tạm ứng' },
];

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

  return <div className="staff-detail-panel">
    <div className="staff-detail-heading"><div><strong>Lịch làm việc trong tuần</strong><span>{formatDate(weekStart)} - {formatDate(days[6])}</span></div></div>
    <div className="table-scroll"><table className="data-table staff-week-schedule"><thead><tr><th>Ngày</th><th>Ca làm việc</th><th>Thời gian</th><th>Trạng thái</th></tr></thead><tbody>{days.map((date) => {
      const shift = shifts.find((item: ApiRecord) => item.date === date);
      return <tr key={date}><td data-label="Ngày"><strong>{formatDate(date)}</strong></td><td data-label="Ca làm việc">{shift?.shiftName ?? 'Chưa xếp ca'}</td><td data-label="Thời gian">{shift ? `${shift.startsAt} - ${shift.endsAt}` : '-'}</td><td data-label="Trạng thái">{shift ? <StatusBadge status={shift.status ?? 'scheduled'} /> : <span className="cell-sub">Chưa có lịch</span>}</td></tr>;
    })}</tbody></table></div>
  </div>;
}

function StaffSalaryTab({ staff, onEdit }: { staff: ApiRecord; onEdit: (initialTab: 'info' | 'salary') => void }) {
  return <div className="staff-detail-panel staff-salary-detail">
    <section><div><span>Loại lương</span><strong>{statusLabels[staff.salaryType] ?? salaryDescriptions[String(staff.salaryType)] ?? '-'}</strong></div><div><span>Mức lương</span><strong>{formatMoney(staff.baseSalary)} / kỳ lương</strong></div></section>
    <section><div><span>Lương làm thêm giờ</span><strong>{Number(staff.hourlyRate) > 0 ? `${formatMoney(staff.hourlyRate)} / giờ` : 'Không áp dụng'}</strong></div></section>
    <section><div><span>Hoa hồng</span><strong>{Number(staff.defaultCommissionRate) > 0 ? formatPercent(staff.defaultCommissionRate) : 'Không áp dụng'}</strong><small>Áp dụng cho doanh thu dịch vụ và tư vấn bán hàng.</small></div></section>
    <section><div><span>Quyền thao tác</span><strong>{staff.canSell ? 'Bán hàng' : 'Không bán hàng'}{staff.canManageInventory ? ', quản lý kho' : ''}</strong></div></section>
    <div className="staff-detail-actions"><button className="primary-button" type="button" onClick={() => onEdit('salary')}><i className="ph ph-pencil-simple" />Cập nhật</button></div>
  </div>;
}

function StaffPayslipsTab({ staff }: { staff: ApiRecord }) {
  const query = useQuery({ queryKey: ['staff-detail-payroll', staff.id], queryFn: () => getPayroll('') });
  if (query.isPending) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const data = query.data.data;
  const rows = (data?.rows ?? []).filter((row: ApiRecord) => Number(row.staff?.id) === Number(staff.id));
  if (!rows.length) return <EmptyState message="Nhân viên chưa có phiếu lương trong kỳ gần nhất." />;

  return <div className="staff-detail-panel"><div className="table-scroll"><table className="data-table inline-detail-table"><thead><tr><th>Mã phiếu</th><th>Kỳ làm việc</th><th>Lương chính</th><th>Hoa hồng</th><th>Phụ cấp</th><th>Thực lĩnh</th><th>Trạng thái</th></tr></thead><tbody>{rows.map((row: ApiRecord) => <tr key={row.id}><td data-label="Mã phiếu"><span className="cell-main link">PL{String(row.id).padStart(6, '0')}</span></td><td data-label="Kỳ làm việc">{data.period ? `${formatDate(data.period.startsOn)} - ${formatDate(data.period.endsOn)}` : '-'}</td><td data-label="Lương chính" className="money-cell">{formatMoney(row.baseSalary)}</td><td data-label="Hoa hồng" className="money-cell">{formatMoney(row.commission)}</td><td data-label="Phụ cấp" className="money-cell">{formatMoney(row.allowance)}</td><td data-label="Thực lĩnh" className="money-cell">{formatMoney(row.netSalary)}</td><td data-label="Trạng thái"><StatusBadge status={row.status} /></td></tr>)}</tbody></table></div></div>;
}

export function StaffDetail({ staff, onEdit }: { staff: ApiRecord; onEdit: (initialTab: 'info' | 'salary') => void }) {
  const [tab, setTab] = useState<StaffTab>('info');

  return <div className="staff-detail">
    <div className="inline-detail-tabs" role="tablist" aria-label={`Chi tiết nhân viên ${staff.name}`}>{tabs.map((item) => <button type="button" role="tab" aria-selected={tab === item.value} className={tab === item.value ? 'is-active' : ''} key={item.value} onClick={() => setTab(item.value)}>{item.label}</button>)}</div>
    {tab === 'info' ? <div className="staff-detail-panel staff-information">
      <div className="staff-profile-head"><span className={`staff-profile-avatar ${staff.avatarTone ?? 'blue'}`}><i className="ph ph-user" /></span><div><strong>{staff.name}</strong><span>Mã nhân viên: {staff.code}</span><small>{staff.role}</small></div></div>
      <div className="staff-detail-facts"><div><span>Số điện thoại</span><strong>{staff.phone ?? 'Chưa có'}</strong></div><div><span>Phòng ban</span><strong>{staff.department ?? 'Chưa thiết lập'}</strong></div><div><span>Chức danh</span><strong>{staff.role}</strong></div><div><span>Chi nhánh làm việc</span><strong>{staff.branchName ?? 'Chi nhánh hiện tại'}</strong></div><div><span>Hình thức lương</span><strong>{statusLabels[staff.salaryType] ?? '-'}</strong></div><div><span>Trạng thái</span><strong>{staff.active === false ? 'Ngừng hoạt động' : 'Đang hoạt động'}</strong></div></div>
      <div className="staff-detail-actions"><button className="primary-button" type="button" onClick={() => onEdit('info')}><i className="ph ph-pencil-simple" />Cập nhật</button></div>
    </div> : tab === 'schedule' ? <StaffScheduleTab staff={staff} /> : tab === 'salary' ? <StaffSalaryTab staff={staff} onEdit={onEdit} /> : tab === 'payslips' ? <StaffPayslipsTab staff={staff} /> : <div className="staff-detail-panel"><EmptyState message="Nhân viên chưa có phiếu nợ hoặc tạm ứng." /></div>}
  </div>;
}
