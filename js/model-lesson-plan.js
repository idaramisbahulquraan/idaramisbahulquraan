const simpleLessonPlanState = {
  departments: [],
  classes: [],
  subjects: [],
  currentUser: null,
  selectedClassDoc: null,
  selectedSubjectDoc: null,
  currentDocId: '',
  currentDoc: null,
  objectives: [
    { key: 'understand', label: 'متن / عبارت کو سمجھ سکیں گے' },
    { key: 'explain', label: 'درس بیان کر سکیں گے' },
    { key: 'apply', label: 'گھریلو زندگی میں اس کا اطلاق بیان کر سکیں گے' },
    { key: 'evidence', label: 'الفاظ / دلائل کی وضاحت کر سکیں گے' }
  ],
  introMethods: ['سوال', 'وعدہ', 'سابقہ سبق سے ربط', 'تمثیل', 'سبق پیش کرنا'],
  summaryOptions: ['اہم عبارت کی بازیابی', 'سبق کا خلاصہ', 'تفہیمی مثالیں شیئر کرنا'],
  objectiveStatuses: ['ہاں', 'جزوی', 'نہیں'],
  participationLevels: ['زیادہ', 'درمیانہ', 'کم'],
  teachingSteps: [
    { key: 'reading', title: 'عبارت کی قرأت', teacher: 'متن پڑھانا', student: 'سننا' },
    { key: 'explanation', title: 'تشریح', teacher: 'وضاحت کرنا', student: 'سوال کرنا' },
    { key: 'examples', title: 'مثالیں', teacher: 'عملی مثالیں دینا', student: 'نوٹ لینا' },
    { key: 'summary', title: 'خلاصہ', teacher: 'نکات بیان کرنا', student: 'دہرانا' }
  ],
  strategyColumns: [
    {
      title: 'طلبہ کی سوچ',
      items: ['تھنک-پیئر-شیئر', 'جوڑی میں سوال جواب', 'رول پلے', 'چھوٹے گروپ میں مسئلہ حل', 'طلبہ سے مختصر تبصرہ', 'استاد سوال حل کروائے', 'دلائل سے ثابت کرنا', 'اختتامی سوال کا تجزیہ', 'عملی مثالیں دینا', 'کیس اسٹڈی']
    },
    {
      title: 'فہم کو بہتر بنانے کی سرگرمیاں',
      items: ['خلاصہ لکھوانا', 'اہم نکات کی فہرست', 'تصوراتی نقشہ', 'ذہنی نقشہ', 'طلبہ کے سوالات', 'فوری کوئز', 'کتاب میں دلیل تلاش کرنا', 'متن کا تجزیہ', 'مختلف آراء کا تقابل', 'تحقیقی سوال', 'طالب علم پریزنٹیشن', 'طلبہ کا کردار ادا کرنا', 'گروپ فیڈ بیک']
    },
    {
      title: 'تحقیقی سرگرمیاں',
      items: ['مسئلہ حل کرنے کی سرگرمی', 'دلیل تلاش کرنا', 'اختتامی سوال کا تجزیہ', 'عملی مثال دینا', 'کلاس مباحثہ', 'تحقیقی سرگرمی', 'سبق چارٹ بنانا', 'خلاصہ پیپر', 'تصویری نقشہ', 'عملی مشاہدہ', 'سبق کی زبانی بیان کاری', 'خروجی پرچی', 'عکسی سوال', 'ایک منٹ کا خلاصہ', 'سوال لکھنا', 'ذہنی اطلاق لکھنا']
    }
  ],
  selectedStrategies: []
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('simpleLessonContent')) return;

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  simpleLessonPlanState.currentUser = currentUser;
  if (typeof initDashboard === 'function') initDashboard(currentUser);

  const roles = getUserRoles(currentUser);
  const allowed = roles.some(role => !['student', 'parent'].includes(role));
  const denied = document.getElementById('simpleLessonAccessDenied');
  const content = document.getElementById('simpleLessonContent');
  if (denied) denied.style.display = allowed ? 'none' : '';
  if (content) content.style.display = allowed ? '' : 'none';
  if (!allowed) return;

  const dateInput = document.getElementById('slpDate');
  if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];

  bindSimpleLessonEvents();
  renderSimpleLessonStaticUi();
  await loadSimpleLessonDepartments();
});

