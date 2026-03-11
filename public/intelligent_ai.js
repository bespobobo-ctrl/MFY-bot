// ==========================================
// INTEL AI - AQLLI MATN GENERATSIYA + GEMINI AI
// Intelligent Text Generation Engine v3.0 (Hybrid Online/Offline)
// ==========================================

window.IntelAI = {
    apiKey: process.env.GEMINI_API_KEY || "", // Gemini API Key (Use ENV)
    openAiKey: process.env.OPENAI_API_KEY || "", // OpenAI API Key (Use ENV)

    // Helper: Tasodifiy element olish
    random: (arr) => arr[Math.floor(Math.random() * arr.length)],

    // Helper: Matnni tozalash va formatlash
    clean: (text) => text.replace(/\s+/g, ' ').trim(),

    // Sana formatlash
    getDateStr: (lang, dateVal) => {
        const today = dateVal ? new Date(dateVal) : new Date();
        if (isNaN(today.getTime())) return dateVal || ''; // Fallback for raw string

        const months = {
            latin: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
            cyrillic: ['январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентабр', 'октябр', 'ноябр', 'декабр']
        };
        const mName = months[lang][today.getMonth()];
        const day = today.getDate();
        const year = today.getFullYear();

        return lang === 'latin'
            ? `${year}-yil ${mName} oyining ${day}-kuni`
            : `${year}-йил ${mName} ойининг ${day}-куни`;
    },

    // --- GEMINI AI INTEGRATION ---
    askGemini: async function (prompt) {
        const key = this.apiKey.trim();
        const trials = [
            { version: 'v1beta', model: 'gemini-2.0-flash' },
            { version: 'v1', model: 'gemini-2.0-flash' },
            { version: 'v1beta', model: 'gemini-1.5-flash' },
            { version: 'v1', model: 'gemini-1.5-flash' },
            { version: 'v1beta', model: 'gemini-2.0-pro-exp' },
            { version: 'v1', model: 'gemini-pro-latest' }
        ];

        let lastError = null;

        for (const trial of trials) {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/${trial.version}/models/${trial.model}:generateContent?key=${key}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }]
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.candidates && data.candidates[0].content.parts[0].text) {
                        return data.candidates[0].content.parts[0].text;
                    }
                } else {
                    const errData = await response.json();
                    lastError = `${trial.model}(${trial.version}): ${errData.error?.message || response.statusText}`;
                    console.warn(`Trial failed: ${lastError}`);
                }
            } catch (error) {
                lastError = `${trial.model}(${trial.version}): ${error.message}`;
                console.warn(`Trial fetch error: ${lastError}`);
            }
        }

        throw new Error(lastError || "Gemini ulanishda xatolik yuz berdi");
    },

    // --- OPENAI INTEGRATION ---
    askOpenAI: async function (prompt) {
        const key = this.openAiKey.trim();
        try {
            const response = await fetch(`https://api.openai.com/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                body: JSON.stringify({
                    model: "gpt-4o",
                    messages: [
                        { role: "system", content: "Siz professional mahalla yettiligi xodimisiz." },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.7
                })
            });

            if (response.ok) {
                const data = await response.json();
                return data.choices[0].message.content;
            } else {
                const errData = await response.json();
                throw new Error(errData.error?.message || response.statusText);
            }
        } catch (error) {
            console.error("OpenAI Error:", error);
            throw error;
        }
    },

    // Templates: Kirish qismi (Turli xil variantlar)
    getIntro: (data) => {
        const { mahalla, lavozim, fuqaro, manzil, lang, sana } = data;
        const dateStr = IntelAI.getDateStr(lang, sana);
        const l = lavozim.toLowerCase();

        if (lang === 'latin') {
            const templates = [
                `Qo'qon shahar "${mahalla}" MFY hududida istiqomat qiluvchi ${fuqaro} bilan ${dateStr} ${l} tomonidan profilaktik suhbat o'tkazildi.`,
                `${dateStr} kuni Qo'qon shahar "${mahalla}" mahallasida yashovchi fuqaro ${fuqaro} xonadoniga tashrif buyurildi va ${l} ishtirokida suhbat olib borildi.`,
                `Qo'qon shahar "${mahalla}" MFY faollari va ${l} tomonidan ${dateStr} fuqaro ${fuqaro} bilan yuzma-yuz muloqot tashkil etildi.`,
                `${manzil} manzilida yashovchi ${fuqaro}ning murojaati va ijtimoiy holatini o'rganish maqsadida ${dateStr} ${l} tomonidan o'rganish ishlari olib borildi.`
            ];
            return IntelAI.random(templates);
        } else {
            const templates = [
                `Қўқон шаҳар "${mahalla}" МФЙ ҳудудида истиқомат қилувчи ${fuqaro} билан ${dateStr} ${l} томонидан профилактик суҳбат ўтказилди.`,
                `${dateStr} куни Қўқон шаҳар "${mahalla}" маҳалласида яшовчи фуқаро ${fuqaro} хонадонига ташриф буюрилди ва ${l} иштирокида суҳбат олиб борилди.`,
                `Қўқон шаҳар "${mahalla}" МФЙ фаоллари ва ${l} томонидан ${dateStr} фуқаро ${fuqaro} билан юзма-юз мулоқот ташкил этилди.`,
                `${manzil} манзилида яшовчи ${fuqaro}нинг мурожаати ва ижтимоий ҳолатини ўрганиш мақсадида ${dateStr} ${l} томонидан ўрганиш ишлари олиб борилди.`
            ];
            return IntelAI.random(templates);
        }
    },

    analyze: (problem, lang, getContext = false) => {
        const p = problem.toLowerCase();
        let context = 'general';

        // Integrated Context Detection (Latin + Cyrillic)
        const isJob = p.includes('ish') || p.includes('иш') || p.includes('bandlik') || p.includes('бандлик') || p.includes('daromad') || p.includes('даромад') || p.includes('kasanach') || p.includes('касанач') || p.includes('tikuv') || p.includes('тиқув') || p.includes('ishga joyla') || p.includes('ишга жойла') || p.includes('anex') || p.includes('текстил');
        const isHome = p.includes('uy') || p.includes('уй') || p.includes('tom') || p.includes('том') || p.includes('yer') || p.includes('ер') || p.includes('remont') || p.includes('ремонт') || p.includes('kadastr') || p.includes('кадастр');
        const isFamily = p.includes('oila') || p.includes('оила') || p.includes('nizo') || p.includes('низо') || p.includes('er-xotin') || p.includes('janjal') || p.includes('жанжал') || p.includes('ajrim') || p.includes('ажрим') || p.includes('notinch') || p.includes('нотинч');
        const isHealth = p.includes('ruhiy') || p.includes('руҳий') || p.includes('kasal') || p.includes('касал') || p.includes('salomatlik') || p.includes('саломатлик') || p.includes('tibbiy') || p.includes('тиббий') || p.includes('shifoxona') || p.includes('шифохона') || p.includes('dori') || p.includes('дори');
        const isMigrant = p.includes('migrant') || p.includes('мигрант') || p.includes('xorij') || p.includes('хориж') || p.includes('rossiya') || p.includes('россия') || p.includes('chet el') || p.includes('чет ел') || p.includes('vatan') || p.includes('ватан');
        const isYouth = p.includes('yosh') || p.includes('ёш') || p.includes('talaba') || p.includes('талаба') || p.includes('student') || p.includes('o\'qish') || p.includes('ўқиш') || p.includes('imtihon') || p.includes('имтиҳон');
        const isDisability = p.includes('nogiron') || p.includes('ногирон') || p.includes('infirm') || p.includes('nafaqa') || p.includes('нафақа') || p.includes('nogironlik') || p.includes('ногиронлик') || p.includes('protez') || p.includes('протез');

        if (isMigrant) context = 'migrant';
        else if (isYouth) context = 'youth';
        else if (isDisability) context = 'disability';
        else if (isJob) context = 'job';
        else if (isHome) context = 'home';
        else if (isFamily) context = 'family';
        else if (isHealth) context = 'health';

        if (getContext) return context;

        if (lang === 'latin') {
            const phrases = {
                job: [
                    `Suhbat jarayonida fuqaroning doimiy daromad manbaiga ega emasligi va ish topishda qiyinchiliklarga duch kelayotgani aniqlandi. Ayniqsa, ${problem} masalasi uning ijtimoiy holatiga salbiy ta'sir ko'rsatmoqda.`,
                    `Fuqaro asosan bandlik masalasida qiynalayotganini bildirdi. Uning so'zlariga ko'ra, ${problem} muammosi sababli ijtimoiy ko'makka muhtoj.`,
                    `O'rganishlar shuni ko'rsatdiki, fuqaro mehnat qilish xohishi bo'lsa-da, ma'lum sabablarga ko'ra vaqtincha ishsiz qolgan. ${problem} masalasi esa vaziyatni yanada jiddiylashtirgan.`
                ],
                migrant: [
                    `Fuqaro yaqinda xorijdan (mehnat migratsiyasidan) qaytgan bo'lib, hozirda ijtimoiy moslashish va doimiy ish o'rniga ega bo'lish masalasida yordamga muhtoj ekanligi aniqlandi.`,
                    `Suhbat davomida xorijdan qaytgan fuqaroning bandligini ta'minlash va "${problem}" muammosini hal etish choralari muhokama qilindi.`
                ],
                youth: [
                    `Yoshlar vakili sifatida fuqaro bilan o'tkazilgan suhbatda uning kelajakdagi orzu-niyatlari va "${problem}" masalasi bo'yicha qiynayotgan kamchiliklar o'rganildi.`,
                    `Fuqaroning yosh ekanligi inobatga olingan holda, uning bandligini ta'minlash va foydali mehnatga yo'naltirish bo'yicha tushuntirish berildi.`
                ],
                disability: [
                    `Imkoniyati cheklangan (nogironligi bor) ushbu fuqaroning ijtimoiy himoyasi va "${problem}" masalasi yuzasidan bildirilgan iltimosi atroflicha o'rganildi.`,
                    `Suhbat davomida fuqaroning sog'lig'i sirlari va "${problem}" bo'yicha ko'makka muhtojlik darajasi aniqlandi.`
                ],
                home: [
                    `Fuqaroning yashash sharoitlari ko'zdan kechirilganda, haqiqatdan ham uy-joy bilan bog'liq muammolar mavjudligi tasdiqlandi. "${problem}" masalasi zudlik bilan hal etilishi lozim.`
                ],
                family: [
                    `Oilaviy muhit o'rganilganda, oila a'zolari o'rtasida o'zaro tushunmovchiliklar borligi sezildi. "${problem}" masalasi nizolarning asosiy sababi bo'lib xizmat qilmoqda.`
                ],
                health: [
                    `Fuqaroning ruhiy va jismoniy holati o'rganilganda, unga psixologik va tibbiy ko'mak zarurligi aniqlandi. "${problem}" masalasi uning salomatligiga jiddiy xavf solmoqda.`
                ],
                general: [
                    `Fuqaro o'zini qiynayotgan ${problem} masalasi yuzasidan yordam so'radi. Vaziyat joyiga chiqib o'rganilganda, haqiqatdan ham ushbu muammo mavjudligi o'z tasdig'ini topdi.`
                ]
            };
            return IntelAI.random(phrases[context] || phrases.general);
        } else {
            const phrases = {
                job: [
                    `Суҳбат жараёнида фуқаронинг доимий даромад манбаига эга эмаслиги ва иш топишда қийинчиликларга дуч келаётгани аниқланди. Айниқса, ${problem} масаласи унинг ижтимоий ҳолатига салбий таъсир кўрсатмоқда.`,
                    `Фуқаро асосан бандлик масаласида қийналаётганини билдирди. Унинг сўзларига кўра, ${problem} муаммоси сабабли оилавий бюджетда етишмовчиликлар мавжуд.`,
                    `Ўрганишлар шуни кўрсатдики, фуқаро меҳнат қилиш хоҳиши бўлса-да, маълум сабабларга кўра вақтинча ишсиз қолган. ${problem} масаласи эса вазиятни янада жиддийлаштирган.`
                ],
                migrant: [
                    `Фуқаро яқинда хориждан (меҳнат миграциясидан) қайтган бўлиб, ҳозирда ижтимоий мослашиш ва доимий иш ўрнига эга бўлиш масаласида ёрдамга муҳтож эканлиги аниқланди.`,
                    `Суҳбат давомида хориждан қайтган фуқаронинг бандлигини таъминлаш ва ${problem} муаммосини ҳал этиш чоралари муҳокама қилинди.`
                ],
                youth: [
                    `Ёшлар вакили сифатида фуқаро билан ўтказилган суҳбатда унинг келажакдаги орзу-ниятлари ва ${problem} масаласи бўйича қийнаётган камчиликлар ўрганилди.`,
                    `Фуқаронинг ёш эканлиги инобатга олинган ҳолда, унинг бандлигини таъминлаш ва фойдали меҳнатга йўналтириш бўйича тушунтириш берилди.`
                ],
                disability: [
                    `Имконияти чекланган (ногиронлиги бор) ушбу фуқаронинг ижтимоий ҳимояси ва ${problem} масаласи юзасидан билдирилган илтимоси атрофлича ўрганилди.`,
                    `Суҳбат давомида фуқаронинг соғлиғи ва ${problem} бўйича кўмакка муҳтожлик даражаси аниқланди.`
                ],
                home: [
                    `Фуқаронинг яшаш шароитлари кўздан кечирилганда, ҳақиқатдан ҳам уй-жой билан боғлиқ муаммолар мавжудлиги тасдиқланди. ${problem} масаласи зудлик билан ҳал этилиши лозим.`
                ],
                family: [
                    `Оилавий муҳит ўрганилганда, оила аъзолари ўртасида ўзаро тушунмовчиликлар борлиги сезилди. ${problem} масаласи низоларнинг асосий сабаби бўлиб хизмат қилмоқда.`
                ],
                health: [
                    `Фуқаронинг руҳий ва жисмоний ҳолати ўрганилганда, унга психологик ва тиббий кўмак зарурлиги аниқланди. ${problem} масаласи унинг саломатлигига жиддий хавф солмоқда.`
                ],
                general: [
                    `Фуқаро ўзини қийнаётган ${problem} масаласи юзасидан ёрдам сўради. Вазият жойига чиқиб ўрганилганда, ҳақиқатдан ҳам ушбу муаммо мавжудлиги ўз тасдиғини топди.`
                ],
            };
            return IntelAI.random(phrases[context] || phrases.general);
        }
    },

    // --- AI LOGIC & REASONING ENGINE (Human-Like Narrative) ---
    LogicEngine: {
        getConnectors: (lang) => {
            const list = {
                latin: ["Shu bilan birga,", "Bundan tashqari,", "Natijada,", "Shu sababli,", "Vaziyatni o'rganish davomida,"],
                cyrillic: ["Шу билан бирга,", "Бундан ташқари,", "Натижада,", "Шу сабабли,", "Вазиятни ўрганиш давомида,"]
            };
            return list[lang];
        },

        // Mantiqiy bog'liqlikni tekshirish
        reason: (problem, context, lang) => {
            const p = problem.toLowerCase();
            const l = lang === 'latin';

            if (context === 'job') {
                if (p.includes('kredit') || p.includes('кредит')) {
                    return l ? "Fuqaroning tadbirkorlikka bo'lgan qiziqishini inobatga olib, bank filialiga yo'naltirildi." :
                        "Фуқаронинг тадбиркорликка бўлган қизиқишини инобатга олиб, банк филиалига йўналтирилди.";
                }
                if (p.includes('joyla') || p.includes('жойла')) {
                    return l ? "Fuqaroning bandligini ta'minlash maqsadida kasanachilik va yirik sanoat korxonalariga joylashtirish choralari ko'rildi." :
                        "Фуқаронинг бандлигини таъминлаш мақсадида касаначилик ва йирик саноат корхоналарига жойлаштириш чоралари кўрилди.";
                }
            }
            if (context === 'family' && (p.includes('ajrim') || p.includes('ажрим'))) {
                return l ? "Oila parokandaligining oldini olish maqsadida mahalla nuroniylari bilan maxsus suhbat tashkil etildi." :
                    "Оила парокандалигининг олдини олиш мақсадида маҳалла нуронийлари билан махсус суҳбат ташкил этилди.";
            }
            return "";
        }
    },

    // Templates: Amaliy choralar (Takomillashtirilgan va aqlli)
    getActions: (problem, band, lang) => {
        const p = problem.toLowerCase();
        let actions = [];
        const isLatin = lang === 'latin';

        // Context detection (enhanced for portrait)
        let context = 'general';
        if (p.includes('ish') || p.includes('иш') || p.includes('bandlik') || p.includes('бандлик')) context = 'job';
        else if (p.includes('migrant') || p.includes('мигрант') || p.includes('rossiya') || p.includes('россия')) context = 'migrant';
        else if (p.includes('yosh') || p.includes('ёш') || p.includes('talaba') || p.includes('student')) context = 'youth';
        else if (p.includes('nogiron') || p.includes('ногирон') || p.includes('nafaqa') || p.includes('нафақа')) context = 'disability';
        else if (p.includes('oila') || p.includes('оила') || p.includes('nizo') || p.includes('низо')) context = 'family';
        else if (p.includes('ruhiy') || p.includes('руҳий') || p.includes('kasal') || p.includes('касал')) context = 'health';

        const db = {
            latin: {
                common: ['Fuqaroning ijtimoiy holati yuzasidan huquqiy tushuntirish berildi.', 'Vaziyat joyiga chiqib atroflicha o\'rganildi.'],
                job: ['Bo\'sh ish o\'rinlari bo\'yicha huquqiy tushuntirish berildi.', 'Bandlikni ta\'minlash masalasi mahalla yettiligi bilan muhokama qilindi.'],
                migrant: ['Migratsiya agentligi orqali qonuniy ishga joylashish tartibi tushuntirildi.', 'Xorijdan qaytgan fuqaroni reabilitatsiya qilish choralari ko\'rildi.'],
                youth: ['Yoshlar yetakchisi bilan birgalikda motivatsion suhbat o\'tkazildi.', 'Bo\'sh vaqtini mazmunli tashkil etish uchun to\'garaklarga yo\'naltirildi.'],
                disability: ['Ijtimoiy yordam va nafaqa tayinlash bo\'yicha tushuntirish berildi.', 'Tibbiy-ijtimoiy ekspertiza xulosasiga asosan ko\'maklashildi.'],
                family: ['Er-xotin munosabatlarini sog\'lomlashtirish bo\'yicha maslahat berildi.', 'Nizoli vaziyatni yumshatish uchun mahalla faollari jalb etildi.'],
                health: ['Hududiy poliklinika orqali bepul tibbiy ko\'rikdan o\'tish tashkil etildi.', 'Psixolog yordamiga ehtiyoji borligi sababli mutaxassis jalb etildi.']
            },
            cyrillic: {
                common: ['Фуқаронинг ижтимоий ҳолати юзасидан ҳуқуқий тушунтириш берилди.', 'Ҳолат вазиятга қараб атрофлича ўрганилди.'],
                job: ['Бўш иш ўринлари ярмаркасида иштирок этиш тавсия этилди.', 'Ҳоким ёрдамчиси билан бандлик масаласи муҳокама қилинди.'],
                migrant: ['Миграция агентлиги орқали қонуний ишга жойлашиш тартиби тушунтирилди.', 'Хориждан қайтган фуқарони реабилитация қилиш чоралари кўрилди.'],
                youth: ['Ёшлар етакчиси билан биргаликда мотивацион суҳбат ўтказилди.', 'Бўш вақтини мазмунли ташкил этиш учун тўгаракларга йўналтирилди.'],
                disability: ['Ижтимоий ёрдам ва нафақа тайинлаш бўйича тушунтириш берилди.', 'Тиббий-ижтимоий экспертиза хулосасига асосан кўмаклашилди.'],
                family: ['Эр-хотин муносабатларини соғломлаштириш бўйича маслаҳат берилди.', 'Низоли вазиятни юмшатиш учун маҳалла фаоллари жалб этилди.'],
                health: ['Ҳудудий поликлиника орқали бепул тиббий кўрикдан ўтиш ташкил этилди.', 'Психолог ёрдамига эҳтиёжи борлиги сабабли мутахассис жалб этилди.']
            }
        };

        const target = isLatin ? db.latin : db.cyrillic;
        actions.push(IntelAI.random(target.common));

        let secondAction = IntelAI.random(target[context] || target.common);
        // Prevent immediate duplication
        if (actions.includes(secondAction)) {
            // Pick another one from the same list if possible, or just the other common
            const sublist = target[context] || target.common;
            if (sublist.length > 1) {
                secondAction = sublist.find(a => !actions.includes(a)) || secondAction;
            }
        }
        actions.push(secondAction);

        return actions;
    },

    // --- SMART FORMALIZER ENGINE (For Smart Fix Button) ---
    formalizeText: (text, lang) => {
        if (!text || text.length < 5) return text;
        const l = lang === 'latin';

        // Step 1: Spelling/Basic corrections (Mock for now, can be expanded)
        let formalized = text.trim();

        // Step 2: Formal vocabulary replacement
        const replacements = l ? {
            "yordam so'radi": "yordam ko'rsatish masalasida murojaat qildi",
            "ish yo'q": "doimiy daromad manbaiga ega emas",
            "janjal qildi": "o'zaro kelishmovchilik holatlari kuzatildi",
            "aytdi": "ma'lum qildi va tushuntirish berdi",
            "bordik": "manziliga tashrif buyurildi",
            "ko'rdik": "holati atroflicha o'rganildi",
            "yomon": "salbiy",
            "yaxshi": "ijobiy"
        } : {
            "ёрдам сўради": "ёрдам кўрсатиш масаласида мурожаат қилди",
            "иш йўқ": "доимий даромад манбаига эга эмас",
            "жавл қилдим": "жалб қилинди",
            "жалб қилдим": "жалб қилинди",
            "ёрдам бердим": "ёрдам кўрсатилди",
            "жавп бердим": "жавоб берилди",
            "жанжал қилди": "ўзаро келишмовчилик ҳолатлари кузатилди",
            "айтди": "маълум қилди ва тушунтириш берди",
            "бордик": "манзилига ташриф буюрилди",
            "кўрдик": "ҳолати атрофлича ўрганилди",
            "ёмон": "салбий",
            "яхши": "ижобий"
        };

        for (let key in replacements) {
            const regex = new RegExp(key, "gi");
            formalized = formalized.replace(regex, replacements[key]);
        }

        // Step 3: Formal ending
        if (!formalized.endsWith('.') && !formalized.endsWith('!') && !formalized.endsWith('?')) {
            formalized += '.';
        }

        return formalized;
    },

    // Templates: Xulosa
    getConclusion: (problem, lang) => {
        if (lang === 'latin') {
            const templates = [
                `Yuqoridagi chora-tadbirlar natijasida fuqaro ${problem} yechimi bo'yicha aniq tushunchaga ega bo'ldi. MFY tomonidan nazorat o'rnatildi.`,
                `Suhbat yakunida fuqaro berilgan maslahat va yordamdan mamnunligini bildirdi. Kelgusida ham ushbu oila doimiy monitoring qilib boriladi.`,
                `Ushbu amaliy ishlar natijasi o'laroq, muammoning ijobiy yechimi ta'minlandi va ijtimoiy keskinlikning oldi olindi.`
            ];
            return IntelAI.random(templates);
        } else {
            const templates = [
                `Юқоридаги чора-тадбирлар натижасида фуқаро ${problem} ечими бўйича аниқ тушунчага ега бўлди. МФЙ томонидан назорат ўрнатилди.`,
                `Суҳбат якунида фуқаро берилган маслаҳат ва ёрдамдан мамнунлигини билдирди. Келгусида ҳам ушбу оила доимий мониторинг қилиб борилади.`,
                `Ушбу амалий ишлар натижаси ўлароқ, муаммонинг ижобий ечими таъминланди ва ижтимоий кескинликнинг олди олинди.`
            ];
            return IntelAI.random(templates);
        }
    }
};

