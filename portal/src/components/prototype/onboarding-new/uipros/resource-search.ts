// Adapted from UIPros motion-ui/motion-ui/command-palette/index.tsx.
export function fuzzyMatch(query: string, target: string): boolean {
  if (!query) return true;
  let queryIndex = 0;
  for (let index = 0; index < target.length && queryIndex < query.length; index++) {
    if (target[index] === query[queryIndex]) queryIndex++;
  }
  return queryIndex === query.length;
}
export function resourceMatches(
  resource: { name: string; value: string; group: string; searchText?: string },
  query: string,
): boolean {
  const normalized = query.trim().toLowerCase();
  return [resource.name, resource.value, resource.group, resource.searchText ?? ""].some((value) =>
    fuzzyMatch(normalized, value.toLowerCase()),
  );
}