function bindSimpleLessonEvents() {
  document.getElementById('slpDepartment')?.addEventListener('change', async () => {
    await updateSimpleLessonClasses();
    await updateSimpleLessonSubjects();
  });
  document.getElementById('slpClass')?.addEventListener('change', async () => {
    updateSimpleLessonSections();
    await updateSimpleLessonSubjects();
  });
  document.getElementById('slpSection')?.addEventListener('change', updateSimpleLessonSubjects);
  document.getElementById('slpSubject')?.addEventListener('change', () => {
    simpleLessonPlanState.selectedSubjectDoc = simpleLessonPlanState.subjects.find(item => item.id === document.getElementById('slpSubject').value) || null;
    autoFillBookFromSubject();
  });
  document.getElementById('slpLoadBtn')?.addEventListener('click', loadSimpleLessonPlan);
  document.getElementById('slpSaveBtn')?.addEventListener('click', saveSimpleLessonPlan);
  document.getElementById('slpPrintBtn')?.addEventListener('click', printSimpleLessonPlan);

  document.getElementById('simpleLessonContent')?.addEventListener('click', (event) => {
    const strategy = event.target.closest('[data-strategy-value]');
    if (strategy) {
      toggleSimpleStrategy(strategy.dataset.strategyValue || '');
      renderSelectedActivities();
      renderStrategies();
      return;
    }
    const option = event.target.closest('[data-option-group][data-option-value]');
    if (option) {
      toggleSingleOption(option.dataset.optionGroup, option.dataset.optionValue);
    }
  });
}

function renderSimpleLessonStaticUi() {
  renderObjectiveChecks();
  renderOptionGroup('slpIntroMethods', simpleLessonPlanState.introMethods, 'intro');
  renderTeachingSteps();
  renderStrategies();
  renderSelectedActivities();
  renderOptionGroup('slpSummaryOptions', simpleLessonPlanState.summaryOptions, 'summary', true);
  renderOptionGroup('slpObjectiveStatus', simpleLessonPlanState.objectiveStatuses, 'objectiveStatus');
  renderOptionGroup('slpParticipation', simpleLessonPlanState.participationLevels, 'participation');
}

function renderObjectiveChecks(selected = []) {
  const selectedSet = new Set(selected);
  const box = document.getElementById('slpObjectivesBox');
  if (!box) return;
  box.innerHTML = simpleLessonPlanState.objectives.map((item) => `
    <label class="paper-check">
      <input type="checkbox" class="slp-objective" value="${escapeSimpleHtml(item.key)}" ${selectedSet.has(item.key) ? 'checked' : ''}>
      <span>${escapeSimpleHtml(item.label)}</span>
    </label>
  `).join('');
}

function renderOptionGroup(containerId, values, groupName, multi = false, selectedValues = []) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const selectedSet = new Set(Array.isArray(selectedValues) ? selectedValues : [selectedValues]);
  container.innerHTML = values.map((value) => `
    <label class="option-pill">
      <input type="${multi ? 'checkbox' : 'radio'}" name="${escapeSimpleHtml(groupName)}" ${selectedSet.has(value) ? 'checked' : ''} data-option-group="${escapeSimpleHtml(groupName)}" data-option-value="${escapeSimpleHtml(value)}">
      <span>${escapeSimpleHtml(value)}</span>
    </label>
  `).join('');
}

function renderTeachingSteps() {
  const body = document.getElementById('slpTeachingStepsBody');
  if (!body) return;
  body.innerHTML = simpleLessonPlanState.teachingSteps.map((step) => `
    <tr>
      <td><textarea class="paper-textarea small slp-step-student" data-step-key="${escapeSimpleHtml(step.key)}">${escapeSimpleHtml(step.student || '')}</textarea></td>
      <td><textarea class="paper-textarea small slp-step-teacher" data-step-key="${escapeSimpleHtml(step.key)}">${escapeSimpleHtml(step.teacher || '')}</textarea></td>
      <td><input class="paper-input slp-step-title" data-step-key="${escapeSimpleHtml(step.key)}" value="${escapeSimpleHtml(step.title || '')}" type="text"></td>
    </tr>
  `).join('');
}