// ==========================================
// MAIN EXPORT FUNCTIONS
// ==========================================

// Template Based Generation (Offline Friendly)
function generateIntelligentText(data) {
    const { mahalla, lavozim, band, fuqaro, manzil, problem, solution, lang } = data;
    const l = lang === 'latin';

    const probText = problem || "";
    const context = IntelAI.analyze(probText, lang, true);
    const analysis = IntelAI.analyze(probText, lang);
    const reasoning = IntelAI.LogicEngine.reason(probText, context, lang);
    const actions = IntelAI.getActions(probText, band, lang);
    const conclusion = IntelAI.getConclusion(probText, lang);

    const city = l ? "Qo'qon shahar" : "Қўқон шаҳар";
    const mfy = l ? "MFY" : "МФЙ";
    const residency = l ? "manzilida istiqomat qiluvchi fuqaro" : "манзилида истиқомат қилувчи фуқаро";
    const gaChar = l ? "ga" : "га";

    const mahallaName = mahalla && mahalla !== "" ? ` "${mahalla}" ` : " ";
    let introText = `${city}${mahallaName}${mfy} ${manzil} ${residency} ${fuqaro} ${gaChar} `;

    if (problem) {
        introText += l ? `bilan "${problem}" masalasida suhbat o'tkazildi. ` : `билан "${problem}" масаласида суҳбат ўтказилди. `;
    } else {
        introText += l ? `bilan profilaktik suhbat o'tkazildi. ` : `билан профилактик суҳбат ўтказилди. `;
    }

    const finalAnalysis = introText + analysis + (reasoning ? " " + reasoning : "");

    // Actions formatlash (yaxlit matn ko'rinishida)
    let actionParts = [];
    if (l) {
        actionParts.push("Vaziyatni o'rganish davomida aniqlangan muammolarni bartaraf etish maqsadida bir qator amaliy chora-tadbirlar amalga oshirildi.");
        let allActions = [...actions];
        const fullContext = (probText + " " + (solution || "")).toLowerCase();

        // Agar Section 8 da kasanachilik bo'lsa, template orqali qayta qo'shmaymiz (bir marta formalizeText orqali qo'shiladi)
        if (!solution || !solution.toLowerCase().includes('kasanach')) {
            if (fullContext.includes('joyla') || fullContext.includes('anex') || fullContext.includes('kasanach')) {
                allActions.push("fuqaroni kasanachilik asosida bandligini ta'minlashga ko'maklashildi");
            }
        }

        // Remove duplicates if any
        allActions = [...new Set(allActions)];

        actionParts.push(allActions.join(", shuningdek, ") + " kabi zaruriy ishlar bajarildi.");
        if (solution) {
            actionParts.push(IntelAI.formalizeText(solution, lang));
        }
        actionParts.push(conclusion);
    } else {
        actionParts.push("Вазиятни ўрганиш давомида аниқланган муаммоларни бартараф этиш мақсадида бир қатор амалий чора-тадбирлар амалга оширилди.");
        let allActions = [...actions];
        const fullContext = (probText + " " + (solution || "")).toLowerCase();

        // Agar Section 8 da касаначилик бўлса, такроран қўшмаймиз
        if (!solution || !solution.toLowerCase().includes('касанач')) {
            if (fullContext.includes('жойла') || fullContext.includes('анех') || fullContext.includes('касанач')) {
                allActions.push("фуқарони касаначилик асосида бандлигини таъминлашга кўмаклашилди");
            }
        }

        // Remove duplicates if any
        allActions = [...new Set(allActions)];

        actionParts.push(allActions.join(", шунингдек, ") + " каби зарурий ишлар бажарилди.");
        if (solution) {
            actionParts.push(IntelAI.formalizeText(solution, lang));
        }
        actionParts.push(conclusion);
    }

    const finalActionsIntro = l
        ? `${city} "${mahalla}" MFY ${manzil} manzilida istiqomat qiluvchi fuqaro ${fuqaro} bilan o'tkazilgan o'rganish ishlari davomida: `
        : `${city} "${mahalla}" МФЙ ${manzil} манзилида истиқомат қилувчи фуқаро ${fuqaro} билан ўтказилган ўрганиш ишлари давомида: `;

    const finalActions = finalActionsIntro + actionParts.join(" ");

    return {
        problem: problem || (l ? 'Profilaktik suhbat' : 'Профилактик суҳбат'),
        analysis: "", // Hiding from auto-fill as per user request
        actions: finalActions,
        fullText: finalActions
    };
}

