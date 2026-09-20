import { getDeliveriesForPartner, updateDeliveryStatus } from './db.js';
import { showToast } from './toast.js';
import { t, tCat, tUnit, tName } from './i18n.js';

let currentPartnerUser = null;

export function initDeliveryDashboard(user) {
  currentPartnerUser = user;

  // Header and verification status setup
  const welcomeName = document.getElementById('delivery-partner-welcome');
  if (welcomeName) welcomeName.textContent = `${t('welcome')}, ${user.name}`;

  const statusBadge = document.getElementById('delivery-verification-badge');
  if (statusBadge) {
    if (user.isVerified) {
      statusBadge.className = 'verification-badge verified';
      statusBadge.innerHTML = `<i data-lucide="check-circle"></i> ${t('verifiedPartner')} (Govt ID: ${user.govtId || 'Approved'} | DL: ${user.licenseNo || 'Verified'})`;
    } else {
      statusBadge.className = 'verification-badge pending';
      statusBadge.innerHTML = `<i data-lucide="clock"></i> ${t('verificationPending')} (DL: ${user.licenseNo || 'Pending'})`;
    }
  }

  // Render stats and active deliveries
  renderDeliveryStats();
  renderDeliveriesList();

  if (window.lucide) window.lucide.createIcons();
}

function renderDeliveryStats() {
  const deliveries = getDeliveriesForPartner(currentPartnerUser.id);
  const activeCount = deliveries.filter(d => d.statusFlow === 'scheduled' || d.statusFlow === 'accepted' || d.statusFlow === 'picked_up').length;
  const completedCount = deliveries.filter(d => d.statusFlow === 'delivered' || d.status === 'delivered').length;

  const elActive = document.getElementById('stat-delivery-active');
  const elCompleted = document.getElementById('stat-delivery-completed');
  if (elActive) elActive.textContent = activeCount;
  if (elCompleted) elCompleted.textContent = completedCount;
}

function renderDeliveriesList() {
  const container = document.getElementById('delivery-orders-list');
  if (!container) return;

  const deliveries = getDeliveriesForPartner(currentPartnerUser.id);

  if (deliveries.length === 0) {
    container.innerHTML = `
      <div class="card-glass text-center" style="padding: 3rem 1.5rem;">
        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🛵</div>
        <h3 style="font-size: 1.1rem; margin-bottom: 0.25rem;">No Assigned Deliveries</h3>
        <p style="font-size: 0.85rem; color: var(--text-muted);">
          When an NGO or recipient claims food, active delivery tasks will appear here automatically.
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = deliveries.map(d => {
    const isPickedUp = d.statusFlow === 'picked_up';
    const isDelivered = d.statusFlow === 'delivered' || d.status === 'delivered';
    const isAccepted = d.statusFlow === 'accepted';

    let statusBadgeHtml = `<span class="admin-badge badge-scheduled">📅 ${t('scheduled')}</span>`;
    if (isAccepted) statusBadgeHtml = `<span class="admin-badge badge-scheduled">🚴 ${t('statusAccepted')}</span>`;
    if (isPickedUp) statusBadgeHtml = `<span class="admin-badge badge-pickedup">🚚 ${t('statusPickedUp')}</span>`;
    if (isDelivered) statusBadgeHtml = `<span class="admin-badge badge-available">✅ ${t('statusDelivered')}</span>`;

    return `
      <div class="card-glass delivery-order-card" style="padding: 1.25rem; margin-bottom: 1rem; border-left: 4px solid ${isDelivered ? '#10b981' : isPickedUp ? '#0ea5e9' : '#6366f1'};">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
          <div>
            <h3 style="font-size: 1.1rem; margin: 0; font-weight: 700;">${tName(d.name)}</h3>
            <span style="font-size: 0.8rem; color: var(--text-muted);">${d.quantity} ${tUnit(d.unit)} · ${t('category')}: ${tCat(d.category || 'Food')}</span>
          </div>
          <div>${statusBadgeHtml}</div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; background: rgba(255,255,255,0.02); border: 1px solid var(--border-glass); border-radius: 8px; padding: 0.75rem; margin-bottom: 1rem; font-size: 0.82rem;">
          <div>
            <div style="color: var(--text-muted); font-size: 0.72rem; text-transform: uppercase; font-weight: 700; margin-bottom: 0.2rem;">📍 1. ${t('pickupSpot')}</div>
            <strong style="color: var(--text-primary); font-size: 0.9rem;">${d.businessName || 'Merchant'}</strong>
            <div style="color: var(--text-secondary); font-size: 0.78rem;">${d.businessAddress || 'Address unavailable'}</div>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.72rem; text-transform: uppercase; font-weight: 700; margin-bottom: 0.2rem;">🏡 2. ${t('claimedBy')}</div>
            <strong style="color: var(--text-primary); font-size: 0.9rem;">${d.claimedByName || 'Recipient'}</strong>
            <div style="color: var(--text-secondary); font-size: 0.78rem;">${t('window')}: ${d.pickupTime ? d.pickupTime.replace('T', ' ') : 'Immediate'}</div>
          </div>
        </div>

        ${!isDelivered ? `
          <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
            ${!isAccepted && !isPickedUp ? `
              <button class="btn btn-sm btn-primary-business btn-accept-delivery" data-id="${d.id}">
                <i data-lucide="check"></i> ${t('acceptMission')}
              </button>
            ` : ''}
            ${(isAccepted || !isPickedUp) ? `
              <button class="btn btn-sm btn-primary-ngo btn-pickup-delivery" data-id="${d.id}">
                <i data-lucide="package-check"></i> ${t('confirmPickedUp')}
              </button>
            ` : ''}
            ${isPickedUp ? `
              <button class="btn btn-sm btn-primary-business btn-complete-delivery" data-id="${d.id}" style="background: linear-gradient(135deg, #10b981, #059669);">
                <i data-lucide="check-circle-2"></i> ${t('statusDelivered')}
              </button>
            ` : ''}
          </div>
        ` : `
          <div style="font-size: 0.8rem; color: #10b981; font-weight: 600; text-align: right;">
            ✅ ${t('statusDelivered')}
          </div>
        `}
      </div>
    `;
  }).join('');

  // Attach button event listeners
  container.querySelectorAll('.btn-accept-delivery').forEach(btn => {
    btn.onclick = () => handleStatusChange(btn.dataset.id, 'accepted', 'Accepted delivery order. Heading to merchant.');
  });

  container.querySelectorAll('.btn-pickup-delivery').forEach(btn => {
    btn.onclick = () => handleStatusChange(btn.dataset.id, 'picked_up', 'Food picked up from merchant! In transit to recipient.');
  });

  container.querySelectorAll('.btn-complete-delivery').forEach(btn => {
    btn.onclick = () => handleStatusChange(btn.dataset.id, 'delivered', 'Delivery completed successfully! Food safely handed over.');
  });
}

function handleStatusChange(donationId, statusFlow, toastMsg) {
  updateDeliveryStatus(donationId, statusFlow);
  showToast('Delivery Updated', toastMsg, 'success');
  renderDeliveryStats();
  renderDeliveriesList();
  if (window.lucide) window.lucide.createIcons();
}
