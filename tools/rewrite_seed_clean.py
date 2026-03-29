
import re
import json
import os

SEED_FILE = r"e:\idara school softwear\seed.html"
V2_SYLLABUS_FILE = r"e:\idara school softwear\tools\syllabus_structure_v2.json"

# --- Clean JS Templates ---

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

    <!-- App Configuration -->
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
"""

JS_DEPT_DATA_AND_FUNC = r"""
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
            btn.disabled = true;
            btn.textContent = 'Seeding Departments...';
            log('Starting Department seed process...', 'info');

            try {
                for (const deptData of deptDataList) {
                    let deptId;
                    const deptQuery = await db.collection('departments').where('name', '==', deptData.department).get();

                    if (!deptQuery.empty) {
                        deptId = deptQuery.docs[0].id;
                        log(`Department "${deptData.department}" already exists.`, 'warning');
                    } else {
                        const docRef = await db.collection('departments').add({
                            name: deptData.department,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        deptId = docRef.id;
                        log(`Created Department: "${deptData.department}"`, 'success');
                    }

                    for (const className of deptData.classes) {
                        const classQuery = await db.collection('classes')
                            .where('name', '==', className)
                            .where('department', '==', deptData.department)
                            .get();

                        if (!classQuery.empty) {
                            log(`Class "${className}" already exists in ${deptData.department}.`, 'warning');
                        } else {
                            await db.collection('classes').add({
                                name: className,
                                department: deptData.department,
                                createdAt: firebase.firestore.FieldValue.serverTimestamp()
                            });
                            log(`Created Class: "${className}"`, 'success');
                        }
                    }
                }
                log('Department seed process completed successfully!', 'success');
            } catch (error) {
                log(`Error: ${error.message}`, 'error');
                console.error(error);
            } finally {
                btn.disabled = false;
                btn.textContent = 'Seed Departments & Classes';
            }
        }
"""

JS_STUDENT_LOGIC = r"""
        function parseStudentData() {
            if (typeof rawStudentData !== 'string') return [];
            const lines = rawStudentData.trim().split('\n');
            return lines.slice(1).map(line => {
                const parts = line.split('\t');
                if (parts.length >= 2) {
                    return {
                        name: parts[0].trim(),
                        className: parts[1].trim()
                    };
                }
                return null;
            }).filter(item => item);
        }

        function generateEmail(name, existingEmails) {
            let base = name.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!base) base = 'student';
            let email = `${base}@school.com`;
            let counter = 1;
            while (existingEmails.has(email)) {
                email = `${base}${counter}@school.com`;
                counter++;
            }
            existingEmails.add(email);
            return email;
        }

        const classMapping = {
            "Tajweed Class 1st year": "Class 1st year",
            "Mutwasta": "Mutawassita",
            "Aama Arzbic (A)": "Aamma Year 1 (Arabic Language Foundation Course)",
            "Aama Arabic (B)": "Aamma Year 1 (Arabic Language Foundation Course)",
            "Aama English": "Aamma Year 2 (English Language Foundation Course)"
        };

        async function runSeedStudents() {
            const btn = document.getElementById('seedStudentsBtn');
            btn.disabled = true;
            btn.textContent = 'Seeding Students...';
            log('Starting Student seed process...', 'info');

            const students = parseStudentData();
            const existingEmails = new Set();
            const existingStudentsSet = new Set();

            try {
                const usersSnap = await db.collection('users').get();
                usersSnap.forEach(doc => { existingEmails.add(doc.data().email); });
                
                const studentsSnap = await db.collection('students').get();
                studentsSnap.forEach(doc => {
                    const s = doc.data();
                    const key = `${(s.firstName||'').toLowerCase()}|${(s.className||'').toLowerCase()}`;
                    existingStudentsSet.add(key);
                });

                const classesSnapshot = await db.collection('classes').get();
                const classInfoMap = {};
                classesSnapshot.forEach(doc => {
                    const d = doc.data();
                    classInfoMap[d.name] = { department: d.department, id: doc.id };
                });

                let successCount = 0;
                let skipCount = 0;

                for (const student of students) {
                    const targetClass = classMapping[student.className] || student.className;
                    const classInfo = classInfoMap[targetClass];

                    if (!classInfo) {
                        log(`Skipping ${student.name}: Class "${targetClass}" not found.`, 'warning');
                        continue;
                    }

                    const studentKey = `${student.name.toLowerCase()}|${targetClass.toLowerCase()}`;
                    if (existingStudentsSet.has(studentKey)) {
                        log(`Skipping ${student.name}: Already exists.`, 'warning');
                        skipCount++;
                        continue;
                    }

                    const email = generateEmail(student.name, existingEmails);

                    try {
                        const userCredential = await secondaryAuth.createUserWithEmailAndPassword(email, "password123");
                        const user = userCredential.user;
                        await user.updateProfile({ displayName: student.name });

                        await db.collection("users").doc(user.uid).set({
                            email: email, role: 'student', name: student.name, createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        });

                        await db.collection("students").add({
                            userId: user.uid, firstName: student.name,
                            email: email, department: classInfo.department, className: targetClass,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        log(`Created: ${student.name}`, 'success');
                        successCount++;
                        existingStudentsSet.add(studentKey);
                    } catch (err) {
                        log(`Error: ${err.message}`, 'error');
                    }
                }
                log(`Student seeding done. Created: ${successCount}`, 'success');
            } catch (error) {
                log(`Fatal Error: ${error.message}`, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Seed Students';
            }
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
                    const name = parts[0];
                    const fatherName = parts[7] || '';
                    const className = parts[parts.length-1] || 'Hifz Class';
                    students.push({name, fatherName, className});
                }
            }
            return students;
        }

        async function runSeedHifzStudents() {
            const btn = document.getElementById('seedHifzBtn');
            btn.disabled = true;
            btn.textContent = 'Seeding Hifz...';
            log('Starting Hifz Seed...', 'info');

            try {
                const students = parseHifzStudentData();
                const existingEmails = new Set();
                (await db.collection('users').get()).forEach(d => existingEmails.add(d.data().email));

                for (const student of students) {
                   const email = generateEmail(student.name, existingEmails);
                   try {
                       const uc = await secondaryAuth.createUserWithEmailAndPassword(email, "password123");
                       await uc.user.updateProfile({ displayName: student.name });
                       await db.collection("users").doc(uc.user.uid).set({
                           email, role: 'student', name: student.name, createdAt: firebase.firestore.FieldValue.serverTimestamp()
                       });
                       await db.collection("students").add({
                           userId: uc.user.uid, firstName: student.name, fatherName: student.fatherName,
                           department: 'Hifz Department', className: student.className, email,
                           createdAt: firebase.firestore.FieldValue.serverTimestamp()
                       });
                       log(`Created Hifz: ${student.name}`, 'success');
                   } catch (e) { log(e.message, 'error'); }
                }
                log('Hifz Seeding Done', 'success');
            } catch (e) { log(e.message, 'error'); }
            finally { btn.disabled = false; btn.textContent = 'Seed Hifz Students'; }
        }
"""

JS_TEACHER_LOGIC = r"""
        async function runSeedTeachers() {
            const btn = document.getElementById('seedTeachersBtn');
            btn.disabled = true;
            btn.textContent = 'Seeding Teachers...';
            log('Starting Teacher Seed...', 'info');
            
            try {
                const existingEmails = new Set();
                (await db.collection('users').get()).forEach(d => existingEmails.add(d.data().email));
                
                for (const t of englishTeachers) {
                    if (!t.name) continue;
                    const email = generateEmail(t.name, existingEmails);
                    try {
                         const uc = await secondaryAuth.createUserWithEmailAndPassword(email, "password123");
                         await uc.user.updateProfile({ displayName: t.name });
                         
                         await db.collection("users").doc(uc.user.uid).set({
                            email, role: 'teacher', name: t.name, createdAt: firebase.firestore.FieldValue.serverTimestamp()
                         });
                         
                         await db.collection("teachers").add({
                             userId: uc.user.uid, firstName: t.name, fatherName: t.fatherName,
                             department: t.department, cnic: t.cnic, mobile: t.mobile, salary: t.salary, address: t.address,
                             createdAt: firebase.firestore.FieldValue.serverTimestamp()
                         });
                         log(`Created Teacher: ${t.name}`, 'success');
                    } catch (e) { log(e.message, 'error'); }
                }
                log('Teacher Seeding Completed.', 'success');
            } catch (e) { log(e.message, 'error'); }
            finally { btn.disabled = false; btn.textContent = 'Seed Teachers'; }
        }

        async function deleteUrduTeachers() {
             if(!confirm('Delete Urdu Teachers?')) return;
             log('Deleting Urdu Teachers...', 'info');
             try {
                const snapshot = await db.collection('teachers').get();
                const urduRegex = /[\u0600-\u06FF]/;
                let count = 0;
                for(const doc of snapshot.docs) {
                    const data = doc.data();
                    if(urduRegex.test(data.firstName)) {
                        await db.collection('teachers').doc(doc.id).delete();
                        if(data.userId) await db.collection('users').doc(data.userId).delete();
                        log(`Deleted ${data.firstName}`, 'warning');
                        count++;
                    }
                }
                log(`Deleted ${count} teachers.`, 'success');
             } catch(e) { log(e.message, 'error'); }
        }
"""

JS_SYLLABUS_LOGIC = r"""
        async function runSeedSubjects() {
            const btn = document.getElementById('seedSubjectsBtn');
            btn.disabled = true;
            btn.textContent = 'Seeding Subjects...';
            log('Starting Subject Seed...', 'info');

            try {
                const classesSnap = await db.collection('classes').get();
                const classMap = {};
                classesSnap.forEach(d => classMap[d.data().name] = d.id);

                let unassignedId = null;
                const tSnap = await db.collection('teachers').where('firstName', '==', 'Unassigned Teacher').get();
                if(!tSnap.empty) unassignedId = tSnap.docs[0].id;
                else log('Unassigned Teacher not found. Subjects will have no teacher.', 'warning');

                for (const [clsName, subjects] of Object.entries(syllabusData)) {
                    const classId = classMap[clsName];
                    if (!classId) {
                        log(`Class ${clsName} not found. Skipping.`, 'warning');
                        continue;
                    }
                    for (const s of subjects) {
                        const exists = await db.collection('subjects').where('classId','==',classId).where('name','==',s.subject).get();
                        if(!exists.empty) {
                            log(`Subject ${s.subject} exists.`, 'warning');
                        } else {
                            await db.collection('subjects').add({
                                name: s.subject, classId: classId, teacherId: unassignedId || '',
                                book: s.book, description: s.details, term: s.term,
                                createdAt: firebase.firestore.FieldValue.serverTimestamp()
                            });
                            log(`Added ${s.subject}`, 'success');
                        }
                    }
                }
                log('Subject Seeding Done', 'success');
            } catch(e) { log(e.message, 'error'); }
            finally { btn.disabled = false; btn.textContent = 'Seed Subjects'; }
        }

        async function resetSyllabusData() {
            if(!confirm("DELETE ALL SUBJECTS and Dars-e-Nizami Classes?")) return;
            log('Resetting...', 'info');
            try {
                const subSnap = await db.collection('subjects').get();
                const batchSize = 400;
                let batch = db.batch();
                let count = 0;
                for(const d of subSnap.docs) {
                    batch.delete(d.ref);
                    count++;
                    if(count>=batchSize) { await batch.commit(); batch = db.batch(); count=0; }
                }
                if(count>0) await batch.commit();
                log(`Deleted ${subSnap.size} subjects.`, 'success');

                const clsSnap = await db.collection('classes').where('department','==','Dars-e-Nizami Department').get();
                batch = db.batch(); count = 0;
                for(const d of clsSnap.docs) {
                    batch.delete(d.ref);
                    count++;
                    if(count>=batchSize) { await batch.commit(); batch = db.batch(); count=0; }
                }
                if(count>0) await batch.commit();
                log(`Deleted ${clsSnap.size} classes.`, 'success');
                
            } catch(e) { log(e.message, 'error'); }
        }
"""

def extract_data_block(content, var_name, terminator="`;"):
    # Pattern: const var_name = `...`;
    pattern = r'const\s+' + re.escape(var_name) + r'\s*=\s*`(.*?)' + re.escape(terminator)
    match = re.search(pattern, content, re.DOTALL)
    if match:
         return match.group(1)
    return ""

def extract_json_block(content, var_name):
    # Pattern: const var_name = [...];
    # Finding matching brackets is hard with regex. 
    # Use simple start and manual bracket counting or just assume layout.
    # Assuming array [ ... ];
    start_pattern = r'const\s+' + re.escape(var_name) + r'\s*=\s*\['
    match = re.search(start_pattern, content)
    if not match: return "[]"
    
    start_idx = match.end() - 1 # include [
    # Count brackets
    count = 0
    for i in range(start_idx, len(content)):
        char = content[i]
        if char == '[': count += 1
        elif char == ']': 
            count -= 1
            if count == 0:
                return content[start_idx:i+1]
    return "[]"

def main():
    print("Reading seed.html...")
    with open(SEED_FILE, 'r', encoding='utf-8') as f:
        content = f.read()

    print("Extracting Data...")
    raw_student_data = extract_data_block(content, "rawStudentData")
    # Clean up double newlines if present
    raw_student_data = re.sub(r'\n\s*\n', '\n', raw_student_data)
    
    raw_hifz_data = extract_data_block(content, "rawHifzStudentData")
    
    english_teachers_json = extract_json_block(content, "englishTeachers")
    
    raw_teacher_data = extract_data_block(content, "rawTeacherData")
    
    # Load Syllabus
    with open(V2_SYLLABUS_FILE, 'r', encoding='utf-8') as f:
        syllabus_v2 = json.load(f)
    syllabus_json_str = json.dumps(syllabus_v2, indent=2)

    # Assemble
    new_content = []
    new_content.append(HTML_TOP)
    
    new_content.append(JS_DEPT_DATA_AND_FUNC)
    
    new_content.append(f"const rawStudentData = `{raw_student_data}`;")
    new_content.append(JS_STUDENT_LOGIC)
    
    new_content.append(f"const rawHifzStudentData = `{raw_hifz_data}`;")
    new_content.append(JS_HIFZ_LOGIC)
    
    new_content.append(f"const rawTeacherData = `{raw_teacher_data}`;")
    new_content.append(f"const englishTeachers = {english_teachers_json};")
    new_content.append(JS_TEACHER_LOGIC)
    
    new_content.append(f"const syllabusData = {syllabus_json_str};")
    new_content.append(JS_SYLLABUS_LOGIC)
    
    new_content.append("    </script>\n</body>\n</html>")
    
    print("Writing new seed.html...")
    with open(SEED_FILE, 'w', encoding='utf-8') as f:
        # Check for weird null bytes?
        final_str = "\n".join(new_content)
        f.write(final_str)

if __name__ == "__main__":
    main()
