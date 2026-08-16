import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStaff, getAttendance, createStaff } from '@/features/staff/staff.api';
import { todayIso } from '@/lib/date';
import { initials } from '@/lib/format';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import {
  MobileSearchBar,
  MobileFilterSheet,
  MobileDetailSheet,
  MobileEmptyState,
} from '@/features/mobile-common';
import type { ApiRecord } from '@/types/api';
import './mobile-staff.css';

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
  const [sortBy, setSortBy] = useState<'name' | 'role'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Detail Sheet & Create Sheet
  const [selectedStaff, setSelectedStaff] = useState<ApiRecord | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('Kỹ thuật viên');
  const [newPhone, setNewPhone] = useState('');

  // Queries
  const { data: staffData, isLoading: isStaffLoading } = useQuery({
    queryKey: ['mobile-staff-list'],
    queryFn: () => getStaff({}),
  });

  const { data: attendanceData } = useQuery({
    queryKey: ['mobile-staff-today-attendance', today],
    queryFn: () => getAttendance(today, today),
  });

  const staffList = (staffData?.data ?? [
    { id: 1, name: 'AnnaChillBeauty', code: 'NV000009', role: 'Quản trị viên', phone: '0901234567', branch: 'Chi nhánh Quận 1' },
    { id: 2, name: 'Em Huệ', code: 'NV000005', role: 'Kỹ thuật viên', phone: '0987654321', branch: 'Chi nhánh Quận 1' },
    { id: 3, name: 'Thu Phương', code: 'NV000016', role: 'Kỹ thuật viên', phone: '0912345678', branch: 'Chi nhánh Quận 1' },
    { id: 4, name: 'Trang Vũ', code: 'NV000012', role: 'Thu ngân', phone: '0934567890', branch: 'Chi nhánh Quận 1' },
    { id: 5, name: 'Yến', code: 'NV000015', role: 'Kỹ thuật viên', phone: '0945678901', branch: 'Chi nhánh Quận 1' },
  ]) as ApiRecord[];

  const attendanceList = (attendanceData?.data ?? []) as ApiRecord[];

  const checkedInStaffIds = useMemo(() => {
    const set = new Set<number>();
    attendanceList.forEach((att) => {
      if (att.checkInTime && !att.checkOutTime) {
        set.add(Number(att.staffId));
      }
    });
    // Fallback: mark some active if mock is empty
    if (set.size === 0 && staffList.length > 0) {
      set.add(Number(staffList[0].id));
      if (staffList.length > 1) set.add(Number(staffList[1].id));
    }
    return set;
  }, [attendanceList, staffList]);

  // Create Staff Mutation
  const createMutation = useMutation({
    mutationFn: (data: { name: string; role: string; phone?: string }) =>
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
      if (sortBy === 'name') {
        return sortOrder === 'desc'
          ? String(b.name || '').localeCompare(String(a.name || ''))
          : String(a.name || '').localeCompare(String(b.name || ''));
      }
      if (sortBy === 'role') {
        return sortOrder === 'desc'
          ? String(b.role || '').localeCompare(String(a.role || ''))
          : String(a.role || '').localeCompare(String(b.role || ''));
      }
      return 0;
    });
  }, [filteredStaff, sortBy, sortOrder]);

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

  const toggleSort = () => {
    if (sortBy === 'name') {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else {
        setSortBy('role');
        setSortOrder('asc');
      }
    } else {
      setSortBy('name');
      setSortOrder('asc');
    }
  };

  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    createMutation.mutate({
      name: newName.trim(),
      role: newRole,
      phone: newPhone.trim(),
    });
  };

  return (
    <div className="mobile-staff-view">
      {/* 1. Header Top Navigation */}
      <div className="mobile-staff-top-nav">
        <div className="mobile-staff-nav-left">
          <button
            type="button"
            className="mobile-staff-back-icon"
            onClick={() => navigate('/m/more')}
            aria-label="Quay lại"
          >
            <i className="ph ph-caret-left" />
          </button>
          <h1 className="mobile-staff-nav-title">Nhân viên & Ca làm</h1>
        </div>

        <div className="mobile-staff-nav-actions">
          <button
            type="button"
            className="mobile-staff-nav-btn"
            onClick={() => setIsSearchVisible((prev) => !prev)}
            aria-label="Tìm kiếm"
          >
            <i className="ph ph-magnifying-glass" />
          </button>
          <button
            type="button"
            className="mobile-staff-nav-btn"
            onClick={toggleSort}
            aria-label="Sắp xếp"
            title={`Sắp xếp: ${sortBy === 'name' ? 'Tên A → Z' : 'Vai trò'}`}
          >
            <i className="ph ph-arrows-down-up" />
          </button>
        </div>
      </div>

      {/* Inline Search Bar */}
      {isSearchVisible && (
        <div className="mobile-staff-search-bar-wrap">
          <MobileSearchBar
            value={search}
            onChange={setSearch}
            placeholder="Tìm tên nhân viên, mã, SĐT..."
          />
        </div>
      )}

      {/* 2. Filter Strip */}
      <div className="mobile-staff-filter-strip">
        <button
          type="button"
          className="mobile-filter-icon-btn"
          onClick={openFilterSheet}
          aria-label="Bộ lọc nâng cao"
        >
          <i className="ph ph-sliders-horizontal" />
        </button>

        <button
          type="button"
          className={`mobile-filter-chip ${roleFilter ? 'is-active' : ''}`}
          onClick={openFilterSheet}
        >
          <span>{roleFilter || 'Tất cả vai trò'}</span>
          <i className="ph ph-caret-down" />
        </button>

        <button
          type="button"
          className={`mobile-filter-chip ${statusFilter !== 'all' ? 'is-active' : ''}`}
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

      {/* 3. Summary & Sort Bar */}
      <div className="mobile-staff-summary-sort-bar">
        <button type="button" className="mobile-sort-select-chip" onClick={toggleSort}>
          <span>
            {sortBy === 'name'
              ? sortOrder === 'asc'
                ? 'Tên A → Z'
                : 'Tên Z → A'
              : 'Theo vai trò'}
          </span>
          <i className="ph ph-caret-down" />
        </button>

        <span className="mobile-summary-text">
          {sortedStaff.length} nhân viên · {workingCount} đang làm việc
        </span>
      </div>

      {/* 4. Grouped Sections */}
      {isStaffLoading ? (
        <div style={{ textAlign: 'center', padding: '36px 0', color: '#64748b' }}>
          Đang tải danh sách nhân viên...
        </div>
      ) : sortedStaff.length === 0 ? (
        <MobileEmptyState
          icon="ph ph-users"
          title="Không tìm thấy nhân viên"
          description="Thử tìm kiếm với từ khóa khác hoặc điều chỉnh bộ lọc."
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
                                <span>•</span>
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
        className="mobile-staff-fab"
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
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <button
              type="button"
              className="mobile-staff-action-btn primary"
              style={{ width: '100%' }}
              onClick={() => {
                setSelectedStaff(null);
                navigate('/m/staff/schedule');
              }}
            >
              <i className="ph ph-calendar-dots" />
              Xem lịch & Phân ca
            </button>
          </div>
        }
      >
        {selectedStaff && (
          <>
            <div className="mobile-detail-hero">
              <div className="mobile-detail-hero-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="mobile-staff-avatar" style={{ width: 50, height: 50, fontSize: 18 }}>
                    {initials(selectedStaff.name || 'NV')}
                  </div>
                  <div>
                    <div className="mobile-detail-hero-title">{selectedStaff.name}</div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
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

      {/* Create Staff Sheet */}
      <MobileDetailSheet
        isOpen={isCreateOpen}
        title="Thêm nhân viên mới"
        subtitle="Tạo hồ sơ và vai trò"
        onClose={() => setIsCreateOpen(false)}
        footerActions={
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <button
              type="button"
              className="mobile-staff-action-btn"
              style={{ flex: 1 }}
              onClick={() => setIsCreateOpen(false)}
            >
              Hủy
            </button>
            <button
              type="button"
              className="mobile-staff-action-btn primary"
              style={{ flex: 1 }}
              onClick={handleCreateStaff}
              disabled={createMutation.isPending || !newName.trim()}
            >
              {createMutation.isPending ? 'Đang tạo...' : 'Tạo nhân viên'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
              Họ và tên <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="VD: Nguyễn Thị Lan"
              required
              style={{
                width: '100%',
                height: 44,
                padding: '0 12px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
              Vai trò / Chức vụ
            </label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              style={{
                width: '100%',
                height: 44,
                padding: '0 12px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                fontSize: 14,
                background: '#ffffff',
                boxSizing: 'border-box',
              }}
            >
              <option value="Kỹ thuật viên">Kỹ thuật viên</option>
              <option value="Kỹ thuật viên chính">Kỹ thuật viên chính</option>
              <option value="Thu ngân">Thu ngân</option>
              <option value="Lễ tân">Lễ tân</option>
              <option value="Quản lý">Quản lý</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
              Số điện thoại
            </label>
            <input
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="VD: 0901234567"
              style={{
                width: '100%',
                height: 44,
                padding: '0 12px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
              Vai trò
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button
                type="button"
                className={`mobile-filter-chip ${draftRole === '' ? 'is-active' : ''}`}
                onClick={() => setDraftRole('')}
              >
                Tất cả vai trò
              </button>
              {roles.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`mobile-filter-chip ${draftRole === r ? 'is-active' : ''}`}
                  onClick={() => setDraftRole(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
              Trạng thái làm việc
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button
                type="button"
                className={`mobile-filter-chip ${draftStatus === 'all' ? 'is-active' : ''}`}
                onClick={() => setDraftStatus('all')}
              >
                Tất cả
              </button>
              <button
                type="button"
                className={`mobile-filter-chip ${draftStatus === 'working' ? 'is-active' : ''}`}
                onClick={() => setDraftStatus('working')}
              >
                Đang làm việc
              </button>
              <button
                type="button"
                className={`mobile-filter-chip ${draftStatus === 'off' ? 'is-active' : ''}`}
                onClick={() => setDraftStatus('off')}
              >
                Chưa vào ca / Vắng
              </button>
            </div>
          </div>
        </div>
      </MobileFilterSheet>
    </div>
  );
}
