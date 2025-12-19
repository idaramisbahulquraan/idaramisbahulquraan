let transportState = {
    user: null,
    routes: [],
    vehicles: [],
    drivers: [],
    assignments: [],
    studentsById: new Map(),
    activeTab: 'routes',
    activeTripId: null,
    activeTripRouteId: null,
    tripRosterByStudentId: new Map(),
    tripAttendanceUnsub: null,
    trackingWatchId: null,
    trackingLastWriteMs: 0
};

function getTenantId() {
    return (typeof getCurrentTenant === 'function') ? getCurrentTenant() : (localStorage.getItem('tenant_id') || 'default');
}

function parseCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem('currentUser') || 'null');
    } catch (e) {
        return null;
    }
}

async function ensureTransportUser() {
    const authUser = firebase.auth().currentUser;
    const cached = parseCurrentUser();
    if (cached && authUser && cached.uid === authUser.uid) {
        transportState.user = cached;
        return cached;
    }
    if (!authUser) {
        transportState.user = cached;
        return cached;
    }

    let role = cached?.role || 'student';
    let name = cached?.name || (authUser.email ? authUser.email.split('@')[0] : 'User');
    try {
        const doc = await db.collection('users').doc(authUser.uid).get();
        if (doc.exists && doc.data()?.role) role = doc.data().role;
        if (doc.exists && doc.data()?.name) name = doc.data().name;
    } catch (e) { }

    const fresh = { uid: authUser.uid, email: authUser.email || '', role, name };
    localStorage.setItem('currentUser', JSON.stringify(fresh));
    transportState.user = fresh;
    return fresh;
}

function isTopRole(role) {
    const r = (role || '').toLowerCase();
    return r === 'owner' || r === 'admin' || r === 'principal';
}

function isStaffRole(role) {
    const r = (role || '').toLowerCase();
    return r === 'owner' || r === 'admin' || r === 'principal' || r === 'teacher' || r === 'accountant' || r === 'clerk';
}

function canWriteFees(role) {
    const r = (role || '').toLowerCase();
    return r === 'owner' || r === 'admin' || r === 'accountant' || r === 'clerk';
}

function escapeHtml(text) {
    return (text || '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[ch]));
}

function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

function setBadge(el, type, text) {
    if (!el) return;
    el.className = `badge ${type}`;
    el.innerText = text;
}

async function tenantSnapshot(collectionName) {
    const tenantId = getTenantId();
    try {
        const snap = await db.collection(collectionName).where('tenantId', '==', tenantId).get();
        if (!snap.empty) return snap;
    } catch (err) {
        console.warn(`Tenant query failed for ${collectionName}`, err?.message || err);
    }
    return db.collection(collectionName).get();
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('active');
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('active');
    const form = modal.querySelector('form');
    if (form) form.reset();
}

function applyRoleGating(user) {
    const top = isTopRole(user?.role);
    const staff = isStaffRole(user?.role);

    ['addRouteBtn', 'addVehicleBtn', 'addDriverBtn', 'addAssignmentBtn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = top ? '' : 'none';
    });

    const feesBtn = document.getElementById('generateFeesBtn');
    if (feesBtn) feesBtn.style.display = canWriteFees(user?.role) ? '' : 'none';

    if (!staff) {
        alert('Transport module is available to staff only.');
        window.location.href = '../../dashboard.html';
    }
}

function switchTransportTab(tab) {
    const valid = ['routes', 'vehicles', 'drivers', 'assignments', 'trips', 'tracking'];
    const target = valid.includes(tab) ? tab : 'routes';
    transportState.activeTab = target;

    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const btn = document.querySelector(`.tab-btn[onclick="switchTransportTab('${target}')"]`);
    if (btn) btn.classList.add('active');

    document.querySelectorAll('.tab-content').forEach(div => div.classList.remove('active'));
    const content = document.getElementById(`${target}-tab`);
    if (content) content.classList.add('active');

    if (target === 'routes') loadRoutes();
    if (target === 'vehicles') loadVehicles();
    if (target === 'drivers') loadDrivers();
    if (target === 'assignments') loadAssignments();
    if (target === 'trips') prepareTripsTab();
    if (target === 'tracking') prepareTrackingTab();
}

