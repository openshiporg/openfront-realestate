/** "1 deal", "2 deals"; pass the plural when it isn't just an added "s". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`
}
