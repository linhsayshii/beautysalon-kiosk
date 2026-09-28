import { settlement, roundMoney, beginPaymentRequest, finishPaymentRequest, recordPayment } from '../debts/debts.service.js';
import { pool } from '../../db.js';
import { HttpError } from '../../lib/http.js';
import { broadcastToBranch, realtimeEvents } from '../../lib/ws.js';
import { publishNotification } from '../notifications/notifications.service.js';
import { resolveApplicablePricebook, resolvePricebookItemPrice } from '../inventory/inventory.service.js';
import { recordCashEntry } from '../cashbook/cashbook.ledger.js';
import { config } from '../../config.js';

const number = (value) => Number(value ?? 0);

function generateInvoiceCode() {
  const dateStr = new Intl.DateTimeFormat('en-GB', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()).replace(/\//g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `HD${dateStr}-${randomSuffix}`;
}

/**
 * Xử lý trừ lượt gói dịch vụ trong checkout
 * @param {Object} client - PostgreSQL client (transaction)
 * @param {Object} params - { customerId, packageId, serviceId, invoiceId, units }
 * @returns {Promise<void>}
 */
async function processPackageRedemption(client, { customerId, packageId, serviceId, invoiceId, units = 1 }) {
  // Verify package belongs to customer và còn lượt
  const pkgCheck = await client.query(
    `SELECT id, package_id, used_units, total_units, status, expires_at
     FROM customer_packages
     WHERE id = $1 AND customer_id = $2 AND status = 'active'
       AND used_units + $3 <= total_units
       AND (expires_at IS NULL OR expires_at > NOW())
     FOR UPDATE`,
    [packageId, customerId, units],
  );
  if (!pkgCheck.rows[0]) {
    throw new HttpError(400, 'PACKAGE_NOT_AVAILABLE', 'Gói dịch vụ không khả dụng hoặc đã hết lượt');
  }

  // Verify service thuộc về package
  const serviceCheck = await client.query(
    `SELECT spi.id FROM service_package_items spi
     WHERE spi.package_id = $1 AND spi.service_id = $2`,
    [pkgCheck.rows[0].package_id, serviceId],
  );
  if (!serviceCheck.rows[0]) {
    throw new HttpError(400, 'SERVICE_NOT_IN_PACKAGE', 'Dịch vụ không nằm trong gói này');
  }

  // Update used_units
  await client.query(`UPDATE customer_packages SET used_units = used_units + $2 WHERE id = $1`, [packageId, units]);

  // Record usage
  await client.query(
    `INSERT INTO package_usages (customer_package_id, service_id, invoice_id, units_used, used_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [packageId, serviceId, invoiceId, units],
  );
}

export async function listPosPaymentRequests({ branchId }) {
  const result = await pool.query(
    `SELECT
       i.id, i.code, i.total, i.issued_at, i.payment_requested_at,
       COALESCE(c.name, 'Khách lẻ') AS customer_name, c.phone AS customer_phone,
       requester.name AS requested_by_name,
       COUNT(*) FILTER (WHERE ii.item_type = 'service' AND ii.appointment_id IS NOT NULL) AS service_total,
       COUNT(*) FILTER (
         WHERE ii.item_type = 'service' AND ii.appointment_id IS NOT NULL AND a.status = 'completed'
       ) AS service_completed
     FROM invoices i
     LEFT JOIN customers c ON c.id = i.customer_id
     LEFT JOIN staff requester ON requester.id = i.payment_requested_by_staff_id
     LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
     LEFT JOIN appointments a ON a.id = ii.appointment_id
     WHERE i.branch_id = $1
       AND i.status = 'draft'
       AND i.payment_requested_at IS NOT NULL
     GROUP BY i.id, c.name, c.phone, requester.name
     ORDER BY i.payment_requested_at ASC, i.id ASC`,
    [branchId],
  );

  return result.rows.map((row) => ({
    id: number(row.id),
    code: row.code,
    total: number(row.total),
    issuedAt: row.issued_at,
    paymentRequestedAt: row.payment_requested_at,
    requestedByName: row.requested_by_name || null,
    customer: { name: row.customer_name, phone: row.customer_phone || null },
    serviceProgress: {
      total: number(row.service_total),
      completed: number(row.service_completed),
    },
  }));
}

export async function checkoutPosInvoice({
  branchId,
  actorAccountId,
  actorStaffId,
  customerId,
  staffId,
  lines,
  discount,
  paymentMethod,
  amountPaid,
  allowDebt = false,
  requestKey,
  note,
  appointmentId,
  invoiceId: requestedInvoiceId,
}) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new HttpError(400, 'EMPTY_CART', 'Hóa đơn phải có ít nhất một dịch vụ hoặc sản phẩm');
  }
  if (!customerId) {
    throw new HttpError(400, 'CUSTOMER_REQUIRED', 'Vui lòng chọn khách hàng trước khi thanh toán');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const replay = await beginPaymentRequest(client, branchId, requestKey, {operation:'checkout', actorAccountId, customerId, staffId, lines, discount, paymentMethod, amountPaid, allowDebt, note, appointmentId, requestedInvoiceId});
    if (replay) { await client.query('COMMIT'); return replay; }

    // 1. A sale must always belong to a customer so packages and account cards
    // can be tracked against the correct customer record.
    let customerName;
    let customerPhone = null;
    let customerCode = null;
    const custResult = await client.query(
      'SELECT id, code, name, phone, debt_balance FROM customers WHERE id = $1 AND branch_id = $2 FOR UPDATE',
      [customerId, branchId],
    );
    if (!custResult.rows[0]) {
      throw new HttpError(404, 'CUSTOMER_NOT_FOUND', 'Khách hàng không tồn tại hoặc không thuộc chi nhánh này');
    }
    customerName = custResult.rows[0].name;
    customerPhone = custResult.rows[0].phone;
    customerCode = custResult.rows[0].code;
    const appliedPricebook = await resolveApplicablePricebook(client, { branchId, customerId });

    // 2. Validate Staff if provided
    let staffName = null;
    if (staffId) {
      const staffResult = await client.query(
        'SELECT id, name, role FROM staff WHERE id = $1 AND branch_id = $2 AND active = TRUE',
        [staffId, branchId],
      );
      if (!staffResult.rows[0]) {
        throw new HttpError(404, 'STAFF_NOT_FOUND', 'Nhân viên không tồn tại hoặc đã ngừng hoạt động');
      }
      staffName = staffResult.rows[0].name;
    }

    // 3. Process lines, verify prices & stock
    let subtotal = 0;
    const validatedItems = [];
    const packagesToCreate = [];
    const accountCardsToCreate = [];
    const packageRedemptions = [];
    const createdCustomerPackageIds = [];
    const createdCustomerAccountCardIds = [];
    const changedCustomerAccountCardIds = new Set();

    for (const line of lines) {
      const itemType = String(line.itemType || '').trim();
      const itemId = Number(line.itemId);
      const quantity = Math.max(1, Math.floor(Number(line.quantity || 1)));
      const lineStaffId = line.staffId ? Number(line.staffId) : null;

      if (lineStaffId) {
        const lineStaffResult = await client.query(
          'SELECT id, name FROM staff WHERE id = $1 AND branch_id = $2 AND active = TRUE',
          [lineStaffId, branchId],
        );
        if (!lineStaffResult.rows[0]) {
          throw new HttpError(404, 'STAFF_NOT_FOUND', `Nhân viên #${lineStaffId} không tồn tại hoặc đã ngừng hoạt động`);
        }
      }

      if (!['service', 'product', 'package', 'account_card'].includes(itemType) || !itemId) {
        throw new HttpError(400, 'INVALID_ITEM', 'Hàng hóa hoặc dịch vụ không hợp lệ');
      }

      let price = 0;
      let name = '';
      let code = '';
      let unit = 'lần';

      if (line.usePackageId) {
        // A redeemed service is free on this invoice. Its package usage is
        // recorded once the invoice has an id below.
        const pkgServiceResult = await client.query(
          `SELECT id, code, name, price, commission_type, commission_rate
           FROM services WHERE id = $1 AND branch_id = $2 AND active = TRUE`,
          [line.usePackageServiceId, branchId],
        );
        if (!pkgServiceResult.rows[0]) {
          throw new HttpError(404, 'SERVICE_NOT_FOUND', `Dịch vụ #${line.usePackageServiceId} không tồn tại hoặc đã ngừng hoạt động`);
        }
        const pkgSvc = pkgServiceResult.rows[0];

        validatedItems.push({
          itemType: 'service',
          serviceId: line.usePackageServiceId,
          productId: null,
          customerPackageId: line.usePackageId,
          staffId: lineStaffId || staffId || null,
          code: pkgSvc.code,
          name: pkgSvc.name,
          unit: 'lần',
          quantity,
          unitPrice: 0,
          lineTotal: 0,
          commissionType: pkgSvc.commission_type,
          commissionRate: number(pkgSvc.commission_rate),
        });
        packageRedemptions.push({
          packageId: line.usePackageId,
          serviceId: line.usePackageServiceId,
          units: quantity,
        });

        // Skip normal itemType processing for package redemption
        subtotal += 0;
        continue;
      } else if (itemType === 'service') {
        const sResult = await client.query(
          `SELECT id, code, name, price, commission_type, commission_rate
           FROM services WHERE id = $1 AND branch_id = $2 AND active = TRUE`,
          [itemId, branchId],
        );
        if (!sResult.rows[0]) {
          throw new HttpError(404, 'SERVICE_NOT_FOUND', `Dịch vụ #${itemId} không tồn tại hoặc đã ngừng hoạt động`);
        }
        price = number(sResult.rows[0].price);
        price = await resolvePricebookItemPrice(client, { branchId, pricebookId: appliedPricebook?.id, itemType, itemId, basePrice: price });
        name = sResult.rows[0].name;
        code = sResult.rows[0].code;
        unit = 'lần';

        validatedItems.push({
          itemType: 'service',
          serviceId: itemId,
          productId: null,
          staffId: lineStaffId || staffId || null,
          code,
          name,
          unit,
          quantity,
          unitPrice: price,
          lineTotal: price * quantity,
          commissionType: sResult.rows[0].commission_type,
          commissionRate: number(sResult.rows[0].commission_rate),
        });
      } else if (itemType === 'product') {
        const pResult = await client.query(
          `SELECT p.id, p.sku, p.name, p.sale_price, p.unit, p.commission_type, p.commission_rate,
                  COALESCE(ib.quantity, 0) AS stock_quantity
           FROM products p
           LEFT JOIN inventory_balances ib ON ib.product_id = p.id AND ib.branch_id = p.branch_id
           WHERE p.id = $1 AND p.branch_id = $2 AND p.active = TRUE
           FOR UPDATE OF p`,
          [itemId, branchId],
        );
        if (!pResult.rows[0]) {
          throw new HttpError(404, 'PRODUCT_NOT_FOUND', `Sản phẩm #${itemId} không tồn tại hoặc đã ngừng kinh doanh`);
        }
        const row = pResult.rows[0];
        const stock = number(row.stock_quantity);
        if (stock < quantity) {
          throw new HttpError(400, 'INSUFFICIENT_STOCK', `Sản phẩm "${row.name}" không đủ số lượng tồn kho (Tồn: ${stock}, yêu cầu: ${quantity})`);
        }

        price = number(row.sale_price);
        price = await resolvePricebookItemPrice(client, { branchId, pricebookId: appliedPricebook?.id, itemType, itemId, basePrice: price });
        name = row.name;
        code = row.sku;
        unit = row.unit || 'sản phẩm';

        // Deduct inventory balance
        await client.query(
          `INSERT INTO inventory_balances (branch_id, product_id, quantity, updated_at)
           VALUES ($1, $2, 0, NOW())
           ON CONFLICT (branch_id, product_id)
           DO UPDATE SET quantity = inventory_balances.quantity - $3, updated_at = NOW()`,
          [branchId, itemId, quantity],
        );

        validatedItems.push({
          itemType: 'product',
          serviceId: null,
          productId: itemId,
          staffId: lineStaffId || staffId || null,
          code,
          name,
          unit,
          quantity,
          unitPrice: price,
          lineTotal: price * quantity,
          commissionType: row.commission_type,
          commissionRate: number(row.commission_rate),
        });
      } else if (itemType === 'package') {
        const pkgResult = await client.query(
          'SELECT id, code, name, list_price, total_units, validity_days FROM service_packages WHERE id = $1 AND branch_id = $2 AND active = TRUE',
          [itemId, branchId],
        );
        if (!pkgResult.rows[0]) {
          throw new HttpError(404, 'PACKAGE_NOT_FOUND', `Gói dịch vụ #${itemId} không tồn tại`);
        }
        const pkg = pkgResult.rows[0];
        price = number(pkg.list_price);
        price = await resolvePricebookItemPrice(client, { branchId, pricebookId: appliedPricebook?.id, itemType, itemId, basePrice: price });
        name = pkg.name;
        code = pkg.code;
        unit = 'gói';

        validatedItems.push({
          itemType: 'package',
          serviceId: null,
          productId: null,
          packageId: itemId,
          accountCardId: null,
          staffId: lineStaffId || staffId || null,
          code,
          name: `[Gói] ${name}`,
          unit,
          quantity,
          unitPrice: price,
          lineTotal: price * quantity,
          commissionType: null,
          commissionRate: 0,
        });

        if (customerId) {
          for (let i = 0; i < quantity; i++) {
            packagesToCreate.push({
              packageId: itemId,
              salePrice: price,
              totalUnits: Number(pkg.total_units),
              validityDays: pkg.validity_days ? Number(pkg.validity_days) : null,
            });
          }
        }
      } else if (itemType === 'account_card') {
        const cardResult = await client.query(
          'SELECT id, code, name, sale_price, face_value, validity_days FROM account_cards WHERE id = $1 AND branch_id = $2 AND active = TRUE',
          [itemId, branchId],
        );
        if (!cardResult.rows[0]) {
          throw new HttpError(404, 'CARD_NOT_FOUND', `Thẻ tài khoản #${itemId} không tồn tại`);
        }
        const card = cardResult.rows[0];
        price = number(card.sale_price);
        price = await resolvePricebookItemPrice(client, { branchId, pricebookId: appliedPricebook?.id, itemType, itemId, basePrice: price });
        name = card.name;
        code = card.code;
        unit = 'thẻ';

        validatedItems.push({
          itemType: 'account_card',
          serviceId: null,
          productId: null,
          packageId: null,
          accountCardId: itemId,
          staffId: lineStaffId || staffId || null,
          code,
          name: `[Thẻ] ${name}`,
          unit,
          quantity,
          unitPrice: price,
          lineTotal: price * quantity,
          commissionType: null,
          commissionRate: 0,
        });

        if (customerId) {
          for (let i = 0; i < quantity; i++) {
            accountCardsToCreate.push({
              accountCardId: itemId,
              salePrice: price,
              faceValue: number(card.face_value),
              validityDays: card.validity_days ? Number(card.validity_days) : null,
            });
          }
        }
      }

      subtotal += price * quantity;
    }

    subtotal = roundMoney(subtotal);
    const discountAmount = roundMoney(Math.max(0, Math.min(subtotal, number(discount))));
    const total = roundMoney(Math.max(0, subtotal - discountAmount));
    const payment = settlement(total, amountPaid, paymentMethod, allowDebt);
    const customerDebtBalance = roundMoney(number(custResult.rows[0].debt_balance) + payment.debt);

    // 4. Validate wallet payment has sufficient balance
    let cardBalance = 0;
    if (paymentMethod === 'wallet') {
      if (!customerId) {
        throw new HttpError(400, 'WALLET_REQUIRES_CUSTOMER', 'Thanh toán bằng thẻ tài khoản yêu cầu chọn khách hàng');
      }

      const balanceResult = await client.query(
        `SELECT COALESCE(SUM(cac.current_balance), 0) AS card_balance
         FROM customer_account_cards cac
         WHERE cac.customer_id = $1
           AND cac.branch_id = $2
           AND cac.status = 'active'
           AND (cac.expires_at IS NULL OR cac.expires_at > NOW())`,
        [customerId, branchId],
      );
      cardBalance = number(balanceResult.rows[0]?.card_balance || 0);

      if (cardBalance < total) {
        throw new HttpError(
          400,
          'INSUFFICIENT_BALANCE',
          `Số dư thẻ không đủ (Số dư: ${cardBalance.toLocaleString('vi-VN')}đ, Cần: ${total.toLocaleString('vi-VN')}đ)`,
        );
      }
    }

    // 5. A linked draft is paid in place. Checkout never updates a service
    // work status, and it never creates then discards a second invoice.
    let invoice;
    let invoiceId = requestedInvoiceId || null;
    const appointmentByService = new Map();

    if (!invoiceId && appointmentId) {
      const appointmentResult = await client.query(
        'SELECT invoice_id FROM appointments WHERE id = $1 AND branch_id = $2 FOR UPDATE',
        [appointmentId, branchId],
      );
      if (!appointmentResult.rows[0]) throw new HttpError(404, 'NOT_FOUND', 'Không tìm thấy lịch hẹn');
      invoiceId = appointmentResult.rows[0].invoice_id ? Number(appointmentResult.rows[0].invoice_id) : null;
    }

    if (invoiceId) {
      const existingInvoiceResult = await client.query(
        `SELECT id, code, status, customer_id FROM invoices
         WHERE id = $1 AND branch_id = $2 FOR UPDATE`,
        [invoiceId, branchId],
      );
      const existingInvoice = existingInvoiceResult.rows[0];
      if (!existingInvoice) throw new HttpError(404, 'INVOICE_NOT_FOUND', 'Không tìm thấy hóa đơn');
      if (existingInvoice.status !== 'draft') {
        throw new HttpError(409, 'INVOICE_NOT_DRAFT', 'Hóa đơn này không còn ở trạng thái nháp');
      }

      if (appointmentId) {
        const appointmentResult = await client.query(
          'SELECT id FROM appointments WHERE id = $1 AND branch_id = $2 AND invoice_id = $3 FOR UPDATE',
          [appointmentId, branchId, invoiceId],
        );
        if (!appointmentResult.rows[0]) {
          throw new HttpError(409, 'APPOINTMENT_INVOICE_MISMATCH', 'Lịch hẹn không thuộc hóa đơn đang thanh toán');
        }
      }

      const existingItemsResult = await client.query(
        `SELECT item_type, service_id, appointment_id
         FROM invoice_items WHERE invoice_id = $1 ORDER BY id`,
        [invoiceId],
      );
      const scheduledInvoice = await client.query('SELECT id FROM appointments WHERE invoice_id=$1 AND branch_id=$2 LIMIT 1', [invoiceId, branchId]);
      if (scheduledInvoice.rows.length && Number(existingInvoice.customer_id) !== Number(customerId)) {
        throw new HttpError(409, 'INVOICE_CUSTOMER_LOCKED', 'Khách hàng của hóa đơn từ lịch hẹn không thể thay đổi khi thanh toán');
      }
      for (const item of existingItemsResult.rows) {
        if (item.item_type === 'service' && item.service_id && item.appointment_id) {
          const key = String(item.service_id);
          const queue = appointmentByService.get(key) || [];
          queue.push(Number(item.appointment_id));
          appointmentByService.set(key, queue);
        }
      }
      await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [invoiceId]);
      const updatedInvoiceResult = await client.query(
         `UPDATE invoices
         SET customer_id = $1, staff_id = $2, status = 'paid', subtotal = $3,
             discount = $4, total = $5, payment_method = $6, pricebook_id = $8,
             note = $9, issued_at = NOW()
         WHERE id = $7
         RETURNING id, code, status, subtotal, discount, total, payment_method, sales_channel, note, issued_at`,
        [customerId, staffId || null, subtotal, discountAmount, total, paymentMethod, invoiceId, appliedPricebook?.id ?? null, note || null],
      );
      invoice = updatedInvoiceResult.rows[0];
    } else {
      let invoiceCode = generateInvoiceCode();
      let isUnique = false;
      for (let attempts = 0; attempts < 5; attempts++) {
        const existing = await client.query('SELECT id FROM invoices WHERE code = $1', [invoiceCode]);
        if (!existing.rows[0]) {
          isUnique = true;
          break;
        }
        invoiceCode = generateInvoiceCode();
      }
      if (!isUnique) invoiceCode = `HD${Date.now().toString().slice(-8)}`;
      const invoiceResult = await client.query(
        `INSERT INTO invoices (
           branch_id, customer_id, staff_id, code, status, pricebook_id,
           subtotal, discount, total, payment_method, sales_channel, issued_at, note
         ) VALUES ($1, $2, $3, $4, 'paid', $9, $5, $6, $7, $8, 'salon', NOW(), $10)
         RETURNING id, code, status, subtotal, discount, total, payment_method, sales_channel, note, issued_at`,
        [branchId, customerId, staffId || null, invoiceCode, subtotal, discountAmount, total, paymentMethod, appliedPricebook?.id ?? null, note || null],
      );
      invoice = invoiceResult.rows[0];
      invoiceId = Number(invoice.id);
    }
    const invoiceCode = invoice.code;
    await client.query('UPDATE invoices SET amount_paid=$2 WHERE id=$1', [invoiceId, payment.paid]);
    if (payment.paid > 0) {
      const paymentId = await recordPayment(client, {branchId,customerId,amount:payment.paid,paymentMethod,actorAccountId,note});
      await client.query('INSERT INTO customer_payment_allocations(payment_id,invoice_id,amount) VALUES($1,$2,$3)', [paymentId,invoiceId,payment.paid]);
    }
    if (payment.debt > 0) {
      await client.query('UPDATE customers SET debt_balance=$2 WHERE id=$1', [customerId,customerDebtBalance]);
      await client.query(`INSERT INTO customer_debt_entries(branch_id,customer_id,invoice_id,kind,amount,balance_after,actor_account_id) VALUES($1,$2,$3,'charge',$4,$5,$6)`, [branchId,customerId,invoiceId,payment.debt,customerDebtBalance,actorAccountId]);
    }

    // The usage record is linked to the paid invoice, so redeem packages only
    // after an invoice id exists. The surrounding transaction rolls this back
    // together with the invoice if any validation fails.
    for (const redemption of packageRedemptions) {
      await processPackageRedemption(client, {
        customerId,
        invoiceId,
        ...redemption,
      });
    }

    // 6. Insert invoice items and collect their IDs
    const invoiceItemIds = [];
    for (const item of validatedItems) {
      const appointmentQueue = item.itemType === 'service' && item.serviceId
        ? appointmentByService.get(String(item.serviceId))
        : null;
      const linkedAppointmentId = appointmentQueue?.shift() || null;
      const itemResult = await client.query(
        `INSERT INTO invoice_items (
           invoice_id, item_type, service_id, product_id, package_id, customer_package_id, account_card_id,
           staff_id, appointment_id, description, quantity, unit_price, line_total
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id`,
        [
          invoiceId,
          item.itemType,
          item.serviceId,
          item.productId,
          item.packageId || null,
          item.customerPackageId || null,
          item.accountCardId || null,
          item.staffId || null,
          linkedAppointmentId,
          item.name,
          item.quantity,
          item.unitPrice,
          item.lineTotal,
        ],
      );
      invoiceItemIds.push({
        itemId: Number(itemResult.rows[0].id),
        productId: item.productId,
        staffId: item.staffId,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
        name: item.name,
        itemType: item.itemType,
        commissionType: item.commissionType,
        commissionRate: item.commissionRate,
      });
    }

    const missingScheduledServices = [...appointmentByService.values()]
      .reduce((totalCount, queue) => totalCount + queue.length, 0);
    if (missingScheduledServices > 0) {
      throw new HttpError(
        409,
        'DRAFT_SERVICE_MISSING',
        'Hóa đơn đang có dịch vụ đã đặt lịch. Không thể bỏ dịch vụ này khi thanh toán.',
      );
    }

    // 7. Auto-activate customer packages & account cards if applicable
    for (const pkg of packagesToCreate) {
      const pkgCode = `PKG${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100)}`;
      const expiresAt = pkg.validityDays ? new Date(Date.now() + pkg.validityDays * 86400000) : null;
      const createdPackage = await client.query(
        `INSERT INTO customer_packages (
           branch_id, package_code, package_id, customer_id, sale_price, total_units, used_units, sold_at, expires_at, status
         ) VALUES ($1, $2, $3, $4, $5, $6, 0, NOW(), $7, 'active')
         RETURNING id`,
        [branchId, pkgCode, pkg.packageId, customerId, pkg.salePrice, pkg.totalUnits, expiresAt],
      );
      createdCustomerPackageIds.push(number(createdPackage.rows[0].id));
    }

    for (const card of accountCardsToCreate) {
      const cardCode = `CARD${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100)}`;
      const expiresAt = card.validityDays ? new Date(Date.now() + card.validityDays * 86400000) : null;
      const createdCard = await client.query(
        `INSERT INTO customer_account_cards (
           branch_id, card_code, account_card_id, customer_id, sale_price, opening_balance, current_balance, sold_at, expires_at, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $6, NOW(), $7, 'active')
         RETURNING id`,
        [branchId, cardCode, card.accountCardId, customerId, card.salePrice, card.faceValue, expiresAt],
      );
      createdCustomerAccountCardIds.push(number(createdCard.rows[0].id));
    }

    // 7b. Deduct from wallet/card balance for wallet payments
    if (paymentMethod === 'wallet' && total > 0 && cardBalance > 0) {
      let remaining = total;

      // Get all active cards with balance, ordered by expiry (nearest first)
      const cardsWithBalance = await client.query(
        `SELECT id, current_balance
         FROM customer_account_cards
         WHERE customer_id = $1
           AND branch_id = $2
           AND status = 'active'
           AND current_balance > 0
           AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY expires_at ASC NULLS LAST`,
        [customerId, branchId],
      );

      for (const card of cardsWithBalance.rows) {
        if (remaining <= 0) break;

        const deduction = Math.min(card.current_balance, remaining);
        await client.query(
          `UPDATE customer_account_cards
           SET current_balance = current_balance - $1,
               updated_at = NOW()
           WHERE id = $2`,
          [deduction, card.id],
        );
        changedCustomerAccountCardIds.add(number(card.id));
        remaining -= deduction;
      }

      // Mark cards as depleted if balance reaches 0
      await client.query(
        `UPDATE customer_account_cards
         SET status = 'depleted'
         WHERE customer_id = $1 AND current_balance <= 0 AND status = 'active'`,
        [customerId],
      );

      // Wallet spending moves no real money: the cash arrived when the card
      // was sold, so it is intentionally not written to the cashbook.
    }

    // 8. Create per-line commission records for staff assigned to each item
    if (invoiceItemIds.length > 0) {
      // The catalog item is the single source of truth for commission. Staff
      // profiles never contribute a default rate.
      for (const item of invoiceItemIds) {
        if (!item.staffId) continue;

        const revenue = item.lineTotal;
        let amount = 0;
        const rate = item.commissionRate || 0;

        if (item.commissionType === 'percent') {
          amount = Math.round(revenue * rate);
        } else if (item.commissionType === 'fixed') {
          amount = item.quantity * rate;
        }

        if (amount > 0) {
          await client.query(
            `INSERT INTO commission_records (
               branch_id, staff_id, invoice_id, invoice_item_id, source_name, revenue, rate, amount, occurred_on, commission_type
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE, $9)`,
            [branchId, item.staffId, invoiceId, item.itemId, `Thực hiện dịch vụ`, revenue, rate, amount, 'service'],
          );
        }
      }
    }

    // 9. Record the cashbook receipt (wallet payments are skipped by the ledger)
    const cashEntry = await recordCashEntry(client, {
      branchId,
      type: 'income',
      categoryKey: 'sales',
      amount: payment.paid,
      paymentMethod,
      sourceType: 'invoice',
      sourceId: invoiceId,
      counterpartyType: 'customer',
      counterpartyId: customerId,
      counterpartyName: customerName,
      note: `Thu tiền hóa đơn ${invoiceCode} (${paymentMethod})`,
      createdBy: actorAccountId || null,
    });

    // 10. Record activity
    await client.query(
      `INSERT INTO activities (
         branch_id, actor_staff_id, action, object_type, object_code, description, occurred_at
       ) VALUES ($1, $2, 'pos.checkout', 'invoice', $3, $4, NOW())`,
      [
        branchId,
        actorStaffId || null,
        invoiceCode,
        `Chốt hóa đơn ${invoiceCode} - Tổng: ${total} đ, đã thu: ${payment.paid} đ, còn nợ: ${payment.debt} đ cho ${customerName}`,
      ],
    );

    // Get branch info for receipt printing
    const branchRes = await client.query('SELECT name, address, phone FROM branches WHERE id = $1', [branchId]);
    const branchInfo = branchRes.rows[0] || {};

    const receipt = {
      id: invoiceId,
      code: invoice.code,
      status: invoice.status,
      subtotal: number(invoice.subtotal),
      discount: number(invoice.discount),
      total: number(invoice.total),
      amountPaid: payment.paid,
      tenderedAmount: payment.tendered,
      changeAmount: payment.change,
      debtAmount: payment.debt,
      paymentStatus: payment.paymentStatus,
      customerDebtBalance,
      paymentMethod: invoice.payment_method,
      salesChannel: invoice.sales_channel,
      issuedAt: invoice.issued_at,
      note: note || '',
      pricebook: appliedPricebook,
      branch: {
        name: branchInfo.name || config.store.name,
        address: branchInfo.address || '',
        phone: branchInfo.phone || '',
      },
      customer: {
        id: customerId,
        code: customerCode,
        name: customerName,
        phone: customerPhone,
      },
      staff: staffId ? { id: staffId, name: staffName } : null,
      items: validatedItems.map((item, idx) => ({
        id: idx + 1,
        code: item.code,
        name: item.name,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        staffId: item.staffId || null,
      })),
    };

    await finishPaymentRequest(client, branchId, requestKey, receipt);
    await client.query('COMMIT');

    if (cashEntry) broadcastToBranch(branchId, realtimeEvents.cashbookUpdated, { voucherId: cashEntry.id, action: 'created' });
    broadcastToBranch(branchId, realtimeEvents.invoiceUpdated, {
      invoiceId: receipt.id,
      customerId: receipt.customer.id,
      code: receipt.code,
      total: receipt.total,
      appointmentId: appointmentId || null,
      actorAccountId,
    });
    const invoiceNotification = {
      branchId,
      type: 'invoice',
      title: payment.debt > 0 ? 'Hóa đơn đã ghi nợ' : 'Hóa đơn đã thanh toán',
      detail: `${receipt.code} · ${new Intl.NumberFormat('vi-VN').format(receipt.total)} đ · ${receipt.customer.name}`,
      targetPath: '/m/orders',
    };
    void Promise.all([
      publishNotification({ ...invoiceNotification, role: 'manager' }),
      publishNotification({ ...invoiceNotification, role: 'cashier' }),
    ]);
    for (const customerPackageId of createdCustomerPackageIds) {
      broadcastToBranch(branchId, realtimeEvents.customerPackageCreated, {
        customerPackageId,
        customerId,
        invoiceId: receipt.id,
        actorAccountId,
      });
    }
    for (const redemption of packageRedemptions) {
      broadcastToBranch(branchId, realtimeEvents.customerPackageUpdated, {
        customerPackageId: number(redemption.packageId),
        customerId,
        invoiceId: receipt.id,
        action: 'redeemed',
        actorAccountId,
      });
    }
    for (const customerAccountCardId of createdCustomerAccountCardIds) {
      broadcastToBranch(branchId, realtimeEvents.customerAccountCardCreated, {
        customerAccountCardId,
        customerId,
        invoiceId: receipt.id,
        actorAccountId,
      });
    }
    for (const customerAccountCardId of changedCustomerAccountCardIds) {
      broadcastToBranch(branchId, realtimeEvents.customerAccountCardUpdated, {
        customerAccountCardId,
        customerId,
        invoiceId: receipt.id,
        action: 'debited',
        actorAccountId,
      });
    }

    return receipt;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
