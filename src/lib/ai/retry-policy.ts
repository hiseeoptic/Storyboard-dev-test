type ErrorRecord = Record<string, unknown>;

const BILLING_CODES = new Set([
  "credit_balance_exhausted",
  "organization_spend_limit_exceeded",
  "project_spend_limit_exceeded",
  "organization_usage_limit_exceeded",
  "insufficient_quota",
]);

const AUTH_CODES = new Set([
  "invalid_api_key",
  "authentication_error",
  "permission_denied",
]);

function asRecord(value: unknown): ErrorRecord | null {
  return value !== null && typeof value === "object"
    ? (value as ErrorRecord)
    : null;
}

function collectErrorRecords(error: unknown): ErrorRecord[] {
  const records: ErrorRecord[] = [];
  let current = asRecord(error);
  const seen = new Set<ErrorRecord>();

  while (current && !seen.has(current) && records.length < 4) {
    seen.add(current);
    records.push(current);
    current =
      asRecord(current.error) ??
      asRecord(current.cause) ??
      asRecord(current.response);
  }

  return records;
}

function firstString(
  records: ErrorRecord[],
  keys: string[]
): string | undefined {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }
  return undefined;
}

export function aiErrorStatus(error: unknown): number | undefined {
  for (const record of collectErrorRecords(error)) {
    const value = record.status ?? record.statusCode;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && /^\d{3}$/.test(value)) {
      return Number.parseInt(value, 10);
    }
  }
  return undefined;
}

export function aiErrorCode(error: unknown): string | undefined {
  return firstString(collectErrorRecords(error), ["code", "type"])
    ?.toLowerCase()
    .replace(/\s+/g, "_");
}

export function aiErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return (
    firstString(collectErrorRecords(error), ["message", "error_description"]) ??
    String(error)
  );
}

/**
 * Billing/quota failures are not transient. Retrying them cannot succeed until
 * account state changes, and can multiply provider fallbacks in one click.
 */
export function isAiBillingError(error: unknown): boolean {
  const records = collectErrorRecords(error);
  const signals = records
    .flatMap((record) => [record.code, record.type])
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toLowerCase().replace(/\s+/g, "_"));

  if (signals.some((signal) => BILLING_CODES.has(signal))) return true;

  const message = aiErrorMessage(error).toLowerCase();
  return (
    /exceeded your current quota/.test(message) ||
    /current quota.*billing/.test(message) ||
    /credit balance (?:is )?exhausted/.test(message) ||
    /no prepaid credits/.test(message) ||
    /(?:organization|project) spend limit.*(?:reached|exceeded)/.test(message) ||
    /organization usage limit.*(?:reached|exceeded)/.test(message)
  );
}

export function isAiAuthenticationError(error: unknown): boolean {
  const status = aiErrorStatus(error);
  const code = aiErrorCode(error);
  return (
    status === 401 ||
    status === 403 ||
    (code !== undefined && AUTH_CODES.has(code))
  );
}

/**
 * Only transport/server failures, explicit rate limiting, and locally detected
 * malformed model output are worth retrying. Billing/auth/client errors fail
 * fast; a second identical request only wastes time and obscures the cause.
 */
export function shouldRetryAiError(error: unknown): boolean {
  if (isAiBillingError(error) || isAiAuthenticationError(error)) return false;

  const status = aiErrorStatus(error);
  if (status === undefined) return true;
  if (status === 408 || status === 409 || status === 425) return true;
  if (status === 429) return true;
  if (status >= 500) return true;
  if (status >= 400) return false;
  return true;
}

/** Errors for which switching/retrying paid providers in the same pipeline is
 * unsafe. The user must fix billing or credentials first. */
export function shouldAbortAiPipeline(error: unknown): boolean {
  return isAiBillingError(error) || isAiAuthenticationError(error);
}
