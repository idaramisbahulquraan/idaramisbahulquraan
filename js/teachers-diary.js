const teachersDiaryState = {
    resourceOptions: ['وائٹ بورڈ', 'کتاب', 'فلیش کارڈز', 'ورک شیٹ', 'پروجیکٹر', 'زبانی مشق'],
    evidenceOptions: ['سوالات کے جواب', 'ورک شیٹ مکمل', 'گروپ ورک', 'زبانی شرکت'],
    engagementOptions: [
        { key: 'high', label: 'زیادہ' },
        { key: 'medium', label: 'درمیانہ' },
        { key: 'low', label: 'کم' }
    ],
    departments: [],
    classes: [],
    subjects: [],
    students: [],
    selectedClassDoc: null,
    selectedSubjectDoc: null,
    currentUser: null,
    currentDiaryDocId: '',
    currentDiaryDoc: null,
    currentEntries: new Map()
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!document.getElementById('teachersDiaryGridBody')) return;

    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    teachersDiaryState.currentUser = currentUser;

    if (typeof initDashboard === 'function') {
        initDashboard(currentUser);
    }

    const roles = getUserRoles(currentUser);
    const allowed = roles.some(role => !['student', 'parent'].includes(role));
    const deniedCard = document.getElementById('teachersDiaryAccessDenied');
    const content = document.getElementById('teachersDiaryContent');
    if (deniedCard) deniedCard.style.display = allowed ? 'none' : '';
    if (content) content.style.display = allowed ? '' : 'none';
    if (!allowed) return;

    const dateInput = document.getElementById('diaryDate');
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    renderGlobalResourceChips([]);
    bindTeachersDiaryEvents();
    showTeachersDiaryPlaceholder('کلاس، سیکشن، مضمون اور تاریخ منتخب کر کے شیٹ لوڈ کریں۔');
    await loadDiaryDepartments();
});

function bindTeachersDiaryEvents() {
    const departmentSelect = document.getElementById('diaryDepartment');
    const classSelect = document.getElementById('diaryClass');
    const sectionSelect = document.getElementById('diarySection');
    const subjectSelect = document.getElementById('diarySubject');
    const loadBtn = document.getElementById('loadTeachersDiaryBtn');
    const saveBtn = document.getElementById('saveTeachersDiaryBtn');
    const applyGoalBtn = document.getElementById('applyGoalToAllBtn');
    const applyResourcesBtn = document.getElementById('applyResourcesToAllBtn');
    const filterSelect = document.getElementById('diaryRowFilter');
    const gridBody = document.getElementById('teachersDiaryGridBody');
    const globalChips = document.getElementById('globalResourceChips');

    departmentSelect?.addEventListener('change', async () => {
        await updateDiaryClasses();
        await updateDiarySubjects();
    });

    classSelect?.addEventListener('change', async () => {
        updateDiarySections();
        await updateDiarySubjects();
    });

    sectionSelect?.addEventListener('change', async () => {
        await updateDiarySubjects();
        showTeachersDiaryPlaceholder('سیکشن منتخب ہو گیا۔ اب شیٹ لوڈ کریں۔');
    });

    subjectSelect?.addEventListener('change', () => {
        showTeachersDiaryPlaceholder('مضمون منتخب ہو گیا۔ اب شیٹ لوڈ کریں۔');
    });

    loadBtn?.addEventListener('click', loadTeachersDiarySheet);
    saveBtn?.addEventListener('click', saveTeachersDiaryEntries);
    applyGoalBtn?.addEventListener('click', applyLessonGoalToAllRows);
    applyResourcesBtn?.addEventListener('click', applyResourcesToAllRows);
    filterSelect?.addEventListener('change', applyTeachersDiaryFilter);

    globalChips?.addEventListener('click', (event) => {
        const chip = event.target.closest('.diary-chip[data-global-resource]');
        if (!chip) return;
        chip.classList.toggle('is-selected');
    });

    gridBody?.addEventListener('click', (event) => {
        const chip = event.target.closest('.diary-chip[data-row-id]');
        if (chip) {
            handleDiaryChipClick(chip);
            updateTeachersDiarySummaries();
            return;
        }

        const segmentBtn = event.target.closest('.diary-segment-btn[data-row-id]');
        if (segmentBtn) {
            handleDiaryEngagementClick(segmentBtn);
            updateTeachersDiarySummaries();
        }
    });

    gridBody?.addEventListener('change', (event) => {
        const checkbox = event.target.closest('.diary-help-checkbox');
        if (checkbox) {
            toggleDiaryHelpState(checkbox.dataset.rowId);
            updateTeachersDiarySummaries();
        }
    });

    gridBody?.addEventListener('input', () => {
        updateTeachersDiarySummaries();
    });
}

