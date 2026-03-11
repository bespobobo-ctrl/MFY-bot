require('dotenv').config();
const { Telegraf, Markup, session } = require('telegraf');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
const express = require('express');

/**
 * SENIOR SERVICES & UTILS
 * Proper Dependency Injection pattern simulation
 */
const aiService = require('./services/ai_service');
const payments = require('./payments');
const knowledge = require('./knowledge');
const bandsData = require('./bands');
const pdfService = require('./services/pdf_service');
const orthography = require('./utils/orthography');

const ADMIN_ID = String(process.env.ADMIN_ID || '').trim();

// 🛡️ SECURITY: Environment Variables Validation
// Faqat GEMINI va BOT_TOKEN majburiy — boshqa AI kalitlari ixtiyoriy (zaxira)
const REQUIRED_ENVS = ['BOT_TOKEN', 'GEMINI_API_KEY', 'ADMIN_ID'];
const OPTIONAL_ENVS = ['OPENAI_API_KEY', 'GROQ_API_KEY', 'DEEPSEEK_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3'];
const missingEnvs = REQUIRED_ENVS.filter(e => !process.env[e]);
if (missingEnvs.length > 0) {
    console.error(`❌ CRITICAL ERROR: Missing Environment Variables: ${missingEnvs.join(', ')}`);
    process.exit(1);
}
const activeOptional = OPTIONAL_ENVS.filter(e => process.env[e]);
if (activeOptional.length > 0) {
    console.log(`🔑 Qo'shimcha AI kalitlari: ${activeOptional.join(', ')}`);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

/**
 * Global Error Handler for Telegram Events
 */
const reportToAdmin = async (error, context = 'GLOBAL') => {
    const time = new Date().toLocaleString();
    const errorStack = error.stack || 'No stack trace';
    const errorMsg = `🚨 <b>CRITICAL ERROR REPORT</b>\n\n` +
        `📅 Time: <code>${time}</code>\n` +
        `📂 Context: <b>${context}</b>\n` +
        `❌ Error: <code>${error.message || error}</code>`;

    console.error(`[${context}]`, error);

    if (ADMIN_ID) {
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('🤖 AI TAHLIL', `ai_analyze_error_${context}`)]
        ]);

        await bot.telegram.sendMessage(ADMIN_ID, errorMsg, {
            parse_mode: 'HTML',
            ...keyboard
        }).catch(() => { });

        // Faylga ham saqlash (AI uchun context sifatida)
        const log = `[${time}] [${context}] ${error.message}\n${errorStack}\n---\n`;
        try {
            fs.appendFileSync(path.resolve(__dirname, 'error_logs.txt'), log);
        } catch (e) { }
    }
};

// --- OFFLINE AI ENGINE (Safety Net) ---
function generateOfflineText(data) {
    const isCyr = data.lang === 'cyrillic';
    const m = orthography.sanitize(data.mahalla, data.lang);
    const f = orthography.sanitize(data.fuqaro, data.lang);
    const l = orthography.sanitize(data.lavozim, data.lang);
    const mz = orthography.sanitize(data.manzil, data.lang);
    const b = data.band;
    const p = orthography.sanitize(data.problem || (isCyr ? "муаммо ўрганилди" : "muammo o'rganildi"), data.lang);

    if (isCyr) {
        return `Қўқон шаҳар, ${m} МФЙ, ${mz}да яшовчи фуқаро ${f} билан ${l} ҳамда маҳалла еттилиги томонидан профилактик суҳбат ўтказилди. Ўрганиш давомида фуқаронинг "${p}" масаласи ва ${b}-банд ижроси муҳокама қилинди. Фуқарога ҳуқуқий тушунтириш берилди ва ижтимоий кўмак кўрсатиш чоралари белгиланди.`;
    } else {
        return `Qo'qon shahar, ${m} MFY, ${mz}da yashovchi fuqaro ${f} bilan ${l} hamda mahalla yettiligi tomonidan profilaktik suhbat o'tkazildi. O'rganish davomida fuqaroning "${p}" masalasi va ${b}-band ijrosi muhokama qilindi. Fuqaroga huquqiy tushuntirish berildi va ijtimoiy ko'mak ko'rsatish choralari belgilandi.`;
    }
}

// --- UTILS ---
function escapeHTML(text) {
    if (!text) return '';
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sanitizeFilename(name) {
    return name.replace(/[/\\?%*:|"<>]/g, '-').substring(0, 50);
}

function chunkArray(array, size) {
    const chunked = [];
    if (!array) return chunked;
    for (let i = 0; i < array.length; i += size) chunked.push(array.slice(i, i + size));
    return chunked;
}

/** 
 * SENIOR CORE: Project files & directory mapping 
 */
function getProjectContext() {
    const files = {
        'index.js': 'Boshqaruv markazi, bot mantiqi va muloqot tizimi.',
        'payments.js': 'To\'lov va foydalanuvchilar bazasi boshqaruvi.',
        'package.json': 'Loyiha bog\'liqliklari (dependencies).',
        'services/ai_service.js': 'AI (OpenAI, Groq, DeepSeek) integratsiyasi.',
        'services/pdf_service.js': 'PDF generatsiyasi va vizual shablonlar.'
    };
    return Object.entries(files).map(([f, d]) => `Fayl: ${f} -> ${d}`).join('\n');
}

// ============================================
// 📦 DATA PERSISTENCE
// ============================================
let MAHALLALAR = ["Ғозиёғлик", "Исфарагузари", "Исломобод", "Истиқбол", "Калвакгузари", "Катта Ганжиравон", "Марғилон дарвозаси", "Мингтут", "Мисгарлик", "Мўйиmuборак", "Муқимий", "Mustaqillik", "Навруз", "Ноибкўприги", "Нонвойлик гузари", "Нурафшон", "Ўрмонboғ", "Олтинводий", "Оқолтин", "Ойдинбулоқ", "Парпашабоф", "Қаландархона", "Қаймоқлигуzar", "Қипчоқариқ", "Қўшчинор", "Қудуқлик", "Райхон", "Саодат", "Шалдирамоқ", "Шайхон", "Шиkorбеги", "Ширин", "Собир Абдулла", "Сунбула", "Тўғонboши", "Тўлаboy", "Тўхлиmergan", "Толzor", "Тошкентгуzar", "Туркистон", "Урганжиboғ", "Узумzor", "Вақфчорсу", "Ялонғочота", "Янгичорsu", "Янгиобод", "Ёғbozoри", "Зилол"];
let BANDS_BY_LAVOZIM = {
    "Хотин-қизлар фаоли": ["1.2.4", "1.14"],
    "Ҳоким ёрдамчиси": ["1.2.1"],
    "Ижтимоий ходим": ["1.2.3"],
    "Маҳалла раиси": ["1"],
    "Профилактика инспектори": ["1.6"]
};

// 🛡️ SYNC LOCAL FALLBACK LOAD
try {
    if (fs.existsSync(path.resolve(__dirname, 'mahalla_config.json'))) {
        MAHALLALAR = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'mahalla_config.json'), 'utf-8'));
    }
    if (fs.existsSync(path.resolve(__dirname, 'bands_config.json'))) {
        BANDS_BY_LAVOZIM = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'bands_config.json'), 'utf-8'));
    }
} catch (e) {
    console.warn("⚠️ Local config load error:", e.message);
}

// 🌐 ASYNC SUPABASE CONFIG UPDATE
const updateConfigFromSupabase = async () => {
    try {
        const supabase = require('./utils/supabase_client');
        const { data: config, error } = await supabase.from('config').select('*');
        if (config && !error) {
            const mahallas = config.find(c => c.key === 'MAHALLALAR');
            if (mahallas && Array.isArray(mahallas.value) && mahallas.value.length > 0) {
                MAHALLALAR = mahallas.value;
            }

            const bands = config.find(c => c.key === 'BANDS_BY_LAVOZIM');
            // Supabase sync disabled for now to prioritize local bands_config.json
            if (bands && bands.value && Object.keys(bands.value).length > 0) {
                // BANDS_BY_LAVOZIM = bands.value;
                // console.log("Config synced from Supabase (Disabled overwrite)");
            }

            console.log(`✅ Config synced from Supabase (M:${MAHALLALAR.length}, B:${Object.keys(BANDS_BY_LAVOZIM).length})`);
        }
    } catch (e) {
        console.warn("🌐 Supabase config sync skipped:", e.message);
    }
};
updateConfigFromSupabase();

// ============================================
// ⚙️ SESSION & MIDDLEWARE & SECURITY
// ============================================

// 1. Rate Limiting (5 req / sec)
const rateLimitMap = new Map();
const rateLimitMiddleware = async (ctx, next) => {
    if (!ctx.from) return next();
    const now = Date.now();
    const userLimit = rateLimitMap.get(ctx.from.id) || { count: 0, last: now };

    if (now - userLimit.last < 1000) {
        userLimit.count++;
        if (userLimit.count > 5) return; // Silent block for spam
    } else {
        userLimit.count = 1;
        userLimit.last = now;
    }
    rateLimitMap.set(ctx.from.id, userLimit);
    return next();
};

