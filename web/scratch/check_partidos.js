const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://estclirfknhzlqxhiafn.supabase.co";
const supabaseKey = "sb_publishable_IuvrgsOWBUZkccB60WGDeA_4e7u4AbM"; // Wait, this is the anon key!
// Let's use the env key from web/.env.local
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: partidos, error } = await supabase
    .from("partidos")
    .select("id, fecha_hora, estado_partido, equipo_local_id, equipo_visitante_id, goles_local, goles_visitante, cliente_id, liga_id")
    .order("fecha_hora", { ascending: false });

  if (error) {
    console.error("Error:", error);
    return;
  }

  const { data: equipos } = await supabase.from("equipos").select("id, nombre_equipo");
  const getEquiposName = (id) => equipos?.find(e => e.id === id)?.nombre_equipo || id;

  console.log("--- PARTIDOS EN LA BASE DE DATOS (ORDEN DESCENDENTE POR FECHA) ---");
  partidos.forEach(p => {
    console.log(`[${p.fecha_hora}] ${getEquiposName(p.equipo_local_id)} ${p.goles_local} - ${p.goles_visitante} ${getEquiposName(p.equipo_visitante_id)} (${p.estado_partido}) | Cliente: ${p.cliente_id}`);
  });
}

run();
