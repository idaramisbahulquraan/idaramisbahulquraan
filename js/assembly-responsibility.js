const assemblyState = {
  currentUser: null,
  departments: [],
  classes: [],
  filterClasses: [],
  teachers: [],
  editorStudents: [],
  assignments: [],
  canEdit: false,
  days: [
    { key: 'sat', label: 'ہفتہ' },
    { key: 'sun', label: 'اتوار' },
    { key: 'mon', label: 'پیر' },
    { key: 'tue', label: 'منگل' },
    { key: 'wed', label: 'بدھ' },
    { key: 'thu', label: 'جمعرات' }
  ],
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

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('assemblyBoardBody')) return;

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  assemblyState.currentUser = currentUser;
  if (typeof initDashboard === 'function') initDashboard(currentUser);

  const roles = getUserRoles(currentUser);
  assemblyState.canEdit = roles.some((role) => ['teacher', 'admin', 'owner', 'principal', 'nazim_e_taleemaat'].includes(role));

  const weekInput = document.getElementById('assemblyWeekStart');
  if (weekInput && !weekInput.value) weekInput.value = getSaturdayOfCurrentWeek();

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
  const daySelect = document.getElementById('assemblyDay');
  const taskSelect = document.getElementById('assemblyTask');
  const typeSelect = document.getElementById('assemblyAssigneeType');
  const boardHead = document.getElementById('assemblyBoardHead');

  if (daySelect) {
    daySelect.innerHTML = assemblyState.days.map((day) => `<option value="${day.key}">${day.label}</option>`).join('');
  }
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
    boardHead.innerHTML = `<th class="task-title-cell">ذمہ داری</th>${assemblyState.days.map((day) => `<th>${day.label}</th>`).join('')}`;
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
  document.getElementById('assemblyWeekStart')?.addEventListener('change', loadAssemblyAssignments);
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

  try {
    const snapshot = await db.collection('departments').orderBy('name').get();
    assemblyState.departments = [];
    snapshot.forEach((doc) => assemblyState.departments.push({ id: doc.id, ...(doc.data() || {}) }));
  } catch (error) {
    console.warn('Assembly departments not available for current profile', error?.message || error);
    assemblyState.departments = [];
    return;
  }

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

async function loadAssemblyAssignments() {
  const weekStart = document.getElementById('assemblyWeekStart')?.value || '';
  if (!weekStart) {
    setAssemblyState('ہفتہ منتخب کریں۔');
    renderAssemblyBoard([]);
    return;
  }

  setAssemblyState('ذمہ داریاں لوڈ ہو رہی ہیں...');
  try {
    const snapshot = await db.collection('assembly_responsibilities').where('weekStart', '==', weekStart).get();
    let assignments = [];
    snapshot.forEach((doc) => assignments.push({ id: doc.id, ...(doc.data() || {}) }));

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
    setAssemblyState(assignments.length ? 'ذمہ داریاں لوڈ ہو گئیں۔' : 'اس ہفتے کے لیے کوئی ذمہ داری موجود نہیں۔');
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
    const cells = assemblyState.days.map((day) => renderAssignmentCell(task.key, day.key, assignments));
    return `<tr><td class="task-title-cell">${escapeAssemblyHtml(task.label)}</td>${cells.join('')}</tr>`;
  }).join('');
}

function renderAssignmentCell(taskKey, dayKey, assignments) {
  const matches = assignments.filter((item) => item.taskKey === taskKey && item.dayKey === dayKey);
  if (!matches.length) {
    return '<td><div class="assignment-empty">کوئی ذمہ داری نہیں</div></td>';
  }
  return `<td>${matches.map((item) => `
    <div class="assignment-card">
      <div class="assignment-main">${escapeAssemblyHtml(item.assigneeName || '-')}</div>
      <div class="assignment-class">${escapeAssemblyHtml([item.className_ur || item.className || item.department_ur || item.department || '', item.section ? `سیکشن ${item.section}` : ''].filter(Boolean).join(' • '))}</div>
      <div class="assignment-meta">${escapeAssemblyHtml(getAssigneeTypeLabel(item.assigneeType))}${item.itemTitle ? ` • ${escapeAssemblyHtml(item.itemTitle)}` : ''}</div>
      <div class="assignment-notes">${escapeAssemblyHtml(item.notes || '—')}</div>
      ${assemblyState.canEdit ? `<div class="assignment-actions"><button class="btn-secondary" type="button" data-edit-assignment="${item.id}">ترمیم</button><button class="btn-secondary" type="button" data-delete-assignment="${item.id}">حذف</button></div>` : ''}
    </div>
  `).join('')}</td>`;
}

function updateAssemblyStats(assignments) {
  document.getElementById('assemblyStatTotal').innerText = String(assignments.length || 0);
  const filterDepartment = document.getElementById('assemblyFilterDepartment')?.selectedOptions?.[0]?.textContent || 'تمام';
  const filterClass = document.getElementById('assemblyFilterClass')?.selectedOptions?.[0]?.textContent || '';
  const filterSection = document.getElementById('assemblyFilterSection')?.selectedOptions?.[0]?.textContent || '';
  document.getElementById('assemblyStatFilter').innerText = [filterClass || filterDepartment, filterSection && filterSection !== 'تمام سیکشنز' ? filterSection : ''].filter(Boolean).join(' • ') || 'تمام';

  const counts = new Map();
  assignments.forEach((item) => counts.set(item.dayKey, (counts.get(item.dayKey) || 0) + 1));
  let busiest = '-';
  let max = 0;
  assemblyState.days.forEach((day) => {
    const count = counts.get(day.key) || 0;
    if (count > max) {
      max = count;
      busiest = day.label;
    }
  });
  document.getElementById('assemblyStatDay').innerText = busiest;
}

async function saveAssemblyAssignment() {
  if (!assemblyState.canEdit) return;

  const weekStart = document.getElementById('assemblyWeekStart')?.value || '';
  const dayKey = document.getElementById('assemblyDay')?.value || '';
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

  if (!weekStart || !dayKey || !taskKey || !department || !className || !assigneeName) {
    alert('ہفتہ، دن، ٹاسک، شعبہ، کلاس اور مسئول لازماً منتخب کریں۔');
    return;
  }

  const taskLabel = assemblyState.tasks.find((item) => item.key === taskKey)?.label || taskKey;
  const dayLabel = assemblyState.days.find((item) => item.key === dayKey)?.label || dayKey;
  const departmentUr = getDepartmentDisplayNameSafe(department);
  const classUr = getClassDisplayNameSafe(className);
  const classDoc = assemblyState.classes.find((item) => item.name === className) || null;
  const payload = {
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
  document.getElementById('assemblyDocId').value = item.id || '';
  document.getElementById('assemblyDay').value = item.dayKey || '';
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
  document.getElementById('assemblyDay').selectedIndex = 0;
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
