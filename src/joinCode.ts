// Join-code format (frontend-only; never sent to the API as a single field).
//
// A "join code" is a single opaque token a housemate copies to join. It BUNDLES
// the house id and the member code so the house id is never shown or typed as a
// separate value — the member perceives one code. Both parts are 2 groups of 4
// chars (e.g. "XW08-BCBN"), so a combined code is 4 groups / 16 alphanumerics:
//
//     XW08-BCBN-EZSY-KFRN
//     └ house id┘ └ member ┘
//
// The invite link still carries house & code as separate query params; this
// combined code is the "no link" fallback the admin shares and the member types.

/** Build the combined join code the admin shares (house id + member code). */
export function buildJoinCode(houseId: string, memberCode: string): string {
  return `${houseId}-${memberCode}`;
}

/**
 * Parse a typed/pasted combined join code back into its parts. Lenient about
 * spacing, dashes and case (the Worker stores codes upper-cased and grouped in
 * 4s), but strict about length: exactly 16 alphanumerics, else null.
 */
export function parseJoinCode(input: string): { house: string; code: string } | null {
  const clean = input.replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (clean.length !== 16) return null; // 8 (house id) + 8 (member code)
  const grouped = clean.replace(/(.{4})(?=.)/g, '$1-'); // XXXX-XXXX-XXXX-XXXX
  const [g1, g2, g3, g4] = grouped.split('-');
  return { house: `${g1}-${g2}`, code: `${g3}-${g4}` };
}
