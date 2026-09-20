import { 
  getInventory, 
  addInventoryItem, 
  bulkAddInventory, 
  donateInventoryItem, 
  getAiPredictions,
  lookupBarcode,
  lookupBarcodeAsync,
  syncPosInventory,
  runFastApiBatchPredictions
} from './db.js';
// BrowserMultiFormatReader provided by ZXing CDN (global ZXing)
import { showToast } from './toast.js';
import { t, tCat, tUnit, tName, tBizName } from './i18n.js';

let activeChart = null;
let currentBusinessId = null;
let currentBusinessProfile = null;
let parsedCsvData = null;

// Scanner state
let zxingReader = null;
let scannerActive = false;
let lastScannedCode = null;
let lastScannedAt = 0;
let pendingScannedProduct = null; // holds {name, category, unit, defaultQty, barcode} after a scan
let isLookingUp = false; // debounce API lookups

// Initialize Business Page Controller
export function initBusinessDashboard(user) {
  currentBusinessId = user.id;
  currentBusinessProfile = user;
  
  // Set welcome message
  document.getElementById('biz-welcome').textContent = `${t('welcome')}, ${tBizName(user.name)}`;
  
  // Set up forms & event listeners
  setupInventoryForm();
  setupCsvUpload();
  setupBarcodeScanner();
  setupDonationModal();
  setupDeliveryPartners();
  setupPosIntegration();
  setupFastApiSimulator();
  
  // Render views
  renderInventory();
  renderAiPredictions();

  // Hook category filter (must be after DOM is ready, not at module level)
  document.getElementById('inventory-filter-cat').addEventListener('change', renderInventory);

  // Handle Tab Navigation inside Business Dashboard
  const btnInventory = document.getElementById('biz-tab-inventory');
  const btnAi = document.getElementById('biz-tab-ai');
  const sectionInventory = document.getElementById('biz-sub-inventory');
  const sectionAi = document.getElementById('biz-sub-ai');

  btnInventory.addEventListener('click', () => {
    btnInventory.classList.add('active');
    btnAi.classList.remove('active');
    sectionInventory.classList.remove('d-none');
    sectionAi.classList.add('d-none');
    renderInventory();
  });

  btnAi.addEventListener('click', () => {
    btnAi.classList.add('active');
    btnInventory.classList.remove('active');
    sectionAi.classList.remove('d-none');
    sectionInventory.classList.add('d-none');
    renderAiPredictions();
  });

  // Reorder Checklist trigger
  document.getElementById('btn-reorder-checked').addEventListener('click', () => {
    const checkedItems = document.querySelectorAll('#ai-reorder-list input[type="checkbox"]:checked');
    if (checkedItems.length === 0) {
      showToast('No Items Selected', 'Please select at least one item to reorder.', 'warning');
      return;
    }
    const names = Array.from(checkedItems).map(el => el.value);
    showToast('Order Invoice Generated', `Vendor reorder invoice generated for:\n- ${names.join('\n- ')}\n\nDelivery scheduled in 48 hours.`, 'success');
    checkedItems.forEach(el => {
      el.checked = false;
    });
  });
}


// --- 1. Manual Inventory Form ---
function setupInventoryForm() {
  const form = document.getElementById('form-manual-entry');
  // Set default date picker to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 3);
  document.getElementById('inv-expiry').value = tomorrow.toISOString().split('T')[0];

  form.onsubmit = (e) => {
    e.preventDefault();
    const name = document.getElementById('inv-name').value.trim();
    const category = document.getElementById('inv-category').value;
    const quantity = document.getElementById('inv-quantity').value;
    const unit = document.getElementById('inv-unit').value;
    const expiryDate = document.getElementById('inv-expiry').value;
    const perishabilityRisk = document.getElementById('inv-perishability') ? document.getElementById('inv-perishability').value : 'Medium';
    const storageRequirement = document.getElementById('inv-storage') ? document.getElementById('inv-storage').value : 'Ambient (15-25°C)';

    try {
      addInventoryItem(currentBusinessId, { name, category, quantity, unit, expiryDate, perishabilityRisk, storageRequirement });
      form.reset();
      document.getElementById('inv-expiry').value = tomorrow.toISOString().split('T')[0];
      
      // Flash message & Refresh
      showToast('Product Added', `Successfully added ${name} (${perishabilityRisk} Risk, ${storageRequirement}) to inventory.`, 'success');
      renderInventory();
    } catch (err) {
      showToast('Error Adding Product', err.message, 'error');
    }
  };

  // Add sub-tabs toggling (Manual, CSV, Barcode, POS)
  const tabManual = document.getElementById('add-tab-manual');
  const tabCsv = document.getElementById('add-tab-csv');
  const tabScan = document.getElementById('add-tab-scan');
  const tabPos = document.getElementById('add-tab-pos');

  const formManual = document.getElementById('form-manual-entry');
  const sectionCsv = document.getElementById('section-csv-upload');
  const sectionScan = document.getElementById('section-barcode-scan');

  tabManual.addEventListener('click', () => {
    tabManual.classList.add('active');
    tabCsv.classList.remove('active');
    tabScan.classList.remove('active');
    if (tabPos) tabPos.classList.remove('active');
    formManual.classList.remove('d-none');
    sectionCsv.classList.add('d-none');
    sectionScan.classList.add('d-none');
  });

  tabCsv.addEventListener('click', () => {
    tabCsv.classList.add('active');
    tabManual.classList.remove('active');
    tabScan.classList.remove('active');
    if (tabPos) tabPos.classList.remove('active');
    sectionCsv.classList.remove('d-none');
    formManual.classList.add('d-none');
    sectionScan.classList.add('d-none');
  });

  tabScan.addEventListener('click', () => {
    tabScan.classList.add('active');
    tabManual.classList.remove('active');
    tabCsv.classList.remove('active');
    if (tabPos) tabPos.classList.remove('active');
    sectionScan.classList.remove('d-none');
    formManual.classList.add('d-none');
    sectionCsv.classList.add('d-none');
    if (!scannerActive) startScanner();
  });

  if (tabPos) {
    tabPos.addEventListener('click', () => {
      const modal = document.getElementById('modal-pos-integration');
      if (modal) modal.classList.remove('d-none');
    });
  }
}

