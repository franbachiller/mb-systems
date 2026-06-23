import "server-only";

import { NextResponse } from "next/server";

type RateLimitBucket = {
  count: number;
  windowStartedAt: number;
};

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();

export function requireSameOriginRequest(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const candidateOrigin = getCandidateOrigin(request);

  if (!candidateOrigin || !getAllowedOrigins(requestOrigin).has(candidateOrigin)) {
    return securityJson(
      { error: "Solicitud no permitida.", code: "BAD_ORIGIN" },
      { status: 403 },
    );
  }

  return null;
}

export function rateLimitRequest(
  request: Request,
  { key, limit, windowMs }: RateLimitOptions,
) {
  pruneRateLimitBuckets();

  const now = Date.now();
  const bucketKey = `${key}:${getClientIp(request)}`;
  const current = rateLimitBuckets.get(bucketKey);
  const bucket =
    current && current.windowStartedAt + windowMs > now
      ? current
      : { count: 0, windowStartedAt: now };

  bucket.count += 1;
  rateLimitBuckets.set(bucketKey, bucket);

  if (bucket.count <= limit) {
    return null;
  }

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((bucket.windowStartedAt + windowMs - now) / 1000),
  );

  return securityJson(
    {
      error: "Demasiadas solicitudes. Espera unos minutos y volve a probar.",
      code: "RATE_LIMITED",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  return (
    forwardedFor?.split(",")[0]?.trim() ||
    realIp?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "local"
  );
}

export function securityJson(
  body: Record<string, unknown>,
  init?: ResponseInit,
) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...Object.fromEntries(new Headers(init?.headers).entries()),
      "Cache-Control": "no-store",
    },
  });
}

function getCandidateOrigin(request: Request) {
  const origin = request.headers.get("origin");

  if (origin) {
    return normalizeOrigin(origin);
  }

  const referer = request.headers.get("referer");

  if (!referer) {
    return "";
  }

  try {
    return new URL(referer).origin;
  } catch {
    return "";
  }
}

function getAllowedOrigins(requestOrigin: string) {
  return new Set(
    [requestOrigin, process.env.APP_URL, process.env.NEXT_PUBLIC_APP_URL]
      .map((value) => normalizeOrigin(value ?? ""))
      .filter(Boolean),
  );
}

function normalizeOrigin(value: string) {
  if (!value.trim()) {
    return "";
  }

  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function pruneRateLimitBuckets() {
  const now = Date.now();

  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (bucket.windowStartedAt + 60 * 60 * 1000 < now) {
      rateLimitBuckets.delete(key);
    }
  }
}
