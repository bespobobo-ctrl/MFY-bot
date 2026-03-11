require('dotenv').config();
const supabase = require('./utils/supabase_client');

async function check() {
    const { data, error } = await supabase.from('config').select('*');
    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('Current Config in Supabase:');
        data.forEach(c => {
            console.log(`Key: ${c.key}`);
            console.log(`Value Type: ${typeof c.value}`);
            console.log(`Value: ${JSON.stringify(c.value).substring(0, 100)}...`);
        });
    }
    process.exit(0);
}
check();
