// src/admin.js
import { getAllUsers, getAllDonations, getAllInventory, getAdminStats, getDeliveryPartners, verifyDeliveryPartner } from './db.js';
import { showToast } from './toast.js';
import { t, tCat, tUnit, tName } from './i18n.js';

let currentAdminId = null;

// ── Color helpers ──────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'linear-gradient(135deg,#6366f1,#a855f7)',
  'linear-gradient(135deg,#10b981,#059669)',
  'linear-gradient(135deg,#f59e0b,#d97706)',
  'linear-gradient(135deg,#ec4899,#be185d)',
  'linear-gradient(135deg,#06b6d4,#0891b2)',
  'linear-gradient(135deg,#3b82f6,#2563eb)',
];
function avatarColor(str = '') {
  let hash = 0;
  for (const c of str) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function initials(name = '') {
  return name.trim().split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
}

// ── Entry Point ────────────────────────────────────────────────────────────────
export function initAdminDashboard(user) {
  currentAdminId = user.id;
  const welcomeEl = document.getElementById('admin-welcome');
  if (welcomeEl) welcomeEl.textContent = `${t('welcome')}, ${user.name}`;
  setupAdminTabs();
  loadOverview();
  loadUsersTable();
  loadDonationsTable();
  loadClaimsTable();
  loadPartnersCards();
  updateTabCounts();
  if (window.lucide) window.lucide.createIcons();
}

// ── Tab Switching ──────────────────────────────────────────────────────────────
function setupAdminTabs() {
  const tabs = document.querySelectorAll('.admin-tab-btn');
  const sections = document.querySelectorAll('.admin-tab-section');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      sections.forEach(s => s.classList.add('d-none'));
      tab.classList.add('active');
      const target = document.getElementById(tab.dataset.target);
      if (target) target.classList.remove('d-none');
      // Refresh data on tab change
      if (tab.dataset.target === 'admin-overview') loadOverview();
      if (tab.dataset.target === 'admin-users') loadUsersTable();
      if (tab.dataset.target === 'admin-donations') loadDonationsTable();
      if (tab.dataset.target === 'admin-claims') loadClaimsTable();
      if (tab.dataset.target === 'admin-partners') loadPartnersCards();
      if (window.lucide) window.lucide.createIcons();
    });
  });
}

// ── Tab Counts ─────────────────────────────────────────────────────────────────
function updateTabCounts() {
  const users = getAllUsers().filter(u => u.role !== 'admin');
  const donations = getAllDonations();
  const claims = donations.filter(d => d.status === 'claimed' || d.status === 'assigned');
  const partners = getDeliveryPartners();
  setEl('tc-users', users.length);
  setEl('tc-donations', donations.length);
  setEl('tc-claims', claims.length);
  setEl('tc-partners', partners.length);
}

// ── Overview / KPI ─────────────────────────────────────────────────────────────
function loadOverview() {
  const stats = getAdminStats();
  const donations = getAllDonations();
  setEl('stat-total-users', stats.totalUsers);
  setEl('stat-total-businesses', stats.totalBusinesses);
  setEl('stat-total-ngos', stats.totalNGOs);
  setEl('stat-total-partners', stats.totalDeliveryPartners || 0);
  setEl('stat-total-donations', stats.totalDonations);
  setEl('stat-available-donations', stats.availableDonations);
  setEl('stat-claimed-donations', stats.claimedDonations);
  setEl('stat-total-inventory', stats.totalInventoryItems);

  const total = donations.length || 1;
  const avail = donations.filter(d => d.status === 'available').length;
  const claimed = donations.filter(d => d.status === 'claimed').length;
  const assigned = donations.filter(d => d.status === 'assigned').length;
  
  const circ = 100;
  const availPct = (avail / total) * circ;
  const claimedPct = (claimed / total) * circ;
  const assignedPct = (assigned / total) * circ;

  const availArc = document.getElementById('donut-available-arc');
  const claimedArc = document.getElementById('donut-claimed-arc');
  const assignedArc = document.getElementById('donut-assigned-arc');

  if (availArc) {
    availArc.style.strokeDasharray = `${availPct.toFixed(1)} ${(circ - availPct).toFixed(1)}`;
    availArc.style.strokeDashoffset = '25';
  }
  if (claimedArc) {
    const offset = 25 - availPct;
    claimedArc.style.strokeDasharray = `${claimedPct.toFixed(1)} ${(circ - claimedPct).toFixed(1)}`;
    claimedArc.style.strokeDashoffset = `${offset.toFixed(1)}`;
  }
  if (assignedArc) {
    const offset = 25 - availPct - claimedPct;
    assignedArc.style.strokeDasharray = `${assignedPct.toFixed(1)} ${(circ - assignedPct).toFixed(1)}`;
    assignedArc.style.strokeDashoffset = `${offset.toFixed(1)}`;
  }

  setEl('donut-center-val', donations.length);
  setEl('legend-available', avail);
  setEl('legend-claimed', claimed);
  setEl('legend-assigned', assigned);
}

