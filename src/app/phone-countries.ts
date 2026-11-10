import type { CountryCode } from 'libphonenumber-js';

export interface PhoneCountryOption {
  code: CountryCode;
  name: string;
  callingCode: string;
  flag: string;
}

export async function createPhoneCountryOptions(): Promise<PhoneCountryOption[]> {
  const { getCountries, getCountryCallingCode } = await import('libphonenumber-js/min');
  const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
  return getCountries()
    .map((code) => ({
      code,
      name: displayNames.of(code) ?? code,
      callingCode: `+${getCountryCallingCode(code)}`,
      flag: String.fromCodePoint(...[...code].map((letter) => letter.charCodeAt(0) + 127397)),
    }))
    .sort((a, b) =>
      a.code === 'CM' ? -1 : b.code === 'CM' ? 1 : a.name.localeCompare(b.name),
    );
}
