const dailyAssemblyState = {
  currentUser: null,
  departments: [],
  teachers: [],
  coordinatorClassDocs: [],
  evaluationClassDocs: [],
  currentCoordinatorDoc: null,
  currentParticipants: [],
  existingEntries: new Map(),
  canAssignCoordinator: false,
  canElevatedEvaluate: false,
  canSaveScores: false,
  criteria: [
    { key: 'preparation', label: 'تیاری', max: 5 },
    { key: 'message', label: 'پیغام', max: 5 },
    { key: 'confidence', label: 'اعتماد', max: 5 },
    { key: 'delivery', label: 'ڈیلیوری', max: 5 },
    { key: 'bodyLanguage', label: 'باڈی لینگویج', max: 5 }
  ]
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('dailyAssemblyContent')) return;

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  dailyAssemblyState.currentUser = currentUser;
  if (typeof initDashboard === 'function') initDashboard(currentUser);

  const roles = getUserRoles(currentUser);
  const allowed = roles.some((role) => !['student', 'parent'].includes(role));
  dailyAssemblyState.canAssignCoordinator = roles.some((role) => ['admin', 'owner', 'principal'].includes(role));
  dailyAssemblyState.canElevatedEvaluate = roles.some((role) => ['admin', 'owner', 'principal', 'nazim_e_taleemaat'].includes(role));

  document.getElementById('dailyAssemblyAccessDenied').style.display = allowed ? 'none' : '';
  document.getElementById('dailyAssemblyContent').style.display = allowed ? '' : 'none';
  if (!allowed) return;

  const dateInput = document.getElementById('dapDate');
  if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];
  updateSelectedDayLabel();
  applyCoordinatorUiMode();
  bindDailyAssemblyEvents();
  await Promise.all([loadDailyAssemblyDepartments(), loadDailyAssemblyTeachers()]);
  await updateCoordinatorClasses();
  await updateEvaluationClasses();
  renderDailyAssemblyPlaceholder('تاریخ، شعبہ، کلاس اور سیکشن منتخب کر کے شیٹ لوڈ کریں۔');
});

function bindDailyAssemblyEvents() {
  document.getElementById('dacDepartment')?.addEventListener('change', async () => {
    await updateCoordinatorClasses();
    await updateCoordinatorSections();
  });
  document.getElementById('dacClass')?.addEventListener('change', updateCoordinatorSections);
  document.getElementById('dapDepartment')?.addEventListener('change', async () => {
    await updateEvaluationClasses();
    await updateEvaluationSections();
  });
  document.getElementById('dapClass')?.addEventListener('change', updateEvaluationSections);
  document.getElementById('dapDate')?.addEventListener('change', updateSelectedDayLabel);
  document.getElementById('dacSaveBtn')?.addEventListener('click', saveClassCoordinator);
  document.getElementById('dapLoadBtn')?.addEventListener('click', loadDailyAssemblySheet);
  document.getElementById('dapSaveBtn')?.addEventListener('click', saveDailyAssemblyScores);
  document.getElementById('dapPrintBtn')?.addEventListener('click', () => window.print());
  document.getElementById('dapTableBody')?.addEventListener('input', (event) => {
    const input = event.target.closest('.dap-score-input');
    if (!input) return;
    const safe = Math.max(0, Math.min(5, Number(input.value || 0)));
    input.value = Number.isFinite(safe) ? String(safe) : '0';
    updateParticipantTotal(input.dataset.rowId);
    updateDailyAssemblyStats();
  });
}

function applyCoordinatorUiMode() {
  const coordinatorCard = document.getElementById('assemblyCoordinatorCard');
  if (coordinatorCard) coordinatorCard.classList.toggle('dap-editor-hidden', !dailyAssemblyState.canAssignCoordinator);
  const note = document.getElementById('dapModeNote');
  if (note) note.innerText = dailyAssemblyState.canElevatedEvaluate ? 'انتظامی پروفائل تمام کلاسیں اور سیکشن دیکھ سکتا ہے' : 'صرف مقررہ کلاس / سیکشن کوآرڈینیٹر محفوظ کر سکتا ہے';
}

function updateSelectedDayLabel() {
  const dateValue = document.getElementById('dapDate')?.value || '';
  const dayLabelInput = document.getElementById('dapDayLabel');
  if (dayLabelInput) dayLabelInput.value = dateValue ? getAssemblyDayInfo(dateValue).dayLabel : '';
}

