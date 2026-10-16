// server/services/gateways/WesternUnionAdapter.js
//
// Important note: Western Union does not provide a direct API for an
// "instant payment" gateway the way PayPal or Zain Cash work. WU's actual
// mechanism: the patient sends a transfer in the hospital's name or a
// receiver approved by the WU office, and gets a reference number (MTCN --
// Money Transfer Control Number); the receptionist or accountant then
// verifies the transfer (manually, through the merchant's own WU platform
// if available, or by checking with the exchange office) and records it
// in the system.
//
// This adapter is therefore "semi-manual": initPayment records a payment
// request with pending status and waits for the MTCN to be entered by the
// accountant, and verifyPayment only turns into completed after an
// explicit manual confirmation from an authorized user (not
// automatically).

const BaseGatewayAdapter = require('./BaseGatewayAdapter');
const crypto = require('crypto');

class WesternUnionAdapter extends BaseGatewayAdapter {
  async initPayment({ amount, currency, invoiceId, metadata }) {
    const gatewayTransactionId = `WU-PENDING-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    return {
      success: true,
      gatewayTransactionId,
      raw: {
        note: 'بانتظار تسجيل رقم MTCN من طرف المحاسب بعد استلام الحوالة',
        requiresManualConfirmation: true,
      },
    };
  }

  // Only called when the accountant manually enters the MTCN in the admin UI
  async confirmManually(gatewayTransactionId, mtcnReference, confirmedByUserId) {
    return {
      status: 'completed',
      raw: { mtcnReference, confirmedByUserId, confirmedAt: new Date().toISOString() },
    };
  }

  async verifyPayment(gatewayTransactionId) {
    // Without manual confirmation, the status always stays pending
    return { status: 'pending', raw: { note: 'بحاجة تأكيد يدوي عبر confirmManually()' } };
  }
}

module.exports = WesternUnionAdapter;