async function loadDiaryDepartments() {
    const select = document.getElementById('diaryDepartment');
    if (!select) return;

    select.innerHTML = '<option value="">شعبہ منتخب کریں</option>';
    const snapshot = await db.collection('departments').orderBy('name').get();
    teachersDiaryState.departments = [];
    snapshot.forEach(doc => teachersDiaryState.departments.push({ id: doc.id, ...(doc.data() || {}) }));

    teachersDiaryState.departments.forEach((department) => {
        const option = document.createElement('option');
        option.value = department.name || '';
        option.innerText = typeof getDepartmentDisplayName === 'function'
            ? getDepartmentDisplayName(department.name || '', department.name_ur || '')
            : (department.name_ur || department.name || '');
        select.appendChild(option);
    });

    resetDiaryClassSelect();
    resetDiarySectionSelect();
    resetDiarySubjectSelect();
}

async function updateDiaryClasses() {
    const department = document.getElementById('diaryDepartment')?.value || '';
    const select = document.getElementById('diaryClass');
    if (!select) return;

    teachersDiaryState.selectedClassDoc = null;
    teachersDiaryState.classes = [];
    select.innerHTML = '<option value="">کلاس منتخب کریں</option>';
    resetDiarySectionSelect();
    resetDiarySubjectSelect();

    if (!department) {
        showTeachersDiaryPlaceholder('پہلے شعبہ منتخب کریں۔');
        return;
    }

    const snapshot = await db.collection('classes').where('department', '==', department).get();
    snapshot.forEach(doc => teachersDiaryState.classes.push({ id: doc.id, ...(doc.data() || {}) }));
    teachersDiaryState.classes
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
        .forEach((cls) => {
            const option = document.createElement('option');
            option.value = cls.name || '';
            option.innerText = typeof getClassDisplayName === 'function'
                ? getClassDisplayName(cls.name || '', cls.name_ur || '')
                : (cls.name_ur || cls.name || '');
            select.appendChild(option);
        });

    showTeachersDiaryPlaceholder('کلاس منتخب کریں۔');
}

function updateDiarySections() {
    const className = document.getElementById('diaryClass')?.value || '';
    const select = document.getElementById('diarySection');
    if (!select) return;

    teachersDiaryState.selectedClassDoc = teachersDiaryState.classes.find(item => item.name === className) || null;
    select.innerHTML = '';

    const sections = normalizeSectionList(teachersDiaryState.selectedClassDoc?.sections);
    if (!sections.length) {
        const option = document.createElement('option');
        option.value = '';
        option.innerText = 'عمومی';
        select.appendChild(option);
        return;
    }

    sections.forEach((section) => {
        const option = document.createElement('option');
        option.value = section;
        option.innerText = `سیکشن ${section}`;
        select.appendChild(option);
    });
}

