
// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check auth
    firebase.auth().onAuthStateChanged((user) => {
        if (!user) {
            window.location.href = '../../index.html';
        } else {
            loadInitialData();
        }
    });

    // Event Listeners
    document.getElementById('categoryForm').addEventListener('submit', handleAddCategory);
    document.getElementById('addItemForm').addEventListener('submit', handleAddItem);
    document.getElementById('transactionForm').addEventListener('submit', handleTransaction);

    const procurementForm = document.getElementById('procurementForm');
    if (procurementForm) procurementForm.addEventListener('submit', handleProcurement);

    const assetForm = document.getElementById('assetForm');
    if (assetForm) assetForm.addEventListener('submit', handleSaveAsset);

    const scheduleForm = document.getElementById('scheduleForm');
    if (scheduleForm) scheduleForm.addEventListener('submit', handleSaveSchedule);

    const ticketForm = document.getElementById('ticketForm');
    if (ticketForm) ticketForm.addEventListener('submit', handleSaveTicket);

    setDefaultDates();
});

// Global Cache
let categories = [];
let items = [];
let assets = [];
let assetsLoaded = false;
let procurementOrders = [];
let maintenanceSchedules = [];
let maintenanceTickets = [];

function getTenantId() {
    return (typeof getCurrentTenant === 'function') ? getCurrentTenant() : (localStorage.getItem('tenant_id') || 'default');
}

