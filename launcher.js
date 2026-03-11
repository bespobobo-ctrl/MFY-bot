const { spawn, execSync } = require('child_process');
const path = require('path');

/**
 * 🛡️ ULTRA-STABLE LAUNCHER v2.0
 * Bu launcher botning faqat bitta nusxasi ishlashini kafolatlaydi.
 */

function cleanupOldInstances() {
    try {
        console.log('🧹 Eski jarayonlar tekshirilmoqda va tozalanmoqda...');
        // Windowsda bizning fayllarimizni ishlatayotgan node jarayonlarini topib o'chirish
        const scripts = ['index.js', 'direktor.js', 'launcher.js'];

        scripts.forEach(script => {
            try {
                // WMIC yordamida aynan shu scriptni ishlatayotgan node'ni topish
                const cmd = `wmic process where "CommandLine like '%node%${script}%' and Name != 'wmic.exe'" get ProcessId`;
                const output = execSync(cmd).toString();
                const pids = output.match(/\d+/g);

                if (pids) {
                    pids.forEach(pid => {
                        if (parseInt(pid) !== process.pid) { // O'zimizni o'ldirmaymiz
                            console.log(`🧨 Eski jarayon o'chirildi: PID ${pid} (${script})`);
                            execSync(`taskkill /F /PID ${pid} /T`);
                        }
                    });
                }
            } catch (e) {
                // Jarayon topilmasa xato chiqadi, uni e'tiborsiz qoldiramiz
            }
        });
        console.log('✨ Xotira tozalandi.');
    } catch (e) {
        console.warn('⚠️ Tozalashda kichiq xatolik (e\'tibor bermang):', e.message);
    }
}

function startProcess(name, script) {
    console.log(`🚀 Starting ${name}...`);
    const proc = spawn('node', [script], {
        stdio: 'inherit',
        shell: true
    });

    proc.on('close', (code) => {
        if (code !== 0 && code !== null) {
            console.log(`🛑 ${name} xato bilan to'xtadi (Code: ${code}). 10 soniyadan keyin qayta yoqiladi...`);
            setTimeout(() => startProcess(name, script), 10000);
        } else {
            console.log(`ℹ️ ${name} to'xtatildi.`);
        }
    });

    return proc;
}

// 1. Avval tozalaymiz
cleanupOldInstances();

// 2. Keyin ishga tushiramiz
console.log('💎 MFY GENERATOR - MONITORING TIZIMI ISHGA TUSHDI v2.0');
startProcess('MAIN BOT', path.join(__dirname, 'index.js'));
startProcess('AI DIREKTOR', path.join(__dirname, 'direktor.js'));

// Xatolik bo'lsa barchasini yopish
process.on('SIGINT', () => process.exit());
process.on('SIGTERM', () => process.exit());
