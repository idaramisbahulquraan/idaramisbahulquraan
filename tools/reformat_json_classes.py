import json

def reformat_json():
    input_path = 'tools/syllabus_structure.json'
    output_path = 'tools/syllabus_structure_v2.json'
    
    data = None
    for enc in ['utf-16', 'utf-16-le', 'utf-8', 'cp1252']:
        try:
            with open(input_path, 'r', encoding=enc) as f:
                data = json.load(f)
            break
        except (UnicodeError, json.JSONDecodeError):
            continue
            
    if data is None:
        print("Failed to read JSON with any encoding.")
        return
        
    new_data = {}
    
    # Direct mapping for straightforward renames
    mapping = {
        "Khassa Year 1": "Khassa Year 1 Foundation Course (First 40 Days)",
        "Khassa Year 2": "Khassa Year 2",
        "Aliya Year 1": "Aliya Year 1",
        "Aliya Year 2": "Aliya Year 2",
        "Alamiya Year 1": "Alamiya Year 1",
        "Alamiya Year 2": "Alamiya Year 2"
    }
    
    for old_key, new_key in mapping.items():
        if old_key in data:
            new_data[new_key] = data[old_key]
            
    # Handle "Foundation / Aama" split
    aamma_subjects = data.get("Foundation / Aama", [])
    if aamma_subjects:
        arabic_course = "Aamma Year 1 (Arabic Language Foundation Course)"
        english_course = "Aamma Year 2 (English Language Foundation Course)"
        
        arabic_subjs = []
        english_subjs = []
        
        # Heuristic based on subject names in extracted data
        english_keywords = ['english', 'science', 'math', 'gk', 'general knowledge', 'computer']
        
        for subj in aamma_subjects:
            name_lower = subj['subject'].lower()
            book_lower = subj.get('book', '').lower()
            
            is_english = False
            if any(k in name_lower for k in english_keywords):
                is_english = True
            elif any(k in book_lower for k in english_keywords):
                is_english = True
                
            if is_english:
                english_subjs.append(subj)
            else:
                arabic_subjs.append(subj)
        
        new_data[arabic_course] = arabic_subjs
        new_data[english_course] = english_subjs

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(new_data, f, indent=2, ensure_ascii=False)
        
    print(f"Reformatted JSON saved to {output_path}")

if __name__ == "__main__":
    reformat_json()