function setupPosIntegration() {
  const modal = document.getElementById('modal-pos-integration');
  const btnCloseModal = document.getElementById('btn-close-pos-modal');
  const btnTriggerSync = document.getElementById('btn-trigger-pos-sync');
  const btnCopyUrl = document.getElementById('btn-copy-pos-url');
  const terminal = document.getElementById('pos-sync-terminal');

  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', () => modal.classList.add('d-none'));
  }
  if (btnCopyUrl) {
    btnCopyUrl.addEventListener('click', () => {
      const urlInput = document.getElementById('pos-endpoint-url');
      if (urlInput) {
        navigator.clipboard.writeText(urlInput.value);
        showToast('Copied', 'POS Endpoint Webhook URL copied to clipboard!', 'success');
      }
    });
  }
  if (btnTriggerSync) {
    btnTriggerSync.addEventListener('click', () => {
      const provider = document.getElementById('pos-provider-select').value;
      terminal.classList.remove('d-none');
      terminal.innerHTML = `<div>[${new Date().toLocaleTimeString()}] POS WEBHOOK RECEIVED: Provider=${provider}</div><div>[PROCESSING] Ingesting real-time sales & inventory items...</div>`;
      
      const posData = {
        businessId: currentBusinessId,
        items: [
          { name: `${provider} Organic Avocados`, category: 'Produce', quantity: 20, unit: 'kg', daysToExpiry: 3, perishabilityRisk: 'High', storageRequirement: 'Cold Storage (2-4°C)' },
          { name: `${provider} Artisan Sourdough`, category: 'Bakery', quantity: 15, unit: 'units', daysToExpiry: 2, perishabilityRisk: 'Medium', storageRequirement: 'Ambient (15-25°C)' }
        ]
      };
      
      setTimeout(() => {
        const res = syncPosInventory(posData);
        terminal.innerHTML += `<div>[SUCCESS] HTTP 200 OK — Synced ${res.itemCount} inventory items from ${provider} POS.</div>`;
        showToast('POS Webhook Synced', `Received 2 new inventory items from ${provider} POS!`, 'success');
        renderInventory();
        renderAiPredictions();
      }, 600);
    });
  }
}

function setupFastApiSimulator() {
  const btnRun = document.getElementById('btn-run-fastapi-batch');
  const btnSwagger = document.getElementById('btn-view-openapi-spec');
  const terminal = document.getElementById('fastapi-log-terminal');

  if (btnRun) {
    btnRun.addEventListener('click', () => {
      terminal.innerHTML = `<div>[EXECUTING] Running Prophet + LSTM Batch Scoring Job...</div>`;
      setTimeout(() => {
        const res = runFastApiBatchPredictions(currentBusinessId);
        terminal.innerHTML = res.logs.map(l => `<div>${l}</div>`).join('');
        showToast('FastAPI Model Execution Finished', `Batch waste prediction scoring completed in ${res.executionTimeMs}ms (R² = ${res.r2Score})`, 'success');
        renderAiPredictions();
      }, 700);
    });
  }

  if (btnSwagger) {
    btnSwagger.addEventListener('click', () => {
      const docsModal = document.getElementById('modal-system-docs');
      if (docsModal) {
        docsModal.classList.remove('d-none');
        document.getElementById('doc-tab-api').click();
      }
    });
  }
}

// --- 2. CSV Bulk Uploader ---
function setupCsvUpload() {
  const dropzone = document.getElementById('csv-dropzone');
  const fileInput = document.getElementById('csv-file-input');
  const uploadBtn = document.getElementById('csv-upload-btn');
  const filenameText = document.getElementById('csv-filename');

  dropzone.addEventListener('click', (e) => {
    if (e.target !== fileInput) {
      fileInput.click();
    }
  });
  
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleCsvFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleCsvFile(e.target.files[0]);
    }
  });

  function handleCsvFile(file) {
    if (!file.name.endsWith('.csv')) {
      showToast('Invalid File', 'Please upload a valid CSV file.', 'warning');
      return;
    }
    filenameText.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      parseCSV(text);
    };
    reader.readAsText(file);
  }

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) {
      showToast('Empty CSV', 'CSV is empty or missing content.', 'warning');
      return;
    }
    
    // Parse headers
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    // Check mapping
    const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('product') || h.includes('title'));
    const qtyIdx = headers.findIndex(h => h.includes('qty') || h.includes('quantity') || h.includes('amount'));
    const expIdx = headers.findIndex(h => h.includes('expiry') || h.includes('date') || h.includes('exp'));
    const catIdx = headers.findIndex(h => h.includes('cat') || h.includes('type'));
    const unitIdx = headers.findIndex(h => h.includes('unit'));

    if (nameIdx === -1 || qtyIdx === -1 || expIdx === -1) {
      showToast('Invalid Format', 'CSV columns must include: Name, Quantity, and Expiry Date.', 'warning');
      return;
    }

    const items = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      if (cols.length < headers.length) continue;
      
      const item = {
        name: cols[nameIdx],
        quantity: parseFloat(cols[qtyIdx]) || 1,
        expiryDate: cols[expIdx],
        category: catIdx !== -1 ? cols[catIdx] : 'Other',
        unit: unitIdx !== -1 ? cols[unitIdx] : 'units'
      };

      // Basic Date Normalization
      // In case date is formatted differently, try to parse it
      try {
        const d = new Date(item.expiryDate);
        if (!isNaN(d.getTime())) {
          item.expiryDate = d.toISOString().split('T')[0];
        }
      } catch (err) {}

      items.push(item);
    }

    if (items.length === 0) {
      showToast('No Valid Rows', 'No valid rows parsed from CSV.', 'warning');
      return;
    }

    parsedCsvData = items;
    uploadBtn.disabled = false;
    filenameText.innerHTML = `<span class="text-success" style="font-weight:700;"><i data-lucide="check"></i> Ready to import ${items.length} items!</span>`;
    lucide.createIcons();
  }

  uploadBtn.onclick = () => {
    if (!parsedCsvData) return;
    try {
      bulkAddInventory(currentBusinessId, parsedCsvData);
      showToast('Import Successful', `Successfully imported ${parsedCsvData.length} items to inventory!`, 'success');
      parsedCsvData = null;
      uploadBtn.disabled = true;
      filenameText.textContent = 'Drag & Drop CSV File here or Click to Browse';
      fileInput.value = '';
      renderInventory();
    } catch (err) {
      showToast('Import Error', err.message, 'error');
    }
  };
}

