import os
import glob
import pandas as pd
import json

folder = r"F:\gitwebsite\idaramisbahulquraan\Updated Class names and Students Data"
files = glob.glob(os.path.join(folder, "*.xlsx"))

students_list = []

for f in files:
    filename = os.path.basename(f)
    classname = os.path.splitext(filename)[0]
    
    if "عامہ انگلش رومی (1)" in classname:
        continue
    
    clean_classname = classname.replace(" (1)", "").strip()
    
    try:
        df = pd.read_excel(f)
        cols = {c.strip().lower(): c for c in df.columns}
        
        name_col = None
        for k in ['student name', 'name', 'studentname']:
            if k in cols:
                name_col = cols[k]
                break
        
        father_col = None
        for k in ['father/guard', 'student name.1', 'father name', 'parent name', 'father/guard name']:
            if k in cols:
                father_col = cols[k]
                break
        
        roll_col = None
        for k in ['roll no.', 'roll no', 'roll number', 'rollno']:
            if k in cols:
                roll_col = cols[k]
                break
                
        mobile_col = None
        for k in ['father/guard mobile', 'mobile', 'phone', 'parent phone', 'contact']:
            if k in cols:
                mobile_col = cols[k]
                break
                
        gender_col = None
        for k in ['gender', 'sex']:
            if k in cols:
                gender_col = cols[k]
                break

        for idx, row in df.iterrows():
            student_name = str(row[name_col]).strip() if name_col and pd.notna(row[name_col]) else ""
            father_name = str(row[father_col]).strip() if father_col and pd.notna(row[father_col]) else ""
            
            if not student_name or student_name.lower() == 'nan':
                continue
                
            roll_val = ""
            if roll_col and pd.notna(row[roll_col]):
                val = row[roll_col]
                if isinstance(val, float):
                    roll_val = str(int(val))
                else:
                    roll_val = str(val).strip()
            
            mobile_val = ""
            if mobile_col and pd.notna(row[mobile_col]):
                val = row[mobile_col]
                if isinstance(val, float):
                    mobile_val = str(int(val))
                else:
                    mobile_val = str(val).strip()
                if mobile_val.startswith("3") and len(mobile_val) == 10:
                    mobile_val = "0" + mobile_val
                elif mobile_val.startswith("92") and len(mobile_val) == 12:
                    mobile_val = "0" + mobile_val[2:]
            
            gender_val = "Male"
            if gender_col and pd.notna(row[gender_col]):
                gender_val = str(row[gender_col]).strip()
                
            students_list.append({
                "name": student_name,
                "parentName": father_name,
                "rollNumber": roll_val,
                "parentPhone": mobile_val,
                "gender": gender_val,
                "className": clean_classname,
                "sourceFile": filename
            })
            
    except Exception as e:
        # Avoid print exception which could fail on filename unicode
        pass

# Output to JS file
output_js_path = r"f:\gitwebsite\idaramisbahulquraan\js\updated-student-data.js"
with open(output_js_path, "w", encoding="utf-8") as out:
    out.write("// Generated student updates data from Excel files\n")
    out.write("window.UPDATED_STUDENT_DATA = ")
    json.dump(students_list, out, ensure_ascii=False, indent=2)
    out.write(";\n")

print("Successfully wrote data!")
