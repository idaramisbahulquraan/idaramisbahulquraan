import os

def update_seed_html():
    file_path = r'e:\idara school softwear\seed.html'
    
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    start_marker = "const rawSubjectData ="
    end_marker = "function parseTeacherData() {"
    
    start_index = -1
    end_index = -1
    
    for i, line in enumerate(lines):
        if start_marker in line:
            start_index = i
        if end_marker in line:
            end_index = i
            
    if start_index == -1 or end_index == -1:
        print("Could not find markers.")
        print(f"Start found: {start_index}, End found: {end_index}")
        return

    # Keep lines before start_index
    new_lines = lines[:start_index]
    
    # Insert new content
    # I'll put the JSON content in a separate file or just embedded here?
    # Embedding here is fine, but I need to escape correctly.
    
    new_content = r'''        // New Syllabus Data (JSON Structure)
        const syllabusData = {
  "Foundation / Aama": [
    {
      "subject": "English",
      "book": "Foundation Book (i) Complete Book (ii) Grammar",
      "details": "02",
      "term": "General"
    },
    {
      "subject": "English",
      "book": "The Whispering Pages",
      "details": "Complete Book (i) & (ii) Writing",
      "term": "General"
    },
    {
      "subject": "English",
      "book": "Building Conversation",
      "details": "Chapter 1 & 2",
      "term": "General"
    },
    {
      "subject": "Science",
      "book": "Science",
      "details": "Science: pg 1-70 (2 days/week)",
      "term": "General"
    },
    {
      "subject": "GK",
      "book": "General Knowledge",
      "details": "GK: pg 1-97 (1 day/week)",
      "term": "General"
    },
    {
      "subject": "Math",
      "book": "Mathematics",
      "details": "Math: pg 1-89 (3 days/week)",
      "term": "General"
    },
    {
      "subject": "Morphology (Sarf)",
      "book": "Ilm-us-Seegha",
      "details": "1. Ilm-us-Seegha 2. Khasiyat-e-Abwab",
      "term": "General"
    },
    {
      "subject": "Syntax (Nahw)",
      "book": "(i) Sharh Mi'at Aamil",
      "details": "(ii) Hidayat-un-Nahw (i) Complete (ii) Partial",
      "term": "General"
    },
    {
      "subject": "Fiqh (Jurisprudence)",
      "book": "Noor-ul-Idah",
      "details": "Complete Book",
      "term": "General"
    },
    {
      "subject": "English",
      "book": "English Foundation Book",
      "details": "Listening + Verb (10 daily)",
      "term": "Second Term"
    },
    {
      "subject": "Science",
      "book": "(i) Science",
      "details": "(i) pg 48-78",
      "term": "Second Term"
    },
    {
      "subject": "Islamiyat",
      "book": "(ii) Islamiyat",
      "details": "(ii) Complete",
      "term": "Second Term"
    },
    {
      "subject": "Dictionary",
      "book": "(iii) Al-Qamoos Al-Musawwar",
      "details": "(iii) Complete",
      "term": "Second Term"
    },
    {
      "subject": "English",
      "book": "Building Conversation",
      "details": "Chapters 2 to 10",
      "term": "Second Term"
    },
    {
      "subject": "Math",
      "book": "Mathematics",
      "details": "pg 90-192 (Last 2 months: Tanzeem-ul-Madaris Math)",
      "term": "Second Term"
    },
    {
      "subject": "Morphology (Sarf)",
      "book": "Ilm-us-Seegha",
      "details": "1. Ilm-us-Seegha 2. Khasiyat-e-Abwab",
      "term": "Second Term"
    },
    {
      "subject": "Syntax (Nahw)",
      "book": "Hidayat-un-Nahw",
      "details": "Complete Book",
      "term": "Second Term"
    },
    {
      "subject": "Logic (Mantiq)",
      "book": "Taleem-ul-Mantiq",
      "details": "Complete Book",
      "term": "Second Term"
    }
  ],
  "Khassa Year 1": [
    {
      "subject": "Beliefs (Aqaid)",
      "book": "Al-Aqaid wal-Masail",
      "details": "Mufti Abdul Qayyum Hazarvi Complete Book",
      "term": "General"
    },
    {
      "subject": "Seerah",
      "book": "Seerat Rasool-e-Arabi",
      "details": "Maulana Noor Bakhsh Tawakkali First 4 Chapters",
      "term": "General"
    },
    {
      "subject": "History",
      "book": "Tareekh-ul-Khulafa",
      "details": "Jalaluddin Suyuti Khulafa-e-Rashideen",
      "term": "General"
    },
    {
      "subject": "Refutation of Deviance",
      "book": "(i) Radd-ur-Rafda",
      "details": "(ii) Tibyan-ul-Quran (i) Imam Ahmed Raza Khan (ii) Maulana Ghulam Rasool Saeedi (i) Complete Risala (ii) Vol 9, Surah Ahzab Ayah 9",
      "term": "General"
    },
    {
      "subject": "Refutation of Hadith Denial",
      "book": "(i) Fitna Inkar-e-Hadith",
      "details": "(ii) Sunnat Khair-ul-Anam (i) Maulana Ayub Dehlvi (ii) Pir Karam Shah Al-Azhari Selected Topics",
      "term": "General"
    },
    {
      "subject": "Refutation of Atheism",
      "book": "(i) Al-Ilhad",
      "details": "(ii) Jadid Ilhad (i) Muhammad Mubashir Nazir (ii) Mufti Muhammad Raza Qadri Selected Topics",
      "term": "General"
    },
    {
      "subject": "Fiqh",
      "book": "Mukhtasar Al-Qudoori",
      "details": "Kitab-ul-Hajj to end (Excluding Kitab-ul-Ataq)",
      "term": "First Term"
    },
    {
      "subject": "Usul-e-Fiqh",
      "book": "(i) Usool-al-Shashi",
      "details": "(ii) Tareekh Fiqh (i) Complete Book (ii) Complete Book",
      "term": "First Term"
    },
    {
      "subject": "Syntax (Nahw)",
      "book": "(i) Kafiya",
      "details": "(ii) An-Nahw Al-Wadih (i) pg 1-50 (Ibn Hajib) (ii) Part 2 + 3",
      "term": "First Term"
    },
    {
      "subject": "Rhetoric (Balagha)",
      "book": "Duroos-ul-Balagha",
      "details": "Complete Book",
      "term": "First Term"
    },
    {
      "subject": "Hadith Sciences",
      "book": "(i) Uloom-ul-Hadith",
      "details": "(ii) Tareekh Kitabat-e-Hadith Selected portions (Dr. Subhi Saleh / Mufti Muhammad Taqi Usmani / Madina Ilmiya)",
      "term": "First Term"
    },
    {
      "subject": "Computer",
      "book": "Introduction to Computer",
      "details": "Selected Portions (Larry Lang)",
      "term": "First Term"
    },
    {
      "subject": "Logic",
      "book": "Mirqat",
      "details": "Complete Book (95 pages)",
      "term": "Second Term"
    },
    {
      "subject": "Syntax (Nahw)",
      "book": "Kafiya",
      "details": "Page 50 to End",
      "term": "Second Term"
    },
    {
      "subject": "Hadith",
      "book": "Riyad-us-Saliheen",
      "details": "Kitab-ul-Adab to End",
      "term": "Second Term"
    },
    {
      "subject": "Fiqh",
      "book": "(i) Fiqh-e-Islami Ka Pas Manzar",
      "details": "(ii) Tareekh Al-Tashree Al-Islami Selected Topics",
      "term": "Second Term"
    },
    {
      "subject": "Quranic Sciences",
      "book": "(i) Ta'aruf Mutalia Quran",
      "details": "(ii) Mutalia Quran (iii) Quran Translation Selected Topics Para 10 to 18 Translation",
      "term": "Second Term"
    },
    {
      "subject": "Islamic History",
      "book": "Tareekh-e-Islam",
      "details": "Umayyad Era to Ottoman Caliphate",
      "term": "Second Term"
    }
  ],
  "Khassa Year 2": [
    {
      "subject": "Quranic Sciences",
      "book": "(i) Tafseer Jalalain",
      "details": "(ii) Tareekh-e-Hadith/Tafseer (i) Para 19-21 (ii) Intro to Tafseer & Mufassireen (24 pages)",
      "term": "First Term"
    },
    {
      "subject": "Usul-e-Fiqh",
      "book": "(i) Noor-ul-Anwar",
      "details": "(ii) Usul Al-Sharia Al-Islamia (i) Kitabullah, Sunnah, Ijma (ii) Selected Topics",
      "term": "First Term"
    },
    {
      "subject": "Rhetoric (Balagha)",
      "book": "Al-Balagha Al-Wadiha",
      "details": "Selected Exercises",
      "term": "First Term"
    },
    {
      "subject": "Syntax (Nahw)",
      "book": "Sharh Jami",
      "details": "Muqaddimah, Marfooat (pg 11-160)",
      "term": "First Term"
    },
    {
      "subject": "Computer",
      "book": "Introduction to Computer",
      "details": "Selected Topics (Larry Lang)",
      "term": "First Term"
    },
    {
      "subject": "Fiqh",
      "book": "Al-Hidayah (Vol 1)",
      "details": "Kitab-ul-Taharat to Kitab-us-Salah (pg 4-150)",
      "term": "First Term"
    },
    {
      "subject": "Syntax (Nahw)",
      "book": "Sharh Jami",
      "details": "Mansoobat to end of Maf'ool Ma'uh (pg 161-324)",
      "term": "Second Term"
    },
    {
      "subject": "Hadith",
      "book": "(i) Musnad Imam Azam",
      "details": "(i) Start to Kitab-ul-Talaq",
      "term": "Second Term"
    },
    {
      "subject": "Arabic Lit",
      "book": "(ii) Qaseeda Burda Sharif",
      "details": "(ii) Complete",
      "term": "Second Term"
    },
    {
      "subject": "Quranic Sciences",
      "book": "(i) Tafseer Jalalain",
      "details": "(ii) Study of Aqaid (i) Para 22-24 (ii) Selected Verses of Aqaid",
      "term": "Second Term"
    },
    {
      "subject": "Religions",
      "book": "(i) Muqarna-tul-Adyan",
      "details": "(ii) History of Religions Selected Topics (Dr. Ahmad Shalabi / Rasheed Ahmad)",
      "term": "Second Term"
    },
    {
      "subject": "Fiqh",
      "book": "Al-Hidayah (Vol 1)",
      "details": "pg 151-324",
      "term": "Second Term"
    },
    {
      "subject": "Logic",
      "book": "Sharh Tahzeeb",
      "details": "Complete Book (Mullah Abdullah Yazdi)",
      "term": "Second Term"
    }
  ],
  "Aliya Year 1": [
    {
      "subject": "Quranic Sciences",
      "book": "(i) Al-Fauz Al-Kabir",
      "details": "(ii) Tafseer Jalalain (i) Complete Book (ii) Para 25-26",
      "term": "First Term"
    },
    {
      "subject": "Fiqh",
      "book": "Al-Hidayah (Vol 2)",
      "details": "First Half (pg 523-465?)",
      "term": "First Term"
    },
    {
      "subject": "Hadith",
      "book": "Mishkat-ul-Masabih",
      "details": "Kitab-ul-Iman, Ilm, Janaiz to Buyoo (67 pages)",
      "term": "First Term"
    },
    {
      "subject": "Quranic Sciences",
      "book": "(i) Tareekh Tafseer",
      "details": "(ii) Rawa'i Al-Bayan Selected Topics (Tafseer of Ahkam Verses)",
      "term": "First Term"
    },
    {
      "subject": "Dawah",
      "book": "(i) Usool-al-Irshad",
      "details": "(ii) Qawaid-al-Dawah Selected Topics",
      "term": "First Term"
    },
    {
      "subject": "Pol/Eco Thought",
      "book": "(i) Islami Riyasat",
      "details": "Selected Topics (Dr. Hamidullah)",
      "term": "First Term"
    },
    {
      "subject": "Usul-e-Fiqh",
      "book": "(i) Husami",
      "details": "(ii) Al-Wajeez (i) Qiyas to Ahkam (ii) Selected Topics",
      "term": "Second Term"
    },
    {
      "subject": "Arabic Lit",
      "book": "(i) Maqamat Hariri",
      "details": "(i) First 5 Maqamat",
      "term": "Second Term"
    },
    {
      "subject": "Tasawwuf",
      "book": "(ii) Mukashifat-ul-Quloob",
      "details": "(ii) Complete Book",
      "term": "Second Term"
    },
    {
      "subject": "Usul-e-Hadith",
      "book": "(i) Muqaddimah Sheikh Abdul Haq",
      "details": "(ii) Talkhees-ul-Miftah (?) Complete Books",
      "term": "Second Term"
    },
    {
      "subject": "Fiqh",
      "book": "Al-Hidayah (Vol 2)",
      "details": "pg 467-623",
      "term": "Second Term"
    },
    {
      "subject": "Hadith Sciences",
      "book": "Ilm-ul-Jarh wat-Ta'deel",
      "details": "Selected Topics",
      "term": "Second Term"
    },
    {
      "subject": "Takhreej",
      "book": "(i) Tafseer Jalalain",
      "details": "(i) Para 27-30",
      "term": "Second Term"
    },
    {
      "subject": "Quran",
      "book": "(ii) Dirasat fi Usool Takhreej",
      "details": "(ii) Selected Topics",
      "term": "Second Term"
    }
  ],
  "Aliya Year 2": [
    {
      "subject": "Tafseer & Usool",
      "book": "(i) Zubdat-ul-Itqan",
      "details": "(ii) Tafseer Baidawi (i) Complete (180 pages) (ii) First Para half (to pg 134)",
      "term": "First Term"
    },
    {
      "subject": "Rhetoric",
      "book": "Mukhtasar Al-Ma'ani",
      "details": "Bayan & Badee (165 pages)",
      "term": "First Term"
    },
    {
      "subject": "Hadith",
      "book": "Mishkat-ul-Masabih",
      "details": "Kitab-ul-Qisas, Hudood, Adab, Riqaq",
      "term": "First Term"
    },
    {
      "subject": "Fiqh",
      "book": "Al-Hidayah (Vol 3)",
      "details": "Kitab-ul-Buyoo, Adab-ul-Qadi (pg 18-183)",
      "term": "First Term"
    },
    {
      "subject": "Usul-e-Hadith",
      "book": "Tayseer Mustalah-ul-Hadith",
      "details": "Complete Book (175 pages)",
      "term": "First Term"
    },
    {
      "subject": "Culture",
      "book": "Tareekh Tamaddun Islami",
      "details": "Selected Topics",
      "term": "Second Term"
    },
    {
      "subject": "Rhetoric",
      "book": "Mutawwal",
      "details": "Fan Awwal (Ama'at)",
      "term": "Second Term"
    },
    {
      "subject": "Fiqh",
      "book": "Al-Hidayah (Vol 3)",
      "details": "Kitab-ul-Nikah, Ijarah, Ghasab (pg 184-370)",
      "term": "Second Term"
    },
    {
      "subject": "Arabic Lit",
      "book": "(i) Al-Madaih Al-Nabawiya",
      "details": "(ii) Deewan Hamasa (iii) Deewan Mutanabbi (i) Complete Risala (ii) Bab Al-Hamasa (Poem 1-50) (iii) Miscellaneous",
      "term": "Second Term"
    },
    {
      "subject": "Skills / Refutation",
      "book": "(i) Radd-ul-Ilhad / Islamic Software",
      "details": "(ii) Al-Kalimatul Mulhima (i) Selected Topics / Typing (ii) Complete Risala",
      "term": "Second Term"
    },
    {
      "subject": "Philosophy / Debate",
      "book": "(i) Rasheediya (Munazra)",
      "details": "(ii) Hidayat-ul-Hikmah Complete Risalas",
      "term": "Second Term"
    },
    {
      "subject": "Tafseer",
      "book": "Tafseer Baidawi",
      "details": "First Para (pg 135-287)",
      "term": "Second Term"
    }
  ],
  "Alamiya Year 1": [
    {
      "subject": "Ilm-ul-Kalam",
      "book": "Sharh Aqaid Nasafi",
      "details": "Start to \"Al-Istita'ah\"",
      "term": "First Term"
    },
    {
      "subject": "Fiqh",
      "book": "Al-Hidayah (Last Vol)",
      "details": "Zabaih, Udhiyah, Karahiya (pg 391-536)",
      "term": "First Term"
    },
    {
      "subject": "Usul-e-Hadith",
      "book": "Sharh Nukhbat-ul-Fikr",
      "details": "Complete Book (113 pages)",
      "term": "First Term"
    },
    {
      "subject": "Hadith",
      "book": "Sharh Ma'ani Al-Athar (Tahawi)",
      "details": "Kitab-us-Salah Complete",
      "term": "First Term"
    },
    {
      "subject": "Economics",
      "book": "Islam Ka Nizam-e-Bankari",
      "details": "Basics of Islamic Banking (Mufti M. Taqi)",
      "term": "First Term"
    },
    {
      "subject": "Research Methodology",
      "book": "Research & Editing Methods",
      "details": "Selected Topics (Dr. Khaliq Dad Malik)",
      "term": "Second Term"
    },
    {
      "subject": "Usul-e-Fiqh",
      "book": "Tauzeeh wa Talweeh",
      "details": "Bahth Al-Aam",
      "term": "Second Term"
    },
    {
      "subject": "Hadith",
      "book": "(i) Muwatta Imam Malik",
      "details": "(ii) Muwatta Imam Muhammad Selected Chapters",
      "term": "Second Term"
    },
    {
      "subject": "Asma-ur-Rijal",
      "book": "Al-Raf'u wat-Takmil",
      "details": "Complete",
      "term": "Second Term"
    },
    {
      "subject": "Fiqh (Inheritance)",
      "book": "(i) Siraji",
      "details": "(ii) Modern Fiqh Issues (i) Last Chapter (Munaskha) (ii) Selected Topics",
      "term": "Second Term"
    },
    {
      "subject": "Seerah Study",
      "book": "(i) Zia-un-Nabi",
      "details": "(ii) Rahmatul-lil-Alameen Selected Topics",
      "term": "Second Term"
    }
  ],
  "Alamiya Year 2": [
    {
      "subject": "Hadith",
      "book": "Sahih Bukhari",
      "details": "Vol 1",
      "term": "First Term"
    },
    {
      "subject": "Hadith",
      "book": "Sahih Muslim",
      "details": "Vol 2",
      "term": "First Term"
    },
    {
      "subject": "Hadith",
      "book": "Jami Tirmidhi",
      "details": "Abwab-ul-Buyoo to Manaqib/Siyar",
      "term": "First Term"
    },
    {
      "subject": "Hadith",
      "book": "Sunan Abu Dawood",
      "details": "Complete",
      "term": "First Term"
    },
    {
      "subject": "Hadith",
      "book": "Sunan Nasa'i + Takhreej",
      "details": "Complete",
      "term": "First Term"
    },
    {
      "subject": "Fiqh Transactions",
      "book": "Fiqh-ul-Muamalat",
      "details": "Miscellaneous Books/Topics",
      "term": "Second Term"
    },
    {
      "subject": "Hadith",
      "book": "Sahih Bukhari",
      "details": "Vol 1 Remaining + Vol 2 (Kitab-ul-Ikrah, Kitab-ul-Hiyal)",
      "term": "Second Term"
    },
    {
      "subject": "Hadith",
      "book": "Sahih Muslim",
      "details": "Vol 2",
      "term": "Second Term"
    },
    {
      "subject": "Hadith",
      "book": "Athar-us-Sunan",
      "details": "From Beginning to End of Kitab-ul-Witr",
      "term": "Second Term"
    },
    {
      "subject": "Hadith",
      "book": "Ibn Majah + Takhreej",
      "details": "Complete Book",
      "term": "Second Term"
    },
    {
      "subject": "Islamic Economics",
      "book": "Economic System / Banking",
      "details": "Foundations of Islamic Economy & Conventional Banking",
      "term": "Second Term"
    },
    {
      "subject": "Shariah Economics",
      "book": "Miscellaneous Books",
      "details": "Different Topics",
      "term": "Second Term"
    }
  ]
};

        async function runSeedSubjects() {
            const btn = document.getElementById('seedSubjectsBtn');
            btn.disabled = true;
            btn.textContent = 'Seeding Subjects...';
            log('Starting Subject seed process...', 'info');

            try {
                // 1. Ensure Unassigned Teacher exists
                let unassignedTeacherId = null;
                const unassignedName = "Unassigned Teacher";
                
                const teachersQuery = await db.collection('teachers').where('firstName', '==', unassignedName).get();
                if (!teachersQuery.empty) {
                    unassignedTeacherId = teachersQuery.docs[0].id;
                    log(`Using existing '${unassignedName}' (ID: ${unassignedTeacherId})`, 'info');
                } else {
                    const docRef = await db.collection('teachers').add({
                        firstName: unassignedName,
                        lastName: "",
                        email: "unassigned@miq.com",
                        phone: "00000000000",
                        department: "General",
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    unassignedTeacherId = docRef.id;
                    log(`Created '${unassignedName}' (ID: ${unassignedTeacherId})`, 'success');
                }

                // 2. Fetch Classes/Departments map
                const classesSnap = await db.collection('classes').get();
                const classToDept = {};
                if (classesSnap.empty) {
                    throw new Error("No classes found. Please seed departments/classes first.");
                }
                classesSnap.forEach(doc => {
                    const c = doc.data();
                    classToDept[c.name] = c.department;
                });

                let successCount = 0;
                
                for (const [className, subjects] of Object.entries(syllabusData)) {
                    log(`Processing Class: ${className}`, 'info');
                    
                    const deptName = classToDept[className];
                    if (!deptName) {
                        log(`  Warning: Class '${className}' not found in DB. Skipping subjects.`, 'warning');
                        continue;
                    }

                    for (const subj of subjects) {
                        const subjectName = subj.subject;
                        
                        // Check for duplicate
                        const existingSubj = await db.collection("subjects")
                            .where("name", "==", subjectName)
                            .where("className", "==", className)
                            .where("teacherId", "==", unassignedTeacherId)
                            .get();
                            
                        if (!existingSubj.empty) {
                            log(`  Skipping ${subjectName}: Already exists.`, "info");
                            continue;
                        }
                        
                        // Full Description combining Book + Details
                        const description = `${subj.book ? 'Book: ' + subj.book : ''} ${subj.details ? '(' + subj.details + ')' : ''} [${subj.term}]`.trim();

                        await db.collection("subjects").add({
                            name: subjectName,
                            originalName: subjectName, 
                            description: description,
                            className: className,
                            department: deptName,
                            teacherName: unassignedName,
                            teacherId: unassignedTeacherId,
                            term: subj.term,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        
                        log(`  Added: ${subjectName}`, "success");
                        successCount++;
                    }
                }

                log(`Subject seeding complete. Added ${successCount} subjects.`, 'success');
                alert(`Subject seeding complete. Added ${successCount} subjects.`);

            } catch (error) {
                log(`Error seeding subjects: ${error.message}`, 'error');
                console.error(error);
            } finally {
                btn.disabled = false;
                btn.textContent = 'Seed Subjects';
            }
        }
'''
    
    final_lines = new_lines + [new_content + '\n\n'] + lines[end_index:]
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(final_lines)
        
    print("Successfully updated seed.html")

if __name__ == "__main__":
    update_seed_html()
