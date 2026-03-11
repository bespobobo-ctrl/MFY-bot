const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class PDFService {
    constructor() {
        this.browser = null;
        this.activeCount = 0;
        this.MAX_CONCURRENT = 3;
    }

    async getBrowser() {
        if (!this.browser || !this.browser.isConnected()) {
            this.browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--font-render-hinting=none'
                ]
            });
        }
        return this.browser;
    }

    async generatePDF(data, imagePath, bandsConfig) {
        while (this.activeCount >= this.MAX_CONCURRENT) {
            await new Promise(r => setTimeout(r, 500));
        }

        this.activeCount++;
        const browser = await this.getBrowser();
        const page = await browser.newPage();

        try {
            await page.setViewport({ width: 1200, height: 1600 });
            const htmlPath = path.resolve(__dirname, '../index.html');
            if (!fs.existsSync(htmlPath)) {
                throw new Error(`index.html topilmadi: ${htmlPath}`);
            }

            // Lang parametrni URL ga qo'shish
            const langParam = data.lang === 'cyrillic' ? 'cyrillic' : 'latin';
            await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}?auth=bot&lang=${langParam}`, {
                waitUntil: 'networkidle0', // To'liq xavfsiz yuklanishini kutish
                timeout: 30000 // Serverda sahifa yuklanishi uzoqroq vaqt olsa ehtiyot chorasi
            });

            const imgBase64 = imagePath && fs.existsSync(imagePath)
                ? `data:image/jpeg;base64,${fs.readFileSync(imagePath).toString('base64')}`
                : '';

            await page.evaluate((d, imgB64, bConfig) => {
                return new Promise((resolve) => {
                    const fill = () => {
                        if (!window.updatePreview) return setTimeout(fill, 200);

                        try {
                            // Til tanlash (HTML dagi .lang-btn larni ishlatish)
                            const targetLang = d.lang === 'cyrillic' ? 'cyrillic' : 'latin';
                            const langBtn = document.querySelector(`.lang-btn[data-lang="${targetLang}"]`);
                            if (langBtn && !langBtn.classList.contains('active')) {
                                langBtn.click();
                            }

                            // Override browser's bandDescriptions with bot's nested data
                            if (bConfig && bConfig[d.lavozim]) {
                                if (typeof window.bandDescriptions === 'object') {
                                    window.bandDescriptions[targetLang] = bConfig[d.lavozim];
                                }
                            }

                            // Band inject
                            if (bConfig && bConfig[d.lavozim]) {
                                const bSelect = document.getElementById('band');
                                if (bSelect) {
                                    const currentBands = Array.from(bSelect.options).map(o => o.value);
                                    Object.keys(bConfig[d.lavozim]).forEach(bNum => {
                                        if (!currentBands.includes(bNum)) {
                                            const opt = document.createElement('option');
                                            opt.value = bNum;
                                            opt.textContent = bNum;
                                            bSelect.appendChild(opt);
                                        }
                                    });
                                }
                            }

                            // Ma'lumotlarni to'ldirish
                            const mapping = {
                                'mahalla': d.mahalla, 'lavozim': d.lavozim, 'band': d.band,
                                'fuqaro': d.fuqaro, 'manzil': d.manzil, 'sana': d.sana,
                                'fuqaroProblem': d.problem,
                                'problemInput': d.analysis,
                                'solutionInput': d.ai_solution,
                                'imzoEgasi': d.imzo
                            };
                            for (const [id, v] of Object.entries(mapping)) {
                                const el = document.getElementById(id);
                                if (el && v) {
                                    el.value = v;
                                    el.dispatchEvent(new Event('input'));
                                    el.dispatchEvent(new Event('change'));
                                }
                            }

                            // Rasm
                            if (imgB64) {
                                const p = document.getElementById('docPhoto');
                                if (p) p.src = imgB64;
                            }

                            // Bot rejimi uchun Maxsus CSS qo'shish (ortiqcha interfeysni yashirish)
                            const style = document.createElement('style');
                            style.textContent = `
                                body { background: white !important; margin: 0 !important; padding: 0 !important; }
                                .sidebar, .history-sidebar-right, .preview-title, .form-actions, .app-header, .settings-panel { display: none !important; }
                                .main-layout { display: block !important; margin: 0 !important; padding: 0 !important; }
                                .preview-section { width: 100% !important; margin: 0 !important; padding: 0 !important; }
                                .document-wrapper { background: white !important; padding: 0 !important; margin: 0 !important; box-shadow: none !important; width: 100% !important; }
                                .container { padding: 0 !important; max-width: none !important; width: 100% !important; margin: 0 !important; }
                                .document { box-shadow: none !important; border: none !important; margin: 0 auto !important; padding: 0 !important; }
                            `;
                            document.head.appendChild(style);

                            window.updatePreview();
                            setTimeout(resolve, 500);
                        } catch (e) {
                            console.error('Fill error:', e);
                            resolve();
                        }
                    };
                    fill();
                });
            }, data, imgBase64, bandsConfig);

            // Rendering to'liq tugashini kutish
            await new Promise(r => setTimeout(r, 600));

            return await page.pdf({
                format: 'A4',
                printBackground: true,
                preferCSSPageSize: false
            });
        } finally {
            this.activeCount--;
            await page.close();
        }
    }
}

module.exports = new PDFService();
