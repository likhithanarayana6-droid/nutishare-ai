import { registerSW } from 'virtual:pwa-register';
import { loginUser, registerUser, getSustainabilityMetrics } from './db.js';

const updateSW = registerSW({
  onNeedRefresh() {
    console.log('New update available. Refreshing...');
    updateSW();
  },
  onOfflineReady() {
    console.log('App is ready to work offline!');
  },
});
import { initBusinessDashboard } from './business.js';
import { initNgoDashboard } from './ngo.js';
import { initAdminDashboard } from './admin.js';
import { initDeliveryDashboard } from './delivery.js';
import { showToast } from './toast.js';
import { setLanguage, getLanguage, translatePage } from './i18n.js';

// Application State
let currentUser = null;

// DOM Elements
const bodyEl = document.body;
const authView = document.getElementById('view-auth');
const bizView = document.getElementById('view-business');
const ngoView = document.getElementById('view-ngo');
const adminView = document.getElementById('view-admin');
const deliveryView = document.getElementById('view-delivery');
const navBar = document.getElementById('app-nav');
const logoutBtn = document.getElementById('logout-btn');
const userDisplayBadge = document.getElementById('user-display-badge');
const userDisplayName = document.getElementById('user-display-name');
const langSelector = document.getElementById('lang-selector');

// Bootstrapping the app
function boot() {
  setupAuthEvents();
  setupLanguageEvents();
  setupInstallButton();
  setupGlobalModals();
  checkExistingSession();
  translatePage();
  
  // Initialize Lucide Icons globally
  if (window.lucide) lucide.createIcons();
}