bot.use(session());
bot.use(rateLimitMiddleware);
bot.use(async (ctx, next) => {
    if (ctx.from && !ctx.session) ctx.session = { step: 'IDLE', data: {} };
    try {
        await next();
    } catch (e) {
        reportToAdmin(e, `CHAT_ID_${ctx.from?.id || 'UNKNOWN'}`);
        if (ctx.from) ctx.reply("⚠️ Texnik uzilish. Xatolik adminga yuborildi.").catch(() => { });
    }
});

async function cleanReply(ctx, text, extra = {}) {
    try {
        if (ctx.session?.lastBotMsgId) {
            await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.lastBotMsgId).catch(() => { });
        }
        if (ctx.updateType === 'message' && ctx.message) {
            await ctx.deleteMessage().catch(() => { });
        }
    } catch (e) { }
    const msg = await ctx.reply(text, { parse_mode: 'HTML', ...extra });
    if (ctx.session) ctx.session.lastBotMsgId = msg.message_id;
    return msg;
}

// --- MAIN COMMANDS ---
async function showWelcome(ctx) {
    const user = await payments.createUser(ctx.from.id, ctx.from.username, ctx.from.first_name);
    const isAdmin = String(ctx.from.id) === String(ADMIN_ID);
    ctx.session.step = 'IDLE';
    ctx.session.data = {};

    const balance = isAdmin ? "♾ Cheksiz" : `${user.credits} hujjat`;
    const welcome = `🏛 <b>MFY GENERATOR PRO: FINAL v1.0</b>\n<i>(To'liq va barqaror talqin)</i>\n\n👤 ${escapeHTML(user.fullName)}\n💎 Balans: <b>${balance}</b>`;
    await cleanReply(ctx, welcome, Markup.inlineKeyboard([[Markup.button.callback('📄 Hujjat yaratish', 'start_bot')], [Markup.button.callback('💳 Obuna / To\'lov', 'buy_subscription')]]));
}

bot.start(showWelcome);

bot.command('status', async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;
    const stats = await payments.getStats();
    const totalMem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(0);
    let browserStatus = '🔴 Closed';
    try {
        const br = await pdfService.getBrowser();
        browserStatus = br && br.isConnected() ? '🟢 Active' : '🔴 Closed';
    } catch (e) { }

    const msg = `⚡️ <b>SYSTEM STATUS</b>\n` +
        `━━━━━━━━━━━━━\n` +
        `👤 Users:   <code>${stats.totalUsers}</code>\n` +
        `📄 Docs:    <code>${stats.totalDocs}</code>\n` +
        `🖥 Browser: <code>${browserStatus}</code>\n` +
        `💾 Memory:  <code>${totalMem} MB</code>\n` +
        `🛠 Version: <b>v4.0 Stable (Full)</b>\n` +
        `━━━━━━━━━━━━━`;
    ctx.reply(msg, { parse_mode: 'HTML' });
});

bot.command('dashboard', async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;
    const stats = payments.getStats();
    const ana = stats.analytics || {};

    const bar = (val, max) => {
        const size = 10;
        const filled = Math.round((val / max) * size) || 0;
        return '▇'.repeat(filled) + '┈'.repeat(size - filled);
    };

    let report = `🚀 <b>BIZNES ANALITIKA VA MONITORING</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n\n`;

    // 💰 FINANCIALS
    report += `💵 <b>MOLIYAVIY HOLAT:</b>\n` +
        `├ Jami tushum: <b>${stats.revenue.toLocaleString()} so'm</b>\n` +
        `└ Faol obunachilar: <b>${stats.paidUsers} ta</b>\n\n`;

    // 🔝 POPULARITY
    report += `🌟 <b>OMMABOPLIK (Sotuvlar):</b>\n`;
    const plans = ['starter', 'professional', 'unlimited'];
    let maxEvents = 1;
    plans.forEach(p => maxEvents = Math.max(maxEvents, ana.events?.[`select_${p}`] || 0));

    plans.forEach(p => {
        const count = ana.events?.[`select_${p}`] || 0;
        report += `├ ${p.toUpperCase()}: ${count}\n` +
            `│ <code>${bar(count, maxEvents)}</code>\n`;
    });

    // ⚡️ PERFORMANCE
    report += `\n⚡️ <b>TEXNIK TEZLIK (O'rtacha):</b>\n`;
    const aiPerf = ana.perf?.['AI_Gen'];
    const aiAvg = aiPerf ? (aiPerf.total / aiPerf.count / 1000).toFixed(1) : '0.0';
    report += `├ Sun'iy intellekt: <code>${aiAvg}s</code>\n`;

    const pdfPerf = ana.perf?.['PDF_Engine'];
    const pdfAvg = pdfPerf ? (pdfPerf.total / pdfPerf.count / 1000).toFixed(1) : '0.0';
    report += `└ PDF yaratish: <code>${pdfAvg}s</code>\n\n`;

    // 📈 GROWTH
    report += `📈 <b>O'SISH (Oxirgi 3 kun):</b>\n`;
    const trends = Object.entries(ana.trends || {}).sort().slice(-3);
    if (trends.length === 0) report += `<i>Ma'lumotlar yig'ilmoqda...</i>\n`;
    trends.forEach(([day, d]) => {
        report += `📅 ${day}: 👤+${d.users} | 📄+${d.docs}\n`;
    });

    report += `\n━━━━━━━━━━━━━━━━━━\n` +
        `✅ <b>Status:</b> 🟢 Tizim barqaror ishlamoqda`;

    await ctx.reply(report, { parse_mode: 'HTML' });
});

bot.command('audit', async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;
    const smsg = await ctx.reply("🔍 <b>Tizim auditi boshlandi (v4.5)...</b>", { parse_mode: 'HTML' });

    let report = `⚖️ <b>DIAGNOSTIC & AI STATUS REPORT</b>\n━━━━━━━━━━━━━━━━━━━━\n\n`;

    // 1. SERVICES & ENV
    const envs = ['BOT_TOKEN', 'SUPABASE_URL', 'ADMIN_ID'];
    const missing = envs.filter(e => !process.env[e]);
    report += `🔑 <b>TIZIM:</b> ${missing.length === 0 ? '✅ OK' : '❌ Xato: ' + missing.join(', ')}\n`;

    const htmlExists = fs.existsSync(path.resolve(__dirname, '../index.html'));
    report += `📁 <b>TEMPLATE:</b> ${htmlExists ? '✅ OK' : '❌ Shablonda xatolik'}\n`;

    try {
        const stats = await payments.getStats();
        report += `🗄 <b>DATABASE:</b> ✅ OK (${stats.totalUsers} users)\n\n`;
    } catch (e) {
        report += `🗄 <b>DATABASE:</b> ❌ Xato (${e.message})\n\n`;
    }

    // 2. AI MODELS STATUS
    report += `🤖 <b>AI MODULLARI HOLATI:</b>\n`;

    const checkAI = async (name, fn) => {
        try {
            await fn("ping");
            return `├ <b>${name}:</b> 🟢 Ishlayapti\n`;
        } catch (e) {
            let reason = e.message;
            if (reason.includes("429") || reason.includes("quota")) reason = "Limit tugagan (Quota Exceeded)";
            if (reason.includes("401") || reason.includes("key")) reason = "Kalit xato (Invalid Key)";
            if (reason.includes("timeout")) reason = "Vaqt tugadi (Timeout)";
            // Remove any URLs for cleanliness
            reason = reason.replace(/https?:\/\/[^\s]+/g, '').trim();
            return `├ <b>${name}:</b> 🔴 Xato (${reason})\n`;
        }
    };

    report += await checkAI("Groq (Llama 3)", (p) => aiService.askGroq(p));
    report += await checkAI("Gemini (Google)", (p) => aiService.askGemini(p));
    report += await checkAI("DeepSeek (Coder)", (p) => aiService.askDeepSeek(p));
    report += await checkAI("OpenAI (GPT-4o)", (p) => aiService.askOpenAI(p));

    // 3. BROWSER POOL
    try {
        const br = await pdfService.getBrowser();
        const ver = await br.version();
        report += `\n🌐 <b>BROWSER:</b> ✅ OK (${ver.split('/').pop()})\n`;
    } catch (e) {
        report += `\n🌐 <b>BROWSER:</b> ❌ Xato (${e.message})\n`;
    }

    report += `━━━━━━━━━━━━━━━━━━━━\n✅ <b>Audit yakunlandi.</b>`;

    await ctx.telegram.editMessageText(ctx.chat.id, smsg.message_id, null, report, { parse_mode: 'HTML' });
});

