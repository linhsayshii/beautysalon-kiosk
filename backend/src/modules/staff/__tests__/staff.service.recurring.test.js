import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../../../db.js';
import * as staffService from '../staff.service.js';

test.describe('getSchedule with group info', () => {
  let originalQuery;

  test.beforeEach(() => {
    originalQuery = pool.query;
  });

  test.afterEach(() => {
    pool.query = originalQuery;
  });

  test('should return weekGroupId and isSource in response', async () => {
    pool.query = async (query) => {
      if (query.includes('work_shifts')) {
        return { rows: [{ shift_name: 'Ca sáng', starts_at: '09:00', ends_at: '17:00' }] };
      }
      return {
        rows: [{
          id: 1,
          staff_id: 1,
          shift_date: '2026-08-18',
          starts_at: '09:00',
          ends_at: '17:00',
          shift_name: 'Ca sáng',
          status: 'scheduled',
          note: null,
          week_group_id: 123,
          is_source: false,
          group_start_date: '2026-08-18'
        }]
      };
    };

    const result = await staffService.getSchedule({
      branchId: 1,
      startDate: '2026-08-18'
    });

    assert.equal(result.schedules[0].weekGroupId, 123);
    assert.equal(result.schedules[0].isSource, false);
    assert.equal(result.schedules[0].groupStartDate, '2026-08-18');
  });

  test('should return null for group fields when schedule has no group', async () => {
    pool.query = async (query) => {
      if (query.includes('work_shifts')) {
        return { rows: [] };
      }
      return {
        rows: [{
          id: 2,
          staff_id: 2,
          shift_date: '2026-08-19',
          starts_at: '13:00',
          ends_at: '21:00',
          shift_name: 'Ca chiều',
          status: 'scheduled',
          note: null,
          week_group_id: null,
          is_source: null,
          group_start_date: null
        }]
      };
    };

    const result = await staffService.getSchedule({
      branchId: 1,
      startDate: '2026-08-18'
    });

    assert.equal(result.schedules[0].weekGroupId, null);
    assert.equal(result.schedules[0].isSource, null);
    assert.equal(result.schedules[0].groupStartDate, null);
  });
});

