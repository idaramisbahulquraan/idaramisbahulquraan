import json
import re

def parse_syllabus(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = [l.strip() for l in f.readlines()]

    structure = {}
    current_class = "Foundation / Aama" # Default for the first block
    current_term = "General"
    current_subjects = []
    
    # Heuristic: headers usually denote class changes
    class_headers = [
        "Khassa Year 1", "Khassa Year 2",
        "Aliya Year 1", "Aliya Year 2", 
        "Alamiya Year 1", "Alamiya Year 2"
    ]

    # Regex to find item start: "01", "02-A", "1."
    item_start_re = re.compile(r'^(\d{1,2}(-?[A-Z])?)\.?$')

    buffer_lines = []
    
    def flush_buffer():
        nonlocal buffer_lines, current_subjects
        if buffer_lines:
            # simple heuristic: 
            # Subject is likely the first line
            # Book is second
            # Rest is details
            
            # Filter out lines that look like headers "Sr.", "Subject", "Book"
            clean_lines = [l for l in buffer_lines if l.lower() not in ['sr.', 'subject', 'book', 'details', 'subject/art', 'author']]
            
            if not clean_lines:
                buffer_lines = []
                return

            subj_name = clean_lines[0]
            book_name = clean_lines[1] if len(clean_lines) > 1 else ""
            details = " ".join(clean_lines[2:]) if len(clean_lines) > 2 else ""
            
            current_subjects.append({
                "subject": subj_name,
                "book": book_name,
                "details": details,
                "term": current_term
            })
            buffer_lines = []

    for line in lines:
        if not line:
            continue
            
        # Check for Class Header
        if line in class_headers:
            flush_buffer()
            # Save previous class
            if current_class:
                structure[current_class] = current_subjects
            
            current_class = line
            current_subjects = []
            current_term = "First Term" # Reset term
            continue

        # Check for Term Header
        if "First Term" in line:
            current_term = "First Term"
            continue
        if "Second Term" in line:
            current_term = "Second Term"
            continue

        # Check for Table Header (ignore)
        if "Sr." in line or "Subject" in line and "Book" in line:
            continue
            
        # Check for Item Start
        match = item_start_re.match(line)
        if match:
            # End previous item
            flush_buffer()
            # New item starts, but we don't need the number in the buffer
            continue
            
        # Accumulate lines
        buffer_lines.append(line)

    # Flush last
    flush_buffer()
    if current_class:
        structure[current_class] = current_subjects

    return structure

if __name__ == "__main__":
    data = parse_syllabus("tools/syllabus_extracted.txt")
    print(json.dumps(data, indent=2, ensure_ascii=False))
