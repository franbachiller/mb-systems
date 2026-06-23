export type RentalCategory =
  | "Sonido"
  | "Iluminacion"
  | "Efectos"
  | "Estructuras"
  | "Energia";

export type Product = {
  id: string;
  name: string;
  category: RentalCategory;
  totalUnits: number;
  maintenanceUnits: number;
  pricePerDay: number;
  imageUrl: string;
  specs: string;
  tags: string[];
};

export type ProductAvailability = Product & {
  availableUnits: number;
  bookedUnits: number;
  blockedUnits: number;
};

export type InventoryBlockReason =
  | "mantenimiento"
  | "reserva_interna"
  | "apartado"
  | "otro";

export const inventoryBlockReasons = [
  "mantenimiento",
  "reserva_interna",
  "apartado",
  "otro",
] as const satisfies InventoryBlockReason[];

export type BookingStatus =
  | "pendiente"
  | "confirmado"
  | "pagado"
  | "retirado"
  | "devuelto"
  | "cancelado";

export const bookingStatuses = [
  "pendiente",
  "confirmado",
  "pagado",
  "retirado",
  "devuelto",
  "cancelado",
] as const satisfies BookingStatus[];

export type PaymentMethod =
  | "efectivo"
  | "transferencia"
  | "mercadopago"
  | "tarjeta"
  | "otro";

export const paymentMethods = [
  "efectivo",
  "transferencia",
  "mercadopago",
  "tarjeta",
  "otro",
] as const satisfies PaymentMethod[];

export type BookingOperationStage = "retiro" | "devolucion";

export const bookingOperationStages = [
  "retiro",
  "devolucion",
] as const satisfies BookingOperationStage[];

export type Booking = {
  id: string;
  client: string;
  clientPhone?: string;
  clientEmail?: string;
  productId: string;
  quantity: number;
  start: string;
  end: string;
  status: BookingStatus;
};

export type BookingItemInput = {
  productId: string;
  quantity: number;
};

export type CustomerInput = {
  name: string;
  phone: string;
  email?: string;
};

export type RentalWindow = {
  start: string;
  end: string;
};

export type RentalSnapshot = {
  products: ProductAvailability[];
  categories: typeof categories;
  stats: {
    totalProducts: number;
    activeBookings: number;
  };
};

export type AdminBooking = {
  id: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  start: string;
  end: string;
  status: BookingStatus;
  subtotal: number;
  deposit: number;
  extraCharges: number;
  totalDue: number;
  paidTotal: number;
  balanceDue: number;
  createdAt: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    pricePerDay: number;
  }>;
  payments: BookingPayment[];
  operations: BookingOperation[];
};

export type PublicBooking = {
  id: string;
  clientName: string;
  start: string;
  end: string;
  status: BookingStatus;
  subtotal: number;
  deposit: number;
  totalDue: number;
  paidTotal: number;
  balanceDue: number;
  createdAt: string;
  items: Array<{
    productName: string;
    quantity: number;
    pricePerDay: number;
  }>;
  payments: Array<{
    amount: number;
    method: PaymentMethod;
    createdAt: string;
  }>;
};

export type BookingPayment = {
  id: string;
  amount: number;
  method: PaymentMethod;
  note: string | null;
  createdAt: string;
};

export type BookingOperation = {
  id: string;
  stage: BookingOperationStage;
  equipmentChecked: boolean;
  accessoriesChecked: boolean;
  powerChecked: boolean;
  conditionNotes: string | null;
  damageFee: number;
  missingFee: number;
  createdAt: string;
};

export type InventoryBlock = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  start: string;
  end: string;
  reason: InventoryBlockReason;
  note: string | null;
  createdAt: string;
};

export const categories = [
  "Todos",
  "Sonido",
  "Iluminacion",
  "Efectos",
  "Estructuras",
  "Energia",
] as const;

