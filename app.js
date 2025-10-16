// --- Local Storage User Management ---
function getUsers() {
    return JSON.parse(localStorage.getItem('bankUsers') || '{}');
}
function saveUser(username, password) {
    const users = getUsers();
    users[username] = password;
    localStorage.setItem('bankUsers', JSON.stringify(users));
}
function userExists(username) {
    const users = getUsers();
    return !!users[username];
}
function validateUser(username, password) {
    const users = getUsers();
    return users[username] === password;
}

// --- Per-user settings storage ---
function getAllUserSettings() {
    return JSON.parse(localStorage.getItem('bankUserSettings') || '{}');
}
function getUserSettings(username) {
    const all = getAllUserSettings();
    return all[username] || null;
}
function saveUserSettings(username, settings) {
    const all = getAllUserSettings();
    all[username] = settings;
    localStorage.setItem('bankUserSettings', JSON.stringify(all));
}

// Trusted recipients helpers
function getTrustedRecipients(username) {
    const s = getUserSettings(username) || {};
    return s.trustedRecipients || [];
}
function setTrustedRecipients(username, list) {
    const s = getUserSettings(username) || {};
    s.trustedRecipients = list;
    saveUserSettings(username, s);
}
// --- Share/Download Receipt Logic ---
function downloadReceipt() {
    const receipt = document.getElementById('receipt-modal') ? document.getElementById('receipt-modal').innerHTML : document.getElementById('receipt-modal-overlay').innerHTML;
    const blob = new Blob([`<html><body>${receipt}</body></html>`], {type: 'text/html'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transfer_receipt.html';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

function shareReceipt() {
    const elm = document.getElementById('receipt-modal') || document.getElementById('receipt-modal-overlay');
    const receiptText = elm ? elm.innerText : '';
    if (navigator.share) {
        navigator.share({
            title: 'Transfer Receipt',
            text: receiptText
        }).catch(() => showToast('Share cancelled.', 'error'));
    } else {
        navigator.clipboard.writeText(receiptText);
        showToast('Receipt copied to clipboard!', 'success');
    }
}

// Overlay-specific helpers (use overlay ids)
function downloadReceiptOverlay() {
    const elm = document.getElementById('receipt-modal-overlay');
    if (!elm) { showToast('No receipt available to download.', 'error'); return; }
    const blob = new Blob([`<html><body>${elm.innerHTML}</body></html>`], {type: 'text/html'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'transfer_receipt.html'; document.body.appendChild(a); a.click(); setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 150);
}

function shareReceiptOverlay() {
    const elm = document.getElementById('receipt-modal-overlay');
    if (!elm) { showToast('No receipt to share.', 'error'); return; }
    const text = elm.innerText || elm.textContent;
    if (navigator.share) {
        navigator.share({ title: 'Transfer Receipt', text }).catch(() => showToast('Share cancelled.', 'error'));
    } else if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => showToast('Receipt copied to clipboard!', 'success'));
    } else {
        showToast('Sharing not available.', 'error');
    }
}

// --- Receipt rendering helpers ---
const receiptStyles = `
    body{font-family:Roboto,Arial,sans-serif;color:#222;padding:18px}
    .receipt-card{max-width:720px;margin:0 auto;background:#fff;padding:20px;border-radius:8px;border:1px solid #e6e6e6}
    .receipt-meta{display:flex;justify-content:space-between;align-items:center}
    .receipt-logo{width:56px;height:56px;border-radius:8px;background:var(--keystone-primary,#00255B);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800}
    .receipt-header{font-size:18px;font-weight:700;margin:12px 0}
    .receipt-amount{font-size:28px;color:var(--keystone-primary,#00255B);font-weight:800;margin:8px 0}
    .receipt-detail{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed #eee}
    .status-pill{padding:6px 10px;border-radius:12px;font-weight:700;font-size:12px}
    .status-Completed{background:#e6ffec;color:#28a745}
    .status-Pending{background:#fff6e6;color:#d97706}
    .status-Failed{background:#fdecea;color:#c0392b}
    .status-Reversed{background:#f3f6ff;color:#2b6cb0}
    .receipt-footer{text-align:center;color:#666;margin-top:14px;font-size:13px}
`;

function buildReceiptHTML(tx, settings = {}){
    const date = tx.date || new Date().toISOString().slice(0,10);
    const time = (tx.meta && tx.meta.time) || new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
    const amount = formatCurrency(Math.abs(tx.amount || 0));
    const status = tx.status || 'Completed';
    const ref = tx.reference || (tx.meta && tx.meta.reference) || `TRX${Date.now().toString().slice(-8)}`;
    const description = tx.description || '';
    const receiptName = (settings && settings.receiptAccountName) ? settings.receiptAccountName : (window.__currentUser || 'Keystone Customer');
    const receiptAcct = (settings && settings.receiptAccountNumber) ? settings.receiptAccountNumber : '';
    // Attempt to parse 'to' and 'from' from description if available
    let toLabel = '';
    let fromLabel = receiptName || 'Keystone Customer';
    const m = description.match(/Transfer to ([^\-]+) \(Acct: \.\.\.(\d{4})\)/i);
    if (m) { toLabel = `${m[1].trim()} (Acct: ...${m[2]})`; }

    // realistic fee simulation (demo only)
    const fee = (tx.meta && tx.meta.fee) !== undefined ? Number(tx.meta && tx.meta.fee) : 0.00;
    const total = Math.abs(tx.amount || 0) + (fee || 0);

    return `
        <div class="receipt-card" role="document">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div style="display:flex;gap:12px;align-items:center;">
                    <div class="receipt-logo">KS</div>
                    <div>
                        <div style="font-weight:800;font-size:18px;">Keystone Bank</div>
                        <div style="font-size:12px;color:#555;">Instant Transfers • NGN</div>
                    </div>
                </div>
                <div style="text-align:right;font-size:12px;color:#555;">${date} • ${time}</div>
            </div>
            <hr style="border:none;border-top:1px solid #eee;margin:8px 0;" />
            <div style="display:flex;gap:12px;align-items:center;margin-top:8px;">
                <div style="background:#e8f8ef;border-radius:50%;width:64px;height:64px;display:flex;align-items:center;justify-content:center;margin-right:8px;">
                    <i class="fas fa-check-circle" style="color:#28a745;font-size:28px;"></i>
                </div>
                <div style="flex:1;">
                    <div style="font-size:13px;color:#555;font-weight:700;">${receiptName}</div>
                    <div style="font-size:12px;color:#777;">Customer</div>
                </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <div style="font-size:12px;color:#777;">Transaction Ref</div>
                    <div style="font-weight:700;">${ref} <button id="copy-ref" class="copy-ref" style="margin-left:8px;padding:6px 8px;border-radius:6px;border:none;background:#eef6ff;color:#00255B">Copy</button></div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:12px;color:#777;">Status</div>
                    <div style="margin-top:6px;" class="status-pill status-${status}">${status}</div>
                </div>
            </div>

            <div style="margin-top:12px;padding:6px 0;">
                <div style="font-weight:700;margin-bottom:6px;">Payment Details</div>
                <div class="receipt-detail"><span>From</span><strong>${fromLabel}</strong></div>
                <div class="receipt-detail"><span>To</span><strong>${toLabel || description}</strong></div>
                <div class="receipt-detail"><span>Narration</span><strong>${tx.meta && tx.meta.narration ? tx.meta.narration : ''}</strong></div>
            </div>

            <div style="margin-top:12px;padding:6px 0;">
                <div style="font-weight:700;margin-bottom:6px;">Transaction Summary</div>
                <div class="receipt-detail"><span>Amount</span><strong>${amount}</strong></div>
                <div class="receipt-detail"><span>Service Fee</span><strong>${formatCurrency(fee)}</strong></div>
                <div class="receipt-detail"><span>Total Debited</span><strong>${formatCurrency(total)}</strong></div>
            </div>

            <div style="margin-top:14px; font-size:12px;color:#666;">If you did not authorize this transaction, contact our support immediately: support@keystone.example | +234 700 000 0000</div>
            <div style="text-align:center;margin-top:12px;font-size:13px;color:#555;">Keystone Bank • Banking made human</div>
        </div>
    `;
}

function renderReceipt(containerId, tx){
        const container = document.getElementById(containerId);
        if (!container) return;
        const settings = window.__currentUser ? getUserSettings(window.__currentUser) || {} : {};
        const html = buildReceiptHTML(tx, settings);
        container.innerHTML = html;
        // attach copy handler
        const copyBtn = container.querySelector('#copy-ref');
        if (copyBtn) copyBtn.addEventListener('click', () => {
                const ref = container.querySelector('#copy-ref') ? container.querySelector('#copy-ref').previousSibling.textContent.trim() : (tx.reference || '');
                if (navigator.clipboard) {
                        navigator.clipboard.writeText(ref).then(() => showToast('Reference copied to clipboard', 'success')).catch(() => showToast('Unable to copy', 'error'));
                } else {
                        try { const tmp = document.createElement('input'); tmp.value = ref; document.body.appendChild(tmp); tmp.select(); document.execCommand('copy'); tmp.remove(); showToast('Reference copied', 'success'); } catch(e){ showToast('Copy failed', 'error'); }
                }
        });
}

function downloadReceiptHTMLFromElement(elm, filename = 'transfer_receipt.html'){
        if (!elm) { showToast('No receipt to download', 'error'); return; }
        const outer = `<html><head><meta charset="utf-8"><style>${receiptStyles}</style></head><body>${elm.innerHTML}</body></html>`;
        const blob = new Blob([outer], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
// --- DATA MODEL ---
let currentBalance = 4520000.00; // Store balance as a number
let transactions = [
     { date: '2025-10-09', type: 'Debit', description: 'Transfer - Jane O. (GTBank)', amount: -50000.00, status: 'Completed' },
     { date: '2025-10-08', type: 'Credit', description: 'Salary Deposit - ACME LTD', amount: 350000.00, status: 'Completed' },
     { date: '2025-09-29', type: 'Debit', description: 'Transfer to OPay (Ayo M.)', amount: -12500.00, status: 'Completed' },
     { date: '2024-10-30', type: 'Credit', description: 'Reversal for Failed Transfer', amount: 10000.00, status: 'Completed' },
     { date: '2024-10-30', type: 'Debit', description: 'Interbank Transfer (Failed)', amount: -10000.00, status: 'Reversed' },
];

// --- TOAST NOTIFICATION ---
function showToast(message, type = 'success') {
    let toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    }, 2500);
}


// --- UTILITY FUNCTIONS ---

// Function to format the number as NGN currency
const formatCurrency = (number) => {
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 2,
    }).format(number);
};

