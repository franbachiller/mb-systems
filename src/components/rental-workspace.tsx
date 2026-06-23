"use client";

import {
  AlertTriangle,
  CalendarDays,
  CalendarOff,
  CheckCircle2,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Wrench,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import BrandMark from "@/components/brand-mark";
import PublicPaymentActions, {
  type PaymentActionBooking,
} from "@/components/public-payment-actions";
import {
  getRentalDays,
  isValidRentalWindow,
  type CustomerInput,
  type ProductAvailability,
  type RentalCategory,
  type RentalSnapshot,
  type RentalWindow,
} from "@/lib/rental-data";

type CategoryFilter = RentalCategory | "Todos";
type Cart = Record<string, number>;

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; booking: PaymentActionBooking }
  | { status: "error"; message: string };

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export default function RentalWorkspace({
  initialRentalWindow,
  initialSnapshot,
}: {
  initialRentalWindow: RentalWindow;
  initialSnapshot: RentalSnapshot;
}) {
  const [rentalWindow, setRentalWindow] =
    useState<RentalWindow>(initialRentalWindow);
  const [snapshot, setSnapshot] = useState<RentalSnapshot>(initialSnapshot);
  const [category, setCategory] = useState<CategoryFilter>("Todos");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Cart>({});
  const [customer, setCustomer] = useState<CustomerInput>({
    name: "",
    phone: "",
    email: "",
  });
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
  const snapshotRequestId = useRef(0);

  const products = snapshot.products;
  const validWindow = isValidRentalWindow(rentalWindow);
  const rentalDays = getRentalDays(rentalWindow);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory = category === "Todos" || product.category === category;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));

      return matchesCategory && matchesQuery;
    });
  }, [category, products, query]);

  const cartItems = useMemo(
    () =>
      products
        .map((product) => ({
          product,
          quantity: cart[product.id] ?? 0,
        }))
        .filter((item) => item.quantity > 0),
    [cart, products],
  );

  const subtotal = cartItems.reduce(
    (total, item) => total + item.product.pricePerDay * item.quantity * rentalDays,
    0,
  );
  const deposit = Math.ceil(subtotal * 0.3);
  const selectedUnits = cartItems.reduce((total, item) => total + item.quantity, 0);
  const canSubmit =
    cartItems.length > 0 &&
    validWindow &&
    customer.name.trim().length > 0 &&
    customer.phone.trim().length > 0 &&
    submitState.status !== "submitting";

  function updateWindow(field: keyof RentalWindow, value: string) {
    const nextWindow = { ...rentalWindow, [field]: value };

    setRentalWindow(nextWindow);
    setSubmitState({ status: "idle" });
    void refreshSnapshot(nextWindow);
  }

  function incrementProduct(product: ProductAvailability) {
    if (!validWindow) {
      return;
    }

    setCart((currentCart) => {
      const currentQuantity = currentCart[product.id] ?? 0;

      if (currentQuantity >= product.availableUnits) {
        return currentCart;
      }

      return {
        ...currentCart,
        [product.id]: currentQuantity + 1,
      };
    });
  }

  function decrementProduct(productId: string) {
    setCart((currentCart) => {
      const currentQuantity = currentCart[productId] ?? 0;

      if (currentQuantity <= 1) {
        const nextCart = { ...currentCart };
        delete nextCart[productId];
        return nextCart;
      }

      return {
        ...currentCart,
        [productId]: currentQuantity - 1,
      };
    });
  }

  function clearCart() {
    setCart({});
    setSubmitState({ status: "idle" });
  }

  function updateCustomer(field: keyof CustomerInput, value: string) {
    setCustomer((current) => ({ ...current, [field]: value }));
    setSubmitState({ status: "idle" });
  }

  async function refreshSnapshot(window: RentalWindow) {
    const requestId = snapshotRequestId.current + 1;
    snapshotRequestId.current = requestId;
    setLoadingSnapshot(true);

    try {
      const params = new URLSearchParams({
        start: window.start,
        end: window.end,
      });
      const response = await fetch(`/api/rentals?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("No se pudo actualizar el stock.");
      }

      const nextSnapshot = (await response.json()) as RentalSnapshot;

      if (snapshotRequestId.current !== requestId) {
        return;
      }

      setSnapshot(nextSnapshot);
      setCart((currentCart) =>
        clampCartForProducts(currentCart, nextSnapshot.products),
      );
    } catch {
      if (snapshotRequestId.current === requestId) {
        setSubmitState({
          status: "error",
          message: "No se pudo actualizar el stock disponible.",
        });
      }
    } finally {
      if (snapshotRequestId.current === requestId) {
        setLoadingSnapshot(false);
      }
    }
  }

  async function submitBooking() {
    if (!canSubmit) {
      return;
    }

    setSubmitState({ status: "submitting" });

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer,
          start: rentalWindow.start,
          end: rentalWindow.end,
          items: cartItems.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
          })),
        }),
      });
      const data = (await response.json()) as {
        booking?: PaymentActionBooking;
        error?: string;
      };

      if (!response.ok || !data.booking) {
        throw new Error(data.error ?? "No se pudo crear la reserva.");
      }

      setSubmitState({ status: "success", booking: data.booking });
      setCart({});
      await refreshSnapshot(rentalWindow);
    } catch (error) {
      setSubmitState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo crear la reserva.",
      });
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <BrandMark />
              <h1 className="mt-1 text-3xl font-semibold tracking-normal text-slate-950">
                Reservas de luces y sonido
              </h1>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <a
                href="/reservas"
                className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <PackageCheck className="h-4 w-4" />
                Mi reserva
              </a>
              <StatusPill
                label="Stock en vivo"
                value={
                  loadingSnapshot
                    ? "Actualizando"
                    : `${snapshot.stats.totalProducts} items`
                }
              />
              <StatusPill
                label="Reservas activas"
                value={`${snapshot.stats.activeBookings}`}
              />
              <StatusPill label="Unidades elegidas" value={`${selectedUnits}`} />
            </div>
          </div>

          <section className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Retiro
              <span className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="datetime-local"
                  value={rentalWindow.start}
                  onChange={(event) => updateWindow("start", event.target.value)}
                  className="h-11 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                />
              </span>
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Devolucion
              <span className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="datetime-local"
                  value={rentalWindow.end}
                  onChange={(event) => updateWindow("end", event.target.value)}
                  className="h-11 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                />
              </span>
            </label>
            <div
              className={`flex h-11 items-center gap-2 rounded-md border px-3 text-sm font-medium ${
                validWindow
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              {validWindow ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              {validWindow
                ? `${rentalDays} dia${rentalDays > 1 ? "s" : ""}`
                : "Rango invalido"}
            </div>
          </section>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
        <section className="min-w-0">
          <div className="mb-4 flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-3">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar equipo, cable, luz..."
                className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="flex w-full min-w-0 max-w-full items-center gap-2 overflow-x-auto pb-1 2xl:w-auto 2xl:pb-0">
              <SlidersHorizontal className="h-4 w-4 shrink-0 text-slate-500" />
              {snapshot.categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={`h-9 shrink-0 rounded-md border px-3 text-sm font-medium transition ${
                    category === item
                      ? "border-cyan-700 bg-cyan-700 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                selectedQuantity={cart[product.id] ?? 0}
                validWindow={validWindow}
                onIncrement={() => incrementProduct(product)}
                onDecrement={() => decrementProduct(product.id)}
              />
            ))}
          </div>
        </section>

        <aside className="h-fit rounded-md border border-slate-200 bg-white lg:sticky lg:top-6">
          <div className="border-b border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-500">Pedido</p>
                <h2 className="text-xl font-semibold text-slate-950">
                  Resumen de reserva
                </h2>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-50 text-cyan-800">
                <ShoppingCart className="h-5 w-5" />
              </span>
            </div>
          </div>

          <div className="p-4">
            {submitState.status === "success" ? (
              <div className="mb-4 grid gap-3">
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                  <p>Reserva {submitState.booking.id} creada.</p>
                  <a
                    href={`/reservas?id=${encodeURIComponent(submitState.booking.id)}`}
                    className="mt-2 inline-flex h-9 items-center justify-center rounded-md border border-emerald-200 bg-white px-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
                  >
                    Consultar estado
                  </a>
                </div>
                <PublicPaymentActions
                  booking={submitState.booking}
                  lookupPhone={customer.phone}
                />
              </div>
            ) : null}

            {submitState.status === "error" ? (
              <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                {submitState.message}
              </div>
            ) : null}

            {submitState.status !== "success" ? (
              cartItems.length === 0 ? (
                <div className="flex min-h-40 flex-col items-center justify-center rounded-md border border-dashed border-slate-300 px-4 text-center">
                  <PackageCheck className="h-8 w-8 text-slate-400" />
                  <p className="mt-3 text-sm font-medium text-slate-700">
                    Todavia no hay equipos seleccionados.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="divide-y divide-slate-200">
                    {cartItems.map(({ product, quantity }) => (
                      <div
                        key={product.id}
                        className="flex gap-3 py-3 first:pt-0"
                      >
                        <div
                          className="h-14 w-14 shrink-0 rounded-md bg-slate-100 bg-contain bg-center bg-no-repeat"
                          style={{ backgroundImage: `url(${product.imageUrl})` }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {product.name}
                          </p>
                          <p className="text-sm text-slate-500">
                            {quantity} x {formatCurrency(product.pricePerDay)} x{" "}
                            {rentalDays}d
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-slate-950">
                          {formatCurrency(
                            product.pricePerDay * quantity * rentalDays,
                          )}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 border-t border-slate-200 pt-4 text-sm">
                    <SummaryRow label="Subtotal" value={formatCurrency(subtotal)} />
                    <SummaryRow
                      label="Anticipo 30%"
                      value={formatCurrency(deposit)}
                    />
                    <SummaryRow
                      label="Saldo al retirar"
                      value={formatCurrency(subtotal - deposit)}
                    />
                  </div>

                  <div className="grid gap-3 border-t border-slate-200 pt-4">
                    <label className="grid gap-1 text-sm font-medium text-slate-700">
                      Nombre
                      <input
                        value={customer.name}
                        onChange={(event) =>
                          updateCustomer("name", event.target.value)
                        }
                        className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                      />
                    </label>
                    <label className="grid gap-1 text-sm font-medium text-slate-700">
                      WhatsApp
                      <input
                        value={customer.phone}
                        onChange={(event) =>
                          updateCustomer("phone", event.target.value)
                        }
                        className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                      />
                    </label>
                    <label className="grid gap-1 text-sm font-medium text-slate-700">
                      Email opcional
                      <input
                        type="email"
                        value={customer.email}
                        onChange={(event) =>
                          updateCustomer("email", event.target.value)
                        }
                        className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={submitBooking}
                    disabled={!canSubmit}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {submitState.status === "submitting"
                      ? "Creando reserva"
                      : "Solicitar reserva"}
                  </button>
                  <button
                    type="button"
                    onClick={clearCart}
                    className="flex h-10 w-full items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    Vaciar pedido
                  </button>
                </div>
              )
            ) : null}
          </div>
        </aside>
      </main>
    </div>
  );
}

function ProductCard({
  product,
  selectedQuantity,
  validWindow,
  onIncrement,
  onDecrement,
}: {
  product: ProductAvailability;
  selectedQuantity: number;
  validWindow: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  const remainingUnits = Math.max(0, product.availableUnits - selectedQuantity);
  const unavailable = !validWindow || product.availableUnits === 0;

  return (
    <article className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <div
        className="equipment-media relative aspect-[16/9]"
        style={{ backgroundImage: `url(${product.imageUrl})` }}
      >
        <span className="absolute left-3 top-3 z-10 rounded-md bg-slate-950/85 px-2 py-1 text-xs font-semibold text-white backdrop-blur">
          {product.category}
        </span>
        <span
          className={`absolute bottom-3 left-3 z-10 rounded-md px-2 py-1 text-xs font-semibold shadow-sm ${
            unavailable
              ? "bg-rose-50 text-rose-700"
              : remainingUnits <= 2
                ? "bg-amber-50 text-amber-800"
                : "bg-emerald-50 text-emerald-800"
          }`}
        >
          {validWindow ? `${remainingUnits} disponibles` : "Fechas pendientes"}
        </span>
      </div>

      <div className="space-y-4 p-4">
        <div className="flex min-h-20 flex-col justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold leading-6 text-slate-950">
              {product.name}
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">{product.specs}</p>
          </div>
          <p className="text-sm font-semibold text-slate-950">
            {formatCurrency(product.pricePerDay)} / dia
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {product.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-2 border-y border-slate-200 py-3 text-center text-xs">
          <Metric label="Total" value={product.totalUnits} />
          <Metric label="Reserva" value={product.bookedUnits} />
          <Metric
            label="Bloq."
            value={product.blockedUnits}
            icon={<CalendarOff />}
          />
          <Metric label="Taller" value={product.maintenanceUnits} icon={<Wrench />} />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
              Cantidad
            </p>
            <p className="text-lg font-semibold text-slate-950">
              {selectedQuantity}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              title={`Quitar ${product.name}`}
              onClick={onDecrement}
              disabled={selectedQuantity === 0}
              className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              title={`Agregar ${product.name}`}
              onClick={onIncrement}
              disabled={unavailable || remainingUnits === 0}
              className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-700 text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon?: React.ReactElement;
}) {
  return (
    <div className="min-w-0">
      <p className="flex h-5 items-center justify-center gap-1 text-slate-500">
        {icon ? (
          <span className="flex h-4 w-4 items-center justify-center text-slate-400">
            {icon}
          </span>
        ) : null}
        <span className="truncate">{label}</span>
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-950">{value}</p>
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

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function clampCartForProducts(
  currentCart: Cart,
  products: ProductAvailability[],
) {
  let changed = false;
  const nextCart: Cart = {};

  products.forEach((product) => {
    const currentQuantity = currentCart[product.id] ?? 0;
    const maxQuantity = product.availableUnits;

    if (currentQuantity > 0 && maxQuantity > 0) {
      nextCart[product.id] = Math.min(currentQuantity, maxQuantity);
    }

    if (nextCart[product.id] !== currentQuantity) {
      changed = true;
    }
  });

  return changed ? nextCart : currentCart;
}
