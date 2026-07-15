const checklistHistoryState = {
  departments: [],
  classes: [],
  teachers: [],
  checklists: [],
  currentUser: null,
  chart: null,
  sections: [
    {
      key: 'before_class',
      badge: '1',
      title: 'حصہ اول: پری کلاس تیاری',
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

function getHistoryTenantId() {
  return checklistHistoryState.currentUser?.tenantId 
    || (typeof getCurrentTenant === 'function' ? getCurrentTenant() : null)
    || localStorage.getItem('tenant_id') 
    || localStorage.getItem('tenantId') 
    || 'default';
}

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('ldchMainContent')) return;
  
  bindHistoryEvents();

  if (typeof auth !== 'undefined') {
    auth.onAuthStateChanged(async (user) => {
      if (!user) return;
      
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      if (!currentUser.uid) {
        currentUser.uid = user.uid;
        currentUser.email = user.email;
        currentUser.name = user.displayName || user.email;
      }
      checklistHistoryState.currentUser = currentUser;
      if (typeof initDashboard === 'function') initDashboard(currentUser);

      const roles = getUserRoles(currentUser);
      const allowed = roles.some(role => ['admin', 'owner', 'principal', 'nazim_e_taleemaat'].includes(role));
      document.getElementById('ldchAccessDenied').style.display = allowed ? 'none' : '';
      document.getElementById('ldchMainContent').style.display = allowed ? '' : 'none';
      if (!allowed) return;

      try {
        await Promise.all([loadHistoryDepartments(), loadHistoryTeachers(), loadHistoryClasses()]);
      } catch (err) {
        console.error('Error loading dropdown data:', err);
      }
    });
  }
});

function bindHistoryEvents() {
  document.getElementById('ldchDepartment')?.addEventListener('change', async () => {
    try {
      await loadHistoryClasses();
    } catch (err) {
      console.error(err);
    }
  });
  document.getElementById('ldchFetchBtn')?.addEventListener('click', fetchHistoricalChecklists);
  document.getElementById('ldchModalClose')?.addEventListener('click', closeDetailModal);
  document.getElementById('ldchDetailModalCloseBtn')?.addEventListener('click', closeDetailModal);
  window.addEventListener('click', (e) => {
    const modal = document.getElementById('ldchDetailModal');
    if (e.target === modal) closeDetailModal();
  });
}

async function loadHistoryDepartments() {
  const select = document.getElementById('ldchDepartment');
  if (!select) return;
  select.innerHTML = '<option value="">تمام شعبہ جات</option>';
  
  const tenantId = getHistoryTenantId();
  try {
    let snapshot = await db.collection('departments').where('tenantId', '==', tenantId).get();
    if (snapshot.empty) {
      snapshot = await db.collection('departments').get();
    }
    
    checklistHistoryState.departments = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.tenantId || data.tenantId === tenantId) {
        checklistHistoryState.departments.push({ id: doc.id, ...data });
      }
    });

    checklistHistoryState.departments.forEach((dept) => {
      const option = document.createElement('option');
      option.value = dept.name;
      option.innerText = typeof getDepartmentDisplayName === 'function' 
        ? getDepartmentDisplayName(dept.name, dept.name_ur || '')
        : (dept.name_ur || dept.name || '');
      select.appendChild(option);
    });
  } catch (err) {
    console.error('Error loading history departments:', err);
  }
}

