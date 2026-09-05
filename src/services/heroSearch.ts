function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function editDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row]
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      )
    }
    previous = current
  }
  return previous[right.length]
}

export function matchesHero(name: string, query: string): boolean {
  const needle = normalize(query)
  const haystack = normalize(name)
  if (haystack.includes(needle)) return true
  if (needle.length < 3) return false

  const tolerance = needle.length >= 6 ? 2 : 1
  return [haystack, ...name.split(/\s+/).map(normalize)].some(
    (candidate) => editDistance(candidate, needle) <= tolerance,
  )
}
