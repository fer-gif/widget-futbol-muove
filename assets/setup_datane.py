import requests

supabase_url = "https://estclirfknhzlqxhiafn.supabase.co"
anon_key = "sb_publishable_IuvrgsOWBUZkccB60WGDeA_4e7u4AbM"

headers = {
    "apikey": anon_key,
    "Authorization": f"Bearer {anon_key}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

print("1. Verificando clientes en Supabase...")
res = requests.get(f"{supabase_url}/rest/v1/clientes?select=*", headers=headers)
if res.status_code == 200:
    clientes = res.json()
    print(f"Clientes existentes ({len(clientes)}):")
    datane_client = None
    for c in clientes:
        print(f" - ID: {c['id']} | Nombre: {c['nombre_medio']} | Estado: {c['estado']}")
        if "datane" in c['nombre_medio'].lower():
            datane_client = c

    if not datane_client:
        print("\nCreando cliente 'Diario DataNE'...")
        payload = {
            "nombre_medio": "Diario DataNE",
            "email": "contacto@datane.com.ar",
            "estado": "activo"
        }
        res_create = requests.post(f"{supabase_url}/rest/v1/clientes", json=payload, headers=headers)
        if res_create.status_code in (200, 201):
            datane_client = res_create.json()[0]
            print("Cliente DataNE creado exitosamente:", datane_client['id'])
        else:
            print("Error al crear cliente DataNE:", res_create.text)
    else:
        print(f"\nCliente DataNE encontrado (ID: {datane_client['id']})")
        if datane_client['estado'] != 'activo':
            requests.patch(f"{supabase_url}/rest/v1/clientes?id=eq.{datane_client['id']}", json={"estado": "activo"}, headers=headers)
            print("Estado actualizado a 'activo'")

    if datane_client:
        client_id = datane_client['id']
        print(f"\n2. Verificando asignación de ligas para DataNE ({client_id})...")
        res_ligas = requests.get(f"{supabase_url}/rest/v1/ligas?select=*", headers=headers)
        if res_ligas.status_code == 200:
            ligas = res_ligas.json()
            for liga in ligas:
                # Verificar asignacion
                res_asig = requests.get(f"{supabase_url}/rest/v1/clientes_ligas?cliente_id=eq.{client_id}&liga_id=eq.{liga['id']}", headers=headers)
                if res_asig.status_code == 200 and len(res_asig.json()) == 0:
                    print(f"Asignando liga {liga['nombre_liga']} a DataNE...")
                    requests.post(f"{supabase_url}/rest/v1/clientes_ligas", json={"cliente_id": client_id, "liga_id": liga['id']}, headers=headers)
                else:
                    print(f"Liga {liga['nombre_liga']} ya asignada.")
else:
    print("Error al consultar clientes:", res.text)
