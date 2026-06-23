import "server-only";

import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  blockingBookingStatuses,
  bookingOperationStages,
  bookingStatuses,
  categories,
  getRentalDays,
  inventoryBlockReasons,
  isValidRentalWindow,
  paymentMethods,
  seedBookings,
  seedProducts,
  type BookingItemInput,
  type BookingOperation,
  type BookingOperationStage,
  type BookingStatus,
  type CustomerInput,
  type AdminBooking,
  type BookingPayment,
  type InventoryBlock,
  type InventoryBlockReason,
  type PaymentMethod,
  type Product,
  type ProductAvailability,
  type PublicBooking,
  type RentalSnapshot,
  type RentalWindow,
} from "@/lib/rental-data";

type ProductRow = {
  id: string;
  name: string;
  category: Product["category"];
  total_units: number;
  maintenance_units: number;
  price_per_day: number;
  image_url: string;
  specs: string;
  tags_json: string;
};

type BookingRow = {
  id: string;
  client_name: string;
  client_phone: string;
  client_email: string | null;
  start_at: string;
  end_at: string;
  status: BookingStatus;
  subtotal: number;
  deposit: number;
  created_at: string;
};

type BookingItemRow = {
  product_id: string;
  product_name: string;
  quantity: number;
  price_per_day: number;
};

type PaymentRow = {
  id: string;
  amount: number;
  method: PaymentMethod;
  note: string | null;
  created_at: string;
};

type OperationRow = {
  id: string;
  stage: BookingOperationStage;
  equipment_checked: number;
  accessories_checked: number;
  power_checked: number;
  condition_notes: string | null;
  damage_fee: number;
  missing_fee: number;
  created_at: string;
};

type InventoryBlockRow = {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  start_at: string;
  end_at: string;
  reason: InventoryBlockReason;
  note: string | null;
  created_at: string;
};

type BookedUnitsRow = {
  product_id: string;
  booked_units: number;
};

type BlockedUnitsRow = {
  product_id: string;
  blocked_units: number;
};

type ActiveBookingsRow = {
  active_bookings: number;
};

export type BookingDetailsInput = {
  customer: CustomerInput;
  window: RentalWindow;
  items: BookingItemInput[];
};

type CreateBookingInput = BookingDetailsInput;

export type PublicBookingLookupInput = {
  bookingId: string;
  phone: string;
};

type RecordBookingPaymentInput = {
  amount: number;
  method: PaymentMethod;
  note?: string;
};

type RecordExternalBookingPaymentInput = RecordBookingPaymentInput & {
  provider: string;
  externalPaymentId: string;
};

type RecordBookingOperationInput = {
  stage: BookingOperationStage;
  equipmentChecked: boolean;
  accessoriesChecked: boolean;
  powerChecked: boolean;
  conditionNotes?: string;
  damageFee: number;
  missingFee: number;
};

export type InventoryBlockInput = {
  productId: string;
  quantity: number;
  window: RentalWindow;
  reason: InventoryBlockReason;
  note?: string;
};

export type ProductCatalogInput = {
  name: string;
  category: Product["category"];
  totalUnits: number;
  maintenanceUnits: number;
  pricePerDay: number;
  imageUrl: string;
  specs: string;
  tags: string[];
};

type NormalizedBookingDetails = {
  customer: {
    name: string;
    phone: string;
    email?: string;
  };
  window: RentalWindow;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
};

const dbPath = path.join(process.cwd(), "data", "mb-systems.sqlite");

const db = createDatabase();

export function getRentalSnapshot(window: RentalWindow): RentalSnapshot {
  ensureDatabase();

  const products = getProducts();
  const bookedUnitsByProduct = getBookedUnitsByProduct(window);
  const blockedUnitsByProduct = getBlockedUnitsByProduct(window);
  const productsWithAvailability = products.map((product) => {
    const bookedUnits = bookedUnitsByProduct.get(product.id) ?? 0;
    const blockedUnits = blockedUnitsByProduct.get(product.id) ?? 0;
    const availableUnits = Math.max(
      0,
      product.totalUnits -
        product.maintenanceUnits -
        bookedUnits -
        blockedUnits,
    );

    return {
      ...product,
      bookedUnits,
      blockedUnits,
      availableUnits,
    };
  });

  return {
    products: productsWithAvailability,
    categories,
    stats: {
      totalProducts: productsWithAvailability.length,
      activeBookings: getActiveBookingsCount(),
    },
  };
}

