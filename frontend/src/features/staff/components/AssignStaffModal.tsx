import { useState } from 'react';
import type { ApiRecord } from '@/types/api';
import { AvatarName } from '@/components/data-display/AvatarName';
import './AttendanceTimekeeping.css';

interface AssignStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  shiftName: string;
  startsAt: string;
  endsAt: string;
  shiftDate: string;
  staffList: ApiRecord[];
  assignedStaffIds: number[];
  onAssign: (staffId: number) => void;
}

export function AssignStaffModal({
  isOpen,
  onClose,
  shiftName,
  startsAt,
  endsAt,
  shiftDate,
  staffList,
  assignedStaffIds,
  onAssign,
}: AssignStaffModalProps) {
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filteredStaff = staffList.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Xếp nhân viên vào ca</h3>
            <p className="modal-subtitle">
              {shiftName} ({startsAt} - {endsAt}) · Ngày {shiftDate}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="modal-close-btn"
          >
            <i className="ph ph-x" />
          </button>
        </div>

        {/* Search */}
        <div className="modal-staff-search">
          <div className="attendance-search-box" style={{ minWidth: '100%' }}>
            <i className="ph ph-magnifying-glass" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm nhân viên..."
              className="attendance-search-input"
            />
          </div>
        </div>

        {/* Staff List */}
        <div className="modal-staff-list">
          {filteredStaff.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              Không tìm thấy nhân viên
            </div>
          ) : (
            filteredStaff.map((staff) => {
              const isAssigned = assignedStaffIds.includes(staff.id);
              return (
                <div key={staff.id} className="modal-staff-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AvatarName name={staff.name} subtitle={staff.code} tone={staff.avatarTone} />
                  </div>
                  {isAssigned ? (
                    <span className="badge-assigned">
                      <i className="ph ph-check" /> Đã xếp
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAssign(staff.id)}
                      className="btn-assign-select"
                    >
                      Chọn
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
