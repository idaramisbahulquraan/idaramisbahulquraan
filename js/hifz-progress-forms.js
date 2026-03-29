const hifzFormsState = {
  currentUser: null,
  roles: [],
  canEdit: false,
  departments: [],
  classes: [],
  students: [],
  selectedClassDoc: null,
  activeForm: 'quran_hifz',
  loadedDocs: {},
  forms: {
    quran_hifz: {
      key: 'quran_hifz',
      label: 'حفظ القرآن شیڈول',
      title: 'تدریسی اہداف شیڈول حفظ القرآن',
      subtitle: 'ہر طالب علم کے روزانہ سبق اور تکمیل کی تاریخ درج کریں۔',
      metaFields: [
        { key: 'yearStartStatus', label: 'آغاز سال کیفیت', type: 'text', placeholder: 'مثلاً پکا / کچا / نظرِ خارج' },
        { key: 'currentSabaqNo', label: 'موجودہ سبق یاد نمبر', type: 'text', placeholder: 'سبق نمبر' },
        { key: 'currentRukuNo', label: 'رکوع نمبر', type: 'text', placeholder: 'رکوع نمبر' },
        { key: 'surahName', label: 'سورۃ', type: 'text', placeholder: 'سورۃ کا نام' },
        { key: 'ayatNo', label: 'آیت نمبر', type: 'text', placeholder: 'آیت نمبر' }
      ],
      columns: [
        { key: 'para', label: 'پارہ', type: 'text' },
        { key: 'dailyLesson', label: 'روزانہ سبق', type: 'text' },
        { key: 'startDate', label: 'تاریخ آغاز', type: 'date' },
        { key: 'completionDate', label: 'تاریخ تکمیل', type: 'date' },
        { key: 'teachingDays', label: 'تدریسی ایام', type: 'number', min: '0' }
      ]
    },
    madani_qaida: {
      key: 'madani_qaida',
      label: 'مدنی قاعدہ شیڈول',
      title: 'تدریسی اہداف شیڈول مدنی قاعدہ',
      subtitle: 'سبق / پیج نمبر اور تدریسی ایام درج کریں۔',
      metaFields: [],
      columns: [
        { key: 'lessonNo', label: 'سبق / پیج نمبر', type: 'text' },
        { key: 'teachingTarget', label: 'تدریسی ہدف', type: 'text' },
        { key: 'startDate', label: 'تاریخ آغاز', type: 'date' },
        { key: 'completionDate', label: 'تاریخ تکمیل', type: 'date' },
        { key: 'teachingDays', label: 'تدریسی ایام', type: 'number', min: '0' }
      ]
    },
    para_progress: {
      key: 'para_progress',
      label: 'پارہ وار کارکردگی',
      title: 'پارہ وار تدریس و کارکردگی',
      subtitle: 'پارہ وار تکمیل، حاضری اور کیفیت درج کریں۔',
      metaFields: [],
      columns: [
        { key: 'para', label: 'پارہ', type: 'text' },
        { key: 'startDate', label: 'تاریخ ابتدا', type: 'date' },
        { key: 'completionDate', label: 'تاریخ تکمیل', type: 'date' },
        { key: 'totalTeachingDays', label: 'کل تدریسی ایام', type: 'number', min: '0' },
        { key: 'presentDays', label: 'کل حاضر ایام', type: 'number', min: '0' },
        { key: 'absentDays', label: 'غیر حاضر ایام', type: 'number', min: '0' },
        { key: 'quality', label: 'کیفیت', type: 'select', options: ['بہت عمدہ', 'اچھی', 'اوسط', 'مزید توجہ'] },
        { key: 'remarks', label: 'دیگر / ریمارکس', type: 'textarea' }
      ]
    }
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('hifzFormsAccessDenied')) return;

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  hifzFormsState.currentUser = currentUser;
  hifzFormsState.roles = getUserRoles(currentUser);
  hifzFormsState.canEdit = hifzFormsState.roles.includes('hifz_supervisor');
  if (typeof initDashboard === 'function') initDashboard(currentUser);

  const allowed = hifzFormsState.roles.some(role => ['hifz_supervisor', 'admin', 'owner', 'principal'].includes(role));
  document.getElementById('hifzFormsAccessDenied').style.display = allowed ? 'none' : '';
  document.getElementById('hifzFormsContent').style.display = allowed ? '' : 'none';
  if (!allowed) return;

  initializeHifzDefaults();
  updateHifzModeUi();
  renderHifzTabs();
  bindHifzEvents();
  await loadHifzDepartments();
  renderActiveHifzForm();
});

