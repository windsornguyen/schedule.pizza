# Hosted policies

The published policies are `apps/pizza/app/routes/privacy.tsx` and `terms.tsx`,
served at `/privacy` and `/terms` without requiring sign-in. Update the effective
date when changing disclosures. These describe the hosted service, not independent
deployments of the open-source code.

Provider identities and processing roles live at `/subprocessors`; public policy
pages omit template attribution. The CC0 source reference remains here.

## Sources

- [General Legal templates](https://github.com/General-Legal/legal-templates/tree/0f7c7bfabf1be77a2bf52eef80815e24c93a190a), CC0: privacy policy and terms of use.
- [Google privacy verification requirements](https://support.google.com/cloud/answer/13806988).
- [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including Limited Use.
- Cloudflare's [D1 encryption](https://developers.cloudflare.com/d1/reference/data-security/) and [recovery history](https://developers.cloudflare.com/d1/reference/time-travel/).

The templates are references, not a legal review. Omitted inapplicable advertising,
data-broker, arbitration, and anti-competition clauses. Do not claim certification,
contractual transfer safeguards, or automated deletion that we have not established.

## Evidence and operations

| Disclosure | Implementation |
| --- | --- |
| Google permissions and identity | `app/auth.server.ts`, `app/db/schema/{user,account,session}.ts` |
| Free/busy; booking events and attendee invitations | `app/calendar/google.server.ts` |
| Profile, booking history, authorization records | `app/db/schema/`, `app/db/functions/` |
| Infrastructure and diagnostic logging | `wrangler.jsonc`, Cloudflare documentation above |
| Google Fonts requests | `app/root.tsx` |
| Privacy requests | Manual requests to `security@schedule.pizza`; no self-service deletion UI |

Verify authority before disclosing or deleting data. Account deletion requests must
cover owned records, guest records associated with the verified email, and support
copies within our control. Explain any legally required retention. Cancel calendar
events before revoking access when requested; database deletion alone does not
remove invitations from Google or recipients. Recovery must not reintroduce data
from previously completed deletion requests.

Review this policy before changing providers, adding telemetry or AI processing,
importing contacts, storing event contents, or automating retention. The pending
feedback/admin work and proposed PlanetScale migration are not deployed behavior.
Tests check rendered disclosure coverage, not legal compliance or operational
execution. Confirm the live page before telling Google's reviewer a fix is deployed.
