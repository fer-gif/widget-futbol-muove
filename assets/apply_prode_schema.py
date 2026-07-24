import requests

supabase_url = "https://estclirfknhzlqxhiafn.supabase.co"
anon_key = "sb_publishable_IuvrgsOWBUZkccB60WGDeA_4e7u4AbM"

headers = {
    "apikey": anon_key,
    "Authorization": f"Bearer {anon_key}",
    "Content-Type": "application/json"
}

tables_to_check = ["prode_participantes", "prode_pronosticos", "prode_ligas_privadas", "prode_miembros_liga"]

print("Comprobando estado de las nuevas tablas de Prode en Supabase...")

for table in tables_to_check:
    res = requests.get(f"{supabase_url}/rest/v1/{table}?select=count", headers=headers)
    if res.status_code == 200:
        print(f"[OK] Tabla '{table}' existe y esta lista.")
    elif res.status_code in (404, 400):
        print(f"[PENDIENTE] Tabla '{table}' aun no existe en Supabase (requiere ejecutar el script SQL).")
    else:
        print(f"Respuesta de '{table}': {res.status_code} - {res.text}")
