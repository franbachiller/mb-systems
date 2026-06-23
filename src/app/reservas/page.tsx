import BookingLookupWorkspace from "@/components/booking-lookup-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PublicBookingLookupPage({
  searchParams,
}: {
  searchParams: Promise<{
    collection_status?: string;
    id?: string;
    payment_id?: string;
    status?: string;
  }>;
}) {
  const params = await searchParams;

  return (
    <BookingLookupWorkspace
      initialBookingId={params.id ?? ""}
      paymentReturnStatus={getPaymentReturnStatus(params)}
    />
  );
}

function getPaymentReturnStatus(params: {
  collection_status?: string;
  payment_id?: string;
  status?: string;
}) {
  const status = (params.collection_status || params.status || "").toLowerCase();

  if (status === "approved") {
    return "approved";
  }

  if (status === "pending" || status === "in_process") {
    return "pending";
  }

  if (status === "rejected" || status === "failure") {
    return "failed";
  }

  if (params.payment_id) {
    return "pending";
  }

  return "none";
}
