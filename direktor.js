require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const aiService = require('./services/ai_service');

// ============================================
// 🤖 AI DIREKTOR — Mustaqil Monitoring Bot
// ============================================
const ADMIN_BOT_TOKEN = '8691189006:AAFxLsh-wBAlqu08CYzXQoSmDmVJh_0t8w8';
const ADMIN_ID = String(process.env.ADMIN_ID || '').trim();

const direktorBot = new Telegraf(ADMIN_BOT_TOKEN);

// 📊 Monitoring holati
const monitorState = {
    startTime: new Date(),
    checksRun: 0,
    issuesFound: 0,
    issuesFixed: 0,
    lastCheck: null,
    log: []
};

function addLog(msg, type = 'info') {
    const time = new Date().toLocaleTimeString('uz-UZ');
    const icon = type === 'error' ? '🔴' : type === 'warn' ? '🟡' : type === 'fix' ? '🟢' : '🔵';
    const entry = `${icon} [${time}] ${msg}`;
    monitorState.log.push(entry);
    if (monitorState.log.length > 50) monitorState.log.shift();
    console.log(entry);
}

// ============================================
// 🔍 BOT KODZI TEKSHIRUVI
// ============================================
async function runCodeAudit() {
    addLog('Kod auditi boshlanmoqda...');
    const issues = [];

    // 1. Muhim fayllar mavjudligini tekshirish
    const criticalFiles = [
        { path: 'index.js', name: 'Asosiy bot' },
        { path: 'services/ai_service.js', name: 'AI Service' },
        { path: 'services/pdf_service.js', name: 'PDF Service' },
        { path: 'payments.js', name: 'To\'lov tizimi' },
        { path: 'bands.js', name: 'Bandlar' },
        // Try multiple possible paths for html and script since they might move in deployment
        { paths: ['../index.html', 'index.html'], name: 'HTML shablon' },
        { paths: ['../script.js', 'script.js'], name: 'Frontend skript' },
    ];

    for (const file of criticalFiles) {
        let found = false;
        if (file.paths) {
            for (const p of file.paths) {
                if (fs.existsSync(path.resolve(__dirname, p))) {
                    found = true;
                    break;
                }
            }
        } else if (file.path) {
            found = fs.existsSync(path.resolve(__dirname, file.path));
        }

        if (!found) {
            const missingPath = file.paths ? file.paths.join(' yoki ') : file.path;
            issues.push({ severity: 'CRITICAL', msg: `${file.name} fayli topilmadi: ${missingPath}` });
        }
    }

    // 2. .env tekshirish
    const envPath = path.resolve(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        if (!envContent.includes('GEMINI_API_KEY=')) {
            issues.push({ severity: 'CRITICAL', msg: 'GEMINI_API_KEY .env da topilmadi' });
        }
        if (envContent.includes('sk-xxxx') || envContent.includes('gsk_...')) {
            issues.push({ severity: 'WARN', msg: 'Placeholder API kalitlari hali o\'zgartirilmagan (.env fayli)' });
        }
    } else {
        issues.push({ severity: 'CRITICAL', msg: '.env fayli topilmadi!' });
    }

    // 3. index.js tarkibidagi potentsial muammolarni tekshirish
    try {
        const indexContent = fs.readFileSync(path.resolve(__dirname, 'index.js'), 'utf-8');

        // Session step mos kelishini tekshirish
        const steps = indexContent.match(/session\.step\s*=\s*'([^']+)'/g) || [];
        const cases = indexContent.match(/case\s+'([^']+)':/g) || [];
        const actions = indexContent.match(/bot\.action\(\/([^/]+)\//g) || [];

        const setSteps = steps.map(s => s.match(/'([^']+)'/)[1]);
        const handleSteps = cases.map(c => c.match(/'([^']+)'/)[1]);

        for (const step of setSteps) {
            if (!handleSteps.includes(step) && !step.includes('IDLE') &&
                !['WAITING_ALPHABET', 'WAITING_TEXT_LENGTH', 'WAITING_CONFIRM', 'WAITING_PHOTO', 'WAITING_PAYMENT_PROOF', 'WAITING_TYPE'].includes(step)) {
                issues.push({ severity: 'WARN', msg: `Step '${step}' o'rnatilgan, lekin case handler topilmadi` });
            }
        }

        // escapeHTML ishlatilmaganlarni tekshirish
        const dangerousPatterns = indexContent.match(/\$\{[^}]*\.(?:problem|manzil|fuqaro|analysis|imzo)[^}]*\}/g) || [];
        // Bu faqat HTML parse_mode bo'lgan joylarda muammo

        addLog(`Kod auditi: ${issues.length} ta muammo topildi`);
    } catch (e) {
        issues.push({ severity: 'ERROR', msg: `Kod o'qishda xatolik: ${e.message}` });
    }

    // 4. AI xizmatlarini tekshirish
    addLog('AI xizmatlari tekshirilmoqda...');
    try {
        await aiService.askGemini("1+1=?");
        addLog('Gemini: ✅ Ishlayapti');
    } catch (e) {
        issues.push({ severity: 'ERROR', msg: `Gemini ishlamayapti: ${e.message}` });
    }

    // 5. Error loglarni tekshirish
    const errorLogPath = path.resolve(__dirname, 'error_logs.txt');
    if (fs.existsSync(errorLogPath)) {
        const logContent = fs.readFileSync(errorLogPath, 'utf-8');
        const recentErrors = logContent.split('---').filter(Boolean).slice(-5);
        if (recentErrors.length > 0) {
            issues.push({ severity: 'INFO', msg: `Oxirgi ${recentErrors.length} ta xatolik logda mavjud` });
        }
    }

    monitorState.checksRun++;
    monitorState.issuesFound += issues.length;
    monitorState.lastCheck = new Date();

    return issues;
}

