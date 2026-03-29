
import re

SEED_FILE = r"e:\idara school softwear\seed.html"

def main():
    print("Reading seed.html...")
    with open(SEED_FILE, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Fix Double Spacing in rawStudentData
    # Find the block
    pattern = r'(const\s+rawStudentData\s*=\s*`)(.*?)(`;)'
    
    def remove_double_newlines(match):
        header = match.group(1)
        body = match.group(2)
        footer = match.group(3)
        # Replace double newlines
        body = re.sub(r'\n\s*\n', '\n', body)
        return header + body + footer

    # Apply to the FIRST occurrence only (or all, but we will delete the second anyway)
    content = re.sub(pattern, remove_double_newlines, content, count=1, flags=re.DOTALL)
    
    # 2. Remove Duplicate rawStudentData
    # Check if a second occurrence exists
    matches = list(re.finditer(r'const\s+rawStudentData\s*=\s*`', content))
    if len(matches) > 1:
        print(f"Found {len(matches)} occurrences of rawStudentData. Removing the second one.")
        second_match = matches[1]
        start_idx = second_match.start()
        
        # Find the end of this duplicate block. It probably ends with `;`
        end_idx = content.find('`;', start_idx)
        if end_idx != -1:
            end_idx += 2 # include `;`
            
            # Check if there's garbage before it (e.g. comments "// --- Student Seeding Data ---")
            # We can scan backwards from start_idx to find the comment
            pre_context = content[max(0, start_idx-100):start_idx]
            comment_match = re.search(r'// --- Student Seeding Data ---', pre_context)
            if comment_match:
                 # Adjust start_idx backwards to include the comment
                 # We need safe offsets relative to content
                 offset = 100 - comment_match.start()
                 start_idx -= offset
            
            # Remove the block
            content = content[:start_idx] + content[end_idx:]
        else:
            print("Could not find end of second rawStudentData block. Skipping removal.")
    
    # 3. Fix any other identified garbage (e.g. rawHifzStudentData tail if still bad)
    # Step 238 fixed Naseerah, but if it left empty lines?
    
    print("Writing cleaned seed.html...")
    with open(SEED_FILE, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == "__main__":
    main()