async function loadHistoryTeachers() {
  const select = document.getElementById('ldchTeacher');
  if (!select) return;
  select.innerHTML = '<option value="">استاد منتخب کریں</option>';
  
  const tenantId = getHistoryTenantId();
  try {
    let snapshot = await db.collection('teachers').where('tenantId', '==', tenantId).get();
    if (snapshot.empty) {
      try {
        snapshot = await db.collection('teachers').orderBy('firstName').get();
      } catch (_) {
        snapshot = await db.collection('teachers').get();
      }
    }

    checklistHistoryState.teachers = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.tenantId || data.tenantId === tenantId) {
        checklistHistoryState.teachers.push({ id: doc.id, ...data });
      }
    });

    checklistHistoryState.teachers.forEach((teacher) => {
      const option = document.createElement('option');
      option.value = teacher.id;
      option.innerText = teacher.name || `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() || teacher.fullName || '';
      select.appendChild(option);
    });
  } catch (err) {
    console.error('Error loading history teachers:', err);
  }
}

async function loadHistoryClasses() {
  const select = document.getElementById('ldchClass');
  if (!select) return;
  select.innerHTML = '<option value="">تمام کلاسز</option>';
  
  const dept = document.getElementById('ldchDepartment')?.value || '';
  const tenantId = getHistoryTenantId();
  
  try {
    let query = db.collection('classes').where('tenantId', '==', tenantId);
    if (dept) query = query.where('department', '==', dept);
    
    let snapshot = await query.get();
    if (snapshot.empty && !dept) {
      snapshot = await db.collection('classes').get();
    }

    checklistHistoryState.classes = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.tenantId || data.tenantId === tenantId) {
        if (!dept || data.department === dept) {
          checklistHistoryState.classes.push({ id: doc.id, ...data });
        }
      }
    });

    checklistHistoryState.classes.forEach((cls) => {
      const option = document.createElement('option');
      option.value = cls.name;
      option.innerText = typeof getClassDisplayName === 'function'
        ? getClassDisplayName(cls.name, cls.name_ur || '')
        : (cls.name_ur || cls.name || '');
      select.appendChild(option);
    });
  } catch (err) {
    console.error('Error loading history classes:', err);
  }
}

async function fetchHistoricalChecklists() {
  const teacherId = document.getElementById('ldchTeacher')?.value || '';
  if (!teacherId) {
    alert('رپورٹ لوڈ کرنے کے لیے استاد منتخب کرنا لازمی ہے۔');
    return;
  }

  const dept = document.getElementById('ldchDepartment')?.value || '';
  const className = document.getElementById('ldchClass')?.value || '';
  const dateFrom = document.getElementById('ldchDateFrom')?.value || '';
  const dateTo = document.getElementById('ldchDateTo')?.value || '';
  const tenantId = getHistoryTenantId();

  const tableBody = document.getElementById('ldchHistoryTableBody');
  tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem;">معلومات تلاش کی جا رہی ہیں...</td></tr>`;

  try {
    let query = db.collection('lesson_delivery_checklists')
      .where('teacherId', '==', teacherId);

    const snapshot = await query.get();
    checklistHistoryState.checklists = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const ctx = data.context || {};
      
      // Tenant filtering (match active tenant, or allow legacy empty/unset tenantId values)
      if (data.tenantId && data.tenantId !== tenantId && tenantId !== 'default') return;

      // Client-side filtering for optional parameters to avoid complex multi-field indexes
      if (dept && ctx.department !== dept) return;
      if (className && ctx.className !== className) return;
      if (dateFrom && ctx.date < dateFrom) return;
      if (dateTo && ctx.date > dateTo) return;

      checklistHistoryState.checklists.push({ id: doc.id, ...data });
    });

    // Sort by date descending
    checklistHistoryState.checklists.sort((a, b) => {
      const dateA = (a.context?.date || '') + ' ' + (a.context?.time || '');
      const dateB = (b.context?.date || '') + ' ' + (b.context?.time || '');
      return dateB.localeCompare(dateA);
    });

    renderHistoryDashboard();
  } catch (error) {
    console.error('Error fetching historical checklists:', error);
    tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:red;">معلومات لوڈ کرنے میں مسئلہ پیش آیا۔</td></tr>`;
  }
}

