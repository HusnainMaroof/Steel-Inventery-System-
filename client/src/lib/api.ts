"use client";

import {
  isServerUnavailableMessage,
  isServerUnavailableStatus,
  redirectToOfflinePage,
} from "./server-offline";
import { redirectToNotFoundPage } from "./not-found-route";
import { fetchWithTimeout, isTimeoutError } from "./fetch-with-timeout";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const DEFAULT_TIMEOUT_MS = 30_000;
const REPORT_TIMEOUT_MS = 60_000;

function timeoutForPath(path: string): number {
  if (path.includes("/reports/")) return REPORT_TIMEOUT_MS;
  if (path.includes("/ledger/bootstrap")) return 45_000;
  return DEFAULT_TIMEOUT_MS;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  let response: Response;
  try {
    response = await fetchWithTimeout(
      `/api/tradex${path}`,
      { ...init, headers, cache: "no-store" },
      timeoutForPath(path),
    );
  } catch (err) {
    if (isTimeoutError(err)) {
      redirectToOfflinePage();
      throw new ApiError(
        err instanceof Error ? err.message : "Request timed out",
        504,
      );
    }
    redirectToOfflinePage();
    throw new ApiError("Cannot reach the server. Check your connection.", 503);
  }
  const body = (await response.json().catch(() => null)) as
    | { message?: string }
    | T
    | null;
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body && body.message
        ? String(body.message)
        : response.status === 504
          ? "The server took too long to respond. Try again."
          : "Request failed";
    if (isServerUnavailableStatus(response.status) || isServerUnavailableMessage(message)) {
      redirectToOfflinePage();
    }
    if (response.status === 404) {
      redirectToNotFoundPage();
    }
    throw new ApiError(message, response.status);
  }
  return body as T;
}

export function jsonBody(value: unknown): Pick<RequestInit, "body" | "headers"> {
  return {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  };
}
