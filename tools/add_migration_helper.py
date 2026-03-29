
import re

SEED_FILE = r"e:\idara school softwear\seed.html"

MIGRATION_BTN_HTML = r"""
        <div style="margin-top: 20px; border-top: 1px solid #ccc; padding-top: 10px;">
            <h3>Data Migration</h3>
            <p>One-time tools to migrate old data to new formats.</p>
            <button onclick="runMigrateClasses()" style="background-color: #ff9800; color: white;">Migrate Old Classes to New Names</button>
        </div>
"""

MIGRATION_JS_LOGIC = r"""
        async function runMigrateClasses() {
            if(!confirm("This will rename 'Old' classes to 'New' classes for ALL existing students. Continue?")) return;
            
            const mapping = {
                "Aama Arzbic (A)": "Aamma Year 1 (Arabic Language Foundation Course)",
                "Aama Arabic (B)": "Aamma Year 1 (Arabic Language Foundation Course)",
                "Aama English": "Aamma Year 2 (English Language Foundation Course)",
                "Khasa - I": "Khassa Year 1 Foundation Course (First 40 Days)",
                "Khasa - II": "Khassa Year 2",
                "Aalia - I (X)": "Aliya Year 1",
                "Aalia - II (XI)": "Aliya Year 2",
                "Aalamia - I (XII)": "Alamiya Year 1",
                "Almia - II (XI)": "Alamiya Year 2"
            };
            
            log("Starting Class Migration...", 'info');
            
            try {
                const snap = await db.collection("students").get();
                let batch = db.batch();
                let count = 0;
                let totalUpdated = 0;
                
                for(const doc of snap.docs) {
                    const s = doc.data();
                    const oldClass = s.className;
                    
                    if(mapping[oldClass]) {
                        const newClass = mapping[oldClass];
                        batch.update(doc.ref, { 
                            className: newClass,
                            migratedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        
                        // Also update user doc if it exists and has class info (standard structure usually doesn't, but no harm checking)
                        // Actually, users collection usually just has role/email/name. Class is in students collection.
                        
                        count++;
                        if(count >= 400) {
                            await batch.commit();
                            batch = db.batch();
                            totalUpdated += count;
                            count = 0;
                            log(`Migrated ${totalUpdated} students...`, 'info');
                        }
                    }
                }
                
                if(count > 0) {
                    await batch.commit();
                    totalUpdated += count;
                }
                
                log(`Migration Complete. Updated ${totalUpdated} students.`, 'success');
                
            } catch(e) {
                log(`Error: ${e.message}`, 'error');
                console.error(e);
            }
        }
"""

def main():
    print("Reading seed.html...")
    with open(SEED_FILE, 'r', encoding='utf-8') as f:
        content = f.read()

    # Inject Button after the Delete Urdu Teachers button container
    # Looking for: <div style="margin-top: 10px;">...<button ... deleteUrduTeachers ...</div>
    # We can inject after that div's closing tag.
    
    btn_marker = 'onclick="deleteUrduTeachers()"'
    div_end = content.find('</div>', content.find(btn_marker))
    if div_end != -1:
        insert_point = div_end + 6 # + len('</div>')
        content = content[:insert_point] + MIGRATION_BTN_HTML + content[insert_point:]
    else:
        print("Warning: Could not find insert point for button.")

    # Inject JS Logic
    # We can inject it before the last </script> tag or before resetSyllabusData
    # Let's verify where to put it. `resetSyllabusData` is at the end.
    
    script_end = content.rfind('</script>')
    if script_end != -1:
         content = content[:script_end] + MIGRATION_JS_LOGIC + content[script_end:]
    else:
         print("Warning: Could not find script end.")

    print("Writing updated seed.html...")
    with open(SEED_FILE, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("Done.")

if __name__ == "__main__":
    main()
