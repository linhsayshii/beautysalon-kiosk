import { pool } from '../../db.js';
import { HttpError } from '../../lib/http.js';
import { broadcastToBranch } from '../../lib/ws.js';

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
  note,
}) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new HttpError(400, 'EMPTY_CART', 'Hóa đơn phải có ít nhất một dịch vụ hoặc sản phẩm');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Validate Customer if provided
    let customerName = 'Khách lẻ';
    let customerPhone = null;
    let customerCode = null;
    if (customerId) {
      const custResult = await client.query(
        'SELECT id, code, name, phone FROM customers WHERE id = $1 AND branch_id = $2 FOR UPDATE',
        [customerId, branchId],
      );
      if (!custResult.rows[0]) {
        throw new HttpError(404, 'CUSTOMER_NOT_FOUND', 'Khách hàng không tồn tại hoặc không thuộc chi nhánh này');
      }
      customerName = custResult.rows[0].name;
      customerPhone = custResult.rows[0].phone;
      customerCode = custResult.rows[0].code;
    }

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

      if (itemType === 'service') {
        const sResult = await client.query(
          'SELECT id, code, name, price FROM services WHERE id = $1 AND branch_id = $2 AND active = TRUE',
          [itemId, branchId],
        );
        if (!sResult.rows[0]) {
          throw new HttpError(404, 'SERVICE_NOT_FOUND', `Dịch vụ #${itemId} không tồn tại hoặc đã ngừng hoạt động`);
        }
        price = number(sResult.rows[0].price);
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
        });
      } else if (itemType === 'product') {
        const pResult = await client.query(
          `SELECT p.id, p.sku, p.name, p.sale_price, p.unit, COALESCE(ib.quantity, 0) AS stock_quantity
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
        name = pkg.name;
        code = pkg.code;
        unit = 'gói';

        validatedItems.push({
          itemType: 'service',
          serviceId: null,
          productId: null,
          staffId: lineStaffId || staffId || null,
          code,
          name: `[Gói] ${name}`,
          unit,
          quantity,
          unitPrice: price,
          lineTotal: price * quantity,
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
        name = card.name;
        code = card.code;
        unit = 'thẻ';

        validatedItems.push({
          itemType: 'service',
          serviceId: null,
          productId: null,
          staffId: lineStaffId || staffId || null,
          code,
          name: `[Thẻ] ${name}`,
          unit,
          quantity,
          unitPrice: price,
          lineTotal: price * quantity,
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

    const discountAmount = Math.max(0, Math.min(subtotal, number(discount)));
    const total = Math.max(0, subtotal - discountAmount);

    // 4. Generate unique invoice code
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
    if (!isUnique) {
      invoiceCode = `HD${Date.now().toString().slice(-8)}`;
    }

    // 5. Create invoice
    const invoiceResult = await client.query(
      `INSERT INTO invoices (
         branch_id, customer_id, staff_id, code, status,
         subtotal, discount, total, payment_method, sales_channel, issued_at
       ) VALUES ($1, $2, $3, $4, 'paid', $5, $6, $7, $8, 'salon', NOW())
       RETURNING id, code, status, subtotal, discount, total, payment_method, sales_channel, issued_at, created_at`,
      [branchId, customerId || null, staffId || null, invoiceCode, subtotal, discountAmount, total, paymentMethod],
    );
    const invoice = invoiceResult.rows[0];
    const invoiceId = Number(invoice.id);

    // 6. Insert invoice items and collect their IDs
    const invoiceItemIds = [];
    for (const item of validatedItems) {
      const itemResult = await client.query(
        `INSERT INTO invoice_items (
           invoice_id, item_type, service_id, product_id, staff_id, description, quantity, unit_price, line_total
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          invoiceId,
          item.itemType,
          item.serviceId,
          item.productId,
          item.staffId || null,
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
      });
    }

    // 7. Auto-activate customer packages & account cards if applicable
    for (const pkg of packagesToCreate) {
      const pkgCode = `PKG${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100)}`;
      const expiresAt = pkg.validityDays ? new Date(Date.now() + pkg.validityDays * 86400000) : null;
      await client.query(
        `INSERT INTO customer_packages (
           branch_id, package_code, package_id, customer_id, sale_price, total_units, used_units, sold_at, expires_at, status
         ) VALUES ($1, $2, $3, $4, $5, $6, 0, NOW(), $7, 'active')`,
        [branchId, pkgCode, pkg.packageId, customerId, pkg.salePrice, pkg.totalUnits, expiresAt],
      );
    }

    for (const card of accountCardsToCreate) {
      const cardCode = `CARD${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100)}`;
      const expiresAt = card.validityDays ? new Date(Date.now() + card.validityDays * 86400000) : null;
      await client.query(
        `INSERT INTO customer_account_cards (
           branch_id, card_code, account_card_id, customer_id, sale_price, opening_balance, current_balance, sold_at, expires_at, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $6, NOW(), $7, 'active')`,
        [branchId, cardCode, card.accountCardId, customerId, card.salePrice, card.faceValue, expiresAt],
      );
    }

    // 8. Create per-line commission records for staff assigned to each item
    if (invoiceItemIds.length > 0) {
      // Fetch product commission settings for items with product_id
      const productIds = invoiceItemIds.filter((i) => i.productId).map((i) => i.productId);
      const productCommissions = {};
      if (productIds.length > 0) {
        const commResult = await client.query(
          `SELECT id, commission_type, commission_rate FROM products WHERE id = ANY($1)`,
          [productIds],
        );
        for (const row of commResult.rows) {
          productCommissions[row.id] = {
            commissionType: row.commission_type,
            commissionRate: parseFloat(row.commission_rate) || 0,
          };
        }
      }

      // Create commission for each line with assigned staff
      for (const item of invoiceItemIds) {
        if (!item.staffId) continue;

        const revenue = item.lineTotal;
        let amount = 0;
        let rate = 0;

        if (item.productId && productCommissions[item.productId]) {
          const comm = productCommissions[item.productId];
          const calcType = comm.commissionType; // 'percent' or 'fixed'
          rate = comm.commissionRate || 0;

          if (calcType === 'percent') {
            amount = Math.round(revenue * rate);
          } else if (calcType === 'fixed') {
            amount = item.quantity * rate;
          }
        }

        if (amount > 0) {
          await client.query(
            `INSERT INTO commission_records (
               branch_id, staff_id, invoice_id, invoice_item_id, source_name, revenue, rate, amount, occurred_on, status, commission_type
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE, 'pending', 'service')`,
            [branchId, item.staffId, invoiceId, item.itemId, `Thực hiện dịch vụ`, revenue, rate, amount],
          );
        }
      }
    }

    // 9. Record cash transaction
    if (total > 0) {
      await client.query(
        `INSERT INTO cash_transactions (
           branch_id, transaction_type, category, amount, note, occurred_at
         ) VALUES ($1, 'income', 'Thu tiền bán hàng POS', $2, $3, NOW())`,
        [branchId, total, `Thu tiền hóa đơn ${invoiceCode} (${paymentMethod})`],
      );
    }

    // 10. Record activity
    await client.query(
      `INSERT INTO activities (
         branch_id, actor_staff_id, action, object_type, object_code, description, occurred_at
       ) VALUES ($1, $2, 'pos.checkout', 'invoice', $3, $4, NOW())`,
      [
        branchId,
        actorStaffId || null,
        invoiceCode,
        `Thanh toán hóa đơn ${invoiceCode} - Tổng: ${new Intl.NumberFormat('vi-VN').format(total)} đ cho ${customerName}`,
      ],
    );

    await client.query('COMMIT');

    // Get branch info for receipt printing
    const branchRes = await pool.query('SELECT name, address, phone FROM branches WHERE id = $1', [branchId]);
    const branchInfo = branchRes.rows[0] || {};

    const receipt = {
      id: invoiceId,
      code: invoice.code,
      status: invoice.status,
      subtotal: number(invoice.subtotal),
      discount: number(invoice.discount),
      total: number(invoice.total),
      amountPaid: number(amountPaid || invoice.total),
      changeAmount: Math.max(0, number(amountPaid || invoice.total) - number(invoice.total)),
      paymentMethod: invoice.payment_method,
      salesChannel: invoice.sales_channel,
      issuedAt: invoice.issued_at,
      note: note || '',
      branch: {
        name: branchInfo.name || 'Anna Chill Beauty Salon',
        address: branchInfo.address || '',
        phone: branchInfo.phone || '',
      },
      customer: {
        id: customerId || null,
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

    broadcastToBranch(branchId, 'pos:order_created', {
      orderId: receipt.id,
      code: receipt.code,
      total: receipt.total,
      customerName: receipt.customer.name,
      issuedAt: receipt.issuedAt,
    });

    return receipt;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