async function updateDiarySubjects() {
    const department = document.getElementById('diaryDepartment')?.value || '';
    const className = document.getElementById('diaryClass')?.value || '';
    const section = document.getElementById('diarySection')?.value || '';
    const select = document.getElementById('diarySubject');
    if (!select) return;

    teachersDiaryState.subjects = [];
    teachersDiaryState.selectedSubjectDoc = null;
    select.innerHTML = '<option value="">مضمون منتخب کریں</option>';

    if (!department || !className) {
        showTeachersDiaryPlaceholder('پہلے شعبہ اور کلاس منتخب کریں۔');
        return;
    }

    const snapshot = await db.collection('subjects')
        .where('department', '==', department)
        .where('className', '==', className)
        .get();

    const roles = getUserRoles(teachersDiaryState.currentUser);
    const elevated = roles.some(role => ['admin', 'owner', 'principal', 'nazim_e_taleemaat', 'hifz_supervisor', 'accountant', 'clerk'].includes(role));
    const teacherUid = teachersDiaryState.currentUser?.uid || '';
    const teacherName = String(teachersDiaryState.currentUser?.name || teachersDiaryState.currentUser?.displayName || '').trim();

    snapshot.forEach((doc) => {
        const subject = { id: doc.id, ...(doc.data() || {}) };
        const subjectSections = normalizeSectionList(subject.sections || subject.section);
        const matchesSection = !section || !subjectSections.length || subjectSections.includes(section);
        const matchesTeacher = elevated || !roles.includes('teacher')
            ? true
            : subject.teacherId === teacherUid
            || (Array.isArray(subject.teacherIds) && subject.teacherIds.includes(teacherUid))
            || (teacherName && String(subject.teacherName || '').trim() === teacherName)
            || (Array.isArray(subject.teacherNames) && subject.teacherNames.map(name => String(name || '').trim()).includes(teacherName));

        if (matchesSection && matchesTeacher) {
            teachersDiaryState.subjects.push(subject);
        }
    });

    teachersDiaryState.subjects
        .sort((a, b) => getSubjectDisplayName(a).localeCompare(getSubjectDisplayName(b), 'ur'))
        .forEach((subject) => {
            const option = document.createElement('option');
            option.value = subject.id;
            option.innerText = typeof getSubjectDisplayName === 'function'
                ? getSubjectDisplayName(subject)
                : (subject.name_ur || subject.name || '');
            select.appendChild(option);
        });

    showTeachersDiaryPlaceholder(teachersDiaryState.subjects.length
        ? 'مضمون منتخب کریں اور شیٹ لوڈ کریں۔'
        : 'اس کلاس کے لیے کوئی دستیاب مضمون نہیں ملا۔');
}

function renderGlobalResourceChips(selectedValues) {
    const container = document.getElementById('globalResourceChips');
    if (!container) return;
    const selected = new Set((selectedValues || []).map(normalizeDiaryToken));
    container.innerHTML = teachersDiaryState.resourceOptions.map((resource) => `
        <button type="button"
            class="diary-chip ${selected.has(normalizeDiaryToken(resource)) ? 'is-selected' : ''}"
            data-global-resource="${escapeHtml(resource)}">${escapeHtml(resource)}</button>
    `).join('');
}

function resetDiaryClassSelect() {
    const select = document.getElementById('diaryClass');
    if (select) select.innerHTML = '<option value="">کلاس منتخب کریں</option>';
}

function resetDiarySectionSelect() {
    const select = document.getElementById('diarySection');
    if (!select) return;
    select.innerHTML = '<option value="">عمومی</option>';
}

function resetDiarySubjectSelect() {
    const select = document.getElementById('diarySubject');
    if (select) select.innerHTML = '<option value="">مضمون منتخب کریں</option>';
}

function normalizeSectionList(value) {
    if (!value) return [];
    const raw = Array.isArray(value) ? value : [value];
    return raw
        .flatMap((item) => String(item || '').split(/[,&/]| and /i))
        .map((item) => String(item || '').trim())
        .filter(Boolean);
}

function normalizeDiaryToken(value) {
    return String(value || '').trim().toLowerCase();
}