bot.command('migrate_data', async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;
    const msg = await ctx.reply("🚚 <b>Migratsiya boshlandi...</b> (JSON -> Supabase)", { parse_mode: 'HTML' });

    try {
        const jsonPath = path.resolve(__dirname, 'users_db.json');
        if (!fs.existsSync(jsonPath)) return ctx.reply("❌ users_db.json topilmadi.");

        const localData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        let count = 0;

        for (const [uid, user] of Object.entries(localData)) {
            if (uid === '_analytics' || uid === '_config') continue;

            // Supabase'ga foydalanuvchini qo'shish yoki yangilash
            await payments.updateUser(uid, {
                username: user.username || '',
                fullName: user.fullName || '',
                plan: user.plan || 'trial',
                credits: user.credits || 0,
                totalDocs: user.totalDocs || 0,
                joinDate: user.joinDate || new Date().toISOString().split('T')[0]
            }).catch(async () => {
                // Agar update bo'lmasa, demak yangi foydalanuvchi
                await payments.createUser(uid, user.username, user.fullName);
                await payments.updateUser(uid, {
                    plan: user.plan,
                    credits: user.credits,
                    totalDocs: user.totalDocs
                });
            });
            count++;
        }

        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `✅ <b>Migratsiya yakunlandi!</b>\n\nJami: <b>${count}</b> ta foydalanuvchi Supabase'ga ko'chirildi.`, { parse_mode: 'HTML' });
    } catch (e) {
        await ctx.reply(`❌ Migratsiya xatosi: ${e.message}`);
    }
});

bot.command('broadcast', async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;
    const text = ctx.message.text.split(' ').slice(1).join(' ');
    if (!text) return ctx.reply("⚠️ Foydalanish: <code>/broadcast Xabar matni</code>", { parse_mode: 'HTML' });

    const stats = await payments.getStats();
    // Eslatma: Broadcast uchun barcha foydalanuvchilar ro'yxati kerak bo'lsa, 
    // payments.js ga getAllUsers funksiyasini qo'shish kerak. 
    // Hozircha bu funksiya vaqtinchalik o'chirildi.
    await ctx.reply("📢 Broadcast funksiyasi hozirda yangilanmoqda...");
});

bot.command('add_credits', async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;
    const parts = ctx.message.text.split(' '); // /add_credits ID COUNT
    if (parts.length < 3) return ctx.reply("⚠️ Foydalanish: <code>/add_credits USER_ID SONI</code>", { parse_mode: 'HTML' });

    const userId = parts[1];
    const amount = parseInt(parts[2]);
    const user = await payments.getUser(userId);

    if (!user) return ctx.reply("❌ Foydalanuvchi topilmadi.");

    await payments.updateUser(userId, { credits: (user.credits || 0) + amount });
    await ctx.reply(`✅ <b>${escapeHTML(user.fullName)}</b> balansiga <b>${amount}</b> ta hujjat qo'shildi.`, { parse_mode: 'HTML' });
    await bot.telegram.sendMessage(userId, `💎 Balansingizga admin tomonidan <b>${amount}</b> ta hujjat qo'shildi!`, { parse_mode: 'HTML' }).catch(() => { });
});

bot.command('find_user', async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;
    const query = ctx.message.text.split(' ')[1];
    if (!query) return ctx.reply("⚠️ Foydalanish: <code>/find_user USER_ID</code>", { parse_mode: 'HTML' });

    const user = await payments.getUser(query);
    if (!user) return ctx.reply("❌ Foydalanuvchi topilmadi.");

    const info = `👤 <b>USER PROFILE</b>\n` +
        `━━━━━━━━━━━━━\n` +
        `🆔 ID:    <code>${user.userId}</code>\n` +
        `👤 Name:  <b>${escapeHTML(user.fullName)}</b>\n` +
        `🔗 Tag:   @${user.username || 'none'}\n` +
        `📦 Plan:  <b>${user.plan.toUpperCase()}</b>\n` +
        `💎 Bal:   <code>${user.credits}</code>\n` +
        `📅 Join:  <code>${user.joinDate}</code>\n` +
        `📜 Docs:  <code>${user.totalDocs}</code>\n` +
        `━━━━━━━━━━━━━`;

    await ctx.reply(info, { parse_mode: 'HTML' });
});

// --- ADMIN AI ASSISTANT ---
bot.action(/ai_analyze_error_(.+)/, async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;
    const context = ctx.match[1];
    const statusMsg = await ctx.reply("🤖 <b>AI xatolikni tahlil qilmoqda...</b>", { parse_mode: 'HTML' });

    try {
        const logPath = path.resolve(__dirname, 'error_logs.txt');
        const logs = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf-8') : "";
        const lastLog = logs.split('---').filter(l => l.includes(context)).pop() || "Log topilmadi";
        const projectContext = getProjectContext();

        const prompt = `Siz Senior Node.js dasturchisiz. Quyidagi xatoni tahlil qiling va yechim bering.\n\n` +
            `LOYIHA STRUKTURASI:\n${projectContext}\n\n` +
            `XATO KONTEKSTI (${context}):\n${lastLog}\n\n` +
            `VAZIFA:\n1. Muammoning tub sababini tushuntiring.\n` +
            `2. Uni tuzatish uchun KODNI taklif qiling.\n` +
            `3. MUHIM: JAVOB OXIRIDA AGAR KODNI TUZATISH IMKONI BO'LSA, FAQAT MANA BU JSONNI QOLDIRING (Markdown blokidan tashqarida yoki ichida):\n` +
            `{"action": "fix_code", "file": "fayl_yo'li", "oldCode": "fayldagi_asl_kod (aynan_mos_bolishi_shart)", "newCode": "yangi_tuzatilgan_kod"}\n` +
            `Eski kod (oldCode) aynan fayldagi bilan 100% mos bo'lishi kerak, aks holda tahrirlash ishlamaydi!`;

        let analysis = "";
        try {
            analysis = await aiService.askOpenAI(prompt);
        } catch (oaError) {
            console.warn("ADMIN_AI_ANALYZE: OpenAI fail, trying Groq...");
            try {
                analysis = await aiService.askGroq(prompt);
            } catch (groqError) {
                console.warn("ADMIN_AI_ANALYZE: Groq fail, using Gemini...");
                try {
                    analysis = await aiService.askGemini(prompt);
                } catch (gemError) {
                    analysis = "❌ Barcha AI xizmatlarida limit tugagan yoki xatolik yuz berdi.";
                }
            }
        }

        let keyboard = [];
        if (analysis.includes('"action": "fix_code"')) {
            try {
                // Better JSON extraction: look for the object containing action: fix_code
                const matches = analysis.match(/\{[\s\S]*?"action"\s*:\s*"fix_code"[\s\S]*?\}/g);
                if (matches) {
                    const latestFix = matches[matches.length - 1]; // Use the last one
                    const cleanJson = latestFix.replace(/\\n/g, '\n').replace(/\\"/g, '"');
                    ctx.session.proposedAction = JSON.parse(cleanJson);
                    keyboard.push([Markup.button.callback('🛠 TUZATISHNI TASDIQLASH', 'admin_apply_ai_fix')]);
                }
            } catch (je) {
                console.error("JSON_PARSE_ERROR:", je);
            }
        }

        const safeAnalysis = analysis.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null,
            `🧐 <b>AI TAHLILI (${context}):</b>\n\n<pre>${safeAnalysis}</pre>`,
            { parse_mode: 'HTML', ...Markup.inlineKeyboard(keyboard) }
        ).catch(async () => {
            await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null,
                `🧐 <b>AI TAHLILI (${context}):</b>\n\n${analysis.substring(0, 3000)}`,
                { parse_mode: 'HTML', ...Markup.inlineKeyboard(keyboard) }
            );
        });

    } catch (e) {
        console.error("ADMIN_AI_ANALYZE_ERROR:", e);
        await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, `❌ <b>AI xatolik:</b> ${e.message}`);
    }
});

bot.command('ai_test', async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;
    const status = await ctx.reply("🧪 <b>AI ulanishlarini tekshirmoqdaman...</b>", { parse_mode: 'HTML' });

    let res = "🧪 <b>TEST NATIJALARI:</b>\n\n";

    // Test OpenAI
    try {
        await aiService.askOpenAI("ping");
        res += "✅ <b>OpenAI:</b> OK\n";
    } catch (e) {
        res += `❌ <b>OpenAI:</b> ${escapeHTML(e.message)}\n`;
    }

    // Test Groq
    try {
        await aiService.askGroq("ping");
        res += "✅ <b>Groq (Llama 3):</b> OK\n";
    } catch (e) {
        res += `❌ <b>Groq:</b> ${escapeHTML(e.message)}\n`;
    }

    // Test Gemini
    try {
        await aiService.askGemini("ping");
        res += "✅ <b>Gemini:</b> OK\n";
    } catch (e) {
        res += `❌ <b>Gemini:</b> ${escapeHTML(e.message)}\n`;
    }

    await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, null, res, { parse_mode: 'HTML' });
});

bot.action('admin_confirm_fix_stub', async (ctx) => {
    await ctx.answerCbQuery("🔧 Bu funksiya tez orada ishga tushadi. Hozircha kodni qo'lda tekshiring.", { show_alert: true });
});

bot.action('admin_ai_assistant', async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;
    ctx.session.step = 'WAITING_ADMIN_AI_QUERY';
    await ctx.reply("🤖 <b>AI Maslahatchi tizimi yoqildi.</b>\n\nBotingiz ishlashi, tahliliy ma'lumotlar yoki xatoliklar haqida istalgan narsani so'rang (Masalan: 'PDF nega sekin yaralayo'tdi?' yoki 'Eng faol foydalanuvchini top').\n\n<i>To'xtatish uchun: /cancel</i>", { parse_mode: 'HTML' });
});

