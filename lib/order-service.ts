import { randomBytes } from "node:crypto";
import { get, run, transaction, type Executor } from "@/lib/db";
import { AppError } from "@/lib/http";
import { cleanMultiline, cleanText, dateOnly, isEmail, moneyIdr, normalizeEmail } from "@/lib/utils";
import { resolveCartItems } from "@/lib/catalog-service";

const CHANNELS = {
  website: { label: "Website", category: "Penjualan Online", payment: "Demo checkout" }
};

export function getPromo(settings: Record<string, any>, suppliedCode: unknown) {
  const code = cleanText(suppliedCode, 30).toUpperCase();
  if (!code) return { valid: false, discountCents: 0, code: "", percent: 0 };
  const expected = String(settings.promo_code || "").trim().toUpperCase();
  const percent = Number(settings.promo_percent || 0);
  const valid = Boolean(expected) && code === expected && percent > 0;
  return { valid, discountCents: 0, code: valid ? code : "", percent: valid ? Math.min(percent, 100) : 0 };
}

export function calculateDiscount(subtotalCents: number, promo: { valid: boolean; percent: number }) {
  if (!promo.valid || !promo.percent) return 0;
  return Math.round(subtotalCents * (promo.percent / 100));
}

async function createOrderNumber(ex: Executor) {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const number = `SE-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
    const exists = await get("SELECT 1 FROM orders WHERE order_number = ?", [number], ex);
    if (!exists) return number;
  }
  return `SE-${date}-${Date.now().toString(36).toUpperCase()}`;
}

function validateWebsiteOrder(input: Record<string, any>) {
  const errors: Record<string, string> = {};
  const email = normalizeEmail(input?.email);
  if (!isEmail(email)) errors.email = "Masukkan alamat email yang valid.";
  const firstName = cleanText(input?.firstName, 80);
  const lastName = cleanText(input?.lastName, 80);
  if (!firstName) errors.firstName = "Nama depan wajib diisi.";
  const phone = cleanText(input?.phone, 40);
  if (phone.replace(/\D/g, "").length < 6) errors.phone = "Nomor telepon belum valid.";
  const address1 = cleanText(input?.address1, 200);
  if (!address1) errors.address1 = "Alamat wajib diisi.";
  const city = cleanText(input?.city, 100);
  if (!city) errors.city = "Kota wajib diisi.";
  const postalCode = cleanText(input?.postalCode, 20);
  if (!postalCode) errors.postalCode = "Kode pos wajib diisi.";
  const country = cleanText(input?.country, 80) || "Indonesia";
  const region = cleanText(input?.region, 100);
  const items = Array.isArray(input?.items) ? input.items : [];
  if (!items.length) errors.items = "Tas Anda kosong.";
  if (Object.keys(errors).length) {
    throw new AppError(422, Object.values(errors)[0], "validation");
  }
  return {
    email,
    firstName,
    lastName,
    phone,
    address1,
    address2: cleanText(input?.address2, 200),
    city,
    region,
    postalCode,
    country,
    note: cleanMultiline(input?.note, 500),
    items,
    promoCode: cleanText(input?.promoCode, 30),
    currency: input?.currency === "IDR" ? "IDR" : "USD"
  };
}

async function insertFinance(
  ex: Executor,
  {
    type,
    amountIdr,
    category,
    source = "",
    paymentMethod = "",
    description,
    note = "",
    entryDate,
    orderId = null,
    createdBy = null,
    isManual = 0
  }: Record<string, any>
) {
  if (!Number.isFinite(Number(amountIdr)) || Number(amountIdr) <= 0) return null;
  return run(
    `INSERT INTO finance_entries (
      type, amount_idr, category, source, payment_method, description, note,
      entry_date, order_id, created_by, is_manual, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      type,
      Math.round(Number(amountIdr)),
      category,
      source,
      paymentMethod,
      cleanText(description, 250),
      cleanText(note, 500),
      entryDate || dateOnly(),
      orderId,
      createdBy,
      isManual,
      new Date().toISOString()
    ],
    ex
  );
}

