"use client";

import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CalendarDays,
  CheckCircle2,
  Headphones,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
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

type CuratedPackage = {
  id: string;
  name: string;
  eyebrow: string;
  description: string;
  items: Array<{ productId: string; quantity: number }>;
  accent: string;
};

const curatedPackages: CuratedPackage[] = [
  {
    id: "sonido-esencial",
    name: "Sonido esencial",
    eyebrow: "Eventos chicos",
    description: "Una solucion clara para reuniones, charlas y celebraciones de hasta 60 personas.",
    items: [
      { productId: "pa-speaker-15", quantity: 1 },
      { productId: "wireless-mic", quantity: 1 },
      { productId: "power-kit", quantity: 1 },
    ],
    accent: "from-zinc-500/20 to-transparent",
  },
  {
    id: "fiesta-completa",
    name: "Fiesta completa",
    eyebrow: "El mas elegido",
    description: "Sonido con cuerpo, control DJ y microfono para una pista lista para funcionar.",
    items: [
      { productId: "pa-speaker-15", quantity: 2 },
      { productId: "sub-18", quantity: 1 },
      { productId: "wireless-mic", quantity: 1 },
      { productId: "dj-controller", quantity: 1 },
      { productId: "power-kit", quantity: 1 },
    ],
    accent: "from-red-500/25 to-transparent",
  },
  {
    id: "puesta-en-escena",
    name: "Puesta en escena",
    eyebrow: "Luz y atmosfera",
    description: "Movimiento, color y humo para transformar una pista o un escenario compacto.",
    items: [
      { productId: "moving-head", quantity: 2 },
      { productId: "led-bar", quantity: 4 },
      { productId: "fog-machine", quantity: 1 },
      { productId: "power-kit", quantity: 1 },
    ],
    accent: "from-violet-500/20 to-transparent",
  },
];

