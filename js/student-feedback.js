const studentFeedbackConfig = {
  methodology: {
    key: 'methodology',
    title: 'حصہ اول: تدریسی طریقۂ کار',
    subtitle: 'ہر سوال کے لیے ایک مناسب جواب منتخب کریں۔',
    options: [
      { value: 'always', label: 'ہمیشہ', score: 4 },
      { value: 'often', label: 'اکثر', score: 3 },
      { value: 'sometimes', label: 'کبھی کبھی', score: 2 },
      { value: 'never', label: 'کبھی نہیں', score: 1 }
    ],
    questions: [
      { id: 'q1', text: 'کیا استاد سبق کو آسان اور قابلِ فہم انداز میں سمجھاتے ہیں؟' },
      { id: 'q2', text: 'کیا استاد بورڈ، ویڈیوز یا دیگر وسائل مؤثر طریقے سے استعمال کرتے ہیں؟' },
      { id: 'q3', text: 'کیا استاد کلاس میں سوالات پوچھنے کی حوصلہ افزائی کرتے ہیں؟' },
      { id: 'q4', text: 'کیا استاد ہمیں صرف سننے کے بجائے گفتگو اور بات چیت میں شامل کرتے ہیں؟' },
      { id: 'q5', text: 'کیا استاد مشکل تصورات کو سمجھانے کے لیے مثالیں دیتے ہیں؟' }
    ]
  },
  academics: {
    key: 'academics',
    title: 'حصہ دوم: تعلیمی سرگرمیاں اور اسائنمنٹس',
    subtitle: 'کلاس کی عملی سرگرمیوں اور تعلیمی مشقوں کے بارے میں رائے دیں۔',
    options: [
      { value: 'yes', label: 'ہاں', score: 3 },
      { value: 'partial', label: 'کسی حد تک', score: 2 },
      { value: 'no', label: 'نہیں', score: 1 }
    ],
    questions: [
      { id: 'q6', text: 'کیا دی جانے والی اسائنمنٹس اور سرگرمیاں مفید اور بامقصد محسوس ہوتی ہیں؟' },
      { id: 'q7', text: 'کیا استاد آپ کی اسائنمنٹس یا مشقوں کو چیک کر کے رہنمائی دیتے ہیں؟' },
      { id: 'q8', text: 'کیا کلاس میں پریزنٹیشن، مباحثہ یا دیگر سرگرمیاں کروائی جاتی ہیں؟' },
      { id: 'q9', text: 'کیا ہوم ورک اور کلاس ورک پر بروقت بات اور رہنمائی ہوتی ہے؟' }
    ]
  },
  behavior: {
    key: 'behavior',
    title: 'حصہ سوم: استاد کا رویہ اور اخلاقیات',
    subtitle: 'استاد کے عمومی رویے اور طلبہ کے ساتھ برتاؤ کے بارے میں رائے دیں۔',
    options: [
      { value: 'excellent', label: 'بہترین', score: 4 },
      { value: 'good', label: 'اچھا', score: 3 },
      { value: 'average', label: 'اوسط', score: 2 },
      { value: 'unsatisfactory', label: 'غیر تسلی بخش', score: 1 }
    ],
    questions: [
      { id: 'q10', text: 'استاد کا طلبہ کے ساتھ عمومی رویہ کیسا ہے؟' },
      { id: 'q11', text: 'کیا استاد تمام طلبہ کے ساتھ برابری کا سلوک کرتے ہیں؟' }
    ]
  }
};

const studentFeedbackState = {
  currentUser: null,
  roles: [],
  mode: 'denied',
  studentDoc: null,
  subjects: [],
  currentSubject: null,
  currentResponseDocId: '',
  adminDepartments: [],
  adminClasses: [],
  adminSubjects: []
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('sfbAccessDenied')) return;

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  studentFeedbackState.currentUser = currentUser;
  studentFeedbackState.roles = getUserRoles(currentUser);
  if (typeof initDashboard === 'function') initDashboard(currentUser);

  determineStudentFeedbackMode();
  renderStudentFeedbackSections();

  if (studentFeedbackState.mode === 'denied') {
    document.getElementById('sfbAccessDenied').style.display = '';
    return;
  }

  if (studentFeedbackState.mode === 'student') {
    document.getElementById('sfbStudentContent').style.display = '';
    bindStudentFeedbackStudentEvents();
    await initializeStudentFeedbackStudentMode();
    return;
  }

  document.getElementById('sfbAdminContent').style.display = '';
  bindStudentFeedbackAdminEvents();
  await initializeStudentFeedbackAdminMode();
});

