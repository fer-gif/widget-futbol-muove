import os
import requests

supabase_url = "https://estclirfknhzlqxhiafn.supabase.co"
anon_key = "sb_publishable_IuvrgsOWBUZkccB60WGDeA_4e7u4AbM"

headers = {
    "apikey": anon_key,
    "Authorization": f"Bearer {anon_key}",
    "Prefer": "return=representation"
}

png_dir = r"c:\Users\fermi\OneDrive\Escritorio\widgetFutbol\web\public\escudos_necochea"

# Mapping from DB team name patterns to local PNG filenames
team_map = {
    "Del Valle": "del_valle.png",
    "Ministerio": "ministerio.png",
    "Estaci": "estacion_quequen.png",
    "Villa Diaz": "villa_diaz_velez.png",
    "Rivadavia": "rivadavia.png",
    "Newbery": "newbery.png",
    "Defensores de P.Q": "defensores_de_pq.png",
    "Hurac": "huracan_de_necochea.png",
    "Villa del Parque": "villa_del_parque.png",
    "Independiente de San Cayetano": "independiente_de_sancayetano.png",
    "Gimnasia y Esgrima": "gimnasia_y_esgrima.png",
    "Mataderos": "mataderos.png",
    "Independiente de Lober": "independiente_de_loberia.png",
    "Nicanor Olivera": "nicanor_olivera.png",
    "Sportivo San Cayetano": "sportivo_san_cayetano.png",
    "Defensores de Juan": "defensores_de_jfernandez.png",
}

# Fetch equipos from DB
res = requests.get(f"{supabase_url}/rest/v1/equipos?select=id,nombre_equipo", headers=headers)
equipos = res.json()

print(f"Subiendo escudos transparentes a Supabase Storage para {len(equipos)} equipos...")

for eq in equipos:
    nombre = eq["nombre_equipo"]
    eq_id = eq["id"]
    
    # Match PNG file
    matched_png = None
    for pattern, png_file in team_map.items():
        if pattern.lower() in nombre.lower():
            matched_png = png_file
            break
            
    if matched_png:
        file_path = os.path.join(png_dir, matched_png)
        if os.path.exists(file_path):
            storage_path = f"logos/transparent_{matched_png}"
            upload_url = f"{supabase_url}/storage/v1/object/club-logos/{storage_path}"
            
            with open(file_path, "rb") as f:
                file_bytes = f.read()
                
            upload_headers = {
                "apikey": anon_key,
                "Authorization": f"Bearer {anon_key}",
                "Content-Type": "image/png",
                "x-upsert": "true"
            }
            
            up_res = requests.post(upload_url, data=file_bytes, headers=upload_headers)
            public_url = f"{supabase_url}/storage/v1/object/public/club-logos/{storage_path}"
            
            # Update logo_url in Supabase REST API
            update_res = requests.patch(
                f"{supabase_url}/rest/v1/equipos?id=eq.{eq_id}",
                json={"logo_url": public_url},
                headers=headers
            )
            
            if update_res.status_code in (200, 204):
                print(f"[OK] Actualizado {nombre} -> {public_url}")
            else:
                print(f"[ERROR UPDATE] {nombre}: {update_res.text}")
        else:
            print(f"[WARN] Archivo no existe: {file_path}")

print("[DONE] Todos los equipos de Necochea actualizados con escudos transparentes en Supabase.")
