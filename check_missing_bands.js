const fs = require('fs');
const path = require('path');
const bandsData = require('./bands');

const bandsConfigPath = path.resolve(__dirname, 'bands_config.json');
const bandsConfig = JSON.parse(fs.readFileSync(bandsConfigPath, 'utf-8'));

const allBands = [];
for (const lavozim in bandsConfig) {
    allBands.push(...bandsConfig[lavozim]);
}

const uniqueBands = [...new Set(allBands)];
const missing = uniqueBands.filter(b => !bandsData.getBandDesc(b));

console.log('Total unique bands in config:', uniqueBands.length);
console.log('Total bands in descriptions:', Object.keys(bandsData.getAllDescriptions()).length);
console.log('Total missing descriptions:', missing.length);
if (missing.length > 0) {
    console.log('Missing bands:', missing.join(', '));
}
