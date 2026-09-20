const fs = require('fs');
let content = fs.readFileSync('src/i18n.js', 'utf8');

const additions = {
  en: 'Install App',
  te: 'యాప్ ఇన్‌స్టాల్ చేయండి',
  hi: 'ऐप इंस्टॉल करें',
  ta: 'செயலியை நிறுவு',
  kn: 'ಅಪ್ಲಿಕೇಶನ್ ಸ್ಥಾಪಿಸಿ',
  ml: 'ആപ്പ് ഇൻസ്റ്റാൾ ചെയ്യുക',
  es: 'Instalar App',
  fr: "Installer l'App"
};

for (const [lang, val] of Object.entries(additions)) {
  const langStart = content.indexOf(lang + ': {');
  if (langStart === -1) { console.log('Lang not found:', lang); continue; }
  const signOutIdx = content.indexOf('signOut:', langStart);
  if (signOutIdx === -1) { console.log('signOut not found for', lang); continue; }
  const lineEnd = content.indexOf('\n', signOutIdx);
  const insertStr = '\n    installApp: "' + val + '",';
  content = content.substring(0, lineEnd) + insertStr + content.substring(lineEnd);
  console.log('Added installApp for', lang);
}

fs.writeFileSync('src/i18n.js', content);
console.log('Done!');