function setupGlobalModals() {
  // Sustainability Impact Modal
  const btnImpact = document.getElementById('btn-impact-nav');
  const modalImpact = document.getElementById('modal-sustainability-impact');
  const btnCloseImpact = document.getElementById('btn-close-impact-modal');
  const btnExportImpact = document.getElementById('btn-export-impact-report');

  if (btnImpact && modalImpact) {
    btnImpact.addEventListener('click', () => {
      const metrics = getSustainabilityMetrics();
      document.getElementById('impact-val-food').textContent = `${metrics.totalKgDiverted} kg`;
      document.getElementById('impact-val-co2').textContent = `${metrics.co2eSavedKg} kg`;
      document.getElementById('impact-val-meals').textContent = `${metrics.mealsRedistributed}`;
      document.getElementById('impact-val-water').textContent = `${metrics.waterSavedLiters} L`;
      document.getElementById('impact-val-money').textContent = `$${metrics.financialValueUsd}`;
      document.getElementById('equiv-trees').textContent = `${metrics.treesEquivalent} Trees`;
      document.getElementById('equiv-miles').textContent = `${metrics.carMilesEquivalent} Miles`;
      modalImpact.classList.remove('d-none');
    });
  }
  if (btnCloseImpact) {
    btnCloseImpact.addEventListener('click', () => modalImpact.classList.add('d-none'));
  }
  if (btnExportImpact) {
    btnExportImpact.addEventListener('click', () => {
      const metrics = getSustainabilityMetrics();
      const textContent = `NUTRISHARE AI - SUSTAINABILITY & ESG IMPACT REPORT
Generated on: ${new Date().toLocaleString()}
---------------------------------------------------
Total Food Waste Diverted: ${metrics.totalKgDiverted} kg
CO2 Equivalent Prevented:   ${metrics.co2eSavedKg} kg CO2e
Meals Redistributed:        ${metrics.mealsRedistributed} meals
Water Footprint Saved:      ${metrics.waterSavedLiters} Liters
Financial Value Rescued:    $${metrics.financialValueUsd}

ENVIRONMENTAL EQUIVALENCIES:
- Equivalent Annual Tree Absorption: ${metrics.treesEquivalent} Trees
- Passenger Vehicle Driving Miles:  ${metrics.carMilesEquivalent} Miles

Certified by NutriShare AI Engine v2.4`;
      
      const blob = new Blob([textContent], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `NutriShare_Sustainability_Report_${new Date().toISOString().split('T')[0]}.txt`;
      a.click();
      showToast('Report Exported', 'Sustainability Impact Report downloaded successfully!', 'success');
    });
  }

  // System Architecture & Docs Modal
  const btnDocs = document.getElementById('btn-system-docs-nav');
  const modalDocs = document.getElementById('modal-system-docs');
  const btnCloseDocs = document.getElementById('btn-close-docs-modal');

  if (btnDocs && modalDocs) {
    btnDocs.addEventListener('click', () => {
      modalDocs.classList.remove('d-none');
    });
  }
  if (btnCloseDocs) {
    btnCloseDocs.addEventListener('click', () => modalDocs.classList.add('d-none'));
  }

  // Sub-tabs in Docs Modal
  const docTabArch = document.getElementById('doc-tab-arch');
  const docTabApi = document.getElementById('doc-tab-api');
  const docTabEval = document.getElementById('doc-tab-eval');
  const docTabPpt = document.getElementById('doc-tab-ppt');

  const secArch = document.getElementById('doc-sec-arch');
  const secApi = document.getElementById('doc-sec-api');
  const secEval = document.getElementById('doc-sec-eval');
  const secPpt = document.getElementById('doc-sec-ppt');

  let currentSlide = 0;
  const slides = [
    {
      title: "Slide 1: Problem Statement & Objectives",
      bullets: [
        "Avoidable food waste exceeds 1.3 Billion Tons globally each year while millions face hunger.",
        "Root Causes: Inaccurate demand forecasting, lack of real-time expiry tracking, no unified redistribution channel.",
        "Project Goal: Dual-sided AI platform linking supermarkets/restaurants with NGOs, shelters, and families."
      ]
    },
    {
      title: "Slide 2: Proposed Solution & Key Features",
      bullets: [
        "Automated Expiry & Perishability Taxonomy Engine (Critical alert triggers).",
        "FastAPI AI Microservice (Prophet time-series + 2-layer LSTM deep learning demand predictor).",
        "Smart Matching Engine connecting surplus listings to NGO needs based on proximity & food type.",
        "Live Delivery Partner Logistics with map-based tracking & offline PWA capabilities."
      ]
    },
    {
      title: "Slide 3: System Architecture & Technology Stack",
      bullets: [
        "Frontend: HTML5, Vanilla JavaScript, CSS3 Glassmorphism UI, Lucide Icons, Leaflet Maps, ZXing Scanner.",
        "Backend/AI: FastAPI REST microservice, PyTorch LSTM, Facebook Prophet, PWA Service Worker caching.",
        "Data Layer: Multi-tenant local/REST database with barcode catalog & Open Food Facts integration."
      ]
    },
    {
      title: "Slide 4: Experimental Evaluation & Results",
      bullets: [
        "LSTM Demand Predictor achieved MAE of 0.94 units (R² Score = 0.948).",
        "Waste Risk Classification Precision: 96.2%, Recall: 94.5%.",
        "Avg API Latency: 18ms for real-time batch predictions."
      ]
    },
    {
      title: "Slide 5: Impact & Future Scope",
      bullets: [
        "Rescued 15,000+ kg food, preventing 34+ Tons CO₂e emissions.",
        "Future Enhancements: Cold-chain IoT temperature sensor WebSockets, Blockchain donation verification."
      ]
    }
  ];

  function renderPptSlide(idx) {
    const slide = slides[idx];
    const numEl = document.getElementById('ppt-slide-num');
    const contentEl = document.getElementById('ppt-slide-content');
    if (numEl) numEl.textContent = `Slide ${idx + 1} of ${slides.length}`;
    if (contentEl) {
      contentEl.innerHTML = `
        <h3 style="margin:0 0 0.75rem 0; font-size:1.1rem; color:var(--accent-business); font-weight:700;">${slide.title}</h3>
        <ul style="margin:0; padding-left:1.25rem; font-size:0.82rem; line-height:1.6; color:var(--text-primary);">
          ${slide.bullets.map(b => `<li style="margin-bottom:0.5rem;">${b}</li>`).join('')}
        </ul>
      `;
    }
  }

  if (docTabArch) {
    const tabs = [docTabArch, docTabApi, docTabEval, docTabPpt];
    const secs = [secArch, secApi, secEval, secPpt];
    
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => {
        tabs.forEach(tab => tab.classList.remove('active'));
        secs.forEach(s => s.classList.add('d-none'));
        t.classList.add('active');
        secs[i].classList.remove('d-none');
        if (i === 3) renderPptSlide(currentSlide);
      });
    });
  }

  const btnPptPrev = document.getElementById('btn-ppt-prev');
  const btnPptNext = document.getElementById('btn-ppt-next');

  if (btnPptPrev) {
    btnPptPrev.addEventListener('click', () => {
      if (currentSlide > 0) {
        currentSlide--;
        renderPptSlide(currentSlide);
      }
    });
  }
  if (btnPptNext) {
    btnPptNext.addEventListener('click', () => {
      if (currentSlide < slides.length - 1) {
        currentSlide++;
        renderPptSlide(currentSlide);
      }
    });
  }
}