// ── Users Table ────────────────────────────────────────────────────────────────
function loadUsersTable() {
  const users = getAllUsers().filter(u => u.role !== 'admin');
  const tbody = document.getElementById('admin-users-tbody');
  if (!tbody) return;
  if (users.length === 0) { tbody.innerHTML = emptyRow(7, 'No users registered yet.'); return; }
  tbody.innerHTML = users.map((u, i) => {
    const isBiz = u.role === 'business';
    const grad = avatarColor(u.id);
    return `<tr>
      <td style="color:var(--text-muted);font-size:0.78rem;">${i + 1}</td>
      <td><div style="display:flex;align-items:center;gap:0.65rem;">
        <div class="user-avatar-initial" style="background:${grad};">${initials(u.name)}</div>
        <div>
          <div style="font-weight:700;font-size:0.88rem;">${u.name}</div>
          <div style="font-size:0.72rem;color:var(--text-muted);">${u.email}</div>
        </div>
      </div></td>
      <td><span class="badge-pill ${isBiz ? 'amber' : 'cyan'}">${isBiz ? t('business') : t('recipient')}</span></td>
      <td style="color:var(--text-secondary);font-size:0.83rem;">${u.type || '—'}</td>
      <td style="color:var(--text-secondary);font-size:0.83rem;">${u.address || '—'}</td>
      <td style="color:var(--text-secondary);font-size:0.83rem;">${u.contact || '—'}</td>
      <td><code style="font-size:0.68rem;color:var(--text-muted);background:rgba(255,255,255,0.04);padding:0.15rem 0.4rem;border-radius:4px;">${u.id}</code></td>
    </tr>`;
  }).join('');
  setEl('admin-users-count', `${users.length} users`);
}

// ── Donations Table ────────────────────────────────────────────────────────────
function loadDonationsTable() {
  const donations = getAllDonations();
  const tbody = document.getElementById('admin-donations-tbody');
  if (!tbody) return;
  if (donations.length === 0) { tbody.innerHTML = emptyRow(8, 'No donations yet.'); return; }
  const statusMap = {
    available: ['green',  t('available')],
    claimed:   ['blue',   t('claimed')],
    assigned:  ['violet', t('statusAssigned')],
    expired:   ['red',    t('expired')],
  };
  tbody.innerHTML = donations.map((d, i) => {
    const [cls, label] = statusMap[d.status] || ['gray', d.status];
    return `<tr>
      <td style="color:var(--text-muted);font-size:0.78rem;">${i + 1}</td>
      <td><span style="font-weight:700;font-size:0.88rem;">${tName(d.name)}</span></td>
      <td><span class="badge-pill gray">${tCat(d.category || '')}</span></td>
      <td style="font-weight:600;">${d.quantity} <span style="color:var(--text-muted);font-size:0.75rem;">${tUnit(d.unit)}</span></td>
      <td><div style="font-weight:600;font-size:0.83rem;">${d.businessName || '—'}</div>
        <div style="font-size:0.7rem;color:var(--text-muted);">${d.businessAddress || ''}</div></td>
      <td style="font-size:0.82rem;color:var(--text-secondary);">${d.expiryDate || '—'}</td>
      <td><span class="badge-pill ${cls}">${label}</span></td>
      <td style="font-size:0.82rem;color:var(--text-secondary);">${d.distance || '—'}</td>
    </tr>`;
  }).join('');
  setEl('admin-donations-count', `${donations.length} total`);
}

