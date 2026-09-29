import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/DataState';
import { DetailFacts, DetailHead, InlineDetail, ValueStrip } from '@/components/data-display/InlineDetail';
import { StatusBadge } from '@/components/data-display/Badges';
import { addCalendarDays, weekStartIso } from '@/lib/date';
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
  return weekStartIso();
}

const salaryTypeLabel = (staff: ApiRecord) =>
  statusLabels[staff.salaryType] ?? salaryDescriptions[String(staff.salaryType)] ?? staff.salaryType ?? '-';

const permissionsLabel = (staff: ApiRecord) =>
  `${staff.canSell ? 'Bán hàng' : 'Không bán hàng'}${staff.canManageInventory ? ', Quản lý kho' : ''}`;

function EditActions({ onEdit }: { onEdit: () => void }) {
  return (
    <div className="detail-actions">
      <button className="btn btn-primary btn-sm" type="button" onClick={onEdit}>
        <i className="ph ph-pencil-simple" />
        <span>Cập nhật</span>
      </button>
    </div>
  );
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
  const days = Array.from({ length: 7 }, (_, index) => addCalendarDays(weekStart, index));

  return (
    <>
      <p className="detail-section-title">
        Lịch làm việc trong tuần <small>{formatDate(weekStart)} - {formatDate(days[6])}</small>
      </p>
      <div className="table-scroll">
        <table className="detail-table">
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
                  <td className="text-strong">{formatDate(date)}</td>
                  <td>{shift?.shiftName ?? 'Chưa xếp ca'}</td>
                  <td>{shift ? `${shift.startsAt} - ${shift.endsAt}` : '-'}</td>
                  <td>
                    {shift ? <StatusBadge status={shift.status ?? 'scheduled'} /> : <span className="text-faint">Chưa có lịch</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function StaffSalaryTab({ staff, onEdit }: { staff: ApiRecord; onEdit: (initialTab: 'info' | 'salary') => void }) {
  return (
    <>
      <DetailFacts
        items={[
          { label: 'Hình thức lương', value: salaryTypeLabel(staff) },
          { label: 'Mức lương cơ bản', value: `${formatMoney(staff.baseSalary || 0)} / kỳ lương`, tone: 'primary' },
          { label: 'Lương làm thêm giờ', value: Number(staff.hourlyRate) > 0 ? `${formatMoney(staff.hourlyRate)} / giờ` : 'Không áp dụng' },
          { label: 'Quyền thao tác', value: permissionsLabel(staff), span: 'full' },
        ]}
      />
      <EditActions onEdit={() => onEdit('salary')} />
    </>
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
    <div className="table-scroll">
      <table className="detail-table">
        <thead>
          <tr>
            <th>Mã phiếu</th>
            <th>Kỳ làm việc</th>
            <th className="is-num">Lương chính</th>
            <th className="is-num">Hoa hồng</th>
            <th className="is-num">Hoa hồng tua</th>
            <th className="is-num">Phụ cấp</th>
            <th className="is-num">Thực lĩnh</th>
            <th className="is-center">Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row: ApiRecord) => (
            <tr key={row.id}>
              <td className="is-code">PL{String(row.id).padStart(6, '0')}</td>
              <td>{data.period ? `${formatDate(data.period.startsOn)} - ${formatDate(data.period.endsOn)}` : '-'}</td>
              <td className="is-num">{formatMoney(row.baseSalary)}</td>
              <td className="is-num">{formatMoney(row.commission)}</td>
              <td className="is-num">{formatMoney(row.tourCommission)}</td>
              <td className="is-num">{formatMoney(row.allowance)}</td>
              <td className="is-num text-strong text-success">{formatMoney(row.netSalary)}</td>
              <td className="is-center"><StatusBadge status={row.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StaffDebtTab({ staff }: { staff: ApiRecord }) {
  const debtBalance = Number(staff.debtBalance || 0);
  const advanceBalance = Number(staff.advanceBalance || 0);

  return (
    <>
      <DetailFacts
        columns={3}
        items={[
          { label: 'Dư nợ hiện tại', value: formatMoney(debtBalance), tone: debtBalance > 0 ? 'danger' : 'success' },
          { label: 'Tạm ứng trong kỳ', value: formatMoney(advanceBalance) },
          { label: 'Trạng thái công nợ', value: debtBalance > 0 ? 'Đang có khoản nợ cần thu' : 'Không có công nợ', tone: debtBalance > 0 ? 'danger' : 'success' },
        ]}
      />
      {debtBalance === 0 && advanceBalance === 0 && (
        <EmptyState message="Nhân viên chưa có khoản tạm ứng hoặc công nợ phát sinh." />
      )}
    </>
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
    <InlineDetail className="staff-detail" label={`Chi tiết nhân viên ${staff.name}`} tabs={tabs} tab={tab} onTabChange={setTab}>
      <DetailHead
        icon="ph-user"
        tone={staff.avatarTone}
        title={staff.name}
        tags={<span className="badge badge-info">{staff.role}</span>}
        meta={<>Mã nhân viên: <strong>{staff.code}</strong>{staff.department && ` • ${staff.department}`}</>}
        aside={<><div><strong>{staff.branchName || 'Chi nhánh trung tâm'}</strong></div><div>Ngày tạo: {formatDate(staff.createdAt)}</div></>}
      />

      <ValueStrip
        items={[
          { label: 'Doanh thu tháng', value: formatMoney(staff.monthRevenue || 0), tone: 'primary' },
          { label: 'Đơn tháng này', value: formatNumber(staff.monthOrders || 0) },
          { label: 'Lương cơ bản', value: formatMoney(staff.baseSalary || 0), tone: 'success' },
        ]}
      />

      {tab === 'info' && (
        <>
          <DetailFacts
            items={[
              { label: 'Số điện thoại', value: staff.phone ?? 'Chưa có' },
              { label: 'Phòng ban', value: staff.department ?? 'Chưa thiết lập' },
              { label: 'Chức danh', value: staff.role },
              { label: 'Chi nhánh làm việc', value: staff.branchName ?? 'Chi nhánh hiện tại' },
              { label: 'Hình thức lương', value: salaryTypeLabel(staff) },
              { label: 'Trạng thái hoạt động', value: staff.active === false ? 'Ngừng hoạt động' : 'Đang hoạt động' },
              { label: 'Ngày vào làm', value: staff.startDate ? formatDate(staff.startDate) : (staff.createdAt ? formatDate(staff.createdAt) : 'Chưa có') },
              { label: 'Quyền thao tác', value: permissionsLabel(staff) },
            ]}
          />
          <EditActions onEdit={() => onEdit('info')} />
        </>
      )}

      {tab === 'schedule' && <StaffScheduleTab staff={staff} />}
      {tab === 'salary' && <StaffSalaryTab staff={staff} onEdit={onEdit} />}
      {tab === 'payslips' && <StaffPayslipsTab staff={staff} />}
      {tab === 'debt' && <StaffDebtTab staff={staff} />}
    </InlineDetail>
  );
}
