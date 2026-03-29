const studentProfileState = {
  departments: [],
  classes: [],
  students: [],
  currentUser: null,
  selectedClassDoc: null,
  selectedStudentDoc: null,
  currentDocId: '',
  currentDoc: null,
  isParentOnly: false,
  linkedStudentId: '',
  autoMetrics: {
    monthlyWrittenTest: { percentage: 0, count: 0, label: 'ریکارڈ نہیں' },
    midterm: { percentage: 0, count: 0, label: 'ریکارڈ نہیں' },
    finalTerm: { percentage: 0, count: 0, label: 'ریکارڈ نہیں' },
    homework: { percentage: 0, assigned: 0, submitted: 0, label: 'ریکارڈ نہیں' },
    quiz: { percentage: 0, count: 0, label: 'ریکارڈ نہیں' }
  },
  manualCategories: [
    { key: 'assignments', title: 'اسائنمنٹس', placeholder: 'اسائنمنٹس کے معیار یا باقاعدگی کے بارے میں نوٹ' },
    { key: 'classParticipation', title: 'کلاس پارٹیسپیشن / گروپ ڈسکشن', placeholder: 'شرکت اور مباحثے میں کردار' },
    { key: 'speechesDebates', title: 'اسپیچز / مباحثے', placeholder: 'تقریر یا مباحثے میں کارکردگی' },
    { key: 'necessarySkills', title: 'ضروری مہارتیں', placeholder: 'بنیادی مہارتوں کی حالت' },
    { key: 'moralBehaviour', title: 'اخلاقی رویہ', placeholder: 'اخلاق، نظم اور رویے پر تبصرہ' },
    { key: 'games', title: 'کھیل', placeholder: 'کھیل اور جسمانی سرگرمی میں حصہ' }
  ],
  ratingOptions: ['عمدہ', 'درمیانہ', 'مزید توجہ درکار']
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('studentProfileContent')) return;

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  studentProfileState.currentUser = currentUser;
  if (typeof initDashboard === 'function') initDashboard(currentUser);

  const roles = getUserRoles(currentUser);
  const allowed = roles.some(role => role !== 'student');
  document.getElementById('studentProfileAccessDenied').style.display = allowed ? 'none' : '';
  document.getElementById('studentProfileContent').style.display = allowed ? '' : 'none';
  if (!allowed) return;

  studentProfileState.isParentOnly = roles.includes('parent') && !roles.some(role => ['admin', 'owner', 'principal', 'teacher', 'nazim_e_taleemaat', 'hifz_supervisor', 'accountant', 'clerk'].includes(role));
  studentProfileState.linkedStudentId = currentUser.studentId || currentUser.childId || currentUser.linkedStudentId || '';

  const reviewMonth = document.getElementById('spReviewMonth');
  if (reviewMonth && !reviewMonth.value) reviewMonth.value = new Date().toISOString().slice(0, 7);

  renderStudentProfileManualCards();
  bindStudentProfileEvents();
  updateStudentProfileMode();

  if (studentProfileState.isParentOnly) {
    disableStudentProfileEditing();
    await loadParentStudentProfile();
    return;
  }

  await loadStudentProfileDepartments();
});

function bindStudentProfileEvents() {
  document.getElementById('spDepartment')?.addEventListener('change', async () => {
    await updateStudentProfileClasses();
    resetStudentSelect();
  });

  document.getElementById('spClass')?.addEventListener('change', async () => {
    await updateStudentProfileStudents();
  });

  document.getElementById('spLoadBtn')?.addEventListener('click', loadSelectedStudentProfile);
  document.getElementById('spSaveBtn')?.addEventListener('click', saveStudentProfile);
  document.getElementById('spPrintBtn')?.addEventListener('click', () => window.print());
}

function updateStudentProfileMode() {
  const note = document.getElementById('studentProfileModeNote');
  if (!note) return;
  note.innerText = studentProfileState.isParentOnly ? 'والدین کے لیے صرف مشاہدہ' : 'عملے کے لیے قابل تدوین';
}