function renderStrategies() {
  const grid = document.getElementById('slpStrategiesGrid');
  if (!grid) return;
  const selectedSet = new Set(simpleLessonPlanState.selectedStrategies.map(normalizeSimpleToken));
  grid.innerHTML = simpleLessonPlanState.strategyColumns.map((col) => `
    <div class="strategy-col">
      <h4>${escapeSimpleHtml(col.title)}</h4>
      <div class="strategy-list">
        ${col.items.map((item) => `
          <label class="strategy-item">
            <input type="checkbox" data-strategy-value="${escapeSimpleHtml(item)}" ${selectedSet.has(normalizeSimpleToken(item)) ? 'checked' : ''}>
            <span>${escapeSimpleHtml(item)}</span>
          </label>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function renderSelectedActivities() {
  const values = simpleLessonPlanState.selectedStrategies.slice(0, 3);
  ['slpSelectedActivity1','slpSelectedActivity2','slpSelectedActivity3'].forEach((id, index) => {
    const input = document.getElementById(id);
    if (input) input.value = values[index] || '';
  });
}

async function loadSimpleLessonDepartments() {
  const select = document.getElementById('slpDepartment');
  if (!select) return;
  select.innerHTML = '<option value="">شعبہ منتخب کریں</option>';
  const snapshot = await db.collection('departments').orderBy('name').get();
  simpleLessonPlanState.departments = [];
  snapshot.forEach(doc => simpleLessonPlanState.departments.push({ id: doc.id, ...(doc.data() || {}) }));
  simpleLessonPlanState.departments.forEach((department) => {
    const option = document.createElement('option');
    option.value = department.name || '';
    option.innerText = typeof getDepartmentDisplayName === 'function' ? getDepartmentDisplayName(department.name || '', department.name_ur || '') : (department.name_ur || department.name || '');
    select.appendChild(option);
  });
  resetSimpleClassSelect();
  resetSimpleSectionSelect();
  resetSimpleSubjectSelect();
}

async function updateSimpleLessonClasses() {
  const department = document.getElementById('slpDepartment')?.value || '';
  const select = document.getElementById('slpClass');
  if (!select) return;
  simpleLessonPlanState.classes = [];
  simpleLessonPlanState.selectedClassDoc = null;
  select.innerHTML = '<option value="">کلاس منتخب کریں</option>';
  resetSimpleSectionSelect();
  resetSimpleSubjectSelect();
  if (!department) return;
  const snapshot = await db.collection('classes').where('department', '==', department).get();
  snapshot.forEach(doc => simpleLessonPlanState.classes.push({ id: doc.id, ...(doc.data() || {}) }));
  simpleLessonPlanState.classes.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))).forEach((cls) => {
    const option = document.createElement('option');
    option.value = cls.name || '';
    option.innerText = typeof getClassDisplayName === 'function' ? getClassDisplayName(cls.name || '', cls.name_ur || '') : (cls.name_ur || cls.name || '');
    select.appendChild(option);
  });
}

function updateSimpleLessonSections() {
  const className = document.getElementById('slpClass')?.value || '';
  const select = document.getElementById('slpSection');
  if (!select) return;
  simpleLessonPlanState.selectedClassDoc = simpleLessonPlanState.classes.find(item => item.name === className) || null;
  select.innerHTML = '';
  const sections = normalizeSimpleSections(simpleLessonPlanState.selectedClassDoc?.sections);
  if (!sections.length) {
    select.innerHTML = '<option value="">عمومی</option>';
    return;
  }
  sections.forEach((section) => {
    const option = document.createElement('option');
    option.value = section;
    option.innerText = `سیکشن ${section}`;
    select.appendChild(option);
  });
}

