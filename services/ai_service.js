const { OpenAI } = require('openai');
const axios = require('axios');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class AIService {
    constructor() {
        // 🔑 Ko'p Gemini kalitlari — GEMINI_API_KEY, GEMINI_API_KEY_2, GEMINI_API_KEY_3 ...
        this.geminiKeys = [
            process.env.GEMINI_API_KEY,
            process.env.GEMINI_API_KEY_2,
            process.env.GEMINI_API_KEY_3,
            process.env.GEMINI_API_KEY_4,
            process.env.GEMINI_API_KEY_5,
        ].filter(Boolean); // Bo'sh kalitlarni olib tashlash

        this.groqKey = process.env.GROQ_API_KEY;
        this.deepseekKey = process.env.DEEPSEEK_API_KEY;

        // 🔄 Gemini kalit rotatsiyasi uchun indeks
        this.currentGeminiKeyIndex = 0;

        // 📊 Statistika
        this.stats = {
            gemini: { success: 0, fail: 0 },
            groq: { success: 0, fail: 0 },
            openai: { success: 0, fail: 0 },
            deepseek: { success: 0, fail: 0 }
        };

        console.log(`🔑 AI Service: ${this.geminiKeys.length} ta Gemini kalit yuklandi`);
        console.log(`🔑 AI Service: Groq=${this.groqKey ? '✅' : '❌'}, DeepSeek=${this.deepseekKey ? '✅' : '❌'}, OpenAI=${process.env.OPENAI_API_KEY ? '✅' : '❌'}`);
    }

    // 🔄 Keyingi Gemini kalitini olish (round-robin rotation)
    getNextGeminiKey() {
        if (this.geminiKeys.length === 0) return null;
        const key = this.geminiKeys[this.currentGeminiKeyIndex];
        this.currentGeminiKeyIndex = (this.currentGeminiKeyIndex + 1) % this.geminiKeys.length;
        return key;
    }

    async askOpenAI(prompt, systemPrompt = "Siz professional mahalla yettiligi mutaxassisiz. MATNDA BITTA HAM BEGONA ALIFBO HARFI BO'LMASIN (FAQAT JORIDAGI ALIFBODA YOZING)!") {
        try {
            const ai = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt }
                ],
                temperature: 0.3, // Lower temperature for grammar consistency
                timeout: 10000
            });
            this.stats.openai.success++;
            return ai.choices[0].message.content;
        } catch (e) {
            this.stats.openai.fail++;
            throw new Error(`OpenAI Error: ${e.message}`);
        }
    }

    async askGroq(prompt, systemPrompt = "Siz professional mahalla yettiligi mutaxassisiz. BITTA HAM BEGONA ALIFBO HARFI ISHLATISH TAQIQLANADI!") {
        if (!this.groqKey) throw new Error("GROQ_API_KEY topilmadi");
        try {
            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt }
                ],
                temperature: 0.3 // Consistent grammar
            }, {
                headers: { 'Authorization': `Bearer ${this.groqKey}`, 'Content-Type': 'application/json' },
                timeout: 10000
            });
            this.stats.groq.success++;
            return response.data.choices[0].message.content;
        } catch (e) {
            this.stats.groq.fail++;
            throw new Error(`Groq Error: ${e.response?.data?.error?.message || e.message}`);
        }
    }

    async askDeepSeek(prompt) {
        if (!this.deepseekKey) throw new Error("DEEPSEEK_API_KEY topilmadi");
        try {
            const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: "Siz professional mahalla yettiligi mutaxassisiz." },
                    { role: "user", content: prompt }
                ],
                max_tokens: 1000
            }, {
                headers: { 'Authorization': `Bearer ${this.deepseekKey}`, 'Content-Type': 'application/json' },
                timeout: 10000
            });
            this.stats.deepseek.success++;
            return response.data.choices[0].message.content;
        } catch (e) {
            this.stats.deepseek.fail++;
            throw new Error(`DeepSeek Error: ${e.response?.data?.error?.message || e.message}`);
        }
    }

    /**
     * 🌟 GEMINI — asosiy AI (eng katta bepul limit)
     * Barcha kalitlarni sinab chiqadi, har bir kalitda 2 ta model sinaydi
     * Har bir kalit uchun bepul limit: 1500 req/kun (Flash), 50 req/kun (Pro)
     */
    async askGemini(prompt) {
        if (this.geminiKeys.length === 0) throw new Error("Gemini API kalitlari topilmadi");

        // Eng ishonchli modellarni birinchi sinash
        const models = [
            { version: 'v1beta', model: 'gemini-1.5-flash' },
            { version: 'v1beta', model: 'gemini-2.0-flash' },
        ];

        let lastError = "";

        // Har bir kalitni sinab chiqamiz
        for (let attempt = 0; attempt < this.geminiKeys.length; attempt++) {
            const key = this.getNextGeminiKey();

            for (const trial of models) {
                try {
                    const url = `https://generativelanguage.googleapis.com/${trial.version}/models/${trial.model}:generateContent?key=${key}`;
                    const response = await axios.post(url, {
                        contents: [{ role: "user", parts: [{ text: prompt }] }],
                        system_instruction: {
                            parts: [{ text: "Siz professional mahalla yettiligi mutaxassisiz. MATNDA BITTA HAM BEGONA ALIFBO HARFI ISHLATISH TAQIQLANADI! Matn mazmuni qat'iy saqlansin." }]
                        },
                        generationConfig: {
                            temperature: 0.3, // Lower for consistent results
                            maxOutputTokens: 2048,
                        }
                    }, { timeout: 12000 });

                    if (response.data?.candidates?.[0]?.content) {
                        this.stats.gemini.success++;
                        return response.data.candidates[0].content.parts[0].text;
                    }
                } catch (e) {
                    lastError = e.response?.data?.error?.message || e.message;
                    // Agar limit xatosi bo'lsa, keyingi kalitga o'tish
                    if (lastError.includes('429') || lastError.includes('quota') || lastError.includes('RESOURCE_EXHAUSTED')) {
                        console.warn(`⚠️ Gemini kalit #${this.currentGeminiKeyIndex} limiti tugadi, keyingisiga o'tmoqda...`);
                        break; // Bu kalitni tashlab, keyingisiga o'tish
                    }
                }
            }
        }

        this.stats.gemini.fail++;
        throw new Error(`Gemini Error: ${lastError}`);
    }

    /**
     * 🚀 AQLLI ORCHESTRATOR — Eng ishonchli va BEPUL AI'lardan boshlaydi
     * 
     * TARTIB (bepul limitga qarab):
     * 1️⃣ Gemini Flash — 1500 req/kun * kalit soni (ENG KATTA BEPUL LIMIT)
     * 2️⃣ Groq — 14,400 req/kun (tez, lekin rate limit bor)
     * 3️⃣ DeepSeek — Zaxira
     * 4️⃣ OpenAI — Oxirgi chora (to'lovli)
     */
    async generateProfessionalText(config) {
        const knowledge = require('../knowledge');
        const promptContext = await knowledge.queryKnowledge(config.problem || config.band);

        // Agar o'xshash holatlar bo'lsa, promptga qo'shamiz
        let contextText = "";
        if (promptContext && promptContext.length > 0) {
            contextText = "\n\nO'XSHASH HOLATLAR (NAMUNA UCHUN):\n" +
                promptContext.map((k, i) => `${i + 1}. Muammo: ${k.problem}\nYechim: ${k.ai_solution}`).join('\n---\n');
        }

        const prompt = (config.customPrompt || this.buildDocumentPrompt(config)) + contextText;

        // 1️⃣ GEMINI FLASH (eng katta bepul limit — asosiy AI)
        try {
            console.log("🤖 AI: Gemini Flash (asosiy)...");
            return await this.askGemini(prompt);
        } catch (e) {
            console.warn(`⚠️ Gemini fail: ${e.message}`);
        }

        // 2️⃣ GROQ (tez va bepul, lekin minutlik limit bor)
        try {
            console.log("🤖 AI: Groq (zaxira #1)...");
            return await this.askGroq(prompt);
        } catch (e) {
            console.warn(`⚠️ Groq fail: ${e.message}`);
        }

        // 3️⃣ DEEPSEEK (zaxira)
        try {
            console.log("🤖 AI: DeepSeek (zaxira #2)...");
            return await this.askDeepSeek(prompt);
        } catch (e) {
            console.warn(`⚠️ DeepSeek fail: ${e.message}`);
        }

        // 4️⃣ OPENAI (oxirgi chora — to'lovli)
        try {
            console.log("🤖 AI: OpenAI (oxirgi chora)...");
            return await this.askOpenAI(prompt);
        } catch (e) {
            console.warn(`⚠️ OpenAI fail: ${e.message}`);
        }

        // 💀 Hammasi fail — offline text
        throw new Error("Barcha AI xizmatlari ishlamayapti");
    }

    /**
     * 📊 AI statistikasini olish
     */
    getStats() {
        return this.stats;
    }

    buildDocumentPrompt(d) {
        const isCyr = d.lang === 'cyrillic';
        const textLen = d.textLength || 500;
        const scriptInfo = isCyr ? "KIRILL (ЎЗБЕК КИРИЛЛ)" : "LOTIN (O'ZBEK LOTIN)";

        // Har bir hajm uchun aniq ko'rsatma
        let lengthGuide = "";
        if (textLen <= 300) {
            lengthGuide = `QISQA FORMAT (${textLen} belgi): Faqat 2-3 gap. Asosiy fakt va natijani yozing. Batafsil tahlil kerak EMAS.`;
        } else if (textLen <= 500) {
            lengthGuide = `O'RTACHA FORMAT (${textLen} belgi): 4-6 gap. Muammoni, o'tkazilgan ishni va natijani qisqacha yozing.`;
        } else if (textLen <= 800) {
            lengthGuide = `STANDART FORMAT (${textLen} belgi): 6-8 gap. Muammo tahlili, o'tkazilgan tadbirlar va aniq natijalarni yozing.`;
        } else if (textLen <= 1000) {
            lengthGuide = `KATTA FORMAT (${textLen} belgi): 8-12 gap. Batafsil tahlil, huquqiy asoslar, tadbirlar va kelgusi rejalarni yozing.`;
        } else {
            lengthGuide = `TO'LIQ FORMAT (${textLen} belgi): 12+ gap. Mukammal tahlil, qonunchilik asoslari, o'tkazilgan barcha tadbirlar, psixologik va ijtimoiy yordam, kelgusi choralar va nazorat rejasini batafsil yozing.`;
        }

        return `SIZNING VAZIFANGIZ: Rasmiy hujjat uchun matn tayyorlash (MFY ${d.lavozim}).

===== ☠️ ENG MUHIM QOIDA: MATN HAJMI =====
${lengthGuide}

MATN AYNAN ${textLen} BELGIGA YAQIN BO'LISHI SHART!
- Kamida: ${Math.max(textLen - 50, 50)} belgi
- Ko'pi bilan: ${textLen + 50} belgi
- Agar matn qisqa bo'lib qolsa — tafsilot qo'shing.
- Agar matn uzun bo'lib ketsa — keraksiz takrorlarni olib tashlang.
BU RASMIY HUJJAT — matn A4 qog'ozga chiqadi, shuning uchun ${textLen} belgidan oshsa qog'ozdan chiqib ketadi!
================================================

QAT'IY QOIDALAR:
1. ALIFBO: Faqat ${scriptInfo} alifbosida yozing. Boshqa alifbo harflari TAQIQLANADI!
2. MATNNI BOSHLASH: "${isCyr ? 'Қўқон шаҳар' : "Qo'qon shahar"}, ${d.mahalla} ${isCyr ? 'МФЙда истиқомат қилувчи фуқаро' : 'MFYda istiqomat qiluvchi fuqaro'} ${d.fuqaro}..." deb boshlang.
3. TIL: Professional, rasmiy, davlat tili. Og'zaki uslub taqiqlanadi.
4. ISMLAR: To'g'ri yozing (masalan: AlimovaNafisa → ${isCyr ? 'Алимова Нафиса' : 'Alimova Nafisa'}).

KONTEKST:
- Lavozim: ${d.lavozim} | Band: ${d.band} (${d.bandDesc || 'tavsif yo\'q'})
- Fuqaro: ${d.fuqaro} | Muammo: ${d.problem}
- Tahlil: ${d.analysis}

FAQAT TAYYOR MATNNI QAYTARING. IZOHSIZ!`;
    }
}

module.exports = new AIService();