function determineStudentFeedbackMode() {
  const roles = studentFeedbackState.roles;
  const isAdminMode = roles.some(role => ['admin', 'owner'].includes(role));
  const isStudentMode = roles.includes('student');

  if (isAdminMode) {
    studentFeedbackState.mode = 'admin';
  } else if (isStudentMode) {
    studentFeedbackState.mode = 'student';
  } else {
    studentFeedbackState.mode = 'denied';
  }
}

function renderStudentFeedbackSections() {
  const host = document.getElementById('sfbQuestionSections');
  if (!host) return;

  const blocks = Object.values(studentFeedbackConfig).map((section, sectionIndex) => `
    <div class="sfb-section-block" style="margin-bottom:1rem;">
      <div class="sfb-section-header">
        <h4>${escapeStudentFeedbackHtml(section.title)}</h4>
        <p>${escapeStudentFeedbackHtml(section.subtitle)}</p>
      </div>
      <div class="sfb-table-wrap">
        <table class="sfb-table">
          <thead>
            <tr>
              <th style="width:72px;">نمبر</th>
              <th>سوال</th>
              <th style="width:420px;">جواب</th>
            </tr>
          </thead>
          <tbody>
            ${section.questions.map((question, questionIndex) => `
              <tr>
                <td>${String(question.id || '').replace('q', '')}</td>
                <td class="sfb-question-text">${escapeStudentFeedbackHtml(question.text)}</td>
                <td>
                  <div class="sfb-radio-row">
                    ${section.options.map((option) => `
                      <label class="sfb-radio">
                        <input type="radio" name="${escapeStudentFeedbackHtml(question.id)}" value="${escapeStudentFeedbackHtml(option.value)}">
                        <span>${escapeStudentFeedbackHtml(option.label)}</span>
                      </label>
                    `).join('')}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `);

  host.innerHTML = blocks.join('');
}

function bindStudentFeedbackStudentEvents() {
  document.getElementById('sfbSubjectSelect')?.addEventListener('change', handleStudentFeedbackSubjectChange);
  document.getElementById('sfbDateInput')?.addEventListener('change', handleStudentFeedbackDateChange);
  document.getElementById('sfbSubmitBtn')?.addEventListener('click', saveStudentFeedbackResponse);
  document.getElementById('sfbResetBtn')?.addEventListener('click', () => {
    clearStudentFeedbackResponses(true);
    updateStudentFeedbackState('جوابات صاف کر دیے گئے۔');
  });
}

function bindStudentFeedbackAdminEvents() {
  document.getElementById('sfbAdminDepartment')?.addEventListener('change', async () => {
    await populateStudentFeedbackAdminClasses();
    await populateStudentFeedbackAdminSubjects();
  });
  document.getElementById('sfbAdminClass')?.addEventListener('change', populateStudentFeedbackAdminSubjects);
  document.getElementById('sfbAdminSubject')?.addEventListener('change', populateStudentFeedbackAdminTeachers);
  document.getElementById('sfbAdminLoadBtn')?.addEventListener('click', loadStudentFeedbackAdminAnalysis);
}

async function initializeStudentFeedbackStudentMode() {
  const today = new Date().toISOString().slice(0, 10);
  const dateInput = document.getElementById('sfbDateInput');
  if (dateInput && !dateInput.value) dateInput.value = today;
  document.getElementById('sfbFeedbackDateDisplay').innerText = formatStudentFeedbackDate(today);

  try {
    updateStudentFeedbackState('آپ کی معلومات لوڈ ہو رہی ہیں...');
    await loadStudentFeedbackStudentDoc();
    await loadStudentFeedbackSubjects();
    updateStudentFeedbackState('اپنے مضمون کا انتخاب کریں۔');
  } catch (error) {
    console.error('Student feedback init failed:', error);
    updateStudentFeedbackState('طالب علم کی معلومات لوڈ نہ ہو سکیں۔');
    alert('فیڈبیک فارم لوڈ نہ ہو سکا۔');
  }
}

async function loadStudentFeedbackStudentDoc() {
  const uid = auth?.currentUser?.uid || studentFeedbackState.currentUser?.uid;
  if (!uid) throw new Error('Student UID missing');

  let snap = await db.collection('students').doc(uid).get();
  if (!snap.exists) {
    const fallback = await db.collection('students').where('userId', '==', uid).limit(1).get();
    snap = fallback.empty ? snap : fallback.docs[0];
  }
  if (!snap.exists) throw new Error('Student record not found');

  studentFeedbackState.studentDoc = { id: snap.id, ...(snap.data() || {}) };
  const student = studentFeedbackState.studentDoc;
  document.getElementById('sfbStudentNameDisplay').innerText = getStudentFeedbackFullName(student) || '—';
  document.getElementById('sfbStudentClassDisplay').innerText = student.className_ur || student.className || '—';
  document.getElementById('sfbStudentDepartmentDisplay').innerText = student.department_ur || student.department || '—';
  document.getElementById('sfbStudentRollDisplay').innerText = student.rollNumber || '—';
}

async function loadStudentFeedbackSubjects() {
  const select = document.getElementById('sfbSubjectSelect');
  if (!select) return;
  select.innerHTML = '<option value="">مضمون منتخب کریں</option>';

  const student = studentFeedbackState.studentDoc;
  if (!student?.className) return;

  const snapshot = await db.collection('subjects').where('className', '==', student.className).get();
  studentFeedbackState.subjects = [];
  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    if (student.department && data.department && data.department !== student.department) return;
    if (!String(data.teacherName || '').trim()) return;
    studentFeedbackState.subjects.push({ id: doc.id, ...data });
  });

  studentFeedbackState.subjects.sort((a, b) => {
    const labelA = typeof getSubjectDisplayName === 'function' ? getSubjectDisplayName(a) : (a.name_ur || a.name || '');
    const labelB = typeof getSubjectDisplayName === 'function' ? getSubjectDisplayName(b) : (b.name_ur || b.name || '');
    return labelA.localeCompare(labelB, 'ur');
  });

  studentFeedbackState.subjects.forEach((subject) => {
    const option = document.createElement('option');
    option.value = subject.id;
    option.innerText = typeof getSubjectDisplayName === 'function'
      ? getSubjectDisplayName(subject)
      : (subject.name_ur || subject.name || subject.book || '');
    select.appendChild(option);
  });
}

async function handleStudentFeedbackSubjectChange() {
  const subjectId = document.getElementById('sfbSubjectSelect')?.value || '';
  studentFeedbackState.currentSubject = studentFeedbackState.subjects.find(item => item.id === subjectId) || null;
  updateStudentFeedbackSubjectFields();
  await loadExistingStudentFeedbackResponse();
}

async function handleStudentFeedbackDateChange() {
  const dateValue = document.getElementById('sfbDateInput')?.value || '';
  document.getElementById('sfbFeedbackDateDisplay').innerText = dateValue ? formatStudentFeedbackDate(dateValue) : '—';
  await loadExistingStudentFeedbackResponse();
}

function updateStudentFeedbackSubjectFields() {
  const subject = studentFeedbackState.currentSubject;
  document.getElementById('sfbTeacherName').value = subject?.teacherName || '';
  document.getElementById('sfbTermDisplay').value = subject?.term ? getSubjectTermLabel(subject.term) : '';
  document.getElementById('sfbBookDisplay').value = subject?.book || '';
}

async function loadExistingStudentFeedbackResponse() {
  const student = studentFeedbackState.studentDoc;
  const subject = studentFeedbackState.currentSubject;
  const dateValue = document.getElementById('sfbDateInput')?.value || '';
  if (!student?.id || !subject?.id || !dateValue) {
    studentFeedbackState.currentResponseDocId = '';
    clearStudentFeedbackResponses(true);
    return;
  }

  const docId = buildStudentFeedbackDocId(student.id, subject.id, dateValue);
  studentFeedbackState.currentResponseDocId = docId;
  clearStudentFeedbackResponses(true);
  updateStudentFeedbackState('پچھلا محفوظ شدہ فیڈبیک چیک کیا جا رہا ہے...');

  try {
    const snap = await db.collection('student_feedback_responses').doc(docId).get();
    if (!snap.exists) {
      updateStudentFeedbackState('نیا فیڈبیک فارم تیار ہے۔');
      return;
    }

    const data = snap.data() || {};
    populateStudentFeedbackAnswers(data.answers || {});
    document.getElementById('sfbSuggestionTeaching').value = data.suggestions?.teaching || '';
    document.getElementById('sfbSuggestionActiveLearning').value = data.suggestions?.activeLearning || '';
    updateStudentFeedbackState('اس مضمون اور تاریخ کے لیے سابقہ فیڈبیک لوڈ ہو گیا۔');
  } catch (error) {
    console.error('Existing student feedback load failed:', error);
    updateStudentFeedbackState('پچھلا فیڈبیک لوڈ نہ ہو سکا۔');
  }
}

function populateStudentFeedbackAnswers(answers) {
  Object.entries(answers || {}).forEach(([questionId, value]) => {
    const input = document.querySelector(`input[name="${cssEscapeStudentFeedback(questionId)}"][value="${cssEscapeStudentFeedback(value)}"]`);
    if (input) input.checked = true;
  });
}

function clearStudentFeedbackResponses(resetSuggestions) {
  document.querySelectorAll('#sfbQuestionSections input[type="radio"]').forEach((input) => { input.checked = false; });
  if (resetSuggestions) {
    document.getElementById('sfbSuggestionTeaching').value = '';
    document.getElementById('sfbSuggestionActiveLearning').value = '';
  }
}

function collectStudentFeedbackAnswers() {
  const answers = {};
  const missing = [];

  Object.values(studentFeedbackConfig).forEach((section) => {
    section.questions.forEach((question) => {
      const selected = document.querySelector(`input[name="${cssEscapeStudentFeedback(question.id)}"]:checked`);
      if (!selected) {
        missing.push(question.id);
      } else {
        answers[question.id] = selected.value;
      }
    });
  });

  return { answers, missing };
}

async function saveStudentFeedbackResponse() {
  const student = studentFeedbackState.studentDoc;
  const subject = studentFeedbackState.currentSubject;
  const dateValue = document.getElementById('sfbDateInput')?.value || '';

  if (!student?.id) {
    alert('طالب علم کی معلومات دستیاب نہیں۔');
    return;
  }
  if (!subject?.id) {
    alert('مضمون منتخب کریں۔');
    return;
  }
  if (!String(subject.teacherName || '').trim()) {
    alert('اس مضمون کے ساتھ استاد متعین نہیں۔');
    return;
  }
  if (!dateValue) {
    alert('تاریخ منتخب کریں۔');
    return;
  }

  const { answers, missing } = collectStudentFeedbackAnswers();
  if (missing.length) {
    alert('براہِ کرم تمام سوالات مکمل کریں۔');
    return;
  }

  const teachingSuggestion = (document.getElementById('sfbSuggestionTeaching')?.value || '').trim();
  const activeLearningSuggestion = (document.getElementById('sfbSuggestionActiveLearning')?.value || '').trim();
  const analytics = computeStudentFeedbackAnalytics(answers);
  const docId = studentFeedbackState.currentResponseDocId || buildStudentFeedbackDocId(student.id, subject.id, dateValue);

  const payload = {
    studentId: student.id,
    studentName: getStudentFeedbackFullName(student),
    rollNumber: student.rollNumber || '',
    department: student.department || '',
    department_ur: student.department_ur || (typeof getDepartmentDisplayName === 'function' ? getDepartmentDisplayName(student.department || '') : ''),
    className: student.className || '',
    className_ur: student.className_ur || (typeof getClassDisplayName === 'function' ? getClassDisplayName(student.className || '') : ''),
    subjectId: subject.id,
    subjectName: subject.name || '',
    subjectName_ur: subject.name_ur || subject.name || '',
    subjectLabel: typeof getSubjectDisplayName === 'function' ? getSubjectDisplayName(subject) : (subject.name_ur || subject.name || ''),
    teacherId: subject.teacherId || '',
    teacherName: subject.teacherName || '',
    term: subject.term || '',
    book: subject.book || '',
    feedbackDate: dateValue,
    feedbackMonth: dateValue.slice(0, 7),
    answers,
    suggestions: {
      teaching: teachingSuggestion,
      activeLearning: activeLearningSuggestion
    },
    analytics,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    updateStudentFeedbackState('فیڈبیک محفوظ ہو رہا ہے...');
    const ref = db.collection('student_feedback_responses').doc(docId);
    const existing = await ref.get();
    if (!existing.exists) payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    await ref.set(payload, { merge: true });
    updateStudentFeedbackState('فیڈبیک کامیابی سے محفوظ ہو گیا۔');
    document.getElementById('sfbStudentStickyState').innerText = 'آپ کا فیڈبیک محفوظ ہو گیا۔';
  } catch (error) {
    console.error('Student feedback save failed:', error);
    updateStudentFeedbackState('فیڈبیک محفوظ نہ ہو سکا۔');
    alert('فیڈبیک محفوظ کرنے میں مسئلہ پیش آیا۔');
  }
}

function computeStudentFeedbackAnalytics(answers) {
  const sectionSummaries = {};
  let totalScore = 0;
  let totalMax = 0;

  Object.values(studentFeedbackConfig).forEach((section) => {
    let score = 0;
    let max = 0;
    section.questions.forEach((question) => {
      const option = section.options.find(item => item.value === answers[question.id]);
      if (option) {
        score += option.score;
        max += section.options[0].score;
      }
    });
    sectionSummaries[section.key] = {
      score,
      max,
      percentage: max ? Math.round((score / max) * 100) : 0
    };
    totalScore += score;
    totalMax += max;
  });

  return {
    sections: sectionSummaries,
    totalScore,
    totalMax,
    totalPercentage: totalMax ? Math.round((totalScore / totalMax) * 100) : 0
  };
}

async function initializeStudentFeedbackAdminMode() {
  const monthInput = document.getElementById('sfbAdminMonth');
  if (monthInput && !monthInput.value) monthInput.value = new Date().toISOString().slice(0, 7);
  await Promise.all([populateStudentFeedbackAdminDepartments(), populateStudentFeedbackAdminSubjects()]);
  updateStudentFeedbackAdminState('فلٹرز منتخب کر کے تجزیہ لوڈ کریں۔');
}

async function populateStudentFeedbackAdminDepartments() {
  const select = document.getElementById('sfbAdminDepartment');
  if (!select) return;
  select.innerHTML = '<option value="">تمام شعبے</option>';
  const snapshot = await db.collection('departments').orderBy('name').get();
  studentFeedbackState.adminDepartments = [];
  snapshot.forEach((doc) => studentFeedbackState.adminDepartments.push({ id: doc.id, ...(doc.data() || {}) }));
  studentFeedbackState.adminDepartments.forEach((department) => {
    const option = document.createElement('option');
    option.value = department.name || '';
    option.innerText = typeof getDepartmentDisplayName === 'function'
      ? getDepartmentDisplayName(department.name || '', department.name_ur || '')
      : (department.name_ur || department.name || '');
    select.appendChild(option);
  });
  await populateStudentFeedbackAdminClasses();
}

async function populateStudentFeedbackAdminClasses() {
  const select = document.getElementById('sfbAdminClass');
  if (!select) return;
  select.innerHTML = '<option value="">تمام کلاسیں</option>';
  const department = document.getElementById('sfbAdminDepartment')?.value || '';
  let snapshot = null;
  if (department) {
    snapshot = await db.collection('classes').where('department', '==', department).get();
  } else {
    snapshot = await db.collection('classes').get();
  }
  const classes = [];
  snapshot.forEach((doc) => classes.push({ id: doc.id, ...(doc.data() || {}) }));
  classes.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'en')).forEach((cls) => {
    const option = document.createElement('option');
    option.value = cls.name || '';
    option.innerText = typeof getClassDisplayName === 'function'
      ? getClassDisplayName(cls.name || '', cls.name_ur || '')
      : (cls.name_ur || cls.name || '');
    select.appendChild(option);
  });
}

async function populateStudentFeedbackAdminSubjects() {
  const select = document.getElementById('sfbAdminSubject');
  if (!select) return;
  select.innerHTML = '<option value="">تمام مضامین</option>';

  const department = document.getElementById('sfbAdminDepartment')?.value || '';
  const className = document.getElementById('sfbAdminClass')?.value || '';
  let snapshot = null;
  if (className) {
    snapshot = await db.collection('subjects').where('className', '==', className).get();
  } else if (department) {
    snapshot = await db.collection('subjects').where('department', '==', department).get();
  } else {
    snapshot = await db.collection('subjects').get();
  }

  const subjectMap = new Map();
  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    if (department && data.department && data.department !== department) return;
    subjectMap.set(doc.id, { id: doc.id, ...data });
  });
  studentFeedbackState.adminSubjects = Array.from(subjectMap.values());
  studentFeedbackState.adminSubjects.sort((a, b) => {
    const labelA = typeof getSubjectDisplayName === 'function' ? getSubjectDisplayName(a) : (a.name_ur || a.name || '');
    const labelB = typeof getSubjectDisplayName === 'function' ? getSubjectDisplayName(b) : (b.name_ur || b.name || '');
    return labelA.localeCompare(labelB, 'ur');
  }).forEach((subject) => {
    const option = document.createElement('option');
    option.value = subject.id;
    option.innerText = typeof getSubjectDisplayName === 'function'
      ? getSubjectDisplayName(subject)
      : (subject.name_ur || subject.name || '');
    select.appendChild(option);
  });
  populateStudentFeedbackAdminTeachers();
}

function populateStudentFeedbackAdminTeachers() {
  const select = document.getElementById('sfbAdminTeacher');
  if (!select) return;
  const subjectId = document.getElementById('sfbAdminSubject')?.value || '';
  const selectedSubject = studentFeedbackState.adminSubjects.find(item => item.id === subjectId) || null;
  const teacherMap = new Map();

  if (selectedSubject?.teacherName) {
    teacherMap.set(selectedSubject.teacherName, selectedSubject.teacherName);
  } else {
    studentFeedbackState.adminSubjects.forEach((subject) => {
      if (subject.teacherName) teacherMap.set(subject.teacherName, subject.teacherName);
    });
  }

  select.innerHTML = '<option value="">تمام اساتذہ</option>';
  Array.from(teacherMap.keys()).sort((a, b) => a.localeCompare(b, 'en')).forEach((teacherName) => {
    const option = document.createElement('option');
    option.value = teacherName;
    option.innerText = teacherName;
    select.appendChild(option);
  });
}

async function loadStudentFeedbackAdminAnalysis() {
  try {
    updateStudentFeedbackAdminState('فیڈبیک تجزیہ لوڈ ہو رہا ہے...');
    const snapshot = await db.collection('student_feedback_responses').get();
    let responses = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
    responses = filterStudentFeedbackResponses(responses);
    renderStudentFeedbackAdminAnalysis(responses);
    updateStudentFeedbackAdminState(`${responses.length} فیڈبیک ریکارڈز سے تجزیہ تیار ہو گیا۔`);
  } catch (error) {
    console.error('Student feedback admin analysis failed:', error);
    updateStudentFeedbackAdminState('تجزیہ لوڈ نہ ہو سکا۔');
    renderStudentFeedbackAdminAnalysis([]);
  }
}

function filterStudentFeedbackResponses(responses) {
  const department = document.getElementById('sfbAdminDepartment')?.value || '';
  const className = document.getElementById('sfbAdminClass')?.value || '';
  const subjectId = document.getElementById('sfbAdminSubject')?.value || '';
  const teacherName = document.getElementById('sfbAdminTeacher')?.value || '';
  const month = document.getElementById('sfbAdminMonth')?.value || '';

  return responses.filter((response) => {
    if (department && response.department !== department) return false;
    if (className && response.className !== className) return false;
    if (subjectId && response.subjectId !== subjectId) return false;
    if (teacherName && response.teacherName !== teacherName) return false;
    if (month && response.feedbackMonth !== month) return false;
    return true;
  });
}

function renderStudentFeedbackAdminAnalysis(responses) {
  const summary = aggregateStudentFeedbackResponses(responses);
  document.getElementById('sfbResponsesCount').innerText = String(responses.length || 0);
  document.getElementById('sfbMethodologyAvg').innerText = `${summary.sectionPercentages.methodology}%`;
  document.getElementById('sfbActivitiesAvg').innerText = `${summary.sectionPercentages.academics}%`;
  document.getElementById('sfbBehaviorAvg').innerText = `${summary.sectionPercentages.behavior}%`;

  const body = document.getElementById('sfbAnalysisBody');
  if (body) {
    if (!responses.length) {
      body.innerHTML = '<tr><td colspan="5" class="sfb-empty">اس فلٹر کے لیے کوئی فیڈبیک موجود نہیں۔</td></tr>';
    } else {
      body.innerHTML = summary.questionRows.map((row, index) => `
        <tr>
          <td>${index + 1}</td>
          <td class="sfb-question-text">${escapeStudentFeedbackHtml(row.text)}</td>
          <td><span class="sfb-analysis-pill">${row.average}%</span></td>
          <td>${escapeStudentFeedbackHtml(row.dominantLabel || '—')}</td>
          <td>${escapeStudentFeedbackHtml(row.distribution || '—')}</td>
        </tr>
      `).join('');
    }
  }

  const commentsHost = document.getElementById('sfbCommentsHost');
  if (commentsHost) {
    const comments = responses
      .filter((response) => String(response.suggestions?.teaching || '').trim() || String(response.suggestions?.activeLearning || '').trim())
      .sort((a, b) => String(b.feedbackDate || '').localeCompare(String(a.feedbackDate || '')))
      .slice(0, 12);

    commentsHost.innerHTML = comments.length
      ? comments.map((response) => `
          <div class="sfb-comment">
            <div class="sfb-comment-meta">${escapeStudentFeedbackHtml(response.studentName || 'طالب علم')} — ${escapeStudentFeedbackHtml(response.subjectLabel || response.subjectName_ur || '')} — ${escapeStudentFeedbackHtml(formatStudentFeedbackDate(response.feedbackDate || ''))}</div>
            <h5>تدریس بہتر بنانے کی تجویز</h5>
            <p>${escapeStudentFeedbackHtml((response.suggestions?.teaching || 'کوئی تبصرہ نہیں').trim())}</p>
            <h5 style="margin-top:0.9rem;">ایکٹو لرننگ پر رائے</h5>
            <p>${escapeStudentFeedbackHtml((response.suggestions?.activeLearning || 'کوئی تبصرہ نہیں').trim())}</p>
          </div>
        `).join('')
      : '<div class="sfb-empty" style="grid-column:1 / -1;">اس فلٹر کے لیے کوئی تجویز دستیاب نہیں۔</div>';
  }
}

function aggregateStudentFeedbackResponses(responses) {
  const sectionPercentages = { methodology: 0, academics: 0, behavior: 0 };
  const questionRows = [];

  Object.values(studentFeedbackConfig).forEach((section) => {
    const sectionScores = responses.map((response) => Number(response.analytics?.sections?.[section.key]?.percentage || 0));
    sectionPercentages[section.key] = sectionScores.length ? Math.round(sectionScores.reduce((sum, value) => sum + value, 0) / sectionScores.length) : 0;

    section.questions.forEach((question) => {
      const counts = new Map();
      section.options.forEach((option) => counts.set(option.value, 0));
      let totalScore = 0;
      let count = 0;

      responses.forEach((response) => {
        const answerValue = response.answers?.[question.id];
        if (!answerValue) return;
        const option = section.options.find(item => item.value === answerValue);
        if (!option) return;
        counts.set(answerValue, (counts.get(answerValue) || 0) + 1);
        totalScore += option.score;
        count += 1;
      });

      let dominantValue = '';
      let dominantCount = -1;
      counts.forEach((value, key) => {
        if (value > dominantCount) {
          dominantValue = key;
          dominantCount = value;
        }
      });

      const maxScore = section.options[0]?.score || 1;
      const average = count ? Math.round((totalScore / (count * maxScore)) * 100) : 0;
      const distribution = section.options
        .map((option) => `${option.label}: ${counts.get(option.value) || 0}`)
        .join('، ');

      questionRows.push({
        id: question.id,
        text: question.text,
        average,
        dominantLabel: (section.options.find(item => item.value === dominantValue) || {}).label || '',
        distribution
      });
    });
  });

  return { sectionPercentages, questionRows };
}

function updateStudentFeedbackState(text) {
  const state = document.getElementById('sfbStudentState');
  if (state) state.innerText = text || '';
}

function updateStudentFeedbackAdminState(text) {
  const state = document.getElementById('sfbAdminState');
  if (state) state.innerText = text || '';
}

function buildStudentFeedbackDocId(studentId, subjectId, feedbackDate) {
  return [studentId, subjectId, feedbackDate].map(normalizeStudentFeedbackToken).join('__');
}

function normalizeStudentFeedbackToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getStudentFeedbackFullName(student) {
  return `${student?.firstName || ''} ${student?.lastName || ''}`.trim() || student?.name || '';
}

function formatStudentFeedbackDate(value) {
  if (!value) return '—';
  const parts = String(value).split('-');
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function escapeStudentFeedbackHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cssEscapeStudentFeedback(value) {
  if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(value));
  return String(value).replace(/(["'\\.#:[\],= ])/g, '\\$1');
}
