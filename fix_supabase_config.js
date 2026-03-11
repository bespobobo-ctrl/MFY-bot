require('dotenv').config();
const fs = require('fs');
const path = require('path');
const supabase = require('./utils/supabase_client');

const MAHALLALAR = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'mahalla_config.json'), 'utf-8'));
const BANDS_BY_LAVOZIM = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'bands_config.json'), 'utf-8'));

async function fix() {
    console.log('Syncing Local Config to Supabase...');

    const { error } = await supabase.from('config').upsert([
        { key: 'MAHALLALAR', value: MAHALLALAR },
        { key: 'BANDS_BY_LAVOZIM', value: BANDS_BY_LAVOZIM }
    ], { onConflict: 'key' });

    if (error) {
        console.error('❌ Supabase xatolik:', error.message);
    } else {
        console.log('✅ Supabase muvaffaqiyatli yangilandi!');
    }
}
fix();
