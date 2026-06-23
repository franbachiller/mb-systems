import {
  clearAdminSessionCookie,
  isAdminAuthenticated,
  setAdminSessionCookie,
  verifyAdminPin,
} from "@/lib/admin-auth";
import {
  getClientIp,
  requireSameOriginRequest,
  securityJson,
} from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxFailedAttempts = 5;
const attemptWindowMs = 10 * 60 * 1000;
const lockoutMs = 15 * 60 * 1000;

type LoginAttempt = {
  failedAttempts: number;
  firstAttemptAt: number;
  lockedUntil: number;
};

const loginAttempts = new Map<string, LoginAttempt>();

export async function GET() {
  return securityJson({ authenticated: await isAdminAuthenticated() });
}

export async function POST(request: Request) {
  const originError = requireSameOriginRequest(request);

  if (originError) {
    return originError;
  }

  const clientKey = getClientIp(request);
  const activeLockout = getActiveLockout(clientKey);

  if (activeLockout > Date.now()) {
    return lockedOutResponse(activeLockout);
  }

  const body = (await request.json()) as unknown;
  const pin = parsePinPayload(body);

  if (!verifyAdminPin(pin)) {
    const lockedUntil = recordFailedAttempt(clientKey);

    if (lockedUntil > Date.now()) {
      return lockedOutResponse(lockedUntil);
    }

    return securityJson(
      { error: "PIN incorrecto.", code: "INVALID_PIN" },
      { status: 401 },
    );
  }

  const response = securityJson({ authenticated: true });
  setAdminSessionCookie(response);
  loginAttempts.delete(clientKey);

  return response;
}

export async function DELETE(request: Request) {
  const originError = requireSameOriginRequest(request);

  if (originError) {
    return originError;
  }

  const response = securityJson({ authenticated: false });
  clearAdminSessionCookie(response);

  return response;
}

function parsePinPayload(body: unknown) {
  if (!body || typeof body !== "object") {
    return "";
  }

  const payload = body as { pin?: unknown };

  return typeof payload.pin === "string" ? payload.pin : "";
}

function getActiveLockout(clientKey: string) {
  pruneLoginAttempts();

  const attempt = loginAttempts.get(clientKey);

  if (!attempt) {
    return 0;
  }

  if (attempt.lockedUntil > Date.now()) {
    return attempt.lockedUntil;
  }

  if (attempt.firstAttemptAt + attemptWindowMs < Date.now()) {
    loginAttempts.delete(clientKey);
    return 0;
  }

  return 0;
}

function recordFailedAttempt(clientKey: string) {
  const now = Date.now();
  const current = loginAttempts.get(clientKey);
  const attempt =
    current && current.firstAttemptAt + attemptWindowMs >= now
      ? current
      : { failedAttempts: 0, firstAttemptAt: now, lockedUntil: 0 };

  attempt.failedAttempts += 1;

  if (attempt.failedAttempts >= maxFailedAttempts) {
    attempt.lockedUntil = now + lockoutMs;
  }

  loginAttempts.set(clientKey, attempt);

  return attempt.lockedUntil;
}

function lockedOutResponse(lockedUntil: number) {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((lockedUntil - Date.now()) / 1000),
  );

  return securityJson(
    {
      error:
        "Demasiados intentos incorrectos. Espera unos minutos y volve a probar.",
      code: "TOO_MANY_ATTEMPTS",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}

function pruneLoginAttempts() {
  const now = Date.now();

  for (const [clientKey, attempt] of loginAttempts.entries()) {
    const lockoutExpired = attempt.lockedUntil > 0 && attempt.lockedUntil < now;
    const windowExpired = attempt.firstAttemptAt + attemptWindowMs < now;

    if (lockoutExpired || windowExpired) {
      loginAttempts.delete(clientKey);
    }
  }
}
