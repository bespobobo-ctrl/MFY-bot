const fs = require('fs');
const content = fs.readFileSync('bands.js', 'utf-8');
const lines = content.split('\n');
const keys = [];
lines.forEach((line, i) => {
    const match = line.match(/^\s*"([^"]+)":/);
    if (match) {
        keys.push({ key: match[1], line: i + 1 });
    }
});

const counts = {};
keys.forEach(k => {
    counts[k.key] = (counts[k.key] || 0) + 1;
});

const duplicates = keys.filter(k => counts[k.key] > 1);
if (duplicates.length > 0) {
    console.log('Duplicate Keys found:');
    duplicates.forEach(d => {
        console.log(`Key "${d.key}" found at line ${d.line}`);
    });
} else {
    console.log('No duplicate keys found.');
}