bot.command('ai', async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;
    ctx.session.step = 'WAITING_ADMIN_AI_QUERY';
    await ctx.reply("🤖 <b>AI Maslahatchi tayyor.</b> Savolingizni yozing:", { parse_mode: 'HTML' });
});

bot.command('admin', async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📈 Dashbord', 'admin_dashboard'), Markup.button.callback('📊 Holat', 'admin_status')],
        [Markup.button.callback('👥 Obunachilar', 'admin_users'), Markup.button.callback('⚖️ Taftish', 'admin_audit')],
        [Markup.button.callback('📢 Xabar yuborish', 'admin_broadcast'), Markup.button.callback('🤖 AI Maslahat', 'admin_ai_assistant')],
        [Markup.button.callback('➕ Limit qo\'shish', 'admin_add_credits'), Markup.button.callback('🔍 Qidiruv', 'admin_find_user')]
    ]);

    await cleanReply(ctx, "🔐 <b>ADMINISTRATOR BOSHQARUV PANELI</b>\n\nKerakli bo'limni tanlang:", keyboard);
});

// Inline handlers for admin panel (Direct mapping to commands)
bot.action('admin_dashboard', async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;
    ctx.answerCbQuery();
    // Re-use logic from /dashboard
    const stats = await payments.getStats();
    const ana = stats.analytics || {};
    const bar = (val, max) => {
        const size = 10;
        const filled = Math.round((val / (max || 1)) * size) || 0;
        return '▇'.repeat(filled) + '┈'.repeat(size - filled);
    };
    let report = `🚀 <b>DASHBORD</b>\n\n`;
    report += `💵 Jami tushum: ${stats.revenue.toLocaleString()} so'm\n`;
    report += `👤 Foydalanuvchilar: ${stats.totalUsers}\n`;
    report += `📄 Hujjatlar: ${stats.totalDocs}\n`;
    await ctx.reply(report, { parse_mode: 'HTML' });
});

bot.action('admin_status', async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;
    ctx.answerCbQuery();
    const stats = await payments.getStats();
    const totalMem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(0);
    const msg = `⚡️ <b>TIZIM HOLATI</b>\n` +
        `👤 Users: ${stats.totalUsers}\n` +
        `📄 Docs: ${stats.totalDocs}\n` +
        `💾 Memory: ${totalMem} MB`;
    await ctx.reply(msg, { parse_mode: 'HTML' });
});

bot.action('admin_users', async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;
    ctx.answerCbQuery();
    const stats = await payments.getStats();
    await ctx.reply(`📊 <b>Statistika:</b>\n\n👤 Jami ulanishlar: ${stats.totalUsers}\n💰 Faol obunalar: ${stats.paidUsers}`);
});

bot.action('admin_audit', async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;
    ctx.answerCbQuery();
    await ctx.reply("⚖️ Taftish boshlandi... /audit buyrug'ini bering.");
});

bot.action('admin_broadcast', async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;
    ctx.answerCbQuery();
    await ctx.reply("📢 Hammaga xabar yuborish uchun <code>/broadcast XABAR_MATNI</code> buyrug'ini ishlating.", { parse_mode: 'HTML' });
});

bot.action('admin_add_credits', async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;
    ctx.answerCbQuery();
    await ctx.reply("➕ Limit qo'shish: <code>/add_credits USER_ID SONI</code>", { parse_mode: 'HTML' });
});

bot.action('admin_find_user', async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;
    ctx.answerCbQuery();
    await ctx.reply("🔍 Qidiruv: <code>/find_user USER_ID</code>", { parse_mode: 'HTML' });
});

bot.action('admin_fix_openai_quota', async (ctx) => {
    const text = `🛠 <b>OPENAI LIMITINI TUZATISH BO'YICHA QO'LLANMA</b>\n\n` +
        `Sizda <b>429 (Quota Exceeded)</b> xatosi chiqmoqda. Buni quyidagi yo'llar bilan hal qilish mumkin:\n\n` +
        `1️⃣ <b>Hisobni to'ldirish:</b> platform.openai.com saytiga kiring va 'Billing' bo'limida kamida 5$ balans qo'shing.\n` +
        `2️⃣ <b>Yangi API Key:</b> Agar eski kalitda limit tugagan bo'lsa, yangi hisob ochib yangi kalit oling.\n` +
        `3️⃣ <b>Limitni tekshirish:</b> 'Usage' bo'limida oylik limitni (Hard limit) ko'paytiring.\n\n` +
        `✅ <b>Tasdiqlash:</b> Balansni to'ldirganingizdan so'ng, botni qayta yurgizib, <b>/ai</b> buyrug'ini bering.`;

    await ctx.reply(text, { parse_mode: 'HTML' });
    await ctx.answerCbQuery();
});

bot.command('users', async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;
    await ctx.reply("🔄 Foydalanuvchilar ma'lumotlari yuklanmoqda...");
    const stats = await payments.getStats();
    // Stats ichida analytics va boshqa ma'lumotlar bor
    await ctx.reply(`📊 <b>Jami foydalanuvchilar:</b> ${stats.totalUsers}\n💰 <b>Tushum:</b> ${stats.revenue.toLocaleString()} so'm\n📄 <b>Jami hujjatlar:</b> ${stats.totalDocs}`);
});


// --- SUBSCRIPTION & PAYMENTS ---
bot.action('buy_subscription', async (ctx) => {
    let text = `💳 <b>OBUNA VA TARIFLAR</b>\n\n`;
    const keyboard = [];

    for (const [key, plan] of Object.entries(payments.PLANS)) {
        text += `<b>${plan.name}</b>\n💰 Narxi: ${plan.price.toLocaleString()} so'm\n✨ Imkoniyat: ${plan.description}\n⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n`;
        keyboard.push([Markup.button.callback(plan.name, `select_plan_${key}`)]);
    }

    keyboard.push([Markup.button.callback('⬅️ Orqaga', 'back_home')]);
    await cleanReply(ctx, text, Markup.inlineKeyboard(keyboard));
});

bot.action(/select_plan_(.+)/, async (ctx) => {
    const planKey = ctx.match[1];
    const plan = payments.PLANS[planKey];
    if (!plan) return;

    const billing = require('./services/billing_service');
    const msg = `💠 <b>TARIF TAFSILOTLARI: ${plan.name}</b>\n\n` +
        `💰 Narxi: <b>${plan.price.toLocaleString()} so'm</b>\n` +
        `✨ Imkoniyat: <b>${plan.description}</b>\n\n` +
        `Ushbu tarifni sotib olish uchun pastdagi to'lov usullaridan birini tanlang. To'lovdan so'ng hisobingiz avtomatik to'ldiriladi.`;

    await cleanReply(ctx, msg, billing.getPaymentButtons(ctx.from.id, plan));
});

bot.command('test_doc', async (ctx) => {
    ctx.session.step = 'WAITING_PHOTO';
    ctx.session.data = {
        type: 'DALOLATNOMA',
        sana: new Date().toISOString().split('T')[0],
        lang: 'cyrillic',
        mahalla: 'Исломобод',
        lavozim: 'Хотин-қизлар фаоли',
        band: '1.2.4',
        fuqaro: 'Тестов Тестбек',
        manzil: 'Қўқон шаҳар, Наврўз кўчаси, 12-уй',
        problem: 'Ишсизлик масаласида мурожаат қилди',
        analysis: 'Фуқаронинг бандлиги текширилди',
        solution: 'Тикувчиликка йўналтирилди',
        imzo: 'Н.Умарова',
        textLength: 500,
        regenCount: 0
    };
    await ctx.reply("🧪 <b>TEST REJIMI FAQOLLASHDI</b>\n\nBarcha anketa ma'lumotlari avtomatik to'ldirildi (Kirill alifbosida).\n\n📸 Endi <b>rasm yuboring</b>, PDF tayyorlab beraman.", { parse_mode: 'HTML' });
});

bot.action('start_bot', async (ctx) => {
    const access = await payments.checkAccess(ctx.from.id);
    const isAdmin = String(ctx.from.id) === String(ADMIN_ID);
    if (!access.hasAccess && !isAdmin) return ctx.answerCbQuery('⚠️ Limit tugagan!', { show_alert: true });
    ctx.session.step = 'WAITING_TYPE';
    ctx.session.data = { regenCount: 0 };
    await cleanReply(ctx, '📄 [1/14] Hujjat turi:', Markup.inlineKeyboard([[Markup.button.callback('Далолатнома', 'type_dalolatnoma')], [Markup.button.callback('Маълумотнома', 'type_malumotnoma')]]));
});

bot.action(/type_(.+)/, async (ctx) => {
    ctx.session.data.type = ctx.match[1].toUpperCase();
    ctx.session.step = 'WAITING_DATE';
    await cleanReply(ctx, '📅 [2/14] <b>Sanani kiriting:</b>\n\nIltimos, hujjat sanasini yozib yuboring.\n\nMisol: <code>2026.03.01</code> yoki <code>01.03.2026</code>');
});

