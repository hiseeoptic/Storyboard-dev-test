import { Navbar } from "@/components/layout/navbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen" suppressHydrationWarning>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