function initializeHifzDefaults() {
  const monthInput = document.getElementById('hifzRecordMonth');
  const yearInput = document.getElementById('hifzAcademicYear');
  const today = new Date();
  if (monthInput && !monthInput.value) monthInput.value = today.toISOString().slice(0, 7);
  if (yearInput && !yearInput.value) {
    const year = today.getFullYear();
    yearInput.value = `${year}-${year + 1}`;
  }
}

function updateHifzModeUi() {
  const modeText = hifzFormsState.canEdit ? 'حفظ سپروائزر اندراج' : 'صرف مشاہدہ';
  const note = document.getElementById('hifzFormsModeNote');
  const chip = document.getElementById('hifzModeChip');
  if (note) note.innerText = modeText;
  if (chip) chip.innerText = modeText;
  const saveBtn = document.getElementById('hifzSaveBtn');
  if (saveBtn) saveBtn.style.display = hifzFormsState.canEdit ? '' : 'none';
}

function bindHifzEvents() {
  document.getElementById('hifzDepartment')?.addEventListener('change', async () => {
    await updateHifzClasses();
    clearHifzLoadedState();
  });
  document.getElementById('hifzClass')?.addEventListener('change', clearHifzLoadedState);
  document.getElementById('hifzLoadBtn')?.addEventListener('click', loadHifzStudentsAndForms);
  document.getElementById('hifzSaveBtn')?.addEventListener('click', saveActiveHifzForm);
  document.getElementById('hifzPrintBtn')?.addEventListener('click', () => window.print());
}

function clearHifzLoadedState() {
  hifzFormsState.students = [];
  hifzFormsState.loadedDocs = {};
  renderActiveHifzForm();
  updateHifzState('کلاس تبدیل ہو گئی ہے۔ دوبارہ لوڈ کریں۔');
}

async function loadHifzDepartments() {
  const select = document.getElementById('hifzDepartment');
  if (!select) return;
  select.innerHTML = '<option value="">شعبہ منتخب کریں</option>';

  try {
    const snapshot = await db.collection('departments').orderBy('name').get();
    hifzFormsState.departments = [];
    snapshot.forEach((doc) => hifzFormsState.departments.push({ id: doc.id, ...(doc.data() || {}) }));
  } catch (error) {
    console.error('Hifz departments load failed:', error);
    updateHifzState('شعبے لوڈ نہ ہو سکے۔');
    return;
  }

  hifzFormsState.departments.forEach((department) => {
    const option = document.createElement('option');
    option.value = department.name || '';
    option.innerText = typeof getDepartmentDisplayName === 'function'
      ? getDepartmentDisplayName(department.name || '', department.name_ur || '')
      : (department.name_ur || department.name || '');
    select.appendChild(option);
  });

  const preferred = hifzFormsState.departments.find((item) => (item.name || '') === 'Hifz Department');
  if (preferred) select.value = preferred.name;
  await updateHifzClasses();
}

async function updateHifzClasses() {
  const department = document.getElementById('hifzDepartment')?.value || '';
  const select = document.getElementById('hifzClass');
  if (!select) return;
  select.innerHTML = '<option value="">حفظ کلاس منتخب کریں</option>';
  hifzFormsState.classes = [];
  hifzFormsState.selectedClassDoc = null;
  if (!department) return;

  try {
    const snapshot = await db.collection('classes').where('department', '==', department).get();
    snapshot.forEach((doc) => hifzFormsState.classes.push({ id: doc.id, ...(doc.data() || {}) }));
  } catch (error) {
    console.error('Hifz classes load failed:', error);
    updateHifzState('کلاسیں لوڈ نہ ہو سکیں۔');
    return;
  }

  hifzFormsState.classes
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'en'))
    .forEach((cls) => {
      const option = document.createElement('option');
      option.value = cls.name || '';
      option.innerText = typeof getClassDisplayName === 'function'
        ? getClassDisplayName(cls.name || '', cls.name_ur || '')
        : (cls.name_ur || cls.name || '');
      select.appendChild(option);
    });
}

