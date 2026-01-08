import subprocess

try:
    res = subprocess.run(
        ["fc-list", ":", "file", "family"], 
        capture_output=True, 
        text=True
    )
    print(f"Return code: {res.returncode}")
    print(f"Total lines: {len(res.stdout.splitlines())}")
    
    count = 0
    for line in res.stdout.splitlines():
        try:
            parts = line.split(":", 1)
            if len(parts) < 2: 
                print(f"Skipping line (split failed): {line[:50]}...")
                continue
            
            path = parts[0].strip()
            families = parts[1].strip()
            
            # A file can provide multiple families
            family_list = [f.strip() for f in families.split(",") if f.strip()]
            
            if family_list and path:
                if count < 5:
                    print(f"Success: {path} -> {family_list}")
                count += 1
            else:
                 print(f"Skipping empty: {path} -> {families}")
        except Exception as e:
            print(f"Error parsing line: {e}")
            
    print(f"Total successful parses: {count}")

except Exception as e:
    print(f"Subprocess failed: {e}")
