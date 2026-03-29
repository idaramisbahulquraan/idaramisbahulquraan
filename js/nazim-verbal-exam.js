const verbalExamState = {
    criteria: [
        { key: 'yaadasht', label: 'یاداشت 1-20', max: 20, legacyKeys: ['wajibat'] },
        { key: 'itlaq', label: 'اطلاق 1-25', max: 25, legacyKeys: ['tarjama'] },
        { key: 'tajzia', label: 'تجزیہ 1-25', max: 25 },
        { key: 'fahm', label: 'فہم 1-30', max: 30, legacyKeys: ['tafheem'] },
        { key: 'assignmentScore', label: 'اسائنمنٹ کا معیار', max: null, legacyKeys: ['monthlyExam', 'monthlyQuiz', 'imla'] }
    ],
    departments: [],
    classes: [],
    subjects: [],
    students: [],
    existingScores: new Map(),
    selectedSubjectDoc: null,
    currentUser: null
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!document.getElementById('scoreSheetBody')) return;

    document.documentElement.lang = 'ur';
    document.documentElement.dir = 'rtl';
    try { localStorage.setItem('app_lang', 'ur'); } catch (e) { /* ignore */ }
    if (typeof applyLanguagePreference === 'function') applyLanguagePreference('ur');
    if (typeof updatePageLanguage === 'function') updatePageLanguage();
    forceUrduLabels();

    verbalExamState.currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const allowed = hasUserRole(verbalExamState.currentUser, 'admin') || hasUserRole(verbalExamState.currentUser, 'nazim_e_taleemaat');
    document.getElementById('accessDeniedCard').style.display = allowed ? 'none' : '';
    document.getElementById('verbalExamContent').style.display = allowed ? '' : 'none';
    if (!allowed) return;

    const dateInput = document.getElementById('examDate');
    if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];

    showSheetPlaceholder('کلاس، مضمون اور تاریخ منتخب کر کے شیٹ لوڈ کریں۔');
    await loadNazimDepartments();
});

function forceUrduLabels() {
    const pageTitle = document.querySelector('.page-title h1');
    if (pageTitle) pageTitle.innerText = 'زبانی امتحان نمبرات';
    const title = document.getElementById('sheetTitle');
    if (title) title.innerText = 'زبانی امتحان نمبرات';
}

function showSheetPlaceholder(message) {
    const card = document.getElementById('scoreSheetCard');
    const tbody = document.getElementById('scoreSheetBody');
    if (!card || !tbody) return;
    card.style.display = '';
    tbody.innerHTML = `<tr><td colspan="${verbalExamState.criteria.length + 3}" style="text-align:center; color:var(--text-light);">${message}</td></tr>`;
}

async function loadNazimDepartments() {
    const select = document.getElementById('department');
    if (!select) return;
    select.innerHTML = '<option value="" data-i18n="select_department">Select Department</option>';

    const snapshot = await db.collection('departments').orderBy('name').get();
    verbalExamState.departments = [];
    snapshot.forEach(doc => verbalExamState.departments.push({ id: doc.id, ...(doc.data() || {}) }));

    verbalExamState.departments.forEach(dept => {
        const opt = document.createElement('option');
        opt.value = dept.name || '';
        opt.innerText = (typeof getDepartmentDisplayName === 'function')
            ? getDepartmentDisplayName(dept.name || '', dept.name_ur || '')
            : (dept.name_ur || dept.name || '');
        select.appendChild(opt);
    });
    if (typeof updatePageLanguage === 'function') updatePageLanguage();
}

async function updateNazimClasses() {
    const dept = document.getElementById('department').value;
    const classSelect = document.getElementById('className');
    const subjectSelect = document.getElementById('subject');
    classSelect.innerHTML = '<option value="" data-i18n="select_class">Select Class</option>';
    subjectSelect.innerHTML = '<option value="" data-i18n="select_subject">Select Subject</option>';
    verbalExamState.classes = [];
    verbalExamState.subjects = [];
    verbalExamState.selectedSubjectDoc = null;
    showSheetPlaceholder('کلاس منتخب کریں، پھر مضمون منتخب کریں۔');
    if (!dept) return;

    const snapshot = await db.collection('classes').where('department', '==', dept).get();
    snapshot.forEach(doc => verbalExamState.classes.push({ id: doc.id, ...(doc.data() || {}) }));
    verbalExamState.classes
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
        .forEach(cls => {
            const opt = document.createElement('option');
            opt.value = cls.name || '';
            opt.innerText = (typeof getClassDisplayName === 'function')
                ? getClassDisplayName(cls.name || '', cls.name_ur || '')
                : (cls.name_ur || cls.name || '');
            classSelect.appendChild(opt);
        });

    if (typeof updatePageLanguage === 'function') updatePageLanguage();
}

