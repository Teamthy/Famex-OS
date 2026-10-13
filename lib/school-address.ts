/**
 * The school's postal address, as it may be printed or published.
 *
 * The address is stored once, on the School row, and the admin sets it under
 * School profile. An empty value means the school has not confirmed an address yet.
 * Receipts, report cards, ID cards and public pages then leave it out, rather than
 * printing an address nobody has checked.
 */
export function confirmedSchoolAddress(value: string | null | undefined): string | null {
  const address = (value ?? "").replace(/\s+/g, " ").trim();
  return address.length > 0 ? address : null;
}