// --- 3. Real Barcode & QR Scanner (ZXing) ---
function setupBarcodeScanner() {
  const btnStart   = document.getElementById('btn-start-scan');
  const btnStop    = document.getElementById('btn-stop-scan');
  const manualInput  = document.getElementById('manual-barcode-input');
  const manualLookup = document.getElementById('btn-manual-barcode-lookup');

  // Default expiry 5 days from now
  const fiveDays = new Date();
  fiveDays.setDate(fiveDays.getDate() + 5);
  document.getElementById('scan-expiry').value = fiveDays.toISOString().split('T')[0];

  // Start scanning
  btnStart.addEventListener('click', () => startScanner());

  // Stop scanning
  btnStop.addEventListener('click', () => stopScanner());

  // Manual lookup
  manualLookup.addEventListener('click', () => {
    const code = manualInput.value.trim();
    if (!code) return;
    handleDetectedCode(code);
  });
  manualInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = manualInput.value.trim();
      if (code) handleDetectedCode(code);
    }
  });

  // Make demo codes clickable
  document.querySelectorAll('.manual-barcode-entry code').forEach(el => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => {
      manualInput.value = el.textContent;
      handleDetectedCode(el.textContent);
    });
  });

  // Add-to-inventory button from scan result
  document.getElementById('btn-add-scanned-item').addEventListener('click', () => {
    if (!pendingScannedProduct) return;
    const name = document.getElementById('scan-name-input').value.trim();
    const qty = parseFloat(document.getElementById('scan-qty').value);
    const unit = document.getElementById('scan-unit').value.trim() || 'units';
    const expiry = document.getElementById('scan-expiry').value;

    if (!name) {
      showToast('Name Required', 'Please enter a product name.', 'warning');
      return;
    }
    if (!qty || qty <= 0) {
      showToast('Quantity Invalid', 'Please enter a valid quantity.', 'warning');
      return;
    }
    try {
      const name = document.getElementById('scan-name-input').value.trim();
      if (!name) throw new Error("Please enter a valid product name.");
      
      const qty  = document.getElementById('scan-qty').value;
      const unit = document.getElementById('scan-unit').value;
      let exp  = document.getElementById('scan-expiry').value;

      if (!exp) {
        exp = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }

      addInventoryItem(currentBusinessId, {
        name,
        category: pendingScannedProduct.category,
        quantity: qty,
        unit,
        expiryDate: exp
      });

      // Reset scanner result UI
      document.getElementById('scan-result-card').classList.add('d-none');
      pendingScannedProduct = null;
      lastScannedCode = null;
      setScannerStatus('active', 'Scanning… point at next barcode');

      showToast('Product Added', `Successfully added ${name} to inventory.`, 'success');
      renderInventory();
    } catch (err) {
      showToast('Error Adding Product', err.message, 'error');
    }
  });

  // When user switches AWAY from the barcode tab, stop the scanner
  document.getElementById('add-tab-manual').addEventListener('click', stopScanner);
  document.getElementById('add-tab-csv').addEventListener('click', stopScanner);

  // Handle Photo / Image Upload barcode decoding
  const bizFileInput = document.getElementById('biz-file-input');
  if (bizFileInput) {
    bizFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      setScannerStatus('active', 'Processing uploaded barcode image…');
      const imgUrl = URL.createObjectURL(file);
      let decodedText = null;

      // 1. Try native BarcodeDetector API if available
      if ('BarcodeDetector' in window) {
        try {
          const detector = new window.BarcodeDetector({ formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'upc_a', 'upc_e'] });
          const imgElement = new Image();
          imgElement.src = imgUrl;
          await imgElement.decode();
          const results = await detector.detect(imgElement);
          if (results && results.length > 0) {
            decodedText = results[0].rawValue;
          }
        } catch (err) {
          console.warn('Native BarcodeDetector notice:', err);
        }
      }

      // 2. Fallback to ZXing decodeFromImageUrl
      if (!decodedText) {
        if (!zxingReader && window.ZXing && window.ZXing.BrowserMultiFormatReader) {
          try { zxingReader = new window.ZXing.BrowserMultiFormatReader(); } catch (_) {}
        }
        if (zxingReader) {
          try {
            const result = await zxingReader.decodeFromImageUrl(imgUrl);
            if (result) decodedText = result.getText();
          } catch (err) {
            console.warn('ZXing image decode notice:', err);
          }
        }
      }

      URL.revokeObjectURL(imgUrl);

      if (decodedText) {
        setScannerStatus('idle', `Barcode detected: ${decodedText}`);
        handleDetectedCode(decodedText);
      } else {
        setScannerStatus('error', 'Could not detect barcode from image. Try manual code or demo codes below!');
        showToast('Scan Notice', 'Barcode not detected in image. Try typing code or using demo codes!', 'warning');
      }
      bizFileInput.value = '';
    });
  }
}

// Also stop when user switches to a different dashboard tab
function stopScannerOnTabSwitch() {
  stopScanner();
}

function setScannerStatus(state, text) {
  const dot  = document.getElementById('scanner-status-dot');
  const label = document.getElementById('scanner-status-text');
  if (!dot || !label) return;
  dot.className = `scanner-dot ${state}`;
  label.textContent = text;
}