// Gemini Based Generation (Online Required)
async function generateGeminiAIContent(data) {
    const { mahalla, lavozim, band, bandDesc, fuqaro, manzil, problem, solution, docType, lang } = data;
    const isLatin = lang === 'latin';
    const scriptName = isLatin ? 'Lotin (Latin)' : 'Kirill (Cyrillic)';
    const docName = docType === 'dalolatnoma' ? (isLatin ? 'Dalolatnoma' : 'Далолатнома') : (isLatin ? 'Ma\'lumotnoma' : 'Маълумотнома');

    const prompt = `
        Siz O'zbekistondagi mahalla yettiligi tizimida ishlovchi professional mutaxassisiz. 
        Menga ${docName} uchun rasmiy matn tayyorlab bering.

        DIQQAT: Matn aynan quyidagi "BAND KO'RSATMASI"ga muvofiq bo'lishi, undagi muammolarni tahlil qilishi va unda belgilangan vazifalarni aks ettirishi SHART.

        HUJJAT TURI: ${docName}
        BAND RAQAMI: ${band}
        BAND KO'RSATMASI: ${bandDesc}

        MAXSUS KO'RSATMA:
        - Agar hujjat DALOLATNOMA bo'lsa, ishlar "Mahalla yettiligi" bilan hamkorlikda amalga oshirilgan deb yozing.
        - Agar hujjat MA'LUMOTNOMA bo'lsa, ishlar faqat "${lavozim}" tomonidan yakka tartibda (individual) bajarilgan deb yozing.

        SHARTLAR:
        1. Lavozim: ${lavozim}.
        2. Alifbo: FAQAT ${scriptName}.
        3. Ohang: O'ta rasmiy, idoraviy uslubda.
        4. Struktura: Matnni ikki qismga ajrating: "Tahlil" va "Amaliy choralar".
        5. Shaxs: Majhul nisbatda yozing.
        6. TA'QIQLANADI: Raqamlangan yoki markerlangan ro'yxatlardan (1, 2, 3..., - ...) foydalanish qat'iyan man etiladi. Matnni yaxlit, professional bog'lovchi so'zlar (shuningdek, shu bilan birga, qayd etilganlar asosida, natijada) yordamida yaxlit hikoya ko'rinishida yozing.

        Ma'lumotlar:
        - Mahalla: ${mahalla}
        - Fuqaro: ${fuqaro}
        - Manzil: ${manzil}
        - Muammo: ${problem}
        - Yechim asosi: ${solution || 'Profilaktik chora'}

        Matn mazmunida:
        - Birinchi qism (analysis): Hozirgi kunda bu qism hujjatda ko'rinmaydi, lekin mantiqiy bog'liqlik uchun yozing.
        - Ikkinchi qism (actions): BU ENG MUHIM QISM. Section 9 uchun matn tayyorlang. Matnni quyidagicha boshlang: "${mahalla} MFY ${manzil} manzilida istiqomat qiluvchi fuqaro ${fuqaro} bilan o'tkazilgan o'rganish ishlari davomida: ..." va davomidan band vazifasi hamda kiritilgan yechim (${solution}) asosida bajarilgan ishlarni professional, yaxlit matn (hikoya) ko'rinishida bayon eting.

        JAVOB FORMATI JSON:
        {
           "problem_fix": "Muammoning mazmuni (qo'shtirnoqsiz, qisqa sarlavha)",
           "analysis": "Tahlil qismi matni",
           "actions": "Amaliy ishlar qismi matni"
        }
        Faqat JSON qaytaring.
    `;

    const result = await IntelAI.askGemini(prompt);

    if (!result) {
        return generateIntelligentText(data);
    }

    try {
        const cleanJson = result.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleanJson);

        return {
            problem: parsed.problem_fix || problem || (isLatin ? 'Profilaktik suhbat' : 'Профилактик суҳбат'),
            analysis: parsed.analysis || "",
            actions: parsed.actions || "",
            fullText: (parsed.analysis ? parsed.analysis + "\n\n" : "") + (parsed.actions || "")
        };
    } catch (e) {
        console.warn("Gemini JSON parse error", e);
        return {
            problem: problem || (isLatin ? 'Profilaktik suhbat' : 'Профилактик суҳбат'),
            analysis: "",
            actions: result,
            fullText: result
        };
    }
}

