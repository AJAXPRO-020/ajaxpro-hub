const header = (headers: Headers, ...names: string[]) => {
  for (const name of names) {
    const value = headers.get(name);
    if (value) return value;
  }
  return undefined;
};

export const apiFootballQuota = (headers: Headers) => ({
  dayLimit: header(headers, "x-ratelimit-requests-limit"),
  dayRemaining: header(headers, "x-ratelimit-requests-remaining"),
  minuteLimit: header(headers, "x-ratelimit-limit"),
  minuteRemaining: header(headers, "x-ratelimit-remaining"),
});

export const apiFootballErrorDetails = (error: unknown, response?: Response, providerErrors?: unknown) => {
  const messages = providerErrors && typeof providerErrors === "object"
    ? Object.values(providerErrors).filter((value): value is string => typeof value === "string")
    : [];
  const message = error instanceof Error ? error.message : undefined;
  const name = error instanceof Error ? error.name : undefined;
  const timeout = name === "TimeoutError" || name === "AbortError" || message?.includes("timed out") || message?.includes("aborted");
  const details = {
    kind: timeout ? "timeout" : response && !response.ok ? "http" : messages.length ? "provider" : "unknown",
    status: response?.status,
    errorName: name,
    message,
    providerErrors: messages.length ? messages : undefined,
    ...apiFootballQuota(response?.headers ?? new Headers()),
  };
  return Object.fromEntries(Object.entries(details).filter(([, value]) => value !== undefined));
};
