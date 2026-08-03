export const NAVIGATION_START_MARK = "atlas:navigation-start";

export function markNavigationStart(): void {
  if (performance.getEntriesByName(NAVIGATION_START_MARK).length > 0) return;
  performance.mark(NAVIGATION_START_MARK, { startTime: 0 });
}

export function markReady(name: string): void {
  if (performance.getEntriesByName(name).length > 0) return;
  performance.mark(name);
  if (performance.getEntriesByName(NAVIGATION_START_MARK).length > 0) {
    performance.measure(`${name}-duration`, NAVIGATION_START_MARK, name);
  }
}