const isShowcase = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const publicBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function publicAssetUrl(path: string) {
  if (/^(?:https?:|data:|blob:)/.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (publicBasePath && !normalizedPath.startsWith(`${publicBasePath}/`)) {
    return `${publicBasePath}${normalizedPath}`;
  }

  return normalizedPath;
}

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
  const catalogRef = useRef<HTMLElement>(null);
  const orderRef = useRef<HTMLElement>(null);

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
    !isShowcase &&
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

  function addPackage(selection: CuratedPackage) {
    if (!validWindow) {
      return;
    }

    setCart((currentCart) => {
      const nextCart = { ...currentCart };

      selection.items.forEach((item) => {
        const product = products.find(
          (currentProduct) => currentProduct.id === item.productId,
        );

        if (!product || product.availableUnits === 0) {
          return;
        }

        nextCart[item.productId] = Math.min(
          product.availableUnits,
          (nextCart[item.productId] ?? 0) + item.quantity,
        );
      });

      return nextCart;
    });
    setSubmitState({ status: "idle" });
    window.setTimeout(() => orderRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
  }

  function getPackagePrice(selection: CuratedPackage) {
    return selection.items.reduce((total, item) => {
      const product = products.find(
        (currentProduct) => currentProduct.id === item.productId,
      );

      return total + (product?.pricePerDay ?? 0) * item.quantity * rentalDays;
    }, 0);
  }

  function isPackageAvailable(selection: CuratedPackage) {
    return (
      validWindow &&
      selection.items.every((item) => {
        const product = products.find(
          (currentProduct) => currentProduct.id === item.productId,
        );

        return Boolean(product && product.availableUnits >= item.quantity);
      })
    );
  }

  function updateCustomer(field: keyof CustomerInput, value: string) {
    setCustomer((current) => ({ ...current, [field]: value }));
    setSubmitState({ status: "idle" });
  }

  async function refreshSnapshot(window: RentalWindow) {
    if (isShowcase) {
      return;
    }

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
    <div className="public-shell min-h-screen text-slate-950">
      <header className="public-hero border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 pb-10 pt-5 sm:px-6 lg:px-8 lg:pb-14">
          <nav className="flex items-center justify-between gap-4">
            <BrandMark />
            <div className="flex items-center gap-2">
              {isShowcase ? <span className="hidden rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-red-300 sm:inline-flex">Vista MVP</span> : null}
              <a
                href={`${publicBasePath}/reservas`}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <PackageCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Consultar mi reserva</span>
                <span className="sm:hidden">Mi reserva</span>
              </a>
            </div>
          </nav>

          <div className="mt-10 grid items-end gap-8 lg:grid-cols-[1fr_520px]">
            <div className="max-w-2xl">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-red-400">
                Sonido · Iluminacion · Estructuras
              </p>
              <h1 className="text-4xl font-semibold leading-[1.08] tracking-[-0.035em] text-slate-950 sm:text-5xl lg:text-6xl">
                El equipo correcto para que tu evento funcione.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-500 sm:text-lg">
                Elegi fechas, arma tu pedido y recibi confirmacion humana. Equipos revisados, stock real y soporte de principio a fin.
              </p>
              <button
                type="button"
                onClick={() => catalogRef.current?.scrollIntoView({ behavior: "smooth" })}
                className="mt-7 inline-flex h-11 items-center gap-2 rounded-md bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Ver equipos disponibles
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <section className="date-panel rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Disponibilidad</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950">Cuando lo necesitas</h2>
                </div>
                <span className={`inline-flex items-center gap-2 text-sm font-semibold ${validWindow ? "text-emerald-700" : "text-amber-800"}`}>
                  {validWindow ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  {loadingSnapshot ? "Actualizando" : validWindow ? `${rentalDays} dia${rentalDays > 1 ? "s" : ""}` : "Revisar fechas"}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <DateControl label="Retiro" value={rentalWindow.start} onChange={(value) => updateWindow("start", value)} />
                <DateControl label="Devolucion" value={rentalWindow.end} onChange={(value) => updateWindow("end", value)} />
              </div>
            </section>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200 lg:grid-cols-4">
            <TrustItem icon={<ShieldCheck />} title="Equipos revisados" detail="Probados antes de cada entrega" />
            <TrustItem icon={<Boxes />} title="Stock actualizado" detail={`${snapshot.stats.totalProducts} lineas disponibles`} />
            <TrustItem icon={<Truck />} title="Retiro coordinado" detail="Sin esperas ni improvisacion" />
            <TrustItem icon={<Headphones />} title="Soporte real" detail="Te asesoramos por WhatsApp" />
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <SectionHeading eyebrow="Soluciones listas" title="No hace falta ser tecnico para elegir bien." description="Estos paquetes cubren los casos mas comunes. Podes agregarlos completos y ajustar cualquier equipo despues." />
          <div className="mt-7 grid gap-4 lg:grid-cols-3">
            {curatedPackages.map((selection) => {
              const packageAvailable = isPackageAvailable(selection);
              return (
                <article key={selection.id} className="package-card relative overflow-hidden rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                  <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${selection.accent}`} />
                  <div className="relative">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-400">{selection.eyebrow}</p>
                    <h3 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-slate-950">{selection.name}</h3>
                    <p className="mt-3 min-h-14 text-sm leading-6 text-slate-500">{selection.description}</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {selection.items.map((item) => {
                        const product = products.find((currentProduct) => currentProduct.id === item.productId);
                        return <span key={item.productId} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">{item.quantity}× {product?.name ?? item.productId}</span>;
                      })}
                    </div>
                    <div className="mt-6 flex items-end justify-between gap-4 border-t border-slate-200 pt-5">
                      <div>
                        <p className="text-xs text-slate-500">Total por {rentalDays}d</p>
                        <p className="mt-1 text-xl font-semibold text-slate-950">{formatCurrency(getPackagePrice(selection))}</p>
                      </div>
                      <button type="button" onClick={() => addPackage(selection)} disabled={!packageAvailable} className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">
                        <Plus className="h-4 w-4" />
                        {packageAvailable ? "Agregar" : "Sin stock"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section ref={catalogRef} className="catalog-section border-y border-slate-200">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <SectionHeading eyebrow="Catalogo tecnico" title="Arma tu pedido a medida." description="Disponibilidad calculada para las fechas elegidas. Mostramos solo lo que importa para decidir." />
            <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
              <section className="min-w-0">
                <div className="mb-5 grid gap-3 xl:grid-cols-[minmax(260px,1fr)_auto] xl:items-center">
                  <div className="flex min-w-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-3">
                    <Search className="h-4 w-4 shrink-0 text-slate-400" />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por equipo o uso..." className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
                  </div>
                  <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1 xl:pb-0">
                    <SlidersHorizontal className="h-4 w-4 shrink-0 text-slate-500" />
                    {snapshot.categories.map((item) => (
                      <button key={item} type="button" onClick={() => setCategory(item)} className={`h-9 shrink-0 rounded-md border px-3 text-sm font-medium transition ${category === item ? "border-cyan-700 bg-cyan-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}>{item}</button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filteredProducts.map((product) => (
                    <ProductCard key={product.id} product={product} selectedQuantity={cart[product.id] ?? 0} validWindow={validWindow} onIncrement={() => incrementProduct(product)} onDecrement={() => decrementProduct(product.id)} />
                  ))}
                </div>
              </section>

              <aside ref={orderRef} id="pedido" className="order-panel h-fit rounded-md border border-slate-200 bg-white lg:sticky lg:top-5">
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
                          style={{
                            backgroundImage: `url(${publicAssetUrl(product.imageUrl)})`,
                          }}
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
                    {isShowcase
                      ? "Reservas disponibles proximamente"
                      : submitState.status === "submitting"
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
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <SectionHeading eyebrow="Como funciona" title="De la seleccion al evento, sin vueltas." description="La solicitud no bloquea stock automaticamente: primero revisamos compatibilidad, logistica y disponibilidad final." />
          <div className="mt-7 grid gap-4 md:grid-cols-4">
            <ProcessStep number="01" title="Elegi fechas" detail="Calculamos stock real para tu retiro y devolucion." />
            <ProcessStep number="02" title="Arma el pedido" detail="Usa un paquete o combina equipos libremente." />
            <ProcessStep number="03" title="Lo revisamos" detail="Confirmamos que todo sea compatible y suficiente." />
            <ProcessStep number="04" title="Retira tranquilo" detail="Entregamos el equipo probado y listo para usar." />
          </div>
        </section>
      </main>

      {selectedUnits > 0 ? (
        <a href="#pedido" className="mobile-order-bar fixed inset-x-4 bottom-4 z-40 flex items-center justify-between rounded-md border border-red-400/30 bg-red-600 px-4 py-3 text-white shadow-sm lg:hidden">
          <span><strong>{selectedUnits}</strong> unidad{selectedUnits === 1 ? "" : "es"} · {formatCurrency(subtotal)}</span>
          <span className="inline-flex items-center gap-1 font-semibold">Ver pedido <ArrowRight className="h-4 w-4" /></span>
        </a>
      ) : null}
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
    <article className="product-card group overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <div
        className="equipment-media relative aspect-[4/3] transition duration-300 group-hover:scale-[1.015]"
        style={{ backgroundImage: `url(${publicAssetUrl(product.imageUrl)})` }}
      >
        <span className="absolute left-3 top-3 z-10 rounded-md border border-white/10 bg-slate-950/85 px-2 py-1 text-xs font-semibold text-white backdrop-blur">
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

      <div className="flex min-h-[285px] flex-col p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-slate-500">{product.category}</p>
          <h3 className="mt-2 text-lg font-semibold leading-6 tracking-[-0.015em] text-slate-950">
            {product.name}
          </h3>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{product.specs}</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {product.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-slate-200 pt-4">
          <div>
            <p className="text-xs text-slate-500">Por dia</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{formatCurrency(product.pricePerDay)}</p>
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
            <span className="min-w-5 text-center text-sm font-semibold text-slate-950">{selectedQuantity}</span>
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

function DateControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      {label}
      <span className="relative">
        <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input type="datetime-local" value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100" />
      </span>
    </label>
  );
}

function TrustItem({ icon, title, detail }: { icon: React.ReactElement; title: string; detail: string }) {
  return (
    <div className="flex flex-col gap-3 bg-white p-4 sm:flex-row">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-cyan-50 text-cyan-800 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-slate-950">{title}</p>
        <p className="mt-1 hidden text-xs leading-5 text-slate-500 sm:block">{detail}</p>
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-red-400">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">{title}</h2>
      <p className="mt-4 text-base leading-7 text-slate-500">{description}</p>
    </div>
  );
}

function ProcessStep({ number, title, detail }: { number: string; title: string; detail: string }) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-5">
      <p className="font-mono text-xs font-semibold text-red-400">{number}</p>
      <h3 className="mt-5 text-lg font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{detail}</p>
    </article>
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