// ============================================
// 📊 HISOBOT YARATISH
// ============================================
function formatReport(issues) {
    const now = new Date();
    const uptime = Math.floor((now - monitorState.startTime) / 1000 / 60);

    let report = `🤖 <b>AI DIREKTOR — MONITORING HISOBOT</b>\n`;
    report += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    report += `⏱ <b>Ishlash vaqti:</b> ${uptime} daqiqa\n`;
    report += `🔍 <b>Tekshiruvlar:</b> ${monitorState.checksRun}\n`;
    report += `⚠️ <b>Topilgan muammolar:</b> ${issues.length}\n\n`;

    if (issues.length === 0) {
        report += `✅ <b>Hammasi yaxshi!</b> Hech qanday muammo topilmadi.\n`;
    } else {
        const critical = issues.filter(i => i.severity === 'CRITICAL');
        const errors = issues.filter(i => i.severity === 'ERROR');
        const warns = issues.filter(i => i.severity === 'WARN');
        const infos = issues.filter(i => i.severity === 'INFO');

        if (critical.length > 0) {
            report += `🔴 <b>KRITIK (${critical.length}):</b>\n`;
            critical.forEach(i => report += `  • ${i.msg}\n`);
            report += `\n`;
        }
        if (errors.length > 0) {
            report += `🟠 <b>XATOLAR (${errors.length}):</b>\n`;
            errors.forEach(i => report += `  • ${i.msg}\n`);
            report += `\n`;
        }
        if (warns.length > 0) {
            report += `🟡 <b>OGOHLANTIRISHLAR (${warns.length}):</b>\n`;
            warns.forEach(i => report += `  • ${i.msg}\n`);
            report += `\n`;
        }
        if (infos.length > 0) {
            report += `🔵 <b>MA'LUMOT (${infos.length}):</b>\n`;
            infos.forEach(i => report += `  • ${i.msg}\n`);
        }
    }

    report += `\n━━━━━━━━━━━━━━━━━━━━`;
    return report;
}

