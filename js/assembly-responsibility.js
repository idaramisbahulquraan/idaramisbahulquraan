const assemblyState = {
  currentUser: null,
  departments: [],
  classes: [],
  filterClasses: [],
  teachers: [],
  editorStudents: [],
  assignments: [],
  canEdit: false,
  tasks: [
    { key: 'tilawat', label: 'تلاوت' },
    { key: 'tarjama', label: 'ترجمہ و تشریح' },
    { key: 'hamd_naat', label: 'حمد / نعت' },
    { key: 'hadith', label: 'آج کی حدیث' },
    { key: 'akhlaqi_baat', label: 'اخلاقی بات / آج کا عمل' },
    { key: 'news_announcements', label: 'خبریں / اعلانات' },
    { key: 'dua', label: 'دعا / اختتام' }
  ],
  assigneeTypes: [
    { key: 'student', label: 'طالب علم' },
    { key: 'teacher', label: 'استاد' },
    { key: 'class', label: 'کلاس' },
    { key: 'other', label: 'دیگر' }
  ]
};

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_LABELS = {
  'sat': 'ہفتہ',
  'sun': 'اتوار',
  'mon': 'پیر',
  'tue': 'منگل',
  'wed': 'بدھ',
  'thu': 'جمعرات',
  'fri': 'جمعہ'
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('assemblyBoardBody')) return;

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  assemblyState.currentUser = currentUser;
  if (typeof initDashboard === 'function') initDashboard(currentUser);

  const roles = getUserRoles(currentUser);
  assemblyState.canEdit = roles.some((role) => ['teacher', 'admin', 'owner', 'principal', 'nazim_e_taleemaat'].includes(role));

  // Set default values to today's date
  const today = new Date().toLocaleDateString('sv-SE');
  const dateInput = document.getElementById('assemblyDate');
  const assignDateInput = document.getElementById('assemblyAssignDate');
  if (dateInput && !dateInput.value) dateInput.value = today;
  if (assignDateInput && !assignDateInput.value) assignDateInput.value = today;

  updateAssemblyModeUi();
  renderAssemblyStaticControls();
  bindAssemblyEvents();

  await loadAssemblyDepartments();
  if (assemblyState.canEdit) {
    await loadAssemblyTeachers();
    await updateAssemblyFormClasses();
    await updateAssemblyFormSections();
    await updateAssemblyAssigneeOptions();
  }
  await updateAssemblyFilterClasses();
  await updateAssemblyFilterSections();
  await loadAssemblyAssignments();
});

function updateAssemblyModeUi() {
  const editorCard = document.getElementById('assemblyEditorCard');
  const modeNote = document.getElementById('assemblyModeNote');
  const statMode = document.getElementById('assemblyStatMode');
  if (editorCard) editorCard.classList.toggle('editor-hidden', !assemblyState.canEdit);
  if (modeNote) modeNote.innerText = assemblyState.canEdit ? 'استاد / ایڈمن اسائن کر سکتے ہیں' : 'صرف مشاہدہ';
  if (statMode) statMode.innerText = assemblyState.canEdit ? 'اسائنمنٹ فعال' : 'صرف مشاہدہ';
}

function renderAssemblyStaticControls() {
  const taskSelect = document.getElementById('assemblyTask');
  const typeSelect = document.getElementById('assemblyAssigneeType');
  const boardHead = document.getElementById('assemblyBoardHead');

  if (taskSelect) {
    taskSelect.innerHTML = assemblyState.tasks.map((task) => `<option value="${task.key}">${task.label}</option>`).join('');
  }
  if (typeSelect) {
    typeSelect.innerHTML = assemblyState.assigneeTypes.map((type) => `<option value="${type.key}">${type.label}</option>`).join('');
  }
  const editorSection = document.getElementById('assemblySection');
  const filterSection = document.getElementById('assemblyFilterSection');
  if (editorSection) editorSection.innerHTML = '<option value="">عمومی سیکشن</option>';
  if (filterSection) filterSection.innerHTML = '<option value="">تمام سیکشنز</option>';
  const assigneeSelect = document.getElementById('assemblyAssigneeSelect');
  if (assigneeSelect) assigneeSelect.innerHTML = '<option value="">مسئول منتخب کریں</option>';
  
  if (boardHead) {
    boardHead.innerHTML = `
      <th style="width: 20%;">ٹاسک / ذمہ داری</th>
      <th style="width: 25%;">نام مسئول (Assignee)</th>
      <th style="width: 20%;">کلاس / شعبہ</th>
      <th style="width: 20%;">عنوان اور نوٹ (Topic & Notes)</th>
      <th style="width: 15%;">اقدامات (Actions)</th>
    `;
  }
}