async function updateNazimSubjects() {
    const dept = document.getElementById('department').value;
    const className = document.getElementById('className').value;
    const subjectSelect = document.getElementById('subject');
    subjectSelect.innerHTML = '<option value="" data-i18n="select_subject">Select Subject</option>';
    verbalExamState.subjects = [];
    verbalExamState.selectedSubjectDoc = null;
    showSheetPlaceholder('مضمون منتخب کریں اور پھر شیٹ لوڈ کریں۔');
    if (!dept || !className) return;

    const snapshot = await db.collection('subjects')
        .where('department', '==', dept)
        .where('className', '==', className)
        .get();

    snapshot.forEach(doc => verbalExamState.subjects.push({ id: doc.id, ...(doc.data() || {}) }));
    verbalExamState.subjects
        .sort((a, b) => getSubjectDisplayName(a).localeCompare(getSubjectDisplayName(b), 'ur'))
        .forEach(subject => {
            const opt = document.createElement('option');
            opt.value = subject.id;
            opt.innerText = (typeof getSubjectDisplayName === 'function')
                ? getSubjectDisplayName(subject)
                : (subject.name_ur || subject.name || '');
            subjectSelect.appendChild(opt);
        });

    if (typeof updatePageLanguage === 'function') updatePageLanguage();
}

async function loadVerbalExamSheet() {
    const dept = document.getElementById('department').value;
    const className = document.getElementById('className').value;
    const subjectId = document.getElementById('subject').value;
    const examDate = document.getElementById('examDate').value;

    if (!dept || !className || !subjectId || !examDate) {
        alert('شعبہ، کلاس، مضمون اور تاریخ منتخب کریں۔');
        return;
    }

    verbalExamState.selectedSubjectDoc = verbalExamState.subjects.find(subject => subject.id === subjectId) || null;
    if (!verbalExamState.selectedSubjectDoc) {
        alert('مضمون نہیں ملا۔');
        return;
    }

    showSheetPlaceholder('شیٹ لوڈ ہو رہی ہے...');

    try {
        const selectedClass = verbalExamState.classes.find(cls => cls.name === className) || null;
        const deptUr = verbalExamState.departments.find(item => item.name === dept)?.name_ur || '';
        const queryTasks = [
            db.collection('students').where('department', '==', dept).where('className', '==', className).get(),
            db.collection('students').where('department', '==', dept).where('admissionClass', '==', className).get()
        ];

        if (selectedClass?.id) {
            queryTasks.push(db.collection('students').where('classId', '==', selectedClass.id).get());
        }
        if (selectedClass?.name_ur) {
            queryTasks.push(db.collection('students').where('className_ur', '==', selectedClass.name_ur).get());
            queryTasks.push(db.collection('students').where('admissionClass_ur', '==', selectedClass.name_ur).get());
        }
        if (deptUr && selectedClass?.name_ur) {
            queryTasks.push(db.collection('students').where('department_ur', '==', deptUr).where('className_ur', '==', selectedClass.name_ur).get());
        }

        const settled = await Promise.allSettled([
            ...queryTasks,
            db.collection('verbal_exam_scores').where('examDate', '==', examDate).get()
        ]);

        const scoreResult = settled.pop();
        const studentMap = new Map();

        settled.forEach(result => {
            if (result.status !== 'fulfilled') return;
            result.value.forEach(doc => {
                studentMap.set(doc.id, { id: doc.id, ...(doc.data() || {}) });
            });
        });

        verbalExamState.students = Array.from(studentMap.values()).sort((a, b) => {
            const rollA = Number(a.rollNumber || 0) || 0;
            const rollB = Number(b.rollNumber || 0) || 0;
            if (rollA !== rollB) return rollA - rollB;
            return `${a.firstName || ''} ${a.lastName || ''}`.localeCompare(`${b.firstName || ''} ${b.lastName || ''}`, 'en');
        });

        verbalExamState.existingScores = new Map();
        if (scoreResult?.status === 'fulfilled') {
            scoreResult.value.forEach(doc => {
                const data = doc.data() || {};
                if (data.className === className && data.subjectId === subjectId) {
                    verbalExamState.existingScores.set(data.studentId, { id: doc.id, ...data });
                }
            });
        }

        renderVerbalExamSheet();
    } catch (error) {
        console.error('Failed to load verbal exam sheet', error);
        showSheetPlaceholder(`شیٹ لوڈ نہیں ہو سکی: ${error.message}`);
    }
}

