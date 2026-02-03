import os
import json
import glob

template_dir = r"c:\devel\AdvancedWelcomeLightVisualizer\Templates"
templates = {}

for filepath in glob.glob(os.path.join(template_dir, "*")):
    filename = os.path.basename(filepath)
    if filename.startswith("!"):
        continue
        
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            
        left1 = ""
        left2 = ""
        right1 = ""
        right2 = ""
        
        lines = content.splitlines()
        
        mode = None 
        val_mode = None 
        
        for line in lines:
            line = line.strip()
            if not line: continue
            
            if "FLM2 Left [43]" in line:
                mode = 'LEFT'
            elif "FLM2 Right [44]" in line:
                mode = 'RIGHT'
            elif "Staging1_Data:" in line:
                val_mode = 'S1'
            elif "Staging2_Data:" in line:
                val_mode = 'S2'
            else:
                if mode == 'LEFT' and val_mode == 'S1':
                    left1 += line + " "
                elif mode == 'LEFT' and val_mode == 'S2':
                    left2 += line + " "
                elif mode == 'RIGHT' and val_mode == 'S1':
                    right1 += line + " "
                elif mode == 'RIGHT' and val_mode == 'S2':
                    right2 += line + " "
        
        def clean(s):
            return ", ".join([x.strip() for x in s.replace(" ", "").split(",") if x.strip()])

        templates[filename] = {
            "left1": clean(left1),
            "left2": clean(left2),
            "right1": clean(right1),
            "right2": clean(right2)
        }
    except Exception as e:
        print(f"Error parsing {filename}: {e}")

output_path = r"c:\devel\AdvancedWelcomeLightVisualizer\templates.json"
with open(output_path, "w", encoding="utf-8") as f:
    f.write("const TEMPLATES = " + json.dumps(templates, indent=2) + ";")
print(f"Written to {output_path}")