// ============================================
// 🤖 BOT BUYRUQLARI
// ============================================
direktorBot.start(async (ctx) => {
    if (ADMIN_ID && String(ctx.from.id) !== ADMIN_ID) return;

    const welcome = `🤖 <b>AI DIREKTOR v1.0</b>\n` +
        `<i>MFY Generator Bot Monitoring Tizimi</i>\n\n` +
        `Men botingizni doimiy kuzatib turaman va\n` +
        `muammolarni topib, sizga xabar beraman.\n\n` +
        `📋 <b>Buyruqlar:</b>\n` +
        `/check — Hozir tekshirish\n` +
        `/status — Tizim holati\n` +
        `/logs — Oxirgi loglar\n` +
        `/ai_fix — AI bilan muammolarni tahlil qilish\n` +
        `/errors — Xato loglarni ko'rish`;

    await ctx.reply(welcome, { parse_mode: 'HTML' });
});

direktorBot.command('admin', async (ctx) => {
    if (ADMIN_ID && String(ctx.from.id) !== ADMIN_ID) return;

    // WebApp URL (Agar Render bo'lsa https, localhost bo'lsa http)
    const webAppUrl = process.env.WEBHOOK_URL ? `${process.env.WEBHOOK_URL}/admin/index.html` : `https://${ctx.from.id}.ngrok-free.app/admin/index.html`;

    await ctx.reply(`📊 <b>ADMIN DASHBOARD</b>\n\n` +
        `Ushbu tugma orqali Premium Dashboardni ochishingiz mumkin. ` +
        `U yerda statistika, karta raqami va broadcast boshqaruvi mavjud.`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.webApp('💎 DASHBOARDNI OCHISH', webAppUrl)]
        ])
    });
});

direktorBot.command('check', async (ctx) => {
    if (ADMIN_ID && String(ctx.from.id) !== ADMIN_ID) return;

    const statusMsg = await ctx.reply('🔍 <b>Tekshiruv boshlanmoqda...</b>', { parse_mode: 'HTML' });
    const issues = await runCodeAudit();
    const report = formatReport(issues);

    await ctx.telegram.editMessageText(
        ctx.chat.id, statusMsg.message_id, null, report,
        { parse_mode: 'HTML' }
    ).catch(async () => {
        await ctx.reply(report, { parse_mode: 'HTML' });
    });
});

direktorBot.command('status', async (ctx) => {
    if (ADMIN_ID && String(ctx.from.id) !== ADMIN_ID) return;

    const now = new Date();
    const uptime = Math.floor((now - monitorState.startTime) / 1000 / 60);
    const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

    const aiStats = aiService.getStats();

    const msg = `⚡️ <b>TIZIM HOLATI</b>\n━━━━━━━━━━━━━\n\n` +
        `⏱ Ishlash: <code>${uptime} daqiqa</code>\n` +
        `💾 Xotira: <code>${mem} MB</code>\n` +
        `🔍 Tekshiruvlar: <code>${monitorState.checksRun}</code>\n` +
        `⚠️ Muammolar: <code>${monitorState.issuesFound}</code>\n\n` +
        `🤖 <b>AI Statistika:</b>\n` +
        `├ Gemini: ✅${aiStats.gemini.success} / ❌${aiStats.gemini.fail}\n` +
        `├ Groq: ✅${aiStats.groq.success} / ❌${aiStats.groq.fail}\n` +
        `├ OpenAI: ✅${aiStats.openai.success} / ❌${aiStats.openai.fail}\n` +
        `└ DeepSeek: ✅${aiStats.deepseek.success} / ❌${aiStats.deepseek.fail}`;

    await ctx.reply(msg, { parse_mode: 'HTML' });
});

direktorBot.command('logs', async (ctx) => {
    if (ADMIN_ID && String(ctx.from.id) !== ADMIN_ID) return;

    if (monitorState.log.length === 0) {
        return ctx.reply('📋 Loglar hali bo\'sh.');
    }

    const logText = monitorState.log.slice(-20).join('\n');
    await ctx.reply(`📋 <b>OXIRGI LOGLAR:</b>\n\n<pre>${logText}</pre>`, { parse_mode: 'HTML' });
});

