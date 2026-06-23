import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const ADMIN_COOKIE_NAME = "mb_admin_session";
const ADMIN_SESSION_SECONDS = 12 * 60 * 60;
const LOCAL_DEFAULT_PIN = "1234";
const LOCAL_DEFAULT_SECRET = "mb-systems-local-admin-session";

export class AdminAuthError extends Error {
  constructor() {
    super("Necesitas iniciar sesion como admin.");
    this.name = "AdminAuthError";
  }
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  return isAdminSessionValueValid(sessionValue);
}

export async function requireAdminSession() {
  if (!(await isAdminAuthenticated())) {
    throw new AdminAuthError();
  }
}

export function verifyAdminPin(pin: string) {
  return secureCompare(pin.trim(), getAdminPin());
}

export function setAdminSessionCookie(response: NextResponse) {
  response.cookies.set(ADMIN_COOKIE_NAME, createAdminSessionValue(), {
    httpOnly: true,
    maxAge: ADMIN_SESSION_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export function adminUnauthorizedResponse() {
  return NextResponse.json(
    { error: "Necesitas iniciar sesion como admin.", code: "UNAUTHORIZED" },
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function createAdminSessionValue() {
  const expiresAt = Date.now() + ADMIN_SESSION_SECONDS * 1000;
  const signature = signSessionValue(String(expiresAt));

  return `${expiresAt}.${signature}`;
}

function isAdminSessionValueValid(value: string | undefined) {
  if (!value) {
    return false;
  }

  const [expiresAt, signature] = value.split(".");

  if (!expiresAt || !signature || Number(expiresAt) <= Date.now()) {
    return false;
  }

  return secureCompare(signature, signSessionValue(expiresAt));
}

function signSessionValue(value: string) {
  return createHmac("sha256", getAdminSessionSecret())
    .update(value)
    .digest("hex");
}

function secureCompare(firstValue: string, secondValue: string) {
  const firstHash = createHmac("sha256", getAdminSessionSecret())
    .update(firstValue)
    .digest();
  const secondHash = createHmac("sha256", getAdminSessionSecret())
    .update(secondValue)
    .digest();

  return timingSafeEqual(firstHash, secondHash);
}

function getAdminPin() {
  const pin = process.env.ADMIN_PIN?.trim();

  if (process.env.NODE_ENV === "production" && (!pin || pin === LOCAL_DEFAULT_PIN)) {
    throw new Error("ADMIN_PIN must be configured for production.");
  }

  return pin || LOCAL_DEFAULT_PIN;
}

function getAdminSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();

  if (process.env.NODE_ENV === "production" && !secret) {
    throw new Error("ADMIN_SESSION_SECRET must be configured for production.");
  }

  return secret || process.env.ADMIN_PIN?.trim() || LOCAL_DEFAULT_SECRET;
}
