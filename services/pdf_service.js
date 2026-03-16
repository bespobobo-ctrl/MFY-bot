/**
 * PDF SERVICE — pdfmake v0.3.x bilan (Puppeteer o'rniga)
 * 
 * Afzalliklari:
 * - Xotira: ~30-50 MB (Puppeteer: 300-500 MB)
 * - Tezlik: 1-2 sekund (Puppeteer: serverda 1-2 soat)
 * - Chromium brauzer KERAK EMAS
 * - Kirill + Lotin to'liq qo'llab-quvvatlanadi
 */

const pdfmake = require('pdfmake');
const fs = require('fs');
const path = require('path');

// === SHRIFTLAR SOZLASH ===
// pdfmake v0.3.x uchun Roboto shriftlari (Kirill qo'llab-quvvatlaydi)
const fonts = {
    Roboto: {
        normal: path.join(__dirname, '../node_modules/pdfmake/build/fonts/Roboto/Roboto-Regular.ttf'),
        bold: path.join(__dirname, '../node_modules/pdfmake/build/fonts/Roboto/Roboto-Medium.ttf'),
        italics: path.join(__dirname, '../node_modules/pdfmake/build/fonts/Roboto/Roboto-Italic.ttf'),
        bolditalics: path.join(__dirname, '../node_modules/pdfmake/build/fonts/Roboto/Roboto-MediumItalic.ttf')
    }
};

// Shriftlarni o'rnatish
try {
    if (fs.existsSync(fonts.Roboto.normal)) {
        pdfmake.setFonts(fonts);
        console.log('📄 PDF Service: TTF shriftlar yuklandi (v0.3.x)');
    } else {
        throw new Error('TTF font path not found: ' + fonts.Roboto.normal);
    }
} catch (e) {
    // Fallback: Standart shriftlar
    pdfmake.setFonts({
        Roboto: {
            normal: 'Helvetica',
            bold: 'Helvetica-Bold',
            italics: 'Helvetica-Oblique',
            bolditalics: 'Helvetica-BoldOblique'
        }
    });
    console.log('📄 PDF Service: Standart shriftlar ishlatilmoqda (Warning: ' + e.message + ')');
}

// === GERB RASMI ===
let emblemBase64 = null;
try {
    const emblemPath = path.resolve(__dirname, '../assets/emblem.png');
    if (fs.existsSync(emblemPath)) {
        const emblemData = fs.readFileSync(emblemPath);
        emblemBase64 = 'data:image/png;base64,' + emblemData.toString('base64');
        console.log('📄 PDF Service: Gerb rasmi yuklandi ✅');
    }
} catch (e) {
    console.warn('⚠️ Gerb rasmi yuklanmadi:', e.message);
}

class PDFService {
    constructor() {
        this.activeCount = 0;
        this.MAX_CONCURRENT = 10;
    }

    _getLocalizedText(key, lang) {
        const texts = {
            govtName: { cyrillic: "ЎЗБЕКИСТОН РЕСПУБЛИКАСИ", latin: "O'ZBEKISTON RESPUBLIKASI" },
            mfy: { cyrillic: "маҳалла фуқаролар йиғини", latin: "mahalla fuqarolar yig'ini" },
            dalolatnoma: { cyrillic: "ДАЛОЛАТНОМА", latin: "DALOLATNOMA" },
            malumotnoma: { cyrillic: "МАЪЛУМОТНОМА", latin: "MA'LUMOTNOMA" },
            city: { cyrillic: "Қўқон шаҳар", latin: "Qo'qon shahar" },
            sectionProblem: { cyrillic: "Фуқаро муаммоси:", latin: "Fuqaro muammosi:" },
            sectionAnalysis: { cyrillic: "Муаммо таҳлили:", latin: "Muammo tahlili:" },
            sectionActions: { cyrillic: "Амалга оширилган ишлар:", latin: "Amalga oshirilgan ishlar:" }
        };
        return texts[key] ? (texts[key][lang] || texts[key].latin) : key;
    }

    _generateIntroText(data) {
        const isCyr = data.lang === 'cyrillic';
        const city = this._getLocalizedText('city', data.lang);
        if (isCyr) {
            return `${city}, ${data.mahalla} МФЙда истиқомат қилувчи фуқаро ${data.fuqaro}, ${data.manzil} манзилида яшайди. ` +
                `Ушбу фуқаро ${data.problem || ''} масаласида мурожаат қилган.`;
        } else {
            return `${city}, ${data.mahalla} MFYda istiqomat qiluvchi fuqaro ${data.fuqaro}, ${data.manzil} manzilida yashaydi. ` +
                `Ushbu fuqaro ${data.problem || ''} masalasida murojaat qilgan.`;
        }
    }

