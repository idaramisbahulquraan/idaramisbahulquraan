// Timetable page logic: load departments/classes, render timetable grid, add periods, AI optimize.

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
let TIMETABLE_CACHE = {};
let ROOMS_CACHE = [];
let TEACHERS_CACHE = [];
let GENERATED_PREVIEW = null;
let SUBJECT_CACHE = [];
const MANAGE_TIMETABLE_ROLES = ['owner', 'admin', 'principal', 'teacher'];

document.addEventListener('DOMContentLoaded', () => {
    loadDepartmentsForTimetable();
    attachTimetableHandlers();
    attachSubjectDependentHandlers();
});

// ---------- Select Data Loading ----------
function getTenantId() {
    return (typeof getCurrentTenant === 'function') ? getCurrentTenant() : 'default';
}

function getCurrentUserInfo() {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    return {
        uid: user.uid || 'unknown',
        role: (user.role || 'student').toLowerCase(),
        email: user.email || ''
    };
}

function canManageTimetable() {
    return MANAGE_TIMETABLE_ROLES.includes(getCurrentUserInfo().role);
}

function isTopRole() {
    const r = getCurrentUserInfo().role;
    return r === 'owner' || r === 'admin' || r === 'principal';
}

function canManageRooms() {
    return isTopRole();
}

function canApplyGeneratedTimetable() {
    return isTopRole();
}

function canManageCoverage() {
    return isTopRole();
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

async function loadDepartmentsForTimetable() {
    const filterDept = document.getElementById('filterDepartment');
    const modalDept = document.getElementById('department');
    if (!filterDept && !modalDept) return;

    const tenantId = getTenantId();
    const setOptions = (selectEl, items) => {
        if (!selectEl) return;
        selectEl.innerHTML = '<option value="" data-i18n="select_department">Select Department</option>';
        if (typeof updatePageLanguage === 'function') updatePageLanguage();
        items.forEach(dep => {
            const opt = document.createElement('option');
            opt.value = dep.name || dep;
            opt.textContent = dep.name_ur || dep.name || dep;
            selectEl.appendChild(opt);
        });
    };

    try {
        let depsSnap = await db.collection('departments')
            .where('tenantId', '==', tenantId)
            .get();
        let departments = depsSnap.docs.map(d => ({ name: d.data().name, name_ur: d.data().name_ur })).filter(d => d.name);
        if (!departments.length) {
            // Backward compatibility for departments without tenantId
            depsSnap = await db.collection('departments').get();
            departments = depsSnap.docs.map(d => ({ name: d.data().name, name_ur: d.data().name_ur })).filter(d => d.name);
        }

        // Fallback: derive unique departments from classes if departments collection is empty
        if (!departments.length) {
            let classesSnap = await db.collection('classes')
                .where('tenantId', '==', tenantId)
                .get();
            if (!classesSnap.size) {
                classesSnap = await db.collection('classes').get();
            }
            const set = new Map();
            classesSnap.forEach(doc => {
                const dep = doc.data().department;
                if (dep && !set.has(dep)) set.set(dep, { name: dep, name_ur: '' });
            });
            departments = Array.from(set.values());
        }

        setOptions(filterDept, departments);
        setOptions(modalDept, departments);
    } catch (error) {
        console.error('Failed to load departments:', error);
        alert('Could not load departments. Please refresh or check your connection.');
    }
}

async function loadClassesForDepartment(selectId, department) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '<option value="" data-i18n="select_class">Select Class</option>';
    if (typeof updatePageLanguage === 'function') updatePageLanguage();
    if (!department) return;
    try {
        const tenantId = getTenantId();
        let classesSnap = await db.collection('classes')
            .where('tenantId', '==', tenantId)
            .where('department', '==', department)
            .get();
        if (!classesSnap.size) {
            classesSnap = await db.collection('classes')
                .where('department', '==', department)
                .get();
        }
        const seen = new Set();
        classesSnap.forEach(doc => {
            const data = doc.data();
            if (!data.name) return;
            const label = data.name_ur || data.name;
            if (seen.has(label)) return;
            seen.add(label);

            const opt = document.createElement('option');
            opt.value = data.name;
            opt.textContent = label;
            select.appendChild(opt);
        });
        // Keep previously selected class if provided
        const currentVal = select.dataset.prefillValue;
        if (currentVal) {
            select.value = currentVal;
            select.dataset.prefillValue = '';
        }
    } catch (error) {
        console.error('Failed to load classes:', error);
    }
}

function updateFilterClasses() {
    const dept = document.getElementById('filterDepartment')?.value;
    loadClassesForDepartment('filterClass', dept);
    const container = document.getElementById('timetableContainer');
    if (container) {
        container.innerHTML = '<div style="text-align:center;padding:2rem;background:white;border-radius:1rem;" data-i18n="select_dept_class_view">Select Department and Class to view timetable.</div>';
        if (typeof updatePageLanguage === 'function') updatePageLanguage();
    }
}

function updateClasses() {
    const dept = document.getElementById('department')?.value;
    const classSelect = document.getElementById('className');
    if (classSelect) {
        classSelect.dataset.prefillValue = classSelect.value || '';
    }
    loadClassesForDepartment('className', dept);
    loadSubjectsForClass(dept, '');
}

function attachSubjectDependentHandlers() {
    const classSelect = document.getElementById('className');
    if (classSelect) {
        classSelect.addEventListener('change', () => {
            const dept = document.getElementById('department')?.value || '';
            const cls = classSelect.value || '';
            loadSubjectsForClass(dept, cls);
        });
    }
    const deptSelect = document.getElementById('department');
    if (deptSelect) {
        deptSelect.addEventListener('change', () => {
            const dept = deptSelect.value || '';
            const classSelect = document.getElementById('className');
            if (classSelect) {
                classSelect.dataset.prefillValue = '';
            }
            loadClassesForDepartment('className', dept);
            loadSubjectsForClass(dept, '');
        });
    }

    const subjectSelect = document.getElementById('subjectSelect');
    if (subjectSelect) {
        subjectSelect.addEventListener('change', () => {
            const subjectName = subjectSelect.value || '';
            const match = SUBJECT_CACHE.find(s => s.name === subjectName);
            if (match?.teacherId) {
                const teacherSelect = document.getElementById('teacherSelect');
                if (teacherSelect) teacherSelect.value = match.teacherId;
            }
        });
    }
}

