import os
import sys
from PIL import Image

def main():
    logo_path = 'assets/logo.png'
    if not os.path.exists(logo_path):
        print(f"Error: Logo file not found at {logo_path}")
        sys.exit(1)
        
    try:
        img = Image.open(logo_path)
    except Exception as e:
        print(f"Error opening logo image: {e}")
        sys.exit(1)
        
    sizes = {
        'mipmap-mdpi': 48,
        'mipmap-hdpi': 72,
        'mipmap-xhdpi': 96,
        'mipmap-xxhdpi': 144,
        'mipmap-xxxhdpi': 192
    }
    
    res_dir = 'android/app/src/main/res'
    if not os.path.exists(res_dir):
        print(f"Error: Android res directory not found at {res_dir}")
        sys.exit(1)
        
    print("Generating Android launcher icons from assets/logo.png...")
    for folder, size in sizes.items():
        dest_folder = os.path.join(res_dir, folder)
        if not os.path.exists(dest_folder):
            os.makedirs(dest_folder)
            
        # Resize image using LANCZOS filter for high quality
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        
        # Save standard, round, and adaptive foreground icons
        resized.save(os.path.join(dest_folder, 'ic_launcher.png'))
        resized.save(os.path.join(dest_folder, 'ic_launcher_round.png'))
        resized.save(os.path.join(dest_folder, 'ic_launcher_foreground.png'))
        print(f"  Generated icons in {folder} ({size}x{size})")
        
    print("All launcher icons successfully generated!")

if __name__ == '__main__':
    main()