export async function createWebsiteOrder({
  user = null,
  sessionHash = "",
  input = {},
  settings = {}
}: {
  user?: { id: number; role: string } | null;
  sessionHash?: string;
  input?: Record<string, any>;
  settings?: Record<string, any>;
}) {
  const data = validateWebsiteOrder(input);
  const rate = Number(settings.exchange_rate || 0) || 16000;
  const promo = getPromo(settings, data.promoCode);
  if (data.promoCode && !promo.valid) {
    throw new AppError(400, "Kode promo tidak valid.", "promo_invalid");
  }

  return transaction(async (tx) => {
    const orderNumber = await createOrderNumber(tx);
    const createdBy = user?.role === "admin" ? user.id : null;
    const resolved = await resolveCartItems(data.items, tx);
    if (!resolved.items.length) throw new AppError(422, "Tas Anda kosong.", "cart_empty");
    if (resolved.items.some((item) => !item.available)) {
      throw new AppError(409, "Satu atau beberapa karya tidak lagi tersedia dalam jumlah yang diminta.", "stock");
    }

    const subtotal = resolved.items.reduce((sum, item) => sum + item.lineTotalCents, 0);
    const discount = calculateDiscount(subtotal, promo);
    const total = Math.max(0, subtotal - discount);
    const totalIdr = moneyIdr(total, rate);
    const now = new Date().toISOString();

    const orderInsert = await run(
      `INSERT INTO orders (
        order_number, user_id, session_hash, email, first_name, last_name, phone,
        address1, address2, city, region, postal_code, country, channel, status,
        currency, exchange_rate, subtotal_usd_cents, discount_usd_cents, total_usd_cents,
        total_idr, promo_code, note, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'website', 'paid', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderNumber,
        user?.id || null,
        sessionHash || "",
        data.email,
        data.firstName,
        data.lastName,
        data.phone,
        data.address1,
        data.address2,
        data.city,
        data.region,
        data.postalCode,
        data.country,
        data.currency,
        rate,
        subtotal,
        discount,
        total,
        totalIdr,
        promo.code,
        data.note,
        createdBy,
        now,
        now
      ],
      tx
    );
    const orderId = Number(orderInsert.lastInsertRowid);

    for (const item of resolved.items) {
      await run(
        `INSERT INTO order_items (
          order_id, product_id, variant_id, product_name, variant_label,
          unit_price_usd_cents, quantity, total_usd_cents
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, item.productId, item.variantId, item.name, item.label, item.priceCents, item.quantity, item.lineTotalCents],
        tx
      );
      const stockRow = await get<{ stock: number }>("SELECT stock, product_id FROM variants WHERE id = ?", [item.variantId], tx);
      const changes = await run(
        "UPDATE variants SET stock = stock - ? WHERE id = ? AND stock >= ?",
        [item.quantity, item.variantId, item.quantity],
        tx
      );
      if (Number(changes.changes) !== 1) {
        throw new AppError(409, `Stok ${item.name} (${item.label}) tidak mencukupi.`, "stock");
      }
      await run(
        `INSERT INTO inventory_movements (
          variant_id, product_id, type, qty_change, stock_after, reference, supplier, note,
          unit_cost_idr, created_by, created_at
        ) VALUES (?, ?, 'sale', ?, ?, ?, '', 'Pesanan online', 0, ?, ?)`,
        [
          item.variantId,
          item.productId,
          -item.quantity,
          Number(stockRow?.stock ?? 0) - item.quantity,
          orderNumber,
          createdBy,
          now
        ],
        tx
      );
    }

    await insertFinance(tx, {
      type: "income",
      amountIdr: totalIdr,
      category: CHANNELS.website.category,
      source: "Website",
      paymentMethod: CHANNELS.website.payment,
      description: `Pesanan ${orderNumber} · ${data.firstName} ${data.lastName}`.trim(),
      note: data.promoCode ? `Promo ${promo.code}` : "",
      entryDate: dateOnly(),
      orderId,
      createdBy,
      isManual: 0
    });

    await run(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, created_at)
       VALUES (?, 'order.created', 'order', ?, ?, ?)`,
      [createdBy, String(orderId), JSON.stringify({ orderNumber, total, currency: data.currency }), now],
      tx
    );

    return {
      id: orderId,
      orderNumber,
      subtotalCents: subtotal,
      discountCents: discount,
      totalCents: total,
      totalIdr,
      currency: data.currency,
      exchangeRate: rate,
      promo: promo.valid ? promo.code : "",
      items: resolved.items,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      createdAt: now
    };
  });
}