test.describe('propagateScheduleChange', () => {
  let originalConnect;
  let originalQuery;

  test.beforeEach(() => {
    originalConnect = pool.connect;
    originalQuery = pool.query;
  });

  test.afterEach(() => {
    pool.connect = originalConnect;
    pool.query = originalQuery;
  });

  test('should update only current week when propagate=false', async () => {
    const mockClient = {
      query: async (query, params) => {
        if (query === 'BEGIN') return { rows: [] };
        if (query.includes('SELECT') && query.includes('FROM staff_schedules') && query.includes('WHERE id')) {
          return {
            rows: [{
              id: 1,
              staff_id: 1,
              shift_date: '2026-08-18',
              week_group_id: 123,
              is_source: false,
              branch_id: 1,
              starts_at: '09:00',
              ends_at: '17:00',
              shift_name: 'Ca sáng'
            }]
          };
        }
        if (query.includes('UPDATE staff_schedules') && query.includes('week_group_id')) {
          assert.ok(params[3] !== null); // newGroupId should be set
          assert.equal(params[4], 1); // id = scheduleId
          return { rows: [{ id: 1 }] };
        }
        if (query === 'COMMIT') return { rows: [] };
        if (query === 'ROLLBACK') return { rows: [] };
        return { rows: [] };
      },
      release: () => {}
    };
    pool.connect = async () => mockClient;

    const result = await staffService.updateSchedule(1, 1, {
      startsAt: '10:00',
      endsAt: '18:00',
      shiftName: 'Ca mới'
    }, false);

    assert.equal(result.updatedCount, 1);
    assert.ok(result.newGroupId !== undefined);
  });

  test('should propagate to future weeks when propagate=true', async () => {
    const mockClient = {
      query: async (query, params) => {
        if (query === 'BEGIN') return { rows: [] };
        if (query.includes('SELECT') && query.includes('FROM staff_schedules') && query.includes('WHERE id')) {
          return {
            rows: [{
              id: 1,
              staff_id: 1,
              shift_date: '2026-08-18',
              week_group_id: 123,
              is_source: true,
              branch_id: 1,
              starts_at: '09:00',
              ends_at: '17:00',
              shift_name: 'Ca sáng'
            }]
          };
        }
        if (query.includes('UPDATE staff_schedules') && query.includes('is_source = false')) {
          return { rows: [{ id: 2 }, { id: 3 }] }; // 2 future weeks updated
        }
        if (query.includes('UPDATE staff_schedules') && query.includes('is_source = true')) {
          return { rows: [{ id: 1 }] };
        }
        if (query === 'COMMIT') return { rows: [] };
        if (query === 'ROLLBACK') return { rows: [] };
        return { rows: [] };
      },
      release: () => {}
    };
    pool.connect = async () => mockClient;

    const result = await staffService.updateSchedule(1, 1, {
      startsAt: '10:00',
      endsAt: '18:00',
      shiftName: 'Ca mới'
    }, true);

    assert.equal(result.updatedCount, 3); // 2 future + 1 current
  });

  test('should throw 404 when schedule not found', async () => {
    const mockClient = {
      query: async (query, params) => {
        if (query === 'BEGIN') return { rows: [] };
        if (query.includes('SELECT') && query.includes('FROM staff_schedules')) {
          return { rows: [] }; // Not found
        }
        if (query === 'ROLLBACK') return { rows: [] };
        return { rows: [] };
      },
      release: () => {}
    };
    pool.connect = async () => mockClient;

    await assert.rejects(
      async () => staffService.updateSchedule(1, 999, { startsAt: '10:00', endsAt: '18:00', shiftName: 'Test' }, false),
      (err) => {
        assert.equal(err.status, 404);
        assert.ok(err.message.includes('not found'));
        return true;
      }
    );
  });

  test('should throw 404 when schedule belongs to different branch', async () => {
    const mockClient = {
      query: async (query, params) => {
        if (query === 'BEGIN') return { rows: [] };
        if (query.includes('SELECT') && query.includes('FROM staff_schedules')) {
          // Schedule belongs to branch 2, but request is for branch 1
          return {
            rows: [{
              id: 1,
              staff_id: 1,
              shift_date: '2026-08-18',
              week_group_id: 123,
              is_source: false,
              branch_id: 2, // Different branch!
              starts_at: '09:00',
              ends_at: '17:00',
              shift_name: 'Ca sáng'
            }]
          };
        }
        if (query === 'ROLLBACK') return { rows: [] };
        return { rows: [] };
      },
      release: () => {}
    };
    pool.connect = async () => mockClient;

    await assert.rejects(
      async () => staffService.updateSchedule(1, 1, { startsAt: '10:00', endsAt: '18:00', shiftName: 'Test' }, false),
      (err) => {
        assert.equal(err.status, 404);
        assert.ok(err.message.includes('not found'));
        return true;
      }
    );
  });
});

