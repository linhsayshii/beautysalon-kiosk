import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '@/hooks/useWebSocket';
import { getStaff, getAttendance, createStaff } from '@/features/staff/staff.api';
import { StaffCreateDialog } from '@/features/staff/components/StaffCreateDialog';
import { todayIso } from '@/lib/date';
import { initials } from '@/lib/format';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { Select } from '@/components/ui/Select/Select';
import {
  MobileSearchBar,
  MobileFilterSheet,
  MobileDetailSheet,
  MobileEmptyState,
  MobileSortDropdown,
} from '@/features/mobile-common';
import type { ApiRecord } from '@/types/api';
import { MobilePageHeader } from '@/components/ui/MobilePageHeader/MobilePageHeader';
import { ErrorState, LoadingState } from '@/components/data-display/DataState';

export function MobileStaffManagementView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const today = todayIso();

  // Search & Navigation
  const [search, setSearch] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  // Filters
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'working' | 'off'>('all');

  // Draft filters for filter sheet
  const [draftRole, setDraftRole] = useState('');
  const [draftStatus, setDraftStatus] = useState<'all' | 'working' | 'off'>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Sorting
  const [sortValue, setSortValue] = useState<string>('name_asc');

  const sortOptions = [
    { value: 'name_asc', label: 'Tên A → Z' },
    { value: 'name_desc', label: 'Tên Z → A' },
    { value: 'role_asc', label: 'Vai trò A → Z' },
    { value: 'role_desc', label: 'Vai trò Z → A' },
  ];

  // Detail Sheet & Create Sheet
  const [selectedStaff, setSelectedStaff] = useState<ApiRecord | null>(null);
  const [editingStaff, setEditingStaff] = useState<ApiRecord | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('Kỹ thuật viên');
  const [newPhone, setNewPhone] = useState('');

  // Queries
  const { data: staffData, isLoading: isStaffLoading, error: staffError, refetch: refetchStaff } = useQuery({
    queryKey: ['mobile-staff-list'],
    queryFn: () => getStaff({}),
  });

  const { data: attendanceData, error: attendanceError, refetch: refetchAttendance } = useQuery({
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

  // Create Staff Mutation
  const createMutation = useMutation({
    mutationFn: (data: { name: string; role: string; phone?: string; profile?: ApiRecord }) =>
      createStaff(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mobile-staff-list'] });
      notify('Đã thêm nhân viên', `Nhân viên ${newName} đã được tạo.`);
      setIsCreateOpen(false);
      setNewName('');
      setNewPhone('');
    },
    onError: () => {
      notify('Lỗi tạo nhân viên', 'Không thể tạo nhân viên mới.');
    },
  });

  // WebSocket subscription for live updates
  const { subscribe } = useWebSocket();
  useEffect(() => {
    const unsub = subscribe(['staff:created', 'staff:updated'], () => {
      queryClient.invalidateQueries({ queryKey: ['mobile-staff-list'] });
    });
    return unsub;
  }, [subscribe, queryClient]);

  // Extract unique roles for filters
  const roles = useMemo(() => {
    const set = new Set<string>();
    staffList.forEach((s) => {
      if (s.role) set.add(s.role);
    });
    return Array.from(set);
  }, [staffList]);

  // Filtered staff
  const filteredStaff = useMemo(() => {
    return staffList.filter((staff) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = staff.name?.toLowerCase().includes(q);
        const matchCode = staff.code?.toLowerCase().includes(q);
        const matchPhone = staff.phone?.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchPhone) return false;
      }
      if (roleFilter && staff.role !== roleFilter) return false;
      const isWorking = checkedInStaffIds.has(Number(staff.id));
      if (statusFilter === 'working' && !isWorking) return false;
      if (statusFilter === 'off' && isWorking) return false;
      return true;
    });
  }, [staffList, search, roleFilter, statusFilter, checkedInStaffIds]);

  // Sort rows
  const sortedStaff = useMemo(() => {
    return [...filteredStaff].sort((a, b) => {
      if (sortValue === 'name_asc') {
        return String(a.name || '').localeCompare(String(b.name || ''));
      }
      if (sortValue === 'name_desc') {
        return String(b.name || '').localeCompare(String(a.name || ''));
      }
      if (sortValue === 'role_asc') {
        return String(a.role || '').localeCompare(String(b.role || ''));
      }
      if (sortValue === 'role_desc') {
        return String(b.role || '').localeCompare(String(a.role || ''));
      }
      return 0;
    });
  }, [filteredStaff, sortValue]);

  // Group by Role
  const groupedSections = useMemo(() => {
    const map = new Map<string, ApiRecord[]>();
    sortedStaff.forEach((row) => {
      const r = (row.role || 'KỸ THUẬT VIÊN').toUpperCase();
      const list = map.get(r) || [];
      list.push(row);
      map.set(r, list);
    });
    return Array.from(map.entries());
  }, [sortedStaff]);

  const workingCount = useMemo(() => {
    return sortedStaff.filter((s) => checkedInStaffIds.has(Number(s.id))).length;
  }, [sortedStaff, checkedInStaffIds]);

  const handleApplyFilter = () => {
    setRoleFilter(draftRole);
    setStatusFilter(draftStatus);
    setIsFilterOpen(false);
  };

  const handleResetFilter = () => {
    setDraftRole('');
    setDraftStatus('all');
    setRoleFilter('');
    setStatusFilter('all');
    setIsFilterOpen(false);
  };

  const openFilterSheet = () => {
    setDraftRole(roleFilter);
    setDraftStatus(statusFilter);
    setIsFilterOpen(true);
  };

  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    createMutation.mutate({
      name: newName.trim(),
      role: newRole,
      phone: newPhone.trim(),
      profile: { phone: newPhone.trim() },
    });
  };

  return (
    <div className="m-page">
      <MobilePageHeader
        title="Nhân viên & Ca làm" backTo="/m/more"
        actions={(
          <>
            <button
              type="button"
              className={`btn btn-ghost btn-icon m-header-action${isSearchVisible ? ' is-active' : ''}`}
              onClick={() => { if (isSearchVisible) setSearch(''); setIsSearchVisible(!isSearchVisible); }}
              aria-label="Tìm kiếm"
            >
              <i className="ph ph-magnifying-glass" />
            </button>
          </>
        )}
      >
        {isSearchVisible && (
          <MobileSearchBar
            value={search}
            onChange={setSearch}
            autoFocus
            placeholder="Tìm tên nhân viên, mã, SĐT..."
          />
        )}

        <div className="m-chip-strip">
          <button
            type="button"
            className="chip chip-icon"
            onClick={openFilterSheet}
            aria-label="Bộ lọc nâng cao"
          >
            <i className="ph ph-sliders-horizontal" />
          </button>

          <button
            type="button"
            className={`chip ${roleFilter ? 'is-active' : ''}`}
            onClick={openFilterSheet}
          >
            <span>{roleFilter || 'Tất cả vai trò'}</span>
            <i className="ph ph-caret-down" />
          </button>

          <button
            type="button"
            className={`chip ${statusFilter !== 'all' ? 'is-active' : ''}`}
            onClick={openFilterSheet}
          >
            <span>
              {statusFilter === 'working'
                ? 'Đang làm việc'
                : statusFilter === 'off'
                ? 'Chưa vào ca'
                : 'Trạng thái làm việc'}
            </span>
            <i className="ph ph-caret-down" />
          </button>
        </div>

        <div className="m-summary-bar">
          <MobileSortDropdown
            value={sortValue}
            options={sortOptions}
            onChange={setSortValue}
          />

          <span className="m-summary-count">
            {sortedStaff.length} nhân viên · {attendanceError ? 'Chưa tải chấm công' : `${workingCount} đang làm`}
          </span>
        </div>
      </MobilePageHeader>

      {attendanceError && <ErrorState compact title="Không thể xác định nhân viên đang làm việc" error={attendanceError} onRetry={() => refetchAttendance()} />}
      {/* 4. Grouped Sections */}
      {staffError ? <ErrorState compact error={staffError} onRetry={() => refetchStaff()} /> : isStaffLoading ? (
        <LoadingState compact label="Đang tải danh sách nhân viên..." />
      ) : sortedStaff.length === 0 ? (
        <MobileEmptyState
          icon="ph ph-users"
          title="Không tìm thấy nhân viên"
          description={search ? 'Thử từ khóa khác hoặc đổi bộ lọc.' : undefined}
        />
      ) : (
        <div className="mobile-grouped-list-container">
          {groupedSections.map(([groupName, items]) => (
            <div key={groupName} className="mobile-grouped-section">
              <div className="mobile-section-header">
                <span className="mobile-section-title">{groupName}</span>
                <span className="mobile-section-count">{items.length}</span>
              </div>
              <div className="mobile-section-card">
                {items.map((staff) => {
                  const isWorking = checkedInStaffIds.has(Number(staff.id));
                  return (
                    <div
                      key={staff.id}
                      className="mobile-grouped-row"
                      onClick={() => setSelectedStaff(staff)}
                    >
                      <div className="mobile-staff-row-left">
                        <div className="mobile-staff-avatar">
                          {initials(staff.name || 'NV')}
                        </div>
                        <div className="mobile-staff-row-info">
                          <span className="mobile-staff-row-name">{staff.name}</span>
                          <span className="mobile-staff-row-sub">
                            <span>{staff.role || 'Kỹ thuật viên'}</span>
                            {staff.phone && (
                              <>
                                <span>·</span>
                                <a
                                  href={`tel:${staff.phone}`}
                                  className="mobile-staff-tel-link"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {staff.phone}
                                </a>
                              </>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="mobile-staff-row-right">
                        <div className={`mobile-staff-status-pill ${isWorking ? 'online' : 'offline'}`}>
                          <span className="status-dot" />
                          <span>{isWorking ? 'Đang làm' : 'Vắng'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating Action Button (FAB) */}
      <button
        type="button"
        className="m-fab"
        onClick={() => setIsCreateOpen(true)}
        aria-label="Thêm nhân viên"
      >
        <i className="ph ph-plus" />
      </button>

      {/* Inset Detail Sheet */}
      <MobileDetailSheet
        isOpen={Boolean(selectedStaff)}
        title="Hồ sơ nhân viên"
        subtitle={selectedStaff?.code || ''}
        onClose={() => setSelectedStaff(null)}
        footerActions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setSelectedStaff(null);
              navigate('/m/staff/schedule');
            }}
          >
            <i className="ph ph-calendar-dots" />
            Xem lịch & Phân ca
          </button>
        }
      >
        {selectedStaff && (
          <>
            <div className="mobile-detail-hero">
              <div className="mobile-staff-detail-card-header">
                <span>Thông tin nhân viên</span>
                <button
                  type="button"
                  className="mobile-staff-detail-edit-link"
                  onClick={() => setEditingStaff(selectedStaff)}
                >
                  Sửa
                </button>
              </div>
              <div className="mobile-detail-hero-header">
                <div className="mobile-staff-hero-main">
                  <div className="mobile-staff-avatar is-lg">
                    {initials(selectedStaff.name || 'NV')}
                  </div>
                  <div>
                    <div className="mobile-detail-hero-title">{selectedStaff.name}</div>
                    <div className="mobile-staff-hero-role">
                      {selectedStaff.role || 'Kỹ thuật viên'}
                    </div>
                  </div>
                </div>
                <div
                  className={`mobile-staff-status-pill ${
                    checkedInStaffIds.has(Number(selectedStaff.id)) ? 'online' : 'offline'
                  }`}
                >
                  <span className="status-dot" />
                  <span>
                    {checkedInStaffIds.has(Number(selectedStaff.id)) ? 'Đang làm' : 'Chưa vào ca'}
                  </span>
                </div>
              </div>
            </div>

            <div className="mobile-detail-grid">
              <div className="mobile-detail-cell">
                <span className="mobile-detail-cell-label">Mã nhân viên</span>
                <span className="mobile-detail-cell-value">{selectedStaff.code || 'NV000000'}</span>
              </div>
              <div className="mobile-detail-cell">
                <span className="mobile-detail-cell-label">Số điện thoại</span>
                <span className="mobile-detail-cell-value">
                  {selectedStaff.phone ? (
                    <a href={`tel:${selectedStaff.phone}`} className="mobile-staff-tel-link">
                      {selectedStaff.phone}
                    </a>
                  ) : (
                    'Chưa cập nhật'
                  )}
                </span>
              </div>
              <div className="mobile-detail-cell">
                <span className="mobile-detail-cell-label">Chi nhánh làm việc</span>
                <span className="mobile-detail-cell-value">
                  {selectedStaff.branch || selectedStaff.branchName || 'Chi nhánh Quận 1'}
                </span>
              </div>
              <div className="mobile-detail-cell">
                <span className="mobile-detail-cell-label">Trạng thái công</span>
                <span className="mobile-detail-cell-value">
                  {checkedInStaffIds.has(Number(selectedStaff.id)) ? 'Đã vào ca' : 'Nghỉ ca'}
                </span>
              </div>
            </div>
          </>
        )}
      </MobileDetailSheet>

      {editingStaff && (
        <StaffCreateDialog
          staff={editingStaff}
          onClose={() => setEditingStaff(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['mobile-staff-list'] });
            queryClient.invalidateQueries({ queryKey: ['mobile-staff-today-attendance', today] });
          }}
        />
      )}

      {/* Create Staff Sheet */}
      <MobileDetailSheet
        isOpen={isCreateOpen}
        title="Thêm nhân viên mới"
        subtitle="Tạo hồ sơ và vai trò"
        onClose={() => setIsCreateOpen(false)}
        footerActions={<>
          <button type="button" className="btn btn-secondary" onClick={() => setIsCreateOpen(false)}>
            Hủy
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleCreateStaff}
            disabled={createMutation.isPending || !newName.trim()}
          >
            {createMutation.isPending ? 'Đang tạo...' : 'Tạo nhân viên'}
          </button>
        </>}
      >
        <form onSubmit={handleCreateStaff} className="form-stack">
          <div className="field">
            <label className="field-label" htmlFor="mobile-staff-name">
              Họ và tên <span className="field-required">*</span>
            </label>
            <input
              id="mobile-staff-name"
              className="input"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="VD: Nguyễn Thị Lan"
              required
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="mobile-staff-role">Vai trò / Chức vụ</label>
            <Select
              id="mobile-staff-role"
              value={newRole}
              onChange={setNewRole}
              fullWidth
              options={['Kỹ thuật viên', 'Kỹ thuật viên chính', 'Thu ngân', 'Lễ tân', 'Quản lý'].map((role) => ({ value: role, label: role }))}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="mobile-staff-phone">Số điện thoại</label>
            <input
              id="mobile-staff-phone"
              className="input"
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="VD: 0901234567"
            />
          </div>
        </form>
      </MobileDetailSheet>

      {/* Filter Bottom Sheet */}
      <MobileFilterSheet
        isOpen={isFilterOpen}
        title="Bộ lọc nhân viên"
        onClose={() => setIsFilterOpen(false)}
        onApply={handleApplyFilter}
        onReset={handleResetFilter}
      >
        <div className="form-stack">
          <fieldset className="field">
            <legend className="field-label">Vai trò</legend>
            <div className="chip-group">
              <button type="button" className="chip" aria-pressed={draftRole === ''} onClick={() => setDraftRole('')}>
                Tất cả vai trò
              </button>
              {roles.map((r) => (
                <button key={r} type="button" className="chip" aria-pressed={draftRole === r} onClick={() => setDraftRole(r)}>
                  {r}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="field">
            <legend className="field-label">Trạng thái làm việc</legend>
            <div className="chip-group">
              <button type="button" className="chip" aria-pressed={draftStatus === 'all'} onClick={() => setDraftStatus('all')}>
                Tất cả
              </button>
              <button type="button" className="chip" aria-pressed={draftStatus === 'working'} onClick={() => setDraftStatus('working')}>
                Đang làm việc
              </button>
              <button type="button" className="chip" aria-pressed={draftStatus === 'off'} onClick={() => setDraftStatus('off')}>
                Chưa vào ca / Vắng
              </button>
            </div>
          </fieldset>
        </div>
      </MobileFilterSheet>
    </div>
  );
}
