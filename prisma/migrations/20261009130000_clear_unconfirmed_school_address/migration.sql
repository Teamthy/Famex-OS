-- These school addresses were placeholders or guesses that the school never confirmed.
-- Clearing them stops receipts, report cards, ID cards and public pages from printing
-- them. The school enters its real address under Admin > School profile.
UPDATE "School"
SET "address" = ''
WHERE "address" IN (
  'Km 38, Lagos-Abeokuta Expressway, Sango Ota, Ogun State, Nigeria',
  'Km 38, Lagos-Abeokuta Expressway, Sango Ota, Ogun State',
  'Alishiba Junction, Nigeria'
);
