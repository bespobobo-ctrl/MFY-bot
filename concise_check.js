
const bandsData = require('./bands.js');
const bandsConfig = require('./bands_config.json');

let results = [];
let allGood = true;

for (const role in bandsConfig) {
    let matched = 0;
    bandsConfig[role].forEach(band => {
        if (bandsData.getBandDesc(role, band)) matched++;
        else allGood = false;
    });
    results.push(`${role}: ${matched}/${bandsConfig[role].length}`);
}

console.log(results.join('\n'));
if (allGood) console.log('100% OK');
else console.log('FAIL');
process.exit(allGood ? 0 : 1);
