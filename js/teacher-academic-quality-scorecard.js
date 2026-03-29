const teacherQualityState = {
  currentUser: null,
  departments: [],
  teachers: [],
  subjects: [],
  selectedDepartment: '',
  currentDocId: '',
  currentDoc: null,
  canView: false,
  canEdit: false,
  monthlyPerformanceMetrics: [
    { key: 'assigned_classes', title: 'متعلقہ کلاسیں', help: 'استاد کے نام سے منسلک کلاسوں کی تعداد', source: 'subjects' },
    { key: 'assigned_subjects', title: 'متعلقہ مضامین', help: 'استاد کے سپرد مضامین / کورسز کی تعداد', source: 'subjects' },
    { key: 'attendance_marked', title: 'حاضری اندراجات', help: 'اس ماہ استاد کے لاگ ان سے محفوظ شدہ attendance records', source: 'attendance' },
    { key: 'teacher_diaries', title: 'ٹیچرز ڈائری اندراجات', help: 'teacher_diaries میں ماہانہ محفوظ اندراجات', source: 'teacher_diaries' },
    { key: 'lesson_plans', title: 'ماڈل لیسن پلان', help: 'model_lesson_plans میں محفوظ ماہانہ منصوبے', source: 'model_lesson_plans' },
    { key: 'delivery_checklists', title: 'لیسن ڈلیوری چیک لسٹ', help: 'lesson_delivery_checklists میں محفوظ جائزے', source: 'lesson_delivery_checklists' },
    { key: 'syllabus_plans', title: 'اکیڈمک پلان مضامین', help: 'syllabus_plans میں اس استاد کے سپرد مضامین', source: 'syllabus_plans' }
  ],
  criteria: [
    {
      key: 'syllabus_target',
      title: 'ماہانہ کور ورک اور Syllabus Target کیا استاد نے وقت پر مکمل کیا ہے؟',
      max: 30,
      note: 'سبق، کورس اور ماہانہ ہدف کی تکمیل کا جائزہ'
    },
    {
      key: 'test_results',
      title: 'طلباء کے ٹیسٹ / امتحانات کے نتائج سے اسباق کی اوسط (Average) کیا رہی؟',
      max: 10,
      note: 'کلاس کے نتائج اور فہم کی اوسط'
    },
    {
      key: 'register_record',
      title: 'ریکارڈ / رجسٹر اور حاضری کا معیار / استعمال',
      max: 10,
      note: 'حاضری، رجسٹر، اندراج اور ریکارڈ کی صفائی'
    },
    {
      key: 'teaching_strategy',
      title: 'کلاس میں Teaching Strategy، سوالات، مثالیں اور مشقیں مؤثر تھیں؟',
      max: 15,
      note: 'سبق کی تدریسی حکمت عملی اور فہم پیدا کرنے کا انداز'
    },
    {
      key: 'documentation',
      title: 'Documentation: ڈائری، سبق پلان، پلانر اور ریکارڈ اپ ٹو ڈیٹ ہیں؟',
      max: 10,
      note: 'ریکارڈ کی اپ ڈیٹنگ اور دستاویزی معیار'
    },
    {
      key: 'activities',
      title: 'ہم نصابی، غیر نصابی اور تخلیقی Activities کی شمولیت اور تربیتی پہلو',
      max: 15,
      note: 'کلاس روم سرگرمیوں، مثبت رجحان اور شمولیت کا معیار'
    },
    {
      key: 'conduct',
      title: 'کیا استاد کا نظم، ضبط، اخلاق، وقت کی پابندی اور طرزِ عمل معیاری ہے؟',
      max: 10,
      note: 'Conduct، punctuality اور عمومی تاثر'
    }
  ]
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('taqsContent')) return;

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  teacherQualityState.currentUser = currentUser;
  if (typeof initDashboard === 'function') initDashboard(currentUser);

  const roles = getUserRoles(currentUser);
  teacherQualityState.canView = roles.some((role) => ['admin', 'nazim_e_taleemaat'].includes(role));
  teacherQualityState.canEdit = roles.some((role) => ['admin', 'nazim_e_taleemaat'].includes(role));

  document.getElementById('taqsAccessDenied').style.display = teacherQualityState.canView ? 'none' : '';
  document.getElementById('taqsContent').style.display = teacherQualityState.canView ? '' : 'none';
  if (!teacherQualityState.canView) return;

  const reviewDateInput = document.getElementById('taqsReviewDate');
  const monthInput = document.getElementById('taqsMonth');
  if (reviewDateInput && !reviewDateInput.value) reviewDateInput.value = new Date().toISOString().split('T')[0];
  if (monthInput && !monthInput.value) monthInput.value = new Date().toISOString().slice(0, 7);

  const reviewerInput = document.getElementById('taqsReviewer');
  if (reviewerInput) reviewerInput.value = String(currentUser?.name || currentUser?.displayName || '').trim();

  updateTeacherQualityModeUi();
  renderTeacherQualityRows();
  renderTeacherMonthlyPerformanceRows();
  bindTeacherQualityEvents();
  await Promise.all([loadTeacherQualityDepartments(), loadTeacherQualityTeachers(), loadTeacherQualitySubjects()]);
  updateTeacherQualityStats();
});

