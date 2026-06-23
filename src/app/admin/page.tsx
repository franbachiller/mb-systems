import { redirect } from "next/navigation";
import AdminWorkspace from "@/components/admin-workspace";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  getRentalSnapshot,
  listAdminBookings,
  listInventoryBlocks,
  listInventoryProducts,
} from "@/lib/rental-db";
import { getDefaultRentalWindow } from "@/lib/rental-data";
import { getAdminSystemStatus } from "@/lib/system-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login?next=/admin");
  }

  const bookings = listAdminBookings();
  const inventoryBlocks = listInventoryBlocks();
  const products = listInventoryProducts();
  const initialManualAvailability = getRentalSnapshot(
    getDefaultRentalWindow(),
  ).products;
  const systemStatus = getAdminSystemStatus();

  return (
    <AdminWorkspace
      initialBookings={bookings}
      initialInventoryBlocks={inventoryBlocks}
      initialManualAvailability={initialManualAvailability}
      initialProducts={products}
      initialSystemStatus={systemStatus}
    />
  );
}