// Function to render the transactions table
const renderTransactions = () => {
    const tableBody = document.querySelector('#transactions-table tbody');
    const fullHistoryBody = document.querySelector('#full-history-table tbody');

    // Clear existing rows
    tableBody.innerHTML = '';
    if(fullHistoryBody) fullHistoryBody.innerHTML = '';

    // Use slice to limit to 10 for the dashboard
    const dashboardTxns = transactions.slice(0, 10);
    
    // Render to Dashboard table
    dashboardTxns.forEach(tx => {
        tableBody.appendChild(createRow(tx));
    });
    
    // Render to Full History table (if available)
    if(fullHistoryBody) {
        transactions.forEach(tx => {
            fullHistoryBody.appendChild(createRow(tx));
        });
    }
};

const createRow = (tx) => {
    const row = document.createElement('tr');
    const amountClass = tx.amount < 0 ? 'negative-amount' : 'positive-amount';
    const statusClass = tx.status.toLowerCase();

    row.innerHTML = `
        <td>${tx.date}</td>
        <td>${tx.type}</td>
        <td>${tx.description}</td>
        <td class="${amountClass}">${formatCurrency(tx.amount)}</td>
        <td><span class="status ${statusClass}">${tx.status}</span></td>
    `;
    return row;
};

// Function to update the displayed account balance
const updateBalanceDisplay = () => {
    const balanceElement = document.getElementById('account-balance');
    
    // Format the balance for display
    const formattedBalance = formatCurrency(currentBalance);
    
    // Split the formatted string to isolate the fractional part for styling
    // This is a simple approximation; proper localization usually handles this.
    const parts = formattedBalance.split('.');
    let displayHTML;
    if (parts.length > 1) {
         displayHTML = `${parts[0]}.<small style="font-size: 0.7em;">${parts[1]}</small>`;
    } else {
         displayHTML = formattedBalance;
    }

    balanceElement.innerHTML = displayHTML;
};