async function loadDailyAssemblyDepartments() {
  const snapshot = await db.collection('departments').orderBy('name').get();
  dailyAssemblyState.departments = [];
  snapshot.forEach((doc) => dailyAssemblyState.departments.push({ id: doc.id, ...(doc.data() || {}) }));

  ['dacDepartment', 'dapDepartment'].forEach((id) => {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = '<option value="">شعبہ منتخب کریں</option>';
    dailyAssemblyState.departments.forEach((department) => {
      const option = document.createElement('option');
      option.value = department.name || '';
      option.innerText = typeof getDepartmentDisplayName === 'function'
        ? getDepartmentDisplayName(department.name || '', department.name_ur || '')
        : (department.name_ur || department.name || '');
      select.appendChild(option);
    });
  });
}

async function loadDailyAssemblyTeachers() {
  const select = document.getElementById('dacTeacher');
  if (!select) return;
  select.innerHTML = '<option value="">استاد منتخب کریں</option>';
  dailyAssemblyState.teachers = [];
  let snapshot;
  try {
    snapshot = await db.collection('teachers').orderBy('firstName').get();
  } catch (_) {
    snapshot = await db.collection('teachers').get();
  }
  snapshot.forEach((doc) => dailyAssemblyState.teachers.push({ id: doc.id, ...(doc.data() || {}) }));
  dailyAssemblyState.teachers.forEach((teacher) => {
    const option = document.createElement('option');
    option.value = teacher.id;
    option.innerText = getDailyAssemblyTeacherName(teacher);
    select.appendChild(option);
  });
}

async function updateCoordinatorClasses() {
  const department = document.getElementById('dacDepartment')?.value || '';
  const select = document.getElementById('dacClass');
  if (!select) return;
  select.innerHTML = '<option value="">کلاس منتخب کریں</option>';
  document.getElementById('dacSection').innerHTML = '<option value="">عمومی سیکشن</option>';
  dailyAssemblyState.coordinatorClassDocs = [];
  if (!department) return;

  const snapshot = await db.collection('classes').where('department', '==', department).get();
  snapshot.forEach((doc) => dailyAssemblyState.coordinatorClassDocs.push({ id: doc.id, ...(doc.data() || {}) }));
  dailyAssemblyState.coordinatorClassDocs
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
    .forEach((cls) => {
      const option = document.createElement('option');
      option.value = cls.name || '';
      option.innerText = typeof getClassDisplayName === 'function'
        ? getClassDisplayName(cls.name || '', cls.name_ur || '')
        : (cls.name_ur || cls.name || '');
      select.appendChild(option);
    });
}

function updateCoordinatorSections() {
  const className = document.getElementById('dacClass')?.value || '';
  const select = document.getElementById('dacSection');
  if (!select) return;
  select.innerHTML = '<option value="">عمومی سیکشن</option>';
  const classDoc = dailyAssemblyState.coordinatorClassDocs.find((item) => item.name === className) || null;
  normalizeDailyAssemblySections(classDoc?.sections).forEach((section) => {
    const option = document.createElement('option');
    option.value = section;
    option.innerText = `سیکشن ${section}`;
    select.appendChild(option);
  });
}

async function updateEvaluationClasses() {
  const department = document.getElementById('dapDepartment')?.value || '';
  const select = document.getElementById('dapClass');
  if (!select) return;
  select.innerHTML = '<option value="">کلاس منتخب کریں</option>';
  document.getElementById('dapSection').innerHTML = '<option value="">عمومی سیکشن</option>';
  dailyAssemblyState.evaluationClassDocs = [];
  if (!department) return;

  if (dailyAssemblyState.canElevatedEvaluate) {
    const snapshot = await db.collection('classes').where('department', '==', department).get();
    snapshot.forEach((doc) => dailyAssemblyState.evaluationClassDocs.push({ id: doc.id, ...(doc.data() || {}) }));
  } else {
    const currentUid = dailyAssemblyState.currentUser?.uid || '';
    const currentName = String(dailyAssemblyState.currentUser?.name || dailyAssemblyState.currentUser?.displayName || '').trim();
    const coordSnap = await db.collection('assembly_class_coordinators').where('department', '==', department).get();
    const classMap = new Map();
    coordSnap.forEach((doc) => {
      const data = doc.data() || {};
      const match = data.teacherId === currentUid || (currentName && String(data.teacherName || '').trim() === currentName);
      if (!match || !data.className) return;
      const key = data.className;
      const existing = classMap.get(key) || { id: data.classId || key, name: data.className, name_ur: data.className_ur || '', sections: [] };
      existing.sections = Array.from(new Set([...(existing.sections || []), ...(normalizeDailyAssemblySections(data.section || data.sections))]));
      classMap.set(key, existing);
    });
    dailyAssemblyState.evaluationClassDocs = Array.from(classMap.values());
  }

  dailyAssemblyState.evaluationClassDocs
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
    .forEach((cls) => {
      const option = document.createElement('option');
      option.value = cls.name || '';
      option.innerText = typeof getClassDisplayName === 'function'
        ? getClassDisplayName(cls.name || '', cls.name_ur || '')
        : (cls.name_ur || cls.name || '');
      select.appendChild(option);
    });
}