function bindAssemblyEvents() {
  document.getElementById('assemblyDepartment')?.addEventListener('change', async () => {
    await updateAssemblyFormClasses();
    await updateAssemblyFormSections();
    await updateAssemblyAssigneeOptions();
  });
  document.getElementById('assemblyClass')?.addEventListener('change', async () => {
    await updateAssemblyFormSections();
    await updateAssemblyAssigneeOptions();
  });
  document.getElementById('assemblySection')?.addEventListener('change', updateAssemblyAssigneeOptions);
  document.getElementById('assemblyAssigneeType')?.addEventListener('change', updateAssemblyAssigneeOptions);
  document.getElementById('assemblyFilterDepartment')?.addEventListener('change', async () => {
    await updateAssemblyFilterClasses();
    await updateAssemblyFilterSections();
    await loadAssemblyAssignments();
  });
  document.getElementById('assemblyFilterClass')?.addEventListener('change', async () => {
    await updateAssemblyFilterSections();
    await loadAssemblyAssignments();
  });
  document.getElementById('assemblyFilterSection')?.addEventListener('change', loadAssemblyAssignments);
  
  // Date selection listeners
  document.getElementById('assemblyDate')?.addEventListener('change', (e) => {
    // Sync assign date selector for user convenience
    const assignDateInput = document.getElementById('assemblyAssignDate');
    if (assignDateInput) assignDateInput.value = e.target.value;
    loadAssemblyAssignments();
  });
  document.getElementById('assemblyRefreshBtn')?.addEventListener('click', loadAssemblyAssignments);
  document.getElementById('assemblySaveBtn')?.addEventListener('click', saveAssemblyAssignment);
  document.getElementById('assemblyResetBtn')?.addEventListener('click', resetAssemblyForm);
  
  document.getElementById('assemblyBoardBody')?.addEventListener('click', async (event) => {
    const editBtn = event.target.closest('[data-edit-assignment]');
    const deleteBtn = event.target.closest('[data-delete-assignment]');
    if (editBtn) {
      await loadAssignmentIntoForm(editBtn.dataset.editAssignment);
      return;
    }
    if (deleteBtn) {
      await deleteAssemblyAssignment(deleteBtn.dataset.deleteAssignment);
    }
  });
}

async function loadAssemblyDepartments() {
  const formSelect = document.getElementById('assemblyDepartment');
  const filterSelect = document.getElementById('assemblyFilterDepartment');

  [formSelect, filterSelect].forEach((select, idx) => {
    if (!select) return;
    select.innerHTML = `<option value="">${idx === 0 ? 'شعبہ منتخب کریں' : 'تمام شعبے'}</option>`;
  });

  const tenantId = (typeof getCurrentTenant === 'function') ? getCurrentTenant() : (localStorage.getItem('tenant_id') || 'default');
  let docs = [];
  try {
    const snap = await db.collection('departments').where('tenantId', '==', tenantId).get();
    snap.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.warn('Assembly departments by tenantId not available', error?.message || error);
  }

  if (docs.length === 0) {
    try {
      const snap = await db.collection('departments').get();
      snap.forEach(doc => {
        const data = doc.data() || {};
        if (!data.tenantId || data.tenantId === tenantId || data.tenantId === 'default') {
          docs.push({ id: doc.id, ...data });
        }
      });
    } catch (e2) {
      console.error('Fallback departments failed:', e2);
    }
  }

  docs.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  assemblyState.departments = docs;

  [formSelect, filterSelect].forEach((select) => {
    if (!select) return;
    assemblyState.departments.forEach((department) => {
      const option = document.createElement('option');
      option.value = department.name || '';
      option.innerText = typeof getDepartmentDisplayName === 'function'
        ? getDepartmentDisplayName(department.name || '', department.name_ur || '')
        : (department.name_ur || department.name || '');
      select.appendChild(option);
    });
  });
}

async function loadAssemblyTeachers() {
  try {
    const snapshot = await db.collection('teachers').get();
    assemblyState.teachers = [];
    snapshot.forEach((doc) => assemblyState.teachers.push({ id: doc.id, ...(doc.data() || {}) }));
  } catch (error) {
    console.warn('Assembly teachers could not be loaded', error?.message || error);
    assemblyState.teachers = [];
  }
}

