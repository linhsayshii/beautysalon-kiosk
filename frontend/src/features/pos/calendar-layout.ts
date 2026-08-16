export interface CalendarRange<T> {
  item: T;
  start: number;
  end: number;
}

export interface CalendarPlacement<T> extends CalendarRange<T> {
  column: number;
  columnCount: number;
}

export function layoutOverlappingAppointments<T>(ranges: CalendarRange<T>[]): CalendarPlacement<T>[] {
  const sorted = [...ranges]
    .map((range) => ({ ...range, end: Math.max(range.start + 1, range.end) }))
    .sort((first, second) => first.start - second.start || first.end - second.end);
  const result: CalendarPlacement<T>[] = [];
  let cluster: CalendarRange<T>[] = [];
  let clusterEnd = Number.NEGATIVE_INFINITY;

  const flush = () => {
    if (!cluster.length) return;
    const columnEnds: number[] = [];
    const placements = cluster.map((range) => {
      let column = columnEnds.findIndex((end) => end <= range.start);
      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(range.end);
      } else {
        columnEnds[column] = range.end;
      }
      return { ...range, column };
    });
    const columnCount = Math.max(1, columnEnds.length);
    result.push(...placements.map((placement) => ({ ...placement, columnCount })));
    cluster = [];
    clusterEnd = Number.NEGATIVE_INFINITY;
  };

  sorted.forEach((range) => {
    if (cluster.length && range.start >= clusterEnd) flush();
    cluster.push(range);
    clusterEnd = Math.max(clusterEnd, range.end);
  });
  flush();
  return result;
}
