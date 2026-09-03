'use client'

import { useCallback, useState, type ChangeEvent } from 'react'
import type { z } from 'zod'

/**
 * The per-form checklist, written once (W6-B / P3-C).
 *
 * `/account` carries three forms, and every one of them owes the same
 * behaviour: inline messages, errors on blur rather than on keystroke, a
 * visible error clearing the moment the field becomes valid again, submit
 * disabled while invalid, and the server's field-keyed verdict shown when the
 * client had nothing to say. `app/(auth)/login/page.tsx` and its sibling
 * implement that by hand; doing it a third, fourth and fifth time is how the
 * five copies drift apart.
 *
 * The schema passed in is the *same* schema the server action re-parses (D6),
 * so nothing here is load-bearing for safety — it only decides when a message
 * appears.
 */

export type FieldErrors<Values> = Partial<
  Record<keyof Values & string, string[]>
>

/** Field errors from a Zod issue list, keyed by the first path segment. */
function errorsFrom<Values extends Record<string, string>>(
  schema: z.ZodType<unknown, Values>,
  values: Values
): FieldErrors<Values> {
  const parsed = schema.safeParse(values)
  if (parsed.success) return {}

  const errors: FieldErrors<Values> = {}
  for (const issue of parsed.error.issues) {
    const key = issue.path[0]
    if (typeof key !== 'string') continue
    const field = key as keyof Values & string
    errors[field] = [...(errors[field] ?? []), issue.message]
  }
  return errors
}

export function useAccountForm<Values extends Record<string, string>>({
  schema,
  initialValues,
  serverErrors,
}: {
  schema: z.ZodType<unknown, Values>
  initialValues: Values
  /** The last server verdict, if any. Overridden by anything local. */
  serverErrors: FieldErrors<Values> | undefined
}) {
  const [values, setValues] = useState<Values>(initialValues)
  // Written on blur only. For a given field, `undefined` defers to the
  // server's verdict; `[]` means "locally valid now" and clears a stale server
  // error the reader has since fixed.
  const [localErrors, setLocalErrors] = useState<FieldErrors<Values>>({})

  type Field = keyof Values & string

  const messagesFor = (field: Field): string[] =>
    localErrors[field] ?? serverErrors?.[field] ?? []

  /** The one message to render under a field, or `undefined`. */
  const errorFor = (field: Field): string | undefined => messagesFor(field)[0]

  const handleBlur = (field: Field) => () =>
    setLocalErrors((prev) => ({
      ...prev,
      [field]: errorsFrom(schema, values)[field] ?? [],
    }))

  const handleChange = (field: Field) => (value: string) => {
    const next = { ...values, [field]: value }
    setValues(next)
    // Errors never appear mid-keystroke, but a visible one disappears the
    // moment the field becomes valid again.
    if (
      messagesFor(field).length > 0 &&
      (errorsFrom(schema, next)[field] ?? []).length === 0
    ) {
      setLocalErrors((prev) => ({ ...prev, [field]: [] }))
    }
  }

  /** Everything a `Field` needs to be controlled, correct and announced. */
  const fieldProps = (field: Field) => ({
    name: field,
    value: values[field],
    onChange: (event: ChangeEvent<HTMLInputElement>) =>
      handleChange(field)(event.target.value),
    onBlur: handleBlur(field),
    error: errorFor(field),
  })

  /** Fresh submission, fresh verdict: drop stale local overrides. */
  const clearLocalErrors = useCallback(() => setLocalErrors({}), [])

  /** Back to empty — what a form owes the reader after it succeeds. */
  const reset = useCallback(() => {
    setValues(initialValues)
    setLocalErrors({})
    // `initialValues` is a literal at every call site, so a dependency on it
    // would make `reset` a new function on every render and re-run the effects
    // that call it. The values it restores are constant by construction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    values,
    fieldProps,
    errorFor,
    clearLocalErrors,
    reset,
    isValid: schema.safeParse(values).success,
  }
}