// ---------- Rendering ----------
function toMinutes(timeStr) {
    if (!timeStr || !timeStr.includes(':')) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

function minutesToTime(totalMinutes) {
    const mins = Math.max(0, Math.floor(Number(totalMinutes) || 0));
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

function timeRangesOverlap(startA, endA, startB, endB) {
    return startA < endB && startB < endA;
}

async function fetchTimetableForClass(department, className) {
    const tenantId = getTenantId();
    const periods = [];
    if (!department || !className) return periods;

    const pushDocs = (snap) => {
        snap.forEach(doc => periods.push({ id: doc.id, ...(doc.data() || {}) }));
    };

    try {
        try {
            const snap = await db.collection('timetable')
                .where('tenantId', '==', tenantId)
                .where('department', '==', department)
                .where('className', '==', className)
                .get();
            pushDocs(snap);
        } catch (e) {
            const snap = await db.collection('timetable')
                .where('department', '==', department)
                .where('className', '==', className)
                .get();
            pushDocs(snap);
        }
    } catch (e) {
        try {
            const snap = await db.collection('timetable').where('className', '==', className).get();
            snap.forEach(doc => {
                const d = doc.data() || {};
                if (d.department === department) periods.push({ id: doc.id, ...d });
            });
        } catch (err) {
            const snap = await db.collection('timetable').get();
            snap.forEach(doc => {
                const d = doc.data() || {};
                if (d.department === department && d.className === className) periods.push({ id: doc.id, ...d });
            });
        }
    }

    return periods.filter(p => !p.tenantId || p.tenantId === tenantId);
}

async function fetchTimetableForDay(day) {
    const tenantId = getTenantId();
    const periods = [];
    if (!day) return periods;

    try {
        let snap;
        try {
            snap = await db.collection('timetable').where('tenantId', '==', tenantId).where('day', '==', day).get();
        } catch (e) {
            snap = await db.collection('timetable').where('day', '==', day).get();
        }
        snap.forEach(doc => periods.push({ id: doc.id, ...(doc.data() || {}) }));
    } catch (e) {
        console.warn('Failed to load timetable day snapshot:', e?.message || e);
    }

    return periods.filter(p => !p.tenantId || p.tenantId === tenantId);
}

async function loadTimetable() {
    const department = document.getElementById('filterDepartment')?.value;
    const className = document.getElementById('filterClass')?.value;
    const container = document.getElementById('timetableContainer');
    if (!container) return;
    if (!department || !className) {
        container.innerHTML = '<div style="text-align:center;padding:2rem;background:white;border-radius:1rem;" data-i18n="select_dept_class_view">Select Department and Class to view timetable.</div>';
        if (typeof updatePageLanguage === 'function') updatePageLanguage();
        return;
    }

    container.innerHTML = '<div style="text-align:center;padding:2rem;background:white;border-radius:1rem;" data-i18n="loading">Loading...</div>';
    if (typeof updatePageLanguage === 'function') updatePageLanguage();
    try {
        const periods = await fetchTimetableForClass(department, className);
        TIMETABLE_CACHE = periods.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
        const grouped = DAY_ORDER.reduce((acc, day) => ({ ...acc, [day]: [] }), {});
        periods.forEach(p => {
            if (!grouped[p.day]) grouped[p.day] = [];
            grouped[p.day].push(p);
        });
        Object.keys(grouped).forEach(day => {
            grouped[day].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
        });

        let html = '<div class="weekly-grid">';
        DAY_ORDER.forEach(day => {
            const items = grouped[day] || [];
            html += `
                <div class="day-column">
                    <div class="day-header">${day}</div>
                    <div class="day-content">
	                        ${items.length === 0 ? '<div class="empty-slot">No periods</div>' : items.map(p => `
	                            <div class="period-card">
	                                <div class="period-time">${p.startTime || ''} - ${p.endTime || ''}</div>
	                                <div class="period-subject">${p.subject_ur || p.subject || ''}</div>
	                                <div class="period-teacher">${p.teacherName_ur || p.teacherName || ''}</div>
	                                ${p.roomName ? `<div class="muted">Room: ${escapeHtml(p.roomName)}</div>` : ''}
	                                <div class="period-actions">
	                                    <button title="Edit" onclick="openModal('${p.id}')">Edit</button>
	                                    <button title="Delete" onclick="deletePeriod('${p.id}')">Delete</button>
	                                </div>
	                            </div>
	                        `).join('')}
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    } catch (error) {
        console.error('Failed to load timetable:', error);
        container.innerHTML = '<div style="text-align:center;padding:2rem;background:white;border-radius:1rem;color:red;">Failed to load timetable.</div>';
    }
}

// ---------- Modal & CRUD ----------
function attachTimetableHandlers() {
    const form = document.getElementById('addPeriodForm');
    if (form) form.addEventListener('submit', handleAddPeriod);

    const roomForm = document.getElementById('roomForm');
    if (roomForm) roomForm.addEventListener('submit', handleSaveRoom);

    const addBtn = document.querySelector('button[onclick="openModal()"]');
    const aiBtn = document.querySelector('button[onclick="startAutoOptimize()"]');
    const toolsBtn = document.querySelector('button[onclick="openToolsModal()"]');

    const canManage = canManageTimetable();
    [addBtn, aiBtn, toolsBtn].forEach(btn => {
        if (btn && !canManage) {
            btn.disabled = true;
            btn.title = 'Not allowed for your role';
        }
    });

    const coverageDate = document.getElementById('coverageDate');
    if (coverageDate && !coverageDate.value) {
        coverageDate.value = new Date().toISOString().slice(0, 10);
    }
}

async function openModal(docId = null) {
    if (!canManageTimetable()) {
        alert('You do not have permission to manage timetable.');
        return;
    }
    const modal = document.getElementById('addPeriodModal');
    const form = document.getElementById('addPeriodForm');
    if (!modal || !form) return;
    form.reset();
    form.docId.value = docId || '';

    const filterDept = document.getElementById('filterDepartment')?.value || '';
    const filterClass = document.getElementById('filterClass')?.value || '';
    const deptSelect = document.getElementById('department');
    const classSelect = document.getElementById('className');
    if (deptSelect) deptSelect.value = filterDept;
    updateClasses();
    if (classSelect && filterClass) classSelect.value = filterClass;

    const editingPeriod = (docId && TIMETABLE_CACHE[docId]) ? TIMETABLE_CACHE[docId] : null;

    // Prefill when editing
    if (editingPeriod) {
        const p = editingPeriod;
        if (deptSelect) deptSelect.value = p.department || filterDept;
        updateClasses();
        if (classSelect) {
            classSelect.dataset.prefillValue = p.className || filterClass;
            classSelect.value = p.className || filterClass;
        }
        form.day.value = p.day || 'Monday';
        const subjectSelect = document.getElementById('subjectSelect');
        if (subjectSelect) {
            // Ensure the subject appears even if not in list
            const val = p.subject || '';
            subjectSelect.value = val;
            if (subjectSelect.value !== val && val) {
                const opt = document.createElement('option');
                opt.value = val;
                opt.textContent = val;
                subjectSelect.appendChild(opt);
                subjectSelect.value = val;
            }
        }
        form.startTime.value = p.startTime || '';
        form.endTime.value = p.endTime || '';
    }

    const dept = deptSelect?.value || '';
    const cls = classSelect?.value || '';
    await Promise.all([loadTeachersIntoSelect(), loadRooms()]);
    await loadSubjectsForClass(dept, cls, editingPeriod?.subject || '');

    const teacherSelect = document.getElementById('teacherSelect');
    if (teacherSelect && editingPeriod?.teacherId) teacherSelect.value = editingPeriod.teacherId;
    const roomSelect = document.getElementById('roomSelect');
    if (roomSelect && editingPeriod?.roomId) roomSelect.value = editingPeriod.roomId;

    modal.classList.add('active');
}

function closeModal() {
    const modal = document.getElementById('addPeriodModal');
    if (modal) modal.classList.remove('active');
}

async function openToolsModal() {
    if (!canManageTimetable()) {
        alert('You do not have permission to use timetable tools.');
        return;
    }
    const modal = document.getElementById('timetableToolsModal');
    if (!modal) return;
    modal.classList.add('active');
    switchToolsTab('generator');
    GENERATED_PREVIEW = null;
    const previewEl = document.getElementById('generatorPreview');
    if (previewEl) previewEl.innerHTML = '';

    const adminTools = isTopRole();
    await Promise.all([loadTeachersIntoSelect(), adminTools ? loadRooms() : Promise.resolve()]);
    applyToolsRoleGating();
}

function closeToolsModal() {
    const modal = document.getElementById('timetableToolsModal');
    if (modal) modal.classList.remove('active');
}

function switchToolsTab(tab) {
    const valid = ['generator', 'rooms', 'conflicts', 'coverage'];
    const target = valid.includes(tab) ? tab : 'generator';

    document.querySelectorAll('.tools-tab-btn').forEach(btn => btn.classList.remove('active'));
    const btn = document.querySelector(`.tools-tab-btn[onclick="switchToolsTab('${target}')"]`);
    if (btn) btn.classList.add('active');

    document.querySelectorAll('.tools-tab').forEach(div => div.classList.remove('active'));
    const content = document.getElementById(`tools-${target}`);
    if (content) content.classList.add('active');

    if (target === 'rooms') loadRooms();
}

function applyToolsRoleGating() {
    const adminTools = isTopRole();

    const roomsBtn = document.querySelector(`.tools-tab-btn[onclick="switchToolsTab('rooms')"]`);
    const roomsTab = document.getElementById('tools-rooms');
    if (roomsBtn) roomsBtn.style.display = adminTools ? '' : 'none';
    if (roomsTab) roomsTab.style.display = adminTools ? '' : 'none';

    const coverageBtn = document.querySelector(`.tools-tab-btn[onclick="switchToolsTab('coverage')"]`);
    const coverageTab = document.getElementById('tools-coverage');
    if (coverageBtn) coverageBtn.style.display = adminTools ? '' : 'none';
    if (coverageTab) coverageTab.style.display = adminTools ? '' : 'none';

    const applyBtn = document.querySelector(`#timetableToolsModal button[onclick="applyGeneratedTimetable()"]`);
    if (applyBtn) {
        applyBtn.disabled = !canApplyGeneratedTimetable();
        applyBtn.title = applyBtn.disabled ? 'Only admin/owner/principal can apply' : '';
    }
}

async function loadTeachersIntoSelect() {
    const select = document.getElementById('teacherSelect');
    if (!select) return;
    select.innerHTML = '<option value="">Select Teacher</option>';
    try {
        const tenantId = getTenantId();
        let snap;
        try {
            snap = await db.collection('teachers').where('tenantId', '==', tenantId).get();
        } catch (e) {
            snap = await db.collection('teachers').get();
        }
        if (!snap.size) snap = await db.collection('teachers').get();

        const teachers = snap.docs.map(doc => {
            const data = doc.data() || {};
            const name = data.name_ur || `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.email || 'Teacher';
            return { id: doc.id, name, email: data.email || '', tenantId: data.tenantId || '' };
        }).filter(t => !t.tenantId || t.tenantId === tenantId);

        teachers.sort((a, b) => a.name.localeCompare(b.name));
        TEACHERS_CACHE = teachers;

        teachers.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.name;
            select.appendChild(opt);
        });
    } catch (error) {
        console.error('Failed to load teachers:', error);
    }
}

// ---------- Rooms ----------
async function loadRooms() {
    const tenantId = getTenantId();
    try {
        let snap;
        try {
            snap = await db.collection('timetable_rooms').where('tenantId', '==', tenantId).get();
        } catch (e) {
            snap = await db.collection('timetable_rooms').get();
        }
        if (!snap.size) snap = await db.collection('timetable_rooms').get();

        const rooms = snap.docs.map(doc => {
            const r = doc.data() || {};
            return {
                id: doc.id,
                name: r.name || '',
                type: r.type || 'Classroom',
                capacity: Number.isFinite(Number(r.capacity)) ? Number(r.capacity) : '',
                active: r.active !== false,
                notes: r.notes || '',
                tenantId: r.tenantId || ''
            };
        }).filter(r => !r.tenantId || r.tenantId === tenantId);

        rooms.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        ROOMS_CACHE = rooms;
        populateRoomSelect();
        renderRoomsTable();
    } catch (err) {
        console.error('Failed to load rooms:', err);
        ROOMS_CACHE = [];
        populateRoomSelect();
        renderRoomsTable();
    }
}

function populateRoomSelect(selectedId = '') {
    const select = document.getElementById('roomSelect');
    if (!select) return;
    select.innerHTML = '<option value="">(Optional) Select Room</option>';
    ROOMS_CACHE.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = (r.name || r.id) + (r.active === false ? ' (Inactive)' : '');
        select.appendChild(opt);
    });
    if (selectedId) select.value = selectedId;
}

function renderRoomsTable() {
    const tbody = document.getElementById('roomsBody');
    if (!tbody) return;
    if (!ROOMS_CACHE.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="muted">No rooms yet.</td></tr>';
        return;
    }

    tbody.innerHTML = ROOMS_CACHE.map(r => `
        <tr>
            <td>${escapeHtml(r.name || '-')}</td>
            <td>${escapeHtml(r.type || '-')}</td>
            <td>${escapeHtml(String(r.capacity || '-'))}</td>
            <td>${r.active !== false ? '<span class="muted">Active</span>' : '<span style="color:#991b1b;">Inactive</span>'}</td>
            <td>
                <button class="btn-sm" onclick="editRoom('${r.id}')">Edit</button>
                <button class="btn-sm danger" onclick="deleteRoom('${r.id}')">Delete</button>
            </td>
        </tr>
    `).join('');
}

function resetRoomForm() {
    const form = document.getElementById('roomForm');
    if (!form) return;
    form.reset();
    const idField = form.querySelector('input[name="roomId"]');
    if (idField) idField.value = '';
    const active = form.querySelector('input[name="active"]');
    if (active) active.checked = true;
}

async function handleSaveRoom(e) {
    e.preventDefault();
    if (!canManageRooms()) {
        alert('You do not have permission to manage rooms.');
        return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn ? btn.innerText : '';
    if (btn) { btn.disabled = true; btn.innerText = 'Saving...'; }

    try {
        const formData = new FormData(e.target);
        const roomId = (formData.get('roomId') || '').toString();
        const name = (formData.get('name') || '').toString().trim();
        const type = (formData.get('type') || 'Classroom').toString();
        const capacityRaw = (formData.get('capacity') || '').toString().trim();
        const capacity = capacityRaw ? Math.max(0, Math.floor(Number(capacityRaw))) : '';
        const active = !!e.target.querySelector('input[name="active"]')?.checked;
        const notes = (formData.get('notes') || '').toString().trim();

        if (!name) return alert('Room name is required.');

        const tenantId = getTenantId();
        const user = getCurrentUserInfo();
        const payload = {
            name,
            type,
            capacity,
            active,
            notes,
            tenantId,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: user.uid
        };

        if (roomId) {
            await db.collection('timetable_rooms').doc(roomId).set(payload, { merge: true });
        } else {
            await db.collection('timetable_rooms').add({
                ...payload,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: user.uid
            });
        }
        if (typeof logAudit === 'function') logAudit(roomId ? 'timetable_room_update' : 'timetable_room_create', `timetable_rooms/${roomId || ''}`, { name, type, active });
        resetRoomForm();
        await loadRooms();
    } catch (err) {
        console.error(err);
        alert('Failed to save room: ' + (err.message || err));
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = originalText || 'Save Room'; }
    }
}

function editRoom(id) {
    if (!canManageRooms()) return;
    const r = ROOMS_CACHE.find(x => x.id === id);
    if (!r) return;
    const form = document.getElementById('roomForm');
    if (!form) return;
    form.querySelector('input[name="roomId"]').value = id;
    form.querySelector('input[name="name"]').value = r.name || '';
    form.querySelector('select[name="type"]').value = r.type || 'Classroom';
    form.querySelector('input[name="capacity"]').value = r.capacity !== '' ? String(r.capacity) : '';
    const active = form.querySelector('input[name="active"]');
    if (active) active.checked = r.active !== false;
    form.querySelector('input[name="notes"]').value = r.notes || '';
}

async function deleteRoom(id) {
    if (!canManageRooms()) return;
    const r = ROOMS_CACHE.find(x => x.id === id);
    if (!confirm(`Delete room "${r?.name || id}"?`)) return;
    try {
        await db.collection('timetable_rooms').doc(id).delete();
        if (typeof logAudit === 'function') logAudit('timetable_room_delete', `timetable_rooms/${id}`, { name: r?.name || '' });
        await loadRooms();
    } catch (err) {
        console.error(err);
        alert('Failed to delete room: ' + (err.message || err));
    }
}

async function fetchSubjectsForClass(department, className) {
    const tenantId = getTenantId();
    const subjects = [];
    if (!department || !className) return subjects;

    try {
        let snap;
        try {
            snap = await db.collection('subjects')
                .where('department', '==', department)
                .where('className', '==', className)
                .get();
        } catch (e) {
            snap = await db.collection('subjects').get();
        }

        snap.forEach(doc => {
            const d = doc.data() || {};
            if (d.department !== department || d.className !== className) return;
            subjects.push({
                id: doc.id,
                name: d.name || '',
                name_ur: d.name_ur || d.name,
                teacherId: d.teacherId || '',
                teacherName: d.teacherName || '',
                tenantId: d.tenantId || ''
            });
        });
    } catch (err) {
        console.error('Failed to load subjects:', err);
    }

    const filtered = subjects.filter(s => !s.tenantId || s.tenantId === tenantId).filter(s => !!s.name);
    filtered.sort((a, b) => {
        const aLabel = (typeof getSubjectDisplayName === 'function') ? getSubjectDisplayName(a) : (a.name_ur || a.name || '');
        const bLabel = (typeof getSubjectDisplayName === 'function') ? getSubjectDisplayName(b) : (b.name_ur || b.name || '');
        return aLabel.localeCompare(bLabel);
    });
    return filtered;
}

async function loadSubjectsForClass(department, className, preselect = '') {
    const subjectSelect = document.getElementById('subjectSelect');
    if (!subjectSelect) return;
    subjectSelect.innerHTML = '<option value="" data-i18n="select_subject">Select Subject</option>';
    if (typeof updatePageLanguage === 'function') updatePageLanguage();
    if (!department || !className) return;
    try {
        const subjects = await fetchSubjectsForClass(department, className);
        SUBJECT_CACHE = subjects;
        subjects.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.name;
            opt.textContent = (typeof getSubjectDisplayName === 'function') ? getSubjectDisplayName(s) : (s.name_ur || s.name);
            subjectSelect.appendChild(opt);
        });
        if (preselect) {
            subjectSelect.value = preselect;
            if (subjectSelect.value !== preselect) {
                const opt = document.createElement('option');
                opt.value = preselect;
                opt.textContent = preselect;
                subjectSelect.appendChild(opt);
                subjectSelect.value = preselect;
            }
        }
    } catch (error) {
        console.error('Failed to load subjects:', error);
    }
}

async function checkConflict(teacherId, day, startTime, endTime, className, department, currentId = null, roomId = '') {
    const startMins = toMinutes(startTime);
    const endMins = toMinutes(endTime);
    if (!day || !startTime || !endTime || endMins <= startMins) {
        return 'Invalid time range.';
    }

    const periods = await fetchTimetableForDay(day);
    for (const p of periods) {
        if (currentId && p.id === currentId) continue;
        if (!p.startTime || !p.endTime) continue;
        const pStart = toMinutes(p.startTime);
        const pEnd = toMinutes(p.endTime);
        if (!timeRangesOverlap(startMins, endMins, pStart, pEnd)) continue;

        if (department && className && p.department === department && p.className === className) {
            return `Class already has a period overlapping (${p.startTime}-${p.endTime}).`;
        }

        if (teacherId && p.teacherId === teacherId) {
            return `Teacher is busy between ${p.startTime}-${p.endTime}.`;
        }

        if (roomId && p.roomId && p.roomId === roomId) {
            return `Room is occupied between ${p.startTime}-${p.endTime}.`;
        }
    }
    return null;
}

async function handleAddPeriod(event) {
    event.preventDefault();
    const form = event.target;
    const data = Object.fromEntries(new FormData(form).entries());
    const { department, className, day, startTime, endTime, subject, teacherId, roomId, docId } = data;
    const tenantId = getTenantId();
    const user = getCurrentUserInfo();

    if (!department || !className) {
        alert('Please select department and class.');
        return;
    }

    const conflictMsg = await checkConflict(teacherId, day, startTime, endTime, className, department, docId || null, roomId || '');
    if (conflictMsg && !confirm(`${conflictMsg}\nSave anyway?`)) return;

    try {
        const roomName = roomId ? (document.querySelector('#roomSelect option:checked')?.textContent || '') : '';
        const selectedSubject = Array.isArray(SUBJECT_CACHE) ? SUBJECT_CACHE.find(s => s.name === subject) : null;
        const subjectDisplayName = (typeof getSubjectDisplayName === 'function')
            ? getSubjectDisplayName(selectedSubject || { name: subject, name_ur: subject })
            : ((selectedSubject && (selectedSubject.name_ur || selectedSubject.name)) || subject);
        if (docId) {
            await db.collection('timetable').doc(docId).set({
                department,
                className,
                day,
                startTime,
                endTime,
                subject,
                subject_ur: subjectDisplayName,
                teacherId,
                teacherName: document.querySelector('#teacherSelect option:checked')?.textContent || '',
                roomId: roomId || '',
                roomName: roomName || '',
                tenantId,
                updatedBy: user.uid,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            logTimetableAudit('update', { periodId: docId, tenantId, department, className, day, startTime, endTime, subject, teacherId });
        } else {
            const docRef = await db.collection('timetable').add({
                department,
                className,
                day,
                startTime,
                endTime,
                subject,
                subject_ur: subjectDisplayName,
                teacherId,
                teacherName: document.querySelector('#teacherSelect option:checked')?.textContent || '',
                roomId: roomId || '',
                roomName: roomName || '',
                tenantId,
                createdBy: user.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            logTimetableAudit('create', { periodId: docRef.id, tenantId, department, className, day, startTime, endTime, subject, teacherId });
        }
        closeModal();
        loadTimetable();
    } catch (error) {
        console.error('Failed to save period:', error);
        alert('Failed to save period: ' + error.message);
    }
}

async function deletePeriod(periodId) {
    if (!canManageTimetable()) {
        alert('You do not have permission to delete periods.');
        return;
    }
    if (!periodId) return;
    const entry = TIMETABLE_CACHE[periodId];
    const label = entry ? `${entry.className || ''} (${entry.day || ''} ${entry.startTime || ''}-${entry.endTime || ''})` : periodId;
    if (!confirm(`Delete this period? ${label}`)) return;
    try {
        const tenantId = getTenantId();
        await db.collection('timetable').doc(periodId).delete();
        logTimetableAudit('delete', { periodId, tenantId, department: entry?.department, className: entry?.className, day: entry?.day });
        loadTimetable();
    } catch (error) {
        console.error('Failed to delete period:', error);
        alert('Failed to delete period: ' + error.message);
    }
}

function getSelectedClassContext(requireSelected = true) {
    const department = document.getElementById('filterDepartment')?.value || '';
    const className = document.getElementById('filterClass')?.value || '';
    if (requireSelected && (!department || !className)) {
        alert('Please select a Department and Class first.');
        return null;
    }
    return { department, className };
}

async function downloadTimetablePDF() {
    const ctx = getSelectedClassContext(true);
    if (!ctx) return;

    try {
        const periods = await fetchTimetableForClass(ctx.department, ctx.className);
        if (!periods.length) {
            alert('No timetable found for this class.');
            return;
        }

        const classUrdu = {
            "Aamma Year 1": "عامہ سال اول",
            "Aamma Year 2": "عامہ سال دوم",
            "Khassa Year 1": "خاصہ سال اول",
            "Khassa Year 2": "خاصہ سال دوم",
            "Aliya Year 1": "عالیہ سال اول",
            "Aliya Year 2": "عالیہ سال دوم",
            "Alamiya Year 1": "عالمیہ سال اول",
            "Alamiya Year 2": "عالمیہ سال دوم",
            "Aamma Year 1 (Arabic Language Foundation Course)": "عامہ سال اول (عریبک لینگوئج کورس)",
            "Aamma Year 2 (English Language Foundation Course)": "عامہ سال دوم (انگلش لینگوئج کورس)",
            "Hifz Class": "حفظ کلاس",
            "Abee Bin Kaab": "ابی بن کعب",
            "Zaid Bin Sabit": "زید بن ثابت",
            "Abdullah Bin Abbas": "عبداللہ بن عباس",
            "Abdullah Bin Masood": "عبداللہ بن مسعود",
            "Osman Ghani": "عثمان غنی",
            "Musab Bin Omair": "مصعب بن عمیر",
            "Abu Bakar Siddique": "ابوبکر صدیق",
            "Amer Bin Khatab": "عمر بن خطاب",
            "Naseerah Murseed": "نصیرہ مرشد",
            "Tajweed Class 1st year": "تجوید کلاس سال اول",
            "Tajweed Class 2nd year": "تجوید کلاس سال دوم",
            "Class 1st year": "تجوید کلاس سال اول",
            "Class 2nd year": "تجوید کلاس سال دوم"
        };
        const deptUrdu = {
            "Dars-e-Nizami Department": "شعبہ درس نظامی",
            "Hifz Department": "شعبہ تحفیظ القرآن",
            "Tajweed Department": "شعبہ تجوید و قرأت"
        };

        const displayDept = deptUrdu[ctx.department] || ctx.department;
        const displayClass = classUrdu[ctx.className] || ctx.className;

        // Sort periods
        const dayIndex = DAY_ORDER.reduce((acc, d, i) => ({ ...acc, [d]: i }), {});
        periods.sort((a, b) => {
            const da = dayIndex[a.day] ?? 999;
            const dbi = dayIndex[b.day] ?? 999;
            if (da !== dbi) return da - dbi;
            return (a.startTime || '').localeCompare(b.startTime || '');
        });

        const table = document.createElement('table');
        table.className = 'data-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Day</th>
                    <th>Time</th>
                    <th>Subject</th>
                    <th>Teacher</th>
                    <th>Room</th>
                </tr>
            </thead>
            <tbody>
                ${periods.map(p => `
                    <tr>
                        <td>${p.day || ''}</td>
                        <td style="text-align:center;">${p.startTime || ''} - ${p.endTime || ''}</td>
                        <td>${p.subject_ur || p.subject || ''}</td>
                        <td>${p.teacherName_ur || p.teacherName || ''}</td>
                        <td>${p.roomName || ''}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;

        window.PDFSnapshot.generate({
            title: getTrans('class_schedules'),
            subtitle: `${displayDept} | ${displayClass}`,
            content: table.outerHTML
        });

    } catch (e) {
        console.error(e);
        alert("Error generating PDF: " + e.message);
    }
}

// ---------- Timetable Tools ----------

function getGeneratorSelectedDays() {
    const mapping = [
        { id: 'genDayMon', day: 'Monday' },
        { id: 'genDayTue', day: 'Tuesday' },
        { id: 'genDayWed', day: 'Wednesday' },
        { id: 'genDayThu', day: 'Thursday' },
        { id: 'genDayFri', day: 'Friday' },
        { id: 'genDaySat', day: 'Saturday' },
        { id: 'genDaySun', day: 'Sunday' }
    ];
    return mapping.filter(m => document.getElementById(m.id)?.checked).map(m => m.day);
}

function getGeneratorConfig() {
    const days = getGeneratorSelectedDays();
    const startTime = document.getElementById('genStartTime')?.value || '08:00';
    const endTime = document.getElementById('genEndTime')?.value || '13:30';
    const periodMinutes = Math.max(10, Math.floor(Number(document.getElementById('genPeriodMinutes')?.value || 45)));

    const breakStart = (document.getElementById('genBreakStart')?.value || '').trim();
    const breakEnd = (document.getElementById('genBreakEnd')?.value || '').trim();

    const maxPeriodsRaw = (document.getElementById('genMaxPeriods')?.value || '').toString().trim();
    const maxPeriodsPerDay = maxPeriodsRaw ? Math.max(1, Math.floor(Number(maxPeriodsRaw))) : null;

    const replaceExisting = !!document.getElementById('genReplaceExisting')?.checked;
    const assignRooms = !!document.getElementById('genAssignRooms')?.checked;
    const useSubjectTeachers = !!document.getElementById('genUseSubjectTeachers')?.checked;

    return { days, startTime, endTime, periodMinutes, breakStart, breakEnd, maxPeriodsPerDay, replaceExisting, assignRooms, useSubjectTeachers };
}

function buildDailySlots(config) {
    const slots = [];
    const startMins = toMinutes(config.startTime);
    const endMins = toMinutes(config.endTime);
    if (endMins <= startMins) return slots;

    const breakStartMins = config.breakStart ? toMinutes(config.breakStart) : null;
    const breakEndMins = config.breakEnd ? toMinutes(config.breakEnd) : null;
    const hasBreak = breakStartMins !== null && breakEndMins !== null && breakEndMins > breakStartMins;

    let cur = startMins;
    while (cur + config.periodMinutes <= endMins) {
        const next = cur + config.periodMinutes;
        if (hasBreak && timeRangesOverlap(cur, next, breakStartMins, breakEndMins)) {
            cur = breakEndMins;
            continue;
        }
        slots.push({ startMins: cur, endMins: next, startTime: minutesToTime(cur), endTime: minutesToTime(next) });
        cur = next;
        if (config.maxPeriodsPerDay && slots.length >= config.maxPeriodsPerDay) break;
    }
    return slots;
}

function teacherNameById(id) {
    return TEACHERS_CACHE.find(t => t.id === id)?.name || '';
}

function isTeacherFree(teacherId, day, slot, existingForDay, plannedPeriods) {
    if (!teacherId) return false;
    const conflicts = (p) => p.teacherId === teacherId
        && p.day === day
        && p.startTime && p.endTime
        && timeRangesOverlap(slot.startMins, slot.endMins, toMinutes(p.startTime), toMinutes(p.endTime));
    if (existingForDay.some(conflicts)) return false;
    if (plannedPeriods.some(conflicts)) return false;
    return true;
}

function isRoomFree(roomId, day, slot, existingForDay, plannedPeriods) {
    if (!roomId) return false;
    const conflicts = (p) => p.roomId === roomId
        && p.day === day
        && p.startTime && p.endTime
        && timeRangesOverlap(slot.startMins, slot.endMins, toMinutes(p.startTime), toMinutes(p.endTime));
    if (existingForDay.some(conflicts)) return false;
    if (plannedPeriods.some(conflicts)) return false;
    return true;
}

function renderGeneratorPreview(preview) {
    const el = document.getElementById('generatorPreview');
    if (!el) return;

    if (!preview || !preview.periods?.length) {
        el.innerHTML = '<div class="muted">No preview available.</div>';
        return;
    }

    const byDay = DAY_ORDER.reduce((acc, d) => ({ ...acc, [d]: [] }), {});
    preview.periods.forEach(p => {
        if (!byDay[p.day]) byDay[p.day] = [];
        byDay[p.day].push(p);
    });
    Object.keys(byDay).forEach(day => byDay[day].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime)));

    const displayDept = (typeof DEPT_NAME_MAP !== 'undefined' ? DEPT_NAME_MAP[preview.department] : null) || preview.department;
    const displayClass = (typeof CLASS_NAME_MAP !== 'undefined' ? CLASS_NAME_MAP[preview.className] : null) || preview.className;

    let html = `
        <div style="padding:0.85rem;border:1px solid var(--border-color);border-radius:0.75rem;background:#f8fafc;">
            <div style="font-weight:700;">${getTrans('preview')}: ${escapeHtml(displayDept)} / ${escapeHtml(displayClass)}</div>
            <div class="muted">${getTrans('periods')}: ${preview.periods.length} • ${getTrans('issues')}: ${conflictCount}</div>
        </div>
    `;

    DAY_ORDER.forEach(day => {
        if (!preview.config.days.includes(day)) return;
        const periods = byDay[day] || [];
        html += `
            <div style="margin-top:1rem;">
                <div style="font-weight:700;margin-bottom:0.5rem;">${day}</div>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>${getTrans('time')}</th>
                                <th>${getTrans('subject')}</th>
                                <th>${getTrans('teacher')}</th>
                                <th>${getTrans('room')}</th>
                                <th>${getTrans('issues')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${periods.map(p => `
                                <tr style="${p.issues?.length ? 'background:#fff1f2;' : ''}">
                                    <td>${escapeHtml(`${p.startTime} - ${p.endTime}`)}</td>
                                    <td>${escapeHtml(p.subject_ur || p.subject || '')}</td>
                                    <td>${escapeHtml(p.teacherName_ur || p.teacherName || '-')}${p.teacherId ? '' : ` (${getTrans('missing')})`}</td>
                                    <td>${escapeHtml(p.roomName || '-')}</td>
                                    <td>${p.issues?.length ? escapeHtml(p.issues.join(' | ')) : '<span class=\"muted\">-</span>'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    });

    el.innerHTML = html;
}

async function previewGenerateTimetable() {
    const ctx = getSelectedClassContext(true);
    if (!ctx) return;

    const config = getGeneratorConfig();
    if (!config.days.length) return alert('Select at least one day.');

    const slots = buildDailySlots(config);
    if (!slots.length) return alert('No time slots available. Check start/end/break settings.');

    if (!TEACHERS_CACHE.length) await loadTeachersIntoSelect();
    if (config.assignRooms && !ROOMS_CACHE.length) await loadRooms();

    const subjects = await fetchSubjectsForClass(ctx.department, ctx.className);
    if (!subjects.length) return alert('No subjects found for this class. Add subjects first.');

    const activeRooms = ROOMS_CACHE.filter(r => r.active !== false);
    const existingByDay = {};
    await Promise.all(config.days.map(async (d) => {
        existingByDay[d] = await fetchTimetableForDay(d);
    }));

    const planned = [];
    const teacherLoad = new Map();
    let subjectIdx = 0;

    for (const day of config.days) {
        for (const slot of slots) {
            const subject = subjects[subjectIdx % subjects.length];
            subjectIdx += 1;

            const issues = [];

            let teacherId = '';
            let teacherName = '';
            const preferredTeacher = (config.useSubjectTeachers && subject.teacherId) ? subject.teacherId : '';
            if (preferredTeacher && isTeacherFree(preferredTeacher, day, slot, existingByDay[day] || [], planned)) {
                teacherId = preferredTeacher;
                teacherName = teacherNameById(preferredTeacher) || subject.teacherName || '';
            } else {
                const candidates = TEACHERS_CACHE
                    .slice()
                    .sort((a, b) => (teacherLoad.get(a.id) || 0) - (teacherLoad.get(b.id) || 0) || a.name.localeCompare(b.name));
                const found = candidates.find(t => isTeacherFree(t.id, day, slot, existingByDay[day] || [], planned));
                if (found) {
                    teacherId = found.id;
                    teacherName = found.name;
                } else if (preferredTeacher) {
                    teacherId = preferredTeacher;
                    teacherName = teacherNameById(preferredTeacher) || subject.teacherName || '';
                    issues.push('Teacher conflict');
                } else {
                    issues.push('Missing teacher');
                }
            }

            if (teacherId) {
                teacherLoad.set(teacherId, (teacherLoad.get(teacherId) || 0) + 1);
                if (!isTeacherFree(teacherId, day, slot, existingByDay[day] || [], planned)) issues.push('Teacher conflict');
            }

            let roomId = '';
            let roomName = '';
            if (config.assignRooms) {
                const foundRoom = activeRooms.find(r => isRoomFree(r.id, day, slot, existingByDay[day] || [], planned));
                if (foundRoom) {
                    roomId = foundRoom.id;
                    roomName = foundRoom.name || '';
                } else if (activeRooms.length) {
                    issues.push('No room available');
                }
            }

            if (roomId && !isRoomFree(roomId, day, slot, existingByDay[day] || [], planned)) issues.push('Room conflict');

            if (!config.replaceExisting) {
                const existingClass = (existingByDay[day] || []).filter(p => p.department === ctx.department && p.className === ctx.className);
                const overlapsClass = existingClass.some(p => p.startTime && p.endTime
                    && timeRangesOverlap(slot.startMins, slot.endMins, toMinutes(p.startTime), toMinutes(p.endTime)));
                if (overlapsClass) issues.push('Class conflict with existing schedule');
            }

            planned.push({
                department: ctx.department,
                className: ctx.className,
                day,
                startTime: slot.startTime,
                endTime: slot.endTime,
                subject: subject.name,
                subject_ur: (typeof getSubjectDisplayName === 'function') ? getSubjectDisplayName(subject) : (subject.name_ur || subject.name),
                teacherId,
                teacherName,
                teacherName_ur: teacherName, // Already preferred Urdu in teacherNameById or loadTeachersIntoSelect
                roomId,
                roomName,
                issues
            });
        }
    }

    GENERATED_PREVIEW = { department: ctx.department, className: ctx.className, config, periods: planned };
    renderGeneratorPreview(GENERATED_PREVIEW);
}

async function batchDeleteTimetable(periodIds) {
    const ids = (periodIds || []).filter(Boolean);
    if (!ids.length) return;

    const chunkSize = 400;
    for (let i = 0; i < ids.length; i += chunkSize) {
        const batch = db.batch();
        ids.slice(i, i + chunkSize).forEach(id => batch.delete(db.collection('timetable').doc(id)));
        await batch.commit();
    }
}

async function applyGeneratedTimetable() {
    if (!canApplyGeneratedTimetable()) {
        alert('You do not have permission to apply timetable changes.');
        return;
    }

    if (!GENERATED_PREVIEW || !GENERATED_PREVIEW.periods?.length) {
        alert('Generate a preview first.');
        return;
    }

    const issueCount = GENERATED_PREVIEW.periods.reduce((sum, p) => sum + (p.issues?.length ? 1 : 0), 0);
    if (issueCount && !confirm(`Preview contains issues in ${issueCount} period(s). Apply anyway?`)) return;

    if (!confirm(`Apply generated timetable for ${GENERATED_PREVIEW.department} / ${GENERATED_PREVIEW.className}?`)) return;

    const ctx = { department: GENERATED_PREVIEW.department, className: GENERATED_PREVIEW.className };
    const tenantId = getTenantId();
    const user = getCurrentUserInfo();

    try {
        if (GENERATED_PREVIEW.config.replaceExisting) {
            const existing = await fetchTimetableForClass(ctx.department, ctx.className);
            await batchDeleteTimetable(existing.map(p => p.id));
        }

        const periods = GENERATED_PREVIEW.periods.map(p => ({
            department: ctx.department,
            className: ctx.className,
            day: p.day,
            startTime: p.startTime,
            endTime: p.endTime,
            subject: p.subject,
            teacherId: p.teacherId || '',
            teacherName: p.teacherName || '',
            roomId: p.roomId || '',
            roomName: p.roomName || '',
            tenantId,
            isAutoGenerated: true,
            createdBy: user.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }));

        const chunkSize = 350;
        for (let i = 0; i < periods.length; i += chunkSize) {
            const batch = db.batch();
            periods.slice(i, i + chunkSize).forEach(p => {
                const ref = db.collection('timetable').doc();
                batch.set(ref, p);
            });
            await batch.commit();
        }

        if (typeof logAudit === 'function') {
            logAudit('timetable_generate_apply', 'timetable', {
                department: ctx.department,
                className: ctx.className,
                count: periods.length,
                issues: issueCount
            });
        }

        alert(`Applied ${periods.length} period(s).`);
        await loadTimetable();
    } catch (err) {
        console.error(err);
        alert('Failed to apply generated timetable: ' + (err.message || err));
    }
}

async function scanTimetableConflicts() {
    const scope = document.getElementById('conflictScope')?.value || 'class';
    const tenantId = getTenantId();
    const resultEl = document.getElementById('conflictResults');
    if (resultEl) resultEl.innerHTML = '<div class="muted">Scanning...</div>';

    const ctx = getSelectedClassContext(scope !== 'all');
    if (!ctx && scope !== 'all') return;

    try {
        const snap = await db.collection('timetable').get();
        const all = snap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
            .filter(p => !p.tenantId || p.tenantId === tenantId);

        let focus = all;
        if (scope === 'class') focus = all.filter(p => p.department === ctx.department && p.className === ctx.className);
        if (scope === 'department') focus = all.filter(p => p.department === ctx.department);

        if (!focus.length) {
            if (resultEl) resultEl.innerHTML = '<div class="muted">No periods found for this scope.</div>';
            return;
        }

        const byDay = {};
        all.forEach(p => {
            if (!p.day) return;
            if (!byDay[p.day]) byDay[p.day] = [];
            byDay[p.day].push(p);
        });

        const conflicts = [];
        const seen = new Set();

        for (const a of focus) {
            if (!a.day || !a.startTime || !a.endTime) continue;
            const aStart = toMinutes(a.startTime);
            const aEnd = toMinutes(a.endTime);
            if (aEnd <= aStart) {
                conflicts.push({ type: 'invalid', message: `Invalid time range on ${a.day} (${a.startTime}-${a.endTime})`, a, b: null });
                continue;
            }

            const candidates = byDay[a.day] || [];
            for (const b of candidates) {
                if (b.id === a.id) continue;
                if (!b.startTime || !b.endTime) continue;
                const bStart = toMinutes(b.startTime);
                const bEnd = toMinutes(b.endTime);
                if (!timeRangesOverlap(aStart, aEnd, bStart, bEnd)) continue;

                const id1 = a.id < b.id ? a.id : b.id;
                const id2 = a.id < b.id ? b.id : a.id;

                if (a.department === b.department && a.className === b.className) {
                    const key = `class|${id1}|${id2}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        conflicts.push({ type: 'class', message: `Class overlap: ${a.department}/${a.className} (${a.day} ${a.startTime}-${a.endTime})`, a, b });
                    }
                }

                if (a.teacherId && b.teacherId && a.teacherId === b.teacherId) {
                    const key = `teacher|${id1}|${id2}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        conflicts.push({ type: 'teacher', message: `Teacher overlap: ${a.teacherName || a.teacherId} (${a.day} ${a.startTime}-${a.endTime})`, a, b });
                    }
                }

                if (a.roomId && b.roomId && a.roomId === b.roomId) {
                    const key = `room|${id1}|${id2}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        conflicts.push({ type: 'room', message: `Room overlap: ${a.roomName || a.roomId} (${a.day} ${a.startTime}-${a.endTime})`, a, b });
                    }
                }
            }
        }

        if (!conflicts.length) {
            if (resultEl) resultEl.innerHTML = '<div class="muted">No conflicts detected.</div>';
            return;
        }

        const badge = (type) => {
            if (type === 'teacher') return '<span class="muted" style="padding:0.15rem 0.5rem;border-radius:999px;background:#e0f2fe;">Teacher</span>';
            if (type === 'room') return '<span class="muted" style="padding:0.15rem 0.5rem;border-radius:999px;background:#ffedd5;">Room</span>';
            if (type === 'class') return '<span class="muted" style="padding:0.15rem 0.5rem;border-radius:999px;background:#dcfce7;">Class</span>';
            return '<span class="muted" style="padding:0.15rem 0.5rem;border-radius:999px;background:#fee2e2;color:#991b1b;">Invalid</span>';
        };

        if (resultEl) {
            resultEl.innerHTML = `
                <div style="padding:0.75rem;border:1px solid var(--border-color);border-radius:0.75rem;background:#f8fafc;">
                    <div style="font-weight:700;">Conflicts: ${conflicts.length}</div>
                    <div class="muted">Click Open to edit a period.</div>
                </div>
                <div style="margin-top:0.75rem;display:flex;flex-direction:column;gap:0.6rem;">
                    ${conflicts.map(c => `
                        <div style="border:1px solid var(--border-color);border-radius:0.75rem;padding:0.75rem;background:white;">
                            <div style="display:flex;justify-content:space-between;gap:0.75rem;align-items:flex-start;flex-wrap:wrap;">
                                <div>
                                    ${badge(c.type)} <span style="font-weight:700;">${escapeHtml(c.message)}</span>
                                    <div class="muted" style="margin-top:0.25rem;">
                                        A: ${escapeHtml(`${c.a.subject || ''} (${c.a.department || ''}/${c.a.className || ''})`)} • ${escapeHtml(`${c.a.startTime || ''}-${c.a.endTime || ''}`)}
                                        ${c.b ? `<br>B: ${escapeHtml(`${c.b.subject || ''} (${c.b.department || ''}/${c.b.className || ''})`)} • ${escapeHtml(`${c.b.startTime || ''}-${c.b.endTime || ''}`)}` : ''}
                                    </div>
                                </div>
                                <div style="display:flex;gap:0.5rem;">
                                    <button class="btn-sm" onclick="openModal('${c.a.id}')">Open A</button>
                                    ${c.b ? `<button class="btn-sm" onclick="openModal('${c.b.id}')">Open B</button>` : ''}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    } catch (err) {
        console.error(err);
        if (resultEl) resultEl.innerHTML = '<div class="muted" style="color:#991b1b;">Failed to scan conflicts.</div>';
    }
}

function dayNameFromDate(dateISO) {
    if (!dateISO) return '';
    const d = new Date(dateISO + 'T00:00:00');
    const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return names[d.getDay()] || '';
}

function overrideDocId(dateISO, periodId) {
    const tenantId = getTenantId();
    const safeTenant = (tenantId || 'default').replace(/[^a-zA-Z0-9_-]+/g, '_');
    return `${safeTenant}__${dateISO}__${periodId}`;
}

async function fetchApprovedLeavesForDate(dateISO) {
    const tenantId = getTenantId();
    const absent = new Set();
    if (!dateISO) return absent;

    try {
        let snap;
        try {
            snap = await db.collection('leaves').where('tenantId', '==', tenantId).get();
        } catch (e) {
            snap = await db.collection('leaves').get();
        }
        snap.forEach(doc => {
            const l = doc.data() || {};
            if (l.tenantId && l.tenantId !== tenantId) return;
            if ((l.status || '').toLowerCase() !== 'approved') return;
            const start = (l.startDate || '').toString();
            const end = (l.endDate || '').toString();
            if (start && end && dateISO >= start && dateISO <= end) absent.add(l.staffId);
        });
    } catch (err) {
        console.error('Failed to load leaves:', err);
    }
    return absent;
}

function buildTeacherOptions(selectedId = '') {
    const opts = [`<option value="">(None)</option>`];
    TEACHERS_CACHE.forEach(t => {
        const sel = selectedId && t.id === selectedId ? 'selected' : '';
        opts.push(`<option value="${escapeHtml(t.id)}" ${sel}>${escapeHtml(t.name)}</option>`);
    });
    return opts.join('');
}

async function loadCoverage() {
    const ctx = getSelectedClassContext(true);
    if (!ctx) return;

    const dateISO = document.getElementById('coverageDate')?.value || '';
    if (!dateISO) return alert('Select a date.');

    if (!TEACHERS_CACHE.length) await loadTeachersIntoSelect();

    const day = dayNameFromDate(dateISO);
    const periods = (await fetchTimetableForClass(ctx.department, ctx.className))
        .filter(p => p.day === day)
        .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

    const tbody = document.getElementById('coverageBody');
    if (!tbody) return;

    if (!periods.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="muted">No periods found for ${escapeHtml(day)}.</td></tr>`;
        return;
    }

    const absentTeachers = await fetchApprovedLeavesForDate(dateISO);

    const overrideDocs = await Promise.all(periods.map(async (p) => {
        const id = overrideDocId(dateISO, p.id);
        try {
            const doc = await db.collection('timetable_overrides').doc(id).get();
            return { periodId: p.id, overrideId: id, data: doc.exists ? (doc.data() || {}) : null };
        } catch (e) {
            return { periodId: p.id, overrideId: id, data: null };
        }
    }));
    const overrideByPeriod = new Map(overrideDocs.map(o => [o.periodId, o]));

    tbody.innerHTML = periods.map(p => {
        const absent = p.teacherId && absentTeachers.has(p.teacherId);
        const override = overrideByPeriod.get(p.id)?.data || null;
        const overrideId = overrideByPeriod.get(p.id)?.overrideId || overrideDocId(dateISO, p.id);
        const selectedSub = override?.subTeacherId || '';
        const status = override
            ? `<span class="muted">Override: ${escapeHtml(override.subTeacherName || '')}</span>`
            : absent
                ? '<span style="color:#991b1b;font-weight:700;">Absent</span>'
                : '<span class="muted">OK</span>';

        return `
            <tr data-period-id="${escapeHtml(p.id)}" data-override-id="${escapeHtml(overrideId)}">
                <td>${escapeHtml(`${p.startTime || ''} - ${p.endTime || ''}`)}</td>
                <td>${escapeHtml(p.subject || '')}</td>
                <td>${escapeHtml(p.teacherName || '')}</td>
                <td>${status}</td>
                <td>
                    <select class="cov-sub" style="min-width:180px;">
                        ${buildTeacherOptions(selectedSub)}
                    </select>
                </td>
                <td style="text-align:center;">
                    <input class="cov-clear" type="checkbox" style="width:auto;">
                </td>
            </tr>
        `;
    }).join('');
}

async function saveCoverageOverrides() {
    if (!canManageCoverage()) {
        alert('You do not have permission to save overrides.');
        return;
    }

    const dateISO = document.getElementById('coverageDate')?.value || '';
    if (!dateISO) return alert('Select a date.');

    const tbody = document.getElementById('coverageBody');
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr[data-period-id]'));
    if (!rows.length) return;

    const ctx = getSelectedClassContext(true);
    if (!ctx) return;

    const tenantId = getTenantId();
    const user = getCurrentUserInfo();

    try {
        for (const row of rows) {
            const periodId = row.dataset.periodId;
            const overrideId = row.dataset.overrideId || overrideDocId(dateISO, periodId);
            const clear = !!row.querySelector('.cov-clear')?.checked;
            const subTeacherId = row.querySelector('.cov-sub')?.value || '';

            if (clear) {
                await db.collection('timetable_overrides').doc(overrideId).delete();
                continue;
            }

            if (!subTeacherId) continue;
            const subTeacherName = teacherNameById(subTeacherId) || '';

            const period = TIMETABLE_CACHE[periodId] || (await db.collection('timetable').doc(periodId).get()).data() || {};
            const payload = {
                date: dateISO,
                periodId,
                department: period.department || ctx.department,
                className: period.className || ctx.className,
                day: period.day || dayNameFromDate(dateISO),
                startTime: period.startTime || '',
                endTime: period.endTime || '',
                subject: period.subject || '',
                originalTeacherId: period.teacherId || '',
                originalTeacherName: period.teacherName || '',
                subTeacherId,
                subTeacherName,
                tenantId,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: user.uid
            };

            await db.collection('timetable_overrides').doc(overrideId).set(payload, { merge: true });
        }

        if (typeof logAudit === 'function') logAudit('timetable_overrides_save', `timetable_overrides/${dateISO}`, { date: dateISO, department: ctx.department, className: ctx.className });
        alert('Overrides saved.');
        await loadCoverage();
    } catch (err) {
        console.error(err);
        alert('Failed to save overrides: ' + (err.message || err));
    }
}

// Audit helper for timetable actions
function logTimetableAudit(action, payload = {}) {
    try {
        const user = getCurrentUserInfo();
        const tenantId = payload.tenantId || getTenantId();
        const auditEntry = {
            action,
            tenantId,
            periodId: payload.periodId || '',
            department: payload.department || '',
            className: payload.className || '',
            day: payload.day || '',
            startTime: payload.startTime || '',
            endTime: payload.endTime || '',
            subject: payload.subject || '',
            teacherId: payload.teacherId || '',
            userId: user.uid,
            userRole: user.role,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
        db.collection('timetable_audit').add(auditEntry);
    } catch (err) {
        console.warn('Audit log skipped:', err?.message || err);
    }
}

// ---------- AI Auto-Optimizer ----------
async function startAutoOptimize() {
    const className = document.getElementById('filterClass').value;
    const department = document.getElementById('filterDepartment').value;
    const tenantId = getTenantId();

    if (!className || !department) {
        alert("Please select a Department and Class first.");
        return;
    }

    if (!confirm(`Are you sure you want to AI-generate/optimize the schedule for ${className}? This will propose a new schedule.`)) {
        return;
    }

    const btn = document.querySelector('button[onclick="startAutoOptimize()"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span>🤖</span> Thinking...';
    btn.disabled = true;

    try {
        const teachersSnap = await db.collection('teachers')
            .where('tenantId', '==', tenantId)
            .get();
        const teachers = teachersSnap.docs.map(d => ({
            id: d.id,
            name: d.data().name_ur || `${d.data().firstName} ${d.data().lastName}`.trim()
        }));

        const subjectsList = await fetchSubjectsForClass(department, className);
        const subjectNames = subjectsList
            .map(s => (typeof getSubjectDisplayName === 'function') ? getSubjectDisplayName(s) : (s.name_ur || s.name))
            .join(', ');

        const prompt = `
        I need to generate a class timetable for Class "${className}" (Department: ${department}).
        Prefer Urdu names for display.

        Available Teachers (Urdu names):
        ${JSON.stringify(teachers)}

        Subjects for this class: ${subjectNames || 'General Studies'}

        Constraints:
        - School days: Monday to Friday.
        - Hours: 08:00 to 13:30.
        - Period duration: 45 minutes.
        - Break: 11:00 to 11:30.
        - Max 7 periods per day.

        Task:
        Generate a JSON array of period objects for a weekly schedule.
        Format:
        [
            {
                "day": "Monday",
                "startTime": "08:00",
                "endTime": "08:45",
                "subject": "Urdu Subject Name",
                "teacherId": "ID_FROM_LIST",
                "teacherName": "Urdu Name from List"
            }
        ]

        Ensure teachers are assigned relevant subjects if possible (or distribute evenly). Return ONLY the JSON array.`;

        const response = await callGemini(prompt);
        const cleanJson = response.replace(/```json/gi, '').replace(/```/g, '').trim();
        const suggestedPeriods = JSON.parse(cleanJson);

        if (confirm(`AI generated ${suggestedPeriods.length} periods. Apply them now? (Conflicts will be skipped)`)) {
            let addedCount = 0;
            let conflictCount = 0;

            for (const p of suggestedPeriods) {
                const conflictMsg = await checkConflict(p.teacherId, p.day, p.startTime, p.endTime, className, department);
                if (!conflictMsg) {
                    const docRef = await db.collection('timetable').add({
                        department,
                        className,
                        day: p.day,
                        startTime: p.startTime,
                        endTime: p.endTime,
                        subject: p.subject,
                        teacherId: p.teacherId,
                        teacherName: p.teacherName,
                        tenantId,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        isAiGenerated: true
                    });
                    logTimetableAudit('create_ai', { periodId: docRef.id, tenantId, department, className, day: p.day, startTime: p.startTime, endTime: p.endTime, subject: p.subject, teacherId: p.teacherId });
                    addedCount++;
                } else {
                    console.warn("Skipping conflict:", conflictMsg);
                    conflictCount++;
                }
            }

            alert(`Applied ${addedCount} periods. Skipped ${conflictCount} due to conflicts.`);
            loadTimetable();
        }
    } catch (error) {
        console.error("Optimization Error:", error);
        alert("AI Optimization failed: " + error.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}