bot.on('text', async (ctx) => {
    const session = ctx.session;
    if (!session || session.step === 'IDLE') return;
    const text = ctx.message.text;

    switch (session.step) {
        case 'WAITING_ADMIN_AI_QUERY':
            const statusMsg = await ctx.reply("🤖 <i>AI butun loyihani tahlil qilmoqda...</i>", { parse_mode: 'HTML' });
            try {
                const stats = payments.getStats();
                const logs = fs.existsSync(path.resolve(__dirname, 'error_logs.txt')) ? fs.readFileSync(path.resolve(__dirname, 'error_logs.txt'), 'utf-8').slice(-1500) : "Loglar yo'q";
                const projectContext = getProjectContext();

                const prompt = `Siz MFY Generator botining "Senior Advisor"isiz. Admin sizga tizimni boshqarishda yordam beradi.\n\n` +
                    `PROYEKT STRUKTURASI:\n${projectContext}\n\n` +
                    `TIZIM HOLATI:\n- Users: ${stats.totalUsers}\n- Docs: ${stats.totalDocs}\n- Logs: ${logs}\n\n` +
                    `MAVJUD BANDLAR:\n${JSON.stringify(BANDS_BY_LAVOZIM)}\n\n` +
                    `MAVJUD MAHALLALAR:\n${JSON.stringify(MAHALLALAR)}\n\n` +
                    `ADMIN BUYRUG'I: "${text}"\n\n` +
                    `VAZIFALAR:\n` +
                    `1. Agar admin biror bandni o'zgartirishni yoki yangi mahalla qo'shishni so'rasa, FAQAT admin aytgan aniq ma'lumotni ishlating.\n` +
                    `2. MUHIM: O'zingizdan yangi band nomlari yoki mahalla nomlarini o'ylab topmang (Generatsiya qilmang).\n` +
                    `3. Agar buyruq ijrosini tasdiqlash kerak bo'lsa, quyidagi JSON bloklaridan FOYDALANING:\n` +
                    `   - {"action": "update_bands", "data": <YANGI_BANDS_OBYEKTI>}\n` +
                    `   - {"action": "update_mahallas", "data": <YANGI_MAHALLALAR_ROYXATI>}\n` +
                    `   - {"action": "fix_code", "file": "...", "oldCode": "...", "newCode": "..."}\n` +
                    `4. Javobingiz professional va Senior darajasida bo'lsin.`;

                let aiResponse = "";
                try {
                    // 🚀 Birinchi navbatda Groq (Tez va limit muammosi yo'q)
                    aiResponse = await aiService.askGroq(prompt);
                } catch (groqErr) {
                    console.warn("ADMIN_AI: Groq fail, trying Gemini...");
                    try {
                        aiResponse = await aiService.askGemini(prompt);
                    } catch (gemErr) {
                        console.warn("ADMIN_AI: Gemini fail, using OpenAI...");
                        try {
                            aiResponse = await aiService.askOpenAI(prompt, "Siz bot adminiga tizimni to'liq avtonom boshqarishda yordam beruvchi Super Admin AI siz.");
                        } catch (finalErr) {
                            throw new Error("Barcha AI xizmatlarining limiti tugagan yoki xatolik yuz berdi.");
                        }
                    }
                }

                // --- AUTONOMOUS ACTION ENGINE (SENIOR v3.0) ---
                let displayResponse = aiResponse;
                const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);

                if (jsonMatch) {
                    try {
                        const actionData = JSON.parse(jsonMatch[0]);
                        displayResponse = aiResponse.replace(jsonMatch[0], '').trim().replace(/```json/g, '').replace(/```/g, '');

                        const actionHandlers = {
                            'update_bands': async (data) => {
                                BANDS_BY_LAVOZIM = data;
                                fs.writeFileSync(path.resolve(__dirname, 'bands_config.json'), JSON.stringify(data, null, 4));
                                await ctx.reply("✅ <b>Direktor:</b> Admin buyrug'iga asosan bandlar strukturasi yangilandi.", { parse_mode: 'HTML' });
                            },
                            'update_mahallas': async (data) => {
                                MAHALLALAR = data;
                                fs.writeFileSync(path.resolve(__dirname, 'mahalla_config.json'), JSON.stringify(data, null, 4));
                                await ctx.reply("✅ <b>Direktor:</b> Admin buyrug'iga asosan mahallalar ro'yxati yangilandi.", { parse_mode: 'HTML' });
                            },
                            'fix_code': async (data) => {
                                ctx.session.proposedAction = data;
                                await ctx.reply(`🛠 <b>Direktor:</b> Kodga tuzatish kiritishni tavsiya qilaman.\nFayl: <code>${data.file}</code>\n\nTasdiqlaysizmi?`, {
                                    parse_mode: 'HTML',
                                    ...Markup.inlineKeyboard([
                                        [Markup.button.callback('✅ TASDIQLASH', 'admin_apply_ai_fix')],
                                        [Markup.button.callback('❌ RAD ETISH', 'back_home')]
                                    ])
                                });
                            }
                        };

                        if (actionHandlers[actionData.action]) {
                            await actionHandlers[actionData.action](actionData.data || actionData);
                        }
                    } catch (pe) {
                        console.error("Action Parser Error:", pe);
                    }
                }

                if (!displayResponse || displayResponse.length < 5) displayResponse = "Buyruq muvaffaqiyatli bajarildi. ✅";
                await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null,
                    `👨‍💼 <b>DIREKTOR JAVOBI:</b>\n\n${displayResponse}\n\n<i>Navbatdagi vazifa?</i>`,
                    { parse_mode: 'HTML' }
                );
            } catch (e) {
                console.error("AI_ASSISTANT_ERROR:", e);
                const errorDetail = e.message || "Noma'lum xatolik";

                if (errorDetail.includes('quota') || errorDetail.includes('429')) {
                    const quotaMsg = `❌ <b>AI XIZMATIDA MUAMMO: LIMIT TUGADI</b>\n\n` +
                        `🧐 <b>Nima bo'ldi?</b>\nOpenAI hisobingizdagi mablag' (balans) tugagan yoki oylik limitga yetgansiz. Shuning uchun AI savollarga javob bera olmayapti.\n\n` +
                        `🛠 <b>Qanday javob topamiz?</b>\nPastdagi tugmani bosing, men sizga buni tuzatish yo'lini ko'rsataman.`;

                    const keyboard = Markup.inlineKeyboard([
                        [Markup.button.callback('🔍 Tuzatish yo\'lini ko\'rish', 'admin_fix_openai_quota')]
                    ]);

                    await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, quotaMsg, {
                        parse_mode: 'HTML',
                        ...keyboard
                    });
                } else {
                    await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, `❌ <b>AI xizmatida xatolik:</b>\n<code>${escapeHTML(errorDetail)}</code>`, { parse_mode: 'HTML' });
                }
            }
            return;

        case 'WAITING_DATE':
            // Simple date validation and normalization
            let normalizedDate = text.replace(/[.\/]/g, '-'); // . or / -> -

            // Basic regex check for YYYY-MM-DD or DD-MM-YYYY
            if (!normalizedDate.match(/^\d{2,4}-\d{2}-\d{2,4}$/)) {
                return ctx.reply("⚠️ Sanani noto'g'ri kiritdingiz. Misol: 2026.03.01");
            }

            // If DD-MM-YYYY, convert to YYYY-MM-DD
            const parts = normalizedDate.split('-');
            if (parts[0].length === 2 && parts[2].length === 4) {
                normalizedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }

            session.data.sana = normalizedDate;
            session.step = 'WAITING_ALPHABET';
            await cleanReply(ctx, '🔤 [3/13] Alifboni tanlang:', Markup.inlineKeyboard([[Markup.button.callback('Lotin', 'lang_latin')], [Markup.button.callback('Кирилл', 'lang_cyrillic')]]));
            break;
        case 'WAITING_MANUAL_TEXT':
            session.data.ai_solution = text;
            await showDraftText(ctx, false); // Don't regenerate! Show the new text.
            break;
        case 'WAITING_MAHALLA':
            session.data.mahalla = text;
            session.step = 'WAITING_LAVOZIM';
            const lavozimButtons = Object.keys(BANDS_BY_LAVOZIM);
            const lavozimLabel = session.data.lang === 'cyrillic' ? '💼 [5/14] Лавозимингизни танланг:' : '💼 [5/14] Lavozimingizni tanlang:';
            await cleanReply(ctx, lavozimLabel, Markup.keyboard(chunkArray(lavozimButtons, 2)).resize());
            break;
        case 'WAITING_LAVOZIM':
            // Try direct match first
            let bands = BANDS_BY_LAVOZIM[text];
            let matchedKey = text;

            // If no direct match, try normalized smart match (handles xokim -> Ҳоким etc)
            if (!bands) {
                const search = text.toLowerCase().replace(/h/g, 'x').replace(/o‘/g, 'o').replace(/o'/g, 'o');
                const keys = Object.keys(BANDS_BY_LAVOZIM);

                for (const key of keys) {
                    const normKey = key.toLowerCase().replace(/ҳ/g, 'x').replace(/о/g, 'o').replace(/и/g, 'i');
                    if (normKey.includes(search) || search.includes(normKey)) {
                        bands = BANDS_BY_LAVOZIM[key];
                        matchedKey = key;
                        break;
                    }
                }
            }

            if (!bands) {
                return ctx.reply(
                    session.data.lang === 'cyrillic'
                        ? "⚠️ Илтимос, пастдаги тугмалардан бирини танланг ёки лавозимингизни тўғри ёзинг:"
                        : "⚠️ Iltimos, pastdagi tugmalardan birini tanlang yoki lavozimingizni to'g'ri yozing:",
                    Markup.keyboard(chunkArray(Object.keys(BANDS_BY_LAVOZIM), 2)).resize()
                );
            }
            session.data.lavozim = matchedKey;
            session.step = 'WAITING_BAND';
            let bandPrompt = session.data.lang === 'cyrillic' ? '📌 [6/14] <b>Бандни танланг:</b>\n\n' : '📌 [6/14] <b>Bandni tanlang:</b>\n\n';
            bands.forEach(b => {
                const desc = bandsData.getBandDesc(session.data.lavozim, b);
                if (desc) {
                    bandPrompt += `<b>${escapeHTML(b)}:</b> ${escapeHTML(desc)}\n\n`;
                } else {
                    bandPrompt += `<b>${escapeHTML(b)}:</b> ⚠️ <i>(Ta'riflanmagan!)</i>\n\n`;
                }
            });
            await cleanReply(ctx, bandPrompt, Markup.keyboard(chunkArray(bands, 4)).resize());
            break;
        case 'WAITING_BAND':
            const currentBands = BANDS_BY_LAVOZIM[session.data.lavozim] || [];
            if (!currentBands.includes(text)) {
                return ctx.reply("⚠️ Iltimos, faqat ro'yxatdagi bandlardan birini tanlang:");
            }
            session.data.band = text;
            session.step = 'WAITING_FUQARO';

            const selectedBandDesc = bandsData.getBandDesc(session.data.lavozim, text);
            const isCyr = session.data.lang === 'cyrillic';
            const fuqaroPrompt = isCyr ? '👤 [7/14] Фуқаро Ф.И.О:' : '👤 [7/14] Fuqaro F.I.O:';

            let combinedPrompt = '';
            if (selectedBandDesc) {
                const bandTitle = isCyr ? "📌 <b>Сиз танлаган вазифа мазмуни:</b>" : "📌 <b>Siz tanlagan vazifa mazmuni:</b>";
                combinedPrompt += `${bandTitle}\n<i>${escapeHTML(selectedBandDesc)}</i>\n\n`;
            }
            combinedPrompt += fuqaroPrompt;

            await cleanReply(ctx, combinedPrompt, Markup.removeKeyboard());
            break;
        case 'WAITING_FUQARO':
            session.data.fuqaro = text;
            session.step = 'WAITING_MANZIL';
            const manzilPrompt = session.data.lang === 'cyrillic' ? '📍 [8/14] Манзил:' : '📍 [8/14] Manzil:';
            await cleanReply(ctx, manzilPrompt);
            break;
        case 'WAITING_MANZIL':
            session.data.manzil = text;
            session.step = 'WAITING_PROBLEM';
            const problemPrompt = session.data.lang === 'cyrillic' ? '❓ [9/14] Муаммо:' : '❓ [9/14] Muammo:';
            await cleanReply(ctx, problemPrompt);
            break;
        case 'WAITING_PROBLEM':
            session.data.problem = text;
            session.step = 'WAITING_ANALYSIS';
            const analysisPrompt = session.data.lang === 'cyrillic' ? '🔍 [10/14] Таҳлил:' : '🔍 [10/14] Tahlil:';
            await cleanReply(ctx, analysisPrompt);
            break;
        case 'WAITING_ANALYSIS':
            session.data.analysis = text;
            session.step = 'WAITING_TEXT_LENGTH';
            {
                const isCyrTL = session.data.lang === 'cyrillic';
                const tlTitle = isCyrTL ? '📏 [11/14] <b>Matn uzunligini tanlang:</b>' : '📏 [11/14] <b>Matn uzunligini tanlang:</b>';
                const tlDesc = isCyrTL
                    ? '\n\n<i>Qisqa (300) — qisqa bayon\nO\'rtacha (500) — standart\nKatta (1000) — batafsil\nJuda katta (1500) — to\'liq</i>'
                    : '\n\n<i>Qisqa (300) — qisqa bayon\nO\'rtacha (500) — standart\nKatta (1000) — batafsil\nJuda katta (1500) — to\'liq</i>';
                await cleanReply(ctx, tlTitle + tlDesc, Markup.inlineKeyboard([
                    [Markup.button.callback('📝 300 - Qisqa', 'textlen_300'), Markup.button.callback('📄 500 - O\'rtacha', 'textlen_500')],
                    [Markup.button.callback('📑 1000 - Katta', 'textlen_1000'), Markup.button.callback('📖 1500 - Juda katta', 'textlen_1500')]
                ]));
            }
            break;
        case 'WAITING_IMZO':
            {
                session.data.imzo = text;
                session.step = 'WAITING_CONFIRM';
                const d = session.data;
                const isCyrSummary = d.lang === 'cyrillic';
                const bandDesc = bandsData.getBandDesc(d.lavozim, d.band);

                // Har bir qiymatni alohida sanitize qilamiz (HTML teglarini buzmaslik uchun)
                const sv = {
                    type: escapeHTML(d.type),
                    sana: escapeHTML(d.sana),
                    alifbo: isCyrSummary ? 'Кирилл' : 'Lotin',
                    mahalla: escapeHTML(isCyrSummary ? orthography.sanitize(d.mahalla, 'cyrillic') : d.mahalla),
                    lavozim: escapeHTML(isCyrSummary ? orthography.sanitize(d.lavozim, 'cyrillic') : d.lavozim),
                    band: escapeHTML(d.band),
                    vazifa: escapeHTML(bandDesc ? (isCyrSummary ? orthography.sanitize(bandDesc, 'cyrillic') : bandDesc) : '---'),
                    fuqaro: escapeHTML(isCyrSummary ? orthography.sanitize(d.fuqaro, 'cyrillic') : d.fuqaro),
                    manzil: escapeHTML(isCyrSummary ? orthography.sanitize(d.manzil, 'cyrillic') : d.manzil),
                    problem: escapeHTML(isCyrSummary ? orthography.sanitize(d.problem, 'cyrillic') : d.problem),
                    analysis: escapeHTML(isCyrSummary ? orthography.sanitize(d.analysis, 'cyrillic') : d.analysis),
                    imzo: escapeHTML(isCyrSummary ? orthography.sanitize(d.imzo, 'cyrillic') : d.imzo)
                };

                // Label'lar tilga mos
                const lb = isCyrSummary ? {
                    title: 'АНКЕТА - ТАСДИҚЛАШ', turi: 'Тури', sana: 'Сана', alifbo: 'Алифбо',
                    mahalla: 'Маҳалла', lavozim: 'Лавозим', band: 'Банд', vazifa: 'Вазифа',
                    fuqaro: 'Фуқаро', manzil: 'Манзил', muammo: 'Муаммо', tahlil: 'Таҳлил',
                    imzo: 'Имзо', confirm: "Маълумотлар тўғрими?"
                } : {
                    title: 'ANKETA - TASDIQLASH', turi: 'Turi', sana: 'Sana', alifbo: 'Alifbo',
                    mahalla: 'Mahalla', lavozim: 'Lavozim', band: 'Band', vazifa: 'Vazifa',
                    fuqaro: 'Fuqaro', manzil: 'Manzil', muammo: 'Muammo', tahlil: 'Tahlil',
                    imzo: 'Imzo', confirm: "Ma'lumotlar to'g'rimi?"
                };

                const summary = `📝 <b>${lb.title}</b>\n` +
                    `━━━━━━━━━━━━━\n` +
                    `📄 <b>${lb.turi}:</b> ${sv.type}\n` +
                    `📅 <b>${lb.sana}:</b> ${sv.sana}\n` +
                    `🔤 <b>${lb.alifbo}:</b> ${sv.alifbo}\n` +
                    `🏡 <b>${lb.mahalla}:</b> ${sv.mahalla}\n` +
                    `🎖 <b>${lb.lavozim}:</b> ${sv.lavozim}\n` +
                    `📌 <b>${lb.band}:</b> ${sv.band}\n` +
                    `📖 <b>${lb.vazifa}:</b> <i>${sv.vazifa}</i>\n` +
                    `👤 <b>${lb.fuqaro}:</b> ${sv.fuqaro}\n` +
                    `📍 <b>${lb.manzil}:</b> ${sv.manzil}\n` +
                    `❓ <b>${lb.muammo}:</b> ${sv.problem}\n` +
                    `🔍 <b>${lb.tahlil}:</b> ${sv.analysis}\n` +
                    `✍️ <b>${lb.imzo}:</b> ${sv.imzo}\n` +
                    `━━━━━━━━━━━━━\n` +
                    `✅ ${lb.confirm}`;

                const confirmBtn = isCyrSummary ? "Ҳа, расм юбораман ✅" : "Ha, rasm yuboraman ✅";
                const cancelBtn = isCyrSummary ? "Бекор қилиш ❌" : "Bekor qilish ❌";

                await cleanReply(ctx, summary, Markup.inlineKeyboard([
                    [Markup.button.callback(confirmBtn, 'confirm_yes')],
                    [Markup.button.callback(cancelBtn, 'back_home')]
                ]));
                break;
            }
    }
});

