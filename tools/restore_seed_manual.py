
import re
import json

SEED_FILE = r"e:\idara school softwear\seed.html"
URDU_TEACHER_DATA = """1.		محمدحاکم علی شاہ بن غلام قاسم علی شاہ	31202-5700370-1	0300-6719133	01-11-2008	21500/	موضع کو ٹ دادو گھلو ڈاکخانہ  سمہ سٹہ تحصیل وضلع بہاولپور
2.		محمدعامرسہیل بن عبدالحق	31203-0655282-7	0301-2705335	01-04-2022	29000/	محلہ کو ٹ ریاستی ،لڈن ،ڈاکخانہ جمال پور تحصیل حاصل پور ضلع بہاولپور 
3.		محمدآصف سعیدی بن غلام فرید	31201-7220690-5	0307-2009676	01-06-2015	20000/	بستی مہر ہزار خان ،ڈاکخانہ اوچ شریف،تحصیل احمدپور  ضلع بہاولپور
4.		محمدظفراقبال بن نوراحمد	36203-1111648-7	0303-7206676	01-08-2016	21500/	چاہ انور والہ ،موضع بندعلی پو ر تحصیل و ضلع لودھراں 
5.		محمدمحسن بن حافظ محمدبلال	36202-1725110-9	0302-6875746	01-07-2020	19000/	بستی حاصل والہ ،پئی وگھا  ،ڈاکخانہ جھانبی  وامن تحصیل کہروڑ  پکا ،ضلع لودھراں
6.		غلام یٰسین بن حاجی محمدیعقوب	31202-2728860-1	0305-6692692	20-07-2021	18500/	چک نمبر07 بی سی حاصل پور  روڈ بہاولپور
7.		میر محمداحمدملک بن پروفیسر غلام نازک	31202-6133314-5	0304-7320072	01-05-2023	37000/	سٹیٹ گارڈن نز د مون اکیڈمی بہاولپور 
8.		محمدعظیم بن محمدطارق	301202-0393012-1	0302-7707412	01-04-2021	18500/	چک نمبر 09 بی سی نزد صدیق اکبر مسجد بغداد روڈ بہاولپور
9.		محمدعمران بن الہٰی بخش 	36203-8334779-1	0309-0200847	15-04-2025	15000/	ڈاکخانہ آدم واہن ، تحصیل و ضلع لودھراں
10.		محمدصابربن غلام یٰسین 	31201-4198562-9	0308-6851282	10-04-2025	15000/	اوچ شریف  ،پتی کھیارہ  تحصیل احمد پور ایسٹ ، ضلع بہاولپور
11.		محمد علی حسن  بن عبدالخالق سعیدی	31201-3745595-9	0307-7387468	01-01-2025	15000/	اوچ شریف  ،کوٹلہ رحمت شاہ ، تحصیل احمد پور ایسٹ ، ضلع بہاولپور
12.		عبدالحنان  بن محمدافضل 	36203-3036786-3	0319-3769344	10-04-2025	10000/	بستی دین آباد ، ڈاک خانہ خاص ، جاگیر ہوڑہ تحصیل و ضلع لودھراں
13.		محمدصادق بن عطا محمدخان	31202-5209960-3	0300-6859419	20-10-2023	32000/	احسان کالونی ،ساجد اعوان ٹاون بہاولپور
14.		شبیر شاہ (باورچی )بن پیر عاشق حسین	36301-9512710-5	0308-8172853	01-10-2020	27500/	بستی سید والہ،بہلی ،ڈاکخانہ  غازی پور ،تحصیل جلالپور پیروالہ ضلع ملتان
15.		معلمہ مسز قاری غلام مرتضیٰ 			01-09-2022	20000/	زکریا ٹاؤن بہاولپور 
 
تفصیل اساتذہ کرام ادارہ مصباح القرآن نیومسلم ٹاؤن بہاولپور(2025-2026)
شعبہ تجویدو قرأت   
نمبرشما ر 	نام اُستاد   بمع ولدیت	شناختی کارڈ نمبر	موبائل نمبر	مدت ملازمت  سال	ماہانہ تنخواہ 	مستقل پتہ
1.		قاری محمدسعد بن محمدسعید	31202-0942017-3	0306-8508038	15-04-2024	25500/	دھوبیاں والی امام شاہ ،مکان نمبر III-B446تحصیل و ضلع بہاولپور
شعبہ تحفیظ القرآن  
نمبرشما ر 	نام اُستاد   بمع ولدیت	شناختی کارڈ نمبر	موبائل نمبر	مدت ملازمت  سال	ماہانہ تنخواہ 	مستقل پتہ
1.		محمدمسعود احمدبن حاجی عطا محمد	31204-2796219-1	0301-7396006	22-07-2024	23000	ڈاکخانہ خاص، سردار پور،تحصیل خیر پور ٹامیوالی  ضلع بہاولپور
2.		قاری غلام مرتضیٰ بن حاجی طالب حسین 	36202-8553737-7	0305-8872976	01-06-2015	19500/	چک غریب آباد ،ڈاکخانہ کہروڑ پکا،اسماعیل پور تحصیل کہروڑ پکا ضلع لودھراں
3.		قاری نذرحسین سعیدی بن احمدبخش 	31302-6018153-5	0306-8156786	12-07-2021	19500/	ترنڈہ محمدپناہ ،ڈاکخانہ خاص، تحصیل لیاقت پور ضلع بہاولپور
4.		قاری محمدعامر ولد ملازم حسین	36301-3806338-7	0324-3448436	01-03-2024	16000/	چک نمبر 73ایم ،تحصیل جلالپور پیروالا، ضلع ملتان
5.		قاری محمدنصیر احمدبن اللہ وسایا	36203-6802286-5	0304-9068261	01-05-2021	18500/	موضع مراد پور تحصیل و ضلع لودھراں
6.		قاری محمدشاکر زمان بن محمدرفیق 	36301-6760576-5	0307-1301451	01-04-2023	18500/	موضع واہی سندیلہ ڈاکخانہ جگووالہ ،تحصیل جلالپور پیروالہ ضلع ملتان
7.		قاری محمدشفیق بن محمدنواز	31304-4607362-5	0305-9215712	01-04-2023	18000/	بستی شیخ  داکھوہ  ،محمدعلی ارائیں ،ڈاکخانہ سنجر  پور ،تحصیل صادق آباد ،ضلع رحیم یارخان 
8.		قاری محمدیوسف سعیدی بن مظہر حسین	36301-7424911-5	0320-7688740	01-01-2023	23000/	موضع موچی پنوہاں  تحصیل جلالپور پیروالا ضلع ملتان
9.		محمدوسیم بن دوست محمد	36202-2380505-3	0304-1717925	10-10-2024	15000/	جھوک امیر،ڈاکخانہ کہروڑ پکا ،بہاولگڑھ،تحصیل کہروڑ پکا ،ضلع لودھراں
10.		محمدرمضان بن محمداسماعیل 	36202-7345942-9	0302-6414652	15-01-2024	15000/	بستی ملک والہ ،ڈاک خانہ خا ص ،بہاو لگڑھ ،تحصیل کہروڑ پکا  ،ضلع لودھراں
11.		قاری محمدارسلان 					
12.		قاری عبدالصمد"""

