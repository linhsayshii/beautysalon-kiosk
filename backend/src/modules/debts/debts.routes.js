import { Router } from 'express';
import { asyncRoute, parsePositiveInteger } from '../../lib/http.js';
import { collectCustomerDebt, getCustomerDebt } from './debts.service.js';

const router = Router();
router.get('/:id', asyncRoute(async (request, response) => {
  response.json({data: await getCustomerDebt({branchId:request.account.branchId,customerId:parsePositiveInteger(request.params.id,'id')})});
}));
router.post('/:id/payments', asyncRoute(async (request, response) => {
  response.status(201).json({data: await collectCustomerDebt({
    branchId:request.account.branchId, actorAccountId:request.account.id,
    customerId:parsePositiveInteger(request.params.id,'id'),
    amount:request.body.amount, paymentMethod:request.body.paymentMethod,
    note:String(request.body.note ?? '').trim().slice(0,300),
    invoiceId:request.body.invoiceId != null ? parsePositiveInteger(request.body.invoiceId,'invoiceId') : null,
    requestKey:request.body.requestKey,
  })});
}));
export default router;