function disableStudentProfileEditing() {
  document.getElementById('spSaveBtn')?.setAttribute('disabled', 'disabled');
  document.querySelectorAll('#studentProfileContent select, #studentProfileContent input, #studentProfileContent textarea').forEach((el) => {
    if (['spLoadBtn', 'spPrintBtn'].includes(el.id)) return;
    if (el.id === 'spLoadBtn') return;
    el.disabled = true;
  });
}

function renderStudentProfileManualCards() {
  const host = document.getElementById('spManualCards');
  if (!host) return;
  host.innerHTML = studentProfileState.manualCategories.map((category) => `
    <div class="sp-category-card">
      <h4 class="sp-category-title">${escapeStudentProfileHtml(category.title)}</h4>
      <div class="sp-rating-row" id="spRating_${escapeStudentProfileHtml(category.key)}">
        ${studentProfileState.ratingOptions.map((option) => `
          <label class="sp-rating-option">
            <input type="radio" name="spRating_${escapeStudentProfileHtml(category.key)}" value="${escapeStudentProfileHtml(option)}">
            <span>${escapeStudentProfileHtml(option)}</span>
          </label>
        `).join('')}
      </div>
      <div class="form-group" style="margin-top:0.9rem;">
        <label>نوٹ</label>
        <textarea class="sp-textarea" id="spNote_${escapeStudentProfileHtml(category.key)}" placeholder="${escapeStudentProfileHtml(category.placeholder)}"></textarea>
      </div>
    </div>
  `).join('');
}

async function loadStudentProfileDepartments() {
  const select = document.getElementById('spDepartment');
  if (!select) return;
  select.innerHTML = '<option value="">شعبہ منتخب کریں</option>';
  const snapshot = await db.collection('departments').orderBy('name').get();
  studentProfileState.departments = [];
  snapshot.forEach(doc => studentProfileState.departments.push({ id: doc.id, ...(doc.data() || {}) }));
  studentProfileState.departments.forEach((department) => {
    const option = document.createElement('option');
    option.value = department.name || '';
    option.innerText = typeof getDepartmentDisplayName === 'function'
      ? getDepartmentDisplayName(department.name || '', department.name_ur || '')
      : (department.name_ur || department.name || '');
    select.appendChild(option);
  });
  resetClassSelect();
  resetStudentSelect();
}

async function updateStudentProfileClasses() {
  const department = document.getElementById('spDepartment')?.value || '';
  const select = document.getElementById('spClass');
  studentProfileState.classes = [];
  studentProfileState.selectedClassDoc = null;
  select.innerHTML = '<option value="">کلاس منتخب کریں</option>';
  if (!department) return;

  const snapshot = await db.collection('classes').where('department', '==', department).get();
  snapshot.forEach(doc => studentProfileState.classes.push({ id: doc.id, ...(doc.data() || {}) }));
  studentProfileState.classes.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))).forEach((cls) => {
    const option = document.createElement('option');
    option.value = cls.name || '';
    option.innerText = typeof getClassDisplayName === 'function'
      ? getClassDisplayName(cls.name || '', cls.name_ur || '')
      : (cls.name_ur || cls.name || '');
    select.appendChild(option);
  });
}

async function updateStudentProfileStudents() {
  const department = document.getElementById('spDepartment')?.value || '';
  const className = document.getElementById('spClass')?.value || '';
  const select = document.getElementById('spStudent');
  studentProfileState.students = [];
  studentProfileState.selectedStudentDoc = null;
  select.innerHTML = '<option value="">طالب علم منتخب کریں</option>';
  if (!department || !className) return;

  const snapshots = await Promise.allSettled([
    db.collection('students').where('department', '==', department).where('className', '==', className).get(),
    db.collection('students').where('department_ur', '==', getDepartmentDisplayNameSafe(department)).where('className_ur', '==', getClassDisplayNameSafe(className)).get()
  ]);
  const map = new Map();
  snapshots.forEach((result) => {
    if (result.status !== 'fulfilled') return;
    result.value.forEach(doc => {
      if (!map.has(doc.id)) map.set(doc.id, { id: doc.id, ...(doc.data() || {}) });
    });
  });
  studentProfileState.students = Array.from(map.values()).sort((a, b) => getStudentFullName(a).localeCompare(getStudentFullName(b), 'en'));
  studentProfileState.students.forEach((student) => {
    const option = document.createElement('option');
    option.value = student.id;
    option.innerText = `${getStudentFullName(student)}${student.rollNumber ? ` (${student.rollNumber})` : ''}`;
    select.appendChild(option);
  });
}