// Function to handle sidebar and quick action navigation
const navigate = (targetId) => {
    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-target') === targetId) {
            item.classList.add('active');
        }
        // Handle case where dashboard is activated from quick action
        if (targetId === 'dashboard' && item.getAttribute('data-target') === 'dashboard') {
            item.classList.add('active');
        }
    });

    // Hide all content sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.setAttribute('hidden', true);
    });

    // Show the target section
    const targetSection = document.getElementById(targetId + '-content');
    if (targetSection) {
        targetSection.removeAttribute('hidden');
    }
};

// --- Centralized Balance Operations ---
/**
 * processDebit - attempts to deduct amount from currentBalance and records a transaction
 * @param {number} amount - positive amount to debit
 * @param {string} description - transaction description
 * @param {object} opts - optional metadata: { type, reference }
 * @returns {{success: boolean, message: string, transaction?: object}}
 */
function processDebit(amount, description, opts = {}) {
    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
        return { success: false, message: 'Invalid amount' };
    }
    // check per-user spending limit if present
    const currentUser = window.__currentUser || null;
    if (currentUser) {
        const settings = getUserSettings(currentUser);
        if (settings && settings.spendingLimit && Number(settings.spendingLimit) > 0 && amount > Number(settings.spendingLimit)) {
            return { success: false, message: 'Amount exceeds your spending limit' };
        }
    }
    if (amount > currentBalance) {
        return { success: false, message: 'Insufficient funds' };
    }
    const now = new Date();
    const trxRef = opts.reference || `TRX${Date.now().toString().slice(-10)}`;
    const tx = {
        date: now.toISOString().slice(0, 10),
        type: opts.type || 'Debit',
        description: description || 'Debit Transaction',
        amount: -Math.abs(amount),
        status: 'Completed',
        reference: trxRef,
        meta: opts
    };
    // apply
    transactions.unshift(tx);
    currentBalance -= amount;
    updateBalanceDisplay();
    renderTransactions();
    return { success: true, message: 'Transaction completed', transaction: tx };
}

/**
 * processCredit - adds funds to currentBalance and records a transaction
 */
function processCredit(amount, description, opts = {}) {
    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
        return { success: false, message: 'Invalid amount' };
    }
    const now = new Date();
    const trxRef = opts.reference || `CR${Date.now().toString().slice(-10)}`;
    const tx = {
        date: now.toISOString().slice(0, 10),
        type: opts.type || 'Credit',
        description: description || 'Credit Transaction',
        amount: Math.abs(amount),
        status: 'Completed',
        reference: trxRef,
        meta: opts
    };
    transactions.unshift(tx);
    currentBalance += amount;
    updateBalanceDisplay();
    renderTransactions();
    return { success: true, message: 'Credit applied', transaction: tx };
}

// expose for other modules/UI handlers
window.processDebit = processDebit;
window.processCredit = processCredit;

