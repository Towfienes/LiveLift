import { redirect } from "next/navigation";
import { simulator } from "@/lib/simulator/simulatorEngine";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function SessionRedirectPage({ params }: PageProps) {
  const resolvedParams = await params;
  const sessionId = resolvedParams.sessionId;

  const session = simulator.getSession(sessionId);

  if (!session) {
    redirect(`/live/${sessionId}/prepare`);
  }

  if (session.lifecycle === "active") {
    redirect(`/live/${sessionId}/operate`);
  } else if (session.lifecycle === "ended") {
    redirect(`/live/${sessionId}/review`);
  } else {
    redirect(`/live/${sessionId}/prepare`);
  }
}