function updateEvaluationSections() {
  const className = document.getElementById('dapClass')?.value || '';
  const select = document.getElementById('dapSection');
  if (!select) return;
  select.innerHTML = '<option value="">عمومی سیکشن</option>';
  const classDoc = dailyAssemblyState.evaluationClassDocs.find((item) => item.name === className) || null;
  normalizeDailyAssemblySections(classDoc?.sections).forEach((section) => {
    const option = document.createElement('option');
    option.value = section;
    option.innerText = `سیکشن ${section}`;
    select.appendChild(option);
  });
}

async function saveClassCoordinator() {
  if (!dailyAssemblyState.canAssignCoordinator) return;
  const department = document.getElementById('dacDepartment')?.value || '';
  const className = document.getElementById('dacClass')?.value || '';
  const section = document.getElementById('dacSection')?.value || '';
  const teacherId = document.getElementById('dacTeacher')?.value || '';
  const teacherName = document.querySelector('#dacTeacher option:checked')?.textContent?.trim() || '';
  if (!department || !className || !teacherId) {
    alert('شعبہ، کلاس اور استاد لازماً منتخب کریں۔');
    return;
  }

  const classDoc = dailyAssemblyState.coordinatorClassDocs.find((item) => item.name === className) || null;
  const payload = {
    department,
    department_ur: getDailyAssemblyDepartmentLabel(department),
    className,
    className_ur: typeof getClassDisplayName === 'function' ? getClassDisplayName(className, classDoc?.name_ur || '') : (classDoc?.name_ur || className),
    classId: classDoc?.id || '',
    section,
    sectionLabel: section ? `سیکشن ${section}` : 'عمومی',
    teacherId,
    teacherName,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedByUid: dailyAssemblyState.currentUser?.uid || '',
    updatedByName: dailyAssemblyState.currentUser?.name || dailyAssemblyState.currentUser?.displayName || ''
  };

  try {
    await db.collection('assembly_class_coordinators').doc(buildCoordinatorDocId(department, className, section)).set(payload, { merge: true });
    document.getElementById('dacState').innerText = 'کلاس کوآرڈینیٹر محفوظ ہو گیا۔';
    await updateEvaluationClasses();
    updateEvaluationSections();
  } catch (error) {
    console.error('Error saving assembly coordinator:', error);
    document.getElementById('dacState').innerText = 'کلاس کوآرڈینیٹر محفوظ نہ ہو سکا۔';
  }
}

