# Security policy

Perfumers Codex is a single-maintainer project. Only the code on `main`,
deployed at perfumerscodex.com, is supported. There are no versioned
releases, so fixes land on `main` and deploy from there.

## Reporting a vulnerability

Please report privately through GitHub:
**Security → Report a vulnerability** on this repository
([private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)).

Don't open a public issue or pull request for a security problem.

A useful report says what is affected (a URL, route or file), how to
reproduce it, and what an attacker gains.

## What to expect

- An acknowledgement within 7 days.
- An assessment, and a fix or a reason for declining, within 30 days. If a
  fix takes longer, you'll hear why and roughly when.
- Credit in the fix's advisory or commit if you want it.

## Scope

In scope: the web app in this repository and the site it deploys,
especially anything that exposes one account's bookmarks or notes to another
account, gets around authentication, or reads or writes database rows the
caller shouldn't reach.

Out of scope: the pre-launch password page (it is a temporary fence in front
of the real access controls, not one of them), denial of service, reports
from automated scanners without a demonstrated impact, and vulnerabilities in
Supabase, Vercel or other third-party services, which go to those vendors.

Please test only against accounts you own, and don't access, change or
delete other people's data.
