import { NextResponse } from "next/server";
import { getDefaultRentalWindow, type RentalWindow } from "@/lib/rental-data";
import { getRentalSnapshot } from "@/lib/rental-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const window: RentalWindow = {
    start: searchParams.get("start") ?? getDefaultRentalWindow().start,
    end: searchParams.get("end") ?? getDefaultRentalWindow().end,
  };

  return NextResponse.json(getRentalSnapshot(window));
}