async function loadDailyAssemblySheet() {
  const dateValue = document.getElementById('dapDate')?.value || '';
  const department = document.getElementById('dapDepartment')?.value || '';
  const className = document.getElementById('dapClass')?.value || '';
  const section = document.getElementById('dapSection')?.value || '';
  if (!dateValue || !department || !className) {
    alert('تاریخ، شعبہ اور کلاس لازماً منتخب کریں۔');
    return;
  }

  document.getElementById('dapLoadState').innerText = 'شیٹ لوڈ ہو رہی ہے...';
  const { weekStart, dayKey, dayLabel } = getAssemblyDayInfo(dateValue);
  document.getElementById('dapDayLabel').value = dayLabel;

  try {
    const coordinatorSnap = await db.collection('assembly_class_coordinators').doc(buildCoordinatorDocId(department, className, section)).get();
    dailyAssemblyState.currentCoordinatorDoc = coordinatorSnap.exists ? { id: coordinatorSnap.id, ...(coordinatorSnap.data() || {}) } : null;
    dailyAssemblyState.canSaveScores = canCurrentUserEvaluateClass(dailyAssemblyState.currentCoordinatorDoc);
    document.getElementById('dapStatCoordinator').innerText = dailyAssemblyState.currentCoordinatorDoc?.teacherName || 'غیر مقرر';
    document.getElementById('dapStatClass').innerText = [getDailyAssemblyClassLabel(className), section ? `سیکشن ${section}` : 'عمومی'].filter(Boolean).join(' • ');

    const assignmentsSnap = await db.collection('assembly_responsibilities').where('weekStart', '==', weekStart).where('dayKey', '==', dayKey).get();
    const participants = [];
    assignmentsSnap.forEach((doc) => {
      const data = doc.data() || {};
      if (data.department !== department) return;
      if (data.className !== className) return;
      if (normalizeDailyAssemblyToken(data.section || '') !== normalizeDailyAssemblyToken(section || '')) return;
      if (data.assigneeType !== 'student') return;
      if (!data.assigneeName) return;
      participants.push({
        assignmentId: doc.id,
        studentId: data.studentId || data.assigneeId || '',
        participantName: data.assigneeName || '',
        rollNumber: data.rollNumber || '',
        taskLabel: data.taskLabel || data.taskKey || '',
        itemTitle: data.itemTitle || '',
        className: data.className || '',
        className_ur: data.className_ur || '',
        section: data.section || ''
      });
    });

    const performanceDocId = buildDailyPerformanceDocId(dateValue, className, section);
    const performanceSnap = await db.collection('daily_assembly_performance').doc(performanceDocId).get();
    dailyAssemblyState.existingEntries = new Map();
    if (performanceSnap.exists) {
      const existingEntries = performanceSnap.data()?.entries || [];
      existingEntries.forEach((entry) => {
        const key = entry.assignmentId || buildDailyEntryKey(entry.studentId, entry.participantName, entry.taskLabel);
        dailyAssemblyState.existingEntries.set(key, entry);
      });
    }

    dailyAssemblyState.currentParticipants = participants.map((item, index) => {
      const key = item.assignmentId || buildDailyEntryKey(item.studentId, item.participantName, item.taskLabel);
      const existing = dailyAssemblyState.existingEntries.get(key) || {};
      return {
        rowId: `row_${index + 1}`,
        key,
        assignmentId: item.assignmentId,
        studentId: item.studentId,
        participantName: item.participantName,
        rollNumber: item.rollNumber,
        taskLabel: item.taskLabel,
        itemTitle: item.itemTitle,
        scores: {
          preparation: Number(existing.preparation || 0),
          message: Number(existing.message || 0),
          confidence: Number(existing.confidence || 0),
          delivery: Number(existing.delivery || 0),
          bodyLanguage: Number(existing.bodyLanguage || 0)
        }
      };
    });

    renderDailyAssemblyRows();
    updateDailyAssemblyStats();
    document.getElementById('dapSaveBtn').disabled = !dailyAssemblyState.canSaveScores;
    document.getElementById('dapLoadState').innerText = participants.length ? 'مشارکین کی شیٹ لوڈ ہو گئی۔' : 'اس دن کے لیے کوئی مشارک نہیں ملا۔';
  } catch (error) {
    console.error('Error loading daily assembly performance:', error);
    document.getElementById('dapLoadState').innerText = 'شیٹ لوڈ نہ ہو سکی۔';
    renderDailyAssemblyPlaceholder('شیٹ لوڈ کرنے میں مسئلہ پیش آیا۔');
  }
}

