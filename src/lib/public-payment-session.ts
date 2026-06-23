const publicPaymentLookupStorageKey = "mb-systems-payment-lookup";
const lookupMaxAgeMs = 24 * 60 * 60 * 1000;

export type PublicPaymentLookupSession = {
  bookingId: string;
  phone: string;
  createdAt: number;
};

export function savePublicPaymentLookupSession(input: {
  bookingId: string;
  phone: string;
}) {
  if (typeof window === "undefined") {
    return;
  }

  const session: PublicPaymentLookupSession = {
    bookingId: input.bookingId,
    phone: input.phone,
    createdAt: Date.now(),
  };

  window.localStorage.setItem(
    publicPaymentLookupStorageKey,
    JSON.stringify(session),
  );
}

export function readPublicPaymentLookupSession(bookingId: string) {
  if (typeof window === "undefined" || !bookingId) {
    return null;
  }

  const rawSession = window.localStorage.getItem(publicPaymentLookupStorageKey);

  if (!rawSession) {
    return null;
  }

  try {
    const session = JSON.parse(rawSession) as Partial<PublicPaymentLookupSession>;

    if (
      session.bookingId !== bookingId ||
      typeof session.phone !== "string" ||
      typeof session.createdAt !== "number" ||
      Date.now() - session.createdAt > lookupMaxAgeMs
    ) {
      return null;
    }

    return {
      bookingId: session.bookingId,
      phone: session.phone,
      createdAt: session.createdAt,
    } satisfies PublicPaymentLookupSession;
  } catch {
    return null;
  }
}
