const supabase = require('./utils/supabase_client');

/**
 * 🤖 BOT INTERNAL KNOWLEDGE ENGINE (SUPABASE v2.0)
 * Bu modul bot tomonidan yaratilgan barcha rasmiy hujjatlardan bilim to'playdi.
 */

// Bilimlar bazasini yuklash (Supabase orqali)
async function getStats() {
    const { count, error } = await supabase
        .from('knowledge')
        .select('*', { count: 'exact', head: true });

    return {
        total_entries: count || 0,
        last_updated: new Date().toISOString()
    };
}

// Yangi bilim qo'shish
async function learnFromDocument(docData) {
    try {
        const entry = {
            mahalla: String(docData.mahalla),
            lavozim: String(docData.lavozim),
            band: String(docData.band),
            sana: docData.sana,
            problem: docData.problem,
            analysis: docData.analysis,
            ai_solution: docData.ai_solution,
            lang: docData.lang || 'cyrillic',
            doc_type: docData.type,
            created_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('knowledge')
            .insert([entry]);

        if (error) throw error;

        console.log(`[Knowledge Engine] Yangi bilim Supabasega saqlandi.`);
        return true;
    } catch (error) {
        console.error("Knowledge Engine Supabase Error:", error);
        return false;
    }
}

// Ma'lumotlarni qidirish (Supabase Full Text Search or Vector Search)
async function queryKnowledge(queryText) {
    try {
        const { data, error } = await supabase
            .from('knowledge')
            .select('*')
            .or(`problem.ilike.%${queryText}%,band.eq.${queryText}`)
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error("Query Knowledge Error:", e);
        return [];
    }
}

module.exports = {
    learnFromDocument,
    queryKnowledge,
    getStats
};