direktorBot.command('errors', async (ctx) => {
    if (ADMIN_ID && String(ctx.from.id) !== ADMIN_ID) return;

    const errorLogPath = path.resolve(__dirname, 'error_logs.txt');
    if (!fs.existsSync(errorLogPath)) {
        return ctx.reply('✅ Xato loglar topilmadi — hammasi yaxshi!');
    }

    const content = fs.readFileSync(errorLogPath, 'utf-8');
    const recentErrors = content.split('---').filter(Boolean).slice(-3);

    if (recentErrors.length === 0) {
        return ctx.reply('✅ Xato loglar bo\'sh.');
    }

    let msg = `🔴 <b>OXIRGI XATOLAR:</b>\n━━━━━━━━━━━━━\n\n`;
    recentErrors.forEach((err, i) => {
        const safe = err.replace(/</g, '&lt;').replace(/>/g, '&gt;').trim().substring(0, 400);
        msg += `<b>${i + 1}.</b>\n<pre>${safe}</pre>\n\n`;
    });

    await ctx.reply(msg, { parse_mode: 'HTML' });
});

direktorBot.command('ai_fix', async (ctx) => {
    if (ADMIN_ID && String(ctx.from.id) !== ADMIN_ID) return;

    const statusMsg = await ctx.reply('🤖 <b>AI butun loyihani tahlil qilmoqda...</b>', { parse_mode: 'HTML' });

    try {
        // Avval audit
        const issues = await runCodeAudit();

        // Error logs
        const errorLogPath = path.resolve(__dirname, 'error_logs.txt');
        const errorLogs = fs.existsSync(errorLogPath)
            ? fs.readFileSync(errorLogPath, 'utf-8').slice(-2000)
            : "Xato loglar yo'q";

        const prompt = `Siz Node.js va Telegram bot (Telegraf) bo'yicha Senior Dasturchi — AI Direktorisiz.

LOYIHA: MFY Generator — mahalla fuqarolar yig'inlari uchun rasmiy hujjatlar generatori.

AUDIT NATIJALARI:
${issues.map(i => `[${i.severity}] ${i.msg}`).join('\n') || 'Muammo topilmadi'}

OXIRGI XATOLAR:
${errorLogs}

VAZIFALAR:
1. Muammolarning tub sababini aniqlang
2. Har bir muammo uchun aniq yechim bering
3. Qaysi faylda, qaysi qatorda o'zgartirish kerakligini ko'rsating
4. O'zbek tilida, professional tarzda javob bering
5. Javobni qisqa va aniq qiling`;

        const analysis = await aiService.generateProfessionalText({ customPrompt: prompt, lang: 'latin' });

        const safeAnalysis = analysis.replace(/</g, '&lt;').replace(/>/g, '&gt;');

        await ctx.telegram.editMessageText(
            ctx.chat.id, statusMsg.message_id, null,
            `🤖 <b>AI DIREKTOR TAHLILI:</b>\n\n<pre>${safeAnalysis.substring(0, 3500)}</pre>`,
            { parse_mode: 'HTML' }
        ).catch(async () => {
            await ctx.reply(`🤖 <b>AI TAHLILI:</b>\n\n${safeAnalysis.substring(0, 3500)}`, { parse_mode: 'HTML' });
        });

        addLog('AI tahlil yakunlandi', 'info');
    } catch (e) {
        await ctx.telegram.editMessageText(
            ctx.chat.id, statusMsg.message_id, null,
            `❌ AI tahlilda xatolik: ${e.message}`,
            { parse_mode: 'HTML' }
        ).catch(() => { });
    }
});

