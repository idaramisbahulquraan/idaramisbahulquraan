const lessonChecklistState = {
  departments: [],
  classes: [],
  subjects: [],
  teachers: [],
  currentUser: null,
  selectedClassDoc: null,
  selectedSubjectDoc: null,
  selectedTeacherDoc: null,
  currentDocId: '',
  currentDoc: null,
  sections: [
    {
      key: 'before_class',
      badge: '1',
      title: 'حصہ اول: پری کلاس تیاری',
      subtitle: 'سبق شروع ہونے سے پہلے منصوبہ، وسائل اور مقاصد کی تیاری کی جانچ۔',
      scale: 'tri',
      items: [
        { key: 'objectives_written', text: 'سبق کے واضح Learning Objectives لکھے گئے تھے' },
        { key: 'objectives_measurable', text: 'Objectives قابلِ پیمائش تھے (Explain, Analyze, Apply وغیرہ)' },
        { key: 'content_aligned', text: 'سبق اور سرگرمیاں مقاصد کے مطابق تھیں' },
        { key: 'strategy_selected', text: 'سبق کے لیے Active Learning Strategy پہلے سے منتخب تھی' },
        { key: 'materials_ready', text: 'تدریسی مواد تیار تھا (کتاب، بورڈ، مثالیں، شیٹس)' },
        { key: 'questions_ready', text: 'کور ورک / سوالات پہلے سے تیار تھے' },
        { key: 'time_plan', text: 'وقت کی تقسیم واضح تھی' }
      ]
    },
    {
      key: 'lesson_opening',
      badge: '2',
      title: 'حصہ دوم: سبق کا آغاز (5-10 منٹ)',
      subtitle: 'ابتدائی چند منٹ میں کلاس کا ماحول، توجہ اور ربط قائم ہونے کی جانچ۔',
      scale: 'tri',
      items: [
        { key: 'class_ready', text: 'کلاس صاف، منظم اور سیکھنے کے لیے تیار تھی' },
        { key: 'students_settled', text: 'طلبا اپنی نشستوں پر منظم تھے' },
        { key: 'noise_low', text: 'غیر ضروری شور موجود نہیں تھا' },
        { key: 'attention_on_lesson', text: 'طلبا کی توجہ سبق پر مرکوز تھی' },
        { key: 'board_clear', text: 'بورڈ صاف اور واضح تھا' },
        { key: 'objective_shared', text: 'سبق کا مقصد طلبا کو بتایا گیا' },
        { key: 'previous_linked', text: 'پچھلے سبق سے ربط قائم کیا گیا' },
        { key: 'hook_used', text: 'دلچسپ سوال / مثال سے توجہ حاصل کی گئی' },
        { key: 'prior_knowledge_checked', text: 'طلبا کی ابتدائی سمجھ جانچی گئی' }
      ]
    },
    {
      key: 'teacher_control',
      badge: '3',
      title: 'استاد کا کنٹرول',
      subtitle: 'کلاس روم مینجمنٹ، نگرانی اور استاد کے مؤثر کنٹرول کا جائزہ۔',
      scale: 'tri',
      items: [
        { key: 'maintained_control', text: 'استاد پورے وقت کلاس کو کنٹرول کر رہا تھا' },
        { key: 'active_movement', text: 'استاد کلاس میں فعال طور پر حرکت کر رہا تھا' },
        { key: 'full_monitoring', text: 'استاد نے طلبا کی مکمل نگرانی کی' },
        { key: 'handled_disorder', text: 'استاد نے فوری طور پر بے نظمی کو کنٹرول کیا' },
        { key: 'voice_effective', text: 'استاد کی آواز واضح اور مؤثر تھی' }
      ]
    },
    {
      key: 'student_discipline',
      badge: '4',
      title: 'طلاب کا نظم و ضبط',
      subtitle: 'مرکزی تدریس کے دوران طلبا کے رویے اور نظم و ضبط کی درجہ بندی۔',
      scale: 'quad',
      items: [
        { key: 'followed_instructions', text: 'طلبا استاد کی ہدایات پر فوری عمل کر رہے تھے' },
        { key: 'asked_permission', text: 'طلبا اجازت لے کر بات کر رہے تھے' },
        { key: 'group_work_orderly', text: 'گروپ / جوڑی کا عمل مسلسل منظم رہا تھا' },
        { key: 'discussion_engaged', text: 'طلبا بحث میں جڑے ہوئے تھے' },
        { key: 'mutual_respect', text: 'طلبا ایک دوسرے کا احترام کر رہے تھے' }
      ]
    },
    {
      key: 'clarity_understanding',
      badge: '5',
      title: 'وضاحت اور مؤثر فہم',
      subtitle: 'تدریسی وضاحت، مثالوں، حوالہ جات اور باڈی لینگویج کا معیار۔',
      scale: 'quad',
      items: [
        { key: 'clear_explanation', text: 'استاد کی وضاحت واضح اور مربوط تھی' },
        { key: 'examples_used', text: 'مشکل نکات سادہ مثالوں سے واضح کیے گئے' },
        { key: 'references_correct', text: 'قرآنی / حدیثی / اصلی حوالہ درست دیا گیا' },
        { key: 'body_language', text: 'آواز اور باڈی لینگویج مؤثر تھی' }
      ]
    },
    {
      key: 'active_engagement',
      badge: '6',
      title: 'طلاب کی شرکت',
      subtitle: 'سبق میں طلبا کی عملی شرکت، سوالات اور گروپ سرگرمی کا جائزہ۔',
      scale: 'quad',
      items: [
        { key: 'students_involved', text: 'طلبا سوالات میں شامل تھے' },
        { key: 'group_work_happened', text: 'گروپ ورک / ڈسکشن ہوئی' },
        { key: 'weak_students_included', text: 'کمزور طلبا کو بھی شامل کیا گیا' },
        { key: 'majority_active', text: '70% سے زیادہ طلبا فعال تھے' }
      ]
    },
    {
      key: 'assessment_for_learning',
      badge: '7',
      title: 'فہم کی جانچ',
      subtitle: 'سبق کے دوران فہم چیک کرنے، سوالات پوچھنے اور فوری فیڈبیک دینے کی جانچ۔',
      scale: 'tri',
      items: [
        { key: 'checked_understanding', text: 'سبق کے دوران سوالات سے فہم چیک کی گئی' },
        { key: 'higher_order_questions', text: 'اعلیٰ سطحی سوالات (Why / How) پوچھے گئے' },
        { key: 'student_summary', text: 'طلبا سے خلاصہ کروایا گیا' },
        { key: 'immediate_feedback', text: 'فوری فیڈبیک دیا گیا' }
      ]
    },
    {
      key: 'lesson_closure',
      badge: '8',
      title: 'حصہ چہارم: سبق کا اختتام',
      subtitle: 'اختتام پر خلاصہ، مقاصد اور اگلے سبق کے ربط کا جائزہ۔',
      scale: 'tri',
      items: [
        { key: 'lesson_summarized', text: 'سبق کا خلاصہ کروایا گیا' },
        { key: 'objectives_achieved', text: 'Learning Objectives حاصل ہوئے' },
        { key: 'homework_given', text: 'ہوم ورک یا مقصد دیا گیا' },
        { key: 'next_lesson_link', text: 'اگلے سبق کی جھلک دی گئی' }
      ]
    },
    {
      key: 'ethical_aspects',
      badge: '9',
      title: 'حصہ پنجم: تربیتی و اخلاقی پہلو',
      subtitle: 'سبق کے اندر تربیتی، اخلاقی اور دینی پہلوؤں کے اظہار کا جائزہ۔',
      scale: 'tri',
      items: [
        { key: 'religious_values', text: 'دینی اصولوں پر زور دیا گیا' },
        { key: 'respectful_environment', text: 'ادب و احترام کی فضا رہی' },
        { key: 'moral_dimension', text: 'اخلاقی / دینی پہلو سبق میں شامل تھا' }
      ]
    },
    {
      key: 'behavior_management',
      badge: '10',
      title: 'حصہ ششم: رویہ جاتی نظم',
      subtitle: 'نظم، احترام اور مشکل رویوں کو سنبھالنے کے انداز کی جانچ۔',
      scale: 'tri',
      items: [
        { key: 'positive_discipline', text: 'استاد نے مثبت انداز میں discipline برقرار رکھا' },
        { key: 'no_unnecessary_anger', text: 'استاد نے غیر ضروری غصہ ظاہر نہیں کیا' },
        { key: 'respectful_communication', text: 'استاد نے respectful communication استعمال کیا' },
        { key: 'handled_disruptive_behavior', text: 'استاد نے disruptive behavior کو مؤثر انداز میں handle کیا' }
      ]
    }
  ]
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('lessonChecklistContent')) return;

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  lessonChecklistState.currentUser = currentUser;
  if (typeof initDashboard === 'function') initDashboard(currentUser);

  const roles = getUserRoles(currentUser);
  const allowed = roles.some(role => !['student', 'parent'].includes(role));
  document.getElementById('lessonChecklistAccessDenied').style.display = allowed ? 'none' : '';
  document.getElementById('lessonChecklistContent').style.display = allowed ? '' : 'none';
  if (!allowed) return;

  const dateInput = document.getElementById('ldcDate');
  if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];

  renderChecklistSections();
  bindLessonChecklistEvents();
  await Promise.all([loadChecklistDepartments(), loadChecklistTeachers()]);
  updateChecklistSummary();
});

