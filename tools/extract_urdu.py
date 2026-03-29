import zipfile
import xml.etree.ElementTree as ET
import os

docx_path = r"e:\idara school softwear\سلیبس درس نظامی سال2026ادارہ مصباح القرآن بہاولپور.docx"
output_path = r"e:\idara school softwear\tools\urdu_syllabus_extracted.txt"

# print(f"Extracting text from: ...")

try:
    with zipfile.ZipFile(docx_path) as z:
        xml_content = z.read('word/document.xml')
        
    tree = ET.fromstring(xml_content)
    
    # Namespaces
    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    
    paragraphs = []
    # Find all paragraphs
    for p in tree.iterfind('.//w:p', ns):
        texts = []
        # Find all text nodes in paragraph
        for t in p.iterfind('.//w:t', ns):
            if t.text:
                texts.append(t.text)
        if texts:
            paragraphs.append("".join(texts))
            
    full_text = "\n".join(paragraphs)
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(full_text)
        
    print(f"Successfully extracted {len(full_text)} characters to {output_path}")

except Exception as e:
    print(f"Error: {e}")