function renderVerbalExamSheet() {
    const tbody = document.getElementById('scoreSheetBody');
    const card = document.getElementById('scoreSheetCard');
    const subject = verbalExamState.selectedSubjectDoc;
    if (!tbody || !subject) return;

    if (!verbalExamState.students.length) {
        tbody.innerHTML = `<tr><td colspan="${verbalExamState.criteria.length + 3}" style="text-align:center;">کوئی طالب علم نہیں ملا۔</td></tr>`;
        card.style.display = '';
        return;
    }

    document.getElementById('sheetTitle').innerText = 'زبانی امتحان نمبرات';
    document.getElementById('sheetMeta').innerText = [
        (typeof getClassDisplayName === 'function') ? getClassDisplayName(subject.className || '', subject.className_ur || '') : (subject.className_ur || subject.className || ''),
        (typeof getSubjectDisplayName === 'function') ? getSubjectDisplayName(subject) : (subject.name_ur || subject.name || ''),
        document.getElementById('examDate').value
    ].filter(Boolean).join(' • ');

    tbody.innerHTML = verbalExamState.students.map((student, index) => {
        const scoreDoc = verbalExamState.existingScores.get(student.id) || {};
        const scores = scoreDoc.scores || {};
        const total = calculateVerbalScoreTotal(scores);
        const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.name || student.email || student.id;

        const cells = verbalExamState.criteria.map(criteria => {
            const maxAttr = criteria.max ? `max="${criteria.max}"` : '';
            const hint = criteria.max ? `0-${criteria.max}` : '0';
            return `
                <td>
                    <input
                        type="number"
                        class="score-input"
                        min="0"
                        ${maxAttr}
                        step="1"
                        placeholder="${hint}"
                        value="${getCriteriaScoreValue(scores, criteria)}"
                        data-student-id="${student.id}"
                        data-criteria="${criteria.key}"
                        oninput="updateVerbalScoreRow('${student.id}')">
                </td>
            `;
        }).join('');

        return `
            <tr>
                <td>${index + 1}</td>
                <td>
                    <div style="font-weight:600;">${fullName}</div>
                    <div style="font-size:0.8rem; color:var(--text-light);">${student.rollNumber ? `رول نمبر: ${student.rollNumber}` : ''}</div>
                </td>
                ${cells}
                <td class="score-total" id="total_${student.id}">${total}</td>
            </tr>
        `;
    }).join('');

    card.style.display = '';
}

function updateVerbalScoreRow(studentId) {
    const values = {};
    verbalExamState.criteria.forEach(criteria => {
        const input = document.querySelector(`input[data-student-id="${studentId}"][data-criteria="${criteria.key}"]`);
        values[criteria.key] = Number(input?.value || 0) || 0;
    });
    const totalEl = document.getElementById(`total_${studentId}`);
    if (totalEl) totalEl.innerText = calculateVerbalScoreTotal(values);
}

function calculateVerbalScoreTotal(scores) {
    return verbalExamState.criteria.reduce((sum, criteria) => sum + (Number(getCriteriaScoreValue(scores, criteria) || 0) || 0), 0);
}

function getCriteriaScoreValue(scores, criteria) {
    if (!scores || !criteria) return '';
    if (scores[criteria.key] != null) return scores[criteria.key];
    const legacyKeys = Array.isArray(criteria.legacyKeys) ? criteria.legacyKeys : [];
    for (const key of legacyKeys) {
        if (scores[key] != null) return scores[key];
    }
    return '';
}

function buildVerbalScoreDocId(examDate, className, subjectId, studentId) {
    return [examDate, className, subjectId, studentId]
        .map(value => String(value || '').trim().replace(/[\/\\?#%\*:|"<>]/g, '-').replace(/\s+/g, '_'))
        .filter(Boolean)
        .join('__');
}

async function saveVerbalExamScores() {
    const dept = document.getElementById('department').value;
    const className = document.getElementById('className').value;
    const examDate = document.getElementById('examDate').value;
    const subject = verbalExamState.selectedSubjectDoc;
    if (!dept || !className || !examDate || !subject) {
        alert('پہلے کلاس کی شیٹ لوڈ کریں۔');
        return;
    }

    const btn = document.querySelector('#scoreSheetCard .btn-primary');
    const originalText = btn ? btn.innerText : '';
    if (btn) {
        btn.disabled = true;
        btn.innerText = 'محفوظ ہو رہا ہے...';
    }

    try {
        const batch = db.batch();
        verbalExamState.students.forEach(student => {
            const scores = {};
            verbalExamState.criteria.forEach(criteria => {
                const input = document.querySelector(`input[data-student-id="${student.id}"][data-criteria="${criteria.key}"]`);
                const value = Number(input?.value || 0) || 0;
                scores[criteria.key] = value;
            });

            const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.name || student.email || student.id;
            const docId = buildVerbalScoreDocId(examDate, className, subject.id, student.id);
            const ref = db.collection('verbal_exam_scores').doc(docId);
            batch.set(ref, {
                examDate,
                department: dept,
                department_ur: subject.department_ur || '',
                classId: subject.classId || '',
                className,
                className_ur: subject.className_ur || '',
                subjectId: subject.id,
                subject: subject.name || '',
                subject_ur: subject.name_ur || subject.name || '',
                subjectLabel: (typeof getSubjectDisplayName === 'function') ? getSubjectDisplayName(subject) : (subject.name_ur || subject.name || ''),
                studentId: student.id,
                studentName: fullName,
                rollNumber: student.rollNumber || '',
                scores,
                total: calculateVerbalScoreTotal(scores),
                criteriaMeta: verbalExamState.criteria,
                assessedByUid: verbalExamState.currentUser?.uid || '',
                assessedByName: verbalExamState.currentUser?.name || verbalExamState.currentUser?.displayName || '',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        });

        await batch.commit();
        alert('نمبرات کامیابی سے محفوظ ہو گئے۔');
        await loadVerbalExamSheet();
    } catch (error) {
        console.error('Failed to save verbal exam scores', error);
        alert(`Error: ${error.message}`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = originalText || 'تمام نمبرات محفوظ کریں';
        }
    }
}
