/** What the mocked `redirect()` throws; `url` is where the app sent the reader. */
export class RedirectSignal extends Error {
  constructor(readonly url: string) {
    super(`redirect(${url})`)
  }
}