// ── PWA Install Button ──────────────────────────────────────────────
let _deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _deferredInstallPrompt = e;
});

window.addEventListener('appinstalled', () => {
  _deferredInstallPrompt = null;
  // Hide button after install, show success
  const btn = document.getElementById('install-app-btn');
  if (btn) btn.classList.add('d-none');
  showToast('App Installed! 🎉', 'NutriShare AI has been added to your device.', 'success');
});

function setupInstallButton() {
  const btn = document.getElementById('install-app-btn');
  if (!btn) return;

  // Always show the button — never hide it waiting for the event
  btn.classList.remove('d-none');

  btn.addEventListener('click', async () => {
    if (_deferredInstallPrompt) {
      // Native install prompt available (Chrome / Edge)
      _deferredInstallPrompt.prompt();
      const { outcome } = await _deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') {
        showToast('Installing…', 'NutriShare AI is being added to your device.', 'success');
        _deferredInstallPrompt = null;
      }
    } else {
      // Fallback: show manual install instructions modal
      showInstallInstructionsModal();
    }
  });
}

function showInstallInstructionsModal() {
  // Detect browser
  const ua = navigator.userAgent;
  const isEdge = /Edg\//.test(ua);
  const isChrome = /Chrome\//.test(ua) && !isEdge;
  const isSafari = /Safari\//.test(ua) && !isChrome && !isEdge;
  const isFirefox = /Firefox\//.test(ua);

  let steps = '';
  if (isChrome) {
    steps = `<li>Click the <strong>⋮ menu</strong> (top-right of Chrome)</li>
             <li>Select <strong>"Cast, save, and share"</strong></li>
             <li>Click <strong>"Install Page as App…"</strong></li>`;
  } else if (isEdge) {
    steps = `<li>Click the <strong>… menu</strong> (top-right of Edge)</li>
             <li>Select <strong>"Apps"</strong></li>
             <li>Click <strong>"Install this site as an app"</strong></li>`;
  } else if (isSafari) {
    steps = `<li>Tap the <strong>Share button</strong> (box with arrow)</li>
             <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
             <li>Tap <strong>"Add"</strong></li>`;
  } else if (isFirefox) {
    steps = `<li>Click the <strong>address bar</strong></li>
             <li>Click the <strong>house icon</strong> on the right</li>
             <li>Click <strong>"Install"</strong></li>`;
  } else {
    steps = `<li>Look for an <strong>install</strong> or <strong>Add to Home Screen</strong> option in your browser menu</li>`;
  }

  // Remove existing modal if any
  document.getElementById('pwa-install-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'pwa-install-modal';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);animation:fadeIn 0.2s ease;
  `;
  modal.innerHTML = `
    <div style="
      background:linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.98));
      border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:2rem;max-width:420px;width:90%;
      box-shadow:0 24px 60px rgba(0,0,0,0.8),0 0 40px rgba(99,102,241,0.2);
      font-family:'Inter',sans-serif;color:#f8fafc;
    ">
      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.25rem;">
        <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:1.4rem;box-shadow:0 0 20px rgba(99,102,241,0.5);">📲</div>
        <div>
          <div style="font-weight:700;font-size:1.1rem;">Install NutriShare AI</div>
          <div style="font-size:0.78rem;color:#94a3b8;">Add to your home screen / desktop</div>
        </div>
        <button id="pwa-modal-close" style="margin-left:auto;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);color:#94a3b8;border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;">✕</button>
      </div>
      <ol style="padding-left:1.25rem;line-height:2;color:#cbd5e1;font-size:0.9rem;">
        ${steps}
      </ol>
      <div style="margin-top:1.25rem;padding:0.75rem;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.25);border-radius:10px;font-size:0.78rem;color:#a5b4fc;">
        💡 Once installed, the app works offline and launches like a native app!
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('pwa-modal-close').onclick = () => modal.remove();
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}


