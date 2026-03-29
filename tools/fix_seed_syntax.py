
import re

SEED_FILE = r"e:\idara school softwear\seed.html"

def main():
    print("Reading seed.html...")
    with open(SEED_FILE, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    new_lines = []
    
    # State tracking
    in_garbage = False
    
    for i, line in enumerate(lines):
        
        # 1. Detect start of Garbage after rawHifzStudentData
        # It ends with `Naseerah			`;` (line 834 in recent view)
        # We need to detect that line, and then if the NEXT line is garbage, skip until valid code.
        
        if "Naseerah" in line and "`;" in line:
            new_lines.append(line)
            # Enable garbage skipping mode
            in_garbage = True
            continue
        
        if in_garbage:
            # We skip lines until we hit "const englishTeachers" or "function"
            if "const englishTeachers" in line or "function" in line:
                in_garbage = False
                # Fall through to append this valid line
            else:
                # Still garbage, skip
                continue
                
        # 2. Fix line 1982: `eacher Seeding            const rawTeacherDa`
        if "eacher Seeding" in line and "const rawTeacherDa" in line:
            # We want to keep the Urdu text if present
            # Format: `const rawTeacherData = \``
            match = re.search(r'تذہ', line) 
            # If we find Urdu text start, we append `const rawTeacherData = \`` + Urdu text...
            # Actually, looking at the line: "eacher Seeding ... const rawTeacherDa ... تذہ ..."
            # It seems the corrupted line CONTAINS the start of the string.
            
            # Let's just hard replace the prefix.
            # Find the position of "تذہ" or the first backtick? 
            # The line 1982 in the view didn't show a backtick. It showed `const rawTeacherDa        تذہ ...`
            # This implies the backtick might be missing or it's just raw text.
            
            # Safe bet: Construct a valid start.
            # "const rawTeacherData = `" + content from 'تذہ' onwards
            
            urdu_start = line.find("تذہ")
            if urdu_start != -1:
                clean_line = "const rawTeacherData = `" + line[urdu_start:]
                new_lines.append(clean_line)
            else:
                # If no Urdu found, just open the string
                new_lines.append("const rawTeacherData = `\n")
            continue
            
        new_lines.append(line)

    print("Writing fixed seed.html...")
    with open(SEED_FILE, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)

if __name__ == "__main__":
    main()