bot.action(/lang_(.+)/, async (ctx) => {
    ctx.session.data.lang = ctx.match[1];
    ctx.session.step = 'WAITING_MAHALLA';
    const mSorted = [...MAHALLALAR].sort();
    const prompt = ctx.session.data.lang === 'cyrillic' ? "🏡 [4/14] Маҳаллани танланг ёки ёзинг:" : "🏡 [4/14] Mahallani tanlang yoki yozing:";
    await cleanReply(ctx, prompt, Markup.keyboard(chunkArray(mSorted, 3)).resize());
});

bot.action('confirm_yes', async (ctx) => {
    ctx.session.step = 'WAITING_PHOTO';
    const photoPrompt = ctx.session.data.lang === 'cyrillic' ? '📸 [13/14] Расм юборинг:' : '📸 [13/14] Rasm yuboring:';
    await cleanReply(ctx, photoPrompt);
});

// 📏 Matn uzunligi tanlash
bot.action(/textlen_(\d+)/, async (ctx) => {
    const len = parseInt(ctx.match[1]);
    ctx.session.data.textLength = len;
    ctx.session.step = 'WAITING_IMZO';
    const isCyr = ctx.session.data.lang === 'cyrillic';
    const imzoPrompt = isCyr ? `✍️ [12/14] Имзолочи исми:` : `✍️ [12/14] Imzolochi ismi:`;
    await cleanReply(ctx, imzoPrompt);
});