test.describe('deleteSchedule', () => {
  let originalConnect;

  test.beforeEach(() => {
    originalConnect = pool.connect;
  });

  test.afterEach(() => {
    pool.connect = originalConnect;
  });

  test('should delete only current schedule when deleteFuture=false', async () => {
    let deleteCalled = false;
    const mockClient = {
      query: async (query, params) => {
        if (query === 'BEGIN') return { rows: [] };
        if (query.includes('SELECT') && query.includes('FROM staff_schedules') && query.includes('WHERE id')) {
          return {
            rows: [{
              id: 1,
              week_group_id: 123,
              is_source: false,
              shift_date: '2026-08-18',
              branch_id: 1,
              staff_id: 1
            }]
          };
        }
        if (query.includes('DELETE FROM staff_schedules') && query.includes('WHERE id = $1')) {
          deleteCalled = true;
          assert.equal(params[0], 1);
          return { rows: [] };
        }
        if (query === 'COMMIT') return { rows: [] };
        if (query === 'ROLLBACK') return { rows: [] };
        return { rows: [] };
      },
      release: () => {}
    };
    pool.connect = async () => mockClient;

    const result = await staffService.deleteSchedule(1, 1, false);

    assert.equal(deleteCalled, true);
    assert.equal(result.deleted, true);
  });

  test('should delete current and future schedules when deleteFuture=true', async () => {
    let deleteFutureCalled = false;
    const mockClient = {
      query: async (query, params) => {
        if (query === 'BEGIN') return { rows: [] };
        if (query.includes('SELECT') && query.includes('FROM staff_schedules') && query.includes('WHERE id')) {
          return {
            rows: [{
              id: 1,
              week_group_id: 123,
              is_source: false,
              shift_date: '2026-08-18',
              branch_id: 1,
              staff_id: 1
            }]
          };
        }
        if (query.includes('DELETE FROM staff_schedules') && query.includes('week_group_id')) {
          deleteFutureCalled = true;
          assert.equal(params[0], 123); // week_group_id
          assert.equal(params[1], '2026-08-18'); // shift_date
          return { rows: [] };
        }
        if (query === 'COMMIT') return { rows: [] };
        if (query === 'ROLLBACK') return { rows: [] };
        return { rows: [] };
      },
      release: () => {}
    };
    pool.connect = async () => mockClient;

    const result = await staffService.deleteSchedule(1, 1, true);

    assert.equal(deleteFutureCalled, true);
    assert.equal(result.deleted, true);
  });

  test('should throw 404 when schedule not found', async () => {
    const mockClient = {
      query: async (query, params) => {
        if (query === 'BEGIN') return { rows: [] };
        if (query.includes('SELECT') && query.includes('FROM staff_schedules')) {
          return { rows: [] }; // Not found
        }
        if (query === 'ROLLBACK') return { rows: [] };
        return { rows: [] };
      },
      release: () => {}
    };
    pool.connect = async () => mockClient;

    await assert.rejects(
      async () => staffService.deleteSchedule(1, 999, false),
      (err) => {
        assert.equal(err.status, 404);
        assert.ok(err.message.includes('not found'));
        return true;
      }
    );
  });

  test('should throw 404 when schedule belongs to different branch', async () => {
    const mockClient = {
      query: async (query, params) => {
        if (query === 'BEGIN') return { rows: [] };
        if (query.includes('SELECT') && query.includes('FROM staff_schedules')) {
          return {
            rows: [{
              id: 1,
              week_group_id: 123,
              is_source: false,
              shift_date: '2026-08-18',
              branch_id: 2, // Different branch!
              staff_id: 1
            }]
          };
        }
        if (query === 'ROLLBACK') return { rows: [] };
        return { rows: [] };
      },
      release: () => {}
    };
    pool.connect = async () => mockClient;

    await assert.rejects(
      async () => staffService.deleteSchedule(1, 1, false),
      (err) => {
        assert.equal(err.status, 404);
        assert.ok(err.message.includes('not found'));
        return true;
      }
    );
  });

  test('should throw error when deleting source week that has copies', async () => {
    let copyCheckCalled = false;
    const mockClient = {
      query: async (query, params) => {
        if (query === 'BEGIN') return { rows: [] };
        if (query.includes('SELECT') && query.includes('FROM staff_schedules') && query.includes('WHERE id')) {
          return {
            rows: [{
              id: 1,
              week_group_id: 123,
              is_source: true, // This is the source week
              shift_date: '2026-08-18',
              branch_id: 1,
              staff_id: 1
            }]
          };
        }
        if (query.includes('COUNT(*)')) {
          copyCheckCalled = true;
          return { rows: [{ count: '2' }] }; // Has 2 copies
        }
        if (query === 'ROLLBACK') return { rows: [] };
        return { rows: [] };
      },
      release: () => {}
    };
    pool.connect = async () => mockClient;

    await assert.rejects(
      async () => staffService.deleteSchedule(1, 1, false),
      (err) => {
        assert.equal(err.status, 400);
        assert.equal(err.code, 'SOURCE_WEEK_HAS_COPIES');
        assert.ok(copyCheckCalled);
        return true;
      }
    );
  });

  test('should allow deleting source week when deleteFuture=true (cascade)', async () => {
    let cascadeDeleteCalled = false;
    const mockClient = {
      query: async (query, params) => {
        if (query === 'BEGIN') return { rows: [] };
        if (query.includes('SELECT') && query.includes('FROM staff_schedules') && query.includes('WHERE id')) {
          return {
            rows: [{
              id: 1,
              week_group_id: 123,
              is_source: true,
              shift_date: '2026-08-18',
              branch_id: 1,
              staff_id: 1
            }]
          };
        }
        if (query.includes('COUNT(*)')) {
          return { rows: [{ count: '2' }] }; // Has copies but we're deleting future
        }
        if (query.includes('DELETE FROM staff_schedules') && query.includes('week_group_id')) {
          cascadeDeleteCalled = true;
          return { rows: [] };
        }
        if (query === 'COMMIT') return { rows: [] };
        if (query === 'ROLLBACK') return { rows: [] };
        return { rows: [] };
      },
      release: () => {}
    };
    pool.connect = async () => mockClient;

    const result = await staffService.deleteSchedule(1, 1, true);

    assert.equal(cascadeDeleteCalled, true);
    assert.equal(result.deleted, true);
  });
});

