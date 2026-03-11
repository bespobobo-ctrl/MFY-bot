const { Markup } = require('telegraf');
const orthography = require('../utils/orthography');
const bandsData = require('../bands');

/**
 * 📝 MESSAGE HANDLER (v2.0)
 * Botning barcha matnli muloqot bosqichlarini (steps) boshqaradi.
 */
class MessageHandler {
    constructor(payments, bandsByLavozim, aiService, pdfService) {
        this.payments = payments;
        this.BANDS_BY_LAVOZIM = bandsByLavozim;
        this.aiService = aiService;
        this.pdfService = pdfService;
    }

    async handleText(ctx) {
        const text = ctx.message.text;
        const session = ctx.session;

        switch (session.step) {
            case 'WAITING_DATE':
                session.data.sana = text;
                session.step = 'WAITING_MAHALLA';
                const mLabel = session.data.lang === 'cyrillic' ? '🏢 [3/14] Маҳалла номини танланг:' : '🏢 [3/14] Mahalla nomini tanlang:';
                // Mahallalar ro'yxatini index.js dan olingan global o'zgaruvchi deb hisoblaymiz
                return ctx.reply(mLabel, Markup.keyboard(this.chunkArray(global.MAHALLALAR || [], 2)).resize());

            case 'WAITING_MAHALLA':
                session.data.mahalla = text;
                session.step = 'WAITING_LAVOZIM';
                const lavozimButtons = Object.keys(this.BANDS_BY_LAVOZIM);
                const lavozimLabel = session.data.lang === 'cyrillic' ? '💼 [5/14] Лавозимингизни танланг:' : '💼 [5/14] Lavozimingizni tanlang:';
                return ctx.reply(lavozimLabel, Markup.keyboard(this.chunkArray(lavozimButtons, 2)).resize());

            case 'WAITING_LAVOZIM':
                const bands = this.BANDS_BY_LAVOZIM[text];
                if (!bands) return ctx.reply("⚠️ Iltimos, tugmalardan birini tanlang:");
                session.data.lavozim = text;
                session.step = 'WAITING_BAND';
                let bPrompt = session.data.lang === 'cyrillic' ? '📌 [6/14] <b>Бандni танланг:</b>\n\n' : '📌 [6/14] <b>Bandni tanlang:</b>\n\n';
                bands.forEach(b => {
                    const desc = bandsData.getBandDesc(b);
                    bPrompt += `<b>${b}:</b> ${desc || '---'}\n\n`;
                });
                return ctx.reply(bPrompt, { parse_mode: 'HTML', ...Markup.keyboard(this.chunkArray(bands, 2)).resize() });

            // ... Qolgan bosqichlar ham shu kabi tartiblanadi ...
            default:
                if (session.step === 'IDLE') return;
            // AI savollar yoki boshqa qismlar
        }
    }

    chunkArray(array, size) {
        const chunked = [];
        for (let i = 0; i < array.length; i += size) chunked.push(array.slice(i, i + size));
        return chunked;
    }
}

module.exports = MessageHandler;