bot.action('back_home', async (ctx) => { await showWelcome(ctx); });

// ============================================
// 📄 PDF ENGINE (ARCHITECT v2.0)
// ============================================
async function showDraftText(ctx, isRegen = false) {
    const session = ctx.session;
    const data = session.data;
    const statusMsg = await ctx.reply(isRegen ? '🔄 Yangilanmoqda...' : '⏳ Matn tayyorlanmoqda...');

    try {
        if (!isRegen && ctx.message?.photo) {
            const photo = ctx.message.photo.pop();
            const link = await bot.telegram.getFileLink(photo.file_id);
            const res = await axios({ url: link.href, responseType: 'arraybuffer' });
            const temp = path.resolve(__dirname, `temp_${Date.now()}.jpg`);
            await sharp(Buffer.from(res.data)).resize(1200).toFile(temp);
            data.lastImg = temp;
        }

        const bandDescription = bandsData.getBandDesc(data.lavozim, data.band);
        if (!data.ai_solution || isRegen) {
            const aiStart = Date.now();
            try {
                const generatedText = await aiService.generateProfessionalText({
                    mahalla: data.mahalla,
                    fuqaro: data.fuqaro,
                    manzil: data.manzil,
                    problem: data.problem,
                    analysis: data.analysis,
                    lavozim: data.lavozim,
                    band: data.band,
                    bandDesc: bandDescription,
                    lang: data.lang,
                    textLength: data.textLength || 500
                });

                // 🛡️ FINAL SCRIPT + LENGTH PROTECTION
                const maxLen = (data.textLength || 500) + 200;
                data.ai_solution = orthography.sanitize(generatedText, data.lang, maxLen);

                await payments.recordPerf('AI_Gen', Date.now() - aiStart);
            } catch (e) {
                data.ai_solution = generateOfflineText(data);
            }
        }

        const isCyr = data.lang === 'cyrillic';
        const draftTitle = isCyr ? '📝 <b>ТАЙЁРЛАНГАН МАТН (ҚОРАЛАМА):</b>' : '📝 <b>TAYYORLANGAN MATN (QORALAMA):</b>';
        const draftFooter = isCyr ? '✅ Маъқул бўлса "Ҳужжатни тасдиқлаш" тугмасини босинг ёки таҳрирланг.' : '✅ Ma\'qul bo\'lsa "Hujjatni tasdiqlash" tugmasini bosing yoki tahrirlang.';

        const previewMsg = `${draftTitle}\n\n${escapeHTML(data.ai_solution)}\n\n${draftFooter}`;

        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback(isCyr ? '📂 Ҳужжатни тасдиқлаш ✅' : '📂 Hujjatni tasdiqlash ✅', 'confirm_generate_pdf')],
            [Markup.button.callback(isCyr ? '✍️ Таҳрирлаш' : '✍️ Tahrirlash', 'edit_ai_text'), Markup.button.callback(isCyr ? '📖 Имло текшируви' : '📖 Imlo tekshiruvi', 'check_grammar')],
            [Markup.button.callback(isCyr ? '🔄 Янгитдан ёзиш' : '🔄 Yangitdan yozish', 'regenerate')],
            [Markup.button.callback(isCyr ? '🏠 Бош меню' : '🏠 Bosh menu', 'back_home')]
        ]);

        await cleanReply(ctx, previewMsg, keyboard);

    } catch (err) {
        console.error("Draft Error:", err);
        await ctx.reply("❌ Matn tayyorlashda xatolik yuz berdi.");
    } finally {
        if (statusMsg) await ctx.deleteMessage(statusMsg.message_id).catch(() => { });
    }
}

async function processPDF(ctx) {
    const session = ctx.session;
    const data = session.data;
    const statusMsg = await ctx.reply('⏳ PDF hujjati generatsiya qilinmoqda...');

    try {
        const finalData = {
            mahalla: orthography.sanitize(data.mahalla, data.lang),
            fuqaro: orthography.sanitize(data.fuqaro, data.lang),
            manzil: orthography.sanitize(data.manzil, data.lang),
            problem: orthography.sanitize(data.problem, data.lang),
            analysis: orthography.sanitize(data.analysis, data.lang),
            imzo: orthography.sanitize(data.imzo, data.lang),
            lavozim: orthography.sanitize(data.lavozim, data.lang),
            band: data.band,
            sana: data.sana,
            lang: data.lang,
            ai_solution: data.ai_solution // Don't re-sanitize AI output to avoid mangling
        };

        // PDF Generation via PDFService
        const pdfStart = Date.now();
        const pdf = await pdfService.generatePDF(finalData, data.lastImg, bandsData.getAllDescriptions());
        await payments.recordPerf('PDF_Engine', Date.now() - pdfStart);

        if (String(ctx.from.id) !== String(ADMIN_ID)) {
            const usage = await payments.useCredit(ctx.from.id);
            if (!usage.success) return ctx.reply('⚠️ Hisobingizda hujjatlar yetarli emas yoki muddati tugagan.');
        }

        await payments.recordEvent('pdf_gen');
        const fname = sanitizeFilename(`${data.type}_${data.fuqaro}_${data.sana}.pdf`);
        await ctx.replyWithDocument({ source: pdf, filename: fname });
        const pdfDoneMsg = data.lang === 'cyrillic'
            ? "✅ <b>Ҳужжат тайёр!</b>\nMFY Generator PRO хизматидан фойдаланганингиз учун раҳмат."
            : "✅ <b>Hujjat tayyor!</b>\nMFY Generator PRO xizmatidan foydalanganingiz uchun rahmat.";
        const homeBtn = data.lang === 'cyrillic' ? '🏠 Бош меню' : '🏠 Bosh menu';
        await cleanReply(ctx, pdfDoneMsg, Markup.inlineKeyboard([[Markup.button.callback(homeBtn, 'back_home')]]));

        // 🧠 Knowledge base update
        await knowledge.learnFromDocument({ ...finalData, type: data.type }).catch(() => { });

    } catch (err) {
        await reportToAdmin(err, 'PDF_SERVICE_CRASH');
        await ctx.reply('⚠️ PDF xizmatida xatolik. Admin tekshirmoqda.');
    } finally {
        if (statusMsg) await ctx.deleteMessage(statusMsg.message_id).catch(() => { });
    }
}


bot.on('photo', async (ctx) => {
    const step = ctx.session.step;

    if (step === 'WAITING_PHOTO') {
        return showDraftText(ctx, false);
    }

    if (step === 'WAITING_PAYMENT_PROOF') {
        const user = ctx.from;
        const selectedPlan = ctx.session.selectedPlan || "No Plan";

        await ctx.reply("✅ To'lov cheki qabul qilindi. Tez orada admin tomonidan tekshiriladi va hisobingiz to'ldiriladi.");

        // Adminga yo'llash
        const adminMsg = `💳 <b>YANGI TO'LOV CHEKI</b>\n` +
            `⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n` +
            `👤 User: ${escapeHTML(user.first_name)} (@${user.username || "yo'q"})\n` +
            `🆔 ID: <code>${user.id}</code>\n` +
            `📦 Tarif: <b>${selectedPlan}</b>\n` +
            `⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯`;

        const adminKeyboard = Markup.inlineKeyboard([
            [Markup.button.callback('✅ To\'lovni tasdiqlash', `approve_pay_${user.id}_${selectedPlan}`)]
        ]);

        await bot.telegram.sendMessage(ADMIN_ID, adminMsg, {
            parse_mode: 'HTML',
            ...adminKeyboard
        }).catch(err => reportToAdmin(err, 'ADMIN_MSG_FAILED'));

        await bot.telegram.forwardMessage(ADMIN_ID, ctx.chat.id, ctx.message.message_id).catch(err => reportToAdmin(err, 'FORWARD_FAILED'));

        ctx.session.step = 'IDLE';
        return;
    }

    await ctx.reply("⚠️ Hujjat yaratish uchun avval savollarga javob bering (📄 Hujjat yaratish tugmasini bosing).\n\nAgar bu to'lov cheki bo'lsa, avval Tarifni tanlang.");
});

