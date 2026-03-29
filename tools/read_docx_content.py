import zipfile
import re
import sys
import os

def read_docx(file_path):
    try:
        with zipfile.ZipFile(file_path) as z:
            xml_content = z.read('word/document.xml').decode('utf-8')
            
            # Replace common tags with meaningful whitespace
            xml_content = xml_content.replace('</w:p>', '\n')
            xml_content = xml_content.replace('<w:br/>', '\n')
            xml_content = xml_content.replace('<w:tab/>', '\t')
            
            # Remove all XML tags
            text = re.sub('<[^<]+?>', '', xml_content)
            
            # clean up multiple newlines/spaces
            lines = [line.strip() for line in text.split('\n') if line.strip()]
            return '\n'.join(lines)
            
    except Exception as e:
        return f"Error: {str(e)}"

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python read_docx.py <path_to_docx>")
        sys.exit(1)
        
    path = sys.argv[1]
    if not os.path.exists(path):
        print(f"File not found: {path}")
        sys.exit(1)
        
    content = read_docx(path)
    output_path = "syllabus_extracted_full.txt"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Saved to {output_path}")
