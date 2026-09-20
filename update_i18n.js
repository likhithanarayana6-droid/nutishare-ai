import fs from 'fs';

let content = fs.readFileSync('src/i18n.js', 'utf8');

const keysToAdd = {
  en: {
    adminWelcome: "Welcome back, Admin 👋",
    businesses: "Businesses",
    ngosRecipients: "NGOs / Recipients",
    availableNow: "Available Now",
    claimedDonations: "Claimed Donations",
    inventoryItems: "Inventory Items",
    platformActivity: "⚡ Platform Activity"
  },
  te: {
    adminWelcome: "తిరిగి స్వాగతం, అడ్మిన్ 👋",
    businesses: "వ్యాపారాలు",
    ngosRecipients: "NGOలు / గ్రహీతలు",
    availableNow: "ఇప్పుడు అందుబాటులో ఉంది",
    claimedDonations: "క్లెయిమ్ చేసిన విరాళాలు",
    inventoryItems: "ఇన్వెంటరీ వస్తువులు",
    platformActivity: "⚡ ప్లాట్‌ఫారమ్ కార్యాచరణ"
  },
  hi: {
    adminWelcome: "वापसी पर स्वागत है, व्यवस्थापक 👋",
    businesses: "व्यवसाय",
    ngosRecipients: "एनजीओ / प्राप्तकर्ता",
    availableNow: "अब उपलब्ध है",
    claimedDonations: "दावा किए गए दान",
    inventoryItems: "इन्वेंटरी आइटम",
    platformActivity: "⚡ प्लेटफ़ॉर्म गतिविधि"
  },
  ta: {
    adminWelcome: "மீண்டும் வருக, நிர்வாகி 👋",
    businesses: "வணிகங்கள்",
    ngosRecipients: "தொண்டு நிறுவனங்கள் / பெறுநர்கள்",
    availableNow: "இப்போது கிடைக்கிறது",
    claimedDonations: "கோரப்பட்ட நன்கொடைகள்",
    inventoryItems: "பட்டியல் பொருட்கள்",
    platformActivity: "⚡ இயங்குதள செயல்பாடு"
  },
  kn: {
    adminWelcome: "ಮರಳಿ ಸ್ವಾಗತ, ನಿರ್ವಾಹಕ 👋",
    businesses: "ವ್ಯವಹಾರಗಳು",
    ngosRecipients: "ಎನ್‌ಜಿಒಗಳು / ಸ್ವೀಕರಿಸುವವರು",
    availableNow: "ಈಗ ಲಭ್ಯವಿದೆ",
    claimedDonations: "ಕ್ಲೈಮ್ ಮಾಡಿದ ದೇಣಿಗೆಗಳು",
    inventoryItems: "ದಾಸ್ತಾನು ವಸ್ತುಗಳು",
    platformActivity: "⚡ ಪ್ಲಾಟ್‌ಫಾರ್ಮ್ ಚಟುವಟಿಕೆ"
  },
  ml: {
    adminWelcome: "തിരികെ സ്വാഗതം, അഡ്മിൻ 👋",
    businesses: "ബിസിനസുകൾ",
    ngosRecipients: "എൻജിഒകൾ / സ്വീകർത്താക്കൾ",
    availableNow: "ഇപ്പോൾ ലഭ്യമാണ്",
    claimedDonations: "അവകാശപ്പെട്ട സംഭാവനകൾ",
    inventoryItems: "ഇൻവെന്ററി ഇനങ്ങൾ",
    platformActivity: "⚡ പ്ലാറ്റ്ഫോം പ്രവർത്തനം"
  },
  es: {
    adminWelcome: "Bienvenido de nuevo, Administrador 👋",
    businesses: "Negocios",
    ngosRecipients: "ONGs / Beneficiarios",
    availableNow: "Disponible Ahora",
    claimedDonations: "Donaciones Reclamadas",
    inventoryItems: "Artículos de Inventario",
    platformActivity: "⚡ Actividad de la Plataforma"
  },
  fr: {
    adminWelcome: "Bon retour, Administrateur 👋",
    businesses: "Entreprises",
    ngosRecipients: "ONG / Bénéficiaires",
    availableNow: "Disponible Maintenant",
    claimedDonations: "Dons Réclamés",
    inventoryItems: "Articles d'Inventaire",
    platformActivity: "⚡ Activité de la Plateforme"
  }
};

for (const lang in keysToAdd) {
  const keysStr = Object.entries(keysToAdd[lang])
    .map(([k, v]) => `    ${k}: "${v}"`)
    .join(',\n') + ',';
  
  // Find where the dictionary for this language ends
  // We look for a line ending with "}" right before the next language starts or the object ends
  const regex = new RegExp(`(${lang}:\\s*{[\\s\\S]*?)([\\s]*)(},?\\s*(?:[a-z]{2}:\\s*{|};))`);
  
  content = content.replace(regex, (match, p1, p2, p3) => {
    return p1 + ',\n' + keysStr + p2 + p3;
  });
}

fs.writeFileSync('src/i18n.js', content, 'utf8');
console.log('Updated i18n.js');