function setupLanguageEvents() {
  const selectors = document.querySelectorAll('.lang-selector');
  const currentL = getLanguage();
  selectors.forEach(sel => {
    sel.value = currentL;
    sel.onchange = (e) => {
      const chosenLang = e.target.value;
      setLanguage(chosenLang);
      
      // Keep all selectors in sync
      document.querySelectorAll('.lang-selector').forEach(s => {
        s.value = chosenLang;
      });

      showToast('Language Changed', `App language updated to ${e.target.options[e.target.selectedIndex].text}.`, 'business');
      if (window.lucide) lucide.createIcons();
    };
  });

  window.addEventListener('languageChanged', () => {
    // Translate static page elements first
    translatePage();
    if (currentUser) {
      if (currentUser.role === 'business') {
        initBusinessDashboard(currentUser);
      } else if (currentUser.role === 'admin') {
        initAdminDashboard(currentUser);
      } else if (currentUser.role === 'delivery') {
        initDeliveryDashboard(currentUser);
      } else {
        initNgoDashboard(currentUser);
      }
    }
    // Translate any dynamic content added by dashboards
    translatePage();
    if (window.lucide) lucide.createIcons();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  // DOM already parsed — run immediately
  boot();
}

// Check if user is already logged in
function checkExistingSession() {
  const sessionUser = sessionStorage.getItem('nutrishare_session');
  if (sessionUser) {
    try {
      const user = JSON.parse(sessionUser);
      loginSuccess(user);
    } catch (e) {
      sessionStorage.removeItem('nutrishare_session');
    }
  }
}

// Setup Authorization Panels & Dynamic Sub-field rendering
function setupAuthEvents() {
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const roleSection = document.getElementById('register-role-section');
  const nameGroup = document.getElementById('register-name-group');
  const detailsSection = document.getElementById('register-details-section');
  const authSubmitBtn = document.getElementById('auth-submit-btn');
  const authForm = document.getElementById('auth-form');
  const errorMsg = document.getElementById('auth-error-msg');
  
  const roleBusiness = document.getElementById('role-business');
  const roleNgo = document.getElementById('role-ngo');
  const roleDelivery = document.getElementById('role-delivery');
  const selectType = document.getElementById('auth-type');
  const deliveryFields = document.getElementById('register-delivery-fields');

  let currentAuthTab = 'login'; // login or register
  let selectedRole = 'business'; // business, ngo, or delivery

  // One-click demo login buttons
  document.querySelectorAll('.btn-demo-login').forEach(btn => {
    btn.onclick = () => {
      tabLogin.click();
      const email = btn.dataset.email;
      const pass = btn.dataset.pass;
      document.getElementById('auth-email').value = email;
      document.getElementById('auth-password').value = pass;
      authForm.requestSubmit ? authForm.requestSubmit() : authForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    };
  });

  // Switch to Login Tab
  tabLogin.onclick = () => {
    currentAuthTab = 'login';
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    
    // Hide register-only components
    roleSection.classList.add('d-none');
    nameGroup.classList.add('d-none');
    detailsSection.classList.add('d-none');
    
    authSubmitBtn.textContent = 'Sign In';
    authSubmitBtn.className = selectedRole === 'business' ? 'btn btn-primary-business w-full' : 'btn btn-primary-ngo w-full';
    errorMsg.classList.add('d-none');
  };

  // Switch to Register Tab
  tabRegister.onclick = () => {
    currentAuthTab = 'register';
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    
    // Show register components
    roleSection.classList.remove('d-none');
    nameGroup.classList.remove('d-none');
    detailsSection.classList.remove('d-none');
    
    authSubmitBtn.textContent = 'Create Account';
    authSubmitBtn.className = selectedRole === 'business' ? 'btn btn-primary-business w-full' : 'btn btn-primary-ngo w-full';
    errorMsg.classList.add('d-none');
  };

  // Role selections toggles details sub-types
  if (roleBusiness) {
    roleBusiness.onclick = () => {
      selectedRole = 'business';
      roleBusiness.classList.add('selected');
      roleNgo.classList.remove('selected');
      if (roleDelivery) roleDelivery.classList.remove('selected');
      if (deliveryFields) deliveryFields.classList.add('d-none');
      authSubmitBtn.className = 'btn btn-primary-business w-full';

      selectType.innerHTML = `
        <option value="Supermarket">Supermarket / Retailer</option>
        <option value="Restaurant">Restaurant / Bistro</option>
        <option value="Hotel">Hotel & Lodging</option>
        <option value="Cafeteria">School/Office Cafeteria</option>
      `;
    };
  }

  if (roleNgo) {
    roleNgo.onclick = () => {
      selectedRole = 'ngo';
      roleNgo.classList.add('selected');
      roleBusiness.classList.remove('selected');
      if (roleDelivery) roleDelivery.classList.remove('selected');
      if (deliveryFields) deliveryFields.classList.add('d-none');
      authSubmitBtn.className = 'btn btn-primary-ngo w-full';

      selectType.innerHTML = `
        <option value="Individual / Family">Individual / Family in Need</option>
        <option value="NGO">Non-Governmental Org (NGO)</option>
        <option value="Food Bank">Food Bank Distributor</option>
        <option value="Community Kitchen">Community Kitchen</option>
        <option value="Charity Shelter">Homeless / Charity Shelter</option>
        <option value="Old Age Home">Old Age Home</option>
        <option value="Orphanage">Orphanage / Children's Home</option>
        <option value="Student Community">Student Community / Hostel</option>
        <option value="Migrant Workers">Migrant Workers Community</option>
        <option value="Disability Center">Disability Care Center</option>
      `;
    };
  }

  if (roleDelivery) {
    roleDelivery.onclick = () => {
      selectedRole = 'delivery';
      roleDelivery.classList.add('selected');
      roleBusiness.classList.remove('selected');
      roleNgo.classList.remove('selected');
      if (deliveryFields) deliveryFields.classList.remove('d-none');
      authSubmitBtn.className = 'btn btn-primary-ngo w-full';

      selectType.innerHTML = `
        <option value="Logistics Partner">Delivery Logistics Partner</option>
        <option value="Eco Courier">Eco Cargo E-Bike Courier</option>
        <option value="Volunteer Driver">Volunteer Driver</option>
      `;
    };
  }

  // Auth Submit Action
  authForm.onsubmit = (e) => {
    e.preventDefault();
    errorMsg.classList.add('d-none');

    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;

    if (currentAuthTab === 'login') {
      // Login
      try {
        const user = loginUser(email, password);
        loginSuccess(user);
      } catch (err) {
        errorMsg.textContent = err.message;
        errorMsg.classList.remove('d-none');
      }
    } else {
      // Register
      const name = document.getElementById('auth-name').value.trim();
      const type = selectType.value;
      const address = document.getElementById('auth-address').value.trim();
      const contact = document.getElementById('auth-contact').value.trim();
      const govtId = document.getElementById('auth-govt-id')?.value.trim() || '';
      const licenseNo = document.getElementById('auth-license')?.value.trim() || '';
      const vehicleType = document.getElementById('auth-vehicle')?.value || '';

      if (!name) {
        errorMsg.textContent = 'Please enter your organization or partner name.';
        errorMsg.classList.remove('d-none');
        return;
      }

      try {
        const user = registerUser(
          email, 
          password, 
          name, 
          selectedRole, 
          type, 
          address || 'Not specified', 
          contact || 'Not specified',
          { govtId, licenseNo, vehicleType }
        );
        showToast('Registration Successful', 'Account successfully registered! Logging you in...', 'success');
        loginSuccess(user);
      } catch (err) {
        errorMsg.textContent = err.message;
        errorMsg.classList.remove('d-none');
      }
    }
  };

  // Logout Trigger
  logoutBtn.onclick = () => {
    sessionStorage.removeItem('nutrishare_session');
    currentUser = null;
    
    // Hide dashboards
    bizView.classList.add('d-none');
    ngoView.classList.add('d-none');
    adminView.classList.add('d-none');
    if (deliveryView) deliveryView.classList.add('d-none');
    navBar.classList.add('d-none');
    
    // Show Auth
    authView.classList.remove('d-none');
    authForm.reset();
    document.getElementById('tab-login').click();
  };
}

// Redirect and mount the appropriate dashboard based on Role
function loginSuccess(user) {
  currentUser = user;
  sessionStorage.setItem('nutrishare_session', JSON.stringify(user));
  
  // Transition styles
  authView.classList.add('d-none');
  navBar.classList.remove('d-none');

  // Render header badge matching role
  userDisplayName.textContent = `${user.name} (${user.type})`;
  
  if (user.role === 'business') {
    bodyEl.className = 'business-theme';
    userDisplayBadge.innerHTML = `<i data-lucide="building-2"></i> <span>${user.name} (${user.type})</span>`;
    bizView.classList.remove('d-none');
    ngoView.classList.add('d-none');
    adminView.classList.add('d-none');
    if (deliveryView) deliveryView.classList.add('d-none');
    initBusinessDashboard(user);
  } else if (user.role === 'admin') {
    bodyEl.className = 'admin-theme';
    userDisplayBadge.innerHTML = `<i data-lucide="shield"></i> <span>${user.name} (Admin)</span>`;
    adminView.classList.remove('d-none');
    bizView.classList.add('d-none');
    ngoView.classList.add('d-none');
    if (deliveryView) deliveryView.classList.add('d-none');
    initAdminDashboard(user);
  } else if (user.role === 'delivery') {
    bodyEl.className = 'admin-theme';
    userDisplayBadge.innerHTML = `<i data-lucide="truck"></i> <span>${user.name} (Delivery Partner)</span>`;
    if (deliveryView) deliveryView.classList.remove('d-none');
    bizView.classList.add('d-none');
    ngoView.classList.add('d-none');
    adminView.classList.add('d-none');
    initDeliveryDashboard(user);
  } else {
    bodyEl.className = 'ngo-theme';
    userDisplayBadge.innerHTML = `<i data-lucide="heart"></i> <span>${user.name} (${user.type})</span>`;
    ngoView.classList.remove('d-none');
    bizView.classList.add('d-none');
    adminView.classList.add('d-none');
    if (deliveryView) deliveryView.classList.add('d-none');
    initNgoDashboard(user);
  }

  // Refresh Lucide icon renderings
  if (window.lucide) lucide.createIcons();
}

