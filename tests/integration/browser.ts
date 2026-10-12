/**
 * A cookie jar standing in for one browser. The Supabase SSR client stores
 * the session (and the PKCE code verifier) in cookies, so "which browser is
 * this request from" is exactly "which jar is active".
 */
export class Browser {
  private readonly jar = new Map<string, string>()

  getAll(): { name: string; value: string }[] {
    return [...this.jar].map(([name, value]) => ({ name, value }))
  }

  set(name: string, value: string, options?: { maxAge?: number }): void {
    // @supabase/ssr removes a cookie by writing it empty with maxAge 0.
    if (value === '' || options?.maxAge === 0) this.jar.delete(name)
    else this.jar.set(name, value)
  }

  names(): string[] {
    return [...this.jar.keys()]
  }

  /** The `Cookie` header this browser would send. */
  header(): string {
    return this.getAll()
      .map(({ name, value }) => `${name}=${value}`)
      .join('; ')
  }
}

let active: Browser | null = null

/** Make `browser` the one `cookies()` reads and writes. */
export function activate(browser: Browser): Browser {
  active = browser
  return browser
}

export function currentCookieStore() {
  if (active === null) {
    throw new Error(
      'No test browser is active; call activate(new Browser()) first.'
    )
  }
  const browser = active
  return {
    getAll: () => browser.getAll(),
    set: (name: string, value: string, options?: { maxAge?: number }) =>
      browser.set(name, value, options),
  }
}