function renderHifzTabs() {
  const host = document.getElementById('hifzFormTabs');
  if (!host) return;
  host.innerHTML = Object.values(hifzFormsState.forms).map((form) => `
    <button type="button" class="hifz-tab ${form.key === hifzFormsState.activeForm ? 'active' : ''}" data-hifz-tab="${form.key}">${form.label}</button>
  `).join('');
  host.querySelectorAll('[data-hifz-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      hifzFormsState.activeForm = btn.dataset.hifzTab;
      renderHifzTabs();
      renderActiveHifzForm();
    });
  });
}

async function loadHifzStudentsAndForms() {
  const department = document.getElementById('hifzDepartment')?.value || '';
  const className = document.getElementById('hifzClass')?.value || '';
  if (!department || !className) {
    alert('شعبہ اور کلاس منتخب کریں۔');
    return;
  }

  hifzFormsState.selectedClassDoc = hifzFormsState.classes.find((item) => item.name === className) || null;
  updateHifzState('طلبہ اور محفوظ شدہ ریکارڈ لوڈ ہو رہے ہیں...');

  try {
    const [students, docs] = await Promise.all([
      fetchHifzStudents(department, className, hifzFormsState.selectedClassDoc),
      fetchHifzFormDocuments(department, className)
    ]);
    hifzFormsState.students = students;
    hifzFormsState.loadedDocs = docs;
    renderActiveHifzForm();
    updateHifzState(`${students.length} طلبہ لوڈ ہو گئے۔`);
    document.getElementById('hifzStickyState').innerText = hifzFormsState.canEdit ? 'موجودہ فارم میں اندراج مکمل کر کے محفوظ کریں۔' : 'یہ ریکارڈ صرف مشاہدے کے لیے کھولا گیا ہے۔';
  } catch (error) {
    console.error('Hifz forms load failed:', error);
    updateHifzState('طلبہ یا محفوظ شدہ فارم لوڈ نہ ہو سکے۔');
  }
}

async function fetchHifzStudents(department, className, classDoc) {
  const deptUr = typeof getDepartmentDisplayName === 'function' ? getDepartmentDisplayName(department, '') : '';
  const classUr = typeof getClassDisplayName === 'function' ? getClassDisplayName(className, classDoc?.name_ur || '') : (classDoc?.name_ur || '');

  const tasks = [
    db.collection('students').where('department', '==', department).where('className', '==', className).get(),
    db.collection('students').where('department_ur', '==', deptUr).where('className_ur', '==', classUr).get()
  ];
  if (classDoc?.id) tasks.push(db.collection('students').where('classId', '==', classDoc.id).get());

  const settled = await Promise.allSettled(tasks);
  const map = new Map();
  settled.forEach((result) => {
    if (result.status !== 'fulfilled') return;
    result.value.forEach((doc) => {
      if (!map.has(doc.id)) map.set(doc.id, { id: doc.id, ...(doc.data() || {}) });
    });
  });

  return Array.from(map.values()).sort((a, b) => compareHifzStudents(a, b));
}

async function fetchHifzFormDocuments(department, className) {
  const recordMonth = document.getElementById('hifzRecordMonth')?.value || '';
  const academicYear = document.getElementById('hifzAcademicYear')?.value.trim() || '';
  const docs = {};
  const tasks = Object.keys(hifzFormsState.forms).map(async (formKey) => {
    const docId = buildHifzFormDocId(formKey, department, className, recordMonth, academicYear);
    const snap = await db.collection('hifz_supervisor_forms').doc(docId).get();
    docs[formKey] = snap.exists ? { id: snap.id, ...(snap.data() || {}) } : null;
  });
  await Promise.all(tasks);
  return docs;
}

