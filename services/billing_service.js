const crypto = require('crypto');

/**
 * 💳 BILLING SERVICE (Payme & Click Integrated)
 * Bu modul foydalanuvchilar uchun avtomatik to'lov havolalarini generatsiya qiladi.
 */
class BillingService {
    constructor() {
        this.merchantId = process.env.PAYME_MERCHANT_ID || 'dummy';
        this.clickServiceId = process.env.CLICK_SERVICE_ID || 'dummy';
        this.clickMerchantId = process.env.CLICK_MERCHANT_ID || 'dummy';
    }

    /**
     * Payme uchun to'lov havolasi
     */
    generatePaymeLink(userId, amount, planLabel) {
        // base64(m=merchant_id;ac.user_id=123;a=100000)
        const params = `m=${this.merchantId};ac.user_id=${userId};a=${amount * 100}`;
        const encoded = Buffer.from(params).toString('base64');
        return `https://checkout.paycom.uz/${encoded}`;
    }

    /**
     * Click uchun to'lov havolasi
     */
    generateClickLink(userId, amount, planLabel) {
        return `https://my.click.uz/services/pay?service_id=${this.clickServiceId}&merchant_id=${this.clickMerchantId}&amount=${amount}&transaction_param=${userId}`;
    }

    /**
     * To'lov xabari uchun chiroyli klaviatura
     */
    getPaymentButtons(userId, plan) {
        const { Markup } = require('telegraf');
        return Markup.inlineKeyboard([
            [Markup.button.url('💳 PAYME ORQALI TO\'LASH', this.generatePaymeLink(userId, plan.price, plan.name))],
            [Markup.button.url('🔹 CLICK ORQALI TO\'LASH', this.generateClickLink(userId, plan.price, plan.name))],
            [Markup.button.callback('❌ Bekor qilish', 'back_home')]
        ]);
    }
}

module.exports = new BillingService();
