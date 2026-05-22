import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { SettingsClient } from "./settings-client";

export const metadata = { title: "Settings - StoryboardAI" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });

  return (
    <SettingsClient
      name={user?.name ?? ""}
      email={user?.email ?? ""}
    />
  );
}