export function createBooking(input: CreateBookingInput) {
  ensureDatabase();

  const normalizedInput = normalizeBookingDetailsInput(input);

  const writeBooking = db.transaction(() => {
    const products = getProductsByIds(
      normalizedInput.items.map((item) => item.productId),
    );
    const rentalDays = getRentalDays(normalizedInput.window);
    let subtotal = 0;

    for (const item of normalizedInput.items) {
      const product = products.get(item.productId);

      if (!product) {
        throw new RentalDbError("PRODUCT_NOT_FOUND", "Un equipo ya no existe.");
      }

      const availability = getProductAvailability(product, normalizedInput.window);

      if (item.quantity > availability.availableUnits) {
        throw new RentalDbError(
          "OUT_OF_STOCK",
          `${product.name} no tiene stock suficiente para esas fechas.`,
        );
      }

      subtotal += product.pricePerDay * item.quantity * rentalDays;
    }

    const bookingId = `res-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const deposit = Math.ceil(subtotal * 0.3);

    db.prepare(
      `INSERT INTO bookings (
        id,
        client_name,
        client_phone,
        client_email,
        start_at,
        end_at,
        status,
        subtotal,
        deposit,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      bookingId,
      normalizedInput.customer.name,
      normalizedInput.customer.phone,
      normalizedInput.customer.email ?? null,
      normalizedInput.window.start,
      normalizedInput.window.end,
      "pendiente",
      subtotal,
      deposit,
      now,
      now,
    );

    const insertItem = db.prepare(
      `INSERT INTO booking_items (
        booking_id,
        product_id,
        quantity,
        price_per_day
      ) VALUES (?, ?, ?, ?)`,
    );

    for (const item of normalizedInput.items) {
      const product = products.get(item.productId);

      if (!product) {
        throw new RentalDbError("PRODUCT_NOT_FOUND", "Un equipo ya no existe.");
      }

      insertItem.run(bookingId, item.productId, item.quantity, product.pricePerDay);
    }

    return getBookingById(bookingId);
  });

  return writeBooking();
}

export function listAdminBookings(): AdminBooking[] {
  ensureDatabase();

  const bookings = db
    .prepare(
      `SELECT
        id,
        client_name,
        client_phone,
        client_email,
        start_at,
        end_at,
        status,
        subtotal,
        deposit,
        created_at
      FROM bookings
      ORDER BY start_at ASC, created_at ASC`,
    )
    .all() as BookingRow[];

  return bookings.map(mapBookingRow);
}

export function getAdminBookingById(bookingId: string) {
  ensureDatabase();

  return getBookingById(bookingId);
}

export function lookupPublicBooking(
  input: PublicBookingLookupInput,
): PublicBooking {
  ensureDatabase();

  return mapPublicBooking(getPublicBookingByLookup(input));
}

export function getAdminBookingForPublicPayment(
  input: PublicBookingLookupInput,
): AdminBooking {
  ensureDatabase();

  return getPublicBookingByLookup(input);
}

function getPublicBookingByLookup(input: PublicBookingLookupInput) {
  const bookingId = input.bookingId.trim().toLowerCase();
  const providedPhone = input.phone.trim();

  if (!bookingId || providedPhone.length < 3) {
    throw new RentalDbError(
      "INVALID_LOOKUP",
      "Ingresa el codigo de reserva y el WhatsApp usado en el pedido.",
    );
  }

  const booking = getBookingById(bookingId);

  if (!doPhoneLookupMatch(booking.clientPhone, providedPhone)) {
    throw new RentalDbError(
      "BOOKING_NOT_FOUND",
      "No encontramos una reserva con esos datos.",
    );
  }

  return booking;
}

export function updateBookingDetails(
  bookingId: string,
  input: BookingDetailsInput,
) {
  ensureDatabase();

  const normalizedInput = normalizeBookingDetailsInput(input);

  const updateBooking = db.transaction(() => {
    getBookingById(bookingId);

    const products = getProductsByIds(
      normalizedInput.items.map((item) => item.productId),
    );
    const rentalDays = getRentalDays(normalizedInput.window);
    let subtotal = 0;

    for (const item of normalizedInput.items) {
      const product = products.get(item.productId);

      if (!product) {
        throw new RentalDbError("PRODUCT_NOT_FOUND", "Un equipo ya no existe.");
      }

      const availability = getProductAvailability(product, normalizedInput.window, {
        excludeBookingId: bookingId,
      });

      if (item.quantity > availability.availableUnits) {
        throw new RentalDbError(
          "OUT_OF_STOCK",
          `${product.name} no tiene stock suficiente para esas fechas.`,
        );
      }

      subtotal += product.pricePerDay * item.quantity * rentalDays;
    }

    const now = new Date().toISOString();
    const deposit = Math.ceil(subtotal * 0.3);
    const result = db
      .prepare(
        `UPDATE bookings
        SET
          client_name = ?,
          client_phone = ?,
          client_email = ?,
          start_at = ?,
          end_at = ?,
          subtotal = ?,
          deposit = ?,
          updated_at = ?
        WHERE id = ?`,
      )
      .run(
        normalizedInput.customer.name,
        normalizedInput.customer.phone,
        normalizedInput.customer.email ?? null,
        normalizedInput.window.start,
        normalizedInput.window.end,
        subtotal,
        deposit,
        now,
        bookingId,
      );

    if (result.changes === 0) {
      throw new RentalDbError("BOOKING_NOT_FOUND", "No se encontro la reserva.");
    }

    db.prepare("DELETE FROM booking_items WHERE booking_id = ?").run(bookingId);

    const insertItem = db.prepare(
      `INSERT INTO booking_items (
        booking_id,
        product_id,
        quantity,
        price_per_day
      ) VALUES (?, ?, ?, ?)`,
    );

    for (const item of normalizedInput.items) {
      const product = products.get(item.productId);

      if (!product) {
        throw new RentalDbError("PRODUCT_NOT_FOUND", "Un equipo ya no existe.");
      }

      insertItem.run(bookingId, item.productId, item.quantity, product.pricePerDay);
    }

    return getBookingById(bookingId);
  });

  return updateBooking();
}

