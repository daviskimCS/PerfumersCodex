import type { ComponentProps, ReactNode } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/**
 * The two pieces of markup all three /account forms share (W6-B / P3-C).
 *
 * They exist so the label/input/message triplet and the notice box are written
 * once: three near-identical copies is how two of them quietly lose their
 * `aria-describedby` six months from now. Composition only — this file adds no
 * behaviour and no styles beyond what `components/ui/*` already defines.
 */

export interface FieldProps extends Omit<
  ComponentProps<'input'>,
  'aria-invalid' | 'aria-describedby'
> {
  /** Unique on the page: it ties the label and the message to the input. */
  id: string
  label: string
  /** The single message to show, or nothing. Replaces `hint` while present. */
  error?: string
  /** Standing guidance — a policy note, not a correction. */
  hint?: ReactNode
}

export function Field({ id, label, error, hint, ...inputProps }: FieldProps) {
  const errorId = `${id}-error`
  const hintId = `${id}-hint`

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        // Exactly one of the two is rendered at a time, so exactly one is
        // described — a stale reference would read as an empty description.
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        {...inputProps}
      />
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/**
 * A form-level message: what happened to the submission as a whole, as
 * distinct from a field the reader can correct.
 *
 * `tone="error"` carries `role="alert"`, matching the auth pages. `tone="info"`
 * carries no role on purpose — a notice that reports success has to be
 * announced by a live region that was already on the page when it appeared, so
 * the caller wraps it in a stable `aria-live` container instead.
 */
export function FormNotice({
  tone,
  children,
  className,
}: {
  tone: 'error' | 'info'
  children: ReactNode
  className?: string
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={cn(
        'rounded-lg border px-3 py-2 text-sm',
        tone === 'error'
          ? 'border-destructive/30 bg-destructive/5 text-destructive'
          : 'border-border bg-muted/50 text-muted-foreground',
        className
      )}
    >
      {children}
    </div>
  )
}
