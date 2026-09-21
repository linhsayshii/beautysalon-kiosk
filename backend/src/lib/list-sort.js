export function listSort(sort, options, fallback) {
  return Object.hasOwn(options, sort) ? options[sort] : fallback;
}