export function recordBookingPayment(
  bookingId: string,
  input: RecordBookingPaymentInput,
) {
  ensureDatabase();

  const amount = normalizePaymentAmount(input.amount);

  if (!paymentMethods.includes(input.method)) {
    throw new RentalDbError("INVALID_PAYMENT_METHOD", "El metodo no es valido.");
  }

  const writePayment = db.transaction(() => {
    const booking = getBookingById(bookingId);

    if (amount > booking.balanceDue) {
      throw new RentalDbError(
        "PAYMENT_EXCEEDS_BALANCE",
        "El pago supera el saldo pendiente.",
      );
    }

    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO booking_payments (
        id,
        booking_id,
        amount,
        method,
        note,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      `pay-${randomUUID().slice(0, 8)}`,
      bookingId,
      amount,
      input.method,
      input.note?.trim() || null,
      now,
    );

    const updatedBooking = getBookingById(bookingId);

    if (
      updatedBooking.balanceDue === 0 &&
      (updatedBooking.status === "pendiente" ||
        updatedBooking.status === "confirmado")
    ) {
      db.prepare(
        `UPDATE bookings
        SET status = ?, updated_at = ?
        WHERE id = ?`,
      ).run("pagado", now, bookingId);

      return getBookingById(bookingId);
    }

    return updatedBooking;
  });

  return writePayment();
}

