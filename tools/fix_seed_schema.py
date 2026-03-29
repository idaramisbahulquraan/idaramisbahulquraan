
import re

SEED_FILE = r"e:\idara school softwear\seed.html"

NEW_SEED_SUBJECTS_LOGIC = r"""
        async function runSeedSubjects() {
            const btn=document.getElementById('seedSubjectsBtn'); btn.disabled=true; btn.textContent='Seeding...';
            try {
                // Map: Name -> { id, department }
                const maps={}; 
                (await db.collection('classes').get()).forEach(d => {
                    const data = d.data();
                    maps[data.name] = { id: d.id, department: data.department };
                });

                let tid=null;
                const tq=await db.collection('teachers').where('firstName','==','Unassigned Teacher').get();
                if(!tq.empty) tid=tq.docs[0].id;
                
                for(const [cn, subs] of Object.entries(syllabusData)) {
                    if(!maps[cn]) { log(`Class ${cn} missing`,'warning'); continue; }
                    
                    const classInfo = maps[cn];
                    
                    for(const s of subs) {
                        // Check existence by name + classId
                        const sq=await db.collection('subjects')
                            .where('classId','==',classInfo.id)
                            .where('name','==',s.subject)
                            .get();
                            
                        if(sq.empty) {
                            await db.collection('subjects').add({
                                name: s.subject,
                                classId: classInfo.id,
                                className: cn,               // Added for attendance.html
                                department: classInfo.department, // Added for attendance.html
                                teacherId: tid||'',
                                book: s.book,
                                description: s.details,
                                term: s.term,
                                createdAt: firebase.firestore.FieldValue.serverTimestamp()
                            });
                            log(`Added ${s.subject}`,'success');
                        }
                    }
                }
                log('Subjects Done','success');
            } catch(e) { log(e.message,'error'); } finally { btn.disabled=false; btn.textContent='Seed Subjects'; }
        }
"""

def main():
    print("Reading seed.html...")
    with open(SEED_FILE, 'r', encoding='utf-8') as f:
        content = f.read()

    # Regex to replace the function runSeedSubjects
    # Pattern: async function runSeedSubjects() { ... } 
    # capturing the whole body is tricky with nested braces.
    # But since we generated it, we know the indentation style in previous script.
    # It started with `async function runSeedSubjects() {` and ended before `async function resetSyllabusData`.
    
    start_marker = "async function runSeedSubjects() {"
    end_marker = "async function resetSyllabusData() {"
    
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker)
    
    if start_idx == -1 or end_idx == -1:
        print("Error: Could not find function boundaries.")
        return

    # Extract the part to replace
    # We want to replace from start_marker up to (but not including) end_marker.
    # But wait, end_marker is the next function. There might be closing brace and newline before it.
    
    # Let's inspect the previous file content logic:
    # JS_SYLLABUS_LOGIC had:
    # runSeedSubjects...
    # resetSyllabusData...
    
    # We can just replace the block.
    
    new_content = content[:start_idx] + NEW_SEED_SUBJECTS_LOGIC + "\n        " + content[end_idx:]
    
    print("Writing updated seed.html...")
    with open(SEED_FILE, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print("Done.")

if __name__ == "__main__":
    main()