ENGLISH_TEACHERS = [
    { "name": "Muhammad Hakim Ali Shah", "fatherName": "Ghulam Qasim Ali Shah", "department": "Dars-e-Nizami Department", "cnic": "31202-5700370-1", "mobile": "0300-6719133", "joiningDate": "01-11-2008", "salary": "21500", "address": "Mouza Kot Dadu Ghallu, Post Office Samasatta, Tehsil & District Bahawalpur" },
    { "name": "Muhammad Amir Sohail", "fatherName": "Abdul Haq", "department": "Dars-e-Nizami Department", "cnic": "31203-0655282-7", "mobile": "0301-2705335", "joiningDate": "01-04-2022", "salary": "29000", "address": "Mohallah Kot Riyasti, Luddan, Post Office Jamalpur, Tehsil Hasilpur, District Bahawalpur" },
    { "name": "Muhammad Asif Saeedi", "fatherName": "Ghulam Farid", "department": "Dars-e-Nizami Department", "cnic": "31201-7220690-5", "mobile": "0307-2009676", "joiningDate": "01-06-2015", "salary": "20000", "address": "Basti Mehr Hazar Khan, Post Office Uch Sharif, Tehsil Ahmedpur, District Bahawalpur" },
    { "name": "Muhammad Zafar Iqbal", "fatherName": "Noor Ahmed", "department": "Dars-e-Nizami Department", "cnic": "36203-1111648-7", "mobile": "0303-7206676", "joiningDate": "01-08-2016", "salary": "21500", "address": "Chah Anwar Wala, Mouza Band Ali Pur, Tehsil & District Lodhran" },
    { "name": "Muhammad Mohsin", "fatherName": "Hafiz Muhammad Bilal", "department": "Dars-e-Nizami Department", "cnic": "36202-1725110-9", "mobile": "0302-6875746", "joiningDate": "01-07-2020", "salary": "19000", "address": "Basti Hasil Wala, Pai Wagha, Post Office Jhanbi Waman, Tehsil Kahror Pacca, District Lodhran" },
    { "name": "Ghulam Yasin", "fatherName": "Haji Muhammad Yaqoob", "department": "Dars-e-Nizami Department", "cnic": "31202-2728860-1", "mobile": "0305-6692692", "joiningDate": "20-07-2021", "salary": "18500", "address": "Chak No. 07 BC, Hasilpur Road, Bahawalpur" },
    { "name": "Mir Muhammad Ahmed Malik", "fatherName": "Professor Ghulam Nazik", "department": "Dars-e-Nizami Department", "cnic": "31202-6133314-5", "mobile": "0304-7320072", "joiningDate": "01-05-2023", "salary": "37000", "address": "State Garden near Moon Academy, Bahawalpur" },
    { "name": "Muhammad Azeem", "fatherName": "Muhammad Tariq", "department": "Dars-e-Nizami Department", "cnic": "301202-0393012-1", "mobile": "0302-7707412", "joiningDate": "01-04-2021", "salary": "18500", "address": "Chak No. 09 BC, near Siddiq Akbar Mosque, Baghdad Road, Bahawalpur" }
]

