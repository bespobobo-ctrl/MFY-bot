const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

class SystemCleaner {
    constructor() {
        this.tmpDir = os.tmpdir();
        this.projectDir = __dirname;
    }

    async runAllCleanups() {
        let stats = {
            deletedFiles: 0,
            logsTruncated: 0,
            freedMemoryMB: 0
        };

        const beforeMem = process.memoryUsage().heapUsed;

        // 1. Vaqtinchalik fayllar va Chrome kesh qoldiqlarini tozalash
        stats.deletedFiles = await this.cleanTempFiles();

        // 2. Katta log fayllarni (5 MB dan katta) qisqartirish
        stats.logsTruncated = await this.truncateLogs();

        // 3. Node.js qoldiqlarini tozalashga urinish (Garbage Collection)
        if (global.gc) {
            try {
                global.gc();
            } catch (e) {
                // node --expose-gc talab qilinadi
            }
        }

        const afterMem = process.memoryUsage().heapUsed;
        stats.freedMemoryMB = Math.max(0, (beforeMem - afterMem) / 1024 / 1024).toFixed(2);

        return stats;
    }

    async cleanTempFiles() {
        let deleted = 0;

        // Operatsion tizimdagi /tmp jildi (Puppeteer odatda profillarni shu yerda qoldiradi)
        try {
            const files = fs.readdirSync(this.tmpDir);
            const now = Date.now();
            files.forEach(file => {
                // Puppeteer yaratadigan vaqtinchalik papkalar turlari
                if (file.startsWith('puppeteer_dev_chrome_profile') || file.startsWith('core-')) {
                    const filePath = path.join(this.tmpDir, file);
                    const stat = fs.statSync(filePath);
                    // Agar 4 soatdan eskirgan bo'lsa (Zombi papka) o'chirib tashlaymiz
                    if (now - stat.mtimeMs > 4 * 60 * 60 * 1000) {
                        try {
                            fs.rmSync(filePath, { recursive: true, force: true });
                            deleted++;
                        } catch (e) { }
                    }
                }
            });
        } catch (e) {
            console.error('Tmp tozalashda xato:', e.message);
        }

        // Loyiha ichidagi rasmlar (temp uploads) jildi (agar bo'lsa)
        try {
            const tempUploads = path.join(this.projectDir, 'temp');
            if (fs.existsSync(tempUploads)) {
                const files = fs.readdirSync(tempUploads);
                const now = Date.now();
                files.forEach(file => {
                    const filePath = path.join(tempUploads, file);
                    const stat = fs.statSync(filePath);
                    // 4 soatdan eskirgan rasmlarni o'chirish
                    if (now - stat.mtimeMs > 4 * 60 * 60 * 1000) {
                        fs.unlinkSync(filePath);
                        deleted++;
                    }
                });
            }
        } catch (e) { }

        return deleted;
    }

    async truncateLogs() {
        let truncated = 0;
        const logPath = path.join(this.projectDir, 'error_logs.txt');
        try {
            if (fs.existsSync(logPath)) {
                const stats = fs.statSync(logPath);
                // Agar fayl hajmi 5MB dan katta bo'lsa
                if (stats.size > 5 * 1024 * 1024) {
                    const content = fs.readFileSync(logPath, 'utf8');
                    const lines = content.split('\n');
                    // Faqat oxirgi 500 qatorni olib qolish (Bot tarixni yo'qotmasligi uchun)
                    const newContent = lines.slice(-500).join('\n');
                    fs.writeFileSync(logPath, newContent);
                    truncated++;
                }
            }
        } catch (e) { }
        return truncated;
    }
}

module.exports = new SystemCleaner();