function updateTeacherQualityModeUi() {
  const mode = document.getElementById('taqsModeNote');
  if (mode) mode.innerText = teacherQualityState.canEdit ? 'درج / ترمیم: ناظمِ تعلیمات / ایڈمن' : 'صرف مشاہدہ';

  if (!teacherQualityState.canEdit) {
    document.getElementById('taqsSaveBtn')?.setAttribute('disabled', 'disabled');
    document.getElementById('taqsSummaryNote')?.classList.add('taqs-readonly');
    document.getElementById('taqsRefreshPerformanceBtn')?.setAttribute('disabled', 'disabled');
    document.getElementById('taqsPerformanceSummary')?.setAttribute('disabled', 'disabled');
  }
}

function bindTeacherQualityEvents() {
  document.getElementById('taqsDepartment')?.addEventListener('change', async () => {
    await updateTeacherQualityTeacherOptions();
    await maybeLoadTeacherQualityRecord();
  });
  document.getElementById('taqsTeacher')?.addEventListener('change', maybeLoadTeacherQualityRecord);
  document.getElementById('taqsMonth')?.addEventListener('change', maybeLoadTeacherQualityRecord);
  document.getElementById('taqsReviewDate')?.addEventListener('change', maybeLoadTeacherQualityRecord);
  document.getElementById('taqsSummaryNote')?.addEventListener('input', updateTeacherQualityStats);
  document.getElementById('taqsPerformanceSummary')?.addEventListener('input', updateTeacherMonthlyPerformanceStats);
  document.getElementById('taqsTableBody')?.addEventListener('input', (event) => {
    if (event.target.matches('[data-score-key]')) {
      clampTeacherQualityScore(event.target);
      updateTeacherQualityStats();
    }
  });
  document.getElementById('taqsPerformanceBody')?.addEventListener('input', (event) => {
    if (event.target.matches('[data-performance-final-key]')) {
      clampTeacherPerformanceFinalValue(event.target);
      updateTeacherMonthlyPerformanceStats();
    }
  });
  document.getElementById('taqsPrintBtn')?.addEventListener('click', () => window.print());
  document.getElementById('taqsSaveBtn')?.addEventListener('click', saveTeacherQualityRecord);
  document.getElementById('taqsRefreshPerformanceBtn')?.addEventListener('click', refreshTeacherMonthlyPerformanceMetrics);
}

