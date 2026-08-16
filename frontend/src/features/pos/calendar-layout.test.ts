import { describe, expect, it } from 'vitest';
import { layoutOverlappingAppointments } from './calendar-layout';

describe('layoutOverlappingAppointments', () => {
  it('places simultaneous appointments in separate columns', () => {
    const layout = layoutOverlappingAppointments([
      { item: 'a', start: 600, end: 660 },
      { item: 'b', start: 615, end: 645 },
      { item: 'c', start: 630, end: 690 },
    ]);

    expect(layout.map(({ column, columnCount }) => [column, columnCount])).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
    ]);
  });

  it('reuses a column when appointments do not overlap', () => {
    const layout = layoutOverlappingAppointments([
      { item: 'a', start: 600, end: 630 },
      { item: 'b', start: 630, end: 660 },
    ]);

    expect(layout.map(({ column, columnCount }) => [column, columnCount])).toEqual([
      [0, 1],
      [0, 1],
    ]);
  });
});
