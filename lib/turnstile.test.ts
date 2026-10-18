import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const env = vi.hoisted(() => ({
  TURNSTILE_SECRET_KEY: undefined as string | undefined,
}))
vi.mock('@/lib/env', () => ({ env }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-real-ip': '203.0.113.7' }),
}))

import { passesTurnstile } from './turnstile'

function form(token?: string) {
  const data = new FormData()
  if (token !== undefined) data.set('cf-turnstile-response', token)
  return data
}

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  env.TURNSTILE_SECRET_KEY = 'test-secret'
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('passesTurnstile', () => {
  it('passes without asking Cloudflare while no secret is set', async () => {
    env.TURNSTILE_SECRET_KEY = undefined
    await expect(passesTurnstile(form())).resolves.toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuses a form that sent no token, without asking Cloudflare', async () => {
    await expect(passesTurnstile(form())).resolves.toBe(false)
    await expect(passesTurnstile(form(''))).resolves.toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends the secret, the token and the reader’s IP to siteverify', async () => {
    fetchMock.mockResolvedValue(Response.json({ success: true }))
    await expect(passesTurnstile(form('tok'))).resolves.toBe(true)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify'
    )
    const body = init.body as URLSearchParams
    expect(body.get('secret')).toBe('test-secret')
    expect(body.get('response')).toBe('tok')
    expect(body.get('remoteip')).toBe('203.0.113.7')
  })

  it('refuses a token Cloudflare rejects', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ success: false, 'error-codes': ['timeout-or-duplicate'] })
    )
    await expect(passesTurnstile(form('spent'))).resolves.toBe(false)
  })

  it('fails closed when Cloudflare errors or cannot be reached', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }))
    await expect(passesTurnstile(form('tok'))).resolves.toBe(false)

    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    await expect(passesTurnstile(form('tok'))).resolves.toBe(false)
  })
})