function bindLessonChecklistEvents() {
  document.getElementById('ldcDepartment')?.addEventListener('change', async () => {
    await updateChecklistClasses();
    await updateChecklistSubjects();
  });

  document.getElementById('ldcClass')?.addEventListener('change', async () => {
    updateChecklistSections();
    await updateChecklistSubjects();
  });

  document.getElementById('ldcSection')?.addEventListener('change', updateChecklistSubjects);
  document.getElementById('ldcTeacher')?.addEventListener('change', async () => {
    updateChecklistSelectedTeacher();
    await updateChecklistSubjects();
  });
  document.getElementById('ldcSubject')?.addEventListener('change', () => {
    lessonChecklistState.selectedSubjectDoc = lessonChecklistState.subjects.find(item => item.id === document.getElementById('ldcSubject').value) || null;
    autoFillChecklistBook();
  });
  document.getElementById('ldcLoadBtn')?.addEventListener('click', loadLessonChecklistRecord);
  document.getElementById('ldcSaveBtn')?.addEventListener('click', saveLessonChecklistRecord);
  document.getElementById('ldcPrintBtn')?.addEventListener('click', () => window.print());
  document.getElementById('ldcSections')?.addEventListener('change', (event) => {
    if (event.target.matches('input[type="radio"]')) updateChecklistSummary();
  });
}

