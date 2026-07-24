import os
from PIL import Image
from rembg import remove

input_dir = r"c:\Users\fermi\OneDrive\Escritorio\widgetFutbol\assets\escudos_necochea"
output_dir = r"c:\Users\fermi\OneDrive\Escritorio\widgetFutbol\web\public\escudos_necochea"

os.makedirs(output_dir, exist_ok=True)

print("Iniciando eliminacion de fondo por Inteligencia Artificial (rembg)...")

for fname in os.listdir(input_dir):
    if fname.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
        inp_path = os.path.join(input_dir, fname)
        base_name = os.path.splitext(fname)[0] + ".png"
        out_path = os.path.join(output_dir, base_name)
        
        try:
            with open(inp_path, 'rb') as i:
                input_bytes = i.read()
                output_bytes = remove(input_bytes)
                
            with open(out_path, 'wb') as o:
                o.write(output_bytes)
                
            # Autocrop transparent space around shield and thumbnail
            img = Image.open(out_path)
            bbox = img.getbbox()
            if bbox:
                img = img.crop(bbox)
            
            # Maintain aspect ratio up to 300x300
            img.thumbnail((300, 300), Image.Resampling.LANCZOS)
            img.save(out_path, "PNG")
            
            print(f"[OK] Procesado perfecto: {fname} -> {base_name} (Tamano: {img.size})")
        except Exception as e:
            print(f"[ERROR] En {fname}: {e}")

print("[DONE] Todos los fondos eliminados por IA correctamente.")