function showTeachersDiaryPlaceholder(message) {
    const body = document.getElementById('teachersDiaryGridBody');
    if (!body) return;
    body.innerHTML = `<tr><td colspan="9" class="diary-empty">${escapeHtml(message)}</td></tr>`;
    updateTeachersDiaryMeta();
    updateTeachersDiarySummaries();
}

async function loadTeachersDiarySheet() {
    const department = document.getElementById('diaryDepartment')?.value || '';
    const className = document.getElementById('diaryClass')?.value || '';
    const section = document.getElementById('diarySection')?.value || '';
    const subjectId = document.getElementById('diarySubject')?.value || '';
    const diaryDate = document.getElementById('diaryDate')?.value || '';

    if (!department || !className || !subjectId || !diaryDate) {
        alert('شعبہ، کلاس، مضمون اور تاریخ منتخب کریں۔');
        return;
    }

    teachersDiaryState.selectedClassDoc = teachersDiaryState.classes.find(item => item.name === className) || null;
    teachersDiaryState.selectedSubjectDoc = teachersDiaryState.subjects.find(item => item.id === subjectId) || null;
    if (!teachersDiaryState.selectedSubjectDoc) {
        alert('مضمون نہیں ملا۔');
        return;
    }

    showTeachersDiaryPlaceholder('شیٹ لوڈ ہو رہی ہے...');

    try {
        const [studentsSnapshot, diarySnapshot] = await Promise.all([
            db.collection('students').get(),
            db.collection('teacher_diaries').doc(buildTeachersDiaryDocId({
                diaryDate,
                department,
                className,
                section,
                subjectId
            })).get()
        ]);

        const departmentUr = teachersDiaryState.departments.find(item => item.name === department)?.name_ur || '';
        const classUr = teachersDiaryState.selectedClassDoc?.name_ur || '';
        const classId = teachersDiaryState.selectedClassDoc?.id || '';
        const students = [];

        studentsSnapshot.forEach((doc) => {
            const student = { id: doc.id, ...(doc.data() || {}) };
            if (!matchesDiaryDepartment(student, department, departmentUr)) return;
            if (!matchesDiaryClass(student, className, classUr, classId)) return;

            const studentSections = extractStudentSections(student);
            if (section && studentSections.length && !studentSections.includes(normalizeDiaryToken(section))) return;

            students.push(student);
        });

        teachersDiaryState.students = students.sort((a, b) => {
            const rollA = Number(a.rollNumber || 0) || 0;
            const rollB = Number(b.rollNumber || 0) || 0;
            if (rollA !== rollB) return rollA - rollB;
            return getStudentFullName(a).localeCompare(getStudentFullName(b), 'en');
        });

        teachersDiaryState.currentDiaryDocId = buildTeachersDiaryDocId({
            diaryDate,
            department,
            className,
            section,
            subjectId
        });
        teachersDiaryState.currentDiaryDoc = diarySnapshot.exists ? { id: diarySnapshot.id, ...(diarySnapshot.data() || {}) } : null;
        teachersDiaryState.currentEntries = new Map(
            ((teachersDiaryState.currentDiaryDoc?.entries) || []).map((entry) => [String(entry.studentId || ''), entry])
        );

        const existingGoal = teachersDiaryState.currentDiaryDoc?.lessonGoal || '';
        document.getElementById('globalLessonGoal').value = existingGoal;
        renderGlobalResourceChips(teachersDiaryState.currentDiaryDoc?.resourceUsedGlobal || []);

        renderTeachersDiaryGrid();
    } catch (error) {
        console.error('Failed to load teachers diary sheet', error);
        showTeachersDiaryPlaceholder(`شیٹ لوڈ نہیں ہو سکی: ${escapeHtml(error.message)}`);
    }
}

function matchesDiaryDepartment(student, department, departmentUr) {
    const candidates = [student.department, student.department_ur]
        .map((value) => String(value || '').trim())
        .filter(Boolean);
    return candidates.includes(department) || (departmentUr && candidates.includes(departmentUr));
}