function renderHistoryDashboard() {
  const list = checklistHistoryState.checklists;
  
  // Update Metrics Area
  document.getElementById('ldchMetricsArea').style.display = list.length ? 'grid' : 'none';
  document.getElementById('ldchChartCard').style.display = list.length ? 'block' : 'none';
  document.getElementById('ldchTableCard').style.display = 'block';

  const tableBody = document.getElementById('ldchHistoryTableBody');
  if (!list.length) {
    tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-light);">اس استاد کے لیے کوئی مشاہداتی ریکارڈ نہیں ملا۔</td></tr>`;
    return;
  }

  // Calculate Metrics
  const totalObs = list.length;
  let totalPercentSum = 0;
  let latestGrade = '-';
  
  list.forEach(doc => {
    totalPercentSum += Number(doc.summary?.percentage || 0);
  });
  
  const averagePercent = Math.round(totalPercentSum / totalObs);
  if (list.length > 0) {
    latestGrade = list[0].summary?.grade || '-';
  }

  document.getElementById('ldchMetricCount').innerText = String(totalObs);
  document.getElementById('ldchMetricAverage').innerText = `${averagePercent}%`;
  document.getElementById('ldchMetricLatestGrade').innerText = latestGrade;

  // Grade Card Color Alignment
  const gradeCard = document.getElementById('ldchMetricGradeCard');
  if (gradeCard) {
    gradeCard.className = 'ldch-metric-card';
    if (latestGrade === 'ممتاز') gradeCard.classList.add('success');
    else if (latestGrade === 'بہتر') gradeCard.classList.add('accent');
    else gradeCard.classList.add('coaching');
  }

  // Render progression chart
  renderHistoryProgressionChart();

  // Render Table
  tableBody.innerHTML = list.map(doc => {
    const ctx = doc.context || {};
    const sum = doc.summary || {};
    const formattedDate = ctx.date ? ctx.date.split('-').reverse().join('/') : '-';
    
    let badgeClass = 'coaching';
    if (sum.grade === 'ممتاز') badgeClass = 'excellent';
    else if (sum.grade === 'بہتر') badgeClass = 'good';
    else if (sum.grade === 'فوری مداخلت') badgeClass = 'intervention';

    return `
      <tr>
        <td><strong>${formattedDate}</strong> <span style="font-size:0.8rem; color:var(--text-light);">${ctx.time || ''}</span></td>
        <td>${ctx.className_ur || ctx.className || '-'} ${ctx.section ? `(${ctx.section})` : ''}</td>
        <td>${ctx.subject_ur || ctx.subject || '-'}</td>
        <td>${ctx.observer || '-'}</td>
        <td>${sum.totalPoints || 0} / ${sum.maxPoints || 0}</td>
        <td><strong>${sum.percentage || 0}%</strong></td>
        <td><span class="ldch-badge ${badgeClass}">${sum.grade || '-'}</span></td>
        <td>
          <button type="button" class="btn-secondary" style="padding:0.4rem 0.8rem; min-width:auto; font-size:0.85rem;" onclick="viewChecklistDetails('${doc.id}')">تفصیل دیکھیں</button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderHistoryProgressionChart() {
  const ctx = document.getElementById('ldchHistoryChart')?.getContext('2d');
  if (!ctx) return;

  if (checklistHistoryState.chart) {
    checklistHistoryState.chart.destroy();
  }

  // Prepare chronological data
  const dataPoints = [...checklistHistoryState.checklists].reverse();
  const labels = dataPoints.map(doc => {
    const d = doc.context?.date || '';
    return d ? d.split('-').reverse().slice(0, 2).join('/') : '';
  });
  const percentages = dataPoints.map(doc => doc.summary?.percentage || 0);

  checklistHistoryState.chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'کارکردگی فیصد (%)',
        data: percentages,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.08)',
        borderWidth: 3,
        tension: 0.35,
        fill: true,
        pointBackgroundColor: '#4f46e5',
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: {
            stepSize: 20
          }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

function viewChecklistDetails(docId) {
  const doc = checklistHistoryState.checklists.find(item => item.id === docId);
  if (!doc) return;

  const ctx = doc.context || {};
  const sum = doc.summary || {};
  const responses = doc.responses || {};

  document.getElementById('ldchDetailTeacher').innerText = ctx.teacherName || '-';
  document.getElementById('ldchDetailObserver').innerText = ctx.observer || '-';
  document.getElementById('ldchDetailDate').innerText = (ctx.date || '-') + ' ' + (ctx.time || '');
  document.getElementById('ldchDetailClass').innerText = `${ctx.className_ur || ctx.className || '-'} ${ctx.section ? `(سیکشن ${ctx.section})` : ''} / ${ctx.department_ur || ctx.department || '-'}`;
  document.getElementById('ldchDetailSubject').innerText = `${ctx.subject_ur || ctx.subject || '-'} ${ctx.book ? `(${ctx.book})` : ''}`;
  document.getElementById('ldchDetailScore').innerText = `${sum.totalPoints || 0} / ${sum.maxPoints || 0} (${sum.percentage || 0}%) - درجہ: ${sum.grade || '-'}`;

  const container = document.getElementById('ldchDetailItemsContainer');
  container.innerHTML = checklistHistoryState.sections.map(section => {
    const secData = responses[section.key] || {};
    const ratings = secData.ratings || {};
    const notes = secData.notes || {};

    return `
      <div class="ldch-detail-section">
        <h4 class="ldch-detail-section-title">
          <span class="ldc-badge" style="min-width:1.8rem; height:1.8rem; font-size:0.8rem; border-radius:0.5rem; margin-left:0.5rem;">${section.badge}</span>
          ${section.title}
        </h4>
        <table class="ldch-detail-table">
          <thead>
            <tr>
              <th style="width:60%;">معیار جانچ</th>
              <th style="width:15%; text-align:center;">درجہ بندی</th>
              <th style="width:25%;">مختصر نوٹ</th>
            </tr>
          </thead>
          <tbody>
            ${section.items.map(item => {
              const rating = ratings[item.key] || '';
              const note = notes[item.key] || '';
              let displayRating = '-';
              if (section.scale === 'quad') {
                displayRating = rating ? `${rating} / 4` : '-';
              } else {
                if (rating === 'yes') displayRating = 'ہاں';
                else if (rating === 'partial') displayRating = 'جزوی';
                else if (rating === 'no') displayRating = 'نہیں';
              }

              return `
                <tr>
                  <td>${item.text}</td>
                  <td style="text-align:center; font-weight:700; color:#4f46e5;">${displayRating}</td>
                  <td style="font-size:0.85rem; color:#475569;">${note || '-'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        ${secData.sectionNote ? `<div style="font-size:0.86rem; border-top:1px dashed #ccc; padding-top:0.5rem; margin-top:0.5rem;"><strong>حصے کی مجموعی رائے: </strong><span style="color:#334155; font-style:italic;">${secData.sectionNote}</span></div>` : ''}
      </div>
    `;
  }).join('');

  document.getElementById('ldchDetailModal').style.display = 'flex';
  document.getElementById('ldchDetailModal').classList.add('active');
}

function closeDetailModal() {
  document.getElementById('ldchDetailModal').style.display = 'none';
  document.getElementById('ldchDetailModal').classList.remove('active');
}
