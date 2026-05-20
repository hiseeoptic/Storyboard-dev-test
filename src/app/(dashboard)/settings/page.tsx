"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { useUser } from "@/hooks/use-user";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const { user, loading: userLoading } = useUser();
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.user_metadata?.full_name ?? "");
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const supabase = createClient();

    await supabase.auth.updateUser({
      data: { full_name: fullName },
    });

    await supabase
      .from("users")
      .update({ full_name: fullName })
      .eq("id", user.id);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (userLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold">Settings</h1>

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Update your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <Input value={user?.email ?? ""} disabled />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Full Name</label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
