import type { CountryCode } from 'libphonenumber-js';

export async function normalizePhoneNumber(
  value: string,
  required = true,
  country: CountryCode = 'CM',
): Promise<string> {
  const input = value.trim();
  if (!input && !required) return '';
  const { parsePhoneNumberFromString } = await import('libphonenumber-js/min');
  const phone = parsePhoneNumberFromString(input, country);
  if (!phone?.isValid())
    throw new Error(
      'Enter a valid phone number. Cameroon numbers may be entered locally or with +237.',
    );
  return phone.number;
}
