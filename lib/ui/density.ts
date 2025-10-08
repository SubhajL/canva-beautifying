export function isCompact(): boolean {
  return typeof document !== 'undefined' && document.body?.dataset?.density === 'compact'
}

export function densityClass(compact: string, comfortable: string): string {
  return isCompact() ? compact : comfortable
}

