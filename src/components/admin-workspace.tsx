"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CalendarOff,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Clock,
  CreditCard,
  Download,
  FileText,
  Filter,
  LogOut,
  Minus,
  Phone,
  Plus,
  Save,
  Search,
  Trash2,
  X,
  Wrench,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  bookingStatuses,
  categories,
  getDefaultRentalWindow,
  getRentalDays,
  inventoryBlockReasons,
  isValidRentalWindow,
  type AdminBooking,
  type BookingStatus,
  type InventoryBlock,
  type InventoryBlockReason,
  type Product,
  type ProductAvailability,
  type RentalWindow,
} from "@/lib/rental-data";
import BrandMark from "@/components/brand-mark";
import type { AdminSystemStatus } from "@/lib/system-status-data";

type ProductDraft = {
  name: string;
  category: Product["category"];
  totalUnits: number;
  maintenanceUnits: number;
  pricePerDay: number;
  imageUrl: string;
  specs: string;
  tagsText: string;
};

type ManualBookingItem = {
  productId: string;
  quantity: number;
};

type ManualBookingForm = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  window: RentalWindow;
  items: ManualBookingItem[];
};

type InventoryBlockDraft = {
  productId: string;
  quantity: number;
  window: RentalWindow;
  reason: InventoryBlockReason;
  note: string;
};

type AgendaEvent = {
  bookingId: string;
  clientName: string;
  status: BookingStatus;
  time: string;
  itemsLabel: string;
};

type AgendaDay = {
  dateKey: string;
  label: string;
  shortLabel: string;
  pickups: AgendaEvent[];
  returns: AgendaEvent[];
  active: AgendaEvent[];
  totalEvents: number;
};

type SaveState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type BookingStatusFilter = BookingStatus | "todos";
type BookingBalanceFilter = "todos" | "con_saldo" | "saldadas" | "con_cargos";

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const agendaDayFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
});

const agendaWeekdayFormatter = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
});

const timeFormatter = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
});

const statusStyles: Record<BookingStatus, string> = {
  pendiente: "border-amber-200 bg-amber-50 text-amber-800",
  confirmado: "border-cyan-200 bg-cyan-50 text-cyan-800",
  pagado: "border-emerald-200 bg-emerald-50 text-emerald-800",
  retirado: "border-indigo-200 bg-indigo-50 text-indigo-800",
  devuelto: "border-slate-200 bg-slate-50 text-slate-700",
  cancelado: "border-rose-200 bg-rose-50 text-rose-700",
};

const operationalStatuses = new Set<BookingStatus>([
  "pendiente",
  "confirmado",
  "pagado",
  "retirado",
]);

const activeFinancialStatuses = new Set<BookingStatus>([
  "pendiente",
  "confirmado",
  "pagado",
  "retirado",
  "devuelto",
]);

const balanceFilterLabels: Record<BookingBalanceFilter, string> = {
  todos: "Todos",
  con_saldo: "Con saldo",
  saldadas: "Saldadas",
  con_cargos: "Con cargos",
};

const inventoryBlockReasonLabels: Record<InventoryBlockReason, string> = {
  mantenimiento: "Mantenimiento",
  reserva_interna: "Reserva interna",
  apartado: "Apartado",
  otro: "Otro",
};

const productCategories = categories.filter(
  (category) => category !== "Todos",
) as Product["category"][];

const emptyProductDraft: ProductDraft = {
  name: "",
  category: "Sonido",
  totalUnits: 1,
  maintenanceUnits: 0,
  pricePerDay: 10000,
  imageUrl: "",
  specs: "",
  tagsText: "",
};

