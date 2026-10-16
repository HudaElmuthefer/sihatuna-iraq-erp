// server/services/gateways/BankCardAdapter.js
// A generic adapter for any other local bank card gateway not already listed (Al-Rasheed Bank, Al-Rafidain Bank, etc.)
// Same pattern as the previous Adapters -- adjust the endpoints per the actual bank needed
const BaseGatewayAdapter = require('./BaseGatewayAdapter');
const axios = require('axios');

class BankCardAdapter extends BaseGatewayAdapter {
  constructor(credentials, config) {
    super(credentials, config);
    this.baseUrl = credentials.gateway_url; // entered by the admin according to the bank they've contracted with
  }

  async initPayment({ amount, currency, invoiceId, metadata }) {
    if (!this.baseUrl) {
      return { success: false, error: 'رابط بوابة البنك (gateway_url) غير مُعرّف بإعدادات الإدمن' };
    }
    try {
      const response = await axios.post(
        `${this.baseUrl}/pay`,
        { amount, currency, order_id: invoiceId, merchant_id: this.credentials.merchant_id },
        { headers: { Authorization: `Bearer ${this.credentials.api_key}` } }
      );
      return {
        success: true,
        gatewayTransactionId: response.data.id,
        redirectUrl: response.data.redirect_url,
        raw: response.data,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async verifyPayment(gatewayTransactionId) {
    try {
      const response = await axios.get(`${this.baseUrl}/pay/${gatewayTransactionId}`, {
        headers: { Authorization: `Bearer ${this.credentials.api_key}` },
      });
      return { status: response.data.paid ? 'completed' : 'pending', raw: response.data };
    } catch (err) {
      return { status: 'failed', raw: { error: err.message } };
    }
  }
}

module.exports = BankCardAdapter;