async function startScanner() {
  const video   = document.getElementById('scanner-video');
  const overlay = document.getElementById('scanner-overlay');
  const btnStart = document.getElementById('btn-start-scan');
  const btnStop  = document.getElementById('btn-stop-scan');
  const cameraSelect = document.getElementById('biz-camera-select');

  setScannerStatus('idle', 'Initializing camera…');
  if (overlay) {
    overlay.style.display = 'flex';
    overlay.textContent = 'Requesting camera access…';
  }

  // Check MediaDevices support (requires HTTPS or localhost)
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (overlay) {
      overlay.style.display = 'flex';
      overlay.innerHTML = `<div class="text-center" style="padding:1rem;">
        <div style="font-size:1.5rem; margin-bottom:0.4rem;">🔒</div>
        <div style="font-weight:700; font-size:0.85rem;">HTTPS Required for Camera</div>
        <div style="font-size:0.72rem; color:var(--text-secondary); margin-top:0.3rem;">
          Open <strong>https://nutrishare-ai-platform.surge.sh</strong> (not http://) or use photo upload below!
        </div>
      </div>`;
    }
    setScannerStatus('error', 'Camera requires HTTPS context');
    return;
  }

  try {
    // Stop any existing ZXing session & video stream
    if (zxingReader) { try { zxingReader.reset(); } catch (_) {} }
    if (video && video.srcObject) {
      video.srcObject.getTracks().forEach(t => t.stop());
      video.srcObject = null;
    }

    // ---- Acquire camera stream via getUserMedia directly ----
    // We do NOT use ZXing's decodeFromVideoDevice because it internally
    // applies facingMode:environment which causes OverconstrainedError on desktop webcams.
    let stream;
    const selectedId = cameraSelect && cameraSelect.value && cameraSelect.value.trim();
    try {
      if (selectedId) {
        // User picked a specific device — use exact deviceId
        stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: selectedId } } });
      } else {
        // Prefer back camera on phones, but ideal (not exact) so desktop webcams still work
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
      }
    } catch (_) {
      // Last resort: open any camera with zero constraints
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
    }

    // Attach stream to <video> element
    if (!video) throw new Error('Video element not found');
    video.srcObject = stream;
    video.setAttribute('playsinline', 'true');
    video.muted = true;
    await video.play();

    // Populate device dropdown (labels only available after getUserMedia permission granted)
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter(d => d.kind === 'videoinput');
      if (cams.length > 0 && cameraSelect) {
        cameraSelect.innerHTML = cams.map((d, i) =>
          `<option value="${d.deviceId}">${d.label || 'Camera ' + (i + 1)}</option>`
        ).join('');
      }
    } catch (_) {}

    // Init ZXing reader if not already done
    if (!zxingReader && window.ZXing && window.ZXing.BrowserMultiFormatReader) {
      try { zxingReader = new window.ZXing.BrowserMultiFormatReader(); } catch (_) {}
    }

    setScannerStatus('active', 'Scanner active — point camera at a barcode');
    if (overlay) overlay.style.display = 'none';
    if (btnStart) btnStart.classList.add('d-none');
    if (btnStop) btnStop.classList.remove('d-none');
    scannerActive = true;

    // Use decodeFromVideoElement — we already own the stream so ZXing applies NO device constraints
    if (zxingReader && video) {
      zxingReader.decodeFromVideoElement(video, (result) => {
        if (!result) return;
        const code = result.getText();
        const now = Date.now();
        if (code === lastScannedCode && now - lastScannedAt < 3000) return;
        if (code !== lastScannedCode) isLookingUp = false;
        lastScannedCode = code;
        lastScannedAt = now;
        handleDetectedCode(code);
      });
    }

  } catch (err) {
    console.error('Camera start error:', err);
    scannerActive = false;
    if (btnStart) btnStart.classList.remove('d-none');
    if (btnStop) btnStop.classList.add('d-none');

    const isPermDenied = err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
    if (overlay) {
      overlay.style.display = 'flex';
      overlay.innerHTML = `<div class="text-center" style="padding:1rem;">
        <div style="font-size:1.5rem; margin-bottom:0.4rem;">📷</div>
        <div style="font-weight:700; font-size:0.85rem;">${isPermDenied ? 'Camera Permission Needed' : 'Camera Stream Notice'}</div>
        <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.3rem; max-width:300px; margin-left:auto; margin-right:auto;">
          ${isPermDenied
            ? 'Click the <strong>🔒 Lock icon</strong> in your browser address bar → Camera → <strong>Allow</strong>, then reload!'
            : 'Use 📷 <strong>Upload Photo</strong> below or click a Quick Demo code to test the scanner!'}
        </div>
      </div>`;
    }
    setScannerStatus('error', isPermDenied ? 'Camera permission needed' : 'Use photo upload or demo codes');
  }
}

function stopScanner() {
  if (zxingReader) {
    try {
      zxingReader.reset();
    } catch (_) {}
  }
  scannerActive = false;
  const video    = document.getElementById('scanner-video');
  const overlay  = document.getElementById('scanner-overlay');
  const btnStart = document.getElementById('btn-start-scan');
  const btnStop  = document.getElementById('btn-stop-scan');

  if (video && video.srcObject) {
    video.srcObject.getTracks().forEach(t => t.stop());
    video.srcObject = null;
  }

  if (overlay) { 
    overlay.style.display = 'flex'; 
    overlay.textContent = 'Scanner stopped. Click Start Live Camera to begin.'; 
  }
  if (btnStart) btnStart.classList.remove('d-none');
  if (btnStop) btnStop.classList.add('d-none');
  setScannerStatus('idle', 'Scanner stopped');
}