// --- SELF HEALING EXECUTION ---
bot.action('admin_apply_ai_fix', async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;
    const action = ctx.session.proposedAction;
    if (!action || !action.file) return ctx.reply("⚠️ Tuzatish ma'lumotlari topilmadi.");

    try {
        const filePath = path.resolve(__dirname, action.file);
        if (!fs.existsSync(filePath)) return ctx.reply("❌ Xato: Fayl topilmadi.");

        let content = fs.readFileSync(filePath, 'utf-8');
        if (content.includes(action.oldCode)) {
            const newContent = content.replace(action.oldCode, action.newCode);
            fs.writeFileSync(filePath, newContent);
            await ctx.reply(`✅ <b>Muvaffaqiyatli!</b>\n<code>${action.file}</code> faylidagi xato avtomatik tuzatildi.\n\nBotni qayta yoqishni (Restart) unutmang!`, { parse_mode: 'HTML' });
        } else {
            await ctx.reply("❌ Xato: Kod fayl ichidan topilmadi. Versiyalar mos kelmayapti.");
        }
    } catch (e) {
        await ctx.reply(`❌ Tuzatishda xatolik: ${e.message}`);
    } finally {
        ctx.session.proposedAction = null;
    }
});
// --- ADMIN ACTIONS ---
bot.action(/approve_pay_(.+)_(.+)/, async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;
    const userId = ctx.match[1];
    const planKey = ctx.match[2];

    const result = await payments.activateSubscription(userId, planKey);
    if (result) {
        await ctx.answerCbQuery("✅ To'lov tasdiqlandi!");
        await ctx.editMessageText(ctx.callbackQuery.message.text + "\n\n✅ <b>TASDIQLANDI</b>", { parse_mode: 'HTML' });

        // Foydalanuvchini xabardor qilish
        const userMsg = `🎉 <b>Tabriklaymiz!</b> To'lovingiz tasdiqlandi.\n\n` +
            `📦 Tarif: <b>${payments.PLANS[planKey].name}</b>\n` +
            `💎 Balans: <b>${result.user.credits} hujjat</b>\n` +
            `📅 Muddat: <b>${result.endDate} gacha</b>\n\n` +
            `Endi bemalol hujjat yaratishingiz mumkin! 📄`;

        await bot.telegram.sendMessage(userId, userMsg, { parse_mode: 'HTML' }).catch(() => { });
    } else {
        await ctx.answerCbQuery("❌ Xatolik yuz berdi!", { show_alert: true });
    }
});

bot.action('confirm_generate_pdf', async (ctx) => {
    await processPDF(ctx);
});

bot.action('regenerate', async (ctx) => {
    const user = await payments.createUser(ctx.from.id, ctx.from.username, ctx.from.first_name);
    const userPlan = user.plan || 'trial';
    const limit = payments.REGEN_LIMITS[userPlan] || 1;
    if (ctx.session.data.regenCount >= limit) return ctx.answerCbQuery('⚠️ Limit tugadi!');
    ctx.session.data.regenCount++;
    ctx.session.data.ai_solution = null;
    await showDraftText(ctx, true);
});

bot.action('edit_ai_text', async (ctx) => {
    ctx.session.step = 'WAITING_MANUAL_TEXT';
    await ctx.reply("📝 <b>Amalga oshirilgan ishlarni tahrirlang:</b>\n\n(Yangi matnni yozib yuboring)", { parse_mode: 'HTML' });
});

bot.action('check_grammar', async (ctx) => {
    const status = await ctx.reply("🔍 <b>Imlo tekshirilmoqda...</b>", { parse_mode: 'HTML' });
    try {
        const currentText = ctx.session.data.ai_solution;
        const lang = ctx.session.data.lang;
        const isCyr = lang === 'cyrillic';
        const scriptName = isCyr ? "KIRILL (ЎЗБЕК КИРИЛЛ)" : "LOTIN (O'ZBEK LOTIN)";
        const textLen = ctx.session.data.textLength || 500;

        const prompt = `IMLO TEKSHIRUVI — RASMIY HUJJAT UCHUN:
Quyidagi rasmiy hujjat matnining imlo xatolarini tuzating. 

===== ☠️ ENG MUHIM QOIDALAR =====
1. ALIFBO: Matnni FAQAT ${scriptName} alifbosida yozing. Boshqa alifbo harflari TAQIQLANADI!
   - ${isCyr ? 'Lotincha a, o, e, p, x harflarini Kirillcha а, о, е, р, х ga almashtiring!' : 'Kirillcha harflarni Lotinchaga almashtiring!'}
2. HAJM: Matn ${textLen} belgiga yaqin bo'lsin (kamida ${Math.max(textLen - 50, 50)}, ko'pi bilan ${textLen + 50}).
   - Bu rasmiy A4 hujjat — matn qog'ozdan chiqib ketmasligi shart!
   - Agar asl matn uzunroq bo'lsa — mazmunni saqlagan holda ${textLen} belgiga moslashtiring.
3. MAZMUN: Asl matnning ma'nosini saqlang. Yangi gap qo'shmang.
4. ISMLAR: To'g'ri yozing (masalan: AlimovaNafisa → ${isCyr ? 'Алимова Нафиса' : 'Alimova Nafisa'}).
================================

ASL MATN:
${currentText}

FAQAT TUZATILGAN TAYYOR MATNNI QAYTARING. IZOHSIZ!`;

        const fixedTextRaw = await aiService.generateProfessionalText({
            customPrompt: prompt,
            lang: lang,
            textLength: textLen
        });

        // 🛡️ SCRIPT + LENGTH SAFETY NET
        const maxLen = textLen + 100;
        const fixedText = orthography.sanitize(fixedTextRaw, lang, maxLen);

        ctx.session.tempFixedText = fixedText;
        await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, null,
            `📖 <b>TUZATILGAN VARIANT:</b>\n\n${escapeHTML(fixedText)}\n\nUshbu variantni tasdiqlaysizmi?`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('✅ Tasdiqlash', 'apply_fixed_text')],
                    [Markup.button.callback('❌ Rad etish', 'back_to_draft')]
                ])
            }
        );
    } catch (e) {
        await ctx.reply("❌ Imlo tekshirishda xatolik yuz berdi.");
    }
});

bot.action('apply_fixed_text', async (ctx) => {
    if (ctx.session.tempFixedText) {
        ctx.session.data.ai_solution = ctx.session.tempFixedText;
        ctx.session.tempFixedText = null;
        await showDraftText(ctx, false);
    }
});

bot.action('back_to_draft', async (ctx) => {
    await showDraftText(ctx, false);
});

// ============================================
// 🚀 BOOTSTRAP
// ============================================
const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

const startBot = async () => {
    const app = express();

    // Render Health Check - Bu Render uchun juda muhim!
    app.use(express.static(path.join(__dirname, 'public')));
    app.get('/', (req, res) => res.send('MFY Generator Bot is Live! 🚀'));
    app.get('/healthz', (req, res) => res.sendStatus(200));

    // Admin API endpoints
    app.get('/api/admin/stats', async (req, res) => {
        try {
            const stats = await payments.getStats();
            const aiStats = aiService.getStats();
            res.json({ ...stats, ai: aiStats });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/admin/config', express.json(), async (req, res) => {
        try {
            const { key, value } = req.body;
            const supabase = require('./utils/supabase_client');
            const { error } = await supabase.from('config').upsert([{ key, value, updated_at: new Date() }]);
            if (error) throw error;
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/admin/broadcast', express.json(), async (req, res) => {
        try {
            const { message } = req.body;
            const supabase = require('./utils/supabase_client');
            const { data: users } = await supabase.from('users').select('userId');

            let sent = 0;
            for (const user of users) {
                await bot.telegram.sendMessage(user.userId, message, { parse_mode: 'HTML' }).then(() => sent++).catch(() => { });
            }
            res.json({ success: true, sent });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    if (WEBHOOK_URL) {
        const secretPath = `/bot${process.env.BOT_TOKEN}`;
        app.use(express.json());
        app.use(bot.webhookCallback(secretPath));
        app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Webhook Server listening on ${PORT}`));
        await bot.telegram.setWebhook(`${WEBHOOK_URL}${secretPath}`);
        console.log(`📡 Webhook set to: ${WEBHOOK_URL}${secretPath}`);
    } else {
        app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Health Check Server listening on ${PORT}`));
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        bot.launch({ dropPendingUpdates: true });
        console.log('🚀 MFY PRO v4.0 (POLLING MODE) ONLINE!');
    }
};

startBot().catch(err => reportToAdmin(err, 'BOOTSTRAP_FAILED'));

bot.command('cancel', async (ctx) => {
    ctx.session.step = 'IDLE';
    await ctx.reply("🏠 Bosh menyuga qaytildi.", Markup.removeKeyboard());
    await showWelcome(ctx);
});
process.on('SIGINT', () => bot.stop());
process.on('SIGTERM', () => bot.stop());
