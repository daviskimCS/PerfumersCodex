import { describe, expect, it } from 'vitest'

import { clientIp } from './auth-server'

describe('clientIp', () => {
  it.each([
    ['x-real-ip', { 'x-real-ip': '203.0.113.7' }, '203.0.113.7'],
    [
      'the first x-forwarded-for entry',
      { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
      '203.0.113.7',
    ],
    [
      'x-real-ip over x-forwarded-for',
      { 'x-real-ip': '198.51.100.2', 'x-forwarded-for': '203.0.113.7' },
      '198.51.100.2',
    ],
    ['an IPv6 address', { 'x-real-ip': '2001:db8::1' }, '2001:db8::1'],
  ])('reads %s', (_label, headers, expected) => {
    expect(clientIp(new Headers(headers))).toBe(expected)
  })

  it.each([
    ['no headers', {}],
    ['a hostname', { 'x-real-ip': 'evil.example' }],
    ['an IP with a port', { 'x-forwarded-for': '203.0.113.7:443' }],
    ['an empty first entry', { 'x-forwarded-for': ' , 203.0.113.7' }],
  ])('sends nothing for %s', (_label, headers) => {
    expect(clientIp(new Headers(headers))).toBeNull()
  })
})