async function handleDetectedCode(code) {
  if (isLookingUp) return;
  isLookingUp = true;

  const resultCard    = document.getElementById('scan-result-card');
  const resultCode    = document.getElementById('scan-result-code');
  const resultProduct = document.getElementById('scan-result-product');
  const resultUnknown = document.getElementById('scan-result-unknown');
  const flashEl       = document.getElementById('scanner-success-flash');
  const autoAddCheckbox = document.getElementById('scan-auto-add');
  const isAutoAdd = autoAddCheckbox ? autoAddCheckbox.checked : true;

  // Green flash on viewfinder
  if (flashEl) {
    flashEl.classList.remove('d-none');
    setTimeout(() => flashEl.classList.add('d-none'), 450);
  }

  // Show loading card immediately
  if (resultCode) resultCode.textContent = code;
  if (resultCard) resultCard.classList.remove('d-none');
  if (resultProduct) resultProduct.classList.remove('d-none');
  if (resultUnknown) resultUnknown.classList.add('d-none');
  if (resultProduct) resultProduct.innerHTML = `
    <div style="grid-column:1/-1;display:flex;align-items:center;gap:0.75rem;padding:0.5rem 0;">
      <div class="scan-spinner"></div>
      <div>
        <div style="font-size:0.85rem;font-weight:600;">Barcode: <code style="color:var(--accent-business);">${code}</code></div>
        <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.1rem;">Looking up on Open Food Facts…</div>
      </div>
    </div>
  `;
  setScannerStatus('idle', `Looking up ${code}…`);
  if (resultCard) resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  let product = null;

  try {
    // Step 1 & 2: Local catalog + Open Food Facts
    product = await lookupBarcodeAsync(code);
    if (product) product.sourceLabel = product.source || 'Open Food Facts 🌐';

    // Step 3: UPCitemDB fallback
    if (!product || !product.name) {
      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`, { signal: controller.signal });
        clearTimeout(tid);
        const data = await res.json();
        if (data.code === 'OK' && data.items && data.items.length > 0) {
          const item = data.items[0];
          product = {
            name: item.title || item.description || `Product (${code})`,
            brand: item.brand || null,
            category: 'Other',
            unit: 'units',
            defaultQty: 1,
            barcode: code,
            imageUrl: item.images && item.images.length > 0 ? item.images[0] : null,
            sourceLabel: 'UPCitemDB 🌐'
          };
        }
      } catch (apiErr2) {
        console.warn('UPCitemDB lookup notice:', apiErr2.name === 'AbortError' ? 'Timeout' : apiErr2.message);
      }
    }

    const expiry = (document.getElementById('scan-expiry') || {}).value
      || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    if (product && product.name) {
      // ── FOUND: add to inventory and show rich confirmation card ──
      addInventoryItem(currentBusinessId, {
        name:       product.name,
        category:   product.category || 'Other',
        quantity:   product.defaultQty || 1,
        unit:       product.unit || 'units',
        expiryDate: expiry,
        barcode:    code
      });

      const thumb = product.imageUrl
        ? `<img src="${product.imageUrl}" alt="${product.name}" 
             style="width:64px;height:64px;object-fit:contain;border-radius:8px;background:#fff;padding:4px;flex-shrink:0;"
             onerror="this.style.display='none'">`
        : `<div style="width:52px;height:52px;border-radius:8px;background:rgba(16,185,129,0.15);display:flex;align-items:center;justify-content:center;font-size:1.8rem;flex-shrink:0;">✅</div>`;

      const nutriBadge = product.nutriScore
        ? `<span style="font-size:0.68rem;font-weight:700;background:rgba(16,185,129,0.2);color:var(--accent-business);padding:0.1rem 0.4rem;border-radius:4px;margin-left:0.3rem;">Nutri-Score ${product.nutriScore}</span>`
        : '';

      const brandLine = product.brand ? `<span style="font-size:0.72rem;color:var(--text-muted);">${product.brand} · </span>` : '';
      const pkgLine   = product.packageSize ? `<span style="font-size:0.72rem;color:var(--text-muted);">${product.packageSize} · </span>` : '';
      const sourceLine = product.sourceLabel ? `<span style="font-size:0.65rem;color:var(--text-muted);opacity:0.7;">${product.sourceLabel}</span>` : '';

      if (resultProduct) resultProduct.innerHTML = `
        <div style="grid-column:1/-1;display:flex;align-items:flex-start;gap:0.85rem;padding:0.4rem 0;">
          ${thumb}
          <div style="flex:1;min-width:0;">
            <div style="font-size:0.95rem;font-weight:700;color:var(--accent-business);white-space:normal;line-height:1.3;">${product.name}${nutriBadge}</div>
            <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.2rem;">${brandLine}${pkgLine}${product.category}</div>
            <div style="font-size:0.72rem;color:#10b981;margin-top:0.3rem;font-weight:600;">✅ Added to inventory! ${sourceLine}</div>
          </div>
        </div>
      `;
      if (resultUnknown) resultUnknown.classList.add('d-none');

      setScannerStatus('active', `✅ Added: ${product.name} — ready for next scan`);
      showToast('✅ Product Added', `${product.name} added to inventory from barcode scan.`, 'success');
      renderInventory();

      // Auto-clear after 3s for next scan
      setTimeout(() => {
        if (resultCard) resultCard.classList.add('d-none');
        pendingScannedProduct = null;
        lastScannedCode = null;
        setScannerStatus('active', 'Scanner active — point camera at a barcode');
      }, 3000);

    } else {
      // ── NOT FOUND: let user enter details manually ──
      const unknownProduct = {
        name: `Unknown (${code})`, category: 'Other',
        unit: 'units', defaultQty: 1, barcode: code, imageUrl: null
      };
      pendingScannedProduct = unknownProduct;

      if (document.getElementById('scan-name-input')) document.getElementById('scan-name-input').value = '';
      if (document.getElementById('scan-qty'))        document.getElementById('scan-qty').value = 1;
      if (document.getElementById('scan-unit'))       document.getElementById('scan-unit').value = 'units';

      if (resultProduct) resultProduct.innerHTML = `
        <div style="grid-column:1/-1;display:flex;align-items:center;gap:0.75rem;margin-bottom:0.25rem;">
          <div style="width:44px;height:44px;border-radius:8px;background:rgba(245,158,11,0.15);display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0;">🔍</div>
          <div>
            <strong style="font-size:0.9rem;">Product not found on Open Food Facts</strong><br>
            <span style="font-size:0.75rem;color:var(--text-muted);">Barcode: ${code} · Enter details below to add manually</span>
          </div>
        </div>
      `;
      if (resultUnknown) resultUnknown.classList.remove('d-none');
      if (resultProduct) resultProduct.classList.remove('d-none');
      showToast('Product Not Found', `Barcode ${code} not found. Enter details below to add.`, 'warning');
      setScannerStatus('idle', `Barcode ${code} — enter product name below`);
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
    if (resultCard) resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  } catch (err) {
    console.error('handleDetectedCode error:', err);
    showToast('Error', err.message, 'error');
    setScannerStatus('error', `Error: ${err.message}`);
  } finally {
    isLookingUp = false;
  }
}

// --- 4. Render Inventory Grid Table ---
function renderInventory() {
  const tbody = document.getElementById('inventory-table-body');
  const filterCat = document.getElementById('inventory-filter-cat').value;
  tbody.innerHTML = '';
  
  const items = getInventory(currentBusinessId);
  const predictions = getAiPredictions(currentBusinessId);

  // Filter
  const filtered = items.filter(item => {
    if (filterCat !== 'All' && item.category !== filterCat) return false;
    return true;
  });

  // Calculate top quick stats
  document.getElementById('biz-stat-total-items').textContent = items.filter(i => i.status !== 'donated').length;
  
  // Critical expiries (<= 2 days left)
  const criticalItems = predictions.filter(p => p.daysLeft <= 2 && p.riskLevel !== 'Low');
  document.getElementById('biz-stat-critical').textContent = criticalItems.length;

  // Average waste risk score
  const activePredictions = predictions.filter(p => p.currentQuantity > 0);
  const avgRisk = activePredictions.length > 0 
    ? Math.round(activePredictions.reduce((acc, p) => acc + p.riskScore, 0) / activePredictions.length)
    : 0;
  
  const riskDisplay = document.getElementById('biz-stat-waste-risk');
  riskDisplay.textContent = `${avgRisk}%`;
  if (avgRisk > 50) {
    riskDisplay.className = 'text-danger';
  } else if (avgRisk > 20) {
    riskDisplay.className = 'text-warning';
  } else {
    riskDisplay.className = 'text-success';
  }

  // Active donations count
  const allBizItems = getInventory(currentBusinessId);
  const donatedCount = allBizItems.filter(i => i.status === 'donated').length;
  document.getElementById('biz-stat-donations').textContent = donatedCount;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding:2.5rem;">No products found. Add items manually, upload a CSV or scan barcodes to begin.</td></tr>`;
    return;
  }

  filtered.forEach(item => {
    const tr = document.createElement('tr');
    
    // Status color badge
    const pred = predictions.find(p => p.itemId === item.id);
    let statusClass = 'badge-safe';
    let statusText = t('safe');

    if (item.status === 'donated') {
      statusClass = 'badge-donated';
      statusText = t('redistributed');
    } else if (pred) {
      if (pred.daysLeft <= 0) {
        statusClass = 'badge-critical';
        statusText = t('expired');
      } else if (pred.daysLeft <= 2) {
        statusClass = 'badge-critical';
        statusText = `${pred.daysLeft}d ${t('daysLeft')}`;
      } else if (pred.daysLeft <= 5) {
        statusClass = 'badge-warning';
        statusText = `${pred.daysLeft}d ${t('daysLeft')}`;
      } else {
        statusClass = 'badge-safe';
        statusText = `${pred.daysLeft}d ${t('daysLeft')}`;
      }
    }

    const isDonated = item.status === 'donated';
    const rowClass = isDonated ? 'style="opacity: 0.65;"' : '';
    const hasDelivery = activeDeliveries[item.id];
    const delivery = hasDelivery ? activeDeliveries[item.id] : null;

    const storage = item.storageRequirement || 'Ambient (15-25°C)';
    const perishability = item.perishabilityRisk || (item.category === 'Cooked Food' || item.category === 'Meat' ? 'High' : item.category === 'Dairy' ? 'Medium' : 'Low');

    tr.innerHTML = `
      <td ${rowClass}>
        <strong>${tName(item.name)}</strong>
        <div style="font-size:0.7rem; color:var(--text-muted);">${storage}</div>
      </td>
      <td ${rowClass}>
        ${tCat(item.category)}
        <div style="font-size:0.68rem;"><span style="color:${perishability === 'High' ? '#f87171' : perishability === 'Medium' ? '#fbbf24' : '#34d399'}; font-weight:600;">${perishability} Risk</span></div>
      </td>
      <td ${rowClass}>${item.quantity} ${tUnit(item.unit)}</td>
      <td ${rowClass}>${item.expiryDate}</td>
      <td><span class="badge-status ${statusClass}">${statusText}</span></td>
      <td style="text-align: right;">
        ${isDonated
          ? `<div style="display:flex;gap:0.4rem;justify-content:flex-end;flex-wrap:wrap;">
               ${delivery
                 ? `<button class="btn btn-sm btn-primary-business" onclick="openTrackingModal('${item.id}','${item.name}')"><i data-lucide="map-pin"></i> ${t('trackDelivery')}</button>`
                 : `<button class="btn btn-sm btn-secondary" onclick="openDeliveryPartnerModal('${item.id}','${item.name}')"><i data-lucide="truck"></i> ${t('assignDelivery')}</button>`
               }
             </div>`
          : `<button class="btn btn-sm btn-primary-business btn-donate-trigger" data-id="${item.id}" data-name="${item.name}" data-qty="${item.quantity}" data-unit="${item.unit}">
               <i data-lucide="heart-handshake"></i> ${t('donateSurplus')}
             </button>`
        }
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Re-hook Lucide Icons safely
  try {
    lucide.createIcons();
  } catch(e) {
    console.warn("Lucide icon error:", e);
  }

  // Use event delegation for modal trigger listeners
  tbody.onclick = (e) => {
    const donateBtn = e.target.closest('.btn-donate-trigger');
    if (donateBtn) {
      openDonationModal(donateBtn.dataset.id, donateBtn.dataset.name, donateBtn.dataset.qty, donateBtn.dataset.unit);
      return;
    }
  };
}


// --- 5. AI Predictions, Charts & Suggestions ---
function renderAiPredictions() {
  const tbody = document.getElementById('ai-prediction-table-body');
  tbody.innerHTML = '';

  const predictions = getAiPredictions(currentBusinessId).filter(p => p.currentQuantity > 0);
  
  // Sort by risk score (highest first)
  predictions.sort((a,b) => b.riskScore - a.riskScore);

  if (predictions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding:2.5rem;">No active inventory for prediction analysis.</td></tr>`;
    document.getElementById('ai-reorder-list').innerHTML = `<p class="text-muted text-center" style="font-size:0.85rem; padding: 1.5rem;">All stock levels optimal.</p>`;
    return;
  }

  // Populate Prediction Matrix Table
  predictions.forEach(p => {
    const tr = document.createElement('tr');
    
    let riskBadgeClass = 'badge-safe';
    if (p.riskLevel === 'Critical') riskBadgeClass = 'badge-critical';
    else if (p.riskLevel === 'High') riskBadgeClass = 'badge-critical';
    else if (p.riskLevel === 'Medium') riskBadgeClass = 'badge-warning';

    tr.innerHTML = `
      <td><strong>${p.name}</strong></td>
      <td>${p.currentQuantity} ${p.unit}</td>
      <td>${p.daysLeft <= 0 ? '<span class="text-danger">Expired</span>' : p.daysLeft + ' days'}</td>
      <td>${p.dailySalesVelocity} ${p.unit}/day</td>
      <td><span class="${p.predictedWaste > 0 ? 'text-danger' : 'text-success'}">${p.predictedWaste} ${p.unit}</span></td>
      <td><span class="badge-status ${riskBadgeClass}">${p.riskLevel} (${p.riskScore}%)</span></td>
    `;
    tbody.appendChild(tr);
  });

  // Populate AI Reorder Checklist
  const reorderListDiv = document.getElementById('ai-reorder-list');
  reorderListDiv.innerHTML = '';

  // Generate reorders for items with low stocks (current stock < 2 days sales velocity)
  const reorderItems = predictions.filter(p => p.currentQuantity <= (p.dailySalesVelocity * 2.5));
  
  if (reorderItems.length === 0) {
    reorderListDiv.innerHTML = `<p class="text-muted text-center" style="font-size:0.85rem; padding: 1.5rem;">All stock levels optimal.</p>`;
  } else {
    reorderItems.forEach(p => {
      const suggestQty = Math.round(p.dailySalesVelocity * 7); // Reorder a week's supply
      const div = document.createElement('div');
      div.className = 'reorder-item';
      div.innerHTML = `
        <div class="reorder-item-left">
          <input type="checkbox" id="reorder-${p.itemId}" value="${p.name} (${suggestQty} ${p.unit})">
          <div>
            <span class="reorder-name">${p.name}</span>
            <div class="reorder-desc">Vel: ${p.dailySalesVelocity}/day | Stock: ${p.currentQuantity}</div>
          </div>
        </div>
        <span class="reorder-badge">+ ${suggestQty} ${p.unit}</span>
      `;
      reorderListDiv.appendChild(div);
    });
  }

  // Draw Charts
  drawForecastChart(predictions);
  lucide.createIcons();
}

function drawForecastChart(predictions) {
  const ctx = document.getElementById('ai-demand-chart').getContext('2d');
  
  if (activeChart) {
    activeChart.destroy();
  }

  // Pick top 5 items for clean display
  const displayItems = predictions.slice(0, 6);
  
  const labels = displayItems.map(p => p.name);
  const currentStocks = displayItems.map(p => p.currentQuantity);
  const wastePredictions = displayItems.map(p => p.predictedWaste);
  const salesVelocities = displayItems.map(p => p.dailySalesVelocity * Math.max(0, p.daysLeft));

  activeChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Current Stock Level',
          data: currentStocks,
          backgroundColor: 'rgba(99, 102, 241, 0.45)', // Violet
          borderColor: 'rgba(99, 102, 241, 0.8)',
          borderWidth: 1.5,
          borderRadius: 4
        },
        {
          label: 'Est. Waste Risk Area',
          data: wastePredictions,
          backgroundColor: 'rgba(239, 68, 68, 0.5)', // Neon coral
          borderColor: 'rgba(239, 68, 68, 0.8)',
          borderWidth: 1.5,
          borderRadius: 4
        },
        {
          label: 'Est. Demand (Sales Limit)',
          data: salesVelocities,
          type: 'line',
          borderColor: '#10b981', // Emerald Green
          borderWidth: 2,
          pointBackgroundColor: '#10b981',
          fill: false,
          tension: 0.35
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#94a3b8',
            font: { family: 'Outfit', size: 11 }
          }
        },
        tooltip: {
          padding: 10,
          backgroundColor: '#0b1120',
          titleColor: '#f8fafc',
          bodyColor: '#e2e8f0',
          borderColor: '#475569',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8', font: { family: 'Inter', size: 10 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8', font: { family: 'Inter', size: 10 } }
        }
      }
    }
  });
}