// --- MAIN LOGIC ---
document.addEventListener('DOMContentLoaded', () => {

    // PIN modal helper: shows the modal and resolves true if correct PIN entered, false if cancelled or max attempts exceeded
    function showPinModal(expectedPin) {
        return new Promise((resolve) => {
            const modal = document.getElementById('pin-modal');
            const input = document.getElementById('pin-input');
            const submit = document.getElementById('pin-submit');
            const cancel = document.getElementById('pin-cancel');
            const feedback = document.getElementById('pin-feedback');
            if (!modal || !input || !submit || !cancel) return resolve(false);
            let attempts = 0;
            const maxAttempts = 3;
            feedback.style.display = 'none';
            input.value = '';
            modal.removeAttribute('hidden');
            input.focus();

            function cleanup() {
                submit.removeEventListener('click', onSubmit);
                cancel.removeEventListener('click', onCancel);
                modal.setAttribute('hidden', true);
                feedback.style.display = 'none';
            }

            function onCancel() {
                cleanup();
                resolve(false);
            }

            function onSubmit() {
                const val = input.value.trim();
                attempts += 1;
                if (!val) {
                    feedback.innerText = 'Enter your PIN.'; feedback.style.display = 'block';
                    return;
                }
                if (expectedPin && val === expectedPin) {
                    cleanup(); resolve(true); return;
                }
                // If no expectedPin configured, accept any entry as confirmation
                if (!expectedPin) { cleanup(); resolve(true); return; }
                // wrong pin
                if (attempts >= maxAttempts) {
                    feedback.innerText = 'Maximum attempts exceeded.'; feedback.style.display = 'block';
                    setTimeout(() => { cleanup(); resolve(false); }, 800);
                    return;
                }
                feedback.innerText = 'Incorrect PIN. Try again.'; feedback.style.display = 'block';
                input.value = '';
                input.focus();
            }

            submit.addEventListener('click', onSubmit);
            cancel.addEventListener('click', onCancel);
        });
    }

    // Share/Download receipt event listeners
    if (document.getElementById('share-receipt')) document.getElementById('share-receipt').onclick = shareReceipt;
    if (document.getElementById('download-receipt')) document.getElementById('download-receipt').onclick = downloadReceipt;
    const loginForm = document.getElementById('login-form');
    const createAccountForm = document.getElementById('create-account-form');
    const loginPage = document.getElementById('login-page');
    const dashboardPage = document.getElementById('dashboard-page');
    const logoutButton = document.querySelector('.logout-btn');
    const transferForm = document.getElementById('transfer-form');
    const confirmModal = document.getElementById('confirm-modal');
    const confirmTitle = document.getElementById('confirm-title');
    const confirmBody = document.getElementById('confirm-body');
    const confirmAccept = document.getElementById('confirm-accept');
    const confirmCancel = document.getElementById('confirm-cancel');
    const receiptOverlay = document.getElementById('receipt-overlay');
    const receiptOverlayInner = document.getElementById('receipt-modal-overlay');
    const shareOverlayBtn = document.getElementById('share-receipt-overlay');
    const downloadOverlayBtn = document.getElementById('download-receipt-overlay');
    const closeOverlayBtn = document.getElementById('close-receipt');
    const printOverlayBtn = document.getElementById('print-receipt');

    // Initial render
    updateBalanceDisplay();
    renderTransactions();

    function showDashboard() {
        loginPage.setAttribute('hidden', true);
        dashboardPage.removeAttribute('hidden');
        navigate('dashboard'); // Ensure dashboard is visible on login
        // Load settings into the Settings form for the logged-in user so fields like receipt name are visible/editable
        if (window.__currentUser) {
            try { loadSettingsToForm(window.__currentUser); } catch (e) { /* noop */ }
        }
    }

    function showLogin() {
        dashboardPage.setAttribute('hidden', true);
        loginPage.removeAttribute('hidden');
        loginForm.reset();
        if (createAccountForm) createAccountForm.style.display = 'none';
    }

    // --- Login Handler ---
    loginForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const usernameInput = document.getElementById('login-username').value.trim();
        const passwordInput = document.getElementById('login-password').value;
        if (validateUser(usernameInput, passwordInput)) {
            // set current user in session
            window.__currentUser = usernameInput;
            showDashboard();
        } else {
            showToast('Invalid credentials. Please try again or create an account.', 'error');
        }
    });

    // --- Account Creation Handler ---
    createAccountForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const newUsername = document.getElementById('new-username').value.trim();
        const newPassword = document.getElementById('new-password').value;
        if (!newUsername || !newPassword) {
            showToast('Please enter a username and password.', 'error');
            return;
        }
        if (userExists(newUsername)) {
            showToast('Username already exists. Choose another.', 'error');
            return;
        }
        saveUser(newUsername, newPassword);
        showToast('Account created! You can now log in.', 'success');
        createAccountForm.reset();
        createAccountForm.style.display = 'none';
    });

    // --- Logout Handler ---
    logoutButton.addEventListener('click', () => {
        window.__currentUser = null;
        showLogin();
    });
    
    // --- Sidebar Navigation Handler ---
    document.querySelectorAll('.nav-item[data-target]').forEach(item => {
        item.addEventListener('click', (e) => {
            const targetId = e.currentTarget.getAttribute('data-target');
            navigate(targetId);
        });
    });
    
    // --- Transfer Form Handler ---
    transferForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const amountInput = parseFloat(document.getElementById('amount').value);
        const recipientBank = document.getElementById('recipient-bank').value;
        const recipientAccount = document.getElementById('recipient-account').value;
        const narration = document.getElementById('narration').value;
        const resultDiv = document.getElementById('transfer-result');
        const receiptModal = document.getElementById('receipt-modal');

        // Validation
        if (!recipientBank) {
            showToast('Please select a recipient bank.', 'error');
            return;
        }
        if (!recipientAccount || recipientAccount.length !== 10) {
            showToast('Enter a valid 10-digit account number.', 'error');
            return;
        }
        if (isNaN(amountInput) || amountInput < 100) {
            showToast('Amount must be at least ₦100.', 'error');
            return;
        }
        if (amountInput > currentBalance) {
            showToast('Insufficient funds to complete this transaction.', 'error');
            return;
        }

        // Build confirmation summary
        const confirmHtml = `
            <p class="mt-18">You are about to transfer <strong>${formatCurrency(amountInput)}</strong> to <strong>${recipientBank}</strong> (Acct: <strong>...${recipientAccount.slice(-4)}</strong>).</p>
            <p class="mt-18">Narration: <strong>${narration || '—'}</strong></p>
            <p class="mt-18">Available Balance: <strong>${formatCurrency(currentBalance)}</strong></p>
        `;
        // Determine if PIN is required
        const username = window.__currentUser;
        let pinRequired = false;
        if (username) {
            const s = getUserSettings(username) || {};
            const threshold = Number(s.pinThreshold || 0);
            const trusted = getTrustedRecipients(username) || [];
            const isTrusted = trusted.some(t => t.account === recipientAccount && t.bank === recipientBank);
            if (threshold && amountInput > threshold && !isTrusted) pinRequired = true;
        }

        confirmBody.innerHTML = confirmHtml + (pinRequired ? '<p style="color:#d97706">This transfer requires your transaction PIN on confirmation.</p>' : '');

        // show or hide per-transfer override based on settings
        const usernameForSettings = window.__currentUser;
        const settingsForModal = usernameForSettings ? getUserSettings(usernameForSettings) || {} : {};
        const allowOverride = (settingsForModal.overridePerTransfer || 'no') === 'yes';
        const overrideDiv = document.getElementById('confirm-override');
        if (overrideDiv) overrideDiv.style.display = allowOverride ? 'block' : 'none';
        // reset override select
        const overrideSelect = document.getElementById('confirm-outcome');
        if (overrideSelect) overrideSelect.value = '';

        confirmModal.removeAttribute('hidden');

        // Wire one-time confirm handler
        const doTransfer = async () => {
            confirmAccept.disabled = true;
            confirmModal.setAttribute('hidden', true);
            // Show loading spinner in the overlay area
            receiptOverlayInner.innerHTML = '<div class="spinner"></div><p style="text-align:center;margin-top:12px;">Processing transfer...</p>';
            receiptOverlay.removeAttribute('hidden');
            // hide form UI
            resultDiv.style.display = 'block';
            const formContainer = document.querySelector('.transfer-form-container form');
            const formInfo = document.querySelector('.transfer-form-container .form-info');
            if (formContainer) formContainer.style.display = 'none';
            if (formInfo) formInfo.style.display = 'none';

            setTimeout(async () => {
                // use centralized debit logic
                const formattedDate = new Date().toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' });
                const formattedTime = new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const desc = `Transfer to ${recipientBank} (Acct: ...${recipientAccount.slice(-4)}) - ${narration}`;
                // Recompute PIN requirement and enforce via modal
                const username = window.__currentUser;
                const s = username ? getUserSettings(username) || {} : {};
                const threshold = Number(s.pinThreshold || 0);
                const trusted = username ? getTrustedRecipients(username) || [] : [];
                const isTrusted = trusted.some(t => t.account === recipientAccount && t.bank === recipientBank);
                if (threshold && amountInput > threshold && !isTrusted) {
                    const ok = await showPinModal(s.transactionPin);
                    if (!ok) { showToast('PIN verification failed or cancelled. Transfer aborted.', 'error'); confirmAccept.disabled = false; return; }
                }
                // compute outcome - check per-transfer override first
                let preset = s.presetOutcome || 'Completed';
                if (allowOverride && overrideSelect && overrideSelect.value) preset = overrideSelect.value;
                let result;
                if (preset === 'Failed') {
                    // simulate failure
                    result = { success: false, message: 'Simulated transfer failure' };
                } else if (preset === 'Pending') {
                    // Pending: either hold funds (deduct) or just show pending without deducting based on settings
                    const hold = (s.pendingHold || 'no') === 'yes';
                    if (hold) {
                        // perform debit but mark as Pending
                        const res = processDebit(amountInput, desc, { type: 'Debit', channel: 'transfer' });
                        if (!res.success) { result = res; }
                        else {
                            res.transaction.status = 'Pending';
                            res.transaction.meta = res.transaction.meta || {};
                            res.transaction.meta.hold = true;
                            // update rendering
                            renderTransactions();
                            result = { success: true, transaction: res.transaction };
                        }
                    } else {
                        const now = new Date();
                        const trxRef = `TRX${Date.now().toString().slice(-10)}`;
                        const tx = { date: now.toISOString().slice(0,10), type: 'Debit', description: desc, amount: -amountInput, status: 'Pending', reference: trxRef };
                        transactions.unshift(tx);
                        renderTransactions();
                        result = { success: true, transaction: tx };
                    }
                } else if (preset === 'Reversed') {
                    // perform debit then automatically reverse after a short delay (configurable)
                    result = processDebit(amountInput, desc, { type: 'Debit', channel: 'transfer' });
                    if (result.success) {
                        const delay = Number(s.autoReverseDelay) || 1200;
                        setTimeout(() => {
                            processCredit(amountInput, `Auto-reversal for ${result.transaction.reference}`, { type: 'Reversal' });
                        }, delay);
                    }
                } else {
                    // Completed (default)
                    result = processDebit(amountInput, desc, { type: 'Debit', channel: 'transfer' });
                }
                if (!result.success) {
                    receiptOverlayInner.innerHTML = `<p style="color:#E53935;">${result.message}</p>`;
                    showToast(result.message, 'error');
                    confirmAccept.disabled = false;
                    return;
                }
                // Render receipt in both inline and overlay containers using the shared renderer
                const tx = result.transaction;
                renderReceipt('receipt-modal', tx);
                renderReceipt('receipt-modal-overlay', tx);
                // wire overlay action buttons already bound elsewhere (share/download/print)
                showToast('Transfer successful!', 'success');
                transferForm.reset();
                confirmAccept.disabled = false;
            }, 1400);
        };

        const cancelTransfer = () => {
            confirmModal.setAttribute('hidden', true);
            confirmAccept.disabled = false;
            // cleanup handlers
            confirmAccept.removeEventListener('click', doTransfer);
            confirmCancel.removeEventListener('click', cancelTransfer);
        };

        confirmAccept.addEventListener('click', doTransfer, { once: true });
        confirmCancel.addEventListener('click', cancelTransfer, { once: true });
    });
    
     // Reset transfer form visibility when navigating away and back
    const transfersNavItem = document.querySelector('.nav-item[data-target="transfers"]');
    if (transfersNavItem) {
        transfersNavItem.addEventListener('click', () => {
            const formContainer = document.querySelector('.transfer-form-container form');
            const formInfo = document.querySelector('.transfer-form-container .form-info');
            const resultDiv = document.getElementById('transfer-result');
            
            // Reset to show the form again
            formContainer.style.display = 'block';
            formInfo.style.display = 'block';
            resultDiv.style.display = 'none';
        });
    }

    // --- Settings Page Wiring ---
    const saveSettingsBtn = document.getElementById('save-settings');
    const resetSettingsBtn = document.getElementById('reset-settings');
    const settingsForm = document.getElementById('security-settings');
    const changePasswordForm = document.getElementById('change-password-form');

    function loadSettingsToForm(username) {
        const s = getUserSettings(username) || {};
        document.getElementById('transaction-pin').value = s.transactionPin || '';
        document.getElementById('pin-threshold').value = s.pinThreshold || '';
        document.getElementById('preset-outcome').value = s.presetOutcome || 'Completed';
        // New settings
        document.getElementById('override-per-transfer').value = s.overridePerTransfer || 'no';
        document.getElementById('pending-hold').value = s.pendingHold || 'no';
        document.getElementById('auto-reverse-delay').value = s.autoReverseDelay || '';
        document.getElementById('receipt-account-name').value = s.receiptAccountName || '';
        document.getElementById('receipt-account-number').value = s.receiptAccountNumber || '';
        document.getElementById('spending-limit').value = s.spendingLimit || '';
        document.getElementById('default-bank').value = s.defaultBank || '';
        document.getElementById('notify-transactions').checked = !!s.notifyTransactions;
        document.getElementById('settings-username').value = username;
        // render trusted recipients if any
        try { renderTrustedList(username); } catch(e) {}
    }

    // When settings nav is clicked, load current user settings
    const settingsNav = document.querySelector('.nav-item[data-target="settings"]');
    if (settingsNav) {
        settingsNav.addEventListener('click', () => {
            if (window.__currentUser) loadSettingsToForm(window.__currentUser);
        });
    }

    // Trusted Recipients UI wiring (must be after DOM elements exist)
    const addTrustedBtn = document.getElementById('add-trusted');
    const refreshTrustedBtn = document.getElementById('refresh-trusted');
    function renderTrustedList(username) {
        const container = document.getElementById('trusted-list');
        if (!container) return;
        const list = getTrustedRecipients(username) || [];
        container.innerHTML = '';
        if (!list.length) { container.innerHTML = '<p class="feature-soon">No trusted recipients</p>'; return; }
        list.forEach((r, i) => {
            const div = document.createElement('div');
            div.style.display = 'flex'; div.style.justifyContent = 'space-between'; div.style.padding = '6px 0';
            div.innerHTML = `<div>${r.name} — ${r.bank} — ...${r.account.slice(-4)}</div><div><button data-i='${i}' class='remove-trusted'>Remove</button></div>`;
            container.appendChild(div);
        });
        // attach remove handlers
        container.querySelectorAll('.remove-trusted').forEach(btn => btn.addEventListener('click', (e) => {
            const i = Number(e.currentTarget.getAttribute('data-i'));
            const username = window.__currentUser;
            if (!username) { showToast('Login first', 'error'); return; }
            const list = getTrustedRecipients(username);
            list.splice(i,1);
            setTrustedRecipients(username, list);
            renderTrustedList(username);
        }));
    }
    if (addTrustedBtn) {
        addTrustedBtn.addEventListener('click', () => {
            const name = document.getElementById('trusted-name').value.trim();
            const bank = document.getElementById('trusted-bank').value;
            const account = document.getElementById('trusted-account').value.trim();
            const username = window.__currentUser || document.getElementById('settings-username').value.trim();
            if (!username) { showToast('Please login or provide username', 'error'); return; }
            if (!name || !bank || !account || account.length !== 10) { showToast('Provide valid trusted recipient details (10-digit account)', 'error'); return; }
            const list = getTrustedRecipients(username);
            list.push({ name, bank, account });
            setTrustedRecipients(username, list);
            renderTrustedList(username);
            showToast('Trusted recipient added', 'success');
            document.getElementById('trusted-name').value=''; document.getElementById('trusted-account').value='';
        });
    }
    if (refreshTrustedBtn) refreshTrustedBtn.addEventListener('click', () => renderTrustedList(window.__currentUser));

    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', () => {
            const username = window.__currentUser || document.getElementById('settings-username').value.trim();
            if (!username) { showToast('Please login to save settings or provide username.', 'error'); return; }
            const settings = {
                transactionPin: document.getElementById('transaction-pin').value,
                pinThreshold: document.getElementById('pin-threshold') ? document.getElementById('pin-threshold').value : '',
                presetOutcome: document.getElementById('preset-outcome') ? document.getElementById('preset-outcome').value : 'Completed',
                // New persisted flags
                overridePerTransfer: document.getElementById('override-per-transfer') ? document.getElementById('override-per-transfer').value : 'no',
                pendingHold: document.getElementById('pending-hold') ? document.getElementById('pending-hold').value : 'no',
                autoReverseDelay: document.getElementById('auto-reverse-delay') ? document.getElementById('auto-reverse-delay').value : '',
                receiptAccountName: document.getElementById('receipt-account-name') ? document.getElementById('receipt-account-name').value : '',
                receiptAccountNumber: document.getElementById('receipt-account-number') ? document.getElementById('receipt-account-number').value : '',
                spendingLimit: document.getElementById('spending-limit').value,
                defaultBank: document.getElementById('default-bank').value,
                notifyTransactions: document.getElementById('notify-transactions').checked
            };
            saveUserSettings(username, settings);
            showToast('Settings saved.', 'success');
        });
    }

    if (resetSettingsBtn) {
        resetSettingsBtn.addEventListener('click', () => {
            const username = window.__currentUser || document.getElementById('settings-username').value.trim();
            if (!username) { showToast('No user to reset settings for.', 'error'); return; }
            saveUserSettings(username, {});
            loadSettingsToForm(username);
            showToast('Settings reset.', 'success');
        });
    }

    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('settings-username').value.trim();
            const current = document.getElementById('settings-current-password').value;
            const nw = document.getElementById('settings-new-password').value;
            if (!username || !current || !nw) { showToast('Please fill all password fields.', 'error'); return; }
            if (!validateUser(username, current)) { showToast('Current password is incorrect.', 'error'); return; }
            saveUser(username, nw);
            showToast('Password updated. Please login with your new password next time.', 'success');
            changePasswordForm.reset();
        });
    }

    // --- Account Management Handlers ---
    const applyAdjustBtn = document.getElementById('apply-adjust');
    const clearHistoryBtn = document.getElementById('clear-history');
    const exportBtn = document.getElementById('export-account');
    const importBtn = document.getElementById('import-account');
    const importFileInput = document.getElementById('import-file');
    const deleteAccountBtn = document.getElementById('delete-account');

    if (applyAdjustBtn) {
        applyAdjustBtn.addEventListener('click', () => {
            const amt = parseFloat(document.getElementById('adjust-amount').value);
            if (isNaN(amt)) { showToast('Enter a valid number', 'error'); return; }
            const username = window.__currentUser;
            if (!username) { showToast('Please login to adjust balance.', 'error'); return; }
            // If positive -> credit, negative -> debit
            if (amt >= 0) {
                processCredit(amt, `Manual adjustment by ${username}`, { type: 'Adjust' });
                showToast('Balance increased.', 'success');
            } else {
                const res = processDebit(Math.abs(amt), `Manual adjustment by ${username}`, { type: 'Adjust' });
                if (!res.success) { showToast(res.message, 'error'); return; }
                showToast('Balance decreased.', 'success');
            }
            document.getElementById('adjust-amount').value = '';
        });
    }

    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', () => {
            const username = window.__currentUser;
            if (!username) { showToast('Please login to clear history.', 'error'); return; }
            if (!confirm('Clear transaction history for this account? This cannot be undone.')) return;
            transactions = [];
            updateBalanceDisplay();
            renderTransactions();
            showToast('Transaction history cleared.', 'success');
        });
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const username = window.__currentUser;
            if (!username) { showToast('Please login to export account.', 'error'); return; }
            const payload = {
                username,
                balance: currentBalance,
                transactions,
                settings: getUserSettings(username)
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `${username}_account_export.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
            showToast('Account exported.', 'success');
        });
    }

    if (importBtn && importFileInput) {
        importBtn.addEventListener('click', () => importFileInput.click());
        importFileInput.addEventListener('change', (e) => {
            const f = e.target.files[0];
            if (!f) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    if (!data.username) { showToast('Invalid account file.', 'error'); return; }
                    // confirm overwrite
                    if (!confirm(`Import account for ${data.username}? This will overwrite local data for this account.`)) return;
                    // apply
                    // set balance and transactions
                    currentBalance = Number(data.balance) || 0;
                    transactions = data.transactions || [];
                    if (data.settings) saveUserSettings(data.username, data.settings);
                    updateBalanceDisplay(); renderTransactions();
                    showToast('Account imported.', 'success');
                } catch (err) { showToast('Failed to import file.', 'error'); }
            };
            reader.readAsText(f);
        });
    }

    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', () => {
            const username = window.__currentUser;
            if (!username) { showToast('Please login to delete account.', 'error'); return; }
            if (!confirm(`Delete account ${username}? This will remove credentials and settings.`)) return;
            // remove credentials and settings
            const users = getUsers(); delete users[username]; localStorage.setItem('bankUsers', JSON.stringify(users));
            const allSettings = getAllUserSettings(); delete allSettings[username]; localStorage.setItem('bankUserSettings', JSON.stringify(allSettings));
            // clear session
            window.__currentUser = null;
            transactions = [];
            currentBalance = 0;
            updateBalanceDisplay(); renderTransactions();
            showToast('Account deleted.', 'success');
            showLogin();
        });
    }

    // Overlay action wiring
    if (shareOverlayBtn) shareOverlayBtn.addEventListener('click', () => {
        const elm = document.getElementById('receipt-modal-overlay');
        if (!elm) { showToast('No receipt to share.', 'error'); return; }
        const text = elm.innerText || elm.textContent;
        if (navigator.share) navigator.share({ title: 'Transfer Receipt', text }).catch(() => showToast('Share cancelled.', 'error'));
        else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => showToast('Receipt copied to clipboard!', 'success'));
        else showToast('Sharing not available.', 'error');
    });
    if (downloadOverlayBtn) downloadOverlayBtn.addEventListener('click', () => {
        const elm = document.getElementById('receipt-modal-overlay');
        downloadReceiptHTMLFromElement(elm, 'transfer_receipt.html');
    });
    if (closeOverlayBtn) closeOverlayBtn.addEventListener('click', () => { if (receiptOverlay) receiptOverlay.setAttribute('hidden', true); });
    if (printOverlayBtn) printOverlayBtn.addEventListener('click', () => { window.print(); });

    // Inline receipt actions (within transfer result card)
    const inlineShareBtn = document.getElementById('share-receipt');
    const inlineDownloadBtn = document.getElementById('download-receipt');
    if (inlineShareBtn) inlineShareBtn.addEventListener('click', () => {
        const elm = document.getElementById('receipt-modal');
        if (!elm) { showToast('No receipt to share.', 'error'); return; }
        const text = elm.innerText || elm.textContent;
        if (navigator.share) navigator.share({ title: 'Transfer Receipt', text }).catch(() => showToast('Share cancelled.', 'error'));
        else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => showToast('Receipt copied to clipboard!', 'success'));
        else showToast('Sharing not available.', 'error');
    });
    if (inlineDownloadBtn) inlineDownloadBtn.addEventListener('click', () => {
        const elm = document.getElementById('receipt-modal');
        downloadReceiptHTMLFromElement(elm, 'transfer_receipt.html');
    });

    // Bill Payments handler
    const payBillBtn = document.getElementById('pay-bill');
    if (payBillBtn) {
        payBillBtn.addEventListener('click', () => {
            const type = document.getElementById('bill-type').value;
            const acct = document.getElementById('bill-account').value.trim();
            const amt = parseFloat(document.getElementById('bill-amount').value);
            if (!acct || isNaN(amt) || amt < 100) { showToast('Provide valid bill details', 'error'); return; }
            const username = window.__currentUser;
            if (!username) { showToast('Please login to pay bills', 'error'); return; }
            // simple debit
            const res = processDebit(amt, `Bill Payment - ${type} (${acct})`, { type: 'Bill', channel: 'bill' });
            if (!res.success) { showToast(res.message, 'error'); return; }
            showToast('Bill payment successful', 'success');
        });
    }

    // Loan simulate handler
    const applyLoanBtn = document.getElementById('apply-loan');
    if (applyLoanBtn) {
        applyLoanBtn.addEventListener('click', () => {
            const amt = parseFloat(document.getElementById('loan-amount').value);
            const term = parseInt(document.getElementById('loan-term').value, 10);
            if (isNaN(amt) || isNaN(term) || amt <= 0 || term <= 0) { showToast('Provide valid loan amount and term', 'error'); return; }
            // simple mock: credit loan amount and add a repayment schedule item
            const fee = Math.round(amt * 0.03); // 3% fee
            const disbursed = amt - fee;
            processCredit(disbursed, `Loan disbursement (fee ${formatCurrency(fee)})`, { type: 'Loan', term });
            showToast(`Loan simulated: disbursed ${formatCurrency(disbursed)} (fee ${formatCurrency(fee)})`, 'success');
        });
    }
});

// Expose navigate function globally for quick action buttons
window.navigate = navigate;
