"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RotateCw, AlertTriangle } from "lucide-react";

// Graceful boundary for the dashboard routes: instead of the cryptic
// "An error occurred in the Server Components render", show a friendly retry.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard error]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-yellow-500" />
      <h2 className="mb-2 text-xl font-bold">Đã có lỗi xảy ra</h2>
      <p className="mb-1 text-sm text-muted-foreground">
        Quá trình vừa rồi gặp trục trặc. Hãy thử lại — phần lớn trường hợp chạy lại là được.
      </p>
      {error.digest && (
        <p className="mb-6 text-xs text-muted-foreground/70">Mã lỗi: {error.digest}</p>
      )}
      <div className="mt-4 flex justify-center gap-2">
        <Button onClick={reset} className="gap-2">
          <RotateCw className="h-4 w-4" /> Thử lại
        </Button>
        <Button variant="outline" onClick={() => (window.location.href = "/generate")}>
          Về trang tạo Storyboard
        </Button>
      </div>
    </div>
  );
}