function renderChecklistSections() {
  const host = document.getElementById('ldcSections');
  if (!host) return;
  host.innerHTML = lessonChecklistState.sections.map(section => `
    <div class="ldc-card section">
      <div class="ldc-head">
        <div class="ldc-head-main">
          <span class="ldc-badge">${escapeChecklistHtml(section.badge)}</span>
          <div>
            <h3 class="ldc-title">${escapeChecklistHtml(section.title)}</h3>
            <p class="ldc-subtitle">${escapeChecklistHtml(section.subtitle)}</p>
          </div>
        </div>
        <span class="ldc-note">${section.scale === 'quad' ? 'درجہ بندی 1 تا 4' : 'ہاں / جزوی / نہیں'}</span>
      </div>
      <div class="ldc-table-shell">
        <div class="ldc-table-wrap">
          <table class="ldc-table">
            <thead>
              <tr>
                <th class="ldc-criterion">معیار</th>
                ${section.scale === 'quad'
                  ? '<th>1 کمزور</th><th>2</th><th>3</th><th>4 بہترین</th>'
                  : '<th>ہاں</th><th>جزوی</th><th>نہیں</th>'}
                <th>مختصر نوٹ</th>
              </tr>
            </thead>
            <tbody>
              ${section.items.map(item => renderChecklistRow(section, item)).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="form-group" style="margin-top:1rem;">
        <label>حصے کی مجموعی رائے</label>
        <textarea class="ldc-textarea" data-section-note="${escapeChecklistHtml(section.key)}" placeholder="اس حصے کے بارے میں مختصر مشاہدہ درج کریں"></textarea>
      </div>
    </div>
  `).join('');
}