export default function AdminWorkspace({
  initialBookings,
  initialInventoryBlocks,
  initialManualAvailability,
  initialProducts,
  initialSystemStatus,
}: {
  initialBookings: AdminBooking[];
  initialInventoryBlocks: InventoryBlock[];
  initialManualAvailability: ProductAvailability[];
  initialProducts: Product[];
  initialSystemStatus: AdminSystemStatus;
}) {
  const router = useRouter();
  const defaultRentalWindow = getDefaultRentalWindow();
  const [bookings, setBookings] = useState(initialBookings);
  const [inventoryBlocks, setInventoryBlocks] = useState(initialInventoryBlocks);
  const [manualAvailability, setManualAvailability] = useState(
    initialManualAvailability,
  );
  const [manualAvailabilityLoading, setManualAvailabilityLoading] =
    useState(false);
  const [manualAvailabilityError, setManualAvailabilityError] = useState<
    string | null
  >(null);
  const [products, setProducts] = useState(initialProducts);
  const [manualBooking, setManualBooking] = useState<ManualBookingForm>(() => ({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    window: defaultRentalWindow,
    items: [{ productId: initialProducts[0]?.id ?? "", quantity: 1 }],
  }));
  const [newInventoryBlock, setNewInventoryBlock] =
    useState<InventoryBlockDraft>(() => ({
      productId: initialProducts[0]?.id ?? "",
      quantity: 1,
      window: defaultRentalWindow,
      reason: "mantenimiento",
      note: "",
    }));
  const [productDrafts, setProductDrafts] = useState(() =>
    Object.fromEntries(
      initialProducts.map((product) => [
        product.id,
        productToDraft(product),
      ]),
    ) as Record<string, ProductDraft>,
  );
  const [newProduct, setNewProduct] = useState<ProductDraft>(emptyProductDraft);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const [creatingBooking, setCreatingBooking] = useState(false);
  const [creatingInventoryBlock, setCreatingInventoryBlock] = useState(false);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [agendaStart, setAgendaStart] = useState(() =>
    getInitialAgendaStart(initialBookings),
  );
  const [agendaDays, setAgendaDays] = useState(7);
  const [bookingQuery, setBookingQuery] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] =
    useState<BookingStatusFilter>("todos");
  const [bookingBalanceFilter, setBookingBalanceFilter] =
    useState<BookingBalanceFilter>("todos");
  const [bookingStartFilter, setBookingStartFilter] = useState("");
  const [bookingEndFilter, setBookingEndFilter] = useState("");
  const manualAvailabilityRequestId = useRef(0);

  const stats = useMemo(() => {
    const pendingBookings = bookings.filter(
      (booking) => booking.status === "pendiente",
    );
    const expectedDeposits = pendingBookings.reduce(
      (total, booking) => total + booking.deposit,
      0,
    );
    const maintenanceUnits = products.reduce(
      (total, product) => total + product.maintenanceUnits,
      0,
    );
    const blockedUnits = inventoryBlocks.reduce(
      (total, block) => total + block.quantity,
      0,
    );

    const activeBookings = bookings.filter((booking) =>
      activeFinancialStatuses.has(booking.status),
    );
    const billedTotal = activeBookings.reduce(
      (total, booking) => total + booking.totalDue,
      0,
    );
    const paidTotal = activeBookings.reduce(
      (total, booking) => total + booking.paidTotal,
      0,
    );
    const balanceDue = activeBookings.reduce(
      (total, booking) => total + booking.balanceDue,
      0,
    );
    const extraCharges = activeBookings.reduce(
      (total, booking) => total + booking.extraCharges,
      0,
    );
    const overdueReturns = activeBookings.filter(isOverdueReturn).length;

    return {
      bookings: bookings.length,
      pendingBookings: pendingBookings.length,
      expectedDeposits,
      maintenanceUnits,
      blockedUnits,
      billedTotal,
      paidTotal,
      balanceDue,
      extraCharges,
      overdueReturns,
    };
  }, [bookings, inventoryBlocks, products]);

  const manualAvailabilityByProduct = useMemo(
    () =>
      new Map(
        manualAvailability.map((product) => [product.id, product]),
      ),
    [manualAvailability],
  );
  const requestedUnitsByProduct = useMemo(() => {
    const requestedUnits = new Map<string, number>();

    manualBooking.items.forEach((item) => {
      if (!item.productId || item.quantity <= 0) {
        return;
      }

      requestedUnits.set(
        item.productId,
        (requestedUnits.get(item.productId) ?? 0) + item.quantity,
      );
    });

    return requestedUnits;
  }, [manualBooking.items]);
  const manualBookingItems = manualBooking.items.map((item) => {
    const product = products.find(
      (currentProduct) => currentProduct.id === item.productId,
    );
    const availability = manualAvailabilityByProduct.get(item.productId);
    const availableUnits = availability
      ? availability.availableUnits
      : getFallbackAvailableUnits(product);
    const requestedUnits = requestedUnitsByProduct.get(item.productId) ?? 0;

    return {
      ...item,
      product,
      availability,
      availableUnits,
      requestedUnits,
      exceedsAvailability: requestedUnits > availableUnits,
    };
  });
  const manualAvailabilityConflicts = useMemo(
    () =>
      Array.from(requestedUnitsByProduct.entries())
        .map(([productId, requestedUnits]) => {
          const product = products.find(
            (currentProduct) => currentProduct.id === productId,
          );
          const availability = manualAvailabilityByProduct.get(productId);
          const availableUnits = availability
            ? availability.availableUnits
            : getFallbackAvailableUnits(product);

          return {
            productId,
            productName: product?.name ?? "Equipo",
            requestedUnits,
            availableUnits,
          };
        })
        .filter((item) => item.requestedUnits > item.availableUnits),
    [manualAvailabilityByProduct, products, requestedUnitsByProduct],
  );
  const manualRentalDays = getRentalDays(manualBooking.window);
  const manualSubtotal = manualBookingItems.reduce(
    (total, item) =>
      total + (item.product?.pricePerDay ?? 0) * item.quantity * manualRentalDays,
    0,
  );
  const manualDeposit = Math.ceil(manualSubtotal * 0.3);
  const canCreateManualBooking =
    !creatingBooking &&
    !manualAvailabilityLoading &&
    manualAvailabilityError === null &&
    manualAvailabilityConflicts.length === 0 &&
    manualBooking.customerName.trim().length > 0 &&
    manualBooking.customerPhone.trim().length > 0 &&
    isValidRentalWindow(manualBooking.window) &&
    manualBooking.items.length > 0 &&
    manualBooking.items.every((item) => item.productId && item.quantity > 0);
  const agenda = useMemo(
    () => buildAgenda(bookings, agendaStart, agendaDays),
    [agendaDays, agendaStart, bookings],
  );
  const filteredBookings = useMemo(
    () =>
      bookings.filter((booking) =>
        doesBookingMatchFilters(
          booking,
          bookingQuery,
          bookingStatusFilter,
          bookingBalanceFilter,
          bookingStartFilter,
          bookingEndFilter,
        ),
      ),
    [
      bookingBalanceFilter,
      bookingEndFilter,
      bookingQuery,
      bookingStartFilter,
      bookingStatusFilter,
      bookings,
    ],
  );
  const hasBookingFilters =
    bookingQuery.trim().length > 0 ||
    bookingStatusFilter !== "todos" ||
    bookingBalanceFilter !== "todos" ||
    bookingStartFilter !== "" ||
    bookingEndFilter !== "";
  const canCreateInventoryBlock =
    !creatingInventoryBlock &&
    newInventoryBlock.productId.trim().length > 0 &&
    newInventoryBlock.quantity > 0 &&
    isValidRentalWindow(newInventoryBlock.window);
  const canCreateProduct =
    !creatingProduct && isProductDraftReady(newProduct);

  function updateManualCustomer(
    field: "customerName" | "customerPhone" | "customerEmail",
    value: string,
  ) {
    setManualBooking((current) => ({ ...current, [field]: value }));
    setSaveState({ status: "idle" });
  }

  function updateManualWindow(field: keyof RentalWindow, value: string) {
    const nextWindow = {
      ...manualBooking.window,
      [field]: value,
    };

    setManualBooking((current) => ({
      ...current,
      window: nextWindow,
    }));
    setSaveState({ status: "idle" });
    void refreshManualAvailability(nextWindow);
  }

  async function refreshManualAvailability(window: RentalWindow) {
    const requestId = manualAvailabilityRequestId.current + 1;
    manualAvailabilityRequestId.current = requestId;
    setManualAvailabilityError(null);

    if (!isValidRentalWindow(window)) {
      setManualAvailabilityLoading(false);
      return;
    }

    setManualAvailabilityLoading(true);

    try {
      const params = new URLSearchParams({
        start: window.start,
        end: window.end,
      });
      const response = await fetch(`/api/rentals?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as {
        products?: ProductAvailability[];
      };

      if (!response.ok || !data.products) {
        throw new Error("No se pudo actualizar el stock.");
      }

      if (manualAvailabilityRequestId.current !== requestId) {
        return;
      }

      setManualAvailability(data.products);
    } catch (error) {
      if (manualAvailabilityRequestId.current !== requestId) {
        return;
      }

      setManualAvailabilityError(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el stock.",
      );
    } finally {
      if (manualAvailabilityRequestId.current === requestId) {
        setManualAvailabilityLoading(false);
      }
    }
  }

  function updateManualItem(
    index: number,
    field: keyof ManualBookingItem,
    value: string,
  ) {
    setManualBooking((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]:
                field === "quantity"
                  ? Math.max(1, Number.parseInt(value, 10) || 1)
                  : value,
            }
          : item,
      ),
    }));
    setSaveState({ status: "idle" });
  }

  function addManualItem() {
    setManualBooking((current) => ({
      ...current,
      items: [...current.items, { productId: products[0]?.id ?? "", quantity: 1 }],
    }));
    setSaveState({ status: "idle" });
  }

  function removeManualItem(index: number) {
    setManualBooking((current) => ({
      ...current,
      items:
        current.items.length === 1
          ? current.items
          : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
    setSaveState({ status: "idle" });
  }

  async function createManualBooking() {
    if (!canCreateManualBooking) {
      return;
    }

    setCreatingBooking(true);
    setSaveState({ status: "idle" });

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            name: manualBooking.customerName,
            phone: manualBooking.customerPhone,
            email: manualBooking.customerEmail,
          },
          start: manualBooking.window.start,
          end: manualBooking.window.end,
          items: manualBooking.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        }),
      });
      const data = (await response.json()) as {
        booking?: AdminBooking;
        error?: string;
      };

      if (!response.ok || !data.booking) {
        throw new Error(data.error ?? "No se pudo crear la reserva.");
      }

      setBookings((current) => sortBookings([...current, data.booking as AdminBooking]));
      setManualBooking({
        customerName: "",
        customerPhone: "",
        customerEmail: "",
        window: defaultRentalWindow,
        items: [{ productId: products[0]?.id ?? "", quantity: 1 }],
      });
      void refreshManualAvailability(defaultRentalWindow);
      setSaveState({
        status: "success",
        message: `Reserva ${data.booking.id} creada.`,
      });
    } catch (error) {
      setSaveState({
        status: "error",
        message:
          error instanceof Error ? error.message : "No se pudo crear la reserva.",
      });
    } finally {
      setCreatingBooking(false);
    }
  }

  async function updateStatus(bookingId: string, status: BookingStatus) {
    const previousBookings = bookings;
    setSavingKey(`booking:${bookingId}`);
    setSaveState({ status: "idle" });
    setBookings((current) =>
      current.map((booking) =>
        booking.id === bookingId ? { ...booking, status } : booking,
      ),
    );

    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await response.json()) as {
        booking?: AdminBooking;
        error?: string;
      };

      if (!response.ok || !data.booking) {
        throw new Error(data.error ?? "No se pudo actualizar la reserva.");
      }

      setBookings((current) =>
        current.map((booking) =>
          booking.id === bookingId ? data.booking ?? booking : booking,
        ),
      );
      void refreshManualAvailability(manualBooking.window);
      setSaveState({ status: "success", message: "Reserva actualizada." });
    } catch (error) {
      setBookings(previousBookings);
      setSaveState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar la reserva.",
      });
    } finally {
      setSavingKey(null);
    }
  }

  function updateInventoryBlock(
    field: "productId" | "quantity" | "reason" | "note",
    value: string,
  ) {
    setNewInventoryBlock((current) => ({
      ...current,
      [field]:
        field === "quantity"
          ? Math.max(1, Number.parseInt(value, 10) || 1)
          : field === "reason"
            ? (value as InventoryBlockReason)
            : value,
    }));
    setSaveState({ status: "idle" });
  }

  function updateInventoryBlockWindow(field: keyof RentalWindow, value: string) {
    setNewInventoryBlock((current) => ({
      ...current,
      window: {
        ...current.window,
        [field]: value,
      },
    }));
    setSaveState({ status: "idle" });
  }

  async function createInventoryBlock() {
    if (!canCreateInventoryBlock) {
      return;
    }

    setCreatingInventoryBlock(true);
    setSaveState({ status: "idle" });

    try {
      const response = await fetch("/api/inventory-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: newInventoryBlock.productId,
          quantity: newInventoryBlock.quantity,
          start: newInventoryBlock.window.start,
          end: newInventoryBlock.window.end,
          reason: newInventoryBlock.reason,
          note: newInventoryBlock.note,
        }),
      });
      const data = (await response.json()) as {
        block?: InventoryBlock;
        error?: string;
      };

      if (!response.ok || !data.block) {
        throw new Error(data.error ?? "No se pudo crear el bloqueo.");
      }

      setInventoryBlocks((current) =>
        sortInventoryBlocks([...current, data.block as InventoryBlock]),
      );
      void refreshManualAvailability(manualBooking.window);
      setNewInventoryBlock((current) => ({
        ...current,
        quantity: 1,
        note: "",
      }));
      setSaveState({
        status: "success",
        message: `Bloqueo ${data.block.id} creado.`,
      });
    } catch (error) {
      setSaveState({
        status: "error",
        message:
          error instanceof Error ? error.message : "No se pudo crear el bloqueo.",
      });
    } finally {
      setCreatingInventoryBlock(false);
    }
  }

  async function removeInventoryBlock(blockId: string) {
    setSavingKey(`block:${blockId}`);
    setSaveState({ status: "idle" });

    try {
      const response = await fetch(`/api/inventory-blocks/${blockId}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as {
        block?: { id: string };
        error?: string;
      };

      if (!response.ok || !data.block) {
        throw new Error(data.error ?? "No se pudo eliminar el bloqueo.");
      }

      setInventoryBlocks((current) =>
        current.filter((block) => block.id !== data.block?.id),
      );
      void refreshManualAvailability(manualBooking.window);
      setSaveState({ status: "success", message: "Bloqueo eliminado." });
    } catch (error) {
      setSaveState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo eliminar el bloqueo.",
      });
    } finally {
      setSavingKey(null);
    }
  }

  function updateProductDraft(
    productId: string,
    field: keyof ProductDraft,
    value: string,
  ) {
    setProductDrafts((current) => ({
      ...current,
      [productId]: {
        ...current[productId],
        [field]: normalizeDraftValue(field, value),
      },
    }));
    setSaveState({ status: "idle" });
  }

  function updateNewProduct(field: keyof ProductDraft, value: string) {
    setNewProduct((current) => ({
      ...current,
      [field]: normalizeDraftValue(field, value),
    }));
    setSaveState({ status: "idle" });
  }

  async function createProduct() {
    if (!canCreateProduct) {
      return;
    }

    setCreatingProduct(true);
    setSaveState({ status: "idle" });

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productDraftToPayload(newProduct)),
      });
      const data = (await response.json()) as {
        product?: Product;
        error?: string;
      };

      if (!response.ok || !data.product) {
        throw new Error(data.error ?? "No se pudo crear el equipo.");
      }

      setProducts((current) => [...current, data.product as Product]);
      setProductDrafts((current) => ({
        ...current,
        [data.product?.id ?? ""]: productToDraft(data.product as Product),
      }));
      void refreshManualAvailability(manualBooking.window);
      setNewProduct(emptyProductDraft);
      setSaveState({
        status: "success",
        message: `Equipo ${data.product.name} creado.`,
      });
    } catch (error) {
      setSaveState({
        status: "error",
        message:
          error instanceof Error ? error.message : "No se pudo crear el equipo.",
      });
    } finally {
      setCreatingProduct(false);
    }
  }

  async function saveProduct(productId: string) {
    const draft = productDrafts[productId];

    if (!draft) {
      return;
    }

    setSavingKey(`product:${productId}`);
    setSaveState({ status: "idle" });

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productDraftToPayload(draft)),
      });
      const data = (await response.json()) as {
        product?: Product;
        error?: string;
      };

      if (!response.ok || !data.product) {
        throw new Error(data.error ?? "No se pudo actualizar el equipo.");
      }

      setProducts((current) =>
        current.map((product) =>
          product.id === productId ? data.product ?? product : product,
        ),
      );
      setProductDrafts((current) => ({
        ...current,
        [productId]: productToDraft(data.product as Product),
      }));
      void refreshManualAvailability(manualBooking.window);
      setSaveState({ status: "success", message: "Equipo actualizado." });
    } catch (error) {
      setSaveState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar el equipo.",
      });
    } finally {
      setSavingKey(null);
    }
  }

  function clearBookingFilters() {
    setBookingQuery("");
    setBookingStatusFilter("todos");
    setBookingBalanceFilter("todos");
    setBookingStartFilter("");
    setBookingEndFilter("");
  }

  function exportFilteredBookings() {
    if (filteredBookings.length === 0) {
      setSaveState({
        status: "error",
        message: "No hay reservas para exportar.",
      });
      return;
    }

    downloadCsv(
      `mb-systems-reservas-${toDateKey(new Date())}.csv`,
      buildBookingsCsv(filteredBookings),
    );
    setSaveState({
      status: "success",
      message: `${filteredBookings.length} reservas exportadas.`,
    });
  }

  async function signOut() {
    setSigningOut(true);

    try {
      await fetch("/api/admin/session", { method: "DELETE" });
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 transition hover:text-cyan-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver
              </Link>
              <div className="mt-3">
                <BrandMark compact />
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
                Panel admin
              </h1>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <button
                type="button"
                onClick={() => void signOut()}
                disabled={signingOut}
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" />
                {signingOut ? "Saliendo" : "Salir"}
              </button>
              <AdminStat label="Reservas" value={`${stats.bookings}`} />
              <AdminStat label="Pendientes" value={`${stats.pendingBookings}`} />
              <AdminStat
                label="Anticipos"
                value={currencyFormatter.format(stats.expectedDeposits)}
              />
              <AdminStat label="Bloqueadas" value={`${stats.blockedUnits}`} />
              <AdminStat label="En taller" value={`${stats.maintenanceUnits}`} />
            </div>
          </div>

          {saveState.status !== "idle" ? (
            <div
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${
                saveState.status === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              {saveState.message}
            </div>
          ) : null}
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <AdminStat
            label="Facturado"
            value={currencyFormatter.format(stats.billedTotal)}
          />
          <AdminStat
            label="Cobrado"
            value={currencyFormatter.format(stats.paidTotal)}
          />
          <AdminStat
            label="Por cobrar"
            value={currencyFormatter.format(stats.balanceDue)}
          />
          <AdminStat
            label="Cargos"
            value={currencyFormatter.format(stats.extraCharges)}
          />
          <AdminStat label="Vencidas" value={`${stats.overdueReturns}`} />
        </div>

        <SystemStatusPanel status={initialSystemStatus} />

        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-4 lg:flex-row lg:items-center">
            <div>
              <p className="text-sm font-semibold text-slate-500">Agenda</p>
              <h2 className="text-xl font-semibold text-slate-950">
                Operacion por dia
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-[180px_120px]">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Desde
                <input
                  type="date"
                  value={agendaStart}
                  onChange={(event) => setAgendaStart(event.target.value)}
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Dias
                <select
                  value={agendaDays}
                  onChange={(event) => setAgendaDays(Number(event.target.value))}
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                >
                  <option value={3}>3</option>
                  <option value={7}>7</option>
                  <option value={14}>14</option>
                </select>
              </label>
            </div>
          </div>

          <div className="grid gap-3 p-4 lg:grid-cols-2 2xl:grid-cols-4">
            {agenda.map((day) => (
              <article
                key={day.dateKey}
                className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      {day.label}
                    </p>
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                      {day.shortLabel}
                    </p>
                  </div>
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${
                      day.totalEvents > 0
                        ? "bg-cyan-50 text-cyan-800"
                        : "bg-white text-slate-500"
                    }`}
                  >
                    {day.totalEvents}
                  </span>
                </div>

                <div className="mt-3 grid gap-3">
                  <AgendaGroup title="Retiran" events={day.pickups} tone="pickup" />
                  <AgendaGroup title="Devuelven" events={day.returns} tone="return" />
                  <AgendaGroup title="Activas" events={day.active} tone="active" />
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">Carga manual</p>
              <h2 className="text-xl font-semibold text-slate-950">
                Nueva reserva
              </h2>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-50 text-cyan-800">
              <Plus className="h-5 w-5" />
            </span>
          </div>

          <div className="grid gap-5 p-4 xl:grid-cols-[1.1fr_1fr_280px]">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Cliente
                <input
                  value={manualBooking.customerName}
                  onChange={(event) =>
                    updateManualCustomer("customerName", event.target.value)
                  }
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                WhatsApp
                <input
                  value={manualBooking.customerPhone}
                  onChange={(event) =>
                    updateManualCustomer("customerPhone", event.target.value)
                  }
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
                Email opcional
                <input
                  type="email"
                  value={manualBooking.customerEmail}
                  onChange={(event) =>
                    updateManualCustomer("customerEmail", event.target.value)
                  }
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Retiro
                <input
                  type="datetime-local"
                  value={manualBooking.window.start}
                  onChange={(event) =>
                    updateManualWindow("start", event.target.value)
                  }
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Devolucion
                <input
                  type="datetime-local"
                  value={manualBooking.window.end}
                  onChange={(event) => updateManualWindow("end", event.target.value)}
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                />
              </label>
            </div>

            <div className="grid gap-3">
              {manualBookingItems.map((item, index) => (
                <div
                  key={`${index}-${item.productId}`}
                  className={`grid gap-2 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_88px_120px_40px] ${
                    item.exceedsAvailability
                      ? "border-rose-200 bg-rose-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
                    Equipo
                    <select
                      value={item.productId}
                      onChange={(event) =>
                        updateManualItem(index, "productId", event.target.value)
                      }
                      className="h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                    >
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
                    Cantidad
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(event) =>
                        updateManualItem(index, "quantity", event.target.value)
                      }
                      className="h-10 w-full min-w-0 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                    />
                  </label>
                  <div className="grid min-w-0 content-end gap-1 text-sm">
                    <p className="font-medium text-slate-700">Disponibles</p>
                    <p
                      className={`flex h-10 items-center rounded-md border px-3 font-semibold ${
                        item.exceedsAvailability
                          ? "border-rose-200 bg-white text-rose-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-800"
                      }`}
                    >
                      {manualAvailabilityLoading ? "..." : item.availableUnits}
                    </p>
                  </div>
                  <button
                    type="button"
                    title="Quitar equipo"
                    onClick={() => removeManualItem(index)}
                    disabled={manualBooking.items.length === 1}
                    className="flex h-10 w-10 items-center justify-center self-end rounded-md border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  {item.exceedsAvailability ? (
                    <p className="text-sm font-medium text-rose-700 sm:col-span-4">
                      Pediste {item.requestedUnits} y quedan {item.availableUnits} para
                      esas fechas.
                    </p>
                  ) : null}
                </div>
              ))}

              <button
                type="button"
                onClick={addManualItem}
                className="flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" />
                Agregar equipo
              </button>
            </div>

            <div className="grid content-between gap-4 rounded-md border border-slate-200 bg-slate-50 p-4">
              <div className="space-y-2 text-sm">
                <SummaryRow
                  label="Duracion"
                  value={`${manualRentalDays} dia${manualRentalDays > 1 ? "s" : ""}`}
                />
                <SummaryRow
                  label="Subtotal"
                  value={currencyFormatter.format(manualSubtotal)}
                />
                <SummaryRow
                  label="Anticipo 30%"
                  value={currencyFormatter.format(manualDeposit)}
                />
                <SummaryRow
                  label="Saldo"
                  value={currencyFormatter.format(manualSubtotal - manualDeposit)}
                />
              </div>

              <div className="grid gap-2">
                {manualAvailabilityLoading ? (
                  <p className="rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-800">
                    Actualizando stock.
                  </p>
                ) : null}
                {manualAvailabilityError ? (
                  <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                    {manualAvailabilityError}
                  </p>
                ) : null}
                {manualAvailabilityConflicts.map((conflict) => (
                  <p
                    key={conflict.productId}
                    className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700"
                  >
                    {conflict.productName}: pediste {conflict.requestedUnits},
                    quedan {conflict.availableUnits}.
                  </p>
                ))}
              </div>

              <button
                type="button"
                onClick={() => void createManualBooking()}
                disabled={!canCreateManualBooking}
                className="flex h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <CheckCircle2 className="h-4 w-4" />
                {creatingBooking ? "Creando" : "Crear reserva"}
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">Operacion</p>
              <h2 className="text-xl font-semibold text-slate-950">
                Reservas cargadas
              </h2>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-50 text-cyan-800">
              <ClipboardList className="h-5 w-5" />
            </span>
          </div>

          <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-4 xl:grid-cols-[minmax(0,1fr)_150px_150px_150px_150px_150px]">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Busqueda
              <span className="flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={bookingQuery}
                  onChange={(event) => setBookingQuery(event.target.value)}
                  placeholder="Cliente, telefono, equipo o ID"
                  className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-950 outline-none"
                />
              </span>
            </label>

            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Estado
              <select
                value={bookingStatusFilter}
                onChange={(event) =>
                  setBookingStatusFilter(event.target.value as BookingStatusFilter)
                }
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              >
                <option value="todos">Todos</option>
                {bookingStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Saldo
              <select
                value={bookingBalanceFilter}
                onChange={(event) =>
                  setBookingBalanceFilter(
                    event.target.value as BookingBalanceFilter,
                  )
                }
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              >
                {Object.entries(balanceFilterLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Desde
              <input
                type="date"
                value={bookingStartFilter}
                onChange={(event) => setBookingStartFilter(event.target.value)}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              />
            </label>

            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Hasta
              <input
                type="date"
                value={bookingEndFilter}
                onChange={(event) => setBookingEndFilter(event.target.value)}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              />
            </label>

            <div className="grid content-end gap-1">
              <p className="flex items-center gap-1 text-sm font-medium text-slate-500">
                <Filter className="h-4 w-4" />
                {filteredBookings.length}/{bookings.length}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={exportFilteredBookings}
                  disabled={filteredBookings.length === 0}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  CSV
                </button>
                <button
                  type="button"
                  onClick={clearBookingFilters}
                  disabled={!hasBookingFilters}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                  Limpiar
                </button>
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-200">
            {filteredBookings.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">
                Sin reservas para estos filtros.
              </div>
            ) : null}
            {filteredBookings.map((booking) => (
              <article
                key={booking.id}
                className="grid gap-4 p-4 xl:grid-cols-[1.1fr_1fr_1fr_170px_190px]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-950">
                      {booking.clientName}
                    </h3>
                    <span
                      className={`rounded-md border px-2 py-1 text-xs font-semibold ${statusStyles[booking.status]}`}
                    >
                      {booking.status}
                    </span>
                  </div>
                  <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                    <Phone className="h-4 w-4 text-slate-400" />
                    {booking.clientPhone}
                  </p>
                </div>

                <div className="text-sm text-slate-600">
                  <p className="flex items-center gap-2 font-medium text-slate-800">
                    <CalendarDays className="h-4 w-4 text-slate-400" />
                    Retiro
                  </p>
                  <p className="mt-1">{formatDate(booking.start)}</p>
                  <p className="mt-2 font-medium text-slate-800">Devolucion</p>
                  <p className="mt-1">{formatDate(booking.end)}</p>
                </div>

                <div className="text-sm text-slate-600">
                  <p className="font-medium text-slate-800">Equipos</p>
                  <div className="mt-1 space-y-1">
                    {booking.items.map((item) => (
                      <p key={item.productId}>
                        {item.quantity} x {item.productName}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="text-sm text-slate-600">
                  <p className="flex items-center gap-2 font-medium text-slate-800">
                    <CircleDollarSign className="h-4 w-4 text-slate-400" />
                    Total
                  </p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {currencyFormatter.format(booking.totalDue)}
                  </p>
                  {booking.extraCharges > 0 ? (
                    <p className="mt-2 text-slate-500">
                      Cargos {currencyFormatter.format(booking.extraCharges)}
                    </p>
                  ) : null}
                  <p className="mt-2 text-slate-500">
                    Anticipo {currencyFormatter.format(booking.deposit)}
                  </p>
                  <p className="mt-1 text-slate-500">
                    Pagado {currencyFormatter.format(booking.paidTotal)}
                  </p>
                  <p className="mt-1 text-slate-500">
                    Saldo {currencyFormatter.format(booking.balanceDue)}
                  </p>
                </div>

                <div className="grid content-start gap-2 text-sm font-medium text-slate-700">
                  Estado
                  <select
                    value={booking.status}
                    disabled={savingKey === `booking:${booking.id}`}
                    onChange={(event) =>
                      void updateStatus(
                        booking.id,
                        event.target.value as BookingStatus,
                      )
                    }
                    className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    {bookingStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <Link
                    href={`/admin/bookings/${booking.id}`}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-800"
                  >
                    <FileText className="h-4 w-4" />
                    Detalle
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Disponibilidad
              </p>
              <h2 className="text-xl font-semibold text-slate-950">
                Bloqueos manuales
              </h2>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-50 text-cyan-800">
              <CalendarOff className="h-5 w-5" />
            </span>
          </div>

          <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-4 xl:grid-cols-[minmax(0,1fr)_110px_180px_180px_170px_minmax(0,1fr)_140px]">
            <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
              Equipo
              <select
                value={newInventoryBlock.productId}
                onChange={(event) =>
                  updateInventoryBlock("productId", event.target.value)
                }
                className="h-10 min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Cantidad
              <input
                type="number"
                min={1}
                value={newInventoryBlock.quantity}
                onChange={(event) =>
                  updateInventoryBlock("quantity", event.target.value)
                }
                className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              />
            </label>

            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Desde
              <input
                type="datetime-local"
                value={newInventoryBlock.window.start}
                onChange={(event) =>
                  updateInventoryBlockWindow("start", event.target.value)
                }
                className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              />
            </label>

            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Hasta
              <input
                type="datetime-local"
                value={newInventoryBlock.window.end}
                onChange={(event) =>
                  updateInventoryBlockWindow("end", event.target.value)
                }
                className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              />
            </label>

            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Motivo
              <select
                value={newInventoryBlock.reason}
                onChange={(event) =>
                  updateInventoryBlock("reason", event.target.value)
                }
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              >
                {inventoryBlockReasons.map((reason) => (
                  <option key={reason} value={reason}>
                    {inventoryBlockReasonLabels[reason]}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
              Nota
              <input
                value={newInventoryBlock.note}
                onChange={(event) =>
                  updateInventoryBlock("note", event.target.value)
                }
                placeholder="Service, sena interna..."
                className="h-10 min-w-0 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              />
            </label>

            <button
              type="button"
              onClick={() => void createInventoryBlock()}
              disabled={!canCreateInventoryBlock}
              className="flex h-10 items-center justify-center gap-2 self-end rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Plus className="h-4 w-4" />
              {creatingInventoryBlock ? "Creando" : "Bloquear"}
            </button>
          </div>

          <div className="divide-y divide-slate-200">
            {inventoryBlocks.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">
                Sin bloqueos manuales cargados.
              </div>
            ) : null}
            {inventoryBlocks.map((block) => (
              <article
                key={block.id}
                className="grid gap-4 p-4 xl:grid-cols-[1.1fr_1fr_150px_1fr_120px]"
              >
                <div>
                  <p className="font-semibold text-slate-950">
                    {block.productName}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{block.id}</p>
                </div>

                <div className="text-sm text-slate-600">
                  <p className="font-medium text-slate-800">Rango</p>
                  <p className="mt-1">{formatDate(block.start)}</p>
                  <p className="mt-1">{formatDate(block.end)}</p>
                </div>

                <div className="text-sm text-slate-600">
                  <p className="font-medium text-slate-800">Unidades</p>
                  <p className="mt-1 text-base font-semibold text-slate-950">
                    {block.quantity}
                  </p>
                  <span className="mt-2 inline-flex rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-800">
                    {inventoryBlockReasonLabels[block.reason]}
                  </span>
                </div>

                <div className="text-sm text-slate-600">
                  <p className="font-medium text-slate-800">Nota</p>
                  <p className="mt-1">{block.note ?? "Sin nota"}</p>
                </div>

                <button
                  type="button"
                  title={`Liberar ${block.productName}`}
                  onClick={() => void removeInventoryBlock(block.id)}
                  disabled={savingKey === `block:${block.id}`}
                  className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Liberar
                </button>
              </article>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">Catalogo</p>
              <h2 className="text-xl font-semibold text-slate-950">
                Equipos, precios y stock
              </h2>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-50 text-cyan-800">
              <Wrench className="h-5 w-5" />
            </span>
          </div>

          <div className="border-b border-slate-200 bg-slate-50 p-4">
            <div className="rounded-md border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-slate-950">Nuevo equipo</h3>
                <button
                  type="button"
                  onClick={() => void createProduct()}
                  disabled={!canCreateProduct}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Plus className="h-4 w-4" />
                  {creatingProduct ? "Creando" : "Crear"}
                </button>
              </div>
              <ProductDraftFields draft={newProduct} onChange={updateNewProduct} />
            </div>
          </div>

          <div className="divide-y divide-slate-200">
            {products.map((product) => {
              const draft = productDrafts[product.id] ?? productToDraft(product);

              return (
                <article key={product.id} className="grid gap-4 p-4">
                  <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                    <div>
                      <p className="font-semibold text-slate-950">{product.name}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {product.id} - {product.category} -{" "}
                        {currencyFormatter.format(product.pricePerDay)} / dia
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void saveProduct(product.id)}
                      disabled={savingKey === `product:${product.id}`}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <Save className="h-4 w-4" />
                      Guardar
                    </button>
                  </div>

                  <ProductDraftFields
                    draft={draft}
                    onChange={(field, value) =>
                      updateProductDraft(product.id, field, value)
                    }
                  />
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}

function AdminStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function SystemStatusPanel({ status }: { status: AdminSystemStatus }) {
  const checks = [
    {
      label: "URL publica",
      ok: status.appUrl.configured,
      detail: status.appUrl.configured ? status.appUrl.value : "Falta NEXT_PUBLIC_APP_URL",
    },
    {
      label: "Mercado Pago",
      ok: status.mercadoPago.enabled,
      detail: status.mercadoPago.enabled
        ? status.mercadoPago.sandbox
          ? "Token sandbox activo"
          : "Token produccion activo"
        : "Falta MERCADO_PAGO_ACCESS_TOKEN",
    },
    {
      label: "Webhook",
      ok: status.appUrl.configured,
      detail: status.mercadoPago.webhookUrl || "Requiere URL publica HTTPS",
    },
    {
      label: "Firma webhook",
      ok: status.mercadoPago.webhookSecretConfigured,
      detail: status.mercadoPago.webhookSecretConfigured
        ? "Secreto configurado"
        : "Falta MERCADO_PAGO_WEBHOOK_SECRET",
    },
    {
      label: "WhatsApp negocio",
      ok: status.contact.businessWhatsAppConfigured,
      detail: status.contact.businessWhatsAppConfigured
        ? "Listo para mensajes"
        : "Falta NEXT_PUBLIC_BUSINESS_WHATSAPP",
    },
    {
      label: "Pago manual",
      ok: status.manualPayment.configured,
      detail: status.manualPayment.configured
        ? "Alias, CVU o link disponible"
        : "Sin fallback de pago manual",
    },
    {
      label: "PIN admin",
      ok: status.security.customAdminPin,
      detail: status.security.customAdminPin
        ? "PIN personalizado"
        : "Cambiar ADMIN_PIN antes de publicar",
    },
    {
      label: "Sesion admin",
      ok: status.security.sessionSecretConfigured,
      detail: status.security.sessionSecretConfigured
        ? "Secreto configurado"
        : "Falta ADMIN_SESSION_SECRET",
    },
  ];
  const readyCount = checks.filter((check) => check.ok).length;

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center">
        <div>
          <p className="text-sm font-semibold text-slate-500">Preparacion MVP</p>
          <h2 className="text-xl font-semibold text-slate-950">
            Configuracion y pagos
          </h2>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
          <CreditCard className="h-4 w-4 text-cyan-700" />
          {readyCount}/{checks.length} listo
        </div>
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
        {checks.map((check) => (
          <SystemStatusCheck
            key={check.label}
            detail={check.detail}
            label={check.label}
            ok={check.ok}
          />
        ))}
      </div>
    </div>
  );
}

function SystemStatusCheck({
  detail,
  label,
  ok,
}: {
  detail: string;
  label: string;
  ok: boolean;
}) {
  return (
    <div
      className={`rounded-md border px-3 py-2 text-sm ${
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-amber-200 bg-amber-50 text-amber-900"
      }`}
    >
      <div className="flex items-center gap-2">
        {ok ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-700" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-amber-700" />
        )}
        <p className="font-semibold">{label}</p>
      </div>
      <p className="mt-1 break-words leading-5">{detail}</p>
    </div>
  );
}

function ProductDraftFields({
  draft,
  onChange,
}: {
  draft: ProductDraft;
  onChange: (field: keyof ProductDraft, value: string) => void;
}) {
  const availableBase = Math.max(0, draft.totalUnits - draft.maintenanceUnits);

  return (
    <div className="mt-4 grid gap-3 xl:grid-cols-[1.1fr_160px_140px_110px_110px_90px]">
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Nombre
        <input
          value={draft.name}
          onChange={(event) => onChange("name", event.target.value)}
          className="h-10 min-w-0 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
        />
      </label>

      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Categoria
        <select
          value={draft.category}
          onChange={(event) => onChange("category", event.target.value)}
          className="h-10 min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
        >
          {productCategories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Precio dia
        <input
          type="number"
          min={1}
          value={draft.pricePerDay}
          onChange={(event) => onChange("pricePerDay", event.target.value)}
          className="h-10 min-w-0 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
        />
      </label>

      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Total
        <input
          type="number"
          min={0}
          value={draft.totalUnits}
          onChange={(event) => onChange("totalUnits", event.target.value)}
          className="h-10 min-w-0 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
        />
      </label>

      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Taller
        <input
          type="number"
          min={0}
          value={draft.maintenanceUnits}
          onChange={(event) => onChange("maintenanceUnits", event.target.value)}
          className="h-10 min-w-0 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
        />
      </label>

      <div className="grid content-end gap-1 text-sm text-slate-600">
        <p className="font-medium text-slate-800">Base</p>
        <p className="flex h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-3 font-semibold text-slate-950">
          {availableBase}
        </p>
      </div>

      <label className="grid gap-1 text-sm font-medium text-slate-700 xl:col-span-3">
        Imagen URL
        <input
          value={draft.imageUrl}
          onChange={(event) => onChange("imageUrl", event.target.value)}
          className="h-10 min-w-0 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
        />
      </label>

      <label className="grid gap-1 text-sm font-medium text-slate-700 xl:col-span-3">
        Tags
        <input
          value={draft.tagsText}
          onChange={(event) => onChange("tagsText", event.target.value)}
          placeholder="dmx, escenario, cableado"
          className="h-10 min-w-0 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
        />
      </label>

      <label className="grid gap-1 text-sm font-medium text-slate-700 xl:col-span-6">
        Descripcion
        <textarea
          value={draft.specs}
          rows={3}
          onChange={(event) => onChange("specs", event.target.value)}
          className="min-h-20 resize-y rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
        />
      </label>
    </div>
  );
}

function AgendaGroup({
  title,
  events,
  tone,
}: {
  title: string;
  events: AgendaEvent[];
  tone: "pickup" | "return" | "active";
}) {
  const toneClass = {
    pickup: "border-cyan-200 bg-cyan-50 text-cyan-800",
    return: "border-emerald-200 bg-emerald-50 text-emerald-800",
    active: "border-slate-200 bg-white text-slate-700",
  }[tone];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          {title}
        </p>
        <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${toneClass}`}>
          {events.length}
        </span>
      </div>

      {events.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-200 bg-white px-2 py-2 text-sm text-slate-400">
          Sin movimientos
        </p>
      ) : (
        <div className="grid gap-2">
          {events.map((event) => (
            <div
              key={`${event.bookingId}-${title}`}
              className="rounded-md border border-slate-200 bg-white p-2"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold text-slate-950">
                  {event.clientName}
                </p>
                <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
                  <Clock className="h-3.5 w-3.5" />
                  {event.time}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
                {event.itemsLabel}
              </p>
              <span
                className={`mt-2 inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${statusStyles[event.status]}`}
              >
                {event.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-950">{value}</span>
    </div>
  );
}

function productToDraft(product: Product): ProductDraft {
  return {
    name: product.name,
    category: product.category,
    totalUnits: product.totalUnits,
    maintenanceUnits: product.maintenanceUnits,
    pricePerDay: product.pricePerDay,
    imageUrl: product.imageUrl,
    specs: product.specs,
    tagsText: product.tags.join(", "),
  };
}

function productDraftToPayload(draft: ProductDraft) {
  return {
    name: draft.name,
    category: draft.category,
    totalUnits: draft.totalUnits,
    maintenanceUnits: draft.maintenanceUnits,
    pricePerDay: draft.pricePerDay,
    imageUrl: draft.imageUrl,
    specs: draft.specs,
    tags: parseTagsText(draft.tagsText),
  };
}

function normalizeDraftValue(field: keyof ProductDraft, value: string) {
  if (
    field === "totalUnits" ||
    field === "maintenanceUnits" ||
    field === "pricePerDay"
  ) {
    const parsedValue = Number.parseInt(value, 10);

    return Number.isNaN(parsedValue) ? 0 : parsedValue;
  }

  if (field === "category") {
    return value as Product["category"];
  }

  return value;
}

function isProductDraftReady(draft: ProductDraft) {
  return (
    draft.name.trim().length > 0 &&
    draft.imageUrl.trim().length > 0 &&
    draft.specs.trim().length > 0 &&
    draft.pricePerDay > 0 &&
    draft.totalUnits >= 0 &&
    draft.maintenanceUnits >= 0 &&
    draft.maintenanceUnits <= draft.totalUnits
  );
}

function getFallbackAvailableUnits(product: Product | undefined) {
  if (!product) {
    return 0;
  }

  return Math.max(0, product.totalUnits - product.maintenanceUnits);
}

function parseTagsText(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function doesBookingMatchFilters(
  booking: AdminBooking,
  query: string,
  statusFilter: BookingStatusFilter,
  balanceFilter: BookingBalanceFilter,
  startFilter: string,
  endFilter: string,
) {
  if (statusFilter !== "todos" && booking.status !== statusFilter) {
    return false;
  }

  if (balanceFilter === "con_saldo" && booking.balanceDue <= 0) {
    return false;
  }

  if (balanceFilter === "saldadas" && booking.balanceDue > 0) {
    return false;
  }

  if (balanceFilter === "con_cargos" && booking.extraCharges <= 0) {
    return false;
  }

  const bookingStartDate = booking.start.slice(0, 10);

  if (startFilter && bookingStartDate < startFilter) {
    return false;
  }

  if (endFilter && bookingStartDate > endFilter) {
    return false;
  }

  const normalizedQuery = normalizeSearchValue(query);

  if (!normalizedQuery) {
    return true;
  }

  const searchableValue = normalizeSearchValue(
    [
      booking.id,
      booking.clientName,
      booking.clientPhone,
      booking.clientEmail ?? "",
      booking.status,
      ...booking.items.map((item) => item.productName),
    ].join(" "),
  );

  return searchableValue.includes(normalizedQuery);
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

function isOverdueReturn(booking: AdminBooking) {
  if (booking.status !== "retirado") {
    return false;
  }

  return new Date(booking.end).getTime() < Date.now();
}

function buildAgenda(
  bookings: AdminBooking[],
  startDateKey: string,
  days: number,
): AgendaDay[] {
  const startDate = parseDateKey(startDateKey);

  return Array.from({ length: days }, (_, index) => {
    const date = addDays(startDate, index);
    const dateKey = toDateKey(date);
    const dayStart = new Date(`${dateKey}T00:00:00`);
    const dayEnd = new Date(`${dateKey}T23:59:59`);
    const pickups: AgendaEvent[] = [];
    const returns: AgendaEvent[] = [];
    const active: AgendaEvent[] = [];

    bookings
      .filter((booking) => operationalStatuses.has(booking.status))
      .forEach((booking) => {
        const startsToday = booking.start.slice(0, 10) === dateKey;
        const endsToday = booking.end.slice(0, 10) === dateKey;
        const bookingStart = new Date(booking.start);
        const bookingEnd = new Date(booking.end);

        if (startsToday) {
          pickups.push(toAgendaEvent(booking, booking.start));
        }

        if (endsToday) {
          returns.push(toAgendaEvent(booking, booking.end));
        }

        if (
          !startsToday &&
          !endsToday &&
          bookingStart <= dayEnd &&
          bookingEnd >= dayStart
        ) {
          active.push(toAgendaEvent(booking, booking.start));
        }
      });

    const sortedPickups = sortAgendaEvents(pickups);
    const sortedReturns = sortAgendaEvents(returns);
    const sortedActive = sortAgendaEvents(active);

    return {
      dateKey,
      label: agendaDayFormatter.format(date),
      shortLabel: agendaWeekdayFormatter.format(date),
      pickups: sortedPickups,
      returns: sortedReturns,
      active: sortedActive,
      totalEvents:
        sortedPickups.length + sortedReturns.length + sortedActive.length,
    };
  });
}

function toAgendaEvent(booking: AdminBooking, timeSource: string): AgendaEvent {
  return {
    bookingId: booking.id,
    clientName: booking.clientName,
    status: booking.status,
    time: timeFormatter.format(new Date(timeSource)),
    itemsLabel: booking.items
      .map((item) => `${item.quantity} x ${item.productName}`)
      .join(", "),
  };
}

function sortAgendaEvents(events: AgendaEvent[]) {
  return [...events].sort((firstEvent, secondEvent) =>
    firstEvent.time.localeCompare(secondEvent.time),
  );
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function getInitialAgendaStart(bookings: AdminBooking[]) {
  const firstOperationalBooking = bookings.find((booking) =>
    operationalStatuses.has(booking.status),
  );

  return firstOperationalBooking?.start.slice(0, 10) ?? toDateKey(new Date());
}

function parseDateKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`);
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function sortBookings(bookings: AdminBooking[]) {
  return [...bookings].sort((firstBooking, secondBooking) => {
    const startDifference =
      new Date(firstBooking.start).getTime() -
      new Date(secondBooking.start).getTime();

    if (startDifference !== 0) {
      return startDifference;
    }

    return (
      new Date(firstBooking.createdAt).getTime() -
      new Date(secondBooking.createdAt).getTime()
    );
  });
}

function buildBookingsCsv(bookings: AdminBooking[]) {
  const header = [
    "ID",
    "Cliente",
    "Telefono",
    "Email",
    "Estado",
    "Retiro",
    "Devolucion",
    "Equipos",
    "Subtotal",
    "Total",
    "Pagado",
    "Saldo",
    "Cargos",
  ];
  const rows = bookings.map((booking) => [
    booking.id,
    booking.clientName,
    booking.clientPhone,
    booking.clientEmail ?? "",
    booking.status,
    booking.start,
    booking.end,
    booking.items
      .map((item) => `${item.quantity} x ${item.productName}`)
      .join(" | "),
    booking.subtotal,
    booking.totalDue,
    booking.paidTotal,
    booking.balanceDue,
    booking.extraCharges,
  ]);

  return [header, ...rows]
    .map((row) => row.map(formatCsvCell).join(";"))
    .join("\r\n");
}

function formatCsvCell(value: string | number) {
  const text = String(value);

  if (/[;"\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function sortInventoryBlocks(blocks: InventoryBlock[]) {
  return [...blocks].sort((firstBlock, secondBlock) => {
    const startDifference =
      new Date(firstBlock.start).getTime() -
      new Date(secondBlock.start).getTime();

    if (startDifference !== 0) {
      return startDifference;
    }

    return (
      new Date(firstBlock.createdAt).getTime() -
      new Date(secondBlock.createdAt).getTime()
    );
  });
}
