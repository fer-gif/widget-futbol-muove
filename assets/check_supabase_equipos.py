import requests

supabase_url = "https://estclirfknhzlqxhiafn.supabase.co"
anon_key = "sb_publishable_IuvrgsOWBUZkccB60WGDeA_4e7u4AbM"

headers = {
    "apikey": anon_key,
    "Authorization": f"Bearer {anon_key}"
}

res = requests.get(f"{supabase_url}/rest/v1/equipos?select=id,nombre_equipo,logo_url", headers=headers)
print("Status code:", res.status_code)
if res.status_code == 200:
    equipos = res.json()
    print(f"Encontrados {len(equipos)} equipos en Supabase:")
    for eq in equipos:
        print(f" - ID: {eq['id']} | Nombre: {eq['nombre_equipo']} | Logo: {eq.get('logo_url')}")
else:
    print("Error:", res.text)
