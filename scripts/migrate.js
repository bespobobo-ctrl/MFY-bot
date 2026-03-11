require('dotenv').config();
const fs = require('fs');
const path = require('path');
const supabase = require('../utils/supabase_client');

/**
 * 🚀 SUPABASE MIGRATION SCRIPT
 * JSON fayllardagi ma'lumotlarni Supabasega ko'chirish
 */

async function migrateEverything() {
    console.log('🚀 Migratsiya boshlanmoqda...');

    // 1. Bilimlar Bazasi (Knowledge Base)
    const KNOWLEDGE_FILE = path.resolve(__dirname, '../knowledge_base.json');
    if (fs.existsSync(KNOWLEDGE_FILE)) {
        console.log('📦 Knowledge Base ko\'chirilmoqda...');
        try {
            const kb = JSON.parse(fs.readFileSync(KNOWLEDGE_FILE, 'utf-8'));
            const data = kb.data || [];

            for (const entry of data) {
                const formatted = {
                    mahalla: entry.context?.mahalla,
                    lavozim: entry.context?.lavozim,
                    band: entry.context?.band,
                    sana: entry.context?.sana,
                    problem: entry.input?.problem,
                    analysis: entry.input?.analysis,
                    ai_solution: entry.output?.ai_solution,
                    lang: entry.metadata?.lang || 'cyrillic',
                    doc_type: entry.metadata?.type,
                    created_at: entry.timestamp || new Date().toISOString()
                };

                const { error } = await supabase.from('knowledge').insert([formatted]);
                if (error) console.error('Knowledge Entry Error:', error.message);
            }
            console.log(`✅ ${data.length} ta bilim ko'chirildi.`);
        } catch (e) {
            console.error('Knowledge Migration Error:', e.message);
        }
    }

    // 2. Foydalanuvchilar (Users)
    const USERS_FILE = path.resolve(__dirname, '../users_db.json');
    if (fs.existsSync(USERS_FILE)) {
        console.log('👥 Foydalanuvchilar ko\'chirilmoqda...');
        try {
            const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
            for (const [userId, u] of Object.entries(users)) {
                const newUser = {
                    userId: String(userId),
                    username: u.username || '',
                    fullName: u.fullName || '',
                    plan: u.plan || 'trial',
                    credits: u.credits || 0,
                    subscriptionEnd: u.subscriptionEnd,
                    token: u.token,
                    active: u.active !== false,
                    joinDate: u.joinDate || new Date().toISOString().split('T')[0],
                    totalDocs: u.totalDocs || 0
                };

                const { error } = await supabase.from('users').upsert([newUser], { onConflict: 'userId' });
                if (error) console.error(`User ${userId} Error:`, error.message);
            }
            console.log(`✅ Foydalanuvchilar ko'chirildi.`);
        } catch (e) {
            console.error('Users Migration Error:', e.message);
        }
    }

    console.log('🏁 Migratsiya yakunlandi!');
    process.exit(0);
}

migrateEverything().catch(err => {
    console.error('FATAL MIGRATION ERROR:', err);
    process.exit(1);
});
