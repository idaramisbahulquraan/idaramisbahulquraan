import json
import re

# Helper to normalize names
def normalize(name):
    if not name:
        return ""
    name = name.lower()
    name = re.sub(r'\b(hafiz|qari|syed|muhammad|mohammad)\b', '', name)
    name = re.sub(r'[^a-z0-9]', '', name)
    return name.strip()

# Read old seed data from js/student-seed-data.js
old_students = []
try:
    with open("js/student-seed-data.js", "r", encoding="utf-8") as f:
        content = f.read()
        # extract JSON array
        start_idx = content.find("[")
        end_idx = content.rfind("]") + 1
        if start_idx != -1 and end_idx != -1:
            json_str = content[start_idx:end_idx]
            old_students = json.loads(json_str)
except Exception as e:
    print(f"Error reading old seed data: {e}")

# Read new seed data from js/updated-student-data.js
new_students = []
try:
    with open("js/updated-student-data.js", "r", encoding="utf-8") as f:
        content = f.read()
        start_idx = content.find("[")
        end_idx = content.rfind("]") + 1
        if start_idx != -1 and end_idx != -1:
            json_str = content[start_idx:end_idx]
            new_students = json.loads(json_str)
except Exception as e:
    print(f"Error reading new seed data: {e}")

print(f"Loaded {len(old_students)} old seed students.")
print(f"Loaded {len(new_students)} new excel students.")

# Create match maps
old_map = {}
for s in old_students:
    key = (normalize(s.get('name', '')), normalize(s.get('parentName', '')))
    # Skip Hifz class since Hifz is not in new excel files
    if s.get('department') == 'Hifz Department':
        continue
    old_map[key] = s

new_map = {}
for s in new_students:
    key = (normalize(s.get('name', '')), normalize(s.get('parentName', '')))
    new_map[key] = s

matched = []
left = []
new_admitted = []

for key, s in old_map.items():
    if key in new_map:
        matched.append((s, new_map[key]))
    else:
        left.append(s)

for key, s in new_map.items():
    if key not in old_map:
        new_admitted.append(s)

# Write analysis report
with open("tools/migration_analysis.txt", "w", encoding="utf-8") as out:
    out.write("MIGRATION ANALYSIS REPORT\n")
    out.write("=========================\n\n")
    out.write(f"Total Old Seed Students (excluding Hifz): {len(old_map)}\n")
    out.write(f"Total New Excel Students: {len(new_map)}\n\n")
    
    out.write(f"1. Matched Students (Enrolled & Class Renamed): {len(matched)}\n")
    out.write(f"2. Left Students (To be marked as 'left'): {len(left)}\n")
    out.write(f"3. Newly Admitted Students (To be registered): {len(new_admitted)}\n\n")
    
    out.write("DETAILED LEFT STUDENTS LIST:\n")
    out.write("----------------------------\n")
    for i, s in enumerate(left):
        out.write(f"{i+1}. Name: {s.get('name')} | Parent: {s.get('parentName')} | Old Class: {s.get('className')}\n")
        
    out.write("\nDETAILED NEWLY ADMITTED STUDENTS LIST:\n")
    out.write("--------------------------------------\n")
    for i, s in enumerate(new_admitted):
        out.write(f"{i+1}. Name: {s.get('name')} | Parent: {s.get('parentName')} | New Class: {s.get('className')}\n")

print("Done! Report written to tools/migration_analysis.txt")
