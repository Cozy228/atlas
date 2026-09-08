export function formatSourceText(text: string, applicationCode: string): string {
  const clean = text.replace(/\\+(["'])/g, "$1");
  return applicationCode.trim()
    ? clean.replace(/<app[ _-]?code>|\{app[ _-]?code\}/gi, () => applicationCode.trim())
    : clean;
}