function renderDailyAssemblyRows() {
  const tbody = document.getElementById('dapTableBody');
  if (!tbody) return;
  if (!dailyAssemblyState.currentParticipants.length) {
    renderDailyAssemblyPlaceholder('اس تاریخ اور کلاس / سیکشن کے لیے کوئی مشارک نہیں ملا۔');
    return;
  }
  tbody.innerHTML = dailyAssemblyState.currentParticipants.map((row, index) => `
    <tr>
      <td>${index + 1}</td>
      <td class="dap-participant">${escapeDailyAssemblyHtml(row.participantName)}${row.rollNumber ? `<div style="color:var(--text-light); font-size:0.82rem; margin-top:0.2rem;">رول نمبر: ${escapeDailyAssemblyHtml(row.rollNumber)}</div>` : ''}</td>
      <td class="dap-task">${escapeDailyAssemblyHtml(row.taskLabel)}${row.itemTitle ? `<div style="color:var(--text-light); font-size:0.82rem; margin-top:0.25rem;">${escapeDailyAssemblyHtml(row.itemTitle)}</div>` : ''}</td>
      ${dailyAssemblyState.criteria.map((criteria) => `
        <td><input type="number" min="0" max="5" class="dap-input dap-score-input" data-row-id="${row.rowId}" data-criteria="${criteria.key}" value="${row.scores[criteria.key] || 0}" ${dailyAssemblyState.canSaveScores ? '' : 'disabled'}></td>
      `).join('')}
      <td><span class="dap-total-pill" id="total_${row.rowId}">${calculateDailyAssemblyRowTotal(row.scores)}</span></td>
    </tr>
  `).join('');
}

function renderDailyAssemblyPlaceholder(message) {
  const tbody = document.getElementById('dapTableBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--text-light); padding:1.5rem;">${escapeDailyAssemblyHtml(message)}</td></tr>`;
}

function updateParticipantTotal(rowId) {
  const row = dailyAssemblyState.currentParticipants.find((item) => item.rowId === rowId);
  if (!row) return;
  dailyAssemblyState.criteria.forEach((criteria) => {
    const input = document.querySelector(`.dap-score-input[data-row-id="${rowId}"][data-criteria="${criteria.key}"]`);
    row.scores[criteria.key] = Math.max(0, Math.min(5, Number(input?.value || 0)));
  });
  const totalEl = document.getElementById(`total_${rowId}`);
  if (totalEl) totalEl.innerText = String(calculateDailyAssemblyRowTotal(row.scores));
}

function updateDailyAssemblyStats() {
  const count = dailyAssemblyState.currentParticipants.length;
  document.getElementById('dapStatParticipants').innerText = String(count);
  const average = count
    ? Math.round(dailyAssemblyState.currentParticipants.reduce((sum, item) => sum + calculateDailyAssemblyRowTotal(item.scores), 0) / count)
    : 0;
  document.getElementById('dapStatAverage').innerText = `${average} / 25`;
}

async function saveDailyAssemblyScores() {
  if (!dailyAssemblyState.canSaveScores) {
    alert('اس کلاس / سیکشن کے لیے آپ کو نمبر محفوظ کرنے کی اجازت نہیں۔');
    return;
  }
  const dateValue = document.getElementById('dapDate')?.value || '';
  const department = document.getElementById('dapDepartment')?.value || '';
  const className = document.getElementById('dapClass')?.value || '';
  const section = document.getElementById('dapSection')?.value || '';
  if (!dateValue || !department || !className) {
    alert('تاریخ، شعبہ اور کلاس لازماً منتخب کریں۔');
    return;
  }

  dailyAssemblyState.currentParticipants.forEach((row) => updateParticipantTotal(row.rowId));
  const { weekStart, dayKey, dayLabel } = getAssemblyDayInfo(dateValue);
  const docId = buildDailyPerformanceDocId(dateValue, className, section);
  const entries = dailyAssemblyState.currentParticipants.map((row) => ({
    assignmentId: row.assignmentId || '',
    studentId: row.studentId || '',
    participantName: row.participantName,
    rollNumber: row.rollNumber || '',
    taskLabel: row.taskLabel,
    itemTitle: row.itemTitle,
    preparation: Number(row.scores.preparation || 0),
    message: Number(row.scores.message || 0),
    confidence: Number(row.scores.confidence || 0),
    delivery: Number(row.scores.delivery || 0),
    bodyLanguage: Number(row.scores.bodyLanguage || 0),
    total: calculateDailyAssemblyRowTotal(row.scores)
  }));
  const payload = {
    date: dateValue,
    weekStart,
    dayKey,
    dayLabel,
    department,
    department_ur: getDailyAssemblyDepartmentLabel(department),
    className,
    className_ur: getDailyAssemblyClassLabel(className),
    section,
    sectionLabel: section ? `سیکشن ${section}` : 'عمومی',
    coordinatorTeacherId: dailyAssemblyState.currentCoordinatorDoc?.teacherId || '',
    coordinatorTeacherName: dailyAssemblyState.currentCoordinatorDoc?.teacherName || '',
    entries,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedByUid: dailyAssemblyState.currentUser?.uid || '',
    updatedByName: dailyAssemblyState.currentUser?.name || dailyAssemblyState.currentUser?.displayName || '',
    tenantId: dailyAssemblyState.currentUser?.tenantId || localStorage.getItem('tenantId') || ''
  };

  try {
    await db.collection('daily_assembly_performance').doc(docId).set(payload, { merge: true });
    document.getElementById('dapLoadState').innerText = 'روزانہ اسمبلی کارکردگی محفوظ ہو گئی۔';
  } catch (error) {
    console.error('Error saving daily assembly performance:', error);
    document.getElementById('dapLoadState').innerText = 'نمبرات محفوظ نہ ہو سکے۔';
    alert('نمبرات محفوظ کرنے میں مسئلہ پیش آیا۔');
  }
}

function canCurrentUserEvaluateClass(coordinatorDoc) {
  if (dailyAssemblyState.canElevatedEvaluate) return true;
  const uid = dailyAssemblyState.currentUser?.uid || '';
  const name = String(dailyAssemblyState.currentUser?.name || dailyAssemblyState.currentUser?.displayName || '').trim();
  return !!coordinatorDoc && (coordinatorDoc.teacherId === uid || (name && String(coordinatorDoc.teacherName || '').trim() === name));
}

function getAssemblyDayInfo(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);
  const jsDay = date.getDay();
  const offsetToSaturday = jsDay === 6 ? 0 : ((jsDay + 1) % 7);
  const saturday = new Date(date);
  saturday.setDate(date.getDate() - offsetToSaturday);
  const weekStart = saturday.toISOString().split('T')[0];
  const map = {
    0: { key: 'sun', label: 'اتوار' },
    1: { key: 'mon', label: 'پیر' },
    2: { key: 'tue', label: 'منگل' },
    3: { key: 'wed', label: 'بدھ' },
    4: { key: 'thu', label: 'جمعرات' },
    5: { key: 'fri', label: 'جمعہ' },
    6: { key: 'sat', label: 'ہفتہ' }
  };
  const info = map[jsDay] || { key: '', label: '' };
  return { weekStart, dayKey: info.key, dayLabel: info.label };
}

