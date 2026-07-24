import os
from PIL import Image

input_dir = r"c:\Users\fermi\OneDrive\Escritorio\widgetFutbol\assets\escudos_necochea"
output_dir = r"c:\Users\fermi\OneDrive\Escritorio\widgetFutbol\web\public\escudos_necochea"

os.makedirs(output_dir, exist_ok=True)

def remove_background(img_path, save_path):
    img = Image.open(img_path).convert("RGBA")
    width, height = img.size
    
    # Analyze corner pixel colors to detect background color
    corners = [
        img.getpixel((0, 0)),
        img.getpixel((width - 1, 0)),
        img.getpixel((0, height - 1)),
        img.getpixel((width - 1, height - 1))
    ]
    
    # Compute average corner color
    avg_r = sum(c[0] for c in corners) // 4
    avg_g = sum(c[1] for c in corners) // 4
    avg_b = sum(c[2] for c in corners) // 4
    
    datas = img.getdata()
    new_data = []
    
    # Threshold for background match
    tolerance = 45
    
    for item in datas:
        r, g, b, a = item
        # Calculate distance to background color
        diff = ((r - avg_r)**2 + (g - avg_g)**2 + (b - avg_b)**2)**0.5
        
        if diff < tolerance:
            # Make transparent
            new_data.append((255, 255, 255, 0))
        elif diff < tolerance + 25:
            # Soft edge alpha blending
            alpha = int(255 * ((diff - tolerance) / 25.0))
            new_data.append((r, g, b, alpha))
        else:
            new_data.append((r, g, b, a))
            
    img.putdata(new_data)
    
    # Autocrop transparent borders
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
        
    # Resize to max 300x300 while maintaining aspect ratio
    img.thumbnail((300, 300), Image.Resampling.LANCZOS)
    img.save(save_path, "PNG")
    print(f"Processed: {os.path.basename(img_path)} -> {os.path.basename(save_path)} (Size: {img.size})")

for fname in os.listdir(input_dir):
    if fname.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
        inp = os.path.join(input_dir, fname)
        base_name = os.path.splitext(fname)[0] + ".png"
        out = os.path.join(output_dir, base_name)
        remove_background(inp, out)

print("Done processing all shields!")