function renderChecklistRow(section, item) {
  const choices = section.scale === 'quad'
    ? [
        { key: '1', label: '1', scoreClass: true },
        { key: '2', label: '2', scoreClass: true },
        { key: '3', label: '3', scoreClass: true },
        { key: '4', label: '4', scoreClass: true }
      ]
    : [
        { key: 'yes', label: 'ہاں' },
        { key: 'partial', label: 'جزوی' },
        { key: 'no', label: 'نہیں' }
      ];

  return `
    <tr>
      <td class="ldc-criterion">${escapeChecklistHtml(item.text)}</td>
      ${choices.map(choice => `
        <td>
          <div class="ldc-scale-group">
            <label class="ldc-choice">
              <input type="radio" name="ldc_${escapeChecklistHtml(section.key)}_${escapeChecklistHtml(item.key)}" value="${escapeChecklistHtml(choice.key)}" data-section-key="${escapeChecklistHtml(section.key)}" data-item-key="${escapeChecklistHtml(item.key)}">
              <span class="${choice.scoreClass ? 'ldc-score' : ''}">${escapeChecklistHtml(choice.label)}</span>
            </label>
          </div>
        </td>
      `).join('')}
      <td class="ldc-row-note"><input class="ldc-input" type="text" data-item-note="${escapeChecklistHtml(section.key)}__${escapeChecklistHtml(item.key)}" placeholder="اختیاری"></td>
    </tr>
  `;
}

async function loadChecklistDepartments() {
  const select = document.getElementById('ldcDepartment');
  select.innerHTML = '<option value="">شعبہ منتخب کریں</option>';
  const snapshot = await db.collection('departments').orderBy('name').get();
  lessonChecklistState.departments = [];
  snapshot.forEach(doc => lessonChecklistState.departments.push({ id: doc.id, ...(doc.data() || {}) }));
  lessonChecklistState.departments.forEach((department) => {
    const option = document.createElement('option');
    option.value = department.name || '';
    option.innerText = typeof getDepartmentDisplayName === 'function'
      ? getDepartmentDisplayName(department.name || '', department.name_ur || '')
      : (department.name_ur || department.name || '');
    select.appendChild(option);
  });
  resetChecklistClassSelect();
  resetChecklistSectionSelect();
  resetChecklistSubjectSelect();
}

async function loadChecklistTeachers() {
  const select = document.getElementById('ldcTeacher');
  if (!select) return;
  select.innerHTML = '<option value="">استاد منتخب کریں</option>';
  lessonChecklistState.teachers = [];
  let snapshot;
  try {
    snapshot = await db.collection('teachers').orderBy('firstName').get();
  } catch (_) {
    snapshot = await db.collection('teachers').get();
  }
  snapshot.forEach(doc => lessonChecklistState.teachers.push({ id: doc.id, ...(doc.data() || {}) }));
  lessonChecklistState.teachers.forEach((teacher) => {
    const option = document.createElement('option');
    option.value = teacher.id;
    option.innerText = getChecklistTeacherDisplayName(teacher);
    select.appendChild(option);
  });

  const roles = getUserRoles(lessonChecklistState.currentUser);
  const elevated = roles.some(role => ['admin', 'owner', 'principal', 'nazim_e_taleemaat', 'hifz_supervisor'].includes(role));
  const currentUid = lessonChecklistState.currentUser?.uid || '';
  const currentName = String(lessonChecklistState.currentUser?.name || lessonChecklistState.currentUser?.displayName || '').trim();
  const currentTeacher = lessonChecklistState.teachers.find(item => item.id === currentUid) || lessonChecklistState.teachers.find(item => getChecklistTeacherDisplayName(item) === currentName);
  if (!elevated && currentTeacher) {
    select.value = currentTeacher.id;
    lessonChecklistState.selectedTeacherDoc = currentTeacher;
  } else if (!elevated && currentUid && currentName) {
    const option = document.createElement('option');
    option.value = currentUid;
    option.innerText = currentName;
    option.dataset.synthetic = 'true';
    select.appendChild(option);
    select.value = currentUid;
    lessonChecklistState.selectedTeacherDoc = { id: currentUid, name: currentName };
  } else {
    select.value = '';
    lessonChecklistState.selectedTeacherDoc = null;
  }

  if (!elevated && roles.includes('teacher')) {
    select.disabled = true;
  }

  const observerInput = document.getElementById('ldcObserver');
  if (observerInput && !observerInput.value) {
    observerInput.value = currentName || '';
  }
}

