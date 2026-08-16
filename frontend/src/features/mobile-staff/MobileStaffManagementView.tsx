import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStaff, getAttendance } from '@/features/staff/staff.api';
import { todayIso } from '@/lib/date';
import { initials } from '@/lib/format';
import type { ApiRecord } from '@/types/api';
import './mobile-staff.css';

export function MobileStaffManagementView() {
  const today = todayIso();

  const { data: staffData, isLoading: isStaffLoading } = useQuery({
    queryKey: ['mobile-staff-list'],
    queryFn: () => getStaff({}),
  });

  const { data: attendanceData } = useQuery({
    queryKey: ['mobile-staff-today-attendance', today],
    queryFn: () => getAttendance(today, today),
  });

  const staffList = (staffData?.data ?? []) as ApiRecord[];
  const attendanceList = (attendanceData?.data ?? []) as ApiRecord[];

  const checkedInStaffIds = useMemo(() => {
    const set = new Set<number>();
    attendanceList.forEach((att) => {
      if (att.checkInTime && !att.checkOutTime) {
        set.add(Number(att.staffId));
      }
    });
    return set;
  }, [attendanceList]);

  const activeCount = checkedInStaffIds.size;
  const totalCount = staffList.length;

  return (
    <div className="mobile-staff-container">
      <div className="mobile-staff-header">
        <h1>Nhân sự & Ca làm</h1>
      </div>

      {/* Monitor strip */}
      <div className="staff-monitor-grid">
        <div className="staff-monitor-stat">
          <div className="stat-num" style={{ color: '#16a34a' }}>{activeCount}</div>
          <div className="stat-label">Đang làm việc</div>
        </div>
        <div className="staff-monitor-stat">
          <div className="stat-num">{totalCount}</div>
          <div className="stat-label">Tổng nhân viên</div>
        </div>
        <div className="staff-monitor-stat">
          <div className="stat-num" style={{ color: '#ea580c' }}>{Math.max(0, totalCount - activeCount)}</div>
          <div className="stat-label">Chưa vào ca</div>
        </div>
      </div>

      {/* Staff List */}
      <div className="mobile-staff-card-list">
        {isStaffLoading ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b' }}>Đang tải danh sách nhân viên...</div>
        ) : staffList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8' }}>Chưa có dữ liệu nhân viên.</div>
        ) : (
          staffList.map((staff) => {
            const isWorking = checkedInStaffIds.has(Number(staff.id));
            return (
              <div key={staff.id} className="mobile-staff-card">
                <div className="mobile-staff-avatar">
                  {initials(staff.name)}
                </div>
                <div className="mobile-staff-info">
                  <span className="mobile-staff-name">{staff.name}</span>
                  <span className="mobile-staff-role">{staff.role || 'Kỹ thuật viên'} • {staff.phone || 'Chưa có SĐT'}</span>
                </div>
                <div className={`mobile-staff-status-pill ${isWorking ? 'online' : 'offline'}`}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: isWorking ? '#16a34a' : '#94a3b8',
                  }} />
                  {isWorking ? 'Đang làm' : 'Vắng'}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