// ============================================
// 🚀 ISHGA TUSHIRISH
// ============================================
// ============================================
// 🚀 ISHGA TUSHIRISH
// ============================================
async function startDirektor() {
    addLog('AI Direktor ishga tushmoqda...');

    // Botni ishga tushirish (Conflict bo'lsa kutib turadi yoki log qiladi)
    try {
        await direktorBot.launch({ dropPendingUpdates: true });
        addLog('AI Direktor bot ishlashni boshladi ✅');

        // Adminga faqat bir marta salom yo'llash (Audit siz)
        if (ADMIN_ID) {
            await direktorBot.telegram.sendMessage(ADMIN_ID,
                "🤖 <b>AI DIREKTOR ONLINE!</b>\n" +
                "Monitoring boshlandi. Hisobot uchun /check bosing.",
                { parse_mode: 'HTML' }
            ).catch(() => { });
        }

        // Har 4.8 soatda (1 kunda 5 marta) avtomatik tozalash va audit o'tkazish
        setInterval(async () => {
            addLog('Rejali avtomatik tozalash va audit o\'tkazilmoqda...');

            // 1. Keshni va xotirani tozalash
            try {
                const cleaner = require('./cleaner');
                const cleanStats = await cleaner.runAllCleanups();
                addLog(`Tozalash yakunlandi: ${cleanStats.deletedFiles} fayl o'chirildi, xotira optimallashdi.`);
            } catch (ce) {
                addLog(`Tozalovchida xato: ${ce.message}`, 'error');
            }

            // 2. Audit o'tkazish
            const issues = await runCodeAudit();
            const criticalIssues = issues.filter(i => i.severity === 'CRITICAL' || i.severity === 'ERROR');

            if (criticalIssues.length > 0) {
                if (ADMIN_ID) {
                    const report = formatReport(criticalIssues);
                    await direktorBot.telegram.sendMessage(ADMIN_ID,
                        `🚨 <b>TIZIMDA MUAMMO ANIQLANDI!</b>\n\n${report}`,
                        { parse_mode: 'HTML' }
                    ).catch(() => { });
                }

                // 3. AI bilan tahlil va avto-tuzatish
                try {
                    addLog('Kritik xato topildi. AI orqali tezkor avtomatik tuzatishga urinilmoqda...');
                    const prompt = `Siz Node.js va Telegram bot bo'yicha Senior Dasturchisiz. Loyihada quyidagi xatolar bor:\n\n${criticalIssues.map(i => i.msg).join('\n')}\n\nFaqat JSON formatida qaysi faylni qanday to'g'irlash kerakligini bering {"action":"fix_code", "file":"...", "oldCode":"...", "newCode":"..."}`;

                    // Eng ishonchlisi va tezidek birinchi Groq ni sinab ko'ramiz
                    const res = await aiService.askGroq(prompt).catch(() => aiService.askGemini(prompt));

                    const matches = res.match(/\{[\s\S]*?"action"\s*:\s*"fix_code"[\s\S]*?\}/);
                    if (matches) {
                        const action = JSON.parse(matches[0]);
                        // O'z o'rnida faylni to'g'irlash
                        const filePath = require('path').resolve(__dirname, action.file);
                        if (require('fs').existsSync(filePath)) {
                            let content = require('fs').readFileSync(filePath, 'utf8');
                            if (content.includes(action.oldCode)) {
                                content = content.replace(action.oldCode, action.newCode);
                                require('fs').writeFileSync(filePath, content);
                                addLog(`🤖 AI DIREKTOR avtomatik tuzatdi: ${action.file}`, 'fix');

                                if (ADMIN_ID) {
                                    await direktorBot.telegram.sendMessage(ADMIN_ID, `🤖 <b>AI DIREKTOR TIZIMNI TO'G'IRLADI!</b>\n\nFayl: <code>${action.file}</code>\n<i>Qayta yuklanmoqda...</i>`, { parse_mode: 'HTML' }).catch(() => { });
                                }

                                // pm2 restart 
                                require('child_process').exec('pm2 restart mfy-bot');
                            }
                        }
                    }
                } catch (e) {
                    addLog(`AI tuzatish ololmadi: ${e.message}`, 'error');
                }
            }
        }, 17280000); // 4.8 soat (17280000 ms) = Kuniga 5 marta

    } catch (e) {
        addLog(`Botni ishga tushirishda xatolik: ${e.message}`, 'error');
        // Launcher qayta ishga tushirishini kutadi
        process.exit(1);
    }
}

startDirektor().catch(err => {
    console.error('AI Direktor fatal error:', err);
    process.exit(1);
});

process.on('SIGINT', () => direktorBot.stop());
process.on('SIGTERM', () => direktorBot.stop());