async function updateChecklistClasses() {
  const department = document.getElementById('ldcDepartment')?.value || '';
  const select = document.getElementById('ldcClass');
  lessonChecklistState.classes = [];
  lessonChecklistState.selectedClassDoc = null;
  select.innerHTML = '<option value="">کلاس منتخب کریں</option>';
  resetChecklistSectionSelect();
  resetChecklistSubjectSelect();
  if (!department) return;

  const snapshot = await db.collection('classes').where('department', '==', department).get();
  snapshot.forEach(doc => lessonChecklistState.classes.push({ id: doc.id, ...(doc.data() || {}) }));
  lessonChecklistState.classes.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))).forEach((cls) => {
    const option = document.createElement('option');
    option.value = cls.name || '';
    option.innerText = typeof getClassDisplayName === 'function'
      ? getClassDisplayName(cls.name || '', cls.name_ur || '')
      : (cls.name_ur || cls.name || '');
    select.appendChild(option);
  });
}

function updateChecklistSections() {
  const className = document.getElementById('ldcClass')?.value || '';
  const select = document.getElementById('ldcSection');
  lessonChecklistState.selectedClassDoc = lessonChecklistState.classes.find(item => item.name === className) || null;
  select.innerHTML = '';
  const sections = normalizeChecklistSections(lessonChecklistState.selectedClassDoc?.sections);
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

async function updateChecklistSubjects() {
  const department = document.getElementById('ldcDepartment')?.value || '';
  const className = document.getElementById('ldcClass')?.value || '';
  const section = document.getElementById('ldcSection')?.value || '';
  const select = document.getElementById('ldcSubject');
  lessonChecklistState.subjects = [];
  lessonChecklistState.selectedSubjectDoc = null;
  select.innerHTML = '<option value="">مضمون منتخب کریں</option>';
  if (!department || !className) return;

  const snapshot = await db.collection('subjects').where('department', '==', department).where('className', '==', className).get();
  const roles = getUserRoles(lessonChecklistState.currentUser);
  const elevated = roles.some(role => ['admin', 'owner', 'principal', 'nazim_e_taleemaat', 'hifz_supervisor', 'accountant', 'clerk'].includes(role));
  const selectedTeacherId = document.getElementById('ldcTeacher')?.value || '';
  const selectedTeacherName = String(document.querySelector('#ldcTeacher option:checked')?.textContent || '').trim();

  snapshot.forEach((doc) => {
    const subject = { id: doc.id, ...(doc.data() || {}) };
    const subjectSections = normalizeChecklistSections(subject.sections || subject.section);
    const matchesSection = !section || !subjectSections.length || subjectSections.includes(section);
    const matchesTeacher = elevated
      ? (!selectedTeacherId ? true : subject.teacherId === selectedTeacherId || (Array.isArray(subject.teacherIds) && subject.teacherIds.includes(selectedTeacherId)) || (selectedTeacherName && String(subject.teacherName || '').trim() === selectedTeacherName) || (Array.isArray(subject.teacherNames) && subject.teacherNames.map(name => String(name || '').trim()).includes(selectedTeacherName)))
      : matchChecklistSubjectTeacher(subject, lessonChecklistState.currentUser);

    if (matchesSection && matchesTeacher) lessonChecklistState.subjects.push(subject);
  });

  lessonChecklistState.subjects.sort((a, b) => getChecklistSubjectLabel(a).localeCompare(getChecklistSubjectLabel(b), 'ur')).forEach((subject) => {
    const option = document.createElement('option');
    option.value = subject.id;
    option.innerText = getChecklistSubjectLabel(subject);
    select.appendChild(option);
  });
}

function updateChecklistSelectedTeacher() {
  const teacherId = document.getElementById('ldcTeacher')?.value || '';
  lessonChecklistState.selectedTeacherDoc = lessonChecklistState.teachers.find(item => item.id === teacherId) || (teacherId ? { id: teacherId, name: document.querySelector('#ldcTeacher option:checked')?.textContent || '' } : null);
}

function autoFillChecklistBook() {
  const subject = lessonChecklistState.selectedSubjectDoc;
  const bookInput = document.getElementById('ldcBook');
  if (!bookInput || !subject) return;
  if (!bookInput.value.trim()) {
    bookInput.value = subject.book || subject.bookName || subject.book_ur || subject.subjectBook || '';
  }
}

async function loadLessonChecklistRecord() {
  const context = getChecklistContext();
  if (!context.department || !context.className || !context.subjectId || !context.teacherId || !context.date) {
    alert('شعبہ، کلاس، مضمون، استاد اور تاریخ لازماً منتخب کریں۔');
    return;
  }

  const stateLabel = document.getElementById('ldcLoadState');
  if (stateLabel) stateLabel.innerText = 'ریکارڈ لوڈ ہو رہا ہے...';

  const docId = buildLessonChecklistDocId(context);
  try {
    const snap = await db.collection('lesson_delivery_checklists').doc(docId).get();
    lessonChecklistState.currentDocId = docId;
    lessonChecklistState.currentDoc = snap.exists ? { id: snap.id, ...(snap.data() || {}) } : null;
    if (lessonChecklistState.currentDoc) {
      populateLessonChecklist(lessonChecklistState.currentDoc);
      if (stateLabel) stateLabel.innerText = 'محفوظ شدہ چیک لسٹ لوڈ ہو گئی۔';
    } else {
      resetLessonChecklistResponses();
      if (stateLabel) stateLabel.innerText = 'اس سیاق کے لیے نئی چیک لسٹ شروع کی گئی ہے۔';
    }
  } catch (error) {
    console.error('Error loading lesson delivery checklist:', error);
    if (stateLabel) stateLabel.innerText = 'ریکارڈ لوڈ نہ ہو سکا۔';
    alert('ریکارڈ لوڈ کرنے میں مسئلہ پیش آیا۔');
  }
}

function populateLessonChecklist(doc) {
  const context = doc.context || {};
  if (context.department) document.getElementById('ldcDepartment').value = context.department;
  if (context.className) document.getElementById('ldcClass').value = context.className;
  if (context.section !== undefined) document.getElementById('ldcSection').value = context.section;
  if (context.subjectId) document.getElementById('ldcSubject').value = context.subjectId;
  if (context.book) document.getElementById('ldcBook').value = context.book;
  if (context.teacherId) document.getElementById('ldcTeacher').value = context.teacherId;
  if (context.date) document.getElementById('ldcDate').value = context.date;
  if (context.time) document.getElementById('ldcTime').value = context.time;
  if (context.observer) document.getElementById('ldcObserver').value = context.observer;

  const responses = doc.responses || {};
  lessonChecklistState.sections.forEach((section) => {
    const sectionData = responses[section.key] || {};
    const ratings = sectionData.ratings || {};
    const notes = sectionData.notes || {};
    section.items.forEach((item) => {
      const ratingValue = ratings[item.key];
      if (ratingValue !== undefined && ratingValue !== null && ratingValue !== '') {
        const input = document.querySelector(`input[data-section-key="${section.key}"][data-item-key="${item.key}"][value="${ratingValue}"]`);
        if (input) input.checked = true;
      }
      const noteInput = document.querySelector(`input[data-item-note="${section.key}__${item.key}"]`);
      if (noteInput) noteInput.value = notes[item.key] || '';
    });
    const sectionNote = document.querySelector(`textarea[data-section-note="${section.key}"]`);
    if (sectionNote) sectionNote.value = sectionData.sectionNote || '';
  });
  updateChecklistSummary();
}

function resetLessonChecklistResponses() {
  document.querySelectorAll('#ldcSections input[type="radio"]').forEach((input) => { input.checked = false; });
  document.querySelectorAll('#ldcSections input[data-item-note]').forEach((input) => { input.value = ''; });
  document.querySelectorAll('#ldcSections textarea[data-section-note]').forEach((input) => { input.value = ''; });
  updateChecklistSummary();
}

async function saveLessonChecklistRecord() {
  const context = getChecklistContext();
  if (!context.department || !context.className || !context.subjectId || !context.teacherId || !context.date) {
    alert('شعبہ، کلاس، مضمون، استاد اور تاریخ لازماً منتخب کریں۔');
    return;
  }

  const btn = document.getElementById('ldcSaveBtn');
  if (btn) btn.disabled = true;
  const stateLabel = document.getElementById('ldcLoadState');
  if (stateLabel) stateLabel.innerText = 'چیک لسٹ محفوظ ہو رہی ہے...';

  const summary = computeChecklistSummary();
  const responses = collectChecklistResponses();
  const docId = lessonChecklistState.currentDocId || buildLessonChecklistDocId(context);
  const payload = {
    context,
    responses,
    summary,
    teacherId: context.teacherId,
    teacherName: context.teacherName,
    tenantId: lessonChecklistState.currentUser?.tenantId || localStorage.getItem('tenantId') || '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedByUid: lessonChecklistState.currentUser?.uid || '',
    updatedByName: lessonChecklistState.currentUser?.name || lessonChecklistState.currentUser?.displayName || ''
  };
  if (!lessonChecklistState.currentDoc) {
    payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    payload.createdByUid = lessonChecklistState.currentUser?.uid || '';
    payload.createdByName = lessonChecklistState.currentUser?.name || lessonChecklistState.currentUser?.displayName || '';
  }

  try {
    await db.collection('lesson_delivery_checklists').doc(docId).set(payload, { merge: true });
    lessonChecklistState.currentDocId = docId;
    lessonChecklistState.currentDoc = { id: docId, ...payload };
    if (stateLabel) stateLabel.innerText = 'چیک لسٹ کامیابی سے محفوظ ہو گئی۔';
  } catch (error) {
    console.error('Error saving lesson delivery checklist:', error);
    if (stateLabel) stateLabel.innerText = 'چیک لسٹ محفوظ نہ ہو سکی۔';
    alert('چیک لسٹ محفوظ کرنے میں مسئلہ پیش آیا۔');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function getChecklistContext() {
  const department = document.getElementById('ldcDepartment')?.value || '';
  const className = document.getElementById('ldcClass')?.value || '';
  const section = document.getElementById('ldcSection')?.value || '';
  const subjectId = document.getElementById('ldcSubject')?.value || '';
  const book = document.getElementById('ldcBook')?.value?.trim() || '';
  const teacherId = document.getElementById('ldcTeacher')?.value || '';
  const teacherName = String(document.querySelector('#ldcTeacher option:checked')?.textContent || '').trim();
  const date = document.getElementById('ldcDate')?.value || '';
  const time = document.getElementById('ldcTime')?.value || '';
  const observer = document.getElementById('ldcObserver')?.value?.trim() || '';
  const subject = lessonChecklistState.subjects.find(item => item.id === subjectId) || lessonChecklistState.selectedSubjectDoc || {};
  const classDoc = lessonChecklistState.classes.find(item => item.name === className) || lessonChecklistState.selectedClassDoc || {};

  return {
    department,
    department_ur: typeof getDepartmentDisplayName === 'function' ? getDepartmentDisplayName(department, '') : department,
    classId: classDoc.id || '',
    className,
    className_ur: typeof getClassDisplayName === 'function' ? getClassDisplayName(className, classDoc.name_ur || '') : (classDoc.name_ur || className),
    section,
    subjectId,
    subject: subject.name || '',
    subject_ur: subject.name_ur || '',
    subjectLabel: getChecklistSubjectLabel(subject),
    book,
    teacherId,
    teacherName,
    date,
    time,
    observer
  };
}

function collectChecklistResponses() {
  const payload = {};
  lessonChecklistState.sections.forEach((section) => {
    const ratings = {};
    const notes = {};
    section.items.forEach((item) => {
      const selected = document.querySelector(`input[data-section-key="${section.key}"][data-item-key="${item.key}"]:checked`);
      ratings[item.key] = selected ? selected.value : '';
      const noteInput = document.querySelector(`input[data-item-note="${section.key}__${item.key}"]`);
      notes[item.key] = noteInput?.value?.trim() || '';
    });
    const sectionNote = document.querySelector(`textarea[data-section-note="${section.key}"]`);
    payload[section.key] = {
      ratings,
      notes,
      sectionNote: sectionNote?.value?.trim() || ''
    };
  });
  return payload;
}

function computeChecklistSummary() {
  const responses = collectChecklistResponses();
  let totalPoints = 0;
  let maxPoints = 0;
  let yesCount = 0;
  let partialCount = 0;
  let noCount = 0;
  let completedCount = 0;

  lessonChecklistState.sections.forEach((section) => {
    section.items.forEach((item) => {
      maxPoints += section.scale === 'quad' ? 4 : 2;
      const value = responses[section.key]?.ratings?.[item.key] || '';
      if (!value) return;
      completedCount += 1;
      if (section.scale === 'quad') {
        totalPoints += Number(value) || 0;
      } else if (value === 'yes') {
        totalPoints += 2;
        yesCount += 1;
      } else if (value === 'partial') {
        totalPoints += 1;
        partialCount += 1;
      } else if (value === 'no') {
        noCount += 1;
      }
    });
  });

  const percentage = maxPoints ? Math.round((totalPoints / maxPoints) * 100) : 0;
  const gradeMeta = getChecklistGradeMeta(percentage);
  return { totalPoints, maxPoints, percentage, grade: gradeMeta.grade, action: gradeMeta.action, yesCount, partialCount, noCount, completedCount };
}

function updateChecklistSummary() {
  const summary = computeChecklistSummary();
  document.getElementById('ldcTotalPoints').innerText = String(summary.totalPoints || 0);
  document.getElementById('ldcMaxPoints').innerText = String(summary.maxPoints || 0);
  document.getElementById('ldcPercent').innerText = `${summary.percentage || 0}%`;
  document.getElementById('ldcGrade').innerText = summary.grade || '-';
  document.getElementById('ldcActionText').innerText = summary.action || '-';
}

function getChecklistGradeMeta(percentage) {
  if (percentage >= 85) return { grade: 'ممتاز', action: 'Recognition' };
  if (percentage >= 70) return { grade: 'بہتر', action: 'معمولی بہتری' };
  if (percentage >= 50) return { grade: 'قابل اصلاح', action: 'Coaching Plan' };
  return { grade: 'فوری مداخلت', action: 'Intensive Monitoring' };
}

function buildLessonChecklistDocId(context) {
  return [
    'ldc',
    normalizeChecklistToken(context.department),
    normalizeChecklistToken(context.className),
    normalizeChecklistToken(context.section || 'general'),
    normalizeChecklistToken(context.subjectId || context.subject),
    normalizeChecklistToken(context.teacherId || context.teacherName),
    normalizeChecklistToken(context.date)
  ].filter(Boolean).join('__');
}

function getChecklistTeacherDisplayName(teacher) {
  if (!teacher) return '';
  return String(teacher.name || `${teacher.firstName || ''} ${teacher.lastName || ''}` || teacher.fullName || '').trim();
}

function getChecklistSubjectLabel(subject) {
  if (!subject) return '';
  if (typeof getSubjectDisplayName === 'function') return getSubjectDisplayName(subject);
  const name = subject.name_ur || subject.name || '';
  const book = subject.book || subject.book_ur || subject.bookName || '';
  const term = subject.term || '';
  return [name, book].filter(Boolean).join(' — ') + (term ? ` (${term})` : '');
}

function matchChecklistSubjectTeacher(subject, currentUser) {
  const teacherUid = currentUser?.uid || '';
  const teacherName = String(currentUser?.name || currentUser?.displayName || '').trim();
  return subject.teacherId === teacherUid
    || (Array.isArray(subject.teacherIds) && subject.teacherIds.includes(teacherUid))
    || (teacherName && String(subject.teacherName || '').trim() === teacherName)
    || (Array.isArray(subject.teacherNames) && subject.teacherNames.map(name => String(name || '').trim()).includes(teacherName));
}

function normalizeChecklistSections(value) {
  if (!value) return [];
  const raw = Array.isArray(value) ? value : [value];
  return Array.from(new Set(
    raw
      .flatMap(item => String(item || '').split(/[,&/]| and /i))
      .map(item => String(item || '').trim())
      .filter(Boolean)
  ));
}

function resetChecklistClassSelect() {
  const select = document.getElementById('ldcClass');
  if (select) select.innerHTML = '<option value="">کلاس منتخب کریں</option>';
}

function resetChecklistSectionSelect() {
  const select = document.getElementById('ldcSection');
  if (select) select.innerHTML = '<option value="">عمومی</option>';
}

function resetChecklistSubjectSelect() {
  const select = document.getElementById('ldcSubject');
  if (select) select.innerHTML = '<option value="">مضمون منتخب کریں</option>';
}

function normalizeChecklistToken(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/gi, '_').replace(/^_+|_+$/g, '');
}

function escapeChecklistHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
