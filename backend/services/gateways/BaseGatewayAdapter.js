// server/services/gateways/BaseGatewayAdapter.js
// Every payment gateway (Zain Cash, FastPay, Qi Card, PayPal...) must implement the same interface
// This makes adding a new gateway in the future = just a new file, with no changes to the core code

class BaseGatewayAdapter {
  constructor(credentials = {}, config = {}) {
    this.credentials = credentials; // {api_key, api_secret, merchant_id, ...} decrypted
    this.config = config;           // non-sensitive settings (sandbox mode, webhook url...)
  }

  /**
   * Starts a new payment
   * @returns {Promise<{success: boolean, gatewayTransactionId: string, redirectUrl?: string, raw?: object}>}
   */
  async initPayment({ amount, currency, invoiceId, patientId, metadata }) {
    throw new Error('initPayment() يجب تطبيقه بكل Adapter');
  }

  /**
   * Checks a payment's status (after the user returns from the gateway, or via webhook)
   * @returns {Promise<{status: 'completed'|'pending'|'failed', raw?: object}>}
   */
  async verifyPayment(gatewayTransactionId) {
    throw new Error('verifyPayment() يجب تطبيقه بكل Adapter');
  }

  /**
   * Refunding an amount (optional, not every gateway supports it)
   */
  async refund(gatewayTransactionId, amount) {
    throw new Error(`refund() غير مدعوم بهذه البوابة`);
  }
}

module.exports = BaseGatewayAdapter;