// --- 6. Donation Modal Details ---
function setupDonationModal() {
  const modal = document.getElementById('modal-donate');
  const closeBtn = document.getElementById('btn-close-donate-modal');
  const form = document.getElementById('form-donate-item');
  
  closeBtn.onclick = () => modal.classList.add('d-none');
  
  form.onsubmit = (e) => {
    e.preventDefault();
    const itemId = document.getElementById('donate-item-id').value;
    const qty = parseFloat(document.getElementById('donate-quantity').value);

    try {
      donateInventoryItem(
        currentBusinessId, 
        itemId, 
        qty, 
        currentBusinessProfile.name, 
        currentBusinessProfile.address
      );
      
      modal.classList.add('d-none');
      showToast('Donation Published', 'Item listed on the redistribution marketplace! Recipient NGOs notified.', 'success');
      renderInventory();
    } catch (err) {
      showToast('Donation Failed', err.message, 'error');
    }
  };
}

function openDonationModal(itemId, itemName, qty, unit) {
  const modal = document.getElementById('modal-donate');
  modal.classList.remove('d-none');
  
  document.getElementById('donate-item-id').value = itemId;
  document.getElementById('donate-item-display-name').textContent = itemName;
  document.getElementById('donate-quantity').value = qty;
  document.getElementById('donate-quantity').max = qty;
  document.getElementById('donate-unit').value = unit;
  document.getElementById('donate-qty-max-label').textContent = `Max available: ${qty} ${unit}`;
}

