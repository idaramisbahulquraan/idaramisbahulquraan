let commState = {
    user: null,
    templatesLoaded: false,
    messagesInitialized: false,
    threads: [],
    activeThreadId: null,
    activeThreadUnsub: null
};

function commGetTenant() {
    try {
        return (typeof getCurrentTenant === 'function')
            ? getCurrentTenant()
            : (localStorage.getItem('tenant_id') || 'default');
    } catch (e) {
        return 'default';
    }
}

function commParseUser() {
    try {
        return JSON.parse(localStorage.getItem('currentUser') || 'null');
    } catch (e) {
        return null;
    }
}

function commIsTopRole(role) {
    const r = (role || '').toLowerCase();
    return r === 'owner' || r === 'admin' || r === 'principal';
}

function commIsStaffRole(role) {
    const r = (role || '').toLowerCase();
    return r === 'owner' || r === 'admin' || r === 'principal' || r === 'teacher' || r === 'accountant' || r === 'clerk';
}

function commEl(id) {
    return document.getElementById(id);
}

function commEscape(text) {
    return (text || '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[ch]));
}

function commFormatDate(dateValue) {
    if (!dateValue) return '';
    if (typeof dateValue === 'string') return dateValue;
    if (typeof dateValue.toDate === 'function') {
        const d = dateValue.toDate();
        return d.toISOString().slice(0, 10);
    }
    try {
        const d = new Date(dateValue);
        if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    } catch (e) { }
    return '';
}

function commToday() {
    return new Date().toISOString().slice(0, 10);
}

function commSetLoading(container, html) {
    if (!container) return;
    container.innerHTML = html;
}

function closeModal(id) {
    const modal = commEl(id);
    if (modal) modal.classList.remove('active');
}

function commOpenModal(id) {
    const modal = commEl(id);
    if (modal) modal.classList.add('active');
}

function switchTab(tabName) {
    const tabs = ['notices', 'events', 'templates', 'messages'];
    const normalized = tabs.includes(tabName) ? tabName : 'notices';

    const tabMap = {
        notices: commEl('noticesTab'),
        events: commEl('eventsTab'),
        templates: commEl('templatesTab'),
        messages: commEl('messagesTab')
    };

    tabs.forEach(t => {
        const el = tabMap[t];
        if (el) el.style.display = (t === normalized) ? '' : 'none';
    });

    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => {
        const onclick = btn.getAttribute('onclick') || '';
        if (onclick.includes(`switchTab('${normalized}')`)) btn.classList.add('active');
    });

    if (normalized === 'templates') {
        ensureTemplatesLoaded();
    }
    if (normalized === 'messages') {
        ensureMessagesInitialized();
    }

    if (normalized === 'notices') {
        history.replaceState(null, '', window.location.pathname);
    } else {
        history.replaceState(null, '', `${window.location.pathname}#${normalized}`);
    }
}

async function commEnsureUser() {
    const authUser = firebase.auth().currentUser;
    const cached = commParseUser();
    if (cached && authUser && cached.uid === authUser.uid) {
        commState.user = cached;
        return cached;
    }
    if (!authUser) {
        commState.user = cached;
        return cached;
    }

    let role = cached?.role || 'student';
    let name = cached?.name || authUser.displayName || (authUser.email ? authUser.email.split('@')[0] : 'User');
    try {
        const doc = await db.collection('users').doc(authUser.uid).get();
        if (doc.exists && doc.data()?.role) role = doc.data().role;
        if (doc.exists && doc.data()?.name) name = doc.data().name;
    } catch (e) { }

    const fresh = { uid: authUser.uid, email: authUser.email || '', role, name };
    localStorage.setItem('currentUser', JSON.stringify(fresh));
    commState.user = fresh;
    return fresh;
}

function commApplyRoleGating(user) {
    const top = commIsTopRole(user?.role);
    const staff = commIsStaffRole(user?.role);

    const noticeCreateBtn = document.querySelector('#noticesTab .page-header .btn-add');
    if (noticeCreateBtn) noticeCreateBtn.style.display = top ? '' : 'none';

    const eventCreateBtn = document.querySelector('#eventsTab .page-header .btn-add');
    if (eventCreateBtn) eventCreateBtn.style.display = top ? '' : 'none';

    const templateCreateBtn = document.querySelector('#templatesTab .page-header .btn-add');
    if (templateCreateBtn) templateCreateBtn.style.display = top ? '' : 'none';

    // Hide Templates tab for non-staff: they cannot read templates by rules.
    const templateTabBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => (b.getAttribute('onclick') || '').includes("switchTab('templates')"));
    if (templateTabBtn) templateTabBtn.style.display = staff ? '' : 'none';

    // Hide New Message for non-admin/principal/owner because they cannot list recipients (users read rules).
    const newMessageBtn = document.querySelector('#messagesTab .page-header .btn-add');
    if (newMessageBtn) newMessageBtn.style.display = top ? '' : 'none';
}