async function updateAssemblyFormClasses() {
  const department = document.getElementById('assemblyDepartment')?.value || '';
  const select = document.getElementById('assemblyClass');
  if (!select) return;
  select.innerHTML = '<option value="">کلاس منتخب کریں</option>';
  assemblyState.classes = [];
  if (!department) return;

  try {
    const snapshot = await db.collection('classes').where('department', '==', department).get();
    snapshot.forEach((doc) => assemblyState.classes.push({ id: doc.id, ...(doc.data() || {}) }));
  } catch (error) {
    console.warn('Assembly classes could not be loaded', error?.message || error);
    return;
  }

  assemblyState.classes
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

async function updateAssemblyFormSections() {
  const className = document.getElementById('assemblyClass')?.value || '';
  const select = document.getElementById('assemblySection');
  if (!select) return;
  select.innerHTML = '<option value="">عمومی سیکشن</option>';

  const classDoc = assemblyState.classes.find((item) => item.name === className) || null;
  normalizeAssemblySections(classDoc?.sections).forEach((section) => {
    const option = document.createElement('option');
    option.value = section;
    option.innerText = `سیکشن ${section}`;
    select.appendChild(option);
  });
}

async function updateAssemblyFilterClasses() {
  const department = document.getElementById('assemblyFilterDepartment')?.value || '';
  const select = document.getElementById('assemblyFilterClass');
  if (!select) return;
  select.innerHTML = '<option value="">تمام کلاسیں</option>';
  assemblyState.filterClasses = [];
  if (!department) return;

  try {
    const snapshot = await db.collection('classes').where('department', '==', department).get();
    snapshot.forEach((doc) => assemblyState.filterClasses.push({ id: doc.id, ...(doc.data() || {}) }));
  } catch (error) {
    console.warn('Assembly filter classes unavailable', error?.message || error);
    return;
  }

  assemblyState.filterClasses
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

async function updateAssemblyFilterSections() {
  const className = document.getElementById('assemblyFilterClass')?.value || '';
  const select = document.getElementById('assemblyFilterSection');
  if (!select) return;
  select.innerHTML = '<option value="">تمام سیکشنز</option>';

  const classDoc = [...assemblyState.filterClasses, ...assemblyState.classes].find((item) => item.name === className) || null;
  normalizeAssemblySections(classDoc?.sections).forEach((section) => {
    const option = document.createElement('option');
    option.value = section;
    option.innerText = `سیکشن ${section}`;
    select.appendChild(option);
  });
}

async function updateAssemblyAssigneeOptions() {
  const type = document.getElementById('assemblyAssigneeType')?.value || 'student';
  const department = document.getElementById('assemblyDepartment')?.value || '';
  const className = document.getElementById('assemblyClass')?.value || '';
  const section = document.getElementById('assemblySection')?.value || '';
  const select = document.getElementById('assemblyAssigneeSelect');
  const customWrap = document.getElementById('assemblyAssigneeCustomWrap');
  const label = document.getElementById('assemblyAssigneeFieldLabel');
  if (!select) return;

  select.innerHTML = '<option value="">مسئول منتخب کریں</option>';
  if (customWrap) customWrap.style.display = type === 'other' ? '' : 'none';
  if (label) {
    label.innerText = type === 'student'
      ? 'طالب علم منتخب کریں'
      : type === 'teacher'
        ? 'استاد منتخب کریں'
        : type === 'class'
          ? 'کلاس / سیکشن منتخب کریں'
          : 'مسئول منتخب کریں';
  }

  if (type === 'other') return;
  if (type === 'teacher') {
    assemblyState.teachers.forEach((teacher) => {
      const option = document.createElement('option');
      option.value = teacher.id || '';
      option.innerText = getAssemblyTeacherName(teacher);
      option.dataset.name = getAssemblyTeacherName(teacher);
      select.appendChild(option);
    });
    return;
  }
  if (type === 'class') {
    const option = document.createElement('option');
    option.value = className || '';
    option.dataset.name = [getClassDisplayNameSafe(className), section ? `سیکشن ${section}` : 'عمومی'].filter(Boolean).join(' - ');
    option.innerText = option.dataset.name || 'کلاس';
    if (option.value) select.appendChild(option);
    if (select.options.length > 1) select.selectedIndex = 1;
    return;
  }

  assemblyState.editorStudents = await loadAssemblyStudents({ department, className, section });
  assemblyState.editorStudents.forEach((student) => {
    const option = document.createElement('option');
    option.value = student.id;
    option.dataset.name = getAssemblyStudentName(student);
    option.innerText = `${student.rollNumber ? `${student.rollNumber} - ` : ''}${getAssemblyStudentName(student)}`;
    select.appendChild(option);
  });
  if (typeof renderAssemblyDragDropScheduler === 'function') {
    renderAssemblyDragDropScheduler();
  }
}

async function loadAssemblyStudents({ department, className, section }) {
  if (!department || !className) return [];
  let snapshot;
  try {
    snapshot = await db.collection('students').get();
  } catch (error) {
    console.warn('Students could not be loaded for assembly assignment', error?.message || error);
    return [];
  }

  const departmentUr = getDepartmentDisplayNameSafe(department);
  const classUr = getClassDisplayNameSafe(className);
  const classDoc = assemblyState.classes.find((item) => item.name === className) || null;
  const classId = classDoc?.id || '';
  const list = [];
  snapshot.forEach((doc) => {
    const student = { id: doc.id, ...(doc.data() || {}) };
    if (!matchesAssemblyDepartment(student, department, departmentUr)) return;
    if (!matchesAssemblyClass(student, className, classUr, classId)) return;
    const studentSections = extractAssemblyStudentSections(student);
    if (section && studentSections.length && !studentSections.includes(normalizeAssemblyToken(section))) return;
    list.push(student);
  });

  return list.sort((a, b) => {
    const rollA = Number(a.rollNumber || 0) || 0;
    const rollB = Number(b.rollNumber || 0) || 0;
    if (rollA !== rollB) return rollA - rollB;
    return getAssemblyStudentName(a).localeCompare(getAssemblyStudentName(b), 'en');
  });
}

// Load by Date index
async function loadAssemblyAssignments() {
  const selectedDate = document.getElementById('assemblyDate')?.value || '';
  if (!selectedDate) {
    setAssemblyState('تاریخ منتخب کریں۔');
    renderAssemblyBoard([]);
    return;
  }

  // Derive weekStart and dayKey from selectedDate for index-free backward compatibility
  const weekStart = getSaturdayOfDate(selectedDate);
  const dayIndex = new Date(selectedDate).getDay();
  const dayKey = DAY_KEYS[dayIndex];

  setAssemblyState('ذمہ داریاں لوڈ ہو رہی ہیں...');
  try {
    const tenantId = assemblyState.currentUser?.tenantId || localStorage.getItem('tenantId') || '';
    let query = db.collection('assembly_responsibilities').where('weekStart', '==', weekStart).where('dayKey', '==', dayKey);
    if (tenantId) query = query.where('tenantId', '==', tenantId);
    
    const snapshot = await query.get();
    let assignments = [];
    snapshot.forEach((doc) => assignments.push({ id: doc.id, ...(doc.data() || {}) }));
    window.allWeekAssignmentsCache = assignments;

    const filterDepartment = document.getElementById('assemblyFilterDepartment')?.value || '';
    const filterClass = document.getElementById('assemblyFilterClass')?.value || '';
    const filterSection = document.getElementById('assemblyFilterSection')?.value || '';
    if (filterDepartment) assignments = assignments.filter((item) => item.department === filterDepartment || item.department_ur === filterDepartment);
    if (filterClass) assignments = assignments.filter((item) => item.className === filterClass || item.className_ur === filterClass);
    if (filterSection) assignments = assignments.filter((item) => normalizeAssemblyToken(item.section || '') === normalizeAssemblyToken(filterSection));

    const currentUser = assemblyState.currentUser || {};
    const roles = getUserRoles(currentUser);
    const isStudentOnly = roles.length === 1 && roles[0] === 'student';
    if (isStudentOnly) {
      assignments = assignments.filter((item) => {
        const classMatch = !currentUser.className || item.className === currentUser.className || item.className_ur === currentUser.className_ur;
        const sectionMatch = !currentUser.section ? true : normalizeAssemblyToken(item.section || '') === normalizeAssemblyToken(currentUser.section);
        return classMatch && sectionMatch;
      });
    }

    assemblyState.assignments = assignments;
    renderAssemblyBoard(assignments);
    updateAssemblyStats(assignments);
    setAssemblyState(assignments.length ? 'ذمہ داریاں لوڈ ہو گئیں۔' : 'اس تاریخ کے لیے کوئی ذمہ داری موجود نہیں۔');
    if (typeof renderAssemblyDragDropScheduler === 'function') {
      renderAssemblyDragDropScheduler();
    }
  } catch (error) {
    console.error('Error loading assembly responsibilities:', error);
    setAssemblyState('ذمہ داریاں لوڈ نہ ہو سکیں۔');
    renderAssemblyBoard([]);
  }
}

function renderAssemblyBoard(assignments) {
  const tbody = document.getElementById('assemblyBoardBody');
  if (!tbody) return;

  tbody.innerHTML = assemblyState.tasks.map((task) => {
    const matches = assignments.filter((item) => item.taskKey === task.key);
    
    let cellContent = '<div class="assignment-empty">کوئی ذمہ داری نہیں</div>';
    if (matches.length > 0) {
      cellContent = matches.map((item) => `
        <div class="assignment-card" style="min-height: auto; margin-bottom: 0.5rem;">
          <div class="assignment-main" style="display:flex; justify-content:space-between; align-items:center;">
             <span>${escapeAssemblyHtml(item.assigneeName || '-')}</span>
             <span style="font-size:0.75rem; background:#e0f2fe; color:#0369a1; padding:0.1rem 0.4rem; border-radius:0.25rem;">${escapeAssemblyHtml(getAssigneeTypeLabel(item.assigneeType))}</span>
          </div>
          <div class="assignment-class" style="font-size:0.82rem; margin-top:0.2rem;">${escapeAssemblyHtml([item.className_ur || item.className || item.department_ur || item.department || '', item.section ? `سیکشن ${item.section}` : ''].filter(Boolean).join(' • '))}</div>
          <div class="assignment-meta" style="font-size:0.8rem; font-weight:600;">${item.itemTitle ? `موضوع: ${escapeAssemblyHtml(item.itemTitle)}` : ''}</div>
          <div class="assignment-notes" style="font-size:0.8rem; background:#f8fafc; border-radius:0.25rem; padding:0.2rem 0.5rem; margin-top:0.25rem;">${escapeAssemblyHtml(item.notes || 'نوٹ: —')}</div>
          ${assemblyState.canEdit ? `
             <div class="assignment-actions" style="margin-top:0.5rem; display:flex; gap:0.25rem;">
                 <button class="btn-secondary" type="button" data-edit-assignment="${item.id}" style="padding:0.25rem 0.5rem; font-size:0.78rem;">ترمیم</button>
                 <button class="btn-secondary" type="button" data-delete-assignment="${item.id}" style="padding:0.25rem 0.5rem; font-size:0.78rem;">حذف</button>
             </div>
          ` : ''}
        </div>
      `).join('');
    }

    const firstMatch = matches[0] || {};

    return `
      <tr>
        <td style="font-weight:700; color:#1e293b; vertical-align:middle;">${escapeAssemblyHtml(task.label)}</td>
        <td style="vertical-align:middle;">${matches.length > 0 ? matches.map(m => escapeAssemblyHtml(m.assigneeName)).join('، ') : cellContent}</td>
        <td style="vertical-align:middle;">${matches.length > 0 ? matches.map(m => escapeAssemblyHtml([m.className_ur || m.className || '', m.section ? `سیکشن ${m.section}` : ''].filter(Boolean).join(' • '))).join('<br>') : '—'}</td>
        <td style="vertical-align:middle;">${matches.length > 0 ? matches.map(m => escapeAssemblyHtml([m.itemTitle, m.notes].filter(Boolean).join(' | ')) || '—').join('<br>') : '—'}</td>
        <td style="vertical-align:middle;">
          ${assemblyState.canEdit && matches.length > 0 ? matches.map(m => `
             <div style="display:flex; gap:0.25rem; margin-bottom:0.25rem;">
                <button class="btn-secondary" type="button" data-edit-assignment="${m.id}" style="padding:0.25rem 0.5rem; font-size:0.75rem;">ترمیم</button>
                <button class="btn-secondary" type="button" data-delete-assignment="${m.id}" style="padding:0.25rem 0.5rem; font-size:0.75rem; background:#fee2e2; color:#b91c1c; border-color:#fee2e2;">حذف</button>
             </div>
          `).join('') : '—'}
        </td>
      </tr>
    `;
  }).join('');
}

function updateAssemblyStats(assignments) {
  document.getElementById('assemblyStatTotal').innerText = String(assignments.length || 0);
  const filterDepartment = document.getElementById('assemblyFilterDepartment')?.selectedOptions?.[0]?.textContent || 'تمام';
  const filterClass = document.getElementById('assemblyFilterClass')?.selectedOptions?.[0]?.textContent || '';
  const filterSection = document.getElementById('assemblyFilterSection')?.selectedOptions?.[0]?.textContent || '';
  document.getElementById('assemblyStatFilter').innerText = [filterClass || filterDepartment, filterSection && filterSection !== 'تمام سیکشنز' ? filterSection : ''].filter(Boolean).join(' • ') || 'تمام';

  document.getElementById('assemblyStatDay').innerText = document.getElementById('assemblyDate')?.value || '-';
}

async function saveAssemblyAssignment() {
  if (!assemblyState.canEdit) return;

  const assignDate = document.getElementById('assemblyAssignDate')?.value || '';
  if (!assignDate) {
    alert('براہ کرم تاریخ منتخب کریں۔');
    return;
  }

  // Derive weekStart and dayKey
  const weekStart = getSaturdayOfDate(assignDate);
  const dayIndex = new Date(assignDate).getDay();
  const dayKey = DAY_KEYS[dayIndex];
  const dayLabel = DAY_LABELS[dayKey] || 'دن';

  const taskKey = document.getElementById('assemblyTask')?.value || '';
  const department = document.getElementById('assemblyDepartment')?.value || '';
  const className = document.getElementById('assemblyClass')?.value || '';
  const section = document.getElementById('assemblySection')?.value || '';
  const assigneeType = document.getElementById('assemblyAssigneeType')?.value || '';
  const assigneeSelect = document.getElementById('assemblyAssigneeSelect');
  const selectedAssignee = assigneeSelect?.selectedOptions?.[0] || null;
  const assigneeCustom = document.getElementById('assemblyAssigneeCustom')?.value?.trim() || '';
  const itemTitle = document.getElementById('assemblyItemTitle')?.value?.trim() || '';
  const notes = document.getElementById('assemblyNotes')?.value?.trim() || '';
  const docId = document.getElementById('assemblyDocId')?.value || '';

  const assigneeId = assigneeType === 'other' ? '' : (assigneeSelect?.value || '');
  const assigneeName = assigneeType === 'other'
    ? assigneeCustom
    : (selectedAssignee?.dataset?.name || selectedAssignee?.textContent || '').trim();

  if (!taskKey || !department || !className || !assigneeName) {
    alert('ٹاسک، شعبہ، کلاس اور مسئول لازماً منتخب کریں۔');
    return;
  }

  const taskLabel = assemblyState.tasks.find((item) => item.key === taskKey)?.label || taskKey;

  // Conflict Checking
  const allWeek = window.allWeekAssignmentsCache || [];
  const conflict = allWeek.find(item => 
      item.dayKey === dayKey && 
      item.assigneeId === assigneeId && 
      item.id !== docId &&
      item.assigneeType === assigneeType &&
      assigneeType !== 'class' && 
      assigneeType !== 'other'
  );
  if (conflict) {
      const msg = `تنبيه: یہ مسئول (${assigneeName}) پہلے ہی اس دن (${dayLabel}) ٹاسک "${conflict.taskLabel}" کے لیے تفویض شدہ ہے۔ کیا آپ پھر بھی تفویض کرنا چاہتے ہیں؟`;
      if (!confirm(msg)) {
          return;
      }
  }

  const departmentUr = getDepartmentDisplayNameSafe(department);
  const classUr = getClassDisplayNameSafe(className);
  const classDoc = assemblyState.classes.find((item) => item.name === className) || null;
  
  const payload = {
    date: assignDate,
    weekStart,
    dayKey,
    dayLabel,
    taskKey,
    taskLabel,
    department,
    department_ur: departmentUr,
    className,
    className_ur: classUr,
    classId: classDoc?.id || '',
    section,
    sectionLabel: section ? `سیکشن ${section}` : 'عمومی',
    assigneeType,
    assigneeId,
    assigneeName,
    itemTitle,
    notes,
    tenantId: assemblyState.currentUser?.tenantId || localStorage.getItem('tenantId') || '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedByUid: assemblyState.currentUser?.uid || '',
    updatedByName: assemblyState.currentUser?.name || assemblyState.currentUser?.displayName || ''
  };

  if (assigneeType === 'student') {
    const student = assemblyState.editorStudents.find((item) => item.id === assigneeId) || null;
    payload.studentId = student?.id || assigneeId;
    payload.rollNumber = student?.rollNumber || '';
  }
  if (assigneeType === 'teacher') {
    payload.teacherId = assigneeId;
  }

  const refId = docId || buildAssemblyDocId({ weekStart, dayKey, taskKey, section, assigneeId, assigneeName });
  try {
    await db.collection('assembly_responsibilities').doc(refId).set(payload, { merge: true });
    setAssemblyState('ذمہ داری محفوظ ہو گئی۔');
    resetAssemblyForm();
    await loadAssemblyAssignments();
  } catch (error) {
    console.error('Error saving assembly responsibility:', error);
    setAssemblyState('ذمہ داری محفوظ نہ ہو سکی۔');
    alert('ذمہ داری محفوظ کرنے میں مسئلہ پیش آیا۔');
  }
}

async function loadAssignmentIntoForm(id) {
  const item = assemblyState.assignments.find((entry) => entry.id === id);
  if (!item) return;
  
  const docDate = item.date || getDateFromWeekStartAndDay(item.weekStart, item.dayKey);
  
  document.getElementById('assemblyDocId').value = item.id || '';
  document.getElementById('assemblyAssignDate').value = docDate;
  document.getElementById('assemblyTask').value = item.taskKey || '';
  document.getElementById('assemblyDepartment').value = item.department || '';
  await updateAssemblyFormClasses();
  document.getElementById('assemblyClass').value = item.className || '';
  await updateAssemblyFormSections();
  document.getElementById('assemblySection').value = item.section || '';
  document.getElementById('assemblyAssigneeType').value = item.assigneeType || 'student';
  await updateAssemblyAssigneeOptions();

  if (item.assigneeType === 'other') {
    document.getElementById('assemblyAssigneeCustom').value = item.assigneeName || '';
  } else if (document.getElementById('assemblyAssigneeSelect')) {
    document.getElementById('assemblyAssigneeSelect').value = item.assigneeId || item.studentId || item.teacherId || '';
  }

  document.getElementById('assemblyItemTitle').value = item.itemTitle || '';
  document.getElementById('assemblyNotes').value = item.notes || '';
  setAssemblyState('موجودہ ذمہ داری ترمیم کے لیے فارم میں لوڈ ہو گئی۔');
}

async function deleteAssemblyAssignment(id) {
  if (!assemblyState.canEdit || !id) return;
  if (!confirm('کیا آپ یہ ذمہ داری حذف کرنا چاہتے ہیں؟')) return;
  try {
    await db.collection('assembly_responsibilities').doc(id).delete();
    setAssemblyState('ذمہ داری حذف کر دی گئی۔');
    if (document.getElementById('assemblyDocId').value === id) resetAssemblyForm();
    await loadAssemblyAssignments();
  } catch (error) {
    console.error('Error deleting assembly responsibility:', error);
    setAssemblyState('ذمہ داری حذف نہ ہو سکی۔');
  }
}

function resetAssemblyForm() {
  document.getElementById('assemblyDocId').value = '';
  const today = new Date().toLocaleDateString('sv-SE');
  document.getElementById('assemblyAssignDate').value = today;
  document.getElementById('assemblyTask').selectedIndex = 0;
  document.getElementById('assemblyDepartment').value = '';
  document.getElementById('assemblyClass').innerHTML = '<option value="">کلاس منتخب کریں</option>';
  document.getElementById('assemblySection').innerHTML = '<option value="">عمومی سیکشن</option>';
  document.getElementById('assemblyAssigneeType').selectedIndex = 0;
  document.getElementById('assemblyAssigneeSelect').innerHTML = '<option value="">مسئول منتخب کریں</option>';
  document.getElementById('assemblyAssigneeCustom').value = '';
  document.getElementById('assemblyAssigneeCustomWrap').style.display = 'none';
  document.getElementById('assemblyItemTitle').value = '';
  document.getElementById('assemblyNotes').value = '';
  assemblyState.editorStudents = [];
}

function buildAssemblyDocId({ weekStart, dayKey, taskKey, section, assigneeId, assigneeName }) {
  return ['assembly', weekStart, dayKey, taskKey, normalizeAssemblyToken(section || 'general'), normalizeAssemblyToken(assigneeId || assigneeName)].filter(Boolean).join('__');
}

function getAssigneeTypeLabel(key) {
  return assemblyState.assigneeTypes.find((item) => item.key === key)?.label || key || '';
}

function getAssemblyTeacherName(teacher) {
  return String(teacher?.name || `${teacher?.firstName || ''} ${teacher?.lastName || ''}` || teacher?.fullName || '').trim();
}

function getAssemblyStudentName(student) {
  const first = String(student?.firstName || '').trim();
  const last = String(student?.lastName || '').trim();
  return `${first} ${last}`.trim() || String(student?.name || student?.studentName || '').trim() || 'طالب علم';
}

function normalizeAssemblySections(value) {
  if (!value) return [];
  const raw = Array.isArray(value) ? value : [value];
  return Array.from(new Set(
    raw
      .flatMap((item) => String(item || '').split(/[,&/]| and /i))
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  ));
}

function matchesAssemblyDepartment(student, department, departmentUr) {
  const candidates = [student.department, student.department_ur].map((value) => String(value || '').trim()).filter(Boolean);
  return candidates.includes(department) || (departmentUr && candidates.includes(departmentUr));
}

function matchesAssemblyClass(student, className, classUr, classId) {
  const candidates = [
    student.className,
    student.className_ur,
    student.admissionClass,
    student.admissionClass_ur
  ].map((value) => String(value || '').trim()).filter(Boolean);
  return candidates.includes(className) || (classUr && candidates.includes(classUr)) || (classId && String(student.classId || '') === classId);
}

function extractAssemblyStudentSections(student) {
  return Array.from(new Set([
    student.section,
    student.section_ur,
    student.sectionName,
    student.sectionName_ur,
    student.admissionSection,
    student.admissionSection_ur,
    student.sectionLabel
  ].map(normalizeAssemblyToken).filter(Boolean)));
}

function getSaturdayOfDate(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
  const diff = day === 6 ? 0 : -(day + 1);
  const saturday = new Date(d);
  saturday.setDate(d.getDate() + diff);
  return saturday.toISOString().split('T')[0];
}

function getDateFromWeekStartAndDay(weekStartStr, dayKey) {
  const d = new Date(weekStartStr);
  const dayOffset = {
    'sat': 0,
    'sun': 1,
    'mon': 2,
    'tue': 3,
    'wed': 4,
    'thu': 5,
    'fri': 6
  };
  const offset = dayOffset[dayKey] || 0;
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

function getSaturdayOfCurrentWeek() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 6 ? 0 : ((day + 1) % 7);
  const saturday = new Date(now);
  saturday.setDate(now.getDate() - diff);
  return saturday.toISOString().split('T')[0];
}

function setAssemblyState(text) {
  const el = document.getElementById('assemblyLoadState');
  if (el) el.innerText = text;
}

function getDepartmentDisplayNameSafe(value) {
  const dept = assemblyState.departments.find((item) => item.name === value) || {};
  return typeof getDepartmentDisplayName === 'function' ? getDepartmentDisplayName(value || '', dept.name_ur || '') : (dept.name_ur || value || '');
}

function getClassDisplayNameSafe(value) {
  const cls = [...assemblyState.classes, ...assemblyState.filterClasses].find((item) => item.name === value) || {};
  return typeof getClassDisplayName === 'function' ? getClassDisplayName(value || '', cls.name_ur || '') : (cls.name_ur || value || '');
}

function normalizeAssemblyToken(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/gi, '_').replace(/^_+|_+$/g, '');
}

function escapeAssemblyHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// --- Drag-and-Drop Duty Scheduler Implementation ---
window.renderAssemblyDragDropScheduler = function() {
  const dragDropCard = document.getElementById('assemblyDragDropCard');
  if (!dragDropCard) return;

  if (!assemblyState.canEdit) {
    dragDropCard.style.display = 'none';
    return;
  }
  
  const department = document.getElementById('assemblyDepartment')?.value || '';
  const className = document.getElementById('assemblyClass')?.value || '';
  if (!department || !className) {
    dragDropCard.style.display = 'none';
    return;
  }

  dragDropCard.style.display = 'block';

  // 1. Render Student Cards in Deck
  const deck = document.getElementById('assemblyStudentDeck');
  if (deck) {
    if (assemblyState.editorStudents.length === 0) {
      deck.innerHTML = '<div style="color:var(--text-light); font-size:0.85rem; width:100%; text-align:center; padding:1rem;">اس کلاس میں کوئی طالب علم نہیں ملا۔</div>';
    } else {
      deck.innerHTML = assemblyState.editorStudents.map(student => {
        const name = getAssemblyStudentName(student);
        const rollStr = student.rollNumber ? `<span style="background:var(--primary-color); color:#fff; border-radius:0.25rem; padding:0.15rem 0.35rem; font-size:0.75rem; margin-left:0.25rem;">${student.rollNumber}</span>` : '';
        return `
          <div class="drag-student" draggable="true" data-student-id="${student.id}" ondragstart="handleAssemblyDragStart(event)">
            ${rollStr}
            <span>${name}</span>
          </div>
        `;
      }).join('');
    }
  }

  // 2. Render Single Column Dropzone for the selected date
  const grid = document.getElementById('assemblyDropGrid');
  if (grid) {
    const selectedDate = document.getElementById('assemblyDate')?.value || '';
    if (!selectedDate) {
      grid.innerHTML = '<div style="color:var(--text-light); font-size:0.85rem; text-align:center; padding:1rem; width:100%;">براہ کرم تاریخ منتخب کریں۔</div>';
      return;
    }

    const dayIndex = new Date(selectedDate).getDay();
    const dayKey = DAY_KEYS[dayIndex];
    const dayLabel = DAY_LABELS[dayKey] || 'دن';

    const slotsHtml = assemblyState.tasks.map(task => {
      const section = document.getElementById('assemblySection')?.value || '';
      const assignment = assemblyState.assignments.find(item => 
        item.taskKey === task.key && 
        item.className === className &&
        normalizeAssemblyToken(item.section || '') === normalizeAssemblyToken(section)
      );

      let assigneeHtml = '<div class="slot-assignee-empty">خالی (کوئی نہیں)</div>';
      if (assignment) {
        assigneeHtml = `
          <div class="slot-assignee-card">
            <span>${assignment.assigneeName}</span>
            <button type="button" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:1.1rem; line-height:1; padding:0 0.25rem; font-weight:bold;" onclick="removeAssemblyAssignmentDirect('${assignment.id}')" title="حذف کریں">&times;</button>
          </div>
        `;
      }

      return `
        <div class="drop-task-slot" data-day-key="${dayKey}" data-task-key="${task.key}" ondragover="handleAssemblyDragOver(event)" ondragleave="handleAssemblyDragLeave(event)" ondrop="handleAssemblyDrop(event)">
          <div class="slot-header">
            <span>${task.label}</span>
          </div>
          ${assigneeHtml}
        </div>
      `;
    }).join('');

    grid.innerHTML = `
      <div class="drop-day-column" style="background:#f1f5f9; padding: 0.75rem; border-radius:0.75rem; border:1px solid #cbd5e1; display:flex; flex-direction:column; gap:0.5rem; width:100%;">
        <h5 style="margin:0 0 0.25rem 0; text-align:center; font-weight:700; color:#334155; border-bottom:2px solid #cbd5e1; padding-bottom:0.25rem; font-size:0.9rem;">
            ذمہ داریوں کی تفویض (${dayLabel} - ${selectedDate.split('-').reverse().join('/')})
        </h5>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:0.75rem;">
           ${slotsHtml}
        </div>
      </div>
    `;
  }
};

window.handleAssemblyDragStart = function(event) {
  event.dataTransfer.setData('text/plain', event.currentTarget.dataset.studentId);
  event.dataTransfer.effectAllowed = 'move';
};

window.handleAssemblyDragOver = function(event) {
  event.preventDefault();
  event.currentTarget.classList.add('drag-over');
};

window.handleAssemblyDragLeave = function(event) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
};

