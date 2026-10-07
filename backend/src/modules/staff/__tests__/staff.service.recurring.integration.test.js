/**
 * Integration tests for recurring schedule feature
 * Run with: cd backend && node --test src/modules/staff/__tests__/staff.service.recurring.integration.test.js
 *
 * NOTE: These tests require a running database with seed data.
 * Enable with RUN_DB_INTEGRATION=1 when the Docker database is available.
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../../db.js';
import * as staffService from '../staff.service.js';

const integrationEnabled = process.env.RUN_DB_INTEGRATION === '1';

describe('Recurring Schedule Integration', { skip: !integrationEnabled }, () => {
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

    it('should delete only the source week without deleting its copies', async () => {
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

      const result = await staffService.deleteSchedule(testBranchId, sourceSchedule.id, false);
      assert.equal(result.deleted, true, 'source occurrence should be deleted');

      // The caller explicitly chose the current occurrence, so copies remain.
      const remaining = await pool.query(`
        SELECT COUNT(*) as count
        FROM staff_schedules
        WHERE staff_id = $1 AND branch_id = $2
      `, [testStaffId, testBranchId]);
      assert.equal(Number(remaining.rows[0].count), 1, 'one copied schedule should remain');
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