async function updateSimpleLessonSubjects() {
  const department = document.getElementById('slpDepartment')?.value || '';
  const className = document.getElementById('slpClass')?.value || '';
  const section = document.getElementById('slpSection')?.value || '';
  const select = document.getElementById('slpSubject');
  if (!select) return;
  simpleLessonPlanState.subjects = [];
  simpleLessonPlanState.selectedSubjectDoc = null;
  select.innerHTML = '<option value="">مضمون منتخب کریں</option>';
  if (!department || !className) return;

  const snapshot = await db.collection('subjects').where('department', '==', department).where('className', '==', className).get();
  const roles = getUserRoles(simpleLessonPlanState.currentUser);
  const elevated = roles.some(role => ['admin', 'owner', 'principal', 'nazim_e_taleemaat', 'hifz_supervisor', 'accountant', 'clerk'].includes(role));
  const teacherUid = simpleLessonPlanState.currentUser?.uid || '';
  const teacherName = String(simpleLessonPlanState.currentUser?.name || simpleLessonPlanState.currentUser?.displayName || '').trim();

  snapshot.forEach((doc) => {
    const subject = { id: doc.id, ...(doc.data() || {}) };
    const subjectSections = normalizeSimpleSections(subject.sections || subject.section);
    const matchesSection = !section || !subjectSections.length || subjectSections.includes(section);
    const matchesTeacher = elevated || !roles.includes('teacher') ? true : subject.teacherId === teacherUid || (Array.isArray(subject.teacherIds) && subject.teacherIds.includes(teacherUid)) || (teacherName && String(subject.teacherName || '').trim() === teacherName) || (Array.isArray(subject.teacherNames) && subject.teacherNames.map(name => String(name || '').trim()).includes(teacherName));
    if (matchesSection && matchesTeacher) simpleLessonPlanState.subjects.push(subject);
  });

  simpleLessonPlanState.subjects.sort((a, b) => getSubjectDisplayName(a).localeCompare(getSubjectDisplayName(b), 'ur')).forEach((subject) => {
    const option = document.createElement('option');
    option.value = subject.id;
    option.innerText = typeof getSubjectDisplayName === 'function' ? getSubjectDisplayName(subject) : (subject.name_ur || subject.name || '');
    select.appendChild(option);
  });
}

function autoFillBookFromSubject() {
  const subject = simpleLessonPlanState.selectedSubjectDoc;
  const bookInput = document.getElementById('slpBook');
  if (subject && bookInput && !bookInput.value.trim()) bookInput.value = subject.book || '';
}

async function loadSimpleLessonPlan() {
  const context = getSimpleLessonContext();
  if (!context.department || !context.className || !context.subjectId || !context.planDate) {
    alert('شعبہ، کلاس، مضمون اور تاریخ منتخب کریں۔');
    return;
  }
  simpleLessonPlanState.selectedClassDoc = simpleLessonPlanState.classes.find(item => item.name === context.className) || null;
  simpleLessonPlanState.selectedSubjectDoc = simpleLessonPlanState.subjects.find(item => item.id === context.subjectId) || null;
  if (!simpleLessonPlanState.selectedSubjectDoc) {
    alert('مضمون نہیں ملا۔');
    return;
  }
  const stateLabel = document.getElementById('slpLoadState');
  if (stateLabel) stateLabel.innerText = 'منصوبہ لوڈ ہو رہا ہے...';
  try {
    const docId = buildSimpleLessonDocId(context);
    const snap = await db.collection('model_lesson_plans').doc(docId).get();
    simpleLessonPlanState.currentDocId = docId;
    simpleLessonPlanState.currentDoc = snap.exists ? { id: snap.id, ...(snap.data() || {}) } : null;
    if (simpleLessonPlanState.currentDoc) {
      populateSimpleLessonPlan(simpleLessonPlanState.currentDoc);
      if (stateLabel) stateLabel.innerText = 'موجودہ منصوبہ لوڈ ہو گیا۔';
    } else {
      resetSimpleLessonPlanForm();
      autoFillBookFromSubject();
      if (stateLabel) stateLabel.innerText = 'نیا منصوبہ شروع کریں۔';
    }
  } catch (error) {
    console.error('Failed to load simple lesson plan', error);
    if (stateLabel) stateLabel.innerText = `لوڈ نہیں ہو سکا: ${error.message}`;
    alert(`منصوبہ لوڈ نہیں ہو سکا: ${error.message}`);
  }
}

