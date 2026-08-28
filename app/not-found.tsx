import Link from 'next/link'
import { FileQuestionMark } from 'lucide-react'

import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'

// The global 404 (docs/architecture.md D4): unmatched URLs land here, and so
// does any `notFound()` thrown by a route segment without its own not-found —
// a wrong /materials/[slug] is a 404, not an error state.
//
// No <main> here on purpose: this renders inside the root layout, which owns
// the main content region. Two <main> landmarks would be an accessibility bug.
export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center px-gutter py-section md:px-gutter-lg">
      <EmptyState
        headingLevel={1}
        icon={FileQuestionMark}
        title="Page not found"
        description="This address doesn't match anything on the site. The link may be wrong, or the page may have moved."
        action={
          <Button asChild variant="outline" size="lg">
            <Link href="/">Go to the homepage</Link>
          </Button>
        }
      />
    </div>
  )
}