export function recordExternalBookingPayment(
  bookingId: string,
  input: RecordExternalBookingPaymentInput,
) {
  ensureDatabase();

  const amount = normalizePaymentAmount(input.amount);
  const provider = input.provider.trim().toLowerCase();
  const externalPaymentId = input.externalPaymentId.trim();

  if (!provider || !externalPaymentId) {
    throw new RentalDbError(
      "INVALID_EXTERNAL_PAYMENT",
      "El pago externo no es valido.",
    );
  }

  if (!paymentMethods.includes(input.method)) {
    throw new RentalDbError("INVALID_PAYMENT_METHOD", "El metodo no es valido.");
  }

  const writePayment = db.transaction(() => {
    const existingSource = db
      .prepare(
        `SELECT booking_payment_id
        FROM booking_payment_sources
        WHERE provider = ?
          AND external_payment_id = ?`,
      )
      .get(provider, externalPaymentId) as
      | { booking_payment_id: string }
      | undefined;

    if (existingSource) {
      return getBookingById(bookingId);
    }

    const booking = getBookingById(bookingId);

    if (booking.balanceDue <= 0) {
      return booking;
    }

    const payableAmount = Math.min(amount, booking.balanceDue);
    const now = new Date().toISOString();
    const paymentId = `pay-${randomUUID().slice(0, 8)}`;

    db.prepare(
      `INSERT INTO booking_payments (
        id,
        booking_id,
        amount,
        method,
        note,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      paymentId,
      bookingId,
      payableAmount,
      input.method,
      input.note?.trim() || null,
      now,
    );

    db.prepare(
      `INSERT INTO booking_payment_sources (
        provider,
        external_payment_id,
        booking_payment_id,
        created_at
      ) VALUES (?, ?, ?, ?)`,
    ).run(provider, externalPaymentId, paymentId, now);

    const updatedBooking = getBookingById(bookingId);

    if (
      updatedBooking.balanceDue === 0 &&
      (updatedBooking.status === "pendiente" ||
        updatedBooking.status === "confirmado")
    ) {
      db.prepare(
        `UPDATE bookings
        SET status = ?, updated_at = ?
        WHERE id = ?`,
      ).run("pagado", now, bookingId);

      return getBookingById(bookingId);
    }

    if (updatedBooking.status === "pendiente") {
      db.prepare(
        `UPDATE bookings
        SET status = ?, updated_at = ?
        WHERE id = ?`,
      ).run("confirmado", now, bookingId);

      return getBookingById(bookingId);
    }

    return updatedBooking;
  });

  return writePayment();
}

export function recordBookingOperation(
  bookingId: string,
  input: RecordBookingOperationInput,
) {
  ensureDatabase();

  if (!bookingOperationStages.includes(input.stage)) {
    throw new RentalDbError("INVALID_OPERATION_STAGE", "La operacion no es valida.");
  }

  const damageFee = normalizeChargeAmount(input.damageFee);
  const missingFee = normalizeChargeAmount(input.missingFee);

  const writeOperation = db.transaction(() => {
    const booking = getBookingById(bookingId);

    if (booking.status === "cancelado") {
      throw new RentalDbError(
        "OPERATION_NOT_ALLOWED",
        "No se puede operar una reserva cancelada.",
      );
    }

    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO booking_operations (
        id,
        booking_id,
        stage,
        equipment_checked,
        accessories_checked,
        power_checked,
        condition_notes,
        damage_fee,
        missing_fee,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      `op-${randomUUID().slice(0, 8)}`,
      bookingId,
      input.stage,
      input.equipmentChecked ? 1 : 0,
      input.accessoriesChecked ? 1 : 0,
      input.powerChecked ? 1 : 0,
      input.conditionNotes?.trim() || null,
      damageFee,
      missingFee,
      now,
    );

    const nextStatus = input.stage === "retiro" ? "retirado" : "devuelto";

    if (booking.status !== nextStatus && booking.status !== "devuelto") {
      db.prepare(
        `UPDATE bookings
        SET status = ?, updated_at = ?
        WHERE id = ?`,
      ).run(nextStatus, now, bookingId);
    }

    return getBookingById(bookingId);
  });

  return writeOperation();
}

export function listInventoryProducts() {
  ensureDatabase();

  return getProducts();
}

export function listInventoryBlocks(): InventoryBlock[] {
  ensureDatabase();

  return getInventoryBlocks();
}

export function createInventoryBlock(input: InventoryBlockInput) {
  ensureDatabase();

  const productId = input.productId.trim();
  const quantity = normalizeBlockQuantity(input.quantity);
  const note = input.note?.trim() || null;

  if (!productId) {
    throw new RentalDbError("INVALID_PRODUCT", "El equipo es obligatorio.");
  }

  if (!inventoryBlockReasons.includes(input.reason)) {
    throw new RentalDbError("INVALID_BLOCK_REASON", "El motivo no es valido.");
  }

  if (!isValidRentalWindow(input.window)) {
    throw new RentalDbError("INVALID_WINDOW", "El rango del bloqueo no es valido.");
  }

  const writeBlock = db.transaction(() => {
    const product = getProductsByIds([productId]).get(productId);

    if (!product) {
      throw new RentalDbError("PRODUCT_NOT_FOUND", "No se encontro el equipo.");
    }

    const availability = getProductAvailability(product, input.window);

    if (quantity > availability.availableUnits) {
      throw new RentalDbError(
        "BLOCK_EXCEEDS_AVAILABILITY",
        "El bloqueo supera el stock disponible para esas fechas.",
      );
    }

    const blockId = `blk-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO inventory_blocks (
        id,
        product_id,
        quantity,
        start_at,
        end_at,
        reason,
        note,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      blockId,
      productId,
      quantity,
      input.window.start,
      input.window.end,
      input.reason,
      note,
      now,
    );

    return getInventoryBlockById(blockId);
  });

  return writeBlock();
}

export function deleteInventoryBlock(blockId: string) {
  ensureDatabase();

  const id = blockId.trim();

  if (!id) {
    throw new RentalDbError("INVALID_BLOCK", "El bloqueo no es valido.");
  }

  const result = db.prepare("DELETE FROM inventory_blocks WHERE id = ?").run(id);

  if (result.changes === 0) {
    throw new RentalDbError("BLOCK_NOT_FOUND", "No se encontro el bloqueo.");
  }

  return { id };
}

export function createProductCatalogItem(input: ProductCatalogInput) {
  ensureDatabase();

  const product = normalizeProductCatalogInput(input);
  const productId = createProductId(product.name);
  const now = new Date().toISOString();

  try {
    db.prepare(
      `INSERT INTO products (
        id,
        name,
        category,
        total_units,
        maintenance_units,
        price_per_day,
        image_url,
        specs,
        tags_json,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      productId,
      product.name,
      product.category,
      product.totalUnits,
      product.maintenanceUnits,
      product.pricePerDay,
      product.imageUrl,
      product.specs,
      JSON.stringify(product.tags),
      now,
      now,
    );
  } catch (error) {
    if (isSqliteConstraintError(error)) {
      throw new RentalDbError(
        "PRODUCT_ALREADY_EXISTS",
        "Ya existe un equipo con ese identificador.",
      );
    }

    throw error;
  }

  const createdProduct = getProductsByIds([productId]).get(productId);

  if (!createdProduct) {
    throw new RentalDbError("PRODUCT_NOT_FOUND", "No se encontro el equipo.");
  }

  return createdProduct;
}

export function updateBookingStatus(bookingId: string, status: BookingStatus) {
  ensureDatabase();

  if (!bookingStatuses.includes(status)) {
    throw new RentalDbError("INVALID_STATUS", "El estado no es valido.");
  }

  const now = new Date().toISOString();
  const result = db
    .prepare(
      `UPDATE bookings
      SET status = ?, updated_at = ?
      WHERE id = ?`,
    )
    .run(status, now, bookingId);

  if (result.changes === 0) {
    throw new RentalDbError("BOOKING_NOT_FOUND", "No se encontro la reserva.");
  }

  return getBookingById(bookingId);
}

export function updateProductInventory(input: {
  productId: string;
  totalUnits: number;
  maintenanceUnits: number;
}) {
  ensureDatabase();

  const totalUnits = normalizeInventoryNumber(input.totalUnits);
  const maintenanceUnits = normalizeInventoryNumber(input.maintenanceUnits);

  if (maintenanceUnits > totalUnits) {
    throw new RentalDbError(
      "INVALID_INVENTORY",
      "El stock en taller no puede superar el stock total.",
    );
  }

  const now = new Date().toISOString();
  const result = db
    .prepare(
      `UPDATE products
      SET total_units = ?, maintenance_units = ?, updated_at = ?
      WHERE id = ?`,
    )
    .run(totalUnits, maintenanceUnits, now, input.productId);

  if (result.changes === 0) {
    throw new RentalDbError("PRODUCT_NOT_FOUND", "No se encontro el equipo.");
  }

  const product = getProductsByIds([input.productId]).get(input.productId);

  if (!product) {
    throw new RentalDbError("PRODUCT_NOT_FOUND", "No se encontro el equipo.");
  }

  return product;
}

export function updateProductCatalogItem(
  productId: string,
  input: ProductCatalogInput,
) {
  ensureDatabase();

  const product = normalizeProductCatalogInput(input);
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `UPDATE products
      SET
        name = ?,
        category = ?,
        total_units = ?,
        maintenance_units = ?,
        price_per_day = ?,
        image_url = ?,
        specs = ?,
        tags_json = ?,
        updated_at = ?
      WHERE id = ?`,
    )
    .run(
      product.name,
      product.category,
      product.totalUnits,
      product.maintenanceUnits,
      product.pricePerDay,
      product.imageUrl,
      product.specs,
      JSON.stringify(product.tags),
      now,
      productId,
    );

  if (result.changes === 0) {
    throw new RentalDbError("PRODUCT_NOT_FOUND", "No se encontro el equipo.");
  }

  const updatedProduct = getProductsByIds([productId]).get(productId);

  if (!updatedProduct) {
    throw new RentalDbError("PRODUCT_NOT_FOUND", "No se encontro el equipo.");
  }

  return updatedProduct;
}

function createDatabase() {
  mkdirSync(path.dirname(dbPath), { recursive: true });

  const database = new Database(dbPath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");

  return database;
}

function ensureDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      total_units INTEGER NOT NULL,
      maintenance_units INTEGER NOT NULL DEFAULT 0,
      price_per_day INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      specs TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      client_name TEXT NOT NULL,
      client_phone TEXT NOT NULL,
      client_email TEXT,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      status TEXT NOT NULL,
      subtotal INTEGER NOT NULL,
      deposit INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS booking_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price_per_day INTEGER NOT NULL,
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS booking_payments (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      method TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS booking_payment_sources (
      provider TEXT NOT NULL,
      external_payment_id TEXT NOT NULL,
      booking_payment_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (provider, external_payment_id),
      FOREIGN KEY (booking_payment_id) REFERENCES booking_payments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS booking_operations (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL,
      stage TEXT NOT NULL,
      equipment_checked INTEGER NOT NULL,
      accessories_checked INTEGER NOT NULL,
      power_checked INTEGER NOT NULL,
      condition_notes TEXT,
      damage_fee INTEGER NOT NULL DEFAULT 0,
      missing_fee INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS inventory_blocks (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      reason TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_bookings_window
      ON bookings (start_at, end_at, status);

    CREATE INDEX IF NOT EXISTS idx_booking_items_product
      ON booking_items (product_id);

    CREATE INDEX IF NOT EXISTS idx_booking_payments_booking
      ON booking_payments (booking_id);

    CREATE INDEX IF NOT EXISTS idx_booking_payment_sources_payment
      ON booking_payment_sources (booking_payment_id);

    CREATE INDEX IF NOT EXISTS idx_booking_operations_booking
      ON booking_operations (booking_id, stage);

    CREATE INDEX IF NOT EXISTS idx_inventory_blocks_window
      ON inventory_blocks (product_id, start_at, end_at);
  `);

  seedDatabase();
}

function seedDatabase() {
  const productsCount = db
    .prepare("SELECT COUNT(*) AS total FROM products")
    .get() as { total: number };

  if (productsCount.total > 0) {
    return;
  }

  const now = new Date().toISOString();
  const insertProduct = db.prepare(
    `INSERT INTO products (
      id,
      name,
      category,
      total_units,
      maintenance_units,
      price_per_day,
      image_url,
      specs,
      tags_json,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const insertBooking = db.prepare(
    `INSERT INTO bookings (
      id,
      client_name,
      client_phone,
      client_email,
      start_at,
      end_at,
      status,
      subtotal,
      deposit,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const insertBookingItem = db.prepare(
    `INSERT INTO booking_items (
      booking_id,
      product_id,
      quantity,
      price_per_day
    ) VALUES (?, ?, ?, ?)`,
  );

  const seed = db.transaction(() => {
    for (const product of seedProducts) {
      insertProduct.run(
        product.id,
        product.name,
        product.category,
        product.totalUnits,
        product.maintenanceUnits,
        product.pricePerDay,
        product.imageUrl,
        product.specs,
        JSON.stringify(product.tags),
        now,
        now,
      );
    }

    const productPrices = new Map(
      seedProducts.map((product) => [product.id, product.pricePerDay]),
    );

    for (const booking of seedBookings) {
      const pricePerDay = productPrices.get(booking.productId) ?? 0;
      const subtotal = pricePerDay * booking.quantity * getRentalDays(booking);

      insertBooking.run(
        booking.id,
        booking.client,
        booking.clientPhone ?? "Sin telefono",
        booking.clientEmail ?? null,
        booking.start,
        booking.end,
        booking.status,
        subtotal,
        Math.ceil(subtotal * 0.3),
        now,
        now,
      );
      insertBookingItem.run(
        booking.id,
        booking.productId,
        booking.quantity,
        pricePerDay,
      );
    }
  });

  seed();
}

function getProducts() {
  const rows = db
    .prepare(
      `SELECT
        id,
        name,
        category,
        total_units,
        maintenance_units,
        price_per_day,
        image_url,
        specs,
        tags_json
      FROM products
      ORDER BY
        CASE id
          WHEN 'pa-speaker-15' THEN 1
          WHEN 'sub-18' THEN 2
          WHEN 'wireless-mic' THEN 3
          WHEN 'dj-controller' THEN 4
          WHEN 'moving-head' THEN 5
          WHEN 'led-bar' THEN 6
          WHEN 'fog-machine' THEN 7
          WHEN 'truss-kit' THEN 8
          WHEN 'power-kit' THEN 9
          ELSE 10
        END,
        name ASC`,
    )
    .all() as ProductRow[];

  return rows.map(mapProductRow);
}

function getProductsByIds(productIds: string[]) {
  const uniqueIds = [...new Set(productIds)];

  if (uniqueIds.length === 0) {
    return new Map<string, Product>();
  }

  const placeholders = uniqueIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT
        id,
        name,
        category,
        total_units,
        maintenance_units,
        price_per_day,
        image_url,
        specs,
        tags_json
      FROM products
      WHERE id IN (${placeholders})`,
    )
    .all(...uniqueIds) as ProductRow[];

  return new Map(rows.map((row) => [row.id, mapProductRow(row)]));
}

function getProductAvailability(
  product: Product,
  window: RentalWindow,
  options: { excludeBookingId?: string } = {},
): Pick<ProductAvailability, "availableUnits" | "bookedUnits" | "blockedUnits"> {
  const bookedUnits =
    getBookedUnitsByProduct(window, options).get(product.id) ?? 0;
  const blockedUnits = getBlockedUnitsByProduct(window).get(product.id) ?? 0;

  return {
    bookedUnits,
    blockedUnits,
    availableUnits: Math.max(
      0,
      product.totalUnits -
        product.maintenanceUnits -
        bookedUnits -
        blockedUnits,
    ),
  };
}

function getBookedUnitsByProduct(
  window: RentalWindow,
  options: { excludeBookingId?: string } = {},
) {
  if (!isValidRentalWindow(window)) {
    return new Map<string, number>();
  }

  const placeholders = blockingBookingStatuses.map(() => "?").join(",");
  const excludeBookingClause = options.excludeBookingId
    ? "AND bookings.id <> ?"
    : "";
  const params = options.excludeBookingId
    ? [...blockingBookingStatuses, window.end, window.start, options.excludeBookingId]
    : [...blockingBookingStatuses, window.end, window.start];
  const rows = db
    .prepare(
      `SELECT
        booking_items.product_id,
        SUM(booking_items.quantity) AS booked_units
      FROM booking_items
      INNER JOIN bookings ON bookings.id = booking_items.booking_id
      WHERE bookings.status IN (${placeholders})
        AND bookings.start_at < ?
        AND bookings.end_at > ?
        ${excludeBookingClause}
      GROUP BY booking_items.product_id`,
    )
    .all(...params) as BookedUnitsRow[];

  return new Map(
    rows.map((row) => [row.product_id, Number(row.booked_units ?? 0)]),
  );
}

function getBlockedUnitsByProduct(window: RentalWindow) {
  if (!isValidRentalWindow(window)) {
    return new Map<string, number>();
  }

  const rows = db
    .prepare(
      `SELECT
        product_id,
        SUM(quantity) AS blocked_units
      FROM inventory_blocks
      WHERE start_at < ?
        AND end_at > ?
      GROUP BY product_id`,
    )
    .all(window.end, window.start) as BlockedUnitsRow[];

  return new Map(
    rows.map((row) => [row.product_id, Number(row.blocked_units ?? 0)]),
  );
}

function getActiveBookingsCount() {
  const placeholders = blockingBookingStatuses.map(() => "?").join(",");
  const row = db
    .prepare(
      `SELECT COUNT(*) AS active_bookings
      FROM bookings
      WHERE status IN (${placeholders})`,
    )
    .get(...blockingBookingStatuses) as ActiveBookingsRow;

  return row.active_bookings;
}

function getBookingById(bookingId: string): AdminBooking {
  const booking = db
    .prepare(
      `SELECT
        id,
        client_name,
        client_phone,
        client_email,
        start_at,
        end_at,
        status,
        subtotal,
        deposit,
        created_at
      FROM bookings
      WHERE id = ?`,
    )
    .get(bookingId) as BookingRow | undefined;

  if (!booking) {
    throw new RentalDbError("BOOKING_NOT_FOUND", "No se encontro la reserva.");
  }

  return mapBookingRow(booking);
}

function mapBookingRow(booking: BookingRow): AdminBooking {
  const payments = getBookingPayments(booking.id);
  const operations = getBookingOperations(booking.id);
  const paidTotal = payments.reduce((total, payment) => total + payment.amount, 0);
  const extraCharges = operations.reduce(
    (total, operation) => total + operation.damageFee + operation.missingFee,
    0,
  );
  const isCanceled = booking.status === "cancelado";
  const totalDue = isCanceled ? 0 : booking.subtotal + extraCharges;

  return {
    id: booking.id,
    clientName: booking.client_name,
    clientPhone: booking.client_phone,
    clientEmail: booking.client_email,
    start: booking.start_at,
    end: booking.end_at,
    status: booking.status,
    subtotal: booking.subtotal,
    deposit: booking.deposit,
    extraCharges,
    totalDue,
    paidTotal,
    balanceDue: isCanceled ? 0 : Math.max(0, totalDue - paidTotal),
    createdAt: booking.created_at,
    items: getBookingItems(booking.id),
    payments,
    operations,
  };
}

function mapPublicBooking(booking: AdminBooking): PublicBooking {
  return {
    id: booking.id,
    clientName: booking.clientName,
    start: booking.start,
    end: booking.end,
    status: booking.status,
    subtotal: booking.subtotal,
    deposit: booking.deposit,
    totalDue: booking.totalDue,
    paidTotal: booking.paidTotal,
    balanceDue: booking.balanceDue,
    createdAt: booking.createdAt,
    items: booking.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      pricePerDay: item.pricePerDay,
    })),
    payments: booking.payments.map((payment) => ({
      amount: payment.amount,
      method: payment.method,
      createdAt: payment.createdAt,
    })),
  };
}

function getBookingItems(bookingId: string) {
  const rows = db
    .prepare(
      `SELECT
        booking_items.product_id,
        products.name AS product_name,
        booking_items.quantity,
        booking_items.price_per_day
      FROM booking_items
      INNER JOIN products ON products.id = booking_items.product_id
      WHERE booking_items.booking_id = ?
      ORDER BY products.name ASC`,
    )
    .all(bookingId) as BookingItemRow[];

  return rows.map((row) => ({
    productId: row.product_id,
    productName: row.product_name,
    quantity: row.quantity,
    pricePerDay: row.price_per_day,
  }));
}

function getBookingPayments(bookingId: string): BookingPayment[] {
  const rows = db
    .prepare(
      `SELECT
        id,
        amount,
        method,
        note,
        created_at
      FROM booking_payments
      WHERE booking_id = ?
      ORDER BY created_at ASC`,
    )
    .all(bookingId) as PaymentRow[];

  return rows.map((row) => ({
    id: row.id,
    amount: row.amount,
    method: row.method,
    note: row.note,
    createdAt: row.created_at,
  }));
}

function getBookingOperations(bookingId: string): BookingOperation[] {
  const rows = db
    .prepare(
      `SELECT
        id,
        stage,
        equipment_checked,
        accessories_checked,
        power_checked,
        condition_notes,
        damage_fee,
        missing_fee,
        created_at
      FROM booking_operations
      WHERE booking_id = ?
      ORDER BY created_at ASC`,
    )
    .all(bookingId) as OperationRow[];

  return rows.map((row) => ({
    id: row.id,
    stage: row.stage,
    equipmentChecked: row.equipment_checked === 1,
    accessoriesChecked: row.accessories_checked === 1,
    powerChecked: row.power_checked === 1,
    conditionNotes: row.condition_notes,
    damageFee: row.damage_fee,
    missingFee: row.missing_fee,
    createdAt: row.created_at,
  }));
}

function getInventoryBlocks() {
  const rows = db
    .prepare(
      `SELECT
        inventory_blocks.id,
        inventory_blocks.product_id,
        products.name AS product_name,
        inventory_blocks.quantity,
        inventory_blocks.start_at,
        inventory_blocks.end_at,
        inventory_blocks.reason,
        inventory_blocks.note,
        inventory_blocks.created_at
      FROM inventory_blocks
      INNER JOIN products ON products.id = inventory_blocks.product_id
      ORDER BY inventory_blocks.start_at ASC, inventory_blocks.created_at ASC`,
    )
    .all() as InventoryBlockRow[];

  return rows.map(mapInventoryBlockRow);
}

function getInventoryBlockById(blockId: string): InventoryBlock {
  const row = db
    .prepare(
      `SELECT
        inventory_blocks.id,
        inventory_blocks.product_id,
        products.name AS product_name,
        inventory_blocks.quantity,
        inventory_blocks.start_at,
        inventory_blocks.end_at,
        inventory_blocks.reason,
        inventory_blocks.note,
        inventory_blocks.created_at
      FROM inventory_blocks
      INNER JOIN products ON products.id = inventory_blocks.product_id
      WHERE inventory_blocks.id = ?`,
    )
    .get(blockId) as InventoryBlockRow | undefined;

  if (!row) {
    throw new RentalDbError("BLOCK_NOT_FOUND", "No se encontro el bloqueo.");
  }

  return mapInventoryBlockRow(row);
}

function mapProductRow(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    totalUnits: row.total_units,
    maintenanceUnits: row.maintenance_units,
    pricePerDay: row.price_per_day,
    imageUrl: row.image_url,
    specs: row.specs,
    tags: JSON.parse(row.tags_json) as string[],
  };
}

function mapInventoryBlockRow(row: InventoryBlockRow): InventoryBlock {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    quantity: row.quantity,
    start: row.start_at,
    end: row.end_at,
    reason: row.reason,
    note: row.note,
    createdAt: row.created_at,
  };
}

function normalizeBookingDetailsInput(
  input: BookingDetailsInput,
): NormalizedBookingDetails {
  const customer = {
    name: input.customer.name.trim(),
    phone: input.customer.phone.trim(),
    email: input.customer.email?.trim() || undefined,
  };
  const window = {
    start: input.window.start.trim(),
    end: input.window.end.trim(),
  };
  const itemQuantities = new Map<string, number>();

  if (!customer.name || !customer.phone) {
    throw new RentalDbError("CLIENT_REQUIRED", "Faltan datos del cliente.");
  }

  if (!isValidRentalWindow(window)) {
    throw new RentalDbError("INVALID_WINDOW", "El rango de alquiler no es valido.");
  }

  for (const item of input.items) {
    const productId = item.productId.trim();
    const quantity = Number(item.quantity);

    if (!productId && quantity <= 0) {
      continue;
    }

    if (!productId) {
      throw new RentalDbError("INVALID_PRODUCT", "El equipo es obligatorio.");
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new RentalDbError(
        "INVALID_ITEM_QUANTITY",
        "La cantidad debe ser un numero entero mayor a cero.",
      );
    }

    itemQuantities.set(productId, (itemQuantities.get(productId) ?? 0) + quantity);
  }

  const items = [...itemQuantities].map(([productId, quantity]) => ({
    productId,
    quantity,
  }));

  if (items.length === 0) {
    throw new RentalDbError("EMPTY_CART", "El pedido no tiene equipos.");
  }

  return {
    customer,
    window,
    items,
  };
}

function normalizePhoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

function doPhoneLookupMatch(storedPhone: string, providedPhone: string) {
  const providedDigits = normalizePhoneDigits(providedPhone);

  if (providedDigits.length >= 6 && doPhoneDigitsMatch(storedPhone, providedDigits)) {
    return true;
  }

  const storedText = normalizeLookupText(storedPhone);
  const providedText = normalizeLookupText(providedPhone);

  return providedText.length >= 3 && storedText === providedText;
}

function doPhoneDigitsMatch(storedPhone: string, providedDigits: string) {
  const storedDigits = normalizePhoneDigits(storedPhone);
  const comparableLength = Math.min(8, storedDigits.length, providedDigits.length);

  if (comparableLength < 6) {
    return false;
  }

  return (
    storedDigits.slice(-comparableLength) ===
    providedDigits.slice(-comparableLength)
  );
}

function normalizeLookupText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeInventoryNumber(value: number) {
  if (!Number.isInteger(value) || value < 0) {
    throw new RentalDbError(
      "INVALID_INVENTORY",
      "El inventario debe ser un numero entero positivo.",
    );
  }

  return value;
}

function normalizeBlockQuantity(value: number) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RentalDbError(
      "INVALID_BLOCK_QUANTITY",
      "El bloqueo debe ser un numero entero mayor a cero.",
    );
  }

  return value;
}

function normalizePaymentAmount(value: number) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RentalDbError(
      "INVALID_PAYMENT_AMOUNT",
      "El pago debe ser un numero entero mayor a cero.",
    );
  }

  return value;
}

function normalizeChargeAmount(value: number) {
  if (!Number.isInteger(value) || value < 0) {
    throw new RentalDbError(
      "INVALID_CHARGE_AMOUNT",
      "El cargo debe ser un numero entero positivo.",
    );
  }

  return value;
}

function normalizeProductCatalogInput(input: ProductCatalogInput): Product {
  const name = input.name.trim();
  const imageUrl = input.imageUrl.trim();
  const specs = input.specs.trim();
  const totalUnits = normalizeInventoryNumber(input.totalUnits);
  const maintenanceUnits = normalizeInventoryNumber(input.maintenanceUnits);
  const pricePerDay = normalizePrice(input.pricePerDay);
  const tags = input.tags
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .slice(0, 8);

  if (!name) {
    throw new RentalDbError("INVALID_PRODUCT_NAME", "El nombre es obligatorio.");
  }

  if (!categories.includes(input.category)) {
    throw new RentalDbError("INVALID_CATEGORY", "La categoria no es valida.");
  }

  if (maintenanceUnits > totalUnits) {
    throw new RentalDbError(
      "INVALID_INVENTORY",
      "El stock en taller no puede superar el stock total.",
    );
  }

  if (!imageUrl) {
    throw new RentalDbError("INVALID_IMAGE_URL", "La imagen es obligatoria.");
  }

  if (!specs) {
    throw new RentalDbError("INVALID_SPECS", "La descripcion es obligatoria.");
  }

  return {
    id: "",
    name,
    category: input.category,
    totalUnits,
    maintenanceUnits,
    pricePerDay,
    imageUrl,
    specs,
    tags,
  };
}

function normalizePrice(value: number) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RentalDbError(
      "INVALID_PRICE",
      "El precio debe ser un numero entero mayor a cero.",
    );
  }

  return value;
}

function createProductId(name: string) {
  const baseId =
    name
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "equipo";

  return `${baseId}-${randomUUID().slice(0, 6)}`;
}

function isSqliteConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "SQLITE_CONSTRAINT_PRIMARYKEY"
  );
}

export class RentalDbError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "RentalDbError";
  }
}
