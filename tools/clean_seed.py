
import re

SEED_FILE = r"e:\idara school softwear\seed.html"

def main():
    with open(SEED_FILE, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    new_lines = []
    skip = False
    
    for i, line in enumerate(lines):
        # Fix rawHifzStudentData tail
        if "Naseerah" in line and "function parseHifzStudentData" in line:
            # Keep data, drop garbage
            idx = line.find("Naseerah")
            # Assuming Naseerah is the last data field.
            # We want to keep Naseerah + some tabs/spaces + newline + backtick + semicolon
            # But the reconstruct script already appended standard logic?
            # No, the reconstruct script wrote: raw_hifz_data_code + JS_HIFZ_LOGIC
            # raw_hifz_data_code contained the garbage.
            
            # Clean split:
            clean_line = line[:idx+8] + "\t\t\t`;\n"
            new_lines.append(clean_line)
            continue
        
        # Remove the garbage lines that were inside the captured block after the data
        if "rawHifzStudentData" in line and "const students =" in line:
            continue
        
        # Fix rawTeacherData garbage header
        if "eacher Seeding" in line and "const rawTeacher" in line:
             # Replace strictly with:
             new_lines.append("const rawTeacherData = `\n")
             # And the content of the line? 
             # The line contained "تذہ کرام...". We should keep the data if it's there.
             # Step 234 line 1454: "eacher Seeding    const rawTeacherDa    تذہ..."
             # We want to keep "تذہ..."
             # Find start of Urdu text? or just after `const rawTeacherDa`?
             
             # Locate "const rawTeacherDa"
             match = re.search(r'const rawTeacherDa\s*', line)
             if match:
                 data_part = line[match.end():]
                 new_lines.append("const rawTeacherData = `" + data_part)
             else:
                 new_lines.append("const rawTeacherData = `\n")
             continue
        
        new_lines.append(line)

    with open(SEED_FILE, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    
    print("Cleaned seed.html")

if __name__ == "__main__":
    main()
