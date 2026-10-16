// server/services/gateways/CashAdapter.js
// Cash payment: needs no external gateway -- recorded directly as completed as soon as the cashier confirms it
const BaseGatewayAdapter = require('./BaseGatewayAdapter');
const crypto = require('crypto');

class CashAdapter extends BaseGatewayAdapter {
  async initPayment({ amount, currency, invoiceId, patientId, metadata }) {
    // No external connection; just generates an internal reference number
    const gatewayTransactionId = `CASH-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    return {
      success: true,
      gatewayTransactionId,
      raw: { note: 'دفع نقدي مباشر عبر الكاشير', cashierId: metadata?.cashierId || null },
    };
  }

  async verifyPayment(gatewayTransactionId) {
    // Cash payment is considered completed as soon as it's recorded (no external verification needed)
    return { status: 'completed', raw: { gatewayTransactionId } };
  }

  async refund(gatewayTransactionId, amount) {
    // A cash refund is recorded manually by the accountant
    return { success: true, raw: { note: 'استرجاع نقدي يدوي', amount } };
  }
}

module.exports = CashAdapter;
