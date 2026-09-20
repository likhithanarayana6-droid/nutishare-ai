// Standalone Toast Notification System for NutriShare AI

export function showToast(title, message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  
  // Decide target CSS classes based on role/type
  let typeClass = '';
  let iconName = 'check-circle';
  
  if (type === 'ngo') {
    typeClass = 'toast-ngo';
    iconName = 'heart';
  } else if (type === 'error') {
    typeClass = 'toast-error';
    iconName = 'x-circle';
  } else if (type === 'warning') {
    typeClass = 'toast-warning';
    iconName = 'alert-triangle';
  }

  toast.className = `toast ${typeClass}`.trim();
  
  toast.innerHTML = `
    <div class="toast-icon">
      <i data-lucide="${iconName}"></i>
    </div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close">
      <i data-lucide="x"></i>
    </button>
  `;

  container.appendChild(toast);
  
  // Create icons for this specific toast
  if (window.lucide) {
    window.lucide.createIcons({
      nameAttr: 'data-lucide'
    });
  }

  // Handle manual dismiss close button
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    removeToast(toast);
  });

  // Auto-remove after 4 seconds
  const autoTimeout = setTimeout(() => {
    removeToast(toast);
  }, 4000);

  function removeToast(el) {
    clearTimeout(autoTimeout);
    el.style.animation = 'toastFadeOut 0.3s forwards';
    el.addEventListener('animationend', (e) => {
      if (e.animationName === 'toastFadeOut') {
        el.remove();
      }
    });
  }
}