function renderActiveHifzForm() {
  const form = hifzFormsState.forms[hifzFormsState.activeForm];
  if (!form) return;

  document.getElementById('hifzTableTitle').innerText = form.title;
  document.getElementById('hifzTableSubtitle').innerText = form.subtitle;
  document.getElementById('hifzStudentCountNote').innerText = `${hifzFormsState.students.length} طلبہ`;
  renderHifzMetaFields(form);
  renderHifzTable(form);
}

function renderHifzMetaFields(form) {
  const card = document.getElementById('hifzMetaCard');
  const host = document.getElementById('hifzMetaFields');
  const title = document.getElementById('hifzMetaTitle');
  if (!card || !host || !title) return;

  const savedMeta = hifzFormsState.loadedDocs[hifzFormsState.activeForm]?.meta || {};
  if (!form.metaFields.length) {
    card.style.display = 'none';
    host.innerHTML = '';
    return;
  }

  card.style.display = '';
  title.innerText = `${form.title} — اضافی معلومات`;
  host.innerHTML = form.metaFields.map((field) => {
    const value = savedMeta[field.key] || '';
    return `
      <div class="form-group">
        <label>${field.label}</label>
        <input type="${field.type}" id="hifzMeta_${field.key}" class="hifz-input" value="${escapeHifzHtml(value)}" placeholder="${escapeHifzHtml(field.placeholder || '')}" ${hifzFormsState.canEdit ? '' : 'disabled'}>
      </div>
    `;
  }).join('');
}

function renderHifzTable(form) {
  const head = document.getElementById('hifzTableHead');
  const body = document.getElementById('hifzTableBody');
  if (!head || !body) return;

  head.innerHTML = `<tr><th class="hifz-serial">نمبر</th><th class="hifz-student-name">طالب علم</th>${form.columns.map((column) => `<th>${column.label}</th>`).join('')}</tr>`;

  if (!hifzFormsState.students.length) {
    body.innerHTML = `<tr><td colspan="${form.columns.length + 2}"><div class="hifz-status">منتخب کلاس کے طلبہ ابھی لوڈ نہیں ہوئے۔</div></td></tr>`;
    return;
  }

  const rowsByStudent = new Map();
  const savedRows = hifzFormsState.loadedDocs[hifzFormsState.activeForm]?.rows || [];
  savedRows.forEach((row) => rowsByStudent.set(row.studentId || row.rollNumber || row.studentName, row));

  body.innerHTML = hifzFormsState.students.map((student, index) => {
    const key = student.id || student.rollNumber || getHifzStudentLabel(student);
    const saved = rowsByStudent.get(key) || rowsByStudent.get(student.rollNumber) || rowsByStudent.get(getHifzStudentLabel(student)) || {};
    return `
      <tr data-student-id="${escapeHifzHtml(student.id || '')}">
        <td class="hifz-serial">${index + 1}</td>
        <td class="hifz-student-name">${escapeHifzHtml(getHifzStudentLabel(student))}${student.rollNumber ? `<div style="font-size:0.82rem; color:#64748b; margin-top:0.25rem;">رول نمبر: ${escapeHifzHtml(student.rollNumber)}</div>` : ''}</td>
        ${form.columns.map((column) => renderHifzCell(column, saved[column.key] || '', hifzFormsState.canEdit)).join('')}
      </tr>
    `;
  }).join('');
}

function renderHifzCell(column, value, editable) {
  const disabled = editable ? '' : 'disabled';
  if (column.type === 'textarea') {
    return `<td><textarea class="hifz-textarea" data-field="${column.key}" ${disabled}>${escapeHifzHtml(value)}</textarea></td>`;
  }
  if (column.type === 'select') {
    return `<td><select class="hifz-select" data-field="${column.key}" ${disabled}><option value="">منتخب کریں</option>${(column.options || []).map((option) => `<option value="${escapeHifzHtml(option)}" ${option === value ? 'selected' : ''}>${escapeHifzHtml(option)}</option>`).join('')}</select></td>`;
  }
  return `<td><input class="hifz-input" data-field="${column.key}" type="${column.type || 'text'}" value="${escapeHifzHtml(value)}" ${column.min ? `min="${column.min}"` : ''} ${disabled}></td>`;
}