    async generatePDF(data, imagePath, bandsConfig) {
        this.activeCount++;
        try {
            const lang = data.lang || 'cyrillic';
            const isCyr = lang === 'cyrillic';
            const docType = (data.type || 'DALOLATNOMA').toUpperCase();
            const titleKey = docType.includes('MALUMOT') ? 'malumotnoma' : 'dalolatnoma';

            let bandDescription = '';
            if (bandsConfig && data.lavozim && data.band) {
                const lavozimBands = bandsConfig[data.lavozim];
                if (lavozimBands && lavozimBands[data.band]) {
                    bandDescription = lavozimBands[data.band];
                }
            }

            const bandHeaderText = isCyr ? `${data.band}-банд — ${data.lavozim}` : `${data.band}-band — ${data.lavozim}`;

            let photoImage = null;
            if (imagePath && fs.existsSync(imagePath)) {
                try {
                    const imgData = fs.readFileSync(imagePath);
                    const ext = path.extname(imagePath).toLowerCase();
                    const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
                    photoImage = `data:${mime};base64,` + imgData.toString('base64');
                } catch (e) { console.warn('⚠️ Rasm yuklanmadi:', e.message); }
            }

            const introText = this._generateIntroText(data);
            const content = [];

            if (emblemBase64) {
                content.push({ image: emblemBase64, width: 60, alignment: 'center', margin: [0, 0, 0, 3] });
            }

            content.push({ text: this._getLocalizedText('govtName', lang), style: 'govtName', margin: [0, 0, 0, 1] });
            content.push({
                text: [{ text: data.mahalla, bold: true }, { text: ` ${this._getLocalizedText('mfy', lang)}` }],
                alignment: 'center', fontSize: 10, margin: [0, 0, 0, 4]
            });

            content.push({
                canvas: [
                    { type: 'line', x1: 0, y1: 0, x2: 481, y2: 0, lineWidth: 2.5, lineColor: '#008000' },
                    { type: 'line', x1: 0, y1: 5, x2: 481, y2: 5, lineWidth: 2.5, lineColor: '#3366FF' }
                ],
                margin: [0, 2, 0, 5]
            });

            content.push({ text: this._getLocalizedText(titleKey, lang), style: 'docTitle', margin: [0, 2, 0, 4] });

            content.push({
                columns: [
                    { text: this._getLocalizedText('city', lang), bold: true, fontSize: 10.5 },
                    { text: data.sana || '', alignment: 'right', bold: true, fontSize: 10.5 }
                ],
                margin: [0, 0, 0, 6]
            });

            content.push({ text: introText, style: 'mainContent', margin: [0, 0, 0, 5] });
            content.push({ text: bandHeaderText, style: 'bandHeader', margin: [0, 3, 0, 3] });

            if (bandDescription) {
                content.push({ text: bandDescription, style: 'bandDescription', margin: [0, 0, 0, 6] });
            }

            if (data.ai_solution) {
                content.push({ text: this._getLocalizedText('sectionActions', lang), style: 'sectionTitle', margin: [0, 3, 0, 2] });
                content.push({ text: data.ai_solution, style: 'contentText', margin: [0, 0, 0, 5] });
            }

            if (photoImage) {
                content.push({ image: photoImage, width: 481, height: 180, fit: [481, 180], alignment: 'center', margin: [0, 4, 0, 4] });
            }

            content.push({
                columns: [
                    { text: data.lavozim || '', bold: true, fontSize: 10, width: '*' },
                    { text: '_______________', alignment: 'center', fontSize: 10, width: 120, color: '#999999' },
                    { text: data.imzo || '', bold: true, alignment: 'right', fontSize: 10, width: 'auto' }
                ],
                margin: [0, 15, 0, 0]
            });

            const docDefinition = {
                pageSize: 'A4',
                pageMargins: [42, 28, 42, 28],
                content: content,
                defaultStyle: { font: 'Roboto', fontSize: 10.5, lineHeight: 1.35 },
                styles: {
                    govtName: { alignment: 'center', bold: true, fontSize: 11.5, characterSpacing: 0.5 },
                    docTitle: { alignment: 'center', bold: true, fontSize: 13 },
                    mainContent: { fontSize: 10.5, bold: true, lineHeight: 1.3 },
                    bandHeader: { bold: true, fontSize: 12 },
                    bandDescription: { color: '#444444', fontSize: 10, lineHeight: 1.4, alignment: 'justify' },
                    sectionTitle: { bold: true, fontSize: 10.5 },
                    contentText: { fontSize: 10, lineHeight: 1.35, alignment: 'justify' }
                }
            };

            const doc = pdfmake.createPdf(docDefinition);
            return await doc.getBuffer();
        } catch (err) {
            console.error('PDF Generation Error:', err);
            throw err;
        } finally {
            this.activeCount--;
        }
    }

    async getBrowser() {
        return { isConnected: () => true, version: () => Promise.resolve('pdfmake/0.3.x (no-chromium)') };
    }
}

module.exports = new PDFService();