async function loadParentStudentProfile() {
  const parentBox = document.getElementById('spParentLinkedBox');
  if (parentBox) parentBox.style.display = '';
  document.getElementById('studentProfileSelectors').style.display = 'none';
  if (!studentProfileState.linkedStudentId) {
    if (parentBox) parentBox.innerText = 'اس والدین اکاؤنٹ کے ساتھ کوئی طالب علم لنک نہیں ملا۔';
    document.getElementById('spLoadState').innerText = 'لنک شدہ طالب علم دستیاب نہیں۔';
    return;
  }
  if (parentBox) parentBox.innerText = 'لنک شدہ طالب علم کا محفوظ شدہ پروفائل دکھایا جا رہا ہے۔';

  try {
    const snap = await db.collection('student_profiles').doc(buildStudentProfileDocId(studentProfileState.linkedStudentId)).get();
    if (!snap.exists) {
      document.getElementById('spLoadState').innerText = 'اس طالب علم کا محفوظ شدہ پروفائل ابھی موجود نہیں۔';
      return;
    }
    studentProfileState.currentDoc = { id: snap.id, ...(snap.data() || {}) };
    studentProfileState.currentDocId = snap.id;
    populateStudentProfile(studentProfileState.currentDoc, false);
    document.getElementById('spLoadState').innerText = 'محفوظ شدہ پروفائل لوڈ ہو گیا۔';
  } catch (error) {
    console.error('Error loading parent student profile:', error);
    document.getElementById('spLoadState').innerText = 'پروفائل لوڈ نہ ہو سکا۔';
  }
}

async function loadSelectedStudentProfile() {
  const studentId = document.getElementById('spStudent')?.value || '';
  if (!studentId) {
    alert('طالب علم منتخب کریں۔');
    return;
  }
  const student = studentProfileState.students.find(item => item.id === studentId) || null;
  if (!student) {
    alert('طالب علم کا ریکارڈ نہیں ملا۔');
    return;
  }

  studentProfileState.selectedStudentDoc = student;
  document.getElementById('spLoadState').innerText = 'پروفائل لوڈ ہو رہا ہے...';

  try {
    const docId = buildStudentProfileDocId(studentId);
    const [savedSnap, autoMetrics] = await Promise.all([
      db.collection('student_profiles').doc(docId).get(),
      calculateStudentAutoMetrics(student)
    ]);
    studentProfileState.currentDocId = docId;
    studentProfileState.autoMetrics = autoMetrics;
    studentProfileState.currentDoc = savedSnap.exists ? { id: savedSnap.id, ...(savedSnap.data() || {}) } : null;

    if (studentProfileState.currentDoc) {
      populateStudentProfile(studentProfileState.currentDoc, true);
      document.getElementById('spLoadState').innerText = 'محفوظ شدہ پروفائل اور تازہ اشاریے لوڈ ہو گئے۔';
    } else {
      resetStudentProfileManualFields();
      renderStudentHeader(student, autoMetrics);
      renderStudentAutoMetrics(autoMetrics);
      document.getElementById('spLoadState').innerText = 'نیا پروفائل شروع کیا گیا ہے۔';
    }
  } catch (error) {
    console.error('Error loading student profile:', error);
    document.getElementById('spLoadState').innerText = 'پروفائل لوڈ نہ ہو سکا۔';
    alert('پروفائل لوڈ کرنے میں مسئلہ پیش آیا۔');
  }
}