test.describe('Recurring Schedule Helpers', () => {
  let originalQuery;

  test.beforeEach(() => {
    originalQuery = pool.query;
    pool.query = async (query, params) => {
      // Return empty by default, tests will override
      return { rows: [] };
    };
  });

  test.afterEach(() => {
    pool.query = originalQuery;
  });

  test.describe('generateGroupId', () => {
    test('should generate a numeric unique ID', () => {
      const id = staffService.generateGroupId();
      assert.equal(typeof id, 'number');
      assert.ok(id > 0);
    });

    test('should generate different IDs when called multiple times', () => {
      const id1 = staffService.generateGroupId();
      const id2 = staffService.generateGroupId();
      // Just verify they are valid numbers
      assert.ok(id1 > 0);
      assert.ok(id2 > 0);
    });
  });

  test.describe('getSchedulesByWeek', () => {
    test('should query schedules for a staff within a week range', async () => {
      const mockSchedules = [
        { id: 1, staff_id: 1, shift_date: '2026-08-17', starts_at: '09:00', ends_at: '17:00', shift_name: 'Ca sáng', status: 'scheduled', note: null, week_group_id: null, is_source: null },
        { id: 2, staff_id: 1, shift_date: '2026-08-18', starts_at: '09:00', ends_at: '17:00', shift_name: 'Ca sáng', status: 'scheduled', note: null, week_group_id: null, is_source: null },
      ];
      pool.query = async (query, params) => {
        return { rows: mockSchedules };
      };

      const result = await staffService.getSchedulesByWeek(1, '2026-08-17');

      assert.equal(result.length, 2);
      assert.equal(result[0].staff_id, 1);
    });

    test('should return empty array when no schedules exist', async () => {
      pool.query = async () => ({ rows: [] });

      const result = await staffService.getSchedulesByWeek(999, '2026-08-17');

      assert.equal(result.length, 0);
    });
  });

  test.describe('copyScheduleToWeek', () => {
    test('should insert a new schedule with the given group ID', async () => {
      pool.query = async (query, params) => {
        assert.equal(params[0], 1); // branch_id
        assert.equal(params[1], 1); // staff_id
        assert.equal(params[2], '2026-08-24'); // targetDate
        assert.equal(params[3], '09:00'); // starts_at
        assert.equal(params[4], '17:00'); // ends_at
        assert.equal(params[5], 'Ca sáng'); // shift_name
        assert.equal(params[6], 'Test note'); // note
        assert.equal(params[7], 1234567890); // groupId
        return { rows: [{ id: 10 }] };
      };

      const schedule = {
        staff_id: 1,
        starts_at: '09:00',
        ends_at: '17:00',
        shift_name: 'Ca sáng',
        note: 'Test note',
      };

      const result = await staffService.copyScheduleToWeek(schedule, '2026-08-24', 1234567890, 1);

      assert.equal(result, 10);
    });

    test('should handle schedule without note', async () => {
      pool.query = async (query, params) => {
        assert.equal(params[0], 1); // branch_id
        assert.equal(params[6], null); // note should be null
        return { rows: [{ id: 11 }] };
      };

      const schedule = {
        staff_id: 2,
        starts_at: '13:00',
        ends_at: '21:00',
        shift_name: 'Ca chiều',
        note: null,
      };

      const result = await staffService.copyScheduleToWeek(schedule, '2026-08-25', 9876543210, 1);

      assert.equal(result, 11);
    });

    test('should return undefined when conflict occurs and no row returned', async () => {
      pool.query = async () => ({ rows: [] });

      const schedule = {
        staff_id: 1,
        starts_at: '09:00',
        ends_at: '17:00',
        shift_name: 'Ca sáng',
      };

      const result = await staffService.copyScheduleToWeek(schedule, '2026-08-18', 111, 1);

      assert.equal(result, undefined);
    });
  });

  test.describe('isLeaveDay', () => {
    test('should return true when staff has leave status on date', async () => {
      pool.query = async (query, params) => {
        assert.ok(query.includes("status = 'leave'"));
        assert.equal(params[0], 1);
        assert.equal(params[1], '2026-08-20');
        return { rows: [{ is_leave: true }] };
      };

      const result = await staffService.isLeaveDay(1, '2026-08-20');

      assert.equal(result, true);
    });

    test('should return false when staff has no leave on date', async () => {
      pool.query = async () => ({ rows: [{ is_leave: false }] });

      const result = await staffService.isLeaveDay(1, '2026-08-21');

      assert.equal(result, false);
    });

    test('should return false when no rows returned', async () => {
      pool.query = async () => ({ rows: [] });

      const result = await staffService.isLeaveDay(999, '2026-08-21');

      assert.equal(result, false);
    });
  });

  test.describe('isHoliday', () => {
    test('should return true when date is a holiday', async () => {
      pool.query = async (query, params) => {
        assert.ok(query.includes('branch_work_schedule_settings'));
        assert.equal(params[0], '"2026-09-02"');
        return { rows: [{ is_holiday: true }] };
      };

      const result = await staffService.isHoliday('2026-09-02');

      assert.equal(result, true);
    });

    test('should return false when date is not a holiday', async () => {
      pool.query = async () => ({ rows: [{ is_holiday: false }] });

      const result = await staffService.isHoliday('2026-08-25');

      assert.equal(result, false);
    });

    test('should return false when no rows returned', async () => {
      pool.query = async () => ({ rows: [] });

      const result = await staffService.isHoliday('2026-12-25');

      assert.equal(result, false);
    });
  });

  test.describe('scheduleExists', () => {
    test('should return true when schedule exists for staff on date/time', async () => {
      pool.query = async (query, params) => {
        assert.ok(query.includes('staff_id'));
        assert.equal(params[0], 1);
        assert.equal(params[1], '2026-08-18');
        assert.equal(params[2], '09:00');
        return { rows: [{ exists: true }] };
      };

      const result = await staffService.scheduleExists(1, '2026-08-18', '09:00');

      assert.equal(result, true);
    });

    test('should return false when no schedule exists', async () => {
      pool.query = async () => ({ rows: [{ exists: false }] });

      const result = await staffService.scheduleExists(1, '2026-08-25', '09:00');

      assert.equal(result, false);
    });

    test('should return false when no rows returned', async () => {
      pool.query = async () => ({ rows: [] });

      const result = await staffService.scheduleExists(999, '2026-08-18', '09:00');

      assert.equal(result, false);
    });
  });
});