async function saveActiveHifzForm() {
  if (!hifzFormsState.canEdit) return;
  const department = document.getElementById('hifzDepartment')?.value || '';
  const className = document.getElementById('hifzClass')?.value || '';
  const recordMonth = document.getElementById('hifzRecordMonth')?.value || '';
  const academicYear = document.getElementById('hifzAcademicYear')?.value.trim() || '';
  const form = hifzFormsState.forms[hifzFormsState.activeForm];
  if (!department || !className || !recordMonth || !academicYear) {
    alert('شعبہ، کلاس، ریکارڈ ماہ اور تعلیمی سال مکمل کریں۔');
    return;
  }
  if (!hifzFormsState.students.length) {
    alert('پہلے طلبہ لوڈ کریں۔');
    return;
  }

  const rows = Array.from(document.querySelectorAll('#hifzTableBody tr[data-student-id]')).map((row, index) => {
    const student = hifzFormsState.students[index] || {};
    const payload = {
      studentId: student.id || '',
      studentName: getHifzStudentLabel(student),
      rollNumber: student.rollNumber || ''
    };
    form.columns.forEach((column) => {
      const field = row.querySelector(`[data-field="${column.key}"]`);
      payload[column.key] = field ? String(field.value || '').trim() : '';
    });
    return payload;
  });

  const meta = {};
  form.metaFields.forEach((field) => {
    const input = document.getElementById(`hifzMeta_${field.key}`);
    meta[field.key] = input ? String(input.value || '').trim() : '';
  });

  const classDoc = hifzFormsState.selectedClassDoc || hifzFormsState.classes.find((item) => item.name === className) || null;
  const docId = buildHifzFormDocId(form.key, department, className, recordMonth, academicYear);
  const payload = {
    formType: form.key,
    formLabel: form.label,
    department,
    department_ur: typeof getDepartmentDisplayName === 'function' ? getDepartmentDisplayName(department, '') : '',
    className,
    className_ur: classDoc?.name_ur || (typeof getClassDisplayName === 'function' ? getClassDisplayName(className, '') : ''),
    recordMonth,
    academicYear,
    meta,
    rows,
    studentCount: rows.length,
    updatedBy: auth?.currentUser?.uid || hifzFormsState.currentUser?.uid || '',
    updatedByName: hifzFormsState.currentUser?.name || hifzFormsState.currentUser?.email || '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    updateHifzState('فارم محفوظ ہو رہا ہے...');
    const ref = db.collection('hifz_supervisor_forms').doc(docId);
    const existing = await ref.get();
    if (!existing.exists) payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    await ref.set(payload, { merge: true });
    hifzFormsState.loadedDocs[form.key] = { id: docId, ...payload };
    updateHifzState('موجودہ فارم کامیابی سے محفوظ ہو گیا۔');
    document.getElementById('hifzStickyState').innerText = 'موجودہ فارم محفوظ ہو گیا۔';
  } catch (error) {
    console.error('Hifz form save failed:', error);
    updateHifzState('فارم محفوظ نہ ہو سکا۔');
    alert('فارم محفوظ کرنے میں مسئلہ پیش آیا۔');
  }
}

function buildHifzFormDocId(formKey, department, className, recordMonth, academicYear) {
  return [formKey, department, className, recordMonth, academicYear].map(normalizeHifzToken).join('__');
}

function compareHifzStudents(a, b) {
  const rollA = Number(a.rollNumber || 0);
  const rollB = Number(b.rollNumber || 0);
  if (!Number.isNaN(rollA) && !Number.isNaN(rollB) && rollA && rollB && rollA !== rollB) return rollA - rollB;
  return getHifzStudentLabel(a).localeCompare(getHifzStudentLabel(b), 'en');
}

function getHifzStudentLabel(student) {
  return `${student?.firstName || ''} ${student?.lastName || ''}`.trim() || student?.name || 'طالب علم';
}

function updateHifzState(text) {
  const state = document.getElementById('hifzFormsState');
  if (state) state.innerText = text || '';
}

function normalizeHifzToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function escapeHifzHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
