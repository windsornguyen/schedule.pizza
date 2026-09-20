// Public disclosures for the hosted scheduling service. Keep these aligned with
// the Google integration, stored records, and the manual privacy-request process.
const sections = [
  {
    title: "information we collect",
    paragraphs: [
      "Google sign-in provides your name, email address, verification status, profile image, and Google account identifier. We store these to identify your account. We do not receive your Google password.",
      "When you connect Google Calendar, we receive OAuth tokens (access, refresh, and ID tokens), their expiry times, granted permissions, and your calendar identifier. Free/busy requests return occupied start and end times, not existing event titles, descriptions, or attendee lists. We also receive the identifier of events created for your bookings.",
      "You provide your username, display name, time zone, and slot duration. Booking records contain the host, guests' names and email addresses, time zones, meeting times, status, and calendar event identifier. Group scheduling uses the participants and booking codes you supply. We do not import your Google Contacts or read Gmail.",
      "We store session identifiers, IP addresses and browser information for sign-in, and hashed IP addresses and request history for booking abuse prevention. Our hosting provider processes request metadata and error logs. If you email us, we receive your address, message, and attachments. Please do not send passwords, booking codes, or unnecessary calendar details.",
    ],
  },
  {
    title: "how we use information",
    paragraphs: [
      "We use account and profile information to sign you in, maintain your scheduling profile, and apply your settings. We use booking codes to authorize availability requests, calculate available times, and prevent unauthorized bookings.",
      "Google user data is used to provide scheduling features you request. The calendar.freebusy permission lets us check conflicts. The calendar.events permission lets us create booking events and invitations and delete events when bookings are cancelled. Although that permission allows broader event access, our integration does not list the contents of your existing events. Refresh tokens keep your authorized calendar connection working between visits.",
      "We use technical records to operate and secure the service, diagnose failures, and investigate abuse. We use correspondence to answer your requests. We do not sell personal information, use it for targeted advertising, or use Google user data to train general-purpose AI or machine-learning models.",
    ],
  },
  {
    title: "sharing",
    paragraphs: [
      "People who have your booking code can see your scheduling profile and available times. Booking information is shared with the host and invited participants so they can attend and manage the meeting. Invitations sent through Google Calendar may expose participants' names and email addresses to other invitees, according to Google's event settings. Your unrelated calendar event details are not shown to bookers.",
      "We use service providers for hosting, database storage, network security, and diagnostics. They process account, booking, and technical information needed to operate the service. Google processes sign-in, calendar authorization, events, and invitation delivery. The site also loads externally hosted fonts, which transmit IP addresses and browser request metadata. Our service providers page identifies these providers, the personal information they process, and their roles.",
      "We may disclose information with your permission, when necessary to investigate security incidents or abuse, or when legally required. Transfers of Google user data are limited by Google's Limited Use requirements. Humans may access that data only with your affirmative agreement to view specific data, when necessary for security or legal compliance, or as aggregated data for internal operations consistent with applicable law.",
    ],
  },
  {
    title: "storage and security",
    paragraphs: [
      "Account, calendar-connection, and booking records are stored in a managed database, encrypted at rest by our infrastructure provider. Connections to our production website, Google APIs, and the database are encrypted in transit. Server-side authentication and authorization restrict access to account data. Booking codes are stored as hashes, not as readable codes.",
      "Authorized service operators and infrastructure providers have access needed to run and secure the service, subject to the Google data restrictions above. No internet service can guarantee absolute security. Providers may process data in the United States and other countries, where privacy laws may differ from those where you live.",
    ],
  },
  {
    title: "retention and deletion",
    paragraphs: [
      "Account, profile, calendar-connection, and booking records are retained while you use the service and until you request their deletion. Completed and cancelled bookings are not automatically deleted. Session and authorization expiry ends access; it does not necessarily erase the stored record. Support and security records are retained as needed to resolve requests, investigate incidents, and meet legal obligations.",
      "To request deletion, email security@schedule.pizza from the address associated with your account or booking and say what you want deleted. We handle requests manually, may ask for information needed to verify your authority, and remove the relevant live records unless retention is legally required. We will explain any exception. Do not send a password or access token. There is currently no self-service account deletion button.",
      "Database recovery history may retain deleted records for up to 30 days before it expires. Deleting schedule.pizza records does not erase copies held by invitees or automatically delete existing events in Google Calendar. Cancel unwanted bookings before disconnecting Google, or remove events directly in your calendar.",
    ],
  },
  {
    title: "your choices and rights",
    paragraphs: [
      "You can change your profile and rotate your booking code from the dashboard. You can revoke Google access in your Google Account's third-party connections settings. Revocation prevents further authorized calendar access but does not delete records already stored by schedule.pizza; request deletion separately.",
      "We use cookies for authentication and session security, not advertising. You can clear or block them in your browser, but sign-in may stop working. We do not use advertising pixels or cross-site advertising trackers.",
      "Depending on applicable law, you may request access to, a copy of, correction of, or deletion of your personal information; object to or restrict processing; or withdraw consent. Contact security@schedule.pizza to exercise these rights or appeal a response. We may verify your identity and will not discriminate against you for exercising applicable rights. You may also complain to your local privacy regulator. Where European data-protection law applies, we process information to provide the service you request, for legitimate interests in security and support, to comply with law, or with consent where required.",
    ],
  },
  {
    title: "children and policy changes",
    paragraphs: [
      "The service is not directed to children under 13. If you believe a child has provided personal information, contact us so we can investigate and delete it as required.",
      "We will post policy updates here with a new effective date and provide notice of material changes. Before using Google user data for a new purpose, we will update our disclosures and obtain any required consent. This policy covers the hosted schedule.pizza service; independent operators of the open-source software are responsible for their own practices.",
    ],
  },
] as const;

export function meta() {
  return [
    { title: "privacy - schedule.pizza" },
    { name: "description", content: "privacy policy for schedule.pizza." },
  ];
}

export default function Privacy() {
  return (
    <main className="mx-auto w-full max-w-[550px] px-4 pt-20 pb-24 antialiased [&_a]:underline [&_a]:decoration-border [&_a]:underline-offset-4 [&_a:hover]:text-foreground">
      <h1 className="text-sm font-semibold">privacy</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Effective September 20, 2026. This policy explains how schedule.pizza
        ("we", "us") handles information when you use our website and scheduling
        API. Contact <a href="mailto:security@schedule.pizza">security@schedule.pizza</a>
        {" "}with questions or privacy requests.
      </p>
      {sections.map((section) => (
        <section key={section.title} className="mt-10 space-y-3">
          <h2 className="text-sm font-semibold">{section.title}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-6 text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
      <section className="mt-10 space-y-3">
        <h2 className="text-sm font-semibold">google api policy</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Our use and transfer of information received from Google APIs adheres
          to the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>,
          including the Limited Use requirements.
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          <a href="https://myaccount.google.com/connections">Manage or revoke Google access</a>.
        </p>
      </section>
      <nav className="mt-10 flex flex-wrap gap-3 text-sm text-muted-foreground">
        <a href="/subprocessors">service providers</a>
        <a href="/terms">terms</a>
        <a href="/">home</a>
      </nav>
    </main>
  );
}
