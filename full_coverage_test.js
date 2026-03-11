
const bandsData = require('./bands.js');
const bandsConfig = require('./bands_config.json');

console.log('--- STARTING 100% COVERAGE TEST ---');

let totalBands = 0;
let missingBands = [];
let roleStats = {};

for (const role in bandsConfig) {
    console.log(`\nChecking role: ${role}`);
    roleStats[role] = { total: 0, matched: 0, missing: [] };

    const bands = bandsConfig[role];
    bands.forEach(band => {
        totalBands++;
        roleStats[role].total++;

        const desc = bandsData.getBandDesc(role, band);

        if (desc && desc !== 'null' && desc !== undefined) {
            roleStats[role].matched++;
        } else {
            missingBands.push({ role, band });
            roleStats[role].missing.push(band);
        }
    });

    console.log(`  - Results: ${roleStats[role].matched}/${roleStats[role].total} bands found.`);
}

console.log('\n--- FINAL REPORT ---');
console.log(`Total Bands Checked: ${totalBands}`);
console.log(`Matched: ${totalBands - missingBands.length}`);
console.log(`Missing: ${missingBands.length}`);

if (missingBands.length > 0) {
    console.log('\n❌ MISSING BANDS DETECTED:');
    missingBands.forEach(m => {
        console.log(`  [${m.role}] Band ${m.band} is missing a description!`);
    });
    process.exit(1);
} else {
    console.log('\n✅ 100% COVERAGE ACHIEVED! Every band in config has a description in bands.js for its role.');
    process.exit(0);
}