// ═══════════════════════════════════════════════════════
// DELIVERY PARTNERS SYSTEM
// ═══════════════════════════════════════════════════════

const DELIVERY_PARTNERS = [
  { id: 'swiggy',   name: 'Swiggy Instamart', emoji: '🟠', color: '#FF5200', rating: 4.8, eta: 18, type: 'Quick Commerce',  perKm: 12 },
  { id: 'zomato',   name: 'Zomato Hyperpure',  emoji: '🔴', color: '#E23744', rating: 4.7, eta: 22, type: 'Food Logistics',  perKm: 10 },
  { id: 'porter',   name: 'Porter',             emoji: '🔵', color: '#3563E9', rating: 4.6, eta: 15, type: 'Cargo Delivery', perKm: 8  },
  { id: 'dunzo',    name: 'Dunzo Daily',        emoji: '🟢', color: '#00B140', rating: 4.5, eta: 25, type: 'Hyperlocal',     perKm: 9  },
  { id: 'volunteer',name: 'NutriShare Volunteer',emoji: '💚', color: '#10b981', rating: 4.9, eta: 35, type: 'Volunteer',     perKm: 0  },
];

// Business location (simulated) – Hyderabad city centre
const BIZ_COORDS  = [17.3850, 78.4867];
// NGO location (simulated) – nearby area
const NGO_COORDS  = [17.4400, 78.3489];

let trackingMap        = null;
let trackingInterval   = null;
let partnerMarker      = null;
let currentDonationForDP = null;
let activeDeliveries   = {}; // keyed by donationId

function setupDeliveryPartners() {
  // Close buttons
  document.getElementById('btn-close-dp-modal').onclick    = () => document.getElementById('modal-delivery-partner').classList.add('d-none');
  document.getElementById('btn-close-tracking-modal').onclick = () => {
    document.getElementById('modal-tracking').classList.add('d-none');
    if (trackingInterval) { clearInterval(trackingInterval); trackingInterval = null; }
  };
}

