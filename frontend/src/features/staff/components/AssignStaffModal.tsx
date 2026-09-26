import { useState } from 'react';
import type { ApiRecord } from '@/types/api';
import { AvatarName } from '@/components/data-display/AvatarName';
import { EmptyState } from '@/components/data-display/DataState';
import { Modal } from '@/components/ui/Modal/Modal';

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
    <Modal
      open
      onClose={onClose}
      title="Xếp nhân viên vào ca"
      subtitle={<>{shiftName} ({startsAt} - {endsAt}) · Ngày {shiftDate}</>}
      size="md"
    >
      <div className="modal-body">
        <label className="search-control modal-staff-search">
          <i className="ph ph-magnifying-glass" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm nhân viên..."
            aria-label="Tìm kiếm nhân viên"
          />
        </label>

        {filteredStaff.length === 0 ? (
          <EmptyState compact title="Không tìm thấy nhân viên" message="Thử tìm theo tên hoặc mã nhân viên khác." />
        ) : (
          <div className="modal-staff-list">
            {filteredStaff.map((staff) => {
              const isAssigned = assignedStaffIds.includes(staff.id);
              return (
                <div key={staff.id} className="modal-staff-item">
                  <AvatarName name={staff.name} subtitle={staff.code} tone={staff.avatarTone} />
                  {isAssigned ? (
                    <span className="badge badge-success">
                      <i className="ph ph-check" /> Đã xếp
                    </span>
                  ) : (
                    <button type="button" onClick={() => onAssign(staff.id)} className="btn btn-soft btn-sm">
                      Chọn
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="modal-footer">
        <button
          type="button"
          onClick={onClose}
          className="btn btn-secondary"
        >
          Đóng
        </button>
      </div>
    </Modal>
  );
}
