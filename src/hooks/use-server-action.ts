"use client";

import { useState, useCallback, useTransition } from "react";
import type { ActionResult } from "@/types";

export function useServerAction<TInput, TOutput>(
  action: (input: TInput) => Promise<ActionResult<TOutput>>
) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TOutput | null>(null);

  const execute = useCallback(
    (input: TInput) => {
      setError(null);
      startTransition(async () => {
        const result = await action(input);
        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error);
        }
      });
    },
    [action]
  );

  const reset = useCallback(() => {
    setError(null);
    setData(null);
  }, []);

  return { execute, isPending, error, data, reset };
}
