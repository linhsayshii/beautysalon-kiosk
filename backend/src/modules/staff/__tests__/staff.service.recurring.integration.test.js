/**
 * Integration tests for recurring schedule feature
 * Run with: cd backend && node --test src/modules/staff/__tests__/staff.service.recurring.integration.test.js
 *
 * NOTE: These tests require a running database with seed data.
 * Currently SKIPPED - need Docker database to run
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../../db.js';
import * as staffService from '../staff.service.js';

// Skip all tests in this file - require real database
describe.skip('Recurring Schedule Integration', () => {
  let testStaffId;
  let testBranchId;
  const TEST_PREFIX = 'RECURRING_TEST_';

  before(async () => {
    // Ensure we have a branch to work with
    const branchResult = await pool.query(`
      INSERT INTO branches (code, name, active)
      VALUES ($1, $2, true)
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [`${TEST_PREFIX}BRANCH`, 'Test Branch for Recurring']);
    testBranchId = branchResult.rows[0].id;

    // Create test staff
    const staffResult = await pool.query(`
      INSERT INTO staff (branch_id, code, name, role, avatar_tone, active)
      VALUES ($1, $2, $3, 'staff', 'blue', true)
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [testBranchId, `${TEST_PREFIX}STAFF`, 'Test Staff Recurring']);
    testStaffId = staffResult.rows[0].id;

    // Insert staff settings
    await pool.query(`
      INSERT INTO staff_settings (staff_id, salary_type, base_salary, hourly_rate)
      VALUES ($1, 'monthly', 10000000, 50000)
      ON CONFLICT (staff_id) DO NOTHING
    `, [testStaffId]);
  });

  after(async () => {
    // Cleanup test data in reverse dependency order
    await pool.query(`
      DELETE FROM staff_schedules
      WHERE staff_id = $1
        AND branch_id = $2
    `, [testStaffId, testBranchId]);

    await pool.query(`DELETE FROM staff WHERE id = $1`, [testStaffId]);
    await pool.query(`DELETE FROM branches WHERE id = $1`, [testBranchId]);
  });

  // Clean schedules before each test
  beforeEach(async () => {
    await pool.query(`
      DELETE FROM staff_schedules
      WHERE staff_id = $1 AND branch_id = $2
    `, [testStaffId, testBranchId]);
  });

  describe('assignShift with applyToWeeks', () => {
    it('should copy schedule to multiple weeks', async () => {
      // Assign shift for week 1 with applyToWeeks = 4
      const result = await staffService.assignShift({
        branchId: testBranchId,
        staffId: testStaffId,
        shiftDate: '2026-08-17', // Week 34, Monday
        startsAt: '09:00',
        endsAt: '17:00',
        shiftName: 'Ca sáng',
        applyToWeeks: 4
      });

      assert.ok(result.groupId != null, 'groupId should be defined');
      assert.equal(result.affectedWeeks, 4, 'affectedWeeks should be 4');

      // Verify schedules were created
      const schedules = await pool.query(`
        SELECT id, shift_date, week_group_id, is_source
        FROM staff_schedules
        WHERE staff_id = $1 AND branch_id = $2
        ORDER BY shift_date
      `, [testStaffId, testBranchId]);

      assert.ok(schedules.rows.length >= 4, 'should have at least 4 schedules');

      // All should have the same group ID
      const groupIds = new Set(schedules.rows.map(s => s.week_group_id));
      assert.equal(groupIds.size, 1, 'all schedules should have same group ID');

      // Exactly one should be marked as source (the first week)
      const sourceCount = schedules.rows.filter(s => s.is_source).length;
      assert.equal(sourceCount, 1, 'should have exactly one source schedule');
    });

    it('should handle single week assignment (applyToWeeks=1)', async () => {
      const result = await staffService.assignShift({
        branchId: testBranchId,
        staffId: testStaffId,
        shiftDate: '2026-08-17',
        startsAt: '09:00',
        endsAt: '17:00',
        shiftName: 'Ca sáng',
        applyToWeeks: 1
      });

      assert.equal(result.groupId, null, 'groupId should be null for single week');
      assert.equal(result.affectedWeeks, 1, 'affectedWeeks should be 1');

      const schedules = await pool.query(`
        SELECT id, week_group_id, is_source
        FROM staff_schedules
        WHERE staff_id = $1 AND branch_id = $2
      `, [testStaffId, testBranchId]);

      assert.equal(schedules.rows.length, 1, 'should have 1 schedule');
      assert.equal(schedules.rows[0].week_group_id, null, 'week_group_id should be null');
    });
  });

  describe('updateSchedule propagation', () => {
    it('should propagate changes to future weeks when propagate=true', async () => {
      // Create recurring schedule: 2 weeks
      const assignResult = await staffService.assignShift({
        branchId: testBranchId,
        staffId: testStaffId,
        shiftDate: '2026-08-17',
        startsAt: '09:00',
        endsAt: '17:00',
        shiftName: 'Ca sáng',
        applyToWeeks: 2
      });

      assert.ok(assignResult.groupId != null, 'groupId should be defined');

      // Get the first schedule (source week)
      const schedules = await staffService.getSchedulesByWeek(testStaffId, '2026-08-17');
      const firstSchedule = schedules[0];

      assert.ok(firstSchedule != null, 'firstSchedule should be defined');
      assert.equal(Number(firstSchedule.week_group_id), Number(assignResult.groupId), 'should have same group ID');

      // Update with propagate=true
      const updateResult = await staffService.updateSchedule(
        testBranchId,
        firstSchedule.id,
        { startsAt: '10:00', endsAt: '18:00', shiftName: 'Ca mới' },
        true
      );

      assert.ok(updateResult.updatedCount > 1, 'should update more than 1 schedule');

      // Verify all schedules in group were updated
      const updatedSchedules = await pool.query(`
        SELECT starts_at, ends_at, shift_name
        FROM staff_schedules
        WHERE staff_id = $1 AND branch_id = $2 AND week_group_id = $3
        ORDER BY shift_date
      `, [testStaffId, testBranchId, assignResult.groupId]);

      // All should have the new times
      for (const schedule of updatedSchedules.rows) {
        const startsAtStr = String(schedule.starts_at).slice(0, 5);
        const endsAtStr = String(schedule.ends_at).slice(0, 5);
        assert.equal(startsAtStr, '10:00', 'starts_at should be 10:00');
        assert.equal(endsAtStr, '18:00', 'ends_at should be 18:00');
        assert.equal(schedule.shift_name, 'Ca mới', 'shift_name should be Ca mới');
      }
    });

    it('should break chain when propagate=false', async () => {
      // Create recurring schedule: 3 weeks
      const assignResult = await staffService.assignShift({
        branchId: testBranchId,
        staffId: testStaffId,
        shiftDate: '2026-08-17',
        startsAt: '09:00',
        endsAt: '17:00',
        shiftName: 'Ca sáng',
        applyToWeeks: 3
      });

      assert.ok(assignResult.groupId != null, 'groupId should be defined');
      const originalGroupId = assignResult.groupId;

      // Get second week's schedule
      const week2Schedules = await staffService.getSchedulesByWeek(testStaffId, '2026-08-24');
      assert.ok(week2Schedules.length > 0, 'week2 should have schedules');
      const week2Schedule = week2Schedules[0];

      // Update with propagate=false (break chain)
      const updateResult = await staffService.updateSchedule(
        testBranchId,
        week2Schedule.id,
        { startsAt: '08:00', endsAt: '16:00', shiftName: 'Ca riêng' },
        false
      );

      assert.ok(updateResult.newGroupId != null, 'newGroupId should be defined');
      assert.notEqual(Number(updateResult.newGroupId), Number(originalGroupId), 'newGroupId should differ from original');
      assert.equal(updateResult.updatedCount, 1, 'should update only 1 schedule');

      // Verify the updated schedule has new group ID
      const updatedSchedule = await pool.query(`
        SELECT week_group_id, starts_at, ends_at, shift_name, is_source
        FROM staff_schedules
        WHERE id = $1
      `, [week2Schedule.id]);

      assert.equal(Number(updatedSchedule.rows[0].week_group_id), Number(updateResult.newGroupId), 'should have new group ID');
      assert.equal(String(updatedSchedule.rows[0].starts_at).slice(0, 5), '08:00', 'starts_at should be 08:00');
      assert.equal(updatedSchedule.rows[0].is_source, true, 'broken chain schedule should be source');
    });

    it('should update only current schedule when no group', async () => {
      // Create a single schedule without group
      await staffService.assignShift({
        branchId: testBranchId,
        staffId: testStaffId,
        shiftDate: '2026-08-17',
        startsAt: '09:00',
        endsAt: '17:00',
        shiftName: 'Ca sáng',
        applyToWeeks: 1
      });

      const schedules = await staffService.getSchedulesByWeek(testStaffId, '2026-08-17');
      const schedule = schedules[0];

      // Update with propagate=true but no group - should still work (break chain behavior)
      const updateResult = await staffService.updateSchedule(
        testBranchId,
        schedule.id,
        { startsAt: '10:00', endsAt: '18:00', shiftName: 'Ca mới' },
        true
      );

      // Should return newGroupId since there's no existing group to propagate to
      assert.ok(updateResult.newGroupId != null, 'newGroupId should be defined');
      assert.equal(updateResult.updatedCount, 1, 'should update only 1 schedule');
    });
  });

  describe('deleteSchedule', () => {
    it('should delete future schedules when deleteFuture=true', async () => {
      // Create recurring schedule: 4 weeks
      const assignResult = await staffService.assignShift({
        branchId: testBranchId,
        staffId: testStaffId,
        shiftDate: '2026-08-17',
        startsAt: '09:00',
        endsAt: '17:00',
        shiftName: 'Ca sáng',
        applyToWeeks: 4
      });

      assert.ok(assignResult.groupId != null, 'groupId should be defined');

      // Verify schedules were created
      const beforeDelete = await pool.query(`
        SELECT COUNT(*) as count
        FROM staff_schedules
        WHERE staff_id = $1 AND branch_id = $2
      `, [testStaffId, testBranchId]);
      assert.ok(Number(beforeDelete.rows[0].count) >= 4, 'should have at least 4 schedules');

      // Get first schedule (source week)
      const schedules = await staffService.getSchedulesByWeek(testStaffId, '2026-08-17');
      const firstSchedule = schedules[0];

      // Delete with deleteFuture=true
      const deleteResult = await staffService.deleteSchedule(
        testBranchId,
        firstSchedule.id,
        true
      );

      assert.equal(deleteResult.deleted, true, 'deleted should be true');

      // Verify all schedules in the group are deleted
      const remaining = await pool.query(`
        SELECT COUNT(*) as count
        FROM staff_schedules
        WHERE staff_id = $1 AND branch_id = $2
      `, [testStaffId, testBranchId]);
      assert.equal(Number(remaining.rows[0].count), 0, 'all schedules should be deleted');
    });

    it('should delete only current schedule when deleteFuture=false', async () => {
      // Create recurring schedule: 3 weeks
      const assignResult = await staffService.assignShift({
        branchId: testBranchId,
        staffId: testStaffId,
        shiftDate: '2026-08-17',
        startsAt: '09:00',
        endsAt: '17:00',
        shiftName: 'Ca sáng',
        applyToWeeks: 3
      });

      assert.ok(assignResult.groupId != null, 'groupId should be defined');

      // Get second week's schedule (not the source)
      const week2Schedules = await staffService.getSchedulesByWeek(testStaffId, '2026-08-24');
      const week2Schedule = week2Schedules[0];

      // Delete only this schedule
      const deleteResult = await staffService.deleteSchedule(
        testBranchId,
        week2Schedule.id,
        false
      );

      assert.equal(deleteResult.deleted, true, 'deleted should be true');

      // Verify only this schedule was deleted, others remain
      const remaining = await pool.query(`
        SELECT COUNT(*) as count
        FROM staff_schedules
        WHERE staff_id = $1 AND branch_id = $2
      `, [testStaffId, testBranchId]);
      assert.equal(Number(remaining.rows[0].count), 2, '2 schedules should remain');
    });

    it('should throw error when deleting source week that has copies', async () => {
      // Create recurring schedule: 2 weeks
      const assignResult = await staffService.assignShift({
        branchId: testBranchId,
        staffId: testStaffId,
        shiftDate: '2026-08-17',
        startsAt: '09:00',
        endsAt: '17:00',
        shiftName: 'Ca sáng',
        applyToWeeks: 2
      });

      assert.ok(assignResult.groupId != null, 'groupId should be defined');

      // Get first schedule (source week)
      const schedules = await staffService.getSchedulesByWeek(testStaffId, '2026-08-17');
      const sourceSchedule = schedules.find(s => s.is_source);

      assert.ok(sourceSchedule != null, 'sourceSchedule should be defined');

      // Try to delete source week without deleteFuture=true - should fail
      await assert.rejects(
        async () => staffService.deleteSchedule(testBranchId, sourceSchedule.id, false),
        (err) => {
          assert.equal(err.status, 400, 'status should be 400');
          assert.equal(err.code, 'SOURCE_WEEK_HAS_COPIES', 'code should be SOURCE_WEEK_HAS_COPIES');
          return true;
        }
      );

      // Verify no schedules were deleted
      const remaining = await pool.query(`
        SELECT COUNT(*) as count
        FROM staff_schedules
        WHERE staff_id = $1 AND branch_id = $2
      `, [testStaffId, testBranchId]);
      assert.equal(Number(remaining.rows[0].count), 2, '2 schedules should remain');
    });

    it('should allow deleting source week with deleteFuture=true (cascade)', async () => {
      // Create recurring schedule: 3 weeks
      const assignResult = await staffService.assignShift({
        branchId: testBranchId,
        staffId: testStaffId,
        shiftDate: '2026-08-17',
        startsAt: '09:00',
        endsAt: '17:00',
        shiftName: 'Ca sáng',
        applyToWeeks: 3
      });

      assert.ok(assignResult.groupId != null, 'groupId should be defined');

      // Get source schedule
      const schedules = await staffService.getSchedulesByWeek(testStaffId, '2026-08-17');
      const sourceSchedule = schedules.find(s => s.is_source);

      // Delete with deleteFuture=true - should allow cascade delete
      const deleteResult = await staffService.deleteSchedule(
        testBranchId,
        sourceSchedule.id,
        true
      );

      assert.equal(deleteResult.deleted, true, 'deleted should be true');

      // Verify all schedules deleted
      const remaining = await pool.query(`
        SELECT COUNT(*) as count
        FROM staff_schedules
        WHERE staff_id = $1 AND branch_id = $2
      `, [testStaffId, testBranchId]);
      assert.equal(Number(remaining.rows[0].count), 0, 'all schedules should be deleted');
    });

    it('should throw 404 for non-existent schedule', async () => {
      await assert.rejects(
        async () => staffService.deleteSchedule(testBranchId, 999999, false),
        (err) => {
          assert.equal(err.status, 404, 'status should be 404');
          return true;
        }
      );
    });

    it('should throw 404 for schedule in different branch', async () => {
      // Create schedule in test branch
      const assignResult = await staffService.assignShift({
        branchId: testBranchId,
        staffId: testStaffId,
        shiftDate: '2026-08-17',
        startsAt: '09:00',
        endsAt: '17:00',
        shiftName: 'Ca sáng',
        applyToWeeks: 1
      });

      // Try to delete with different branch ID
      const differentBranchId = testBranchId + 999;
      await assert.rejects(
        async () => staffService.deleteSchedule(differentBranchId, assignResult.id, false),
        (err) => {
          assert.equal(err.status, 404, 'status should be 404');
          return true;
        }
      );
    });
  });

  describe('getSchedulesByWeek helper', () => {
    it('should return schedules within a week range', async () => {
      // Create schedules across multiple days
      await staffService.assignShift({
        branchId: testBranchId,
        staffId: testStaffId,
        shiftDate: '2026-08-17',
        startsAt: '09:00',
        endsAt: '17:00',
        shiftName: 'Ca sáng',
        applyToWeeks: 1
      });

      await staffService.assignShift({
        branchId: testBranchId,
        staffId: testStaffId,
        shiftDate: '2026-08-18',
        startsAt: '09:00',
        endsAt: '17:00',
        shiftName: 'Ca sáng',
        applyToWeeks: 1
      });

      await staffService.assignShift({
        branchId: testBranchId,
        staffId: testStaffId,
        shiftDate: '2026-08-19',
        startsAt: '09:00',
        endsAt: '17:00',
        shiftName: 'Ca sáng',
        applyToWeeks: 1
      });

      // Week starting Monday 2026-08-17 should have 3 schedules
      const schedules = await staffService.getSchedulesByWeek(testStaffId, '2026-08-17');
      assert.equal(schedules.length, 3, 'should have 3 schedules in week 1');

      // Week starting Monday 2026-08-24 should have 0 schedules
      const emptyWeek = await staffService.getSchedulesByWeek(testStaffId, '2026-08-24');
      assert.equal(emptyWeek.length, 0, 'should have 0 schedules in week 2');
    });
  });
});