function populateStudentProfile(doc, overrideAuto) {
  const context = doc.context || {};
  const student = studentProfileState.selectedStudentDoc || {
    id: context.studentId,
    firstName: context.studentName || '',
    lastName: '',
    rollNumber: context.rollNumber || '',
    className: context.className || '',
    className_ur: context.className_ur || '',
    parentName: context.parentName || ''
  };
  if (!overrideAuto) {
    studentProfileState.autoMetrics = doc.autoMetrics || studentProfileState.autoMetrics;
  }
  renderStudentHeader(student, studentProfileState.autoMetrics);
  renderStudentAutoMetrics(studentProfileState.autoMetrics);

  const manual = doc.manualFields || {};
  studentProfileState.manualCategories.forEach((category) => {
    const rating = manual[category.key]?.rating || '';
    const note = manual[category.key]?.note || '';
    document.querySelectorAll(`input[name="spRating_${category.key}"]`).forEach((input) => {
      input.checked = input.value === rating;
    });
    const noteInput = document.getElementById(`spNote_${category.key}`);
    if (noteInput) noteInput.value = note;
  });
  document.getElementById('spOverallObservation').value = doc.overallObservation || '';
  document.getElementById('spImprovementPlan').value = doc.improvementPlan || '';
}

function renderStudentHeader(student, autoMetrics) {
  document.getElementById('spStudentNameDisplay').innerText = getStudentFullName(student) || '-';
  document.getElementById('spRollNoDisplay').innerText = student.rollNumber || '-';
  document.getElementById('spClassDisplay').innerText = typeof getClassDisplayName === 'function'
    ? getClassDisplayName(student.className || '', student.className_ur || '')
    : (student.className_ur || student.className || '-');
  document.getElementById('spParentDisplay').innerText = student.parentName || '-';
}

function renderStudentAutoMetrics(metrics) {
  setMetric('Monthly', metrics.monthlyWrittenTest);
  setMetric('Midterm', metrics.midterm);
  setMetric('Final', metrics.finalTerm);
  setMetric('Homework', metrics.homework);
  setMetric('Quiz', metrics.quiz);
}

function setMetric(suffix, metric) {
  document.getElementById(`spMetric${suffix}`).innerText = `${metric?.percentage ?? 0}%`;
  document.getElementById(`spMetric${suffix}Meta`).innerText = metric?.label || '-';
}

function resetStudentProfileManualFields() {
  studentProfileState.manualCategories.forEach((category) => {
    document.querySelectorAll(`input[name="spRating_${category.key}"]`).forEach((input) => { input.checked = false; });
    const noteInput = document.getElementById(`spNote_${category.key}`);
    if (noteInput) noteInput.value = '';
  });
  document.getElementById('spOverallObservation').value = '';
  document.getElementById('spImprovementPlan').value = '';
}

async function calculateStudentAutoMetrics(student) {
  const department = student.department || document.getElementById('spDepartment')?.value || '';
  const className = student.className || document.getElementById('spClass')?.value || '';
  const reviewMonth = document.getElementById('spReviewMonth')?.value || '';
  const [gradesMetric, homeworkMetric] = await Promise.all([
    calculateGradeBasedMetrics(student.id, department, className, reviewMonth),
    calculateHomeworkMetric(student.id, department, className, reviewMonth)
  ]);
  return {
    monthlyWrittenTest: gradesMetric.monthlyWrittenTest,
    midterm: gradesMetric.midterm,
    finalTerm: gradesMetric.finalTerm,
    quiz: gradesMetric.quiz,
    homework: homeworkMetric
  };
}

