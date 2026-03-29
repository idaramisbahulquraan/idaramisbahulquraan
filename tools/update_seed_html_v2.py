import json

def update_seed_html_v2():
    json_path = 'tools/syllabus_structure_v2.json'
    file_path = r'e:\idara school softwear\seed.html'
    
    # Load JSON
    with open(json_path, 'r', encoding='utf-8') as f:
        syllabus_data = json.load(f)
        
    json_str = json.dumps(syllabus_data, indent=2, ensure_ascii=False)
    
    # Read seed.html
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    # 1. Update deptDataList
    # Helper to find range
    def replace_range(lines, start_sig, end_sig, new_content):
        start_idx = -1
        end_idx = -1
        for i, line in enumerate(lines):
            if start_sig in line:
                start_idx = i
            if end_sig in line and start_idx != -1 and i > start_idx:
                end_idx = i
                break
        
        if start_idx != -1 and end_idx != -1:
            return lines[:start_idx] + [new_content] + lines[end_idx+1:]
        return lines

    new_dept_list = r'''            {
                department: "Dars-e-Nizami Department",
                classes: [
                    "Aamma Year 1 (Arabic Language Foundation Course)",
                    "Aamma Year 2 (English Language Foundation Course)",
                    "Khassa Year 1 Foundation Course (First 40 Days)",
                    "Khassa Year 2",
                    "Aliya Year 1",
                    "Aliya Year 2",
                    "Alamiya Year 1",
                    "Alamiya Year 2"
                ]
            },'''
    
    # We look for "department: "Dars-e-Nizami Department"" and replace the object block?
    # Actually finding the exact block is hard with simple string match if indent varies.
    # But I know the structure is:
    # const deptDataList = [
    #    {
    #        department: "Dars-e-Nizami Department",
    #        classes: [ ... ]
    #    },
    
    # Let's replace the hole `const deptDataList = [ ... ];` block if possible, or just the Dars-e-Nizami part.
    # Previous content:
    #             department: "Dars-e-Nizami Department",
    #             classes: [
    #                 "Foundation / Aama",
    #                 "Khassa Year 1",
    #                 ...
    #             ]
    
    # I'll construct the whole variable to be safe.
    new_dept_var = r'''        const deptDataList = [
            {
                department: "Dars-e-Nizami Department",
                classes: [
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
                department: "Hifz Department",
                classes: [
                    "Amer Bin Khatab",
                    "Abdullah Bin Masood",
                    "Zaid Bin Sabit",
                    "Musab Bin Omair",
                    "Abdullah Bin Abbas",
                    "Osman Ghani",
                    "Abee Bin Kaab",
                    "Abu Bakar Siddique",
                    "Ali-ul-Murtazi",
                    "Naseerah Murseed"
                ]
            },
            {
                department: "Tajweed Department",
                classes: [
                    "Class 1st year",
                    "Class IInd year"
                ]
            }
        ];'''
        
    lines = replace_range(lines, "const deptDataList = [", "];", new_dept_var)
    
    # 2. Update syllabusData
    new_syllabus_var = f"        // New Syllabus Data (JSON Structure)\n        const syllabusData = {json_str};\n"
    
    lines = replace_range(lines, "const syllabusData =", "};", new_syllabus_var)
    
    # 3. Add Reset Functionality (if not present)
    # I'll look for `async function runSeedSubjects() {` and insert `async function resetSyllabusData() { ... }` before it.
    
    reset_func = r'''
        async function resetSyllabusData() {
            if (!confirm("WARNING: This will delete ALL subjects and classes associated with the current list? \nActually, this will delete ALL subjects in the database to start fresh. Are you sure?")) return;
            
            log("Starting full reset of syllabus data...", 'warning');
            const btn = document.getElementById('seedSubjectsBtn'); // Reuse btn for visual feedback if needed?
            
            try {
                // Delete all Subjects
                const subjs = await db.collection('subjects').get();
                const batchSize = 400;
                let batch = db.batch();
                let count = 0;
                let totalDeleted = 0;
                
                for (const doc of subjs.docs) {
                    batch.delete(doc.ref);
                    count++;
                    if (count >= batchSize) {
                        await batch.commit();
                        batch = db.batch();
                        totalDeleted += count;
                        count = 0;
                        log(`Deleted ${totalDeleted} subjects...`, 'info');
                    }
                }
                if (count > 0) {
                     await batch.commit();
                     totalDeleted += count;
                }
                log(`Deleted total ${totalDeleted} subjects.`, 'success');
                
                // Optional: Delete Dars-e-Nizami Classes? 
                // Creating classes handles duplicates, but if we want to remove old class names like "Foundation / Aama", we should delete them.
                // NOTE: This deletes ALL classes.
                const classes = await db.collection('classes').get();
                batch = db.batch();
                count = 0;
                for (const doc of classes.docs) {
                     // Only delete if it belongs to Dars-e-Nizami?
                     const data = doc.data();
                     if (data.department === "Dars-e-Nizami Department") {
                         batch.delete(doc.ref);
                         count++;
                     }
                }
                if (count > 0) await batch.commit();
                log(`Deleted ${count} Dars-e-Nizami classes.`, 'success');
                
                alert("Reset complete! Now run 'Seed Departments' and 'Seed Subjects'.");
                
            } catch (e) {
                console.error(e);
                log("Error resetting: " + e.message, 'error');
            }
        }
    '''
    
    # Check if reset function already exists
    has_reset = False
    for line in lines:
        if "async function resetSyllabusData" in line:
            has_reset = True
            break
            
    if not has_reset:
        # Insert before runSeedSubjects
        for i, line in enumerate(lines):
            if "async function runSeedSubjects" in line:
                lines.insert(i, reset_func)
                break
                
    # 4. Add Button for Reset
    # Found: <button id="seedSubjectsBtn" ...>Seed Subjects</button>
    # Append new button after it
    
    btn_code = r' <button onclick="resetSyllabusData()" class="btn btn-danger" style="margin-left:10px;">Reset Syllabus Data</button>'
    
    # Check if button exists
    has_btn = False
    for line in lines:
        if "resetSyllabusData()" in line and "<button" in line:
            has_btn = True
            break
            
    if not has_btn:
        for i, line in enumerate(lines):
            if 'id="seedSubjectsBtn"' in line:
                # Append to this line
                lines[i] = lines[i].strip() + btn_code + '\n'
                break

    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
        
    print("Successfully updated seed.html with V2 data and Reset function.")

if __name__ == "__main__":
    update_seed_html_v2()