// ── Claims Table ───────────────────────────────────────────────────────────────
function loadClaimsTable() {
  const donations = getAllDonations().filter(d => d.status === 'claimed' || d.status === 'assigned');
  const tbody = document.getElementById('admin-claims-tbody');
  if (!tbody) return;
  if (donations.length === 0) { tbody.innerHTML = emptyRow(7, 'No claims or active deliveries yet.'); return; }
  const flowMap = {
    assigned:  ['indigo', `🏎️ ${t('statusAssigned')}`],
    scheduled: ['violet', `📅 ${t('scheduled')}`],
    picked_up: ['cyan',   `📦 ${t('statusPickedUp')}`],
    on_the_way:['amber',  `🚚 ${t('statusOnWay')}`],
    delivered: ['green',  `✅ ${t('statusDelivered')}`],
  };
  
  tbody.innerHTML = donations.map((d, i) => {
    const currentStatus = d.statusFlow || 'assigned';
    const [cls, label] = flowMap[currentStatus] || ['gray', currentStatus];
    const driverName = d.assignedDriverName || 'Ramesh Kumar (Speedy Express)';
    const driverVehicle = d.assignedDriverVehicle || 'Motorbike Logistics';
    const driverContact = d.assignedDriverContact || '555-9011';
    
    const recipientName = d.claimedByName || 'NGO / Recipient';
    const recipientType = d.claimedUserType || 'Beneficiary';
    const recipientAddr = d.claimedUserAddress || 'User Residence';

    return `<tr>
      <td style="color:var(--text-muted);font-size:0.78rem;">${i + 1}</td>
      <td>
        <div style="font-weight:700;font-size:0.88rem;">${d.name}</div>
        <div style="font-size:0.72rem;color:var(--accent-ngo);font-weight:600;">${d.quantity} ${d.unit}</div>
      </td>
      <td>
        <div style="font-weight:600;font-size:0.83rem;">🏪 ${d.businessName || 'Green Meadows Grocer'}</div>
        <div style="font-size:0.7rem;color:var(--text-muted);">${d.businessAddress || 'Springfield'}</div>
      </td>
      <td>
        <div style="font-weight:700;font-size:0.83rem;color:var(--accent-business);">💚 ${recipientName}</div>
        <div style="font-size:0.72rem;color:var(--text-secondary);"><span class="badge-pill cyan" style="padding:0.1rem 0.4rem;font-size:0.65rem;">${recipientType}</span></div>
        <div style="font-size:0.7rem;color:var(--text-muted);">${recipientAddr}</div>
      </td>
      <td>
        <div style="font-weight:700;font-size:0.83rem;color:#a5b4fc;">🚴 ${driverName}</div>
        <div style="font-size:0.72rem;color:var(--text-secondary);">${driverVehicle} • 📞 ${driverContact}</div>
      </td>
      <td>
        <div style="display:flex;flex-direction:column;gap:0.3rem;">
          <span class="badge-pill ${cls}">${label}</span>
          <select class="admin-status-select form-input" data-donation-id="${d.id}" style="padding:0.2rem 0.5rem;font-size:0.72rem;width:100%;">
            <option value="assigned" ${currentStatus === 'assigned' ? 'selected' : ''}>Driver Assigned</option>
            <option value="picked_up" ${currentStatus === 'picked_up' ? 'selected' : ''}>Picked Up</option>
            <option value="on_the_way" ${currentStatus === 'on_the_way' ? 'selected' : ''}>On the Way to User</option>
            <option value="delivered" ${currentStatus === 'delivered' ? 'selected' : ''}>Delivered to User</option>
          </select>
        </div>
      </td>
    </tr>`;
  }).join('');
  
  setEl('admin-claims-count', `${donations.length} claims`);

  // Bind change handlers for status update
  tbody.querySelectorAll('.admin-status-select').forEach(select => {
    select.onchange = (e) => {
      const donId = e.target.dataset.donationId;
      const newStatus = e.target.value;
      import('./db.js').then(dbModule => {
        dbModule.updateClaimStatus(donId, newStatus);
        showToast('Delivery Updated', `Delivery status updated to ${newStatus.replace('_', ' ')}.`, 'admin');
        loadClaimsTable();
        loadOverview();
      });
    };
  });
}