export const seedProducts: Product[] = [
  {
    id: "pa-speaker-15",
    name: "Parlante activo full range",
    category: "Sonido",
    totalUnits: 6,
    maintenanceUnits: 1,
    pricePerDay: 18000,
    imageUrl: "/catalog/speaker-active-15.png",
    specs: "Caja activa de alto rendimiento, DSP, entrada combo y montaje en tripode.",
    tags: ["2000w", "dsp", "tripode"],
  },
  {
    id: "sub-18",
    name: "Subwoofer activo 18 pulgadas",
    category: "Sonido",
    totalUnits: 4,
    maintenanceUnits: 0,
    pricePerDay: 26000,
    imageUrl: "/catalog/subwoofer-18.png",
    specs: "Subgrave activo para pista, crossover y salida link balanceada.",
    tags: ["18 pulgadas", "bajos", "link out"],
  },
  {
    id: "wireless-mic",
    name: "Microfono inalambrico UHF",
    category: "Sonido",
    totalUnits: 5,
    maintenanceUnits: 0,
    pricePerDay: 14000,
    imageUrl: "/catalog/wireless-mic-uhf.jpg",
    specs: "Sistema UHF con receptor, transmisor, microfono y estuche de traslado.",
    tags: ["uhf", "voz", "estuche"],
  },
  {
    id: "dj-controller",
    name: "Controladora DJ Pioneer DDJ",
    category: "Sonido",
    totalUnits: 2,
    maintenanceUnits: 0,
    pricePerDay: 32000,
    imageUrl: "/catalog/dj-controller.jpg",
    specs: "Mixer USB, pads, jogs, salida master y control de cabina.",
    tags: ["usb", "mixer", "booth"],
  },
  {
    id: "moving-head",
    name: "Cabezal movil spot LED",
    category: "Iluminacion",
    totalUnits: 8,
    maintenanceUnits: 1,
    pricePerDay: 22000,
    imageUrl: "/catalog/moving-head-beam.jpg",
    specs: "Cabeza movil DMX con gobos, prisma, enfoque y movimiento pan/tilt.",
    tags: ["dmx", "gobos", "pan tilt"],
  },
  {
    id: "led-bar",
    name: "Barra LED RGB DMX",
    category: "Iluminacion",
    totalUnits: 12,
    maintenanceUnits: 0,
    pricePerDay: 9000,
    imageUrl: "/catalog/led-bar-rgbw.jpg",
    specs: "Bano lineal de color para pista, escenario o ambientacion perimetral.",
    tags: ["rgb", "dmx", "wash"],
  },
  {
    id: "fog-machine",
    name: "Maquina de humo 1400 W",
    category: "Efectos",
    totalUnits: 3,
    maintenanceUnits: 0,
    pricePerDay: 12000,
    imageUrl: "/catalog/fog-machine.jpg",
    specs: "Equipo compacto de alto caudal con control remoto y liquido incluido.",
    tags: ["humo", "control", "show"],
  },
  {
    id: "truss-kit",
    name: "Truss aluminio F34 3 m",
    category: "Estructuras",
    totalUnits: 6,
    maintenanceUnits: 0,
    pricePerDay: 24000,
    imageUrl: "/catalog/truss-kit.jpg",
    specs: "Tramo estructural de aluminio con pernos, seguros y bases compatibles.",
    tags: ["aluminio", "bases", "pernos"],
  },
  {
    id: "power-kit",
    name: "Kit energia y cableado",
    category: "Energia",
    totalUnits: 10,
    maintenanceUnits: 0,
    pricePerDay: 7500,
    imageUrl: "/catalog/power-cable-kit.jpg",
    specs: "Alargues, zapatillas, fichas, cinta, tester y proteccion basica.",
    tags: ["cables", "seguridad", "backup"],
  },
];

export const seedBookings: Booking[] = [
  {
    id: "res-1001",
    client: "Salon Aurora",
    productId: "pa-speaker-15",
    quantity: 2,
    start: "2026-06-05T09:00",
    end: "2026-06-06T12:00",
    status: "confirmado",
  },
  {
    id: "res-1002",
    client: "Cumple de Martina",
    productId: "moving-head",
    quantity: 4,
    start: "2026-06-05T14:00",
    end: "2026-06-07T10:00",
    status: "pagado",
  },
  {
    id: "res-1003",
    client: "DJ Nico",
    productId: "sub-18",
    quantity: 2,
    start: "2026-06-06T10:00",
    end: "2026-06-07T16:00",
    status: "retirado",
  },
  {
    id: "res-1004",
    client: "Club Norte",
    productId: "led-bar",
    quantity: 6,
    start: "2026-06-04T11:00",
    end: "2026-06-05T18:00",
    status: "pendiente",
  },
  {
    id: "res-1005",
    client: "Evento privado",
    productId: "wireless-mic",
    quantity: 2,
    start: "2026-06-07T08:00",
    end: "2026-06-07T22:00",
    status: "cancelado",
  },
];

const blockingStatuses = new Set<BookingStatus>([
  "pendiente",
  "confirmado",
  "pagado",
  "retirado",
]);

export const blockingBookingStatuses = [...blockingStatuses];

export function getDefaultRentalWindow(): RentalWindow {
  return {
    start: "2026-06-05T10:00",
    end: "2026-06-06T10:00",
  };
}

export function isValidRentalWindow(window: RentalWindow) {
  const start = parseDateTime(window.start);
  const end = parseDateTime(window.end);

  return start !== null && end !== null && end > start;
}

export function getRentalDays(window: RentalWindow) {
  const start = parseDateTime(window.start);
  const end = parseDateTime(window.end);

  if (start === null || end === null || end <= start) {
    return 1;
  }

  return Math.max(1, Math.ceil((end - start) / 86_400_000));
}

export function getBookedUnits(
  productId: string,
  window: RentalWindow,
  sourceBookings: Booking[] = seedBookings,
) {
  if (!isValidRentalWindow(window)) {
    return 0;
  }

  return sourceBookings
    .filter(
      (booking) =>
        booking.productId === productId &&
        blockingStatuses.has(booking.status) &&
        doesBookingOverlapWindow(booking, window),
    )
    .reduce((total, booking) => total + booking.quantity, 0);
}

export function getAvailableUnits(product: Product, window: RentalWindow) {
  const bookedUnits = getBookedUnits(product.id, window);

  return Math.max(0, product.totalUnits - product.maintenanceUnits - bookedUnits);
}

export function getAvailableUnitsFromBookings(
  product: Product,
  window: RentalWindow,
  sourceBookings: Booking[],
) {
  const bookedUnits = getBookedUnits(product.id, window, sourceBookings);

  return Math.max(0, product.totalUnits - product.maintenanceUnits - bookedUnits);
}

function doesBookingOverlapWindow(booking: Booking, window: RentalWindow) {
  const bookingStart = parseDateTime(booking.start);
  const bookingEnd = parseDateTime(booking.end);
  const windowStart = parseDateTime(window.start);
  const windowEnd = parseDateTime(window.end);

  if (
    bookingStart === null ||
    bookingEnd === null ||
    windowStart === null ||
    windowEnd === null
  ) {
    return false;
  }

  return bookingStart < windowEnd && bookingEnd > windowStart;
}

function parseDateTime(value: string) {
  const timestamp = new Date(value).getTime();

  return Number.isNaN(timestamp) ? null : timestamp;
}