async function loadNotices() {
    const list = commEl('noticesList');
    if (!list) return;
    commSetLoading(list, '<p>Loading notices...</p>');

    const user = await commEnsureUser();
    const role = (user?.role || 'student').toLowerCase();
    const staff = commIsStaffRole(role);

    try {
        let notices = [];
        if (staff) {
            const snap = await db.collection('notices').orderBy('date', 'desc').limit(50).get();
            snap.forEach(doc => notices.push({ id: doc.id, ...doc.data() }));
        } else {
            const audience = role === 'parent' ? 'parents' : (role === 'student' ? 'students' : 'all');
            const [allSnap, roleSnap] = await Promise.all([
                db.collection('notices').where('targetAudience', '==', 'all').get(),
                db.collection('notices').where('targetAudience', '==', audience).get()
            ]);
            allSnap.forEach(doc => notices.push({ id: doc.id, ...doc.data() }));
            roleSnap.forEach(doc => notices.push({ id: doc.id, ...doc.data() }));
            const seen = new Set();
            notices = notices.filter(n => (seen.has(n.id) ? false : (seen.add(n.id), true)));
            notices.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
            notices = notices.slice(0, 50);
        }

        if (!notices.length) {
            commSetLoading(list, '<p style="color:var(--text-light);">No notices found.</p>');
            return;
        }

        const canWrite = commIsTopRole(role);
        list.innerHTML = notices.map(n => {
            const target = (n.targetAudience || 'all').toLowerCase();
            const badgeCls = target === 'teachers' ? 'badge-teachers'
                : target === 'students' ? 'badge-students'
                    : target === 'parents' ? 'badge-parents'
                        : 'badge-all';
            const date = commEscape(n.date || commFormatDate(n.createdAt) || '');
            const title = commEscape(n.title || '');
            const content = commEscape(n.content || '');
            const channels = Array.isArray(n.channels) ? n.channels : ['inapp'];
            const channelLabel = channels.length ? ` · ${channels.map(c => commEscape(String(c))).join(', ')}` : '';

            return `
                <div class="card">
                    <div class="card-header">
                        <div>
                            <div class="card-title">${title}</div>
                            <div class="card-meta">
                                <span class="badge ${badgeCls}">${commEscape(target)}</span>
                                <span>${date}${channelLabel}</span>
                            </div>
                        </div>
                    </div>
                    <div class="card-body">${content}</div>
                    ${canWrite ? `
                        <div class="card-actions">
                            <button class="btn-sm" onclick="openNoticeModal('${n.id}')">Edit</button>
                            <button class="btn-sm delete" onclick="deleteNotice('${n.id}')">Delete</button>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Failed to load notices', err);
        commSetLoading(list, '<p style="color:red;">Failed to load notices.</p>');
    }
}

async function loadEvents() {
    const list = commEl('eventsList');
    if (!list) return;
    commSetLoading(list, '<p>Loading events...</p>');

    const user = await commEnsureUser();
    const role = (user?.role || 'student').toLowerCase();
    const canWrite = commIsTopRole(role);

    try {
        const today = commToday();
        const snap = await db.collection('events')
            .where('date', '>=', today)
            .orderBy('date', 'asc')
            .limit(50)
            .get();

        const events = [];
        snap.forEach(doc => events.push({ id: doc.id, ...doc.data() }));

        if (!events.length) {
            commSetLoading(list, '<p style="color:var(--text-light);">No upcoming events.</p>');
            return;
        }

        list.innerHTML = events.map(e => {
            const date = commEscape(e.date || '');
            const title = commEscape(e.title || '');
            const description = commEscape(e.description || '');
            const location = commEscape(e.location || '');
            return `
                <div class="card">
                    <div class="card-header">
                        <div>
                            <div class="card-title">${title}</div>
                            <div class="card-meta">
                                <span class="badge badge-event">event</span>
                                <span>${date}${location ? ` · ${location}` : ''}</span>
                            </div>
                        </div>
                    </div>
                    <div class="card-body">${description || '<span style="color:var(--text-light);">No description.</span>'}</div>
                    ${canWrite ? `
                        <div class="card-actions">
                            <button class="btn-sm" onclick="openEventModal('${e.id}')">Edit</button>
                            <button class="btn-sm delete" onclick="deleteEvent('${e.id}')">Delete</button>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Failed to load events', err);
        commSetLoading(list, '<p style="color:red;">Failed to load events.</p>');
    }
}

async function ensureTemplatesLoaded() {
    if (commState.templatesLoaded) return;
    commState.templatesLoaded = true;
    await loadTemplates();
    await loadNoticeTemplateOptions();
}

async function loadTemplates() {
    const list = commEl('templatesList');
    if (!list) return;
    commSetLoading(list, '<p>Loading templates...</p>');

    const user = await commEnsureUser();
    const role = (user?.role || 'student').toLowerCase();
    const staff = commIsStaffRole(role);
    const canWrite = commIsTopRole(role);

    if (!staff) {
        commSetLoading(list, '<p style="color:var(--text-light);">Templates are available to staff only.</p>');
        return;
    }

    try {
        const snap = await db.collection('message_templates').orderBy('createdAt', 'desc').limit(100).get();
        const templates = [];
        snap.forEach(doc => templates.push({ id: doc.id, ...doc.data() }));

        if (!templates.length) {
            commSetLoading(list, '<p style="color:var(--text-light);">No templates yet.</p>');
            return;
        }

        list.innerHTML = templates.map(t => {
            const channel = commEscape(t.channel || 'email');
            const name = commEscape(t.name || 'Template');
            const subject = commEscape(t.subject || '');
            const body = commEscape(t.body || '');
            return `
                <div class="card">
                    <div class="card-header">
                        <div>
                            <div class="card-title">${name}</div>
                            <div class="card-meta">
                                <span class="badge badge-all">${channel}</span>
                                ${subject ? `<span>${subject}</span>` : '<span>&nbsp;</span>'}
                            </div>
                        </div>
                    </div>
                    <div class="card-body">${body}</div>
                    ${canWrite ? `
                        <div class="card-actions">
                            <button class="btn-sm" onclick="openTemplateModal('${t.id}')">Edit</button>
                            <button class="btn-sm delete" onclick="deleteTemplate('${t.id}')">Delete</button>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Failed to load templates', err);
        commSetLoading(list, '<p style="color:red;">Failed to load templates.</p>');
    }
}

async function loadNoticeTemplateOptions() {
    const select = commEl('noticeTemplateSelect');
    if (!select) return;

    const user = await commEnsureUser();
    const role = (user?.role || 'student').toLowerCase();
    if (!commIsStaffRole(role)) return;

    try {
        const snap = await db.collection('message_templates').orderBy('createdAt', 'desc').limit(100).get();
        const options = ['<option value="">None</option>'];
        snap.forEach(doc => {
            const d = doc.data() || {};
            const label = `${d.name || 'Template'} (${d.channel || 'email'})`;
            options.push(`<option value="${doc.id}">${commEscape(label)}</option>`);
        });
        select.innerHTML = options.join('');
    } catch (err) {
        console.warn('Failed to load templates for notice select', err);
    }
}

function openNoticeModal(docId = '') {
    const form = commEl('noticeForm');
    if (!form) return;
    form.reset();
    form.querySelector('input[name="docId"]').value = docId || '';
    form.querySelector('input[name="date"]').value = commToday();
    form.querySelectorAll('input[name="channels"]').forEach(cb => {
        cb.checked = cb.value === 'inapp';
    });
    const title = commEl('noticeModalTitle');
    if (title) title.innerText = docId ? 'Edit Notice' : 'Create Notice';

    if (!docId) {
        commOpenModal('noticeModal');
        ensureTemplatesLoaded();
        return;
    }

    db.collection('notices').doc(docId).get().then(doc => {
        if (!doc.exists) return;
        const n = doc.data() || {};
        form.querySelector('input[name="title"]').value = n.title || '';
        form.querySelector('textarea[name="content"]').value = n.content || '';
        form.querySelector('select[name="targetAudience"]').value = n.targetAudience || 'all';
        form.querySelector('input[name="date"]').value = n.date || commToday();
        const channels = Array.isArray(n.channels) ? n.channels : ['inapp'];
        form.querySelectorAll('input[name="channels"]').forEach(cb => {
            cb.checked = channels.includes(cb.value);
        });
        const templateSelect = form.querySelector('select[name="templateId"]');
        if (templateSelect) templateSelect.value = n.templateId || '';
    }).catch(err => console.error(err)).finally(() => {
        ensureTemplatesLoaded();
        commOpenModal('noticeModal');
    });
}

function openEventModal(docId = '') {
    const form = commEl('eventForm');
    if (!form) return;
    form.reset();
    form.querySelector('input[name="docId"]').value = docId || '';
    form.querySelector('input[name="date"]').value = commToday();
    const title = commEl('eventModalTitle');
    if (title) title.innerText = docId ? 'Edit Event' : 'Add Event';

    if (!docId) {
        commOpenModal('eventModal');
        return;
    }

    db.collection('events').doc(docId).get().then(doc => {
        if (!doc.exists) return;
        const e = doc.data() || {};
        form.querySelector('input[name="title"]').value = e.title || '';
        form.querySelector('textarea[name="description"]').value = e.description || '';
        form.querySelector('input[name="date"]').value = e.date || commToday();
        form.querySelector('input[name="location"]').value = e.location || '';
    }).catch(err => console.error(err)).finally(() => {
        commOpenModal('eventModal');
    });
}

function openTemplateModal(docId = '') {
    const form = commEl('templateForm');
    if (!form) return;
    form.reset();
    form.querySelector('input[name="docId"]').value = docId || '';
    const title = commEl('templateModalTitle');
    if (title) title.innerText = docId ? 'Edit Template' : 'Add Template';

    if (!docId) {
        commOpenModal('templateModal');
        return;
    }

    db.collection('message_templates').doc(docId).get().then(doc => {
        if (!doc.exists) return;
        const t = doc.data() || {};
        form.querySelector('input[name="name"]').value = t.name || '';
        form.querySelector('select[name="channel"]').value = t.channel || 'email';
        form.querySelector('input[name="subject"]').value = t.subject || '';
        form.querySelector('textarea[name="body"]').value = t.body || '';
    }).catch(err => console.error(err)).finally(() => {
        commOpenModal('templateModal');
    });
}

async function deleteNotice(id) {
    if (!id) return;
    if (!confirm('Delete this notice?')) return;
    try {
        await db.collection('notices').doc(id).delete();
        if (typeof logAudit === 'function') logAudit('notice_delete', `notices/${id}`, {});
        loadNotices();
    } catch (err) {
        console.error(err);
        alert('Failed to delete notice: ' + (err.message || err));
    }
}

async function deleteEvent(id) {
    if (!id) return;
    if (!confirm('Delete this event?')) return;
    try {
        await db.collection('events').doc(id).delete();
        if (typeof logAudit === 'function') logAudit('event_delete', `events/${id}`, {});
        loadEvents();
    } catch (err) {
        console.error(err);
        alert('Failed to delete event: ' + (err.message || err));
    }
}

async function deleteTemplate(id) {
    if (!id) return;
    if (!confirm('Delete this template?')) return;
    try {
        await db.collection('message_templates').doc(id).delete();
        if (typeof logAudit === 'function') logAudit('template_delete', `message_templates/${id}`, {});
        commState.templatesLoaded = false;
        ensureTemplatesLoaded();
    } catch (err) {
        console.error(err);
        alert('Failed to delete template: ' + (err.message || err));
    }
}

async function commQueueNoticeJobs(noticeId, notice) {
    const channels = Array.isArray(notice.channels) ? notice.channels : [];
    const deliver = channels.filter(c => c && c !== 'inapp');
    if (!deliver.length) return;

    const user = await commEnsureUser();
    const uid = user?.uid || (firebase.auth().currentUser ? firebase.auth().currentUser.uid : '');

    const base = {
        type: 'notice',
        noticeId,
        targetAudience: notice.targetAudience || 'all',
        templateId: notice.templateId || '',
        status: 'queued',
        payload: {
            title: notice.title || '',
            content: notice.content || '',
            date: notice.date || ''
        },
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: uid,
        tenantId: commGetTenant()
    };

    await Promise.all(deliver.map(channel => db.collection('message_jobs').add({ ...base, channel })));
    if (typeof logAudit === 'function') logAudit('message_jobs_queue', 'message_jobs', { noticeId, channels: deliver });
}

async function commHandleNoticeSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn ? btn.innerText : '';
    if (btn) { btn.disabled = true; btn.innerText = 'Saving...'; }

    try {
        const user = await commEnsureUser();
        const uid = user?.uid || (firebase.auth().currentUser ? firebase.auth().currentUser.uid : '');

        const docId = form.querySelector('input[name="docId"]').value;
        const isNew = !docId;
        const title = form.querySelector('input[name="title"]').value.trim();
        const content = form.querySelector('textarea[name="content"]').value.trim();
        const targetAudience = form.querySelector('select[name="targetAudience"]').value;
        const date = form.querySelector('input[name="date"]').value || commToday();
        const templateId = form.querySelector('select[name="templateId"]').value || '';
        const channels = Array.from(form.querySelectorAll('input[name="channels"]:checked')).map(cb => cb.value);

        if (!title || !content || !targetAudience || !date) {
            alert('Please fill Title, Content, Audience, and Date.');
            return;
        }

        const payload = {
            title,
            content,
            targetAudience,
            date,
            channels: channels.length ? channels : ['inapp'],
            templateId,
            tenantId: commGetTenant(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: uid
        };

        let savedId = docId;
        if (docId) {
            await db.collection('notices').doc(docId).set(payload, { merge: true });
            if (typeof logAudit === 'function') logAudit('notice_update', `notices/${docId}`, { targetAudience, channels: payload.channels });
        } else {
            const ref = await db.collection('notices').add({
                ...payload,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: uid
            });
            savedId = ref.id;
            if (typeof logAudit === 'function') logAudit('notice_create', `notices/${savedId}`, { targetAudience, channels: payload.channels });
        }

        if (isNew) {
            await commQueueNoticeJobs(savedId, payload);
        }

        closeModal('noticeModal');
        loadNotices();
    } catch (err) {
        console.error(err);
        alert('Failed to save notice: ' + (err.message || err));
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = originalText; }
    }
}

async function commHandleEventSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn ? btn.innerText : '';
    if (btn) { btn.disabled = true; btn.innerText = 'Saving...'; }

    try {
        const user = await commEnsureUser();
        const uid = user?.uid || (firebase.auth().currentUser ? firebase.auth().currentUser.uid : '');

        const docId = form.querySelector('input[name="docId"]').value;
        const title = form.querySelector('input[name="title"]').value.trim();
        const description = form.querySelector('textarea[name="description"]').value.trim();
        const date = form.querySelector('input[name="date"]').value || commToday();
        const location = form.querySelector('input[name="location"]').value.trim();

        if (!title || !date) {
            alert('Please fill Event Title and Date.');
            return;
        }

        const payload = {
            title,
            description,
            date,
            location,
            tenantId: commGetTenant(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: uid
        };

        if (docId) {
            await db.collection('events').doc(docId).set(payload, { merge: true });
            if (typeof logAudit === 'function') logAudit('event_update', `events/${docId}`, { title, date });
        } else {
            const ref = await db.collection('events').add({
                ...payload,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: uid
            });
            if (typeof logAudit === 'function') logAudit('event_create', `events/${ref.id}`, { title, date });
        }

        closeModal('eventModal');
        loadEvents();
    } catch (err) {
        console.error(err);
        alert('Failed to save event: ' + (err.message || err));
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = originalText; }
    }
}

async function commHandleTemplateSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn ? btn.innerText : '';
    if (btn) { btn.disabled = true; btn.innerText = 'Saving...'; }

    try {
        const user = await commEnsureUser();
        const uid = user?.uid || (firebase.auth().currentUser ? firebase.auth().currentUser.uid : '');

        const docId = form.querySelector('input[name="docId"]').value;
        const name = form.querySelector('input[name="name"]').value.trim();
        const channel = form.querySelector('select[name="channel"]').value;
        const subject = form.querySelector('input[name="subject"]').value.trim();
        const body = form.querySelector('textarea[name="body"]').value.trim();

        if (!name || !channel || !body) {
            alert('Please fill Name, Channel, and Body.');
            return;
        }

        const payload = {
            name,
            channel,
            subject,
            body,
            tenantId: commGetTenant(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: uid
        };

        if (docId) {
            await db.collection('message_templates').doc(docId).set(payload, { merge: true });
            if (typeof logAudit === 'function') logAudit('template_update', `message_templates/${docId}`, { name, channel });
        } else {
            const ref = await db.collection('message_templates').add({
                ...payload,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: uid
            });
            if (typeof logAudit === 'function') logAudit('template_create', `message_templates/${ref.id}`, { name, channel });
        }

        closeModal('templateModal');
        commState.templatesLoaded = false;
        ensureTemplatesLoaded();
    } catch (err) {
        console.error(err);
        alert('Failed to save template: ' + (err.message || err));
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = originalText; }
    }
}

function commWireForms() {
    const noticeForm = commEl('noticeForm');
    if (noticeForm && !noticeForm.dataset.wired) {
        noticeForm.addEventListener('submit', commHandleNoticeSubmit);
        noticeForm.dataset.wired = '1';
    }

    const eventForm = commEl('eventForm');
    if (eventForm && !eventForm.dataset.wired) {
        eventForm.addEventListener('submit', commHandleEventSubmit);
        eventForm.dataset.wired = '1';
    }

    const templateForm = commEl('templateForm');
    if (templateForm && !templateForm.dataset.wired) {
        templateForm.addEventListener('submit', commHandleTemplateSubmit);
        templateForm.dataset.wired = '1';
    }
}

function commInitTabsFromHash() {
    const raw = (window.location.hash || '').replace('#', '').trim().toLowerCase();
    if (raw === 'messages') return switchTab('messages');
    if (raw === 'events') return switchTab('events');
    if (raw === 'templates') return switchTab('templates');
    return switchTab('notices');
}

document.addEventListener('DOMContentLoaded', () => {
    commWireForms();

    firebase.auth().onAuthStateChanged(async (user) => {
        if (!user) return;
        const current = await commEnsureUser();
        commApplyRoleGating(current);
        loadNotices();
        loadEvents();
        commInitTabsFromHash();
    });
});

// Messaging functions are implemented below.

async function ensureMessagesInitialized() {
    if (commState.messagesInitialized) return;
    commState.messagesInitialized = true;

    const chatForm = commEl('chatForm');
    if (chatForm && !chatForm.dataset.wired) {
        chatForm.addEventListener('submit', commHandleChatSubmit);
        chatForm.dataset.wired = '1';
    }

    const newThreadForm = commEl('newThreadForm');
    if (newThreadForm && !newThreadForm.dataset.wired) {
        newThreadForm.addEventListener('submit', commHandleNewThreadSubmit);
        newThreadForm.dataset.wired = '1';
    }

    const recipientType = commEl('recipientType');
    if (recipientType && !recipientType.dataset.wired) {
        recipientType.addEventListener('change', loadRecipientOptions);
        recipientType.dataset.wired = '1';
    }

    const threadSearch = commEl('threadSearch');
    if (threadSearch && !threadSearch.dataset.wired) {
        threadSearch.addEventListener('input', commFilterThreads);
        threadSearch.dataset.wired = '1';
    }

    disableChatInput(true);
    await loadThreads();
}

function disableChatInput(disabled) {
    const input = commEl('chatInput');
    const form = commEl('chatForm');
    if (input) input.disabled = disabled;
    if (form) {
        const btn = form.querySelector('button[type="submit"]');
        if (btn) btn.disabled = disabled;
    }
}

function commFilterThreads() {
    const q = (commEl('threadSearch')?.value || '').trim().toLowerCase();
    const list = commEl('threadsList');
    if (!list) return;

    const items = Array.from(list.querySelectorAll('.thread-item'));
    items.forEach(item => {
        const hay = (item.dataset.search || '').toLowerCase();
        item.style.display = !q || hay.includes(q) ? '' : 'none';
    });
}

async function loadThreads() {
    const list = commEl('threadsList');
    if (!list) return;

    commSetLoading(list, '<div style="padding:1rem;color:var(--text-light);">Loading...</div>');

    const user = await commEnsureUser();
    const uid = user?.uid || (firebase.auth().currentUser ? firebase.auth().currentUser.uid : '');
    if (!uid) {
        commSetLoading(list, '<div style="padding:1rem;color:var(--text-light);">Sign in to view messages.</div>');
        return;
    }

    try {
        const snap = await db.collection('message_threads')
            .where('participantIds', 'array-contains', uid)
            .limit(100)
            .get();

        const threads = [];
        snap.forEach(doc => threads.push({ id: doc.id, ...doc.data() }));

        threads.sort((a, b) => {
            const aTs = a.updatedAt?.toDate ? a.updatedAt.toDate().getTime() : 0;
            const bTs = b.updatedAt?.toDate ? b.updatedAt.toDate().getTime() : 0;
            if (aTs !== bTs) return bTs - aTs;
            const aC = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
            const bC = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
            return bC - aC;
        });

        commState.threads = threads;

        if (!threads.length) {
            commSetLoading(list, '<div style="padding:1rem;color:var(--text-light);">No conversations yet.</div>');
            const header = commEl('chatHeader');
            if (header) header.innerText = 'Select a conversation';
            disableChatInput(true);
            return;
        }

        list.innerHTML = threads.map(t => commRenderThreadItem(t, uid)).join('');
        commFilterThreads();

        if (commState.activeThreadId) {
            commSelectThread(commState.activeThreadId);
        } else {
            const firstId = threads[0].id;
            commSelectThread(firstId);
        }

    } catch (err) {
        console.error('Failed to load threads', err);
        commSetLoading(list, '<div style="padding:1rem;color:red;">Failed to load conversations.</div>');
    }
}

function commRenderThreadItem(thread, currentUid) {
    const participants = Array.isArray(thread.participants) ? thread.participants : [];
    const others = participants.filter(p => p && p.uid && p.uid !== currentUid);
    const otherLabel = others.length
        ? others.map(p => p.name || p.email || p.uid).join(', ')
        : (Array.isArray(thread.participantIds)
            ? thread.participantIds.filter(id => id !== currentUid).slice(0, 3).join(', ')
            : '');

    const title = (thread.subject || otherLabel || 'Conversation').trim();
    const lastMessage = (thread.lastMessage || '').trim();
    const lastAt = thread.lastMessageAt || thread.updatedAt || thread.createdAt;
    let meta = '';
    if (lastAt?.toDate) {
        const d = lastAt.toDate();
        meta = d.toLocaleString();
    }
    const search = `${title} ${lastMessage} ${otherLabel}`.trim();
    const activeCls = commState.activeThreadId === thread.id ? 'active' : '';

    return `
        <div class="thread-item ${activeCls}" onclick="commSelectThread('${thread.id}')" data-search="${commEscape(search)}">
            <div class="thread-title">${commEscape(title)}</div>
            <div class="thread-snippet">${commEscape(lastMessage || 'No messages yet.')}</div>
            <div class="thread-meta">${commEscape(meta)}</div>
        </div>
    `;
}

function commSelectThread(threadId) {
    if (!threadId) return;
    commState.activeThreadId = threadId;

    const list = commEl('threadsList');
    if (list) {
        Array.from(list.querySelectorAll('.thread-item')).forEach(el => el.classList.remove('active'));
        const activeEl = list.querySelector(`.thread-item[onclick="commSelectThread('${threadId}')"]`);
        if (activeEl) activeEl.classList.add('active');
    }

    const user = commParseUser();
    const uid = user?.uid || (firebase.auth().currentUser ? firebase.auth().currentUser.uid : '');
    const thread = commState.threads.find(t => t.id === threadId) || {};
    const participants = Array.isArray(thread.participants) ? thread.participants : [];
    const other = participants.find(p => p && p.uid && p.uid !== uid);
    const title = (thread.subject || other?.name || other?.email || 'Conversation').trim();

    const header = commEl('chatHeader');
    if (header) header.innerText = title || 'Conversation';

    disableChatInput(false);
    loadThreadMessages(threadId);
}

async function loadThreadMessages(threadId) {
    const container = commEl('chatMessages');
    if (!container) return;
    container.innerHTML = '<div style="color:var(--text-light);">Loading messages...</div>';

    if (commState.activeThreadUnsub) {
        try { commState.activeThreadUnsub(); } catch (e) { }
        commState.activeThreadUnsub = null;
    }

    try {
        const query = db.collection('message_threads').doc(threadId)
            .collection('messages')
            .orderBy('createdAt', 'asc')
            .limit(200);

        commState.activeThreadUnsub = query.onSnapshot((snap) => {
            const user = commParseUser();
            const uid = user?.uid || (firebase.auth().currentUser ? firebase.auth().currentUser.uid : '');
            const messages = [];
            snap.forEach(doc => messages.push({ id: doc.id, ...doc.data() }));
            renderChatMessages(messages, uid);
        }, (err) => {
            console.error('Message listener failed', err);
            container.innerHTML = '<div style="color:red;">Failed to load messages.</div>';
        });
    } catch (err) {
        console.error('Failed to load messages', err);
        container.innerHTML = '<div style="color:red;">Failed to load messages.</div>';
    }
}

function renderChatMessages(messages, currentUid) {
    const container = commEl('chatMessages');
    if (!container) return;

    if (!messages.length) {
        container.innerHTML = '<div style="color:var(--text-light);">No messages yet. Say hello!</div>';
        return;
    }

    container.innerHTML = messages.map(m => {
        const mine = m.senderId && currentUid && m.senderId === currentUid;
        const text = commEscape(m.text || '');
        const who = commEscape(m.senderName || m.senderRole || 'User');
        let when = '';
        if (m.createdAt?.toDate) when = m.createdAt.toDate().toLocaleString();
        return `
            <div class="chat-message ${mine ? 'mine' : ''}">
                <div>${text}</div>
                <div class="meta">${mine ? 'You' : who}${when ? ` · ${commEscape(when)}` : ''}</div>
            </div>
        `;
    }).join('');

    container.scrollTop = container.scrollHeight;
}

async function commHandleChatSubmit(e) {
    e.preventDefault();
    const input = commEl('chatInput');
    const text = (input?.value || '').trim();
    if (!text) return;

    const threadId = commState.activeThreadId;
    if (!threadId) return;

    if (input) input.value = '';

    try {
        const user = await commEnsureUser();
        const uid = user?.uid || (firebase.auth().currentUser ? firebase.auth().currentUser.uid : '');
        const role = (user?.role || '').toLowerCase();
        const name = user?.name || user?.email || 'User';

        const msg = {
            text,
            senderId: uid,
            senderRole: role,
            senderName: name,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            tenantId: commGetTenant()
        };

        const threadRef = db.collection('message_threads').doc(threadId);
        await threadRef.collection('messages').add(msg);
        await threadRef.set({
            lastMessage: text.slice(0, 300),
            lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: uid
        }, { merge: true });

        if (typeof logAudit === 'function') logAudit('message_send', `message_threads/${threadId}`, { textPreview: text.slice(0, 80) });
    } catch (err) {
        console.error(err);
        alert('Failed to send message: ' + (err.message || err));
    }
}

function openNewThreadModal() {
    const user = commParseUser();
    const role = (user?.role || '').toLowerCase();
    if (!commIsTopRole(role)) {
        alert('Only admin/principal can start new conversations in this build.');
        return;
    }

    const form = commEl('newThreadForm');
    if (form) form.reset();
    commOpenModal('newThreadModal');
    loadRecipientOptions();
}

async function loadRecipientOptions() {
    const select = commEl('recipientSelect');
    if (!select) return;
    select.innerHTML = '<option value="">Loading...</option>';

    const type = (commEl('recipientType')?.value || 'teachers').toLowerCase();

    try {
        if (type === 'teachers') {
            const snap = await db.collection('teachers').orderBy('createdAt', 'desc').limit(200).get();
            const options = ['<option value="">Select a teacher</option>'];
            snap.forEach(doc => {
                const t = doc.data() || {};
                const name = `${t.firstName || ''} ${t.lastName || ''}`.trim() || (t.email || 'Teacher');
                const label = t.email ? `${name} (${t.email})` : name;
                options.push(`<option value="${doc.id}">${commEscape(label)}</option>`);
            });
            select.innerHTML = options.join('');
            return;
        }

        if (type === 'students') {
            const snap = await db.collection('students').orderBy('createdAt', 'desc').limit(200).get();
            const options = ['<option value="">Select a student</option>'];
            snap.forEach(doc => {
                const s = doc.data() || {};
                const name = `${s.firstName || ''} ${s.lastName || ''}`.trim() || (s.email || 'Student');
                const cls = s.className ? ` · ${s.className}` : '';
                const label = s.email ? `${name}${cls} (${s.email})` : `${name}${cls}`;
                options.push(`<option value="${doc.id}">${commEscape(label)}</option>`);
            });
            select.innerHTML = options.join('');
            return;
        }

        select.innerHTML = '<option value="">Unsupported recipient type.</option>';
    } catch (err) {
        console.error('Failed to load recipients', err);
        select.innerHTML = '<option value="">Failed to load recipients.</option>';
    }
}

async function commHandleNewThreadSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn ? btn.innerText : '';
    if (btn) { btn.disabled = true; btn.innerText = 'Creating...'; }

    try {
        const user = await commEnsureUser();
        const uid = user?.uid || (firebase.auth().currentUser ? firebase.auth().currentUser.uid : '');
        const role = (user?.role || '').toLowerCase();
        const name = user?.name || user?.email || 'User';

        if (!commIsTopRole(role)) {
            alert('Only admin/principal can start new conversations in this build.');
            return;
        }

        const recipientUid = commEl('recipientSelect')?.value || '';
        if (!recipientUid) {
            alert('Select a recipient.');
            return;
        }

        const subject = (commEl('threadSubject')?.value || '').trim();

        const existing = commState.threads.find(t => {
            const ids = Array.isArray(t.participantIds) ? t.participantIds : [];
            return ids.length === 2 && ids.includes(uid) && ids.includes(recipientUid);
        });
        if (existing) {
            closeModal('newThreadModal');
            switchTab('messages');
            commSelectThread(existing.id);
            return;
        }

        const recipient = await commBuildParticipant(recipientUid);
        const me = { uid, role, email: user?.email || '', name };

        const thread = {
            participantIds: [uid, recipientUid],
            participants: [me, recipient],
            subject,
            lastMessage: '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: uid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: uid,
            tenantId: commGetTenant()
        };

        const ref = await db.collection('message_threads').add(thread);
        if (typeof logAudit === 'function') logAudit('thread_create', `message_threads/${ref.id}`, { recipientUid });

        closeModal('newThreadModal');
        switchTab('messages');
        await loadThreads();
        commSelectThread(ref.id);
    } catch (err) {
        console.error(err);
        alert('Failed to create conversation: ' + (err.message || err));
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = originalText; }
    }
}

async function commBuildParticipant(uid) {
    try {
        const teacherDoc = await db.collection('teachers').doc(uid).get();
        if (teacherDoc.exists) {
            const t = teacherDoc.data() || {};
            const name = `${t.firstName || ''} ${t.lastName || ''}`.trim();
            return { uid, role: 'teacher', email: t.email || '', name: name || (t.email || uid) };
        }
    } catch (e) { }

    try {
        const studentDoc = await db.collection('students').doc(uid).get();
        if (studentDoc.exists) {
            const s = studentDoc.data() || {};
            const name = `${s.firstName || ''} ${s.lastName || ''}`.trim();
            return { uid, role: 'student', email: s.email || '', name: name || (s.email || uid) };
        }
    } catch (e) { }

    try {
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
            const u = userDoc.data() || {};
            const name = u.name || (u.email ? u.email.split('@')[0] : uid);
            return { uid, role: u.role || 'user', email: u.email || '', name };
        }
    } catch (e) { }

    return { uid, role: 'user', email: '', name: uid };
}
