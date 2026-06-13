import { GenerateClient } from "./generate-client";

// Building the full storyboard runs several sequential image generations —
// give the server function the maximum time window (Vercel clamps to plan max).
export const maxDuration = 300;

export default function GeneratePage() {
  return <GenerateClient />;
}
