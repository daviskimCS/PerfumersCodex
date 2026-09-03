'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import {
  GATE_COOKIE_NAME,
  createGateToken,
  gateCookieOptions,
  isGateEnabled,
  isGatePassword,
} from '@/lib/gate'
import {
  UNLOCK_FAILED_MESSAGE,
  unlockSchema,
  type GateFormState,
} from '@/lib/validation/gate'

/**
 * The unlock action.
 *
 * Server Functions are reachable by direct POST, so nothing here trusts the
 * client-side validation in `components/gate/unlock-form.tsx`: the input is
 * re-parsed with the shared schema before it is compared to anything (D6).
 *
 * NO RATE LIMITING, and this is the honest statement of it: an unthrottled
 * password form is brute-forceable. Anyone can POST guesses at this action as
 * fast as the network allows, and nothing here counts them, slows them down,
 * or notices. Rate limiting is the Week 18 Upstash pass — the same deferral
 * recorded for signup and login in `app/(auth)/actions.ts`, and this action
 * belongs in the same bucket when that lands. Until then the only defence is
 * password entropy: use a long random passphrase, not a memorable one.
 */
export async function unlock(
  _prevState: GateFormState,
  formData: FormData
): Promise<GateFormState> {
  const parsed = unlockSchema.safeParse({ password: formData.get('password') })
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  // Nothing to unlock. Not an error the visitor can act on, and confirming
  // "there is no gate here" is a fact worth withholding from someone probing.
  if (!isGateEnabled()) {
    redirect('/')
  }

  if (!(await isGatePassword(parsed.data.password))) {
    // One message for every non-success outcome (lib/validation/gate.ts).
    return { formError: UNLOCK_FAILED_MESSAGE }
  }

  // An HMAC over the issue time — never the password, in any form.
  const store = await cookies()
  store.set(GATE_COOKIE_NAME, await createGateToken(), gateCookieOptions)

  // `redirect` throws, so it stays outside any try/catch; the Set-Cookie
  // written above rides out on its response.
  redirect('/')
}