function resetSimpleLessonPlanForm() {
  renderObjectiveChecks();
  document.getElementById('slpOtherObjective1').value = '';
  document.getElementById('slpOtherObjective2').value = '';
  document.querySelectorAll('.slp-key-term').forEach(input => input.value = '');
  renderOptionGroup('slpIntroMethods', simpleLessonPlanState.introMethods, 'intro');
  document.getElementById('slpIntroductionNotes').value = '';
  simpleLessonPlanState.teachingSteps = [
    { key: 'reading', title: 'عبارت کی قرأت', teacher: 'متن پڑھانا', student: 'سننا' },
    { key: 'explanation', title: 'تشریح', teacher: 'وضاحت کرنا', student: 'سوال کرنا' },
    { key: 'examples', title: 'مثالیں', teacher: 'عملی مثالیں دینا', student: 'نوٹ لینا' },
    { key: 'summary', title: 'خلاصہ', teacher: 'نکات بیان کرنا', student: 'دہرانا' }
  ];
  renderTeachingSteps();
  simpleLessonPlanState.selectedStrategies = [];
  renderStrategies();
  renderSelectedActivities();
  document.getElementById('slpApplication').value = '';
  document.getElementById('slpUnderstandingQ1').value = '';
  document.getElementById('slpUnderstandingQ2').value = '';
  document.getElementById('slpAppliedQ1').value = '';
  document.getElementById('slpAppliedQ2').value = '';
  renderOptionGroup('slpSummaryOptions', simpleLessonPlanState.summaryOptions, 'summary', true);
  document.getElementById('slpSummaryDetails').value = '';
  document.getElementById('slpHomework').value = '';
  renderOptionGroup('slpObjectiveStatus', simpleLessonPlanState.objectiveStatuses, 'objectiveStatus');
  renderOptionGroup('slpParticipation', simpleLessonPlanState.participationLevels, 'participation');
  document.getElementById('slpReflectionNotes').value = '';
  document.getElementById('slpLessonTitle').value = '';
  document.getElementById('slpBook').value = '';
  document.getElementById('slpResources').value = '';
}

function populateSimpleLessonPlan(doc) {
  document.getElementById('slpLessonTitle').value = doc.lessonTitle || '';
  document.getElementById('slpBook').value = doc.bookName || doc.book || '';
  document.getElementById('slpResources').value = doc.resources || '';
  renderObjectiveChecks(Array.isArray(doc.learningObjectivesStandard) ? doc.learningObjectivesStandard : []);
  document.getElementById('slpOtherObjective1').value = doc.otherObjectives?.[0] || '';
  document.getElementById('slpOtherObjective2').value = doc.otherObjectives?.[1] || '';
  const keyTerms = Array.isArray(doc.keyTerms) ? doc.keyTerms : [];
  document.querySelectorAll('.slp-key-term').forEach((input, index) => input.value = keyTerms[index] || '');
  renderOptionGroup('slpIntroMethods', simpleLessonPlanState.introMethods, 'intro', true, Array.isArray(doc.introductionMethods) ? doc.introductionMethods : []);
  document.getElementById('slpIntroductionNotes').value = doc.introductionNotes || '';
  if (Array.isArray(doc.teachingSteps) && doc.teachingSteps.length) {
    simpleLessonPlanState.teachingSteps = doc.teachingSteps.slice();
    renderTeachingSteps();
  }
  simpleLessonPlanState.selectedStrategies = Array.isArray(doc.activeStrategies) ? doc.activeStrategies.slice(0, 3) : [];
  renderStrategies();
  renderSelectedActivities();
  document.getElementById('slpApplication').value = doc.application || '';
  document.getElementById('slpUnderstandingQ1').value = doc.understandingQuestions?.[0] || '';
  document.getElementById('slpUnderstandingQ2').value = doc.understandingQuestions?.[1] || '';
  document.getElementById('slpAppliedQ1').value = doc.appliedQuestions?.[0] || '';
  document.getElementById('slpAppliedQ2').value = doc.appliedQuestions?.[1] || '';
  renderOptionGroup('slpSummaryOptions', simpleLessonPlanState.summaryOptions, 'summary', true, Array.isArray(doc.summaryOptions) ? doc.summaryOptions : []);
  document.getElementById('slpSummaryDetails').value = doc.summaryDetails || '';
  document.getElementById('slpHomework').value = doc.homework || '';
  renderOptionGroup('slpObjectiveStatus', simpleLessonPlanState.objectiveStatuses, 'objectiveStatus', false, doc.objectiveStatus || '');
  renderOptionGroup('slpParticipation', simpleLessonPlanState.participationLevels, 'participation', false, doc.participation || '');
  document.getElementById('slpReflectionNotes').value = doc.reflectionNotes || '';
}

