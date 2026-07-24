import requests

supabase_url = "https://estclirfknhzlqxhiafn.supabase.co"
anon_key = "sb_publishable_IuvrgsOWBUZkccB60WGDeA_4e7u4AbM"

headers = {
    "apikey": anon_key,
    "Authorization": f"Bearer {anon_key}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

print("1. Creando / Obteniendo Liga Necochea...")
res_liga = requests.get(f"{supabase_url}/rest/v1/ligas?nombre_liga=eq.Liga Necochea", headers=headers)
liga_id = None
if res_liga.status_code == 200 and len(res_liga.json()) > 0:
    liga_id = res_liga.json()[0]['id']
    print(f"Liga Necochea existente (ID: {liga_id})")
else:
    post_liga = requests.post(f"{supabase_url}/rest/v1/ligas", json={"nombre_liga": "Liga Necochea", "es_profesional": False}, headers=headers)
    if post_liga.status_code in (200, 201):
        liga_id = post_liga.json()[0]['id']
        print(f"Liga Necochea creada (ID: {liga_id})")
    else:
        print("Error al crear Liga Necochea:", post_liga.text)

if liga_id:
    equipos_necochea = [
        ("Del Valle", "/escudos_necochea/del_valle.png"),
        ("Ministerio", "/escudos_necochea/ministerio.png"),
        ("Estación Quequén", "/escudos_necochea/estacion_quequen.png"),
        ("Villa Díaz Vélez", "/escudos_necochea/villa_diaz_velez.png"),
        ("Rivadavia", "/escudos_necochea/rivadavia.png"),
        ("Jorge Newbery", "/escudos_necochea/newbery.png"),
        ("Defensores de P.Q", "/escudos_necochea/defensores_de_pq.png"),
        ("Huracán de Necochea", "/escudos_necochea/huracan_de_necochea.png"),
        ("Villa del Parque", "/escudos_necochea/villa_del_parque.png"),
        ("Independiente de San Cayetano", "/escudos_necochea/independiente_de_sancayetano.png"),
        ("Gimnasia y Esgrima", "/escudos_necochea/gimnasia_y_esgrima.png"),
        ("Mataderos", "/escudos_necochea/mataderos.png"),
        ("Independiente de Lobería", "/escudos_necochea/independiente_de_loberia.png"),
        ("Nicanor Olivera", "/escudos_necochea/nicanor_olivera.png"),
        ("Sportivo San Cayetano", "/escudos_necochea/sportivo_san_cayetano.png"),
        ("Defensores de Juan N. Fernández", "/escudos_necochea/defensores_de_jfernandez.png")
    ]

    print("\n2. Cargando Equipos de la Liga Necochea...")
    equipos_map = {}
    for nombre, logo in equipos_necochea:
        res_eq = requests.get(f"{supabase_url}/rest/v1/equipos?nombre_equipo=eq.{nombre}", headers=headers)
        if res_eq.status_code == 200 and len(res_eq.json()) > 0:
            eq_data = res_eq.json()[0]
            equipos_map[nombre] = eq_data['id']
        else:
            payload = {"liga_id": liga_id, "nombre_equipo": nombre, "logo_url": logo, "es_profesional": False}
            ins_eq = requests.post(f"{supabase_url}/rest/v1/equipos", json=payload, headers=headers)
            if ins_eq.status_code in (200, 201):
                eq_data = ins_eq.json()[0]
                equipos_map[nombre] = eq_data['id']
                print(f" - [OK] Creado equipo {nombre}")
            else:
                print(f" - [ERR] {nombre}: {ins_eq.text}")

    print("\n3. Creando partidos demostrativos para Fecha 1...")
    if "Del Valle" in equipos_map and "Ministerio" in equipos_map:
        requests.post(f"{supabase_url}/rest/v1/partidos", json={
            "liga_id": liga_id,
            "equipo_local_id": equipos_map["Del Valle"],
            "equipo_visitante_id": equipos_map["Ministerio"],
            "goles_local": 2,
            "goles_visitante": 1,
            "estado_partido": "en_vivo",
            "jornada": "Fecha 1"
        }, headers=headers)

    if "Rivadavia" in equipos_map and "Mataderos" in equipos_map:
        requests.post(f"{supabase_url}/rest/v1/partidos", json={
            "liga_id": liga_id,
            "equipo_local_id": equipos_map["Rivadavia"],
            "equipo_visitante_id": equipos_map["Mataderos"],
            "goles_local": 0,
            "goles_visitante": 0,
            "estado_partido": "programado",
            "jornada": "Fecha 1"
        }, headers=headers)

    print("¡Base de datos sembrada con éxito!")
