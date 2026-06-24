# Security Policy

## Reporting Vulnerabilities

Do not open public issues for security vulnerabilities.

Report privately through GitHub:

https://github.com/windsornguyen/schedule.pizza/security/advisories/new

You can also email security reports to
[security@schedule.pizza](mailto:security@schedule.pizza).

Include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix, if any

We will acknowledge your report within 48 hours and provide a detailed response
within 7 days.

## Supported Versions

| Version | Supported |
| --- | --- |
| main | Active development |
| < 1.0 | Pre-release, best-effort |

## Security Considerations

schedule.pizza handles booking availability, guest-submitted booking data, and
calendar integration metadata. Important security boundaries:

- Do not expose host availability without a valid booking code.
- Store booking codes as hashes, not plaintext.
- Rate-limit booking-code attempts and booking creation.
- Do not confirm bookings until the authorization and calendar-write path both
  succeed.
- Do not put secrets in source, Wrangler config, generated migrations, or test
  fixtures.

## Disclosure Policy

We follow coordinated disclosure:

1. Reporter submits vulnerability privately.
2. We acknowledge within 48 hours.
3. We investigate and develop a fix.
4. We release the fix and credit the reporter, unless anonymity is requested.
5. Public disclosure happens after 90 days or when the fix is deployed.