window.handleAssemblyDrop = async function(event) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
  const studentId = event.dataTransfer.getData('text/plain');
  const dayKey = event.currentTarget.dataset.dayKey;
  const taskKey = event.currentTarget.dataset.taskKey;
  if (studentId && dayKey && taskKey) {
    await assignStudentViaDragDrop(studentId, dayKey, taskKey);
  }
};

async function assignStudentViaDragDrop(studentId, dayKey, taskKey) {
  if (!assemblyState.canEdit) return;
  const assignDate = document.getElementById('assemblyAssignDate')?.value || '';
  const department = document.getElementById('assemblyDepartment')?.value || '';
  const className = document.getElementById('assemblyClass')?.value || '';
  const section = document.getElementById('assemblySection')?.value || '';
  if (!assignDate || !department || !className) {
    alert('براہ کرم ڈریگ اینڈ ڈراپ سے پہلے تاریخ، شعبہ اور کلاس منتخب کریں۔');
    return;
  }
  const student = assemblyState.editorStudents.find(s => s.id === studentId);
  if (!student) return;
  
  const assigneeName = getAssemblyStudentName(student);
  const taskObj = assemblyState.tasks.find(t => t.key === taskKey);
  const taskLabelStr = taskObj ? taskObj.label : taskKey;
  
  const weekStart = getSaturdayOfDate(assignDate);
  const dayLabelStr = DAY_LABELS[dayKey] || 'دن';

  // Conflict checking
  const allWeek = window.allWeekAssignmentsCache || [];
  const conflict = allWeek.find(item => 
      item.dayKey === dayKey && 
      item.assigneeId === studentId && 
      item.assigneeType === 'student'
  );
  if (conflict) {
      if (!confirm(`تنبيه: یہ طالب علم (${assigneeName}) پہلے ہی اس دن (${dayLabelStr}) ٹاسک "${conflict.taskLabel}" کے لیے تفویض شدہ ہے۔ کیا آپ پھر بھی تفویض کرنا چاہتے ہیں؟`)) {
          return;
      }
  }

  const departmentUr = getDepartmentDisplayNameSafe(department);
  const classUr = getClassDisplayNameSafe(className);
  const classDoc = assemblyState.classes.find((item) => item.name === className) || null;

  const payload = {
    date: assignDate,
    weekStart,
    dayKey,
    dayLabel: dayLabelStr,
    taskKey,
    taskLabel: taskLabelStr,
    department,
    department_ur: departmentUr,
    className,
    className_ur: classUr,
    classId: classDoc?.id || '',
    section,
    sectionLabel: section ? `سیکشن ${section}` : 'عمومی',
    assigneeType: 'student',
    assigneeId: studentId,
    assigneeName,
    itemTitle: '',
    notes: '',
    tenantId: assemblyState.currentUser?.tenantId || localStorage.getItem('tenantId') || '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedByUid: assemblyState.currentUser?.uid || '',
    updatedByName: assemblyState.currentUser?.name || assemblyState.currentUser?.displayName || '',
    studentId,
    rollNumber: student.rollNumber || ''
  };

  const refId = buildAssemblyDocId({ weekStart, dayKey, taskKey, section, assigneeId: studentId, assigneeName });
  try {
    setAssemblyState('ذمہ داری تفویض ہو رہی ہے...');
    await db.collection('assembly_responsibilities').doc(refId).set(payload, { merge: true });
    await loadAssemblyAssignments();
  } catch (error) {
    console.error('Failed to assign student:', error);
    alert(`ذمہ داری محفوظ کرنے میں خرابی: ${error.message}`);
  }
}

window.removeAssemblyAssignmentDirect = async function(assignmentId) {
  if (!assemblyState.canEdit) return;
  if (!confirm('کیا آپ اس ذمہ داری کو حذف کرنا چاہتے ہیں؟')) return;
  try {
    setAssemblyState('ذمہ داری حذف ہو رہی ہے...');
    await db.collection('assembly_responsibilities').doc(assignmentId).delete();
    await loadAssemblyAssignments();
  } catch (error) {
    console.error('Failed to delete assignment:', error);
    alert(`ذمہ داری حذف کرنے میں خرابی: ${error.message}`);
  }
};
