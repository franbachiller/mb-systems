import RentalWorkspace from "@/components/rental-workspace";
import { getDefaultRentalWindow } from "@/lib/rental-data";
import { getRentalSnapshot } from "@/lib/rental-db";

export default function Home() {
  const initialRentalWindow = getDefaultRentalWindow();
  const initialSnapshot = getRentalSnapshot(initialRentalWindow);

  return (
    <RentalWorkspace
      initialRentalWindow={initialRentalWindow}
      initialSnapshot={initialSnapshot}
    />
  );
}