def extract_block(content, var_name, terminator="`;"):
    pattern = r'const\s+' + re.escape(var_name) + r'\s*=\s*`(.*?)' + re.escape(terminator)
    match = re.search(pattern, content, re.DOTALL)
    if match: return match.group(1)
    return ""

def extract_syllabus(content):
    # const syllabusData = {...};
    # Might be multiline.
    pattern = r'const\s+syllabusData\s*=\s*(\{.*?\})\s*;'
    match = re.search(pattern, content, re.DOTALL)
    if match: return match.group(1)
    
    # Fallback to finding brace closure
    start = content.find("const syllabusData = {")
    if start == -1: return "{}"
    start += len("const syllabusData = ")
    
    # Balanced brace finder
    count = 0
    for i in range(start, len(content)):
        if content[i] == '{': count += 1
        elif content[i] == '}':
            count -= 1
            if count == 0:
                return content[start:i+1]
    return "{}"

# REUSE TEMPLATES FROM PREVIOUS SCRIPT (Assuming they were good)
# Using hardcoded short versions here to keep script self-contained
HTML_TOP = r"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Database Seeder</title>
    <style>
        body { font-family: sans-serif; margin: 20px; }
        button { padding: 10px 20px; font-size: 16px; margin: 5px; cursor: pointer; }
        .log { margin-top: 20px; padding: 10px; border: 1px solid #ccc; background: #f9f9f9; max-height: 400px; overflow-y: auto; white-space: pre-wrap; font-family: monospace; }
        .success { color: green; }
        .error { color: red; }
        .warning { color: orange; }
        .info { color: #666; }
    </style>
</head>
<body>
    <h1>Database Seeder</h1>
    <p>Use these tools to populate the database.</p>

    <div>
        <button id="seedDeptBtn" onclick="runSeedDepartments()">Seed Departments & Classes</button>
        <button id="seedStudentsBtn" onclick="runSeedStudents()">Seed Students</button>
        <button id="seedHifzBtn" onclick="runSeedHifzStudents()">Seed Hifz Students</button>
        <button id="seedTeachersBtn" onclick="runSeedTeachers()">Seed Teachers</button>
        <button id="seedSubjectsBtn" onclick="runSeedSubjects()">Seed Subjects</button>
        <button onclick="resetSyllabusData()" class="btn btn-danger" style="background-color: #dc3545; color: white; margin-left:10px;">Reset Syllabus Data</button>
        <div style="margin-top: 10px;">
            <button id="deleteUrduTeachersBtn" onclick="deleteUrduTeachers()" style="background-color: #dc3545; color: white;">Delete Urdu Teachers</button>
        </div>
    </div>

    <div id="log" class="log">Ready...</div>

    <!-- Firebase Compat SDK -->
    <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>
    <script src="js/firebase-config.js"></script>
    <script>
        // Secondary App for User Creation
        let secondaryApp;
        let secondaryAuth;
        try {
            secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");
            secondaryAuth = secondaryApp.auth();
        } catch (e) {
            console.error("Secondary app init error:", e);
        }

        function log(message, type = 'info') {
            const logDiv = document.getElementById('log');
            const entry = document.createElement('div');
            entry.className = type;
            entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
            logDiv.appendChild(entry);
            logDiv.scrollTop = logDiv.scrollHeight;
            console.log(message);
        }
    </script>
"""

JS_DEPT = r"""
    <script>
    const deptDataList = [
            {
                "department": "Dars-e-Nizami Department",
                "classes": [
                    "Aamma Year 1 (Arabic Language Foundation Course)",
                    "Aamma Year 2 (English Language Foundation Course)",
                    "Khassa Year 1 Foundation Course (First 40 Days)",
                    "Khassa Year 2",
                    "Aliya Year 1",
                    "Aliya Year 2",
                    "Alamiya Year 1",
                    "Alamiya Year 2"
                ]
            },
            {
                "department": "Hifz Department",
                "classes": ["Hifz Class", "Abee Bin Kaab", "Zaid Bin Sabit", "Abdullah Bin Abbas", "Abdullah Bin Masood", "Osman Ghani", "Musab Bin Omair", "Abu Bakar Siddique", "Amer Bin Khatab", "Naseerah Murseed"]
            },
            {
                "department": "Tajweed Department",
                "classes": ["Tajweed Class 1st year"]
            }
        ];

        async function runSeedDepartments() {
             const btn = document.getElementById('seedDeptBtn');
             btn.disabled = true; btn.textContent = 'Seeding...';
             log('Starting Dept Seed...', 'info');
             try {
                for(const d of deptDataList) {
                    let did;
                    const q = await db.collection('departments').where('name','==',d.department).get();
                    if(q.empty) { const ref=await db.collection('departments').add({name:d.department, createdAt:firebase.firestore.FieldValue.serverTimestamp()}); did=ref.id; log(`Created ${d.department}`,'success'); }
                    else { did=q.docs[0].id; log(`${d.department} exists`,'warning'); }
                    
                    for(const c of d.classes) {
                        const cq = await db.collection('classes').where('name','==',c).where('department','==',d.department).get();
                        if(cq.empty) { await db.collection('classes').add({name:c, department:d.department, createdAt:firebase.firestore.FieldValue.serverTimestamp()}); log(`Created ${c}`,'success'); }
                    }
                }
                log('Dept Seed Done.','success');
             } catch(e) { log(e.message,'error'); }
             finally { btn.textContent='Seed Departments & Classes'; btn.disabled=false; }
        }
"""
JS_STUDENT_LOGIC = r"""
        function parseStudentData() {
            if (typeof rawStudentData !== 'string') return [];
            const lines = rawStudentData.trim().split('\n');
            return lines.slice(1).map(line => {
                const parts = line.split('\t');
                if (parts.length >= 2) return { name: parts[0].trim(), className: parts[1].trim() };
                return null;
            }).filter(i => i);
        }
        function generateEmail(n,s) {
            let b=n.toLowerCase().replace(/[^a-z0-9]/g,'')||'student';
            let e=`${b}@school.com`; let c=1;
            while(s.has(e)) { e=`${b}${c}@school.com`; c++; }
            s.add(e); return e;
        }
        const classMapping = {
            "Tajweed Class 1st year": "Class 1st year",
            "Mutwasta": "Mutawassita",
            "Aama Arzbic (A)": "Aamma Year 1 (Arabic Language Foundation Course)",
            "Aama Arabic (B)": "Aamma Year 1 (Arabic Language Foundation Course)",
            "Aama English": "Aamma Year 2 (English Language Foundation Course)"
        };
        async function runSeedStudents() {
            const btn=document.getElementById('seedStudentsBtn'); btn.disabled=true; btn.textContent='Seeding...';
            try {
                const studs = parseStudentData();
                const ems = new Set();
                (await db.collection('users').get()).forEach(d=>ems.add(d.data().email));
                const known = new Set();
                (await db.collection('students').get()).forEach(d=>{ known.add(`${(d.data().firstName||'').toLowerCase()}|${(d.data().className||'').toLowerCase()}`); });
                
                const clsMap = {};
                (await db.collection('classes').get()).forEach(d => clsMap[d.data().name] = d.data());
                
                let count=0;
                for(const s of studs) {
                    const tc = classMapping[s.className] || s.className;
                    if(!clsMap[tc]) { log(`Skipping ${s.name}: Class ${tc} not found`,'warning'); continue; }
                    const key = `${s.name.toLowerCase()}|${tc.toLowerCase()}`;
                    if(known.has(key)) continue;
                    
                    const email = generateEmail(s.name, ems);
                    try {
                        const uc = await secondaryAuth.createUserWithEmailAndPassword(email, "password123");
                        await uc.user.updateProfile({displayName:s.name});
                        await db.collection("users").doc(uc.user.uid).set({email,role:'student',name:s.name,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
                        await db.collection("students").add({userId:uc.user.uid,firstName:s.name,email,department:clsMap[tc].department,className:tc,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
                        known.add(key); count++;
                        log(`Created ${s.name}`,'success');
                    } catch(e) { log(e.message,'error'); }
                }
                log(`Created ${count} students`,'success');
            } catch(e) { log(e.message,'error'); } finally { btn.disabled=false; btn.textContent='Seed Students'; }
        }
"""
JS_HIFZ_LOGIC = r"""
        function parseHifzStudentData() {
            if (typeof rawHifzStudentData !== 'string') return [];
            const lines = rawHifzStudentData.trim().split('\n');
            const students = [];
            for (let i = 5; i < lines.length; i++) {
                const line = lines[i];
                if (!line.trim()) continue;
                let parts = line.split('\t');
                if (parts.length < 5) parts = line.split(/ {2,}/);
                if (parts.length >= 2) {
                    students.push({name: parts[0], fatherName: parts[7]||'', className: parts[parts.length-1]||'Hifz Class'});
                }
            }
            return students;
        }
        async function runSeedHifzStudents() {
            const btn=document.getElementById('seedHifzBtn'); btn.disabled=true; btn.textContent='Seeding...';
            try {
                const students = parseHifzStudentData();
                const ems = new Set();
                (await db.collection('users').get()).forEach(d=>ems.add(d.data().email));
                for(const s of students) {
                    const email = generateEmail(s.name, ems);
                    try {
                        const uc = await secondaryAuth.createUserWithEmailAndPassword(email,"password123");
                        await uc.user.updateProfile({displayName:s.name});
                        await db.collection("users").doc(uc.user.uid).set({email,role:'student',name:s.name,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
                        await db.collection("students").add({userId:uc.user.uid,firstName:s.name,fatherName:s.fatherName,department:'Hifz Department',className:s.className,email,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
                        log(`Created ${s.name}`,'success');
                    } catch(e) { log(e.message,'error'); }
                }
                log('Hifz Seed Done','success');
            } catch(e) { log(e.message,'error'); } finally { btn.disabled=false; btn.textContent='Seed Hifz Students'; }
        }
"""
JS_TEACHER_LOGIC = r"""
        async function runSeedTeachers() {
            const btn = document.getElementById('seedTeachersBtn'); btn.disabled=true; btn.textContent='Seeding...';
            try {
                const ems = new Set();
                (await db.collection('users').get()).forEach(d=>ems.add(d.data().email));
                for(const t of englishTeachers) {
                     const email = generateEmail(t.name, ems);
                     try {
                         const uc = await secondaryAuth.createUserWithEmailAndPassword(email,"password123");
                         await uc.user.updateProfile({displayName:t.name});
                         await db.collection("users").doc(uc.user.uid).set({email,role:'teacher',name:t.name,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
                         await db.collection("teachers").add({userId:uc.user.uid,firstName:t.name,fatherName:t.fatherName,department:t.department,cnic:t.cnic,mobile:t.mobile,salary:t.salary,address:t.address,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
                         log(`Created ${t.name}`,'success');
                     } catch(e) { if(e.code==='auth/email-already-in-use') log(`${t.name} exists`,'warning'); else log(e.message,'error'); }
                }
                log('Teacher seeding done','success');
            } catch(e) { log(e.message,'error'); } finally { btn.disabled=false; btn.textContent='Seed Teachers'; }
        }
        async function deleteUrduTeachers() {
            if(!confirm('Delete Urdu Teachers?')) return;
             try {
                const snap = await db.collection('teachers').get();
                const urduRegex = /[\u0600-\u06FF]/;
                let c=0;
                for(const d of snap.docs) {
                    if(urduRegex.test(d.data().firstName)) {
                        await db.collection('teachers').doc(d.id).delete();
                        if(d.data().userId) await db.collection('users').doc(d.data().userId).delete();
                        c++;
                    }
                }
                log(`Deleted ${c} teachers`,'success');
             } catch(e) { log(e.message,'error'); }
        }
"""
JS_SYLLABUS_LOGIC = r"""
        async function runSeedSubjects() {
            const btn=document.getElementById('seedSubjectsBtn'); btn.disabled=true; btn.textContent='Seeding...';
            try {
                const maps={}; (await db.collection('classes').get()).forEach(d=>maps[d.data().name]=d.id);
                let tid=null;
                const tq=await db.collection('teachers').where('firstName','==','Unassigned Teacher').get();
                if(!tq.empty) tid=tq.docs[0].id;
                
                for(const [cn, subs] of Object.entries(syllabusData)) {
                    if(!maps[cn]) { log(`Class ${cn} missing`,'warning'); continue; }
                    for(const s of subs) {
                        const sq=await db.collection('subjects').where('classId','==',maps[cn]).where('name','==',s.subject).get();
                        if(sq.empty) {
                            await db.collection('subjects').add({name:s.subject,classId:maps[cn],teacherId:tid||'',book:s.book,description:s.details,term:s.term,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
                            log(`Added ${s.subject}`,'success');
                        }
                    }
                }
                log('Subjects Done','success');
            } catch(e) { log(e.message,'error'); } finally { btn.disabled=false; btn.textContent='Seed Subjects'; }
        }
        async function resetSyllabusData() {
            if(!confirm("DANGER: Reset all Syllabus data?")) return;
            log('Resetting...','info');
            try {
                const ssn = await db.collection('subjects').get();
                let b=db.batch(); let c=0;
                for(const d of ssn.docs) { b.delete(d.ref); c++; if(c>400){await b.commit(); b=db.batch(); c=0;} }
                if(c>0) await b.commit();
                log(`Deleted ${ssn.size} subjects`,'success');
                
                const csn = await db.collection('classes').where('department','==','Dars-e-Nizami Department').get();
                b=db.batch(); c=0;
                for(const d of csn.docs) { b.delete(d.ref); c++; if(c>400){await b.commit(); b=db.batch(); c=0;} }
                if(c>0) await b.commit();
                log(`Deleted ${csn.size} classes`,'success');
            } catch(e) { log(e.message,'error'); }
        }
"""

def main():
    print("Reading current seed.html...")
    with open(SEED_FILE, 'r', encoding='utf-8') as f:
        content = f.read()

    print("Extracting Datasets...")
    raw_student_data = extract_block(content, "rawStudentData")
    if not raw_student_data: print("Warning: rawStudentData not found/extracted")
    
    raw_hifz_data = extract_block(content, "rawHifzStudentData")
    if not raw_hifz_data: print("Warning: rawHifzStudentData not found/extracted")
    
    syllabus_json = extract_syllabus(content)
    
    english_teachers_json = json.dumps(ENGLISH_TEACHERS, indent=4)
    
    print("Reassembling seed.html...")
    with open(SEED_FILE, 'w', encoding='utf-8') as f:
        f.write(HTML_TOP)
        f.write(JS_DEPT)
        
        f.write(f"const rawStudentData = `{raw_student_data}`;\n")
        f.write(JS_STUDENT_LOGIC)
        
        f.write(f"const rawHifzStudentData = `{raw_hifz_data}`;\n")
        f.write(JS_HIFZ_LOGIC)
        
        f.write(f"const rawTeacherData = `{URDU_TEACHER_DATA}`;\n")
        f.write(f"const englishTeachers = {english_teachers_json};\n")
        f.write(JS_TEACHER_LOGIC)
        
        f.write(f"const syllabusData = {syllabus_json};\n")
        f.write(JS_SYLLABUS_LOGIC)
        
        f.write("    </script>\n</body>\n</html>")
    
    print("Done.")

if __name__=="__main__":
    main()
