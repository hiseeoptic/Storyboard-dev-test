import { NextResponse } from "next/server";
import { ZodError } from "zod";

interface ApiSuccessResponse<T> {
  data: T;
  error: null;
}

interface ApiErrorResponse {
  data: null;
  error: {
    message: string;
    code: string;
  };
}

type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export function success<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ data, error: null }, { status });
}

export function error(
  message: string,
  code: string,
  status: number
): NextResponse<ApiResponse<never>> {
  return NextResponse.json({ data: null, error: { message, code } }, { status });
}

export function handleApiError(err: unknown): NextResponse<ApiResponse<never>> {
  if (err instanceof ZodError) {
    return error(
      err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", "),
      "VALIDATION_ERROR",
      400
    );
  }

  if (err instanceof Error) {
    console.error("[API Error]", err.message);
    return error(err.message, "INTERNAL_ERROR", 500);
  }

  console.error("[API Error] Unknown error", err);
  return error("An unexpected error occurred", "INTERNAL_ERROR", 500);
}
