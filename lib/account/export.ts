import type { User } from '@supabase/supabase-js'

/**
 * The shape of "download your data" (GDPR Art. 15 access, Art. 20
 * portability), built as a pure function so the unit tests can pin exactly
 * what leaves the server. `lib/db/account-export.ts` does the reading.
 *
 * What is in it is everything the database holds about the account that the
 * reader can be given: the auth record's own fields, each linked sign-in
 * method with the profile data that provider supplied, every saved material
 * and every note. What is deliberately NOT in it, and why, is stated in the
 * file itself under `notIncluded`, so the reader does not have to guess.
 */

export type SavedRow = { material_id: string; created_at: string }
export type NoteRow = {
  material_id: string
  body: string
  created_at: string
  updated_at: string
}
/** What the export says about a material: enough to recognise it. */
export type MaterialLabel = { id: string; slug: string; canonicalName: string }

export const EXPORT_FORMAT_VERSION = 1

export function shapeAccountExport(
  user: Pick<
    User,
    | 'id'
    | 'email'
    | 'new_email'
    | 'created_at'
    | 'last_sign_in_at'
    | 'email_confirmed_at'
    | 'identities'
    | 'app_metadata'
  >,
  saved: readonly SavedRow[],
  notes: readonly NoteRow[],
  materials: readonly MaterialLabel[],
  exportedAt: Date
) {
  const byId = new Map(materials.map((material) => [material.id, material]))
  // A material that is no longer published keeps its id in the export (the
  // row is still the reader's) but not a name the site no longer stands
  // behind.
  const label = (id: string) => {
    const material = byId.get(id)
    return {
      materialId: id,
      slug: material?.slug ?? null,
      name: material?.canonicalName ?? null,
    }
  }

  return {
    format: 'perfumers-codex-account-export',
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: exportedAt.toISOString(),
    account: {
      id: user.id,
      email: user.email ?? null,
      pendingEmailChange: user.new_email ?? null,
      createdAt: user.created_at,
      emailConfirmedAt: user.email_confirmed_at ?? null,
      lastSignInAt: user.last_sign_in_at ?? null,
      signInMethods: (user.identities ?? []).map((identity) => ({
        provider: identity.provider,
        linkedAt: identity.created_at ?? null,
        lastSignInAt: identity.last_sign_in_at ?? null,
        // What the provider told Supabase about you (for Google: name, email,
        // picture URL, Google account id). Included because it is held.
        profile: identity.identity_data ?? {},
      })),
    },
    savedMaterials: saved.map((row) => ({
      ...label(row.material_id),
      savedAt: row.created_at,
    })),
    notes: notes.map((row) => ({
      ...label(row.material_id),
      body: row.body,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    notIncluded: [
      'Your password: Supabase Auth stores only a one-way hash, which cannot be turned back into the password and is not exported.',
      'Searches: the search log has no user id, IP address or session column, so no search can be matched to your account.',
      'Sign-in sessions and the authentication audit log: Supabase keeps the IP address and browser of each sign-in for security. Ask by email for a copy; see the privacy notice.',
    ],
  }
}

export type AccountExport = ReturnType<typeof shapeAccountExport>