async function calculateGradeBasedMetrics(studentId, department, className, reviewMonth) {
  const metrics = {
    monthlyWrittenTest: { percentage: 0, count: 0, label: 'ریکارڈ نہیں' },
    midterm: { percentage: 0, count: 0, label: 'ریکارڈ نہیں' },
    finalTerm: { percentage: 0, count: 0, label: 'ریکارڈ نہیں' },
    quiz: { percentage: 0, count: 0, label: 'ریکارڈ نہیں' }
  };
  let snapshot;
  try {
    snapshot = await db.collection('grades').where('department', '==', department).where('className', '==', className).get();
  } catch (error) {
    console.warn('Grades query failed for student profile:', error);
    return metrics;
  }

  const buckets = {
    monthlyWrittenTest: [],
    midterm: [],
    finalTerm: [],
    quiz: []
  };

  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    if (reviewMonth && data.date && !String(data.date).startsWith(reviewMonth)) return;
    const records = Array.isArray(data.records) ? data.records : [];
    const record = records.find((item) => String(item.uid || item.studentId || '') === String(studentId));
    if (!record) return;
    const obtained = Number(record.obtained ?? record.marksObtained ?? 0);
    const total = Number(record.total ?? record.totalMarks ?? 0);
    if (!total) return;
    const percentage = Math.round((obtained / total) * 100);
    const examName = String(data.examName || data.title || '').toLowerCase();
    if (examName.includes('quiz') || examName.includes('کوئز')) buckets.quiz.push(percentage);
    else if (examName.includes('final') || examName.includes('فائنل')) buckets.finalTerm.push(percentage);
    else if (examName.includes('mid') || examName.includes('مڈ')) buckets.midterm.push(percentage);
    else if (examName.includes('monthly') || examName.includes('written') || examName.includes('ماہانہ') || examName.includes('تحریری')) buckets.monthlyWrittenTest.push(percentage);
  });

  Object.keys(buckets).forEach((key) => {
    const list = buckets[key];
    if (!list.length) return;
    const avg = Math.round(list.reduce((sum, value) => sum + value, 0) / list.length);
    metrics[key] = { percentage: avg, count: list.length, label: `${list.length} ریکارڈ` };
  });
  return metrics;
}

async function calculateHomeworkMetric(studentId, department, className, reviewMonth) {
  const metric = { percentage: 0, assigned: 0, submitted: 0, label: 'ریکارڈ نہیں' };
  let homeworkSnap;
  try {
    homeworkSnap = await db.collection('homework').where('department', '==', department).where('className', '==', className).get();
  } catch (error) {
    console.warn('Homework query failed for student profile:', error);
    return metric;
  }

  let assignedDocs = homeworkSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }));
  if (reviewMonth) {
    assignedDocs = assignedDocs.filter(item => String(item.dueDate || '').startsWith(reviewMonth));
  }
  metric.assigned = assignedDocs.length;

  let submissionCount = 0;
  try {
    const [byStudent, byUid] = await Promise.allSettled([
      db.collection('homework_submissions').where('studentId', '==', studentId).get(),
      db.collection('homework_submissions').where('uid', '==', studentId).get()
    ]);
    const submissions = new Map();
    [byStudent, byUid].forEach((result) => {
      if (result.status !== 'fulfilled') return;
      result.value.forEach(doc => submissions.set(doc.id, { id: doc.id, ...(doc.data() || {}) }));
    });
    const relevantHomeworkIds = new Set(assignedDocs.map(item => item.id));
    submissionCount = Array.from(submissions.values()).filter(sub => {
      const hwId = sub.homeworkId || sub.hwId || '';
      const dateStr = String(sub.submittedAt || sub.date || '');
      if (reviewMonth && dateStr && !dateStr.startsWith(reviewMonth)) return false;
      return !relevantHomeworkIds.size || relevantHomeworkIds.has(hwId);
    }).length;
  } catch (error) {
    console.warn('Homework submissions query failed for student profile:', error);
  }

  metric.submitted = submissionCount;
  metric.percentage = metric.assigned ? Math.round((submissionCount / metric.assigned) * 100) : 0;
  metric.label = metric.assigned ? `${submissionCount} / ${metric.assigned} جمع` : 'ہوم ورک ریکارڈ نہیں';
  return metric;
}