function matchesDiaryClass(student, className, classUr, classId) {
    const candidates = [
        student.className,
        student.className_ur,
        student.admissionClass,
        student.admissionClass_ur
    ].map((value) => String(value || '').trim()).filter(Boolean);
    return candidates.includes(className) || (classUr && candidates.includes(classUr)) || (classId && String(student.classId || '') === classId);
}

function extractStudentSections(student) {
    const raw = [
        student.section,
        student.section_ur,
        student.sectionName,
        student.sectionName_ur,
        student.admissionSection,
        student.admissionSection_ur,
        student.sectionLabel
    ];
    return Array.from(new Set(raw.map(normalizeDiaryToken).filter(Boolean)));
}

function renderTeachersDiaryGrid() {
    const body = document.getElementById('teachersDiaryGridBody');
    if (!body) return;

    if (!teachersDiaryState.students.length) {
        body.innerHTML = '<tr><td colspan="9" class="diary-empty">اس انتخاب کے لیے کوئی طالب علم نہیں ملا۔</td></tr>';
        updateTeachersDiaryMeta();
        updateTeachersDiarySummaries();
        return;
    }

    const globalGoal = document.getElementById('globalLessonGoal')?.value || '';
    const globalResources = getSelectedGlobalResources();
    const classLabel = typeof getClassDisplayName === 'function'
        ? getClassDisplayName(teachersDiaryState.selectedClassDoc?.name || '', teachersDiaryState.selectedClassDoc?.name_ur || '')
        : (teachersDiaryState.selectedClassDoc?.name_ur || teachersDiaryState.selectedClassDoc?.name || '');
    const diaryDate = document.getElementById('diaryDate')?.value || '';

    body.innerHTML = teachersDiaryState.students.map((student, index) => {
        const entry = teachersDiaryState.currentEntries.get(String(student.id)) || {};
        const lessonGoal = entry.lessonGoal != null ? entry.lessonGoal : globalGoal;
        const resources = Array.isArray(entry.resourceUsed) && entry.resourceUsed.length ? entry.resourceUsed : globalResources;
        const evidence = Array.isArray(entry.evidence) ? entry.evidence : [];
        const engagement = entry.engagement || 'high';
        const needsHelp = Boolean(entry.needsHelp);
        const helpNotes = entry.helpNotes || '';
        const studentName = getStudentFullName(student);

        return `
            <tr data-row-id="${escapeHtml(student.id)}" class="${needsHelp ? 'needs-help-row' : ''}">
                <td>${index + 1}</td>
                <td class="diary-student-name">
                    ${escapeHtml(studentName)}
                    <div class="diary-student-meta">${student.rollNumber ? `رول نمبر: ${escapeHtml(student.rollNumber)}` : ''}</div>
                </td>
                <td>${escapeHtml(classLabel)}</td>
                <td>${escapeHtml(diaryDate)}</td>
                <td>
                    <input type="text"
                        class="diary-cell-input diary-lesson-goal"
                        data-row-id="${escapeHtml(student.id)}"
                        value="${escapeHtml(lessonGoal)}"
                        placeholder="سبق کا ہدف">
                </td>
                <td>${renderDiaryMultiChips('resource', student.id, teachersDiaryState.resourceOptions, resources)}</td>
                <td>${renderDiaryEngagement(student.id, engagement)}</td>
                <td>${renderDiaryMultiChips('evidence', student.id, teachersDiaryState.evidenceOptions, evidence)}</td>
                <td>
                    <div class="diary-flag-wrap">
                        <label class="diary-flag-label">
                            <input type="checkbox" class="diary-help-checkbox" data-row-id="${escapeHtml(student.id)}" ${needsHelp ? 'checked' : ''}>
                            مدد درکار
                        </label>
                        <textarea
                            class="diary-notes diary-help-notes"
                            data-row-id="${escapeHtml(student.id)}"
                            placeholder="مدد کی نوعیت"
                            style="display:${needsHelp ? 'block' : 'none'};">${escapeHtml(helpNotes)}</textarea>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    updateTeachersDiaryMeta();
    applyTeachersDiaryFilter();
    updateTeachersDiarySummaries();
}

function renderDiaryMultiChips(type, rowId, options, selectedValues) {
    const selected = new Set((selectedValues || []).map(normalizeDiaryToken));
    return `
        <div class="diary-chip-row">
            ${options.map((option) => `
                <button type="button"
                    class="diary-chip ${selected.has(normalizeDiaryToken(option)) ? 'is-selected' : ''}"
                    data-row-id="${escapeHtml(rowId)}"
                    data-chip-type="${escapeHtml(type)}"
                    data-value="${escapeHtml(option)}">${escapeHtml(option)}</button>
            `).join('')}
        </div>
    `;
}

function renderDiaryEngagement(rowId, selectedKey) {
    return `
        <div class="diary-segment">
            ${teachersDiaryState.engagementOptions.map((option) => `
                <button type="button"
                    class="diary-segment-btn ${option.key === selectedKey ? 'is-selected' : ''}"
                    data-row-id="${escapeHtml(rowId)}"
                    data-engagement="${escapeHtml(option.key)}">${escapeHtml(option.label)}</button>
            `).join('')}
        </div>
    `;
}

function handleDiaryChipClick(chip) {
    const type = chip.dataset.chipType || '';
    if (!type) return;
    chip.classList.toggle('is-selected');
}

function handleDiaryEngagementClick(button) {
    const rowId = button.dataset.rowId || '';
    const container = button.closest('.diary-segment');
    if (!rowId || !container) return;
    container.querySelectorAll('.diary-segment-btn').forEach((item) => item.classList.remove('is-selected'));
    button.classList.add('is-selected');
}

function toggleDiaryHelpState(rowId) {
    if (!rowId) return;
    const row = document.querySelector(`tr[data-row-id="${cssEscape(rowId)}"]`);
    const checkbox = document.querySelector(`.diary-help-checkbox[data-row-id="${cssEscape(rowId)}"]`);
    const notes = document.querySelector(`.diary-help-notes[data-row-id="${cssEscape(rowId)}"]`);
    const needsHelp = Boolean(checkbox?.checked);
    if (row) row.classList.toggle('needs-help-row', needsHelp);
    if (notes) notes.style.display = needsHelp ? 'block' : 'none';
}

function getSelectedGlobalResources() {
    return Array.from(document.querySelectorAll('#globalResourceChips .diary-chip.is-selected'))
        .map((chip) => String(chip.dataset.globalResource || '').trim())
        .filter(Boolean);
}

function applyLessonGoalToAllRows() {
    const lessonGoal = document.getElementById('globalLessonGoal')?.value || '';
    document.querySelectorAll('.diary-lesson-goal').forEach((input) => {
        input.value = lessonGoal;
    });
    updateTeachersDiarySummaries();
}

function applyResourcesToAllRows() {
    const selected = new Set(getSelectedGlobalResources().map(normalizeDiaryToken));
    document.querySelectorAll('.diary-chip[data-chip-type="resource"]').forEach((chip) => {
        chip.classList.toggle('is-selected', selected.has(normalizeDiaryToken(chip.dataset.value)));
    });
    updateTeachersDiarySummaries();
}

function applyTeachersDiaryFilter() {
    const filter = document.getElementById('diaryRowFilter')?.value || 'all';
    document.querySelectorAll('#teachersDiaryGridBody tr[data-row-id]').forEach((row) => {
        const checkbox = row.querySelector('.diary-help-checkbox');
        const show = filter === 'all' || Boolean(checkbox?.checked);
        row.style.display = show ? '' : 'none';
    });
}

function updateTeachersDiaryMeta() {
    const title = document.getElementById('teachersDiarySheetTitle');
    const meta = document.getElementById('teachersDiarySheetMeta');
    if (!title || !meta) return;

    const subject = teachersDiaryState.selectedSubjectDoc;
    const classDoc = teachersDiaryState.selectedClassDoc;
    if (!subject || !classDoc) {
        title.innerText = 'کلاس ڈائری';
        meta.innerText = 'شیٹ لوڈ کریں تاکہ طلبہ کی فہرست ظاہر ہو۔';
        return;
    }

    const section = document.getElementById('diarySection')?.value || '';
    const classLabel = typeof getClassDisplayName === 'function'
        ? getClassDisplayName(classDoc.name || '', classDoc.name_ur || '')
        : (classDoc.name_ur || classDoc.name || '');
    const subjectLabel = typeof getSubjectDisplayName === 'function'
        ? getSubjectDisplayName(subject)
        : (subject.name_ur || subject.name || '');
    const date = document.getElementById('diaryDate')?.value || '';

    title.innerText = 'ٹیچرز ڈائری';
    meta.innerText = [
        classLabel,
        section ? `سیکشن ${section}` : 'عمومی',
        subjectLabel,
        date
    ].filter(Boolean).join(' • ');
}

function updateTeachersDiarySummaries() {
    const rows = Array.from(document.querySelectorAll('#teachersDiaryGridBody tr[data-row-id]'));
    const helpCount = rows.filter((row) => Boolean(row.querySelector('.diary-help-checkbox')?.checked)).length;
    const partialCount = rows.filter((row) => isDiaryRowPartiallyFilled(row)).length;

    const quick = document.getElementById('teachersDiaryQuickSummary');
    if (quick) {
        quick.innerHTML = `
            <span><strong>${rows.length}</strong> طلبہ</span>
            <span><strong>${helpCount}</strong> مدد درکار</span>
        `;
    }

    const footer = document.getElementById('teachersDiaryFooterSummary');
    if (footer) {
        footer.innerHTML = `
            <span><strong>${rows.length}</strong> اندراجات</span>
            <span><strong>${helpCount}</strong> مدد درکار</span>
            <span><strong>${partialCount}</strong> جزوی مکمل</span>
        `;
    }
}

function isDiaryRowPartiallyFilled(row) {
    if (!row) return false;
    const goal = String(row.querySelector('.diary-lesson-goal')?.value || '').trim();
    const resources = row.querySelectorAll('.diary-chip[data-chip-type="resource"].is-selected').length;
    const evidence = row.querySelectorAll('.diary-chip[data-chip-type="evidence"].is-selected').length;
    const help = Boolean(row.querySelector('.diary-help-checkbox')?.checked);
    return Boolean(goal || resources || evidence || help);
}

function buildTeachersDiaryDocId({ diaryDate, department, className, section, subjectId }) {
    return [diaryDate, department, className, section || 'common', subjectId]
        .map((value) => String(value || '').trim().replace(/[\/\\?#%\*:|"<>]/g, '-').replace(/\s+/g, '_'))
        .filter(Boolean)
        .join('__');
}

async function saveTeachersDiaryEntries() {
    const department = document.getElementById('diaryDepartment')?.value || '';
    const className = document.getElementById('diaryClass')?.value || '';
    const section = document.getElementById('diarySection')?.value || '';
    const diaryDate = document.getElementById('diaryDate')?.value || '';
    const subject = teachersDiaryState.selectedSubjectDoc;

    if (!department || !className || !diaryDate || !subject) {
        alert('پہلے شیٹ لوڈ کریں۔');
        return;
    }

    const saveBtn = document.getElementById('saveTeachersDiaryBtn');
    const originalText = saveBtn?.innerText || '';
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerText = 'محفوظ ہو رہا ہے...';
    }

    try {
        const globalLessonGoal = document.getElementById('globalLessonGoal')?.value?.trim() || '';
        const globalResources = getSelectedGlobalResources();
        const entries = teachersDiaryState.students.map((student) => collectTeachersDiaryEntry(student));

        const ref = db.collection('teacher_diaries').doc(teachersDiaryState.currentDiaryDocId || buildTeachersDiaryDocId({
            diaryDate,
            department,
            className,
            section,
            subjectId: subject.id
        }));

        const payload = {
            diaryDate,
            department,
            department_ur: subject.department_ur || '',
            classId: teachersDiaryState.selectedClassDoc?.id || subject.classId || '',
            className,
            className_ur: teachersDiaryState.selectedClassDoc?.name_ur || subject.className_ur || '',
            section,
            sectionLabel: section ? `سیکشن ${section}` : 'عمومی',
            subjectId: subject.id,
            subject: subject.name || '',
            subject_ur: subject.name_ur || subject.name || '',
            subjectLabel: typeof getSubjectDisplayName === 'function' ? getSubjectDisplayName(subject) : (subject.name_ur || subject.name || ''),
            lessonGoal: globalLessonGoal,
            resourceUsedGlobal: globalResources,
            entries,
            tenantId: typeof getCurrentTenant === 'function' ? getCurrentTenant() : (localStorage.getItem('tenant_id') || 'default'),
            updatedByUid: teachersDiaryState.currentUser?.uid || '',
            updatedByName: teachersDiaryState.currentUser?.name || teachersDiaryState.currentUser?.displayName || '',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (!teachersDiaryState.currentDiaryDoc) {
            payload.createdByUid = teachersDiaryState.currentUser?.uid || '';
            payload.createdByName = teachersDiaryState.currentUser?.name || teachersDiaryState.currentUser?.displayName || '';
            payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        }

        await ref.set(payload, { merge: true });
        alert('ٹیچرز ڈائری کامیابی سے محفوظ ہو گئی۔');
        teachersDiaryState.currentDiaryDoc = { id: ref.id, ...payload };
        teachersDiaryState.currentEntries = new Map(entries.map((entry) => [String(entry.studentId || ''), entry]));
        updateTeachersDiarySummaries();
    } catch (error) {
        console.error('Failed to save teachers diary', error);
        alert(`محفوظ نہیں ہو سکی: ${error.message}`);
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerText = originalText || 'تمام اندراجات محفوظ کریں';
        }
    }
}

function collectTeachersDiaryEntry(student) {
    const rowId = String(student.id);
    const row = document.querySelector(`#teachersDiaryGridBody tr[data-row-id="${cssEscape(rowId)}"]`);
    const lessonGoal = String(row?.querySelector('.diary-lesson-goal')?.value || '').trim();
    const engagement = row?.querySelector('.diary-segment-btn.is-selected')?.dataset.engagement || 'high';
    const resourceUsed = Array.from(row?.querySelectorAll('.diary-chip[data-chip-type="resource"].is-selected') || [])
        .map((chip) => String(chip.dataset.value || '').trim())
        .filter(Boolean);
    const evidence = Array.from(row?.querySelectorAll('.diary-chip[data-chip-type="evidence"].is-selected') || [])
        .map((chip) => String(chip.dataset.value || '').trim())
        .filter(Boolean);
    const needsHelp = Boolean(row?.querySelector('.diary-help-checkbox')?.checked);
    const helpNotes = String(row?.querySelector('.diary-help-notes')?.value || '').trim();

    return {
        studentId: rowId,
        studentName: getStudentFullName(student),
        rollNumber: student.rollNumber || '',
        lessonGoal,
        resourceUsed,
        engagement,
        evidence,
        needsHelp,
        helpNotes
    };
}

function getStudentFullName(student) {
    return `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.name || student.email || student.id || 'طالب علم';
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function cssEscape(value) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
    return String(value || '').replace(/"/g, '\\"');
}