// ── Partner Verification Cards ─────────────────────────────────────────────────
function loadPartnersCards() {
  const partners = getDeliveryPartners();
  const grid = document.getElementById('admin-partners-grid');
  if (!grid) return;

  if (partners.length === 0) {
    grid.innerHTML = `<div class="admin-empty-state" style="grid-column:1/-1;">
      <i data-lucide="truck"></i><p>No delivery partners registered yet.</p>
    </div>`;
    if (window.lucide) window.lucide.createIcons();
    setEl('admin-partners-count', '0 registered');
    setEl('tc-partners', 0);
    return;
  }

  grid.innerHTML = partners.map(p => {
    const verified = !!p.isVerified;
    const grad = avatarColor(p.id);
    return `<div class="partner-vcard ${verified ? 'verified' : 'unverified'}" data-partner-id="${p.id}">
      <div class="partner-vcard-header">
        <div class="partner-avatar" style="background:${grad};">${initials(p.name)}</div>
        <div>
          <div class="partner-vcard-name">${p.name}</div>
          <div class="partner-vcard-sub">${p.email}</div>
        </div>
        <div style="margin-left:auto;">
          ${verified ? '<span class="badge-pill green">Verified</span>' : '<span class="badge-pill amber">Pending</span>'}
        </div>
      </div>
      <div class="partner-vcard-meta">
        <div class="pmeta-item">
          <div class="pmeta-label">Vehicle</div>
          <div class="pmeta-value">${p.vehicleType || p.type || 'Logistics'}</div>
        </div>
        <div class="pmeta-item">
          <div class="pmeta-label">Contact</div>
          <div class="pmeta-value">${p.contact || '—'}</div>
        </div>
        <div class="pmeta-item">
          <div class="pmeta-label">Govt ID</div>
          <div class="pmeta-value" style="color:var(--accent-business);font-family:monospace;font-size:0.78rem;">${p.govtId || 'Submitted'}</div>
        </div>
        <div class="pmeta-item">
          <div class="pmeta-label">License No.</div>
          <div class="pmeta-value" style="color:#a5b4fc;font-family:monospace;font-size:0.78rem;">${p.licenseNo || 'Submitted'}</div>
        </div>
      </div>
      <div class="partner-vcard-footer">
        <button class="btn btn-sm ${verified ? 'btn-secondary' : 'btn-primary-business'} btn-toggle-verify"
                data-id="${p.id}" data-verified="${verified}" style="flex:1;">
          ${verified ? 'Revoke Approval' : 'Verify & Approve'}
        </button>
      </div>
    </div>`;
  }).join('');

  setEl('admin-partners-count', `${partners.length} registered`);
  setEl('tc-partners', partners.length);

  grid.querySelectorAll('.btn-toggle-verify').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const was = btn.dataset.verified === 'true';
      verifyDeliveryPartner(id, !was);
      showToast(
        was ? 'Approval Revoked' : 'Partner Approved',
        was ? 'Partner suspended from assignments.' : 'Partner verified and cleared for pickups.',
        was ? 'warning' : 'success'
      );
      loadPartnersCards();
      loadOverview();
      updateTabCounts();
      if (window.lucide) window.lucide.createIcons();
    };
  });

  if (window.lucide) window.lucide.createIcons();
}

// ── Global search filter ───────────────────────────────────────────────────────
window.filterAdminTable = function(input, tbodyId) {
  const q = input.value.toLowerCase();
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.querySelectorAll('tr').forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
function emptyRow(cols, msg) {
  return `<tr><td colspan="${cols}" style="text-align:center;padding:3rem 1rem;color:var(--text-muted);font-size:0.875rem;">${msg}</td></tr>`;
}
