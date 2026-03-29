// Homework management for teacher and student views.

function getTenantSafe() {
    return (typeof getCurrentTenant === 'function') ? getCurrentTenant() : (localStorage.getItem('tenant_id') || 'default');
}

async function initHomeworkSelectors() {
    const deptSel = document.getElementById('hwDepartment');
    const classSel = document.getElementById('hwClass');
    if (!deptSel || !classSel) return;
    const renderDepartments = async () => {
        const currentVal = deptSel.value;
        deptSel.innerHTML = '<option value="" data-i18n="select_department">Select Department</option>';
        if (typeof updatePageLanguage === 'function') updatePageLanguage();
        const deps = await db.collection('departments').get();
        const list = [];
        deps.forEach(d => {
            const data = d.data();
            if (data?.name) list.push({ name: data.name, name_ur: data.name_ur || '' });
        });
        list.sort((a, b) => {
            const aLabel = (typeof getDepartmentDisplayName === 'function') ? getDepartmentDisplayName(a.name, a.name_ur || a.name) : (a.name_ur || a.name);
            const bLabel = (typeof getDepartmentDisplayName === 'function') ? getDepartmentDisplayName(b.name, b.name_ur || b.name) : (b.name_ur || b.name);
            return aLabel.localeCompare(bLabel);
        });
        list.forEach(dep => {
            const opt = document.createElement('option');
            opt.value = dep.name;
            opt.innerText = (typeof getDepartmentDisplayName === 'function') ? getDepartmentDisplayName(dep.name, dep.name_ur || dep.name) : (dep.name_ur || dep.name);
            deptSel.appendChild(opt);
        });
        if (currentVal) deptSel.value = currentVal;
    };

    const renderClasses = async (dep) => {
        const currentVal = classSel.value;
        classSel.innerHTML = '<option value="" data-i18n="select_class">Select Class</option>';
        if (typeof updatePageLanguage === 'function') updatePageLanguage();
        if (!dep) return;
        const snap = await db.collection('classes').where('department', '==', dep).get();
        const list = [];
        snap.forEach(c => {
            const data = c.data();
            if (data?.name) list.push({ name: data.name, name_ur: data.name_ur || '' });
        });
        list.sort((a, b) => {
            const aLabel = (typeof getClassDisplayName === 'function') ? getClassDisplayName(a.name, a.name_ur || a.name) : (a.name_ur || a.name);
            const bLabel = (typeof getClassDisplayName === 'function') ? getClassDisplayName(b.name, b.name_ur || b.name) : (b.name_ur || b.name);
            return aLabel.localeCompare(bLabel);
        });
        list.forEach(cls => {
            const opt = document.createElement('option');
            opt.value = cls.name;
            opt.innerText = (typeof getClassDisplayName === 'function') ? getClassDisplayName(cls.name, cls.name_ur || cls.name) : (cls.name_ur || cls.name);
            classSel.appendChild(opt);
        });
        if (currentVal) classSel.value = currentVal;
    };

    try {
        await renderDepartments();
        deptSel.addEventListener('change', async () => {
            await renderClasses(deptSel.value);
        });
        if (deptSel.value) await renderClasses(deptSel.value);

        window.addEventListener('language-changed', async () => {
            try {
                await renderDepartments();
                await renderClasses(deptSel.value);
            } catch (e) { /* noop */ }
        });
    } catch (err) {
        console.error('Failed to load selectors', err);
    }
}

async function createHomework() {
    const dept = document.getElementById('hwDepartment').value;
    const cls = document.getElementById('hwClass').value;
    const subject = document.getElementById('hwSubject').value;
    const title = document.getElementById('hwTitle').value;
    const details = document.getElementById('hwDetails').value;
    const dueDate = document.getElementById('hwDueDate').value;
    const latePolicy = document.getElementById('hwLatePolicy').value;

    if (!dept || !cls || !subject || !title || !dueDate) {
        alert('Please fill Department, Class, Subject, Title, and Due Date.');
        return;
    }
    const btn = document.querySelector('button[onclick="createHomework()"]');
    if (btn) { btn.disabled = true; btn.innerText = 'Saving...'; }
    try {
        const payload = {
            department: dept,
            className: cls,
            subject,
            title,
            details,
            dueDate,
            latePolicy,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: firebase.auth().currentUser ? firebase.auth().currentUser.uid : '',
            tenantId: getTenantSafe()
        };
        await db.collection('homework').add(payload);
        if (typeof logAudit === 'function') {
            logAudit('homework_create', 'homework', { dept, cls, subject, title });
        }
        alert('Homework saved.');
        loadHomework();
    } catch (err) {
        console.error(err);
        alert('Failed to save: ' + err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = 'Save Homework'; }
    }
}

async function loadHomework() {
    const list = document.getElementById('homeworkList');
    if (!list) return;
    list.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading...</td></tr>';
    try {
        let snap = await db.collection('homework').orderBy('dueDate', 'asc').limit(50).get();
        if (snap.empty) {
            list.innerHTML = '<tr><td colspan="5" style="text-align:center;">No homework assigned yet.</td></tr>';
            return;
        }
        let rows = '';
        snap.forEach(doc => {
            const h = doc.data();
            rows += `
                <tr>
                    <td>${h.title}</td>
                    <td>${(typeof getClassDisplayName === 'function') ? getClassDisplayName(h.className || '') : (h.className_ur || h.className || '')}</td>
                    <td>${h.subject}</td>
                    <td>${h.dueDate || ''}</td>
                    <td><button class="btn-primary" style="padding:0.35rem 0.75rem;" onclick="deleteHomework('${doc.id}')">Delete</button></td>
                </tr>
            `;
        });
        list.innerHTML = rows;
    } catch (err) {
        console.error(err);
        list.innerHTML = '<tr><td colspan="5" style="text-align:center;color:red;">Error loading homework.</td></tr>';
    }
}

async function deleteHomework(id) {
    if (!confirm('Delete this homework?')) return;
    try {
        await db.collection('homework').doc(id).delete();
        if (typeof logAudit === 'function') {
            logAudit('homework_delete', `homework/${id}`, {});
        }
        loadHomework();
    } catch (err) {
        console.error(err);
        alert('Failed to delete.');
    }
}

async function loadStudentHomework() {
    const tbody = document.getElementById('studentHomeworkList');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading...</td></tr>';
    try {
        const student = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const className = student.className || '';
        const dept = student.department || '';
        if (!className || !dept) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Profile missing class/department.</td></tr>';
            return;
        }
        let snap = await db.collection('homework')
            .where('department', '==', dept)
            .where('className', '==', className)
            .orderBy('dueDate', 'asc')
            .limit(50)
            .get();
        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No homework assigned.</td></tr>';
            return;
        }
        let rows = '';
        snap.forEach(doc => {
            const h = doc.data();
            rows += `
                <tr>
                    <td>${h.title}</td>
                    <td>${h.subject}</td>
                    <td>${h.dueDate || ''}</td>
                    <td><button class="btn-primary" style="padding:0.35rem 0.75rem;" onclick="submitPlaceholder('${doc.id}')">Submit</button></td>
                </tr>
            `;
        });
        tbody.innerHTML = rows;
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:red;">Error loading homework.</td></tr>';
    }
}

function submitPlaceholder(id) {
    alert('Submission upload placeholder. Integrate file upload and teacher review later. Homework ID: ' + id);
}