function openDeliveryPartnerModal(donationId, donationName) {
  currentDonationForDP = { id: donationId, name: donationName };
  document.getElementById('dp-modal-donation-name').textContent = `Donation: ${donationName}`;

  const list = document.getElementById('dp-partner-list');
  list.innerHTML = DELIVERY_PARTNERS.map(p => {
    const existingDelivery = activeDeliveries[donationId];
    const alreadyAssigned = existingDelivery && existingDelivery.partnerId === p.id;
    return `
      <div class="dp-card ${alreadyAssigned ? 'dp-card-active' : ''}" style="border-color:${alreadyAssigned ? p.color : ''}">
        <div class="dp-card-left">
          <span style="font-size:2rem;">${p.emoji}</span>
          <div>
            <div style="font-weight:700;font-size:0.9rem;">${p.name}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);">${p.type} · ⭐ ${p.rating}</div>
            <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.15rem;">ETA ~${p.eta} min · ${p.perKm === 0 ? 'Free' : `₹${p.perKm}/km`}</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:0.4rem;align-items:flex-end;">
          ${alreadyAssigned
            ? `<span style="font-size:0.75rem;font-weight:700;color:var(--accent-business);">✅ Assigned</span>
               <button class="btn btn-sm btn-primary-business" onclick="openTrackingModal('${donationId}','${donationName}')">📍 Track</button>`
            : `<button class="btn btn-sm btn-primary-business" onclick="assignDeliveryPartner('${donationId}','${donationName}','${p.id}')">Assign</button>`
          }
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('modal-delivery-partner').classList.remove('d-none');
  lucide.createIcons();
}

function assignDeliveryPartner(donationId, donationName, partnerId) {
  const partner = DELIVERY_PARTNERS.find(p => p.id === partnerId);
  if (!partner) return;

  activeDeliveries[donationId] = {
    partnerId,
    donationName,
    status: 'assigned',
    assignedAt: Date.now(),
    partner
  };

  document.getElementById('modal-delivery-partner').classList.add('d-none');
  showToast(`🚚 ${partner.name} Assigned!`, `${partner.name} will pick up "${donationName}" in ~${partner.eta} min.`, 'success');

  // Refresh donation cards to show Track button
  renderBusinessDonations();

  // Auto open tracking after 1s
  setTimeout(() => openTrackingModal(donationId, donationName), 800);
}

function openTrackingModal(donationId, donationName) {
  const delivery = activeDeliveries[donationId];
  if (!delivery) return;
  const partner = delivery.partner;

  document.getElementById('modal-tracking').classList.remove('d-none');
  document.getElementById('tracking-partner-name').textContent = `${donationName} · ${partner.name}`;
  document.getElementById('tracking-partner-avatar').textContent = partner.emoji;
  document.getElementById('tracking-partner-info-name').textContent = partner.name;
  document.getElementById('tracking-partner-info-sub').textContent = `${partner.type} · ETA ~${partner.eta} min`;
  document.getElementById('tracking-partner-rating').textContent = `⭐ ${partner.rating}`;

  // Init/reset tracking steps
  ['assigned','pickup','transit','delivered'].forEach(s => {
    const el = document.getElementById(`tstep-${s}`);
    el.classList.remove('tstep-active','tstep-done');
  });
  document.getElementById('tstep-assigned').classList.add('tstep-done');

  // Init Leaflet map
  setTimeout(() => {
    if (trackingMap) { trackingMap.remove(); trackingMap = null; }
    if (trackingInterval) { clearInterval(trackingInterval); }

    trackingMap = L.map('tracking-map', { zoomControl: true }).setView(BIZ_COORDS, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(trackingMap);

    // Business marker (green)
    const bizIcon = L.divIcon({ html: `<div style="background:${partner.color};color:#fff;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);">🏪</div>`, className:'', iconSize:[36,36], iconAnchor:[18,18] });
    L.marker(BIZ_COORDS, { icon: bizIcon }).addTo(trackingMap).bindPopup('<b>Your Store</b><br>Donation pickup point').openPopup();

    // NGO marker (blue)
    const ngoIcon = L.divIcon({ html: `<div style="background:#6366f1;color:#fff;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);">🏥</div>`, className:'', iconSize:[36,36], iconAnchor:[18,18] });
    L.marker(NGO_COORDS, { icon: ngoIcon }).addTo(trackingMap).bindPopup('<b>NGO Destination</b><br>Hope Kitchen Food Bank');

    // Route line
    L.polyline([BIZ_COORDS, NGO_COORDS], { color: partner.color, weight: 3, dashArray: '8 6', opacity: 0.7 }).addTo(trackingMap);

    // Partner marker (starts at biz, moves to NGO)
    const dpIcon = L.divIcon({ html: `<div style="background:${partner.color};color:#fff;border-radius:50%;width:42px;height:42px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;border:3px solid #fff;box-shadow:0 3px 12px rgba(0,0,0,0.5);animation:pulse 1.5s infinite;">${partner.emoji}</div>`, className:'', iconSize:[42,42], iconAnchor:[21,21] });
    partnerMarker = L.marker(BIZ_COORDS, { icon: dpIcon }).addTo(trackingMap).bindPopup(`<b>${partner.name}</b><br>En route to NGO`);

    // Simulate movement
    let step = 0;
    const totalSteps = 60; // 60 ticks of 3s each = 3 min simulation
    const etaMin = partner.eta;

    trackingInterval = setInterval(() => {
      step++;
      const progress = step / totalSteps;
      const lat = BIZ_COORDS[0] + (NGO_COORDS[0] - BIZ_COORDS[0]) * progress;
      const lng = BIZ_COORDS[1] + (NGO_COORDS[1] - BIZ_COORDS[1]) * progress;
      const remainingKm = (1 - progress) * 8.2;
      const remainingMin = Math.max(0, Math.round(etaMin * (1 - progress)));

      partnerMarker.setLatLng([lat, lng]);

      document.getElementById('tracking-distance').textContent = `${remainingKm.toFixed(1)} km`;
      document.getElementById('tracking-eta-text').textContent = remainingMin > 0 ? `ETA: ${remainingMin} min` : '🎉 Delivered!';

      // Update steps
      if (progress >= 0.02) { document.getElementById('tstep-assigned').classList.add('tstep-done'); }
      if (progress >= 0.2) {
        document.getElementById('tstep-pickup').classList.add('tstep-done');
        document.getElementById('tracking-status-text').textContent = 'Picked up from your store';
      }
      if (progress >= 0.5) {
        document.getElementById('tstep-transit').classList.add('tstep-done');
        document.getElementById('tracking-status-text').textContent = 'In transit to NGO';
      }
      if (progress >= 1) {
        document.getElementById('tstep-delivered').classList.add('tstep-done');
        document.getElementById('tracking-status-text').textContent = '✅ Food delivered to NGO!';
        document.getElementById('tracking-eta-bar').style.background = 'rgba(16,185,129,0.15)';
        clearInterval(trackingInterval);
        trackingInterval = null;
        delivery.status = 'delivered';
        showToast('🎉 Delivered!', `${partner.name} delivered "${donationName}" to Hope Kitchen Food Bank.`, 'success');
      }
    }, 3000);

  }, 200);
}

function renderBusinessDonations() {
  // Refresh donation list in the "Active Donations" tab if it exists
  // For now this triggers inventory re-render which shows Track button
  renderInventory();
}

// Expose globally for inline onclick handlers
window.openDeliveryPartnerModal = openDeliveryPartnerModal;
window.assignDeliveryPartner    = assignDeliveryPartner;
window.openTrackingModal        = openTrackingModal;
