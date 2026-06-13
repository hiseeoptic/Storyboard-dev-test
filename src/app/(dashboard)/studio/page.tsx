import { StudioClient } from "./studio-client";

export const metadata = {
  title: "Image Studio — StoryboardAI",
};

// Image generation can take a while — allow a long server window.
export const maxDuration = 300;

export default function StudioPage() {
  return <StudioClient />;
}