// Tab Switching
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.tab-btn[onclick="switchTab('${tab}')"]`).classList.add('active');

    document.querySelectorAll('.tab-content').forEach(div => div.classList.remove('active'));
    document.getElementById(`${tab}-tab`).classList.add('active');

    if (tab === 'stock') loadStock();
    if (tab === 'transactions') loadTransactions();
    if (tab === 'categories') loadCategories();
    if (tab === 'procurement') loadProcurement();
    if (tab === 'assets') loadAssets();
    if (tab === 'maintenance') loadMaintenance();
}

async function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('active');

    // Refresh selects if needed
    if (id === 'itemModal') {
        populateCategorySelect();
        return;
    }
    if (id === 'transactionModal') {
        populateItemSelect();
        return;
    }
    if (id === 'procurementModal') {
        if (!items.length) await loadStock();
        populateProcurementItemSelect();
        prepareProcurementForm();
        return;
    }
    if (id === 'assetModal') {
        prepareAssetForm();
        return;
    }
    if (id === 'scheduleModal') {
        await ensureAssetsLoaded();
        populateAssetSelect('scheduleAssetSelect');
        prepareScheduleForm();
        return;
    }
    if (id === 'ticketModal') {
        await ensureAssetsLoaded();
        populateAssetSelect('ticketAssetSelect');
        prepareTicketForm();
        return;
    }
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    document.getElementById(id).querySelector('form').reset();
}

async function loadInitialData() {
    await Promise.all([loadCategories(), loadStock()]);
}

// --- Category Logic ---

async function loadCategories() {
    const tbody = document.getElementById('categoryList');
    if (!tbody) return;

    try {
        const snapshot = await db.collection('inventory_categories').orderBy('name').get();
        categories = [];
        let html = '';

        if (snapshot.empty) {
            html = '<tr><td colspan="2" class="text-center">No categories found.</td></tr>';
        } else {
            snapshot.forEach(doc => {
                const data = doc.data();
                categories.push({ id: doc.id, ...data });
                html += `
                    <tr>
                        <td>${data.name}</td>
                        <td>
                            <button class="btn-icon text-danger" onclick="deleteCategory('${doc.id}')">Delete</button>
                        </td>
                    </tr>
                `;
            });
        }
        tbody.innerHTML = html;
    } catch (error) {
        console.error("Error loading categories:", error);
        tbody.innerHTML = '<tr><td colspan="2" class="text-center text-danger">Error loading data.</td></tr>';
    }
}

async function handleAddCategory(e) {
    e.preventDefault();
    const name = e.target.name.value.trim();
    if (!name) return;

    try {
        await db.collection('inventory_categories').add({
            name: name,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        logAudit('inventory_category_create', 'inventory_categories', { name });
        closeModal('categoryModal');
        loadCategories();
    } catch (error) {
        alert("Error: " + error.message);
    }
}

async function deleteCategory(id) {
    if (!confirm('Delete this category?')) return;
    try {
        await db.collection('inventory_categories').doc(id).delete();
        logAudit('inventory_category_delete', `inventory_categories/${id}`, {});
        loadCategories();
    } catch (error) {
        alert("Error: " + error.message);
    }
}

function populateCategorySelect() {
    const select = document.getElementById('itemCategorySelect');
    select.innerHTML = '<option value="">Select Category</option>';
    categories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.name;
        opt.innerText = c.name;
        select.appendChild(opt);
    });
}

// --- Stock/Item Logic ---

async function loadStock() {
    const tbody = document.getElementById('stockList');
    if (!tbody) return;

    try {
        const snapshot = await db.collection('inventory_items').orderBy('name').get();
        items = [];
        let html = '';

        if (snapshot.empty) {
            html = '<tr><td colspan="6" class="text-center">No items found.</td></tr>';
        } else {
            snapshot.forEach(doc => {
                const item = doc.data();
                items.push({ id: doc.id, ...item });
                
                const isLow = item.quantity <= (item.minQuantity || 5);
                const statusBadge = isLow 
                    ? '<span class="status-badge status-low">Low Stock</span>' 
                    : '<span class="status-badge status-ok">OK</span>';

                html += `
                    <tr>
                        <td>${item.name}</td>
                        <td>${item.category || '-'}</td>
                        <td>${item.sku || '-'}</td>
                        <td><strong>${item.quantity}</strong></td>
                        <td>${statusBadge}</td>
                        <td>
                            <button class="btn-icon text-danger" onclick="deleteItem('${doc.id}')">Delete</button>
                        </td>
                    </tr>
                `;
            });
        }
        tbody.innerHTML = html;
    } catch (error) {
        console.error("Error loading stock:", error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading data.</td></tr>';
    }
}

async function handleAddItem(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
        name: formData.get('name'),
        category: formData.get('category'),
        sku: formData.get('sku'),
        quantity: parseInt(formData.get('quantity')) || 0,
        minQuantity: parseInt(formData.get('minQuantity')) || 5,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection('inventory_items').add(data);
        logAudit('inventory_item_create', 'inventory_items', data);
        closeModal('itemModal');
        loadStock();
    } catch (error) {
        alert("Error: " + error.message);
    }
}

async function deleteItem(id) {
    if (!confirm('Delete this item? Transactions history will remain.')) return;
    try {
        await db.collection('inventory_items').doc(id).delete();
        logAudit('inventory_item_delete', `inventory_items/${id}`, {});
        loadStock();
    } catch (error) {
        alert("Error: " + error.message);
    }
}

function populateItemSelect() {
    const select = document.getElementById('transItemSelect');
    select.innerHTML = '<option value="">Select Item</option>';
    items.forEach(i => {
        const opt = document.createElement('option');
        opt.value = i.id;
        opt.innerText = `${i.name} (Qty: ${i.quantity})`;
        select.appendChild(opt);
    });
}

// --- Transaction Logic ---

async function loadTransactions() {
    const tbody = document.getElementById('transactionList');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading...</td></tr>';

    try {
        // Limit to last 50
        const snapshot = await db.collection('inventory_transactions')
            .orderBy('date', 'desc')
            .limit(50)
            .get();

        let html = '';
        if (snapshot.empty) {
            html = '<tr><td colspan="5" class="text-center">No transactions yet.</td></tr>';
        } else {
            snapshot.forEach(doc => {
                const t = doc.data();
                const date = t.date ? t.date.toDate().toLocaleDateString() : '-';
                const typeColor = t.type === 'PURCHASE' ? 'green' : 'red';
                
                html += `
                    <tr>
                        <td>${date}</td>
                        <td style="color: ${typeColor}; font-weight: bold;">${t.type}</td>
                        <td>${t.itemName}</td>
                        <td>${t.quantity}</td>
                        <td>${t.performedBy || 'Admin'}</td>
                    </tr>
                `;
            });
        }
        tbody.innerHTML = html;
    } catch (error) {
        console.error("Error loading transactions:", error);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading data.</td></tr>';
    }
}

async function handleTransaction(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Processing...';

    const formData = new FormData(e.target);
    const itemId = formData.get('itemId');
    const type = formData.get('type');
    const quantity = parseInt(formData.get('quantity'));
    const notes = formData.get('notes');

    if (!itemId || quantity <= 0) {
        alert("Invalid item or quantity");
        btn.disabled = false;
        btn.innerText = originalText;
        return;
    }

    try {
        await db.runTransaction(async (transaction) => {
            const itemRef = db.collection('inventory_items').doc(itemId);
            const itemDoc = await transaction.get(itemRef);

            if (!itemDoc.exists) {
                throw "Item does not exist!";
            }

            const currentQty = itemDoc.data().quantity || 0;
            let newQty = currentQty;

            if (type === 'PURCHASE') {
                newQty += quantity;
            } else {
                if (currentQty < quantity) {
                    throw `Insufficient stock! Current: ${currentQty}`;
                }
                newQty -= quantity;
            }

            // Update item
            transaction.update(itemRef, { 
                quantity: newQty,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Add transaction record
            const transRef = db.collection('inventory_transactions').doc();
            transaction.set(transRef, {
                type: type,
                itemId: itemId,
                itemName: itemDoc.data().name,
                quantity: quantity,
                notes: notes,
                date: firebase.firestore.FieldValue.serverTimestamp(),
                performedBy: firebase.auth().currentUser ? firebase.auth().currentUser.email : 'Admin'
            });
        });

        alert("Transaction successful!");
        logAudit('inventory_transaction', 'inventory_transactions', { type, itemId, quantity, notes });
        closeModal('transactionModal');
        loadStock(); // Refresh stock list to show new quantities
    } catch (error) {
        console.error("Transaction failed:", error);
        alert("Transaction failed: " + error);
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

function setDefaultDates() {
    const today = new Date().toISOString().slice(0, 10);

    const procurementDate = document.querySelector('#procurementForm input[name="date"]');
    if (procurementDate && !procurementDate.value) procurementDate.value = today;

    const assetPurchaseDate = document.querySelector('#assetForm input[name="purchaseDate"]');
    if (assetPurchaseDate && !assetPurchaseDate.value) assetPurchaseDate.value = today;

    const scheduleNextDue = document.querySelector('#scheduleForm input[name="nextDueDate"]');
    if (scheduleNextDue && !scheduleNextDue.value) scheduleNextDue.value = today;
}

function prepareProcurementForm() {
    const form = document.getElementById('procurementForm');
    if (!form) return;
    form.reset();
    const today = new Date().toISOString().slice(0, 10);
    form.querySelector('input[name="date"]').value = today;

    const quantityEl = form.querySelector('input[name="quantity"]');
    const unitCostEl = form.querySelector('input[name="unitCost"]');
    const totalCostEl = form.querySelector('input[name="totalCost"]');

    if (quantityEl && !quantityEl.value) quantityEl.value = 1;

    if (!form.dataset.calcWired) {
        const recalc = () => {
            const qty = parseFloat(quantityEl?.value || '0') || 0;
            const unit = parseFloat(unitCostEl?.value || '0') || 0;
            if (totalCostEl && qty > 0 && unitCostEl && unitCostEl.value !== '') {
                totalCostEl.value = (qty * unit).toFixed(2);
            }
        };
        quantityEl?.addEventListener('input', recalc);
        unitCostEl?.addEventListener('input', recalc);
        totalCostEl?.addEventListener('input', () => {
            const qty = parseFloat(quantityEl?.value || '0') || 0;
            const total = parseFloat(totalCostEl?.value || '0') || 0;
            if (unitCostEl && qty > 0 && (!unitCostEl.value || unitCostEl.value === '0')) {
                unitCostEl.value = (total / qty).toFixed(2);
            }
        });
        form.dataset.calcWired = '1';
    }
}

function prepareAssetForm() {
    const form = document.getElementById('assetForm');
    if (!form) return;
    form.reset();
    form.querySelector('input[name="docId"]').value = '';
    const today = new Date().toISOString().slice(0, 10);
    form.querySelector('input[name="purchaseDate"]').value = today;
    form.querySelector('select[name="status"]').value = 'active';
}

function prepareScheduleForm() {
    const form = document.getElementById('scheduleForm');
    if (!form) return;
    form.reset();
    form.querySelector('input[name="docId"]').value = '';
    const today = new Date().toISOString().slice(0, 10);
    form.querySelector('input[name="nextDueDate"]').value = today;
}

function prepareTicketForm() {
    const form = document.getElementById('ticketForm');
    if (!form) return;
    form.reset();
    form.querySelector('input[name="docId"]').value = '';
    form.querySelector('select[name="priority"]').value = 'medium';
    form.querySelector('select[name="status"]').value = 'open';
}

function formatMoney(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '-';
    return `Rs. ${n.toLocaleString()}`;
}

function formatDateShort(value) {
    if (!value) return '-';
    if (typeof value === 'string') return value;
    if (typeof value.toDate === 'function') return value.toDate().toLocaleDateString();
    try {
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) return d.toLocaleDateString();
    } catch (e) { }
    return '-';
}

function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

function isSameTenant(data) {
    const tenantId = getTenantId();
    return !data?.tenantId || data.tenantId === tenantId;
}

function getCurrentUserEmail() {
    return firebase.auth().currentUser ? firebase.auth().currentUser.email : 'Admin';
}

function getCurrentUserId() {
    return firebase.auth().currentUser ? firebase.auth().currentUser.uid : '';
}

function escapeHtml(text) {
    return (text || '').toString().replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[ch]));
}

// --- Procurement ---

function populateProcurementItemSelect() {
    const sel = document.getElementById('procItemSelect');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">Select Item</option>' + items.map(i => {
        const label = `${i.name || 'Item'} (Qty: ${i.quantity ?? 0})`;
        return `<option value="${i.id}">${escapeHtml(label)}</option>`;
    }).join('');
    if (current) sel.value = current;
}

async function loadProcurement() {
    const tbody = document.getElementById('procurementList');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Loading...</td></tr>';

    try {
        const snapshot = await db.collection('inventory_procurements').orderBy('createdAt', 'desc').limit(50).get();
        procurementOrders = [];

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No purchases yet.</td></tr>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const p = doc.data() || {};
            if (!isSameTenant(p)) return;
            procurementOrders.push({ id: doc.id, ...p });

            const date = p.date || formatDateShort(p.createdAt);
            const vendor = escapeHtml(p.vendor || '-');
            const invoice = escapeHtml(p.invoice || '-');
            const itemName = escapeHtml(p.itemName || '-');
            const qty = p.quantity ?? '-';
            const total = formatMoney(p.totalCost ?? (p.unitCost && p.quantity ? (p.unitCost * p.quantity) : null));

            const status = (p.status || 'posted').toLowerCase();
            const statusBadge = status === 'voided'
                ? '<span class="status-badge status-low">Voided</span>'
                : '<span class="status-badge status-ok">Posted</span>';

            const actions = status === 'voided'
                ? '-'
                : `<button class="btn-icon text-danger" onclick="voidProcurement('${doc.id}')">Void</button>`;

            html += `
                <tr>
                    <td>${escapeHtml(date)}</td>
                    <td>${vendor}</td>
                    <td>${invoice}</td>
                    <td>${itemName}</td>
                    <td>${qty}</td>
                    <td>${total}<br>${statusBadge}</td>
                    <td>${actions}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html || '<tr><td colspan="7" class="text-center">No purchases yet.</td></tr>';
    } catch (error) {
        console.error("Error loading procurement:", error);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error loading data.</td></tr>';
    }
}

