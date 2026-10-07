import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — LiveLift",
  description: "TikTok identity and credential handling in the LiveLift competition and development project.",
};

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p>LiveLift is currently a competition and development project.</p>
      <section>
        <h2>TikTok consent and identity</h2>
        <p>After your explicit OAuth consent, LiveLift may process your TikTok basic profile identity, such as an app-specific account identifier, display name, and avatar, within the permissions you grant. This information is used to identify and display the connected profile.</p>
      </section>
      <section>
        <h2>Provider credentials</h2>
        <p>Provider access and refresh tokens are stored encrypted server-side. They are never exposed to browser storage, including localStorage and sessionStorage.</p>
      </section>
      <section>
        <h2>Disconnecting</h2>
        <p>Disconnecting TikTok deletes local provider credentials and the stored TikTok profile identity. LiveLift also attempts to revoke authorization with TikTok, but provider revocation may not be confirmed. A disconnect timestamp and revocation status may remain.</p>
      </section>
      <section>
        <h2>Data use</h2>
        <p>LiveLift does not sell user data. These pages do not add tracking or analytics.</p>
      </section>
    </>
  );
}