function renderTeacherQualityRows() {
  const tbody = document.getElementById('taqsTableBody');
  if (!tbody) return;
  tbody.innerHTML = teacherQualityState.criteria.map((criterion, index) => `
    <tr>
      <td>${index + 1}</td>
      <td class="taqs-kpi">${escapeTeacherQualityHtml(criterion.title)}</td>
      <td class="taqs-max">${criterion.max}</td>
      <td class="taqs-score">
        <input
          type="number"
          min="0"
          max="${criterion.max}"
          class="taqs-input"
          data-score-key="${criterion.key}"
          ${teacherQualityState.canEdit ? '' : 'disabled'}
        >
      </td>
      <td>
        <textarea class="taqs-textarea" data-note-key="${criterion.key}" placeholder="${escapeTeacherQualityHtml(criterion.note)}" ${teacherQualityState.canEdit ? '' : 'disabled'}></textarea>
      </td>
    </tr>
  `).join('');
}

function renderTeacherMonthlyPerformanceRows() {
  const tbody = document.getElementById('taqsPerformanceBody');
  if (!tbody) return;
  tbody.innerHTML = teacherQualityState.monthlyPerformanceMetrics.map((metric, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>
        <div class="taqs-kpi">${escapeTeacherQualityHtml(metric.title)}</div>
        <div class="taqs-help-line">${escapeTeacherQualityHtml(metric.help)}</div>
      </td>
      <td><span class="taqs-auto-badge" id="taqsAuto_${metric.key}">0</span></td>
      <td>
        <input
          type="number"
          min="0"
          class="taqs-input"
          data-performance-final-key="${metric.key}"
          ${teacherQualityState.canEdit ? '' : 'disabled'}
        >
      </td>
      <td>
        <textarea class="taqs-textarea" data-performance-note-key="${metric.key}" placeholder="اگر سسٹم ویلیو میں ایڈجسٹمنٹ درکار ہو تو وجہ درج کریں۔" ${teacherQualityState.canEdit ? '' : 'disabled'}></textarea>
      </td>
    </tr>
  `).join('');
}

async function loadTeacherQualityDepartments() {
  const select = document.getElementById('taqsDepartment');
  if (!select) return;
  select.innerHTML = '<option value="">شعبہ منتخب کریں</option>';
  try {
    const snapshot = await db.collection('departments').orderBy('name').get();
    teacherQualityState.departments = [];
    snapshot.forEach((doc) => teacherQualityState.departments.push({ id: doc.id, ...(doc.data() || {}) }));
  } catch (error) {
    console.warn('Teacher quality departments unavailable', error?.message || error);
    teacherQualityState.departments = [];
    return;
  }

  teacherQualityState.departments.forEach((department) => {
    const option = document.createElement('option');
    option.value = department.name || '';
    option.innerText = typeof getDepartmentDisplayName === 'function'
      ? getDepartmentDisplayName(department.name || '', department.name_ur || '')
      : (department.name_ur || department.name || '');
    select.appendChild(option);
  });
}

async function loadTeacherQualityTeachers() {
  teacherQualityState.teachers = [];
  let snapshot;
  try {
    snapshot = await db.collection('teachers').orderBy('firstName').get();
  } catch (_) {
    snapshot = await db.collection('teachers').get();
  }
  snapshot.forEach((doc) => teacherQualityState.teachers.push({ id: doc.id, ...(doc.data() || {}) }));
  await updateTeacherQualityTeacherOptions();
}

async function loadTeacherQualitySubjects() {
  try {
    const snapshot = await db.collection('subjects').get();
    teacherQualityState.subjects = [];
    snapshot.forEach((doc) => teacherQualityState.subjects.push({ id: doc.id, ...(doc.data() || {}) }));
  } catch (error) {
    console.warn('Teacher quality subjects unavailable', error?.message || error);
    teacherQualityState.subjects = [];
  }
}

async function updateTeacherQualityTeacherOptions() {
  const select = document.getElementById('taqsTeacher');
  if (!select) return;
  const selectedDepartment = document.getElementById('taqsDepartment')?.value || '';
  teacherQualityState.selectedDepartment = selectedDepartment;
  const previousValue = select.value || '';
  select.innerHTML = '<option value="">استاد منتخب کریں</option>';

  let teachers = teacherQualityState.teachers.slice();
  if (selectedDepartment) {
    const teacherIds = new Set();
    const teacherNames = new Set();
    teacherQualityState.subjects.forEach((subject) => {
      if (subject.department !== selectedDepartment) return;
      if (subject.teacherId) teacherIds.add(String(subject.teacherId));
      if (Array.isArray(subject.teacherIds)) subject.teacherIds.forEach((id) => teacherIds.add(String(id)));
      if (subject.teacherName) teacherNames.add(String(subject.teacherName).trim());
      if (Array.isArray(subject.teacherNames)) subject.teacherNames.forEach((name) => teacherNames.add(String(name).trim()));
    });
    const filtered = teachers.filter((teacher) => {
      const id = String(teacher.id || '');
      const name = getTeacherQualityTeacherName(teacher);
      return teacherIds.has(id) || (name && teacherNames.has(name));
    });
    if (filtered.length) teachers = filtered;
  }

  teachers
    .sort((a, b) => getTeacherQualityTeacherName(a).localeCompare(getTeacherQualityTeacherName(b), 'en'))
    .forEach((teacher) => {
      const option = document.createElement('option');
      option.value = teacher.id;
      option.innerText = getTeacherQualityTeacherName(teacher);
      select.appendChild(option);
    });

  if (previousValue && teachers.some((teacher) => teacher.id === previousValue)) {
    select.value = previousValue;
  }
}

async function maybeLoadTeacherQualityRecord() {
  const department = document.getElementById('taqsDepartment')?.value || '';
  const teacherId = document.getElementById('taqsTeacher')?.value || '';
  const month = document.getElementById('taqsMonth')?.value || '';
  if (!department || !teacherId || !month) {
    clearTeacherQualityForm();
    setTeacherQualityState('شعبہ، استاد اور مہینہ منتخب کریں۔');
    return;
  }

  const docId = buildTeacherQualityDocId({ department, teacherId, month });
  teacherQualityState.currentDocId = docId;
  setTeacherQualityState('ریکارڈ لوڈ ہو رہا ہے...');
  try {
    const snap = await db.collection('teacher_academic_quality_scorecards').doc(docId).get();
    teacherQualityState.currentDoc = snap.exists ? { id: snap.id, ...(snap.data() || {}) } : null;
    if (teacherQualityState.currentDoc) {
      populateTeacherQualityForm(teacherQualityState.currentDoc);
      setTeacherQualityState('محفوظ شدہ اسکور کارڈ لوڈ ہو گیا۔');
    } else {
      clearTeacherQualityForm(true);
      setTeacherQualityState('نیا اسکور کارڈ درج کریں۔');
    }
    await refreshTeacherMonthlyPerformanceMetrics();
    updateTeacherQualityStats();
  } catch (error) {
    console.error('Teacher quality card load failed', error);
    setTeacherQualityState('اسکور کارڈ لوڈ نہیں ہو سکا۔');
  }
}

function populateTeacherQualityForm(doc) {
  document.getElementById('taqsReviewDate').value = doc.reviewDate || document.getElementById('taqsReviewDate').value;
  document.getElementById('taqsSummaryNote').value = doc.summaryNote || '';

  const scores = doc.scores || {};
  const notes = doc.notes || {};
  teacherQualityState.criteria.forEach((criterion) => {
    const scoreInput = document.querySelector(`[data-score-key="${criterion.key}"]`);
    const noteInput = document.querySelector(`[data-note-key="${criterion.key}"]`);
    if (scoreInput) scoreInput.value = Number(scores[criterion.key] || 0);
    if (noteInput) noteInput.value = notes[criterion.key] || '';
  });

  const performance = doc.monthlyPerformance || {};
  const performanceMetrics = performance.metrics || {};
  document.getElementById('taqsPerformanceSummary').value = performance.summary || '';
  teacherQualityState.monthlyPerformanceMetrics.forEach((metric) => {
    const autoEl = document.getElementById(`taqsAuto_${metric.key}`);
    const finalInput = document.querySelector(`[data-performance-final-key="${metric.key}"]`);
    const noteInput = document.querySelector(`[data-performance-note-key="${metric.key}"]`);
    const saved = performanceMetrics[metric.key] || {};
    if (autoEl) autoEl.innerText = String(saved.autoValue ?? 0);
    if (finalInput) finalInput.value = String(saved.finalValue ?? saved.autoValue ?? '');
    if (noteInput) noteInput.value = saved.note || '';
  });
  updateTeacherMonthlyPerformanceStats();
}

function clearTeacherQualityForm(keepReviewDate = false) {
  if (!keepReviewDate) {
    const reviewDateInput = document.getElementById('taqsReviewDate');
    if (reviewDateInput && !reviewDateInput.dataset.preserve) {
      reviewDateInput.value = new Date().toISOString().split('T')[0];
    }
  }
  document.getElementById('taqsSummaryNote').value = '';
  document.getElementById('taqsPerformanceSummary').value = '';
  teacherQualityState.criteria.forEach((criterion) => {
    const scoreInput = document.querySelector(`[data-score-key="${criterion.key}"]`);
    const noteInput = document.querySelector(`[data-note-key="${criterion.key}"]`);
    if (scoreInput) scoreInput.value = '';
    if (noteInput) noteInput.value = '';
  });
  teacherQualityState.monthlyPerformanceMetrics.forEach((metric) => {
    const autoEl = document.getElementById(`taqsAuto_${metric.key}`);
    const finalInput = document.querySelector(`[data-performance-final-key="${metric.key}"]`);
    const noteInput = document.querySelector(`[data-performance-note-key="${metric.key}"]`);
    if (autoEl) autoEl.innerText = '0';
    if (finalInput) finalInput.value = '';
    if (noteInput) noteInput.value = '';
  });
  teacherQualityState.currentDoc = null;
  updateTeacherQualityStats();
  updateTeacherMonthlyPerformanceStats();
}

function clampTeacherQualityScore(input) {
  const criterion = teacherQualityState.criteria.find((item) => item.key === input.dataset.scoreKey);
  if (!criterion) return;
  const safe = Math.max(0, Math.min(criterion.max, Number(input.value || 0)));
  input.value = Number.isFinite(safe) ? String(safe) : '0';
}

function updateTeacherQualityStats() {
  const total = teacherQualityState.criteria.reduce((sum, criterion) => {
    const input = document.querySelector(`[data-score-key="${criterion.key}"]`);
    return sum + Math.max(0, Math.min(criterion.max, Number(input?.value || 0)));
  }, 0);
  const percent = Math.round((total / 100) * 100);
  const gradeInfo = getTeacherQualityGradeInfo(total);
  document.getElementById('taqsTotalScore').innerText = `${total} / 100`;
  document.getElementById('taqsPercentage').innerText = `${percent}%`;
  document.getElementById('taqsGrade').innerText = gradeInfo.grade;
  document.getElementById('taqsAction').innerText = gradeInfo.action;
}

function clampTeacherPerformanceFinalValue(input) {
  const safe = Math.max(0, Number(input.value || 0));
  input.value = Number.isFinite(safe) ? String(safe) : '0';
}

function updateTeacherMonthlyPerformanceStats() {
  const autoTotal = teacherQualityState.monthlyPerformanceMetrics.reduce((sum, metric) => {
    const autoEl = document.getElementById(`taqsAuto_${metric.key}`);
    return sum + Number(autoEl?.innerText || 0);
  }, 0);
  const finalTotal = teacherQualityState.monthlyPerformanceMetrics.reduce((sum, metric) => {
    const finalInput = document.querySelector(`[data-performance-final-key="${metric.key}"]`);
    return sum + Number(finalInput?.value || 0);
  }, 0);

  document.getElementById('taqsPerformanceAutoTotal').innerText = String(autoTotal);
  document.getElementById('taqsPerformanceFinalTotal').innerText = String(finalTotal);

  const attendanceValue = document.getElementById('taqsAuto_attendance_marked')?.innerText || '0';
  const diaryValue = document.getElementById('taqsAuto_teacher_diaries')?.innerText || '0';
  document.getElementById('taqsPerformanceCoverage').innerText = `حاضری ${attendanceValue} / ڈائری ${diaryValue}`;

  const summary = document.getElementById('taqsPerformanceSummary')?.value?.trim() || '';
  document.getElementById('taqsPerformanceStatus').innerText = summary ? 'تبصرہ درج' : (finalTotal ? 'اندراج مکمل' : '-');
}

async function refreshTeacherMonthlyPerformanceMetrics() {
  const department = document.getElementById('taqsDepartment')?.value || '';
  const teacherId = document.getElementById('taqsTeacher')?.value || '';
  const month = document.getElementById('taqsMonth')?.value || '';
  if (!department || !teacherId || !month) {
    updateTeacherMonthlyPerformanceStats();
    return;
  }

  const teacher = teacherQualityState.teachers.find((item) => item.id === teacherId) || null;
  const teacherName = getTeacherQualityTeacherName(teacher);
  const autoData = await collectTeacherMonthlyAutoMetrics({ department, teacherId, teacherName, month });
  const savedMetrics = teacherQualityState.currentDoc?.monthlyPerformance?.metrics || {};

  teacherQualityState.monthlyPerformanceMetrics.forEach((metric) => {
    const autoEl = document.getElementById(`taqsAuto_${metric.key}`);
    const finalInput = document.querySelector(`[data-performance-final-key="${metric.key}"]`);
    const noteInput = document.querySelector(`[data-performance-note-key="${metric.key}"]`);
    const autoValue = Number(autoData[metric.key] || 0);
    const saved = savedMetrics[metric.key] || {};
    if (autoEl) autoEl.innerText = String(autoValue);
    if (finalInput) {
      const currentValue = finalInput.value;
      if (currentValue === '' || currentValue === String(saved.autoValue ?? '')) {
        finalInput.value = String(saved.finalValue ?? autoValue);
      }
    }
    if (noteInput && saved.note && !noteInput.value) noteInput.value = saved.note;
  });
  updateTeacherMonthlyPerformanceStats();
}

async function collectTeacherMonthlyAutoMetrics({ department, teacherId, teacherName, month }) {
  const [startDate, endDateExclusive] = getTeacherQualityMonthRange(month);
  const matchesTeacher = (uid, name, arrIds = [], arrNames = []) => {
    const trimmedName = String(name || '').trim();
    return uid === teacherId
      || arrIds.map(String).includes(String(teacherId))
      || (teacherName && trimmedName === teacherName)
      || arrNames.map((item) => String(item || '').trim()).includes(teacherName);
  };

  const assignedSubjects = teacherQualityState.subjects.filter((subject) => {
    if (subject.department !== department) return false;
    return matchesTeacher(subject.teacherId, subject.teacherName, subject.teacherIds || [], subject.teacherNames || []);
  });
  const classSet = new Set(assignedSubjects.map((subject) => String(subject.className || '').trim()).filter(Boolean));

  const [attendanceSnap, diarySnap, lessonPlanSnap, checklistSnap, syllabusSnap] = await Promise.all([
    db.collection('attendance').get().catch(() => null),
    db.collection('teacher_diaries').get().catch(() => null),
    db.collection('model_lesson_plans').get().catch(() => null),
    db.collection('lesson_delivery_checklists').get().catch(() => null),
    db.collection('syllabus_plans').get().catch(() => null)
  ]);

  let attendanceCount = 0;
  attendanceSnap?.forEach((doc) => {
    const data = doc.data() || {};
    const date = String(data.date || '').trim();
    if (!date || date < startDate || date >= endDateExclusive) return;
    if (String(data.markedBy || '') === String(teacherId)) attendanceCount += 1;
  });

  let diaryCount = 0;
  diarySnap?.forEach((doc) => {
    const data = doc.data() || {};
    const date = String(data.diaryDate || '').trim();
    if (!date || date < startDate || date >= endDateExclusive) return;
    const createdByUid = String(data.createdByUid || data.updatedByUid || '').trim();
    const createdByName = String(data.createdByName || data.updatedByName || '').trim();
    if (createdByUid === String(teacherId) || (teacherName && createdByName === teacherName)) diaryCount += 1;
  });

  let lessonPlanCount = 0;
  lessonPlanSnap?.forEach((doc) => {
    const data = doc.data() || {};
    const date = String(data.planDate || '').trim();
    if (!date || date < startDate || date >= endDateExclusive) return;
    if (String(data.teacherId || '') === String(teacherId) || (teacherName && String(data.teacherName || '').trim() === teacherName)) lessonPlanCount += 1;
  });

  let checklistCount = 0;
  checklistSnap?.forEach((doc) => {
    const data = doc.data() || {};
    const context = data.context || {};
    const date = String(context.date || '').trim();
    if (!date || date < startDate || date >= endDateExclusive) return;
    if (String(data.teacherId || context.teacherId || '') === String(teacherId) || (teacherName && String(data.teacherName || context.teacherName || '').trim() === teacherName)) checklistCount += 1;
  });

  let syllabusCount = 0;
  syllabusSnap?.forEach((doc) => {
    const data = doc.data() || {};
    if (data.department !== department) return;
    if (matchesTeacher(data.teacherId, data.teacherName, data.teacherIds || [], data.teacherNames || [])) syllabusCount += 1;
  });

  return {
    assigned_classes: classSet.size,
    assigned_subjects: assignedSubjects.length,
    attendance_marked: attendanceCount,
    teacher_diaries: diaryCount,
    lesson_plans: lessonPlanCount,
    delivery_checklists: checklistCount,
    syllabus_plans: syllabusCount
  };
}

function getTeacherQualityMonthRange(month) {
  const startDate = `${month}-01`;
  const [year, monthPart] = month.split('-').map(Number);
  const next = new Date(year, monthPart, 1);
  const endDateExclusive = next.toISOString().split('T')[0];
  return [startDate, endDateExclusive];
}

function getTeacherQualityGradeInfo(total) {
  if (total >= 90) return { grade: 'ممتاز', action: 'Recognition' };
  if (total >= 75) return { grade: 'بہتر', action: 'معمولی بہتری' };
  if (total >= 60) return { grade: 'اوسط', action: 'Coaching Plan' };
  return { grade: 'قابل اصلاح', action: 'Intensive Monitoring' };
}

async function saveTeacherQualityRecord() {
  if (!teacherQualityState.canEdit) {
    alert('یہ کارڈ صرف ناظمِ تعلیمات محفوظ کر سکتا ہے۔');
    return;
  }

  const department = document.getElementById('taqsDepartment')?.value || '';
  const teacherId = document.getElementById('taqsTeacher')?.value || '';
  const month = document.getElementById('taqsMonth')?.value || '';
  const reviewDate = document.getElementById('taqsReviewDate')?.value || '';
  const summaryNote = document.getElementById('taqsSummaryNote')?.value?.trim() || '';
  if (!department || !teacherId || !month || !reviewDate) {
    alert('شعبہ، استاد، مہینہ اور جائزہ تاریخ لازماً منتخب کریں۔');
    return;
  }

  const teacher = teacherQualityState.teachers.find((item) => item.id === teacherId) || null;
  const scores = {};
  const notes = {};
  teacherQualityState.criteria.forEach((criterion) => {
    const scoreInput = document.querySelector(`[data-score-key="${criterion.key}"]`);
    const noteInput = document.querySelector(`[data-note-key="${criterion.key}"]`);
    scores[criterion.key] = Math.max(0, Math.min(criterion.max, Number(scoreInput?.value || 0)));
    notes[criterion.key] = noteInput?.value?.trim() || '';
  });

  const total = Object.values(scores).reduce((sum, value) => sum + Number(value || 0), 0);
  const gradeInfo = getTeacherQualityGradeInfo(total);
  const docId = buildTeacherQualityDocId({ department, teacherId, month });
  const payload = {
    department,
    department_ur: getTeacherQualityDepartmentLabel(department),
    teacherId,
    teacherName: getTeacherQualityTeacherName(teacher),
    month,
    reviewDate,
    reviewerId: teacherQualityState.currentUser?.uid || '',
    reviewerName: String(teacherQualityState.currentUser?.name || teacherQualityState.currentUser?.displayName || '').trim(),
    scores,
    notes,
    summaryNote,
    monthlyPerformance: {
      summary: document.getElementById('taqsPerformanceSummary')?.value?.trim() || '',
      metrics: collectTeacherMonthlyPerformancePayload()
    },
    total,
    percentage: Math.round(total),
    grade: gradeInfo.grade,
    action: gradeInfo.action,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    tenantId: teacherQualityState.currentUser?.tenantId || localStorage.getItem('tenantId') || ''
  };

  try {
    await db.collection('teacher_academic_quality_scorecards').doc(docId).set(payload, { merge: true });
    teacherQualityState.currentDocId = docId;
    teacherQualityState.currentDoc = payload;
    updateTeacherQualityStats();
    setTeacherQualityState('اسکور کارڈ محفوظ ہو گیا۔');
  } catch (error) {
    console.error('Teacher quality card save failed', error);
    setTeacherQualityState('اسکور کارڈ محفوظ نہ ہو سکا۔');
    alert('محفوظ کرنے میں مسئلہ پیش آیا۔');
  }
}

function collectTeacherMonthlyPerformancePayload() {
  const payload = {};
  teacherQualityState.monthlyPerformanceMetrics.forEach((metric) => {
    const autoEl = document.getElementById(`taqsAuto_${metric.key}`);
    const finalInput = document.querySelector(`[data-performance-final-key="${metric.key}"]`);
    const noteInput = document.querySelector(`[data-performance-note-key="${metric.key}"]`);
    payload[metric.key] = {
      autoValue: Number(autoEl?.innerText || 0),
      finalValue: Number(finalInput?.value || 0),
      note: noteInput?.value?.trim() || ''
    };
  });
  return payload;
}

function buildTeacherQualityDocId({ department, teacherId, month }) {
  return ['teacher_quality', normalizeTeacherQualityToken(department), normalizeTeacherQualityToken(teacherId), normalizeTeacherQualityToken(month)].join('__');
}

function getTeacherQualityTeacherName(teacher) {
  if (!teacher) return '';
  return String(teacher.name || `${teacher.firstName || ''} ${teacher.lastName || ''}` || teacher.fullName || '').trim();
}

function getTeacherQualityDepartmentLabel(value) {
  const dept = teacherQualityState.departments.find((item) => item.name === value) || {};
  return typeof getDepartmentDisplayName === 'function'
    ? getDepartmentDisplayName(value || '', dept.name_ur || '')
    : (dept.name_ur || value || '');
}

function setTeacherQualityState(text) {
  const state = document.getElementById('taqsState');
  if (state) state.innerText = text;
}

function normalizeTeacherQualityToken(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/gi, '_').replace(/^_+|_+$/g, '');
}

function escapeTeacherQualityHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