async function handleProcurement(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn ? btn.innerText : '';
    if (btn) { btn.disabled = true; btn.innerText = 'Saving...'; }

    try {
        const formData = new FormData(e.target);
        const date = formData.get('date');
        const vendor = (formData.get('vendor') || '').trim();
        const invoice = (formData.get('invoice') || '').trim();
        const itemId = formData.get('itemId');
        const quantity = parseInt(formData.get('quantity') || '0', 10) || 0;
        const unitCostRaw = formData.get('unitCost');
        const totalCostRaw = formData.get('totalCost');
        const notes = (formData.get('notes') || '').trim();

        if (!date || !itemId || quantity <= 0) {
            alert('Date, Item and Quantity are required.');
            return;
        }

        const unitCost = unitCostRaw === '' ? null : (parseFloat(unitCostRaw) || 0);
        const totalCost = totalCostRaw === '' ? null : (parseFloat(totalCostRaw) || 0);

        await db.runTransaction(async (transaction) => {
            const itemRef = db.collection('inventory_items').doc(itemId);
            const itemDoc = await transaction.get(itemRef);
            if (!itemDoc.exists) throw new Error('Item does not exist.');

            const itemName = itemDoc.data().name || 'Item';
            const currentQty = itemDoc.data().quantity || 0;
            const newQty = currentQty + quantity;

            const resolvedUnit = unitCost !== null ? unitCost : (totalCost !== null ? (totalCost / quantity) : 0);
            const resolvedTotal = totalCost !== null ? totalCost : (resolvedUnit * quantity);

            transaction.update(itemRef, {
                quantity: newQty,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            const procurementRef = db.collection('inventory_procurements').doc();
            transaction.set(procurementRef, {
                date,
                vendor,
                invoice,
                itemId,
                itemName,
                quantity,
                unitCost: resolvedUnit,
                totalCost: resolvedTotal,
                notes,
                status: 'posted',
                tenantId: getTenantId(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: getCurrentUserId(),
                createdByEmail: getCurrentUserEmail()
            });

            const transRef = db.collection('inventory_transactions').doc();
            transaction.set(transRef, {
                type: 'PURCHASE',
                itemId,
                itemName,
                quantity,
                notes: [vendor ? `Vendor: ${vendor}` : '', invoice ? `Invoice: ${invoice}` : '', notes].filter(Boolean).join(' | '),
                date: firebase.firestore.FieldValue.serverTimestamp(),
                performedBy: getCurrentUserEmail(),
                tenantId: getTenantId()
            });
        });

        if (typeof logAudit === 'function') logAudit('inventory_procurement_create', 'inventory_procurements', { itemId, quantity, vendor });

        closeModal('procurementModal');
        await Promise.all([loadProcurement(), loadStock(), loadTransactions()]);
    } catch (error) {
        console.error("Procurement failed:", error);
        alert("Failed to save: " + (error.message || error));
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = originalText; }
    }
}

async function voidProcurement(id) {
    if (!confirm('Void this purchase and reverse stock?')) return;

    try {
        await db.runTransaction(async (transaction) => {
            const ref = db.collection('inventory_procurements').doc(id);
            const doc = await transaction.get(ref);
            if (!doc.exists) throw new Error('Purchase not found.');
            const p = doc.data() || {};
            if ((p.status || '').toLowerCase() === 'voided') return;

            const itemRef = db.collection('inventory_items').doc(p.itemId);
            const itemDoc = await transaction.get(itemRef);
            if (!itemDoc.exists) throw new Error('Item not found.');

            const qty = parseInt(p.quantity || '0', 10) || 0;
            const currentQty = itemDoc.data().quantity || 0;
            if (currentQty < qty) throw new Error(`Cannot void: stock is only ${currentQty}.`);

            transaction.update(itemRef, {
                quantity: currentQty - qty,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            transaction.set(ref, {
                status: 'voided',
                voidedAt: firebase.firestore.FieldValue.serverTimestamp(),
                voidedBy: getCurrentUserId(),
                voidedByEmail: getCurrentUserEmail()
            }, { merge: true });

            const transRef = db.collection('inventory_transactions').doc();
            transaction.set(transRef, {
                type: 'ISSUE',
                itemId: p.itemId,
                itemName: p.itemName || '',
                quantity: qty,
                notes: `Voided procurement ${id}`,
                date: firebase.firestore.FieldValue.serverTimestamp(),
                performedBy: getCurrentUserEmail(),
                tenantId: getTenantId()
            });
        });

        if (typeof logAudit === 'function') logAudit('inventory_procurement_void', `inventory_procurements/${id}`, {});
        await Promise.all([loadProcurement(), loadStock(), loadTransactions()]);
    } catch (error) {
        console.error(error);
        alert('Failed to void: ' + (error.message || error));
    }
}

// --- Assets & Depreciation ---

function monthsBetween(startISO, endDate = new Date()) {
    if (!startISO) return 0;
    const start = new Date(startISO);
    if (Number.isNaN(start.getTime())) return 0;
    const end = endDate instanceof Date ? endDate : new Date(endDate);
    if (Number.isNaN(end.getTime())) return 0;
    let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    if (end.getDate() < start.getDate()) months -= 1;
    return Math.max(0, months);
}

function computeStraightLineDepreciation(asset, asOfDate = new Date()) {
    const cost = Number(asset.cost) || 0;
    const salvage = Number(asset.salvageValue) || 0;
    const lifeMonths = Math.max(1, parseInt(asset.lifeMonths || '1', 10) || 1);
    const base = Math.max(0, cost - Math.min(cost, salvage));
    const monthly = base / lifeMonths;
    const elapsed = monthsBetween(asset.purchaseDate, asOfDate);
    const accumulated = Math.min(base, monthly * elapsed);
    const net = Math.max(0, cost - accumulated);
    return { monthly, accumulated, net, elapsedMonths: elapsed, base };
}

async function fetchAssets() {
    const snapshot = await db.collection('assets').get();
    const list = [];
    snapshot.forEach(doc => {
        const a = doc.data() || {};
        if (!isSameTenant(a)) return;
        list.push({ id: doc.id, ...a });
    });
    list.sort((a, b) => {
        const aTs = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const bTs = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        if (aTs !== bTs) return bTs - aTs;
        return (a.name || '').localeCompare(b.name || '');
    });
    assets = list;
    assetsLoaded = true;
}

async function ensureAssetsLoaded() {
    if (assetsLoaded) return;
    try {
        await fetchAssets();
    } catch (err) {
        console.warn('Failed to load assets', err);
        assets = [];
        assetsLoaded = true;
    }
}

function populateAssetSelect(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">Select Asset</option>' + assets.map(a => {
        const tag = a.tag ? ` · ${a.tag}` : '';
        return `<option value="${a.id}">${escapeHtml(a.name || 'Asset')}${escapeHtml(tag)}</option>`;
    }).join('');
    if (current) sel.value = current;
}

async function loadAssets() {
    const tbody = document.getElementById('assetsList');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="9" class="text-center">Loading...</td></tr>';

    try {
        await fetchAssets();

        if (!assets.length) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">No assets found.</td></tr>';
            return;
        }

        const today = new Date();
        let html = '';
        assets.forEach(a => {
            const dep = computeStraightLineDepreciation(a, today);
            const status = (a.status || 'active').toLowerCase();
            const statusBadge = status === 'disposed'
                ? '<span class="status-badge status-low">Disposed</span>'
                : '<span class="status-badge status-ok">Active</span>';

            const nameLine = `<div style="font-weight:600;">${escapeHtml(a.name || '')}</div>` +
                (a.tag ? `<div style="font-size:0.75rem;color:var(--text-light);">${escapeHtml(a.tag)}</div>` : '');

            const purchaseLine = `<div>${escapeHtml(a.purchaseDate || '-')}</div>` +
                (a.location ? `<div style="font-size:0.75rem;color:var(--text-light);">${escapeHtml(a.location)}</div>` : '');

            const depLine = `
                <div>${formatMoney(dep.monthly.toFixed(2))}/mo</div>
                <div style="font-size:0.75rem;color:var(--text-light);">Acc: ${formatMoney(dep.accumulated.toFixed(2))} (${dep.elapsedMonths} mo)</div>
            `;

            html += `
                <tr>
                    <td>${nameLine}</td>
                    <td>${escapeHtml(a.category || '-')}</td>
                    <td>${purchaseLine}</td>
                    <td>${formatMoney(a.cost)}</td>
                    <td>${escapeHtml(String(a.lifeMonths || '-'))} mo</td>
                    <td>${depLine}</td>
                    <td>${formatMoney(dep.net.toFixed(2))}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn-icon" onclick="editAsset('${a.id}')">Edit</button>
                        <button class="btn-icon text-danger" onclick="deleteAsset('${a.id}')">Delete</button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    } catch (error) {
        console.error("Error loading assets:", error);
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-danger">Error loading data.</td></tr>';
    }
}

async function handleSaveAsset(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn ? btn.innerText : '';
    if (btn) { btn.disabled = true; btn.innerText = 'Saving...'; }

    try {
        const formData = new FormData(e.target);
        const docId = formData.get('docId');
        const name = (formData.get('name') || '').trim();
        const category = (formData.get('category') || '').trim();
        const tag = (formData.get('tag') || '').trim();
        const location = (formData.get('location') || '').trim();
        const purchaseDate = formData.get('purchaseDate');
        const cost = parseFloat(formData.get('cost') || '0') || 0;
        const salvageValue = parseFloat(formData.get('salvageValue') || '0') || 0;
        const lifeMonths = parseInt(formData.get('lifeMonths') || '1', 10) || 1;
        const method = formData.get('method') || 'straight_line';
        const status = formData.get('status') || 'active';
        const notes = (formData.get('notes') || '').trim();

        if (!name || !purchaseDate || lifeMonths <= 0) {
            alert('Asset Name, Purchase Date, and Life are required.');
            return;
        }

        const payload = {
            name,
            category,
            tag,
            location,
            purchaseDate,
            cost,
            salvageValue,
            lifeMonths,
            method,
            status,
            notes,
            tenantId: getTenantId(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: getCurrentUserId()
        };

        if (docId) {
            await db.collection('assets').doc(docId).set(payload, { merge: true });
            if (typeof logAudit === 'function') logAudit('asset_update', `assets/${docId}`, { name });
        } else {
            const ref = await db.collection('assets').add({
                ...payload,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: getCurrentUserId()
            });
            if (typeof logAudit === 'function') logAudit('asset_create', `assets/${ref.id}`, { name });
        }

        assetsLoaded = false;
        closeModal('assetModal');
        await Promise.all([loadAssets(), loadMaintenance()]);
    } catch (error) {
        console.error("Error saving asset:", error);
        alert("Error: " + (error.message || error));
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = originalText; }
    }
}

async function editAsset(id) {
    await openModal('assetModal');
    try {
        const doc = await db.collection('assets').doc(id).get();
        if (!doc.exists) return;
        const a = doc.data() || {};
        const form = document.getElementById('assetForm');
        if (!form) return;
        form.querySelector('input[name="docId"]').value = id;
        form.querySelector('input[name="name"]').value = a.name || '';
        form.querySelector('input[name="category"]').value = a.category || '';
        form.querySelector('input[name="tag"]').value = a.tag || '';
        form.querySelector('input[name="location"]').value = a.location || '';
        form.querySelector('input[name="purchaseDate"]').value = a.purchaseDate || todayISO();
        form.querySelector('input[name="cost"]').value = a.cost ?? 0;
        form.querySelector('input[name="salvageValue"]').value = a.salvageValue ?? 0;
        form.querySelector('input[name="lifeMonths"]').value = a.lifeMonths ?? 36;
        form.querySelector('select[name="method"]').value = a.method || 'straight_line';
        form.querySelector('select[name="status"]').value = a.status || 'active';
        form.querySelector('input[name="notes"]').value = a.notes || '';
    } catch (err) {
        console.error(err);
        alert('Failed to load asset.');
    }
}

async function deleteAsset(id) {
    if (!confirm('Delete this asset? Maintenance schedules/tickets will remain.')) return;
    try {
        await db.collection('assets').doc(id).delete();
        if (typeof logAudit === 'function') logAudit('asset_delete', `assets/${id}`, {});
        assetsLoaded = false;
        await Promise.all([loadAssets(), loadMaintenance()]);
    } catch (err) {
        console.error(err);
        alert('Failed to delete: ' + (err.message || err));
    }
}

// --- Maintenance ---

function addDaysISO(isoDate, days) {
    const base = isoDate || todayISO();
    const d = new Date(base);
    if (Number.isNaN(d.getTime())) return todayISO();
    d.setDate(d.getDate() + (parseInt(days || '0', 10) || 0));
    return d.toISOString().slice(0, 10);
}

async function loadMaintenance() {
    await ensureAssetsLoaded();
    populateAssetSelect('scheduleAssetSelect');
    populateAssetSelect('ticketAssetSelect');
    await Promise.all([loadSchedules(), loadTickets()]);
}

async function loadSchedules() {
    const tbody = document.getElementById('maintenanceSchedules');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';

    try {
        const snapshot = await db.collection('maintenance_schedules').orderBy('nextDueDate', 'asc').limit(200).get();
        maintenanceSchedules = [];

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No schedules yet.</td></tr>';
            return;
        }

        const today = todayISO();
        const assetNameById = new Map(assets.map(a => [a.id, a.name]));

        let html = '';
        snapshot.forEach(doc => {
            const s = doc.data() || {};
            if (!isSameTenant(s)) return;
            maintenanceSchedules.push({ id: doc.id, ...s });

            const assetName = assetNameById.get(s.assetId) || s.assetName || '-';
            const nextDue = s.nextDueDate || '-';
            const freq = s.frequencyDays ? `${s.frequencyDays}d` : '-';
            const notes = escapeHtml(s.notes || '-');
            const active = s.active !== false;

            let badge = '<span class="status-badge status-ok">Upcoming</span>';
            if (!active) {
                badge = '<span class="status-badge status-low">Disabled</span>';
            } else if (nextDue !== '-' && nextDue <= today) {
                badge = '<span class="status-badge status-low">Due</span>';
            }

            const actions = `
                <button class="btn-icon" onclick="editSchedule('${doc.id}')">Edit</button>
                <button class="btn-icon" onclick="markScheduleDone('${doc.id}')">Done</button>
                <button class="btn-icon text-danger" onclick="toggleScheduleActive('${doc.id}', ${active ? 'false' : 'true'})">${active ? 'Disable' : 'Enable'}</button>
            `;

            html += `
                <tr>
                    <td style="font-weight:600;">${escapeHtml(assetName)}</td>
                    <td>${escapeHtml(nextDue)}</td>
                    <td>${escapeHtml(freq)}</td>
                    <td>${notes}</td>
                    <td>${badge}</td>
                    <td>${actions}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html || '<tr><td colspan="6" class="text-center">No schedules yet.</td></tr>';
    } catch (err) {
        console.error('Error loading schedules', err);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading data.</td></tr>';
    }
}

async function handleSaveSchedule(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn ? btn.innerText : '';
    if (btn) { btn.disabled = true; btn.innerText = 'Saving...'; }

    try {
        await ensureAssetsLoaded();
        const formData = new FormData(e.target);
        const docId = formData.get('docId');
        const assetId = formData.get('assetId');
        const nextDueDate = formData.get('nextDueDate');
        const frequencyDays = parseInt(formData.get('frequencyDays') || '0', 10) || 0;
        const notes = (formData.get('notes') || '').trim();

        if (!assetId || !nextDueDate || frequencyDays <= 0) {
            alert('Asset, Next Due, and Frequency are required.');
            return;
        }

        const asset = assets.find(a => a.id === assetId);
        const assetName = asset?.name || '';

        const payload = {
            assetId,
            assetName,
            nextDueDate,
            frequencyDays,
            notes,
            active: true,
            tenantId: getTenantId(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: getCurrentUserId()
        };

        if (docId) {
            await db.collection('maintenance_schedules').doc(docId).set(payload, { merge: true });
            if (typeof logAudit === 'function') logAudit('maintenance_schedule_update', `maintenance_schedules/${docId}`, { assetId });
        } else {
            const ref = await db.collection('maintenance_schedules').add({
                ...payload,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: getCurrentUserId()
            });
            if (typeof logAudit === 'function') logAudit('maintenance_schedule_create', `maintenance_schedules/${ref.id}`, { assetId });
        }

        closeModal('scheduleModal');
        loadSchedules();
    } catch (err) {
        console.error(err);
        alert('Failed to save schedule: ' + (err.message || err));
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = originalText; }
    }
}

async function editSchedule(id) {
    await openModal('scheduleModal');
    try {
        const doc = await db.collection('maintenance_schedules').doc(id).get();
        if (!doc.exists) return;
        const s = doc.data() || {};
        const form = document.getElementById('scheduleForm');
        if (!form) return;
        form.querySelector('input[name="docId"]').value = id;
        form.querySelector('select[name="assetId"]').value = s.assetId || '';
        form.querySelector('input[name="nextDueDate"]').value = s.nextDueDate || todayISO();
        form.querySelector('input[name="frequencyDays"]').value = s.frequencyDays ?? 30;
        form.querySelector('input[name="notes"]').value = s.notes || '';
    } catch (err) {
        console.error(err);
        alert('Failed to load schedule.');
    }
}

async function markScheduleDone(id) {
    try {
        const doc = await db.collection('maintenance_schedules').doc(id).get();
        if (!doc.exists) return;
        const s = doc.data() || {};
        const next = addDaysISO(s.nextDueDate || todayISO(), s.frequencyDays || 0);
        await db.collection('maintenance_schedules').doc(id).set({
            lastDoneAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastDoneDate: todayISO(),
            nextDueDate: next,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: getCurrentUserId()
        }, { merge: true });
        if (typeof logAudit === 'function') logAudit('maintenance_schedule_done', `maintenance_schedules/${id}`, { nextDueDate: next });
        loadSchedules();
    } catch (err) {
        console.error(err);
        alert('Failed to mark done: ' + (err.message || err));
    }
}

async function toggleScheduleActive(id, shouldEnable) {
    try {
        await db.collection('maintenance_schedules').doc(id).set({
            active: !!shouldEnable,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: getCurrentUserId()
        }, { merge: true });
        if (typeof logAudit === 'function') logAudit('maintenance_schedule_toggle', `maintenance_schedules/${id}`, { active: !!shouldEnable });
        loadSchedules();
    } catch (err) {
        console.error(err);
        alert('Failed to update schedule: ' + (err.message || err));
    }
}

async function loadTickets() {
    const tbody = document.getElementById('maintenanceTickets');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';

    try {
        const snapshot = await db.collection('maintenance_tickets').orderBy('createdAt', 'desc').limit(200).get();
        maintenanceTickets = [];

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No tickets yet.</td></tr>';
            return;
        }

        const assetNameById = new Map(assets.map(a => [a.id, a.name]));

        let html = '';
        snapshot.forEach(doc => {
            const t = doc.data() || {};
            if (!isSameTenant(t)) return;
            maintenanceTickets.push({ id: doc.id, ...t });

            const created = formatDateShort(t.createdAt) || '-';
            const assetName = assetNameById.get(t.assetId) || t.assetName || '-';
            const title = escapeHtml(t.title || '-');
            const priority = (t.priority || 'medium').toLowerCase();
            const status = (t.status || 'open').toLowerCase();

            const priorityBadge = priority === 'high'
                ? '<span class="status-badge status-low">High</span>'
                : priority === 'low'
                    ? '<span class="status-badge status-ok">Low</span>'
                    : '<span class="status-badge" style="background:#ffedd5;color:#9a3412;">Medium</span>';

            const statusBadge = status === 'closed'
                ? '<span class="status-badge status-ok">Closed</span>'
                : status === 'resolved'
                    ? '<span class="status-badge status-ok">Resolved</span>'
                    : status === 'in_progress'
                        ? '<span class="status-badge" style="background:#e0f2fe;color:#0369a1;">In Progress</span>'
                        : '<span class="status-badge status-low">Open</span>';

            const quickActions = status === 'open'
                ? `
                    <button class="btn-icon" onclick="setTicketStatus('${doc.id}','in_progress')">Start</button>
                    <button class="btn-icon" onclick="setTicketStatus('${doc.id}','resolved')">Resolve</button>
                  `
                : status === 'in_progress'
                    ? `<button class="btn-icon" onclick="setTicketStatus('${doc.id}','resolved')">Resolve</button>`
                    : status === 'resolved'
                        ? `<button class="btn-icon" onclick="setTicketStatus('${doc.id}','closed')">Close</button>`
                        : '-';

            html += `
                <tr>
                    <td>${escapeHtml(created)}</td>
                    <td style="font-weight:600;">${escapeHtml(assetName)}</td>
                    <td>${title}<br><span style="font-size:0.75rem;color:var(--text-light);">${escapeHtml(t.description || '')}</span></td>
                    <td>${priorityBadge}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn-icon" onclick="editTicket('${doc.id}')">Edit</button>
                        ${quickActions}
                        <button class="btn-icon text-danger" onclick="deleteTicket('${doc.id}')">Delete</button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html || '<tr><td colspan="6" class="text-center">No tickets yet.</td></tr>';
    } catch (err) {
        console.error('Error loading tickets', err);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading data.</td></tr>';
    }
}

async function handleSaveTicket(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn ? btn.innerText : '';
    if (btn) { btn.disabled = true; btn.innerText = 'Saving...'; }

    try {
        await ensureAssetsLoaded();
        const formData = new FormData(e.target);
        const docId = formData.get('docId');
        const assetId = formData.get('assetId');
        const title = (formData.get('title') || '').trim();
        const description = (formData.get('description') || '').trim();
        const priority = formData.get('priority') || 'medium';
        const status = formData.get('status') || 'open';

        if (!assetId || !title) {
            alert('Asset and Title are required.');
            return;
        }

        const asset = assets.find(a => a.id === assetId);
        const assetName = asset?.name || '';

        const payload = {
            assetId,
            assetName,
            title,
            description,
            priority,
            status,
            tenantId: getTenantId(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: getCurrentUserId()
        };

        if (docId) {
            await db.collection('maintenance_tickets').doc(docId).set(payload, { merge: true });
            if (typeof logAudit === 'function') logAudit('maintenance_ticket_update', `maintenance_tickets/${docId}`, { assetId, status });
        } else {
            const ref = await db.collection('maintenance_tickets').add({
                ...payload,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: getCurrentUserId(),
                createdByEmail: getCurrentUserEmail()
            });
            if (typeof logAudit === 'function') logAudit('maintenance_ticket_create', `maintenance_tickets/${ref.id}`, { assetId, status });
        }

        closeModal('ticketModal');
        loadTickets();
    } catch (err) {
        console.error(err);
        alert('Failed to save ticket: ' + (err.message || err));
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = originalText; }
    }
}

async function editTicket(id) {
    await openModal('ticketModal');
    try {
        const doc = await db.collection('maintenance_tickets').doc(id).get();
        if (!doc.exists) return;
        const t = doc.data() || {};
        const form = document.getElementById('ticketForm');
        if (!form) return;
        form.querySelector('input[name="docId"]').value = id;
        form.querySelector('select[name="assetId"]').value = t.assetId || '';
        form.querySelector('input[name="title"]').value = t.title || '';
        form.querySelector('textarea[name="description"]').value = t.description || '';
        form.querySelector('select[name="priority"]').value = t.priority || 'medium';
        form.querySelector('select[name="status"]').value = t.status || 'open';
    } catch (err) {
        console.error(err);
        alert('Failed to load ticket.');
    }
}

async function setTicketStatus(id, status) {
    try {
        const updates = {
            status,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: getCurrentUserId()
        };
        if (status === 'resolved') updates.resolvedAt = firebase.firestore.FieldValue.serverTimestamp();
        if (status === 'closed') updates.closedAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('maintenance_tickets').doc(id).set(updates, { merge: true });
        if (typeof logAudit === 'function') logAudit('maintenance_ticket_status', `maintenance_tickets/${id}`, { status });
        loadTickets();
    } catch (err) {
        console.error(err);
        alert('Failed to update status: ' + (err.message || err));
    }
}

async function deleteTicket(id) {
    if (!confirm('Delete this ticket?')) return;
    try {
        await db.collection('maintenance_tickets').doc(id).delete();
        if (typeof logAudit === 'function') logAudit('maintenance_ticket_delete', `maintenance_tickets/${id}`, {});
        loadTickets();
    } catch (err) {
        console.error(err);
        alert('Failed to delete: ' + (err.message || err));
    }
}