// OpenAI Based Generation
async function generateOpenAIContent(data) {
    const { mahalla, lavozim, band, bandDesc, fuqaro, manzil, problem, solution, docType, lang } = data;
    const isLatin = lang === 'latin';
    const scriptName = isLatin ? 'Lotin (Latin)' : 'Kirill (Cyrillic)';
    const docName = docType === 'dalolatnoma' ? (isLatin ? 'Dalolatnoma' : 'Далолатнома') : (isLatin ? 'Ma\'lumotnoma' : 'Маълумотнома');

    const prompt = `
        Siz O'zbekistondagi mahalla yettiligi tizimida ishlovchi professional OpenAI mutaxassisiz. 
        Menga ${docName} uchun o'ta rasmiy matn tayyorlab bering.

        HUJJAT TURI: ${docName}
        BAND RAQAMI: ${band}
        BAND KO'RSATMASI: ${bandDesc}

        MAXSUS KO'RSATMA:
        - Agar hujjat DALOLATNOMA bo'lsa, barcha harakatlar "Mahalla yettiligi" (rais, inspektor, yoshlar yetakchisi va h.k.) bilan hamkorlikda amalga oshirilgan deb ko'rsatilsin.
        - Agar hujjat MA'LUMOTNOMA bo'lsa, barcha harakatlar faqat "${lavozim}" tomonidan yakka tartibda (individual) bajarilgan deb ko'rsatilsin.

        SHARTLAR:
        1. Lavozim: ${lavozim}.
        2. Alifbo: FAQAT ${scriptName}.
        3. Ohang: O'ta rasmiy, idoraviy uslubda.
        4. Struktura: Matnni ikki qismga ajrating: "Tahlil" va "Amaliy choralar".
        5. Shaxs: Majhul nisbatda yozing.
        6. MUHIM: Raqamlangan ro'yxatlar (1-dan, 2-dan...) va punktlardan foydalanmang. Matn yaxlit, bir-biriga bog'langan jumlalardan tashkil topishi kerak. Rasmiy bog'lovchi vositalardan unumli foydalaning.

        Ma'lumotlar:
        - Mahalla: ${mahalla}, Fuqaro: ${fuqaro}, Manzil: ${manzil}
        - Fuqaro muammosi: ${problem}
        - Yechim asosi: ${solution || 'Profilaktik yordam'}

        Matn mazmunida:
        - Birinchi qism (analysis): Mantiqiy bog'liqlik uchun yozing (hujjatda ko'rinmaydi).
        - Ikkinchi qism (actions): ASOSIY QISM. Section 9 uchun professional matn tayyorlang. Matn boshlanishi: "${mahalla} MFY ${manzil} manzilida istiqomat qiluvchi fuqaro ${fuqaro} bilan o'tkazilgan o'rganish ishlari davomida: ..." deb boshlanishi va davomida band ko'rsatmasi hamda yechim (${solution}) asosida bajarilgan ishlar bayon etilishi shart.

        JAVOB FORMATI JSON:
        {
           "problem_fix": "Maqsadli sarlavha (qo'shtirnoqsiz)",
           "analysis": "Tahlil matni",
           "actions": "Harakatlar bayoni"
        }
        Faqat JSON qaytaring.
    `;

    try {
        const result = await IntelAI.askOpenAI(prompt);
        const cleanJson = result.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleanJson);

        return {
            problem: parsed.problem_fix || problem || (isLatin ? 'Profilaktik suhbat' : 'Профилактик суҳбат'),
            analysis: parsed.analysis || "",
            actions: parsed.actions || "",
            fullText: (parsed.analysis ? parsed.analysis + "\n\n" : "") + (parsed.actions || "")
        };
    } catch (e) {
        console.error("OpenAI fail fallback to template", e);
        return generateIntelligentText(data);
    }
}

// Log loaded
console.log("IntelAI v3.0 Loaded - Gemini Hybrid Enabled");