function buildCoordinatorDocId(department, className, section) {
  return ['assembly_coordinator', normalizeDailyAssemblyToken(department), normalizeDailyAssemblyToken(className), normalizeDailyAssemblyToken(section || 'general')].join('__');
}

function buildDailyPerformanceDocId(dateValue, className, section) {
  return ['daily_assembly', dateValue, normalizeDailyAssemblyToken(className), normalizeDailyAssemblyToken(section || 'general')].join('__');
}

function buildDailyEntryKey(studentId, participantName, taskLabel) {
  return [normalizeDailyAssemblyToken(studentId || participantName), normalizeDailyAssemblyToken(taskLabel)].join('__');
}

function calculateDailyAssemblyRowTotal(scores) {
  return dailyAssemblyState.criteria.reduce((sum, criteria) => sum + Number(scores?.[criteria.key] || 0), 0);
}

function getDailyAssemblyTeacherName(teacher) {
  return String(teacher?.name || `${teacher?.firstName || ''} ${teacher?.lastName || ''}` || teacher?.fullName || '').trim();
}

function getDailyAssemblyDepartmentLabel(value) {
  const dept = dailyAssemblyState.departments.find((item) => item.name === value) || {};
  return typeof getDepartmentDisplayName === 'function' ? getDepartmentDisplayName(value || '', dept.name_ur || '') : (dept.name_ur || value || '');
}

function getDailyAssemblyClassLabel(value) {
  const cls = [...dailyAssemblyState.coordinatorClassDocs, ...dailyAssemblyState.evaluationClassDocs].find((item) => item.name === value) || {};
  return typeof getClassDisplayName === 'function' ? getClassDisplayName(value || '', cls.name_ur || '') : (cls.name_ur || value || '');
}

function normalizeDailyAssemblySections(value) {
  if (!value) return [];
  const raw = Array.isArray(value) ? value : [value];
  return Array.from(new Set(
    raw
      .flatMap((item) => String(item || '').split(/[,&/]| and /i))
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  ));
}

function normalizeDailyAssemblyToken(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/gi, '_').replace(/^_+|_+$/g, '');
}

function escapeDailyAssemblyHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