async function loadRoutes() {
    const tbody = document.getElementById('routesBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="muted">Loading...</td></tr>';

    try {
        const snap = await tenantSnapshot('transport_routes');
        const routes = [];
        snap.forEach(doc => routes.push({ id: doc.id, ...doc.data() }));
        routes.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        transportState.routes = routes;

        populateRouteOptions();
        populateRouteDefaultsOptions();

        if (!routes.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="muted">No routes yet.</td></tr>';
            return;
        }

        const vehicleName = new Map(transportState.vehicles.map(v => [v.id, v.vehicleNumber]));
        const driverName = new Map(transportState.drivers.map(d => [d.id, d.name]));

        tbody.innerHTML = routes.map(r => {
            const stops = Array.isArray(r.stops) ? r.stops : [];
            const fee = (r.monthlyFee || r.monthlyFee === 0) ? `Rs. ${r.monthlyFee}` : '-';
            const defaults = [
                r.defaultVehicleId ? `Vehicle: ${escapeHtml(vehicleName.get(r.defaultVehicleId) || r.defaultVehicleId)}` : '',
                r.defaultDriverId ? `Driver: ${escapeHtml(driverName.get(r.defaultDriverId) || r.defaultDriverId)}` : ''
            ].filter(Boolean).join('<br>');
            const active = r.active !== false;
            const badge = active ? '<span class="badge badge-ok">ACTIVE</span>' : '<span class="badge badge-off">OFF</span>';
            const actions = isTopRole(transportState.user?.role)
                ? `
                    <button class="btn-sm" onclick="openRouteModal('${r.id}')">Edit</button>
                    <button class="btn-sm danger" onclick="deleteRoute('${r.id}')">Delete</button>
                  `
                : '-';
            return `
                <tr>
                    <td style="font-weight:600;">${escapeHtml(r.name || '')}</td>
                    <td>${stops.length ? `${stops.length} stop(s)` : '<span class="muted">None</span>'}</td>
                    <td>${fee}</td>
                    <td>${defaults || '<span class="muted">None</span>'}</td>
                    <td>${badge}</td>
                    <td>${actions}</td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('loadRoutes failed', err);
        tbody.innerHTML = '<tr><td colspan="6" style="color:red;">Failed to load routes.</td></tr>';
    }
}

async function loadVehicles() {
    const tbody = document.getElementById('vehiclesBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="muted">Loading...</td></tr>';

    try {
        const snap = await tenantSnapshot('transport_vehicles');
        const vehicles = [];
        snap.forEach(doc => vehicles.push({ id: doc.id, ...doc.data() }));
        vehicles.sort((a, b) => (a.vehicleNumber || '').localeCompare(b.vehicleNumber || ''));
        transportState.vehicles = vehicles;

        populateVehicleOptions();
        populateRouteDefaultsOptions();

        if (!vehicles.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="muted">No vehicles yet.</td></tr>';
            return;
        }

        tbody.innerHTML = vehicles.map(v => {
            const active = v.active !== false;
            const badge = active ? '<span class="badge badge-ok">ACTIVE</span>' : '<span class="badge badge-off">OFF</span>';
            const actions = isTopRole(transportState.user?.role)
                ? `
                    <button class="btn-sm" onclick="openVehicleModal('${v.id}')">Edit</button>
                    <button class="btn-sm danger" onclick="deleteVehicle('${v.id}')">Delete</button>
                  `
                : '-';
            return `
                <tr>
                    <td style="font-weight:600;">${escapeHtml(v.vehicleNumber || '')}</td>
                    <td>${escapeHtml(v.type || 'Bus')}</td>
                    <td>${escapeHtml(String(v.capacity || ''))}</td>
                    <td>${badge}</td>
                    <td>${actions}</td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('loadVehicles failed', err);
        tbody.innerHTML = '<tr><td colspan="5" style="color:red;">Failed to load vehicles.</td></tr>';
    }
}

async function loadDrivers() {
    const tbody = document.getElementById('driversBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="muted">Loading...</td></tr>';

    try {
        const snap = await tenantSnapshot('transport_drivers');
        const drivers = [];
        snap.forEach(doc => drivers.push({ id: doc.id, ...doc.data() }));
        drivers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        transportState.drivers = drivers;

        populateRouteDefaultsOptions();

        if (!drivers.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="muted">No drivers yet.</td></tr>';
            return;
        }

        tbody.innerHTML = drivers.map(d => {
            const active = d.active !== false;
            const badge = active ? '<span class="badge badge-ok">ACTIVE</span>' : '<span class="badge badge-off">OFF</span>';
            const actions = isTopRole(transportState.user?.role)
                ? `
                    <button class="btn-sm" onclick="openDriverModal('${d.id}')">Edit</button>
                    <button class="btn-sm danger" onclick="deleteDriver('${d.id}')">Delete</button>
                  `
                : '-';
            return `
                <tr>
                    <td style="font-weight:600;">${escapeHtml(d.name || '')}</td>
                    <td>${escapeHtml(d.phone || '-')}</td>
                    <td>${escapeHtml(d.licenseNumber || '-')}</td>
                    <td>${badge}</td>
                    <td>${actions}</td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('loadDrivers failed', err);
        tbody.innerHTML = '<tr><td colspan="5" style="color:red;">Failed to load drivers.</td></tr>';
    }
}

async function loadAssignments() {
    const tbody = document.getElementById('assignmentsBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="muted">Loading...</td></tr>';

    try {
        const snap = await tenantSnapshot('transport_assignments');
        const assignments = [];
        snap.forEach(doc => assignments.push({ id: doc.id, ...doc.data() }));
        assignments.sort((a, b) => (a.studentName || '').localeCompare(b.studentName || ''));
        transportState.assignments = assignments;

        if (!transportState.routes.length) await loadRoutes();

        const routeName = new Map(transportState.routes.map(r => [r.id, r.name]));
        const canEdit = isTopRole(transportState.user?.role);

        if (!assignments.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="muted">No student assignments yet.</td></tr>';
            return;
        }

        tbody.innerHTML = assignments.map(a => {
            const active = a.active !== false;
            const badge = active ? '<span class="badge badge-ok">ACTIVE</span>' : '<span class="badge badge-off">OFF</span>';
            const rName = routeName.get(a.routeId) || a.routeId || '-';
            const actions = canEdit
                ? `
                    <button class="btn-sm" onclick="openAssignmentModal('${a.studentId || a.id}')">Edit</button>
                    <button class="btn-sm danger" onclick="deactivateAssignment('${a.studentId || a.id}')">Remove</button>
                  `
                : '-';

            return `
                <tr>
                    <td style="font-weight:600;">${escapeHtml(a.studentName || '')}</td>
                    <td>${escapeHtml(a.className || '-')}</td>
                    <td>${escapeHtml(rName)}</td>
                    <td>${escapeHtml(a.pickupStop || '-')}</td>
                    <td>${escapeHtml(a.dropStop || '-')}</td>
                    <td>${badge}</td>
                    <td>${actions}</td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('loadAssignments failed', err);
        tbody.innerHTML = '<tr><td colspan="7" style="color:red;">Failed to load assignments.</td></tr>';
    }
}

function populateRouteOptions() {
    ['assignRoute', 'tripRoute', 'feesRoute'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const current = sel.value;
        sel.innerHTML = '<option value="">Select Route</option>' +
            transportState.routes.map(r => `<option value="${r.id}">${escapeHtml(r.name || r.id)}</option>`).join('');
        if (current) sel.value = current;
    });
}

function populateVehicleOptions() {
    const sel = document.getElementById('trackingVehicle');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">Select Vehicle</option>' +
        transportState.vehicles.map(v => `<option value="${v.id}">${escapeHtml(v.vehicleNumber || v.id)}</option>`).join('');
    if (current) sel.value = current;
}

function populateRouteDefaultsOptions() {
    const vehicleSel = document.getElementById('routeDefaultVehicle');
    if (vehicleSel) {
        const current = vehicleSel.value;
        vehicleSel.innerHTML = '<option value="">None</option>' +
            transportState.vehicles.map(v => `<option value="${v.id}">${escapeHtml(v.vehicleNumber || v.id)}</option>`).join('');
        if (current) vehicleSel.value = current;
    }
    const driverSel = document.getElementById('routeDefaultDriver');
    if (driverSel) {
        const current = driverSel.value;
        driverSel.innerHTML = '<option value="">None</option>' +
            transportState.drivers.map(d => `<option value="${d.id}">${escapeHtml(d.name || d.id)}</option>`).join('');
        if (current) driverSel.value = current;
    }
}

// --- Routes ---

async function openRouteModal(routeId = '') {
    if (!isTopRole(transportState.user?.role)) {
        alert('Only admin/principal can manage routes.');
        return;
    }

    document.getElementById('routeModalTitle').innerText = routeId ? 'Edit Route' : 'Add Route';
    populateRouteDefaultsOptions();

    const form = document.getElementById('routeForm');
    form.reset();
    form.querySelector('input[name="docId"]').value = routeId || '';
    document.getElementById('routeActive').checked = true;

    if (!routeId) {
        openModal('routeModal');
        return;
    }

    try {
        const doc = await db.collection('transport_routes').doc(routeId).get();
        if (!doc.exists) return;
        const r = doc.data() || {};
        form.querySelector('input[name="name"]').value = r.name || '';
        form.querySelector('input[name="monthlyFee"]').value = (r.monthlyFee ?? '') === '' ? '' : (r.monthlyFee ?? '');
        form.querySelector('textarea[name="stops"]').value = Array.isArray(r.stops) ? r.stops.join('\n') : '';
        form.querySelector('select[name="defaultVehicleId"]').value = r.defaultVehicleId || '';
        form.querySelector('select[name="defaultDriverId"]').value = r.defaultDriverId || '';
        document.getElementById('routeActive').checked = r.active !== false;
        openModal('routeModal');
    } catch (err) {
        console.error(err);
        alert('Failed to load route.');
    }
}

async function saveRoute(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn ? btn.innerText : '';
    if (btn) { btn.disabled = true; btn.innerText = 'Saving...'; }

    try {
        const user = await ensureTransportUser();
        const uid = user?.uid || (firebase.auth().currentUser ? firebase.auth().currentUser.uid : '');

        const docId = form.querySelector('input[name="docId"]').value || '';
        const name = form.querySelector('input[name="name"]').value.trim();
        const monthlyFeeRaw = form.querySelector('input[name="monthlyFee"]').value;
        const monthlyFee = monthlyFeeRaw === '' ? null : (parseFloat(monthlyFeeRaw) || 0);
        const stopsRaw = form.querySelector('textarea[name="stops"]').value || '';
        const stops = Array.from(new Set(stopsRaw.split(/\r?\n|,/).map(s => s.trim()).filter(Boolean)));
        const defaultVehicleId = form.querySelector('select[name="defaultVehicleId"]').value || '';
        const defaultDriverId = form.querySelector('select[name="defaultDriverId"]').value || '';
        const active = document.getElementById('routeActive').checked;

        if (!name) {
            alert('Route name is required.');
            return;
        }

        const payload = {
            name,
            monthlyFee,
            stops,
            defaultVehicleId,
            defaultDriverId,
            active,
            tenantId: getTenantId(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: uid
        };

        if (docId) {
            await db.collection('transport_routes').doc(docId).set(payload, { merge: true });
            if (typeof logAudit === 'function') logAudit('transport_route_update', `transport_routes/${docId}`, { name });
        } else {
            const ref = await db.collection('transport_routes').add({
                ...payload,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: uid
            });
            if (typeof logAudit === 'function') logAudit('transport_route_create', `transport_routes/${ref.id}`, { name });
        }

        closeModal('routeModal');
        await loadRoutes();
    } catch (err) {
        console.error(err);
        alert('Failed to save route: ' + (err.message || err));
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = originalText; }
    }
}

async function deleteRoute(routeId) {
    if (!isTopRole(transportState.user?.role)) return;
    if (!confirm('Delete this route?')) return;
    try {
        await db.collection('transport_routes').doc(routeId).delete();
        if (typeof logAudit === 'function') logAudit('transport_route_delete', `transport_routes/${routeId}`, {});
        loadRoutes();
    } catch (err) {
        console.error(err);
        alert('Failed to delete route: ' + (err.message || err));
    }
}

// --- Vehicles ---

async function openVehicleModal(vehicleId = '') {
    if (!isTopRole(transportState.user?.role)) {
        alert('Only admin/principal can manage vehicles.');
        return;
    }

    document.getElementById('vehicleModalTitle').innerText = vehicleId ? 'Edit Vehicle' : 'Add Vehicle';
    const form = document.getElementById('vehicleForm');
    form.reset();
    form.querySelector('input[name="docId"]').value = vehicleId || '';
    document.getElementById('vehicleActive').checked = true;

    if (!vehicleId) {
        openModal('vehicleModal');
        return;
    }

    try {
        const doc = await db.collection('transport_vehicles').doc(vehicleId).get();
        if (!doc.exists) return;
        const v = doc.data() || {};
        form.querySelector('input[name="vehicleNumber"]').value = v.vehicleNumber || '';
        form.querySelector('select[name="type"]').value = v.type || 'Bus';
        form.querySelector('input[name="capacity"]').value = v.capacity ?? 40;
        form.querySelector('input[name="notes"]').value = v.notes || '';
        document.getElementById('vehicleActive').checked = v.active !== false;
        openModal('vehicleModal');
    } catch (err) {
        console.error(err);
        alert('Failed to load vehicle.');
    }
}

async function saveVehicle(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn ? btn.innerText : '';
    if (btn) { btn.disabled = true; btn.innerText = 'Saving...'; }

    try {
        const user = await ensureTransportUser();
        const uid = user?.uid || (firebase.auth().currentUser ? firebase.auth().currentUser.uid : '');

        const docId = form.querySelector('input[name="docId"]').value || '';
        const vehicleNumber = form.querySelector('input[name="vehicleNumber"]').value.trim();
        const type = form.querySelector('select[name="type"]').value || 'Bus';
        const capacity = parseInt(form.querySelector('input[name="capacity"]').value || '0', 10) || 0;
        const notes = form.querySelector('input[name="notes"]').value.trim();
        const active = document.getElementById('vehicleActive').checked;

        if (!vehicleNumber) {
            alert('Vehicle number is required.');
            return;
        }

        const payload = {
            vehicleNumber,
            type,
            capacity,
            notes,
            active,
            tenantId: getTenantId(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: uid
        };

        if (docId) {
            await db.collection('transport_vehicles').doc(docId).set(payload, { merge: true });
            if (typeof logAudit === 'function') logAudit('transport_vehicle_update', `transport_vehicles/${docId}`, { vehicleNumber });
        } else {
            const ref = await db.collection('transport_vehicles').add({
                ...payload,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: uid
            });
            if (typeof logAudit === 'function') logAudit('transport_vehicle_create', `transport_vehicles/${ref.id}`, { vehicleNumber });
        }

        closeModal('vehicleModal');
        await loadVehicles();
    } catch (err) {
        console.error(err);
        alert('Failed to save vehicle: ' + (err.message || err));
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = originalText; }
    }
}

async function deleteVehicle(vehicleId) {
    if (!isTopRole(transportState.user?.role)) return;
    if (!confirm('Delete this vehicle?')) return;
    try {
        await db.collection('transport_vehicles').doc(vehicleId).delete();
        if (typeof logAudit === 'function') logAudit('transport_vehicle_delete', `transport_vehicles/${vehicleId}`, {});
        loadVehicles();
    } catch (err) {
        console.error(err);
        alert('Failed to delete vehicle: ' + (err.message || err));
    }
}

// --- Drivers ---

async function openDriverModal(driverId = '') {
    if (!isTopRole(transportState.user?.role)) {
        alert('Only admin/principal can manage drivers.');
        return;
    }

    document.getElementById('driverModalTitle').innerText = driverId ? 'Edit Driver' : 'Add Driver';
    const form = document.getElementById('driverForm');
    form.reset();
    form.querySelector('input[name="docId"]').value = driverId || '';
    document.getElementById('driverActive').checked = true;

    if (!driverId) {
        openModal('driverModal');
        return;
    }

    try {
        const doc = await db.collection('transport_drivers').doc(driverId).get();
        if (!doc.exists) return;
        const d = doc.data() || {};
        form.querySelector('input[name="name"]').value = d.name || '';
        form.querySelector('input[name="phone"]').value = d.phone || '';
        form.querySelector('input[name="licenseNumber"]').value = d.licenseNumber || '';
        document.getElementById('driverActive').checked = d.active !== false;
        openModal('driverModal');
    } catch (err) {
        console.error(err);
        alert('Failed to load driver.');
    }
}

async function saveDriver(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn ? btn.innerText : '';
    if (btn) { btn.disabled = true; btn.innerText = 'Saving...'; }

    try {
        const user = await ensureTransportUser();
        const uid = user?.uid || (firebase.auth().currentUser ? firebase.auth().currentUser.uid : '');

        const docId = form.querySelector('input[name="docId"]').value || '';
        const name = form.querySelector('input[name="name"]').value.trim();
        const phone = form.querySelector('input[name="phone"]').value.trim();
        const licenseNumber = form.querySelector('input[name="licenseNumber"]').value.trim();
        const active = document.getElementById('driverActive').checked;

        if (!name) {
            alert('Driver name is required.');
            return;
        }

        const payload = {
            name,
            phone,
            licenseNumber,
            active,
            tenantId: getTenantId(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: uid
        };

        if (docId) {
            await db.collection('transport_drivers').doc(docId).set(payload, { merge: true });
            if (typeof logAudit === 'function') logAudit('transport_driver_update', `transport_drivers/${docId}`, { name });
        } else {
            const ref = await db.collection('transport_drivers').add({
                ...payload,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: uid
            });
            if (typeof logAudit === 'function') logAudit('transport_driver_create', `transport_drivers/${ref.id}`, { name });
        }

        closeModal('driverModal');
        await loadDrivers();
    } catch (err) {
        console.error(err);
        alert('Failed to save driver: ' + (err.message || err));
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = originalText; }
    }
}

async function deleteDriver(driverId) {
    if (!isTopRole(transportState.user?.role)) return;
    if (!confirm('Delete this driver?')) return;
    try {
        await db.collection('transport_drivers').doc(driverId).delete();
        if (typeof logAudit === 'function') logAudit('transport_driver_delete', `transport_drivers/${driverId}`, {});
        loadDrivers();
    } catch (err) {
        console.error(err);
        alert('Failed to delete driver: ' + (err.message || err));
    }
}

// --- Assignments ---

async function openAssignmentModal(studentId = '') {
    if (!isTopRole(transportState.user?.role)) {
        alert('Only admin/principal can manage assignments.');
        return;
    }

    document.getElementById('assignmentModalTitle').innerText = studentId ? 'Edit Assignment' : 'Assign Student';
    const form = document.getElementById('assignmentForm');
    form.reset();
    form.querySelector('input[name="studentId"]').value = studentId || '';
    document.getElementById('assignmentActive').checked = true;

    await Promise.all([loadRoutes(), loadDepartments()]);

    const classSel = document.getElementById('assignClass');
    const studentSel = document.getElementById('assignStudent');
    classSel.innerHTML = '<option value="" data-i18n="select_class">Select Class</option>';
    studentSel.innerHTML = '<option value="" data-i18n="select_student">Select Student</option>';
    if (typeof updatePageLanguage === 'function') updatePageLanguage();
    studentSel.disabled = false;
    document.getElementById('assignRoute').value = '';
    populateStopOptions('');

    if (!studentId) {
        openModal('assignmentModal');
        return;
    }

    try {
        const doc = await db.collection('transport_assignments').doc(studentId).get();
        if (!doc.exists) {
            openModal('assignmentModal');
            return;
        }
        const a = doc.data() || {};

        document.getElementById('assignRoute').value = a.routeId || '';
        document.getElementById('assignmentActive').checked = a.active !== false;
        populateStopOptions(a.routeId);
        document.getElementById('assignPickupStop').value = a.pickupStop || '';
        document.getElementById('assignDropStop').value = a.dropStop || '';

        const deptSel = document.getElementById('assignDepartment');
        deptSel.value = a.department || '';
        await loadClasses(a.department || '');
        classSel.value = a.className || '';
        await loadStudents(a.department || '', a.className || '');
        studentSel.value = studentId;
        studentSel.disabled = true;

        openModal('assignmentModal');
    } catch (err) {
        console.error(err);
        alert('Failed to load assignment.');
    }
}

async function loadDepartments(selected = '') {
    const deptSel = document.getElementById('assignDepartment');
    if (!deptSel) return;
    deptSel.innerHTML = '<option value="" data-i18n="select_department">Select Department</option>';
    if (typeof updatePageLanguage === 'function') updatePageLanguage();
    const tenantId = getTenantId();

    try {
        let snap = await db.collection('departments').where('tenantId', '==', tenantId).get();
        if (snap.empty) snap = await db.collection('departments').get();
        const departments = [];
        snap.forEach(doc => { if (doc.data()?.name) departments.push(doc.data().name); });
        departments.sort((a, b) => a.localeCompare(b));
        departments.forEach(dep => {
            const opt = document.createElement('option');
            opt.value = dep;
            opt.innerText = dep;
            deptSel.appendChild(opt);
        });
        if (selected) deptSel.value = selected;
    } catch (err) {
        console.error('Failed to load departments', err);
    }
}

async function loadClasses(department) {
    const classSel = document.getElementById('assignClass');
    if (!classSel) return;
    classSel.innerHTML = '<option value="" data-i18n="select_class">Select Class</option>';
    if (typeof updatePageLanguage === 'function') updatePageLanguage();
    const tenantId = getTenantId();
    if (!department) return;

    try {
        let snap = await db.collection('classes')
            .where('tenantId', '==', tenantId)
            .where('department', '==', department)
            .get();
        if (snap.empty) {
            snap = await db.collection('classes').where('department', '==', department).get();
        }
        const classes = [];
        snap.forEach(doc => { if (doc.data()?.name) classes.push(doc.data().name); });
        classes.sort((a, b) => a.localeCompare(b));
        classes.forEach(cls => {
            const opt = document.createElement('option');
            opt.value = cls;
            opt.innerText = cls;
            classSel.appendChild(opt);
        });
    } catch (err) {
        console.error('Failed to load classes', err);
    }
}

async function loadStudents(department, className) {
    const studentSel = document.getElementById('assignStudent');
    if (!studentSel) return;
    studentSel.innerHTML = '<option value="" data-i18n="select_student">Select Student</option>';
    if (typeof updatePageLanguage === 'function') updatePageLanguage();
    transportState.studentsById = new Map();
    const tenantId = getTenantId();
    if (!department || !className) return;

    try {
        let snap = await db.collection('students')
            .where('tenantId', '==', tenantId)
            .where('department', '==', department)
            .where('className', '==', className)
            .get();
        if (snap.empty) {
            snap = await db.collection('students')
                .where('department', '==', department)
                .where('className', '==', className)
                .get();
        }
        snap.forEach(doc => {
            const s = doc.data() || {};
            const firstName = s.firstName || '';
            const lastName = s.lastName || '';
            const studentName = `${firstName} ${lastName}`.trim() || s.email || doc.id;
            const rollText = s.rollNumber ? ` (Roll ${s.rollNumber})` : '';
            transportState.studentsById.set(doc.id, { id: doc.id, ...s, studentName });
            const opt = document.createElement('option');
            opt.value = doc.id;
            opt.innerText = studentName + rollText;
            studentSel.appendChild(opt);
        });
    } catch (err) {
        console.error('Failed to load students', err);
        studentSel.innerHTML = '<option value="">Failed to load students</option>';
    }
}

function populateStopOptions(routeId) {
    const pickupSel = document.getElementById('assignPickupStop');
    const dropSel = document.getElementById('assignDropStop');
    if (!pickupSel || !dropSel) return;

    const route = transportState.routes.find(r => r.id === routeId);
    const stops = Array.isArray(route?.stops) ? route.stops : [];
    pickupSel.innerHTML = stops.length
        ? '<option value="">Select Stop</option>' + stops.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')
        : '<option value="">Add stops to this route first</option>';

    dropSel.innerHTML = '<option value="">(Optional)</option>' +
        (stops.length ? stops.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('') : '');
}

async function saveAssignment(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn ? btn.innerText : '';
    if (btn) { btn.disabled = true; btn.innerText = 'Saving...'; }

    try {
        const user = await ensureTransportUser();
        const uid = user?.uid || (firebase.auth().currentUser ? firebase.auth().currentUser.uid : '');

        const dept = document.getElementById('assignDepartment').value;
        const cls = document.getElementById('assignClass').value;
        const studentIdSelected = document.getElementById('assignStudent').value;
        const hiddenStudentId = document.querySelector('#assignmentForm input[name="studentId"]').value;
        const studentId = hiddenStudentId || studentIdSelected;
        const routeId = document.getElementById('assignRoute').value;
        const pickupStop = document.getElementById('assignPickupStop').value;
        const dropStop = document.getElementById('assignDropStop').value || pickupStop || '';
        const active = document.getElementById('assignmentActive').checked;

        if (!dept || !cls || !studentId || !routeId || !pickupStop) {
            alert('Please select Department, Class, Student, Route and Pickup stop.');
            return;
        }

        const student = transportState.studentsById.get(studentId) || {};
        const studentName = student.studentName || '';
        const rollNumber = student.rollNumber || '';

        const ref = db.collection('transport_assignments').doc(studentId);
        const existing = await ref.get();
        const payload = {
            studentId,
            studentName,
            rollNumber,
            className: cls,
            department: dept,
            routeId,
            pickupStop,
            dropStop,
            active,
            tenantId: getTenantId(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: uid
        };
        if (!existing.exists) {
            payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            payload.createdBy = uid;
        }

        await ref.set(payload, { merge: true });
        if (typeof logAudit === 'function') {
            logAudit(existing.exists ? 'transport_assignment_update' : 'transport_assignment_create', `transport_assignments/${studentId}`, { routeId, studentId });
        }

        closeModal('assignmentModal');
        loadAssignments();
    } catch (err) {
        console.error(err);
        alert('Failed to save assignment: ' + (err.message || err));
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = originalText; }
    }
}

async function deactivateAssignment(studentId) {
    if (!isTopRole(transportState.user?.role)) return;
    if (!confirm('Remove this student from transport? (Deactivates assignment)')) return;
    try {
        await db.collection('transport_assignments').doc(studentId).set({
            active: false,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: firebase.auth().currentUser ? firebase.auth().currentUser.uid : ''
        }, { merge: true });
        if (typeof logAudit === 'function') logAudit('transport_assignment_deactivate', `transport_assignments/${studentId}`, {});
        loadAssignments();
    } catch (err) {
        console.error(err);
        alert('Failed to remove assignment: ' + (err.message || err));
    }
}

// --- Fee Add-ons ---

function openGenerateFeesModal() {
    if (!canWriteFees(transportState.user?.role)) {
        alert('You do not have permission to generate fees.');
        return;
    }
    document.getElementById('feesYear').value = new Date().getFullYear();
    document.getElementById('feesMonth').value = new Date().toLocaleString('en-US', { month: 'long' });
    document.getElementById('feesStatus').value = 'Pending';
    populateRouteOptions();
    openModal('generateFeesModal');
}

async function ensureTransportFeeHead() {
    const tenantId = getTenantId();
    try {
        let snap = await db.collection('fee_heads')
            .where('name', '==', 'Transport')
            .where('tenantId', '==', tenantId)
            .get();
        if (snap.empty) {
            snap = await db.collection('fee_heads').where('name', '==', 'Transport').get();
        }
        if (!snap.empty) return;
        await db.collection('fee_heads').add({
            name: 'Transport',
            amount: null,
            tenantId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (err) {
        console.warn('Failed to ensure Transport fee head', err?.message || err);
    }
}

async function generateFees(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn ? btn.innerText : '';
    if (btn) { btn.disabled = true; btn.innerText = 'Generating...'; }

    try {
        const routeId = document.getElementById('feesRoute').value;
        const month = document.getElementById('feesMonth').value;
        const year = parseInt(document.getElementById('feesYear').value || '0', 10);
        const dueDate = document.getElementById('feesDueDate').value || null;
        const status = document.getElementById('feesStatus').value || 'Pending';

        if (!routeId || !month || !year) {
            alert('Route, Month and Year are required.');
            return;
        }

        const route = transportState.routes.find(r => r.id === routeId);
        const amount = route?.monthlyFee;
        if (amount === null || amount === undefined) {
            alert('This route does not have a monthly fee set. Set it in Routes first.');
            return;
        }

        await ensureTransportFeeHead();

        const assignSnap = await db.collection('transport_assignments').where('routeId', '==', routeId).get();
        const assignments = [];
        assignSnap.forEach(doc => assignments.push({ id: doc.id, ...doc.data() }));
        const activeAssignments = assignments.filter(a => a.active !== false);

        if (!activeAssignments.length) {
            alert('No active student assignments found for this route.');
            return;
        }

        const tenantId = getTenantId();
        let created = 0;
        let skipped = 0;

        for (const a of activeAssignments) {
            const studentId = a.studentId || a.id;
            const docId = `transport_${routeId}_${studentId}_${year}_${month}`;
            const ref = db.collection('fees').doc(docId);
            const existing = await ref.get();
            if (existing.exists) {
                skipped++;
                continue;
            }

            const feeData = {
                feeType: 'Transport',
                month,
                year,
                amount: parseFloat(amount) || 0,
                discount: 0,
                fine: 0,
                dueDate,
                status,
                tenantId,
                studentId,
                studentName: a.studentName || '',
                rollNumber: a.rollNumber || '',
                className: a.className || '',
                department: a.department || '',
                transportRouteId: routeId,
                transportRouteName: route?.name || '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                paidAt: status === 'Paid' ? firebase.firestore.FieldValue.serverTimestamp() : null
            };

            await ref.set(feeData, { merge: true });
            created++;
        }

        if (typeof logAudit === 'function') logAudit('transport_fee_generate', 'fees', { routeId, month, year, created, skipped });

        closeModal('generateFeesModal');
        alert(`Transport fees generated.\nCreated: ${created}\nSkipped existing: ${skipped}`);
    } catch (err) {
        console.error(err);
        alert('Failed to generate fees: ' + (err.message || err));
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = originalText; }
    }
}

// --- Trips / Pickup-Drop Attendance ---

function prepareTripsTab() {
    populateRouteOptions();
    const dateEl = document.getElementById('tripDate');
    if (dateEl && !dateEl.value) dateEl.value = todayISO();
    setBadge(
        document.getElementById('tripStatusBadge'),
        'badge-info',
        transportState.activeTripId ? 'Trip loaded' : 'No trip loaded'
    );
}

function tripIdFor(routeId, date, session) {
    return `trip_${routeId}_${date}_${session}`;
}

async function loadOrCreateTrip() {
    const routeId = document.getElementById('tripRoute').value;
    const date = document.getElementById('tripDate').value || todayISO();
    const session = document.getElementById('tripSession').value || 'AM';
    if (!routeId) {
        alert('Select a route.');
        return;
    }

    const user = await ensureTransportUser();
    const uid = user?.uid || (firebase.auth().currentUser ? firebase.auth().currentUser.uid : '');

    const tripId = tripIdFor(routeId, date, session);
    const ref = db.collection('transport_trips').doc(tripId);

    try {
        const doc = await ref.get();
        if (!doc.exists) {
            const route = transportState.routes.find(r => r.id === routeId) || {};
            await ref.set({
                routeId,
                date,
                session,
                vehicleId: route.defaultVehicleId || '',
                driverId: route.defaultDriverId || '',
                status: 'planned',
                tenantId: getTenantId(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: uid,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: uid
            }, { merge: true });
            if (typeof logAudit === 'function') logAudit('transport_trip_create', `transport_trips/${tripId}`, { routeId, date, session });
        }

        transportState.activeTripId = tripId;
        transportState.activeTripRouteId = routeId;
        setBadge(document.getElementById('tripStatusBadge'), 'badge-info', `Loaded: ${date} ${session}`);
        await loadTripRoster(tripId, routeId);
    } catch (err) {
        console.error(err);
        alert('Failed to load trip: ' + (err.message || err));
    }
}

async function loadTripRoster(tripId, routeId) {
    const tbody = document.getElementById('tripAttendanceBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="muted">Loading...</td></tr>';

    const tripRef = db.collection('transport_trips').doc(tripId);

    try {
        const assignSnap = await db.collection('transport_assignments').where('routeId', '==', routeId).get();
        const roster = [];
        assignSnap.forEach(doc => roster.push({ id: doc.id, ...doc.data() }));
        const activeRoster = roster.filter(a => a.active !== false);

        transportState.tripRosterByStudentId = new Map(activeRoster.map(a => [a.studentId || a.id, a]));

        if (!activeRoster.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="muted">No active assignments for this route.</td></tr>';
        } else {
            tbody.innerHTML = activeRoster.map(a => {
                const studentId = a.studentId || a.id;
                return `
                    <tr data-student-id="${studentId}">
                        <td style="font-weight:600;">${escapeHtml(a.studentName || '')}</td>
                        <td>${escapeHtml(a.className || '-')}</td>
                        <td>${escapeHtml(a.pickupStop || '-')}</td>
                        <td>${escapeHtml(a.dropStop || '-')}</td>
                        <td data-role="status"><span class="badge badge-warn">PENDING</span></td>
                        <td>
                            <button class="btn-sm" onclick="markTripAttendance('${studentId}','picked')">Picked</button>
                            <button class="btn-sm" onclick="markTripAttendance('${studentId}','dropped')">Dropped</button>
                            <button class="btn-sm" onclick="markTripAttendance('${studentId}','absent')">Absent</button>
                            <button class="btn-sm" onclick="markTripAttendance('${studentId}','reset')">Reset</button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        if (transportState.tripAttendanceUnsub) {
            try { transportState.tripAttendanceUnsub(); } catch (e) { }
            transportState.tripAttendanceUnsub = null;
        }

        transportState.tripAttendanceUnsub = tripRef.collection('attendance').onSnapshot((snap) => {
            snap.forEach(doc => {
                const a = doc.data() || {};
                const row = tbody.querySelector(`tr[data-student-id="${doc.id}"]`);
                if (!row) return;
                const cell = row.querySelector('[data-role="status"]');
                const status = (a.status || 'pending').toLowerCase();
                if (!cell) return;
                if (status === 'picked') cell.innerHTML = '<span class="badge badge-info">PICKED</span>';
                else if (status === 'dropped') cell.innerHTML = '<span class="badge badge-ok">DROPPED</span>';
                else if (status === 'absent') cell.innerHTML = '<span class="badge badge-off">ABSENT</span>';
                else cell.innerHTML = '<span class="badge badge-warn">PENDING</span>';
            });
        }, (err) => {
            console.error('Attendance listener failed', err);
        });
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="6" style="color:red;">Failed to load trip roster.</td></tr>';
    }
}

async function markTripAttendance(studentId, action) {
    const tripId = transportState.activeTripId;
    if (!tripId) return;
    const tripRef = db.collection('transport_trips').doc(tripId);

    const user = await ensureTransportUser();
    const uid = user?.uid || (firebase.auth().currentUser ? firebase.auth().currentUser.uid : '');

    const assignment = transportState.tripRosterByStudentId.get(studentId) || {};
    const base = {
        studentId,
        studentName: assignment.studentName || '',
        className: assignment.className || '',
        pickupStop: assignment.pickupStop || '',
        dropStop: assignment.dropStop || '',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: uid,
        tenantId: getTenantId()
    };

    const ref = tripRef.collection('attendance').doc(studentId);
    const updates = { ...base };

    if (action === 'picked') {
        updates.status = 'picked';
        updates.pickedAt = firebase.firestore.FieldValue.serverTimestamp();
    } else if (action === 'dropped') {
        updates.status = 'dropped';
        updates.droppedAt = firebase.firestore.FieldValue.serverTimestamp();
    } else if (action === 'absent') {
        updates.status = 'absent';
        updates.absentAt = firebase.firestore.FieldValue.serverTimestamp();
    } else {
        updates.status = 'pending';
        updates.pickedAt = firebase.firestore.FieldValue.delete();
        updates.droppedAt = firebase.firestore.FieldValue.delete();
        updates.absentAt = firebase.firestore.FieldValue.delete();
    }

    try {
        await ref.set(updates, { merge: true });
        if (typeof logAudit === 'function') logAudit('transport_trip_attendance', `transport_trips/${tripId}/attendance/${studentId}`, { status: updates.status });
    } catch (err) {
        console.error(err);
        alert('Failed to update attendance: ' + (err.message || err));
    }
}

async function startTrip() {
    const tripId = transportState.activeTripId;
    if (!tripId) return alert('Load a trip first.');
    try {
        await db.collection('transport_trips').doc(tripId).set({
            status: 'in_progress',
            startedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: firebase.auth().currentUser ? firebase.auth().currentUser.uid : ''
        }, { merge: true });
        setBadge(document.getElementById('tripStatusBadge'), 'badge-info', 'IN PROGRESS');
        if (typeof logAudit === 'function') logAudit('transport_trip_start', `transport_trips/${tripId}`, {});
    } catch (err) {
        console.error(err);
        alert('Failed to start trip: ' + (err.message || err));
    }
}

async function completeTrip() {
    const tripId = transportState.activeTripId;
    if (!tripId) return alert('Load a trip first.');
    try {
        await db.collection('transport_trips').doc(tripId).set({
            status: 'completed',
            endedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: firebase.auth().currentUser ? firebase.auth().currentUser.uid : ''
        }, { merge: true });
        setBadge(document.getElementById('tripStatusBadge'), 'badge-ok', 'COMPLETED');
        if (typeof logAudit === 'function') logAudit('transport_trip_complete', `transport_trips/${tripId}`, {});
    } catch (err) {
        console.error(err);
        alert('Failed to complete trip: ' + (err.message || err));
    }
}

// --- Live Tracking (Hook) ---

function prepareTrackingTab() {
    populateVehicleOptions();
    const sel = document.getElementById('trackingVehicle');
    if (sel && !sel.dataset.wired) {
        sel.addEventListener('change', () => loadLastLocation(sel.value));
        sel.dataset.wired = '1';
    }
}

async function loadLastLocation(vehicleId) {
    const el = document.getElementById('locationDisplay');
    if (!el) return;
    if (!vehicleId) {
        el.innerText = 'Select a vehicle to view its last location.';
        return;
    }

    try {
        const doc = await db.collection('transport_locations').doc(vehicleId).get();
        if (!doc.exists) {
            el.innerText = 'No location recorded yet.';
            return;
        }
        const d = doc.data() || {};
        const when = d.updatedAt?.toDate ? d.updatedAt.toDate().toLocaleString() : '';
        el.innerHTML = `
            <div><strong>Lat:</strong> ${escapeHtml(String(d.lat ?? '-'))}</div>
            <div><strong>Lng:</strong> ${escapeHtml(String(d.lng ?? '-'))}</div>
            <div><strong>Accuracy:</strong> ${escapeHtml(String(d.accuracy ?? '-'))} m</div>
            <div><strong>Updated:</strong> ${escapeHtml(when || '-')}</div>
        `;
    } catch (err) {
        console.error(err);
        el.innerText = 'Failed to load location.';
    }
}

async function startTracking() {
    const vehicleId = document.getElementById('trackingVehicle').value;
    if (!vehicleId) return alert('Select a vehicle.');
    if (!navigator.geolocation) return alert('Geolocation is not supported in this browser.');
    if (transportState.trackingWatchId) return;

    const statusEl = document.getElementById('trackingStatus');
    if (statusEl) statusEl.innerText = 'Starting...';

    transportState.trackingLastWriteMs = 0;
    transportState.trackingWatchId = navigator.geolocation.watchPosition(async (pos) => {
        const now = Date.now();
        if (now - transportState.trackingLastWriteMs < 10000) return;
        transportState.trackingLastWriteMs = now;
        await writeLocation(vehicleId, pos.coords);
    }, (err) => {
        console.error(err);
        alert('Geolocation error: ' + err.message);
        stopTracking();
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });

    if (statusEl) statusEl.innerText = 'Tracking is ON (updates every ~10s).';
}

function stopTracking() {
    if (transportState.trackingWatchId) {
        try { navigator.geolocation.clearWatch(transportState.trackingWatchId); } catch (e) { }
        transportState.trackingWatchId = null;
    }
    const statusEl = document.getElementById('trackingStatus');
    if (statusEl) statusEl.innerText = 'Not tracking.';
}

async function writeLocation(vehicleId, coords) {
    try {
        const user = await ensureTransportUser();
        const uid = user?.uid || (firebase.auth().currentUser ? firebase.auth().currentUser.uid : '');
        const payload = {
            vehicleId,
            lat: coords.latitude,
            lng: coords.longitude,
            accuracy: coords.accuracy ?? null,
            heading: coords.heading ?? null,
            speed: coords.speed ?? null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: uid,
            tenantId: getTenantId(),
            activeTripId: transportState.activeTripId || ''
        };
        await db.collection('transport_locations').doc(vehicleId).set(payload, { merge: true });
        loadLastLocation(vehicleId);
        if (typeof logAudit === 'function') {
            logAudit('transport_location_update', `transport_locations/${vehicleId}`, { lat: coords.latitude, lng: coords.longitude });
        }
    } catch (err) {
        console.error(err);
    }
}

// --- Init ---

document.addEventListener('DOMContentLoaded', () => {
    const routeForm = document.getElementById('routeForm');
    if (routeForm) routeForm.addEventListener('submit', saveRoute);
    const vehicleForm = document.getElementById('vehicleForm');
    if (vehicleForm) vehicleForm.addEventListener('submit', saveVehicle);
    const driverForm = document.getElementById('driverForm');
    if (driverForm) driverForm.addEventListener('submit', saveDriver);
    const assignmentForm = document.getElementById('assignmentForm');
    if (assignmentForm) assignmentForm.addEventListener('submit', saveAssignment);
    const feesForm = document.getElementById('generateFeesForm');
    if (feesForm) feesForm.addEventListener('submit', generateFees);

    const deptSel = document.getElementById('assignDepartment');
    if (deptSel && !deptSel.dataset.wired) {
        deptSel.addEventListener('change', async () => {
            await loadClasses(deptSel.value);
            const studentSel = document.getElementById('assignStudent');
            if (studentSel) {
                studentSel.innerHTML = '<option value="" data-i18n="select_student">Select Student</option>';
                if (typeof updatePageLanguage === 'function') updatePageLanguage();
            }
        });
        deptSel.dataset.wired = '1';
    }

    const classSel = document.getElementById('assignClass');
    if (classSel && !classSel.dataset.wired) {
        classSel.addEventListener('change', async () => {
            await loadStudents(deptSel.value, classSel.value);
        });
        classSel.dataset.wired = '1';
    }

    const routeSel = document.getElementById('assignRoute');
    if (routeSel && !routeSel.dataset.wired) {
        routeSel.addEventListener('change', () => populateStopOptions(routeSel.value));
        routeSel.dataset.wired = '1';
    }

    firebase.auth().onAuthStateChanged(async (user) => {
        if (!user) return;
        const current = await ensureTransportUser();
        applyRoleGating(current);

        document.getElementById('tripDate').value = todayISO();

        await Promise.all([loadVehicles(), loadDrivers(), loadRoutes()]);
        switchTransportTab('routes');
    });
});
