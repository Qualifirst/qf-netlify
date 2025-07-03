export function normalizeString(s: string): string {
  // 'NFD' decomposes characters (e.g., 'é' becomes 'e' + '´').
  // The regex then removes the accent marks.
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Compares if two strings are equal, ignoring case and accents.
 * @param s1 The first string.
 * @param s2 The second string.
 * @returns True if the strings are equivalent, false otherwise.
 */
export function compareStrings(s1: string, s2: string): boolean {
  // `localeCompare` is the standard way to compare strings with case-insensitivity.
  // We compare the normalized versions of the strings.
  return (
    normalizeString(s1).localeCompare(normalizeString(s2), undefined, {
      sensitivity: "accent",
    }) === 0
  );
}

/**
 * Checks if a string exists in a array, ignoring case and accents.
 * @param s The string to search for.
 * @param l The array of strings to search within.
 * @returns True if the string is found, false otherwise.
 */
export function stringInArray(s: string, l: string[]): boolean {
  const normalizedS = normalizeString(s);

  // The .some() method is a clean way to check for existence in an array.
  // It stops and returns true as soon as a match is found.
  return l.some((arrayItem) =>
    compareStrings(normalizedS, arrayItem)
  );
}

/**
 * Pauses execution for a specified number of milliseconds.
 * @param ms The number of milliseconds to wait.
 * @returns A Promise that resolves after the timeout.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
