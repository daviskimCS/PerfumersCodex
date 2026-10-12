import type { User } from '@supabase/supabase-js'

import {
  shapeAccountExport,
  type AccountExport,
  type NoteRow,
  type SavedRow,
} from '@/lib/account/export'
import { listMaterialsByIds } from '@/lib/db/materials'
import { createClient } from '@/lib/supabase/server'

/**
 * Read everything the account owns, for "download your data".
 *
 * The user tables are read through the Supabase server client, so RLS scopes
 * every row to the caller exactly as it does for `/saved` and the note editor
 * (AGENTS.md data-access boundary); the `.eq('user_id', …)` is the lock on
 * top of that fence. Material names come from the editorial side through
 * `listMaterialsByIds`, which returns published materials only.
 *
 * Throws on a failed read rather than returning a partial file: an export
 * that silently leaves out the notes is a false answer to an access request.
 */
export async function buildAccountExport(user: User): Promise<AccountExport> {
  const supabase = await createClient()

  const [savedResult, notesResult] = await Promise.all([
    supabase
      .from('user_saved_materials')
      .select('material_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('user_notes')
      .select('material_id, body, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false }),
  ])

  if (savedResult.error) {
    throw new Error('account export: could not read saved materials', {
      cause: savedResult.error,
    })
  }
  if (notesResult.error) {
    throw new Error('account export: could not read notes', {
      cause: notesResult.error,
    })
  }

  const saved: SavedRow[] = savedResult.data ?? []
  const notes: NoteRow[] = notesResult.data ?? []
  const materials = await listMaterialsByIds([
    ...saved.map((row) => row.material_id),
    ...notes.map((row) => row.material_id),
  ])

  return shapeAccountExport(user, saved, notes, materials, new Date())
}