function saveSimpleLessonPlan() {
  const data = collectSimpleLessonPlanData();
  if (!data.department || !data.className || !data.subjectId || !data.planDate) {
    alert('شعبہ، کلاس، مضمون اور تاریخ منتخب کریں۔');
    return;
  }
  const btn = document.getElementById('slpSaveBtn');
  const original = btn?.innerText || '';
  if (btn) { btn.disabled = true; btn.innerText = 'محفوظ ہو رہا ہے...'; }
  const docId = simpleLessonPlanState.currentDocId || buildSimpleLessonDocId(data);
  const ref = db.collection('model_lesson_plans').doc(docId);
  const payload = {
    ...data,
    teacherId: simpleLessonPlanState.currentUser?.uid || '',
    teacherName: simpleLessonPlanState.currentUser?.name || simpleLessonPlanState.currentUser?.displayName || '',
    tenantId: typeof getCurrentTenant === 'function' ? getCurrentTenant() : (localStorage.getItem('tenant_id') || 'default'),
    updatedByUid: simpleLessonPlanState.currentUser?.uid || '',
    updatedByName: simpleLessonPlanState.currentUser?.name || simpleLessonPlanState.currentUser?.displayName || '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (!simpleLessonPlanState.currentDoc) {
    payload.createdByUid = simpleLessonPlanState.currentUser?.uid || '';
    payload.createdByName = simpleLessonPlanState.currentUser?.name || simpleLessonPlanState.currentUser?.displayName || '';
    payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
  }
  ref.set(payload, { merge: true }).then(() => {
    simpleLessonPlanState.currentDocId = docId;
    simpleLessonPlanState.currentDoc = { id: docId, ...payload };
    document.getElementById('slpLoadState').innerText = 'منصوبہ کامیابی سے محفوظ ہو گیا۔';
    alert('ماڈل لیسن پلان محفوظ ہو گیا۔');
  }).catch((error) => {
    console.error('Failed to save simple lesson plan', error);
    alert(`محفوظ نہیں ہو سکا: ${error.message}`);
  }).finally(() => {
    if (btn) { btn.disabled = false; btn.innerText = original || 'منصوبہ محفوظ کریں'; }
  });
}

function collectSimpleLessonPlanData() {
  syncSimpleTeachingSteps();
  const context = getSimpleLessonContext();
  const subject = simpleLessonPlanState.selectedSubjectDoc;
  const classDoc = simpleLessonPlanState.selectedClassDoc;
  return {
    ...context,
    department_ur: subject?.department_ur || '',
    classId: classDoc?.id || subject?.classId || '',
    className_ur: classDoc?.name_ur || subject?.className_ur || '',
    subject: subject?.name || '',
    subject_ur: subject?.name_ur || subject?.name || '',
    subjectLabel: subject ? getSubjectDisplayName(subject) : '',
    lessonTitle: document.getElementById('slpLessonTitle')?.value?.trim() || '',
    bookName: document.getElementById('slpBook')?.value?.trim() || '',
    resources: document.getElementById('slpResources')?.value?.trim() || '',
    learningObjectivesStandard: Array.from(document.querySelectorAll('.slp-objective:checked')).map(input => input.value),
    otherObjectives: [document.getElementById('slpOtherObjective1')?.value?.trim() || '', document.getElementById('slpOtherObjective2')?.value?.trim() || ''].filter(Boolean),
    keyTerms: Array.from(document.querySelectorAll('.slp-key-term')).map(input => input.value.trim()).filter(Boolean),
    introductionMethods: getCheckedSimpleOptions('intro'),
    introductionNotes: document.getElementById('slpIntroductionNotes')?.value?.trim() || '',
    teachingSteps: simpleLessonPlanState.teachingSteps.map(step => ({ ...step })),
    activeStrategies: simpleLessonPlanState.selectedStrategies.slice(0, 3),
    selectedActivities: simpleLessonPlanState.selectedStrategies.slice(0, 3),
    application: document.getElementById('slpApplication')?.value?.trim() || '',
    understandingQuestions: [document.getElementById('slpUnderstandingQ1')?.value?.trim() || '', document.getElementById('slpUnderstandingQ2')?.value?.trim() || ''].filter(Boolean),
    appliedQuestions: [document.getElementById('slpAppliedQ1')?.value?.trim() || '', document.getElementById('slpAppliedQ2')?.value?.trim() || ''].filter(Boolean),
    summaryOptions: getCheckedSimpleOptions('summary'),
    summaryDetails: document.getElementById('slpSummaryDetails')?.value?.trim() || '',
    homework: document.getElementById('slpHomework')?.value?.trim() || '',
    objectiveStatus: getSelectedSimpleRadio('objectiveStatus'),
    participation: getSelectedSimpleRadio('participation'),
    reflectionNotes: document.getElementById('slpReflectionNotes')?.value?.trim() || ''
  };
}

