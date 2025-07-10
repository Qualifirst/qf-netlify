import { Country, State } from 'country-state-city';

/**
 * Takes a country and state/province name and returns their two-letter codes
 * using the country-state-city library.
 *
 * @param countryName The full name of the country (e.g., "Canada").
 * @param stateName The full name of the state or province (e.g., "British Columbia").
 * @returns An object with countryCode and stateCode, or null if not found.
 */
export function countryAndStateCodes(countryName: string, stateName: string): { countryCode: string; stateCode: string } | null {
  // 1. Find the country by its name (case-insensitive search is needed).
  const country = Country.getAllCountries().find(
    c => c.name.toLowerCase() === countryName.toLowerCase()
  );

  if (!country) {
    return null; // Country not found
  }

  // 2. Find the state within that country (also case-insensitive).
  const state = State.getStatesOfCountry(country.isoCode).find(
    s => s.name.toLowerCase() === stateName.toLowerCase()
  );

  if (!state) {
    return null; // State not found for that country
  }

  // 3. Return the ISO codes.
  return {
    countryCode: country.isoCode, // e.g., "CA"
    stateCode: state.isoCode,     // e.g., "BC"
  };
}
