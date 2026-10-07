import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use — LiveLift",
  description: "Terms of use for the LiveLift competition and development project.",
};

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Use</h1>
      <p>LiveLift is currently a competition and development project. Features may change or be unavailable.</p>
      <section>
        <h2>Acceptable use</h2>
        <p>Use LiveLift only for lawful, authorized activities. Do not misuse another person’s data or account, bypass access controls, or disrupt the service.</p>
      </section>
      <section>
        <h2>Platform integrations</h2>
        <p>LiveLift does not guarantee that TikTok or other platform integrations are available, approved, or will continue to work. Connecting a profile does not grant access to livestream, shop, or platform action features.</p>
      </section>
      <section>
        <h2>Your responsibility</h2>
        <p>You are responsible for complying with applicable laws and the terms, policies, and permissions of TikTok and any other platform you use with LiveLift.</p>
      </section>
    </>
  );
}