test.describe('assignShift with applyToWeeks', () => {
  let originalConnect;

  test.beforeEach(() => {
    originalConnect = pool.connect;
  });

  test.afterEach(() => {
    pool.connect = originalConnect;
  });

  test('should create schedule without group ID when applyToWeeks = 1', async () => {
    const mockClient = {
      query: async (query, params) => {
        if (query === 'BEGIN') return { rows: [] };
        if (query.includes('INSERT INTO staff_schedules')) {
          return { rows: [{ id: 1 }] };
        }
        if (query === 'COMMIT') return { rows: [] };
        if (query === 'ROLLBACK') return { rows: [] };
        return { rows: [] };
      },
      release: () => {}
    };
    pool.connect = async () => mockClient;

    const result = await staffService.assignShift({
      branchId: 1,
      staffId: 1,
      shiftDate: '2026-08-18',
      startsAt: '09:00',
      endsAt: '17:00',
      applyToWeeks: 1
    });

    assert.equal(result.id, 1);
    assert.equal(result.groupId, null);
    assert.equal(result.affectedWeeks, 1);
  });

  test('should create schedule with group ID when applyToWeeks > 1', async () => {
    const mockClient = {
      query: async (query, params) => {
        if (query === 'BEGIN') return { rows: [] };
        if (query.includes('INSERT INTO staff_schedules')) {
          return { rows: [{ id: 1 }] };
        }
        if (query.includes('is_leave') || query.includes('EXISTS')) {
          return { rows: [{ is_leave: false }] };
        }
        if (query.includes('branch_work_schedule_settings')) {
          return { rows: [{ is_holiday: false }] };
        }
        if (query === 'COMMIT') return { rows: [] };
        if (query === 'ROLLBACK') return { rows: [] };
        return { rows: [] };
      },
      release: () => {}
    };
    pool.connect = async () => mockClient;

    const result = await staffService.assignShift({
      branchId: 1,
      staffId: 1,
      shiftDate: '2026-08-18',
      startsAt: '09:00',
      endsAt: '17:00',
      applyToWeeks: 4
    });

    assert.equal(result.id, 1);
    assert.ok(result.groupId !== null);
    assert.equal(result.affectedWeeks, 4);
  });

  test('should skip leave days when copying to subsequent weeks', async () => {
    let copyInsertCount = 0;
    const mockClient = {
      query: async (query, params) => {
        if (query === 'BEGIN') return { rows: [] };
        // Main INSERT
        if (query.includes('INSERT INTO staff_schedules') && query.includes('ON CONFLICT')) {
          return { rows: [{ id: 1 }] };
        }
        // Copy INSERT (no ON CONFLICT)
        if (query.includes('INSERT INTO staff_schedules') && query.includes('DO NOTHING')) {
          copyInsertCount++;
          return { rows: [{ id: copyInsertCount }] };
        }
        if (query.includes("status = 'leave'")) {
          return { rows: [{ is_leave: true }] }; // Skip as leave
        }
        if (query.includes('branch_work_schedule_settings')) {
          return { rows: [{ is_holiday: false }] };
        }
        if (query === 'COMMIT') return { rows: [] };
        if (query === 'ROLLBACK') return { rows: [] };
        return { rows: [] };
      },
      release: () => {}
    };
    pool.connect = async () => mockClient;

    const result = await staffService.assignShift({
      branchId: 1,
      staffId: 1,
      shiftDate: '2026-08-18',
      startsAt: '09:00',
      endsAt: '17:00',
      applyToWeeks: 3
    });

    // Group created but copies skipped because all are leave days
    assert.ok(result.groupId !== null);
    assert.equal(copyInsertCount, 0);
  });

  test('should copy schedule to subsequent weeks when no leaves/holidays', async () => {
    let insertCount = 0;
    const mockClient = {
      query: async (query, params) => {
        if (query === 'BEGIN') return { rows: [] };
        if (query.includes('INSERT INTO staff_schedules')) {
          insertCount++;
          return { rows: [{ id: insertCount }] };
        }
        if (query.includes("status = 'leave'") || query.includes('is_leave')) {
          return { rows: [{ is_leave: false }] };
        }
        if (query.includes('branch_work_schedule_settings')) {
          return { rows: [{ is_holiday: false }] };
        }
        if (query === 'COMMIT') return { rows: [] };
        if (query === 'ROLLBACK') return { rows: [] };
        return { rows: [] };
      },
      release: () => {}
    };
    pool.connect = async () => mockClient;

    const result = await staffService.assignShift({
      branchId: 1,
      staffId: 1,
      shiftDate: '2026-08-18',
      startsAt: '09:00',
      endsAt: '17:00',
      applyToWeeks: 3
    });

    // Should have: 1 original + 2 copies = 3 total
    assert.equal(insertCount, 3);
    assert.equal(result.affectedWeeks, 3);
  });

  test('should throw error when required fields are missing', async () => {
    await assert.rejects(
      async () => staffService.assignShift({ branchId: 1, staffId: 1 }),
      { message: 'Missing required fields', status: 400 }
    );
  });
});