async function saveStudentProfile() {
  if (studentProfileState.isParentOnly) return;
  const student = studentProfileState.selectedStudentDoc;
  if (!student) {
    alert('پہلے طالب علم منتخب کر کے پروفائل لوڈ کریں۔');
    return;
  }
  const btn = document.getElementById('spSaveBtn');
  if (btn) btn.disabled = true;
  document.getElementById('spLoadState').innerText = 'پروفائل محفوظ ہو رہا ہے...';

  try {
    const autoMetrics = await calculateStudentAutoMetrics(student);
    studentProfileState.autoMetrics = autoMetrics;
    renderStudentAutoMetrics(autoMetrics);
    const payload = buildStudentProfilePayload(student, autoMetrics);
    const docId = buildStudentProfileDocId(student.id);
    await db.collection('student_profiles').doc(docId).set(payload, { merge: true });
    studentProfileState.currentDocId = docId;
    studentProfileState.currentDoc = { id: docId, ...payload };
    document.getElementById('spLoadState').innerText = 'پروفائل کامیابی سے محفوظ ہو گیا۔';
  } catch (error) {
    console.error('Error saving student profile:', error);
    document.getElementById('spLoadState').innerText = 'پروفائل محفوظ نہ ہو سکا۔';
    alert('پروفائل محفوظ کرنے میں مسئلہ پیش آیا۔');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function buildStudentProfilePayload(student, autoMetrics) {
  const className = student.className || document.getElementById('spClass')?.value || '';
  const department = student.department || document.getElementById('spDepartment')?.value || '';
  const classDoc = studentProfileState.classes.find(item => item.name === className) || {};
  const context = {
    studentId: student.id,
    studentName: getStudentFullName(student),
    rollNumber: student.rollNumber || '',
    department,
    department_ur: getDepartmentDisplayNameSafe(department),
    className,
    className_ur: typeof getClassDisplayName === 'function' ? getClassDisplayName(className, student.className_ur || classDoc.name_ur || '') : (student.className_ur || classDoc.name_ur || className),
    reviewMonth: document.getElementById('spReviewMonth')?.value || '',
    parentName: student.parentName || ''
  };

  const manualFields = {};
  studentProfileState.manualCategories.forEach((category) => {
    const rating = document.querySelector(`input[name="spRating_${category.key}"]:checked`)?.value || '';
    const note = document.getElementById(`spNote_${category.key}`)?.value?.trim() || '';
    manualFields[category.key] = { rating, note };
  });

  return {
    context,
    autoMetrics,
    manualFields,
    overallObservation: document.getElementById('spOverallObservation')?.value?.trim() || '',
    improvementPlan: document.getElementById('spImprovementPlan')?.value?.trim() || '',
    teacherId: studentProfileState.currentUser?.uid || '',
    teacherName: studentProfileState.currentUser?.name || studentProfileState.currentUser?.displayName || '',
    tenantId: studentProfileState.currentUser?.tenantId || localStorage.getItem('tenantId') || '',
    updatedByUid: studentProfileState.currentUser?.uid || '',
    updatedByName: studentProfileState.currentUser?.name || studentProfileState.currentUser?.displayName || '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdAt: studentProfileState.currentDoc ? (studentProfileState.currentDoc.createdAt || firebase.firestore.FieldValue.serverTimestamp()) : firebase.firestore.FieldValue.serverTimestamp()
  };
}

function buildStudentProfileDocId(studentId) {
  return `student_profile__${normalizeStudentProfileToken(studentId)}`;
}

function resetClassSelect() {
  const select = document.getElementById('spClass');
  if (select) select.innerHTML = '<option value="">کلاس منتخب کریں</option>';
}

function resetStudentSelect() {
  const select = document.getElementById('spStudent');
  if (select) select.innerHTML = '<option value="">طالب علم منتخب کریں</option>';
}

function getStudentFullName(student) {
  return String(`${student?.firstName || ''} ${student?.lastName || ''}`).trim() || student?.name || student?.studentName || student?.email || student?.id || '';
}

function getDepartmentDisplayNameSafe(value) {
  const department = studentProfileState.departments.find(item => item.name === value) || {};
  return typeof getDepartmentDisplayName === 'function' ? getDepartmentDisplayName(value || '', department.name_ur || '') : (department.name_ur || value || '');
}

function getClassDisplayNameSafe(value) {
  const cls = studentProfileState.classes.find(item => item.name === value) || {};
  return typeof getClassDisplayName === 'function' ? getClassDisplayName(value || '', cls.name_ur || '') : (cls.name_ur || value || '');
}

function normalizeStudentProfileToken(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/gi, '_').replace(/^_+|_+$/g, '');
}

function escapeStudentProfileHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
