import { loginUser, registerUser } from './db.js';
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
  checkExistingSession();
  translatePage();
  
  // Initialize Lucide Icons globally
  if (window.lucide) lucide.createIcons();
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