function syncSimpleTeachingSteps() {
  simpleLessonPlanState.teachingSteps = Array.from(document.querySelectorAll('#slpTeachingStepsBody tr')).map((row, index) => ({
    key: simpleLessonPlanState.teachingSteps[index]?.key || `step_${index + 1}`,
    student: row.querySelector('.slp-step-student')?.value?.trim() || '',
    teacher: row.querySelector('.slp-step-teacher')?.value?.trim() || '',
    title: row.querySelector('.slp-step-title')?.value?.trim() || ''
  }));
}

function getSimpleLessonContext() {
  return {
    department: document.getElementById('slpDepartment')?.value || '',
    className: document.getElementById('slpClass')?.value || '',
    section: document.getElementById('slpSection')?.value || '',
    subjectId: document.getElementById('slpSubject')?.value || '',
    planDate: document.getElementById('slpDate')?.value || ''
  };
}

function buildSimpleLessonDocId(context) {
  return [context.planDate, context.department, context.className, context.section || 'common', context.subjectId]
    .map((value) => String(value || '').trim().replace(/[\/\\?#%\*:|"<>]/g, '-').replace(/\s+/g, '_'))
    .filter(Boolean)
    .join('__');
}

function getCheckedSimpleOptions(group) {
  return Array.from(document.querySelectorAll(`input[data-option-group="${group}"]:checked`)).map(input => input.dataset.optionValue || '').filter(Boolean);
}

function getSelectedSimpleRadio(group) {
  return document.querySelector(`input[data-option-group="${group}"]:checked`)?.dataset.optionValue || '';
}

function toggleSimpleStrategy(value) {
  const normalized = normalizeSimpleToken(value);
  const exists = simpleLessonPlanState.selectedStrategies.some(item => normalizeSimpleToken(item) === normalized);
  if (exists) {
    simpleLessonPlanState.selectedStrategies = simpleLessonPlanState.selectedStrategies.filter(item => normalizeSimpleToken(item) !== normalized);
    return;
  }
  if (simpleLessonPlanState.selectedStrategies.length >= 3) {
    alert('زیادہ سے زیادہ 3 سرگرمیاں منتخب کی جا سکتی ہیں۔');
    renderStrategies();
    return;
  }
  simpleLessonPlanState.selectedStrategies.push(value);
}

function toggleSingleOption(group, value) {
  const input = document.querySelector(`input[data-option-group="${group}"][data-option-value="${cssEscapeSimple(value)}"]`);
  if (!input || input.type !== 'radio') return;
  document.querySelectorAll(`input[data-option-group="${group}"]`).forEach(item => { item.checked = item === input; });
}

function printSimpleLessonPlan() {
  window.print();
}

function resetSimpleClassSelect() {
  const select = document.getElementById('slpClass');
  if (select) select.innerHTML = '<option value="">کلاس منتخب کریں</option>';
}

function resetSimpleSectionSelect() {
  const select = document.getElementById('slpSection');
  if (select) select.innerHTML = '<option value="">عمومی</option>';
}

function resetSimpleSubjectSelect() {
  const select = document.getElementById('slpSubject');
  if (select) select.innerHTML = '<option value="">مضمون منتخب کریں</option>';
}

function normalizeSimpleSections(value) {
  if (!value) return [];
  const raw = Array.isArray(value) ? value : [value];
  return raw.flatMap(item => String(item || '').split(/[,&/]| and /i)).map(item => String(item || '').trim()).filter(Boolean);
}

function normalizeSimpleToken(value) {
  return String(value || '').trim().toLowerCase();
}

function escapeSimpleHtml(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function cssEscapeSimple(value) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return String(value || '').replace(/"/g, '\\"');
}
