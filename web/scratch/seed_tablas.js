const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [k, v] = line.split('=');
  if (k && v) env[k.trim()] = v.trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function seed() {
  const { data: equipos, error: errEq } = await supabase.from("equipos").select("*");
  if (errEq || !equipos) {
    console.error("Error fetching equipos:", errEq);
    return;
  }

  const baseStats = [
    // ZONA A
    { nombre: "Villa Diaz Velez", zona: "A", jugados: 11, ganados: 8, empatados: 1, perdidos: 2, gf: 22, gc: 12, dif: 10, pts: 25 },
    { nombre: "Ministerio", zona: "A", jugados: 11, ganados: 7, empatados: 2, perdidos: 2, gf: 14, gc: 6, dif: 8, pts: 23 },
    { nombre: "Independiente de San Cayetano", zona: "A", jugados: 11, ganados: 6, empatados: 3, perdidos: 2, gf: 17, gc: 10, dif: 7, pts: 21 },
    { nombre: "Mataderos", zona: "A", jugados: 11, ganados: 6, empatados: 2, perdidos: 3, gf: 24, gc: 12, dif: 12, pts: 20 },
    { nombre: "Sportivo San Cayetano", zona: "A", jugados: 11, ganados: 3, empatados: 5, perdidos: 3, gf: 11, gc: 9, dif: 2, pts: 14 },
    { nombre: "Newbery", zona: "A", jugados: 11, ganados: 2, empatados: 5, perdidos: 4, gf: 11, gc: 16, dif: -5, pts: 11 },
    { nombre: "Villa del Parque", zona: "A", jugados: 11, ganados: 2, empatados: 5, perdidos: 4, gf: 10, gc: 15, dif: -5, pts: 11 },
    { nombre: "Rivadavia", zona: "A", jugados: 11, ganados: 2, empatados: 4, perdidos: 5, gf: 12, gc: 18, dif: -6, pts: 10 },

    // ZONA B
    { nombre: "Estación Quequén", zona: "B", jugados: 11, ganados: 7, empatados: 4, perdidos: 0, gf: 20, gc: 8, dif: 12, pts: 25 },
    { nombre: "Independiente de Lobería", zona: "B", jugados: 11, ganados: 5, empatados: 3, perdidos: 3, gf: 23, gc: 14, dif: 9, pts: 18 },
    { nombre: "Gimnasia y Esgrima", zona: "B", jugados: 11, ganados: 5, empatados: 3, perdidos: 3, gf: 16, gc: 12, dif: 4, pts: 18 },
    { nombre: "Nicanor Olivera", zona: "B", jugados: 11, ganados: 3, empatados: 3, perdidos: 5, gf: 12, gc: 17, dif: -5, pts: 12 },
    { nombre: "Defensores de P.Q", zona: "B", jugados: 11, ganados: 2, empatados: 2, perdidos: 7, gf: 9, gc: 24, dif: -15, pts: 8 },
    { nombre: "Huracán de Necochea", zona: "B", jugados: 11, ganados: 1, empatados: 4, perdidos: 6, gf: 12, gc: 21, dif: -9, pts: 7 },
    { nombre: "Defensores de Juan N. Fernández", zona: "B", jugados: 11, ganados: 1, empatados: 4, perdidos: 6, gf: 12, gc: 22, dif: -10, pts: 7 },
    { nombre: "Del Valle", zona: "B", jugados: 11, ganados: 1, empatados: 4, perdidos: 6, gf: 7, gc: 17, dif: -10, pts: 7 },
  ];

  const rows = [];
  for (const st of baseStats) {
    const eq = equipos.find(e => e.nombre_equipo.toLowerCase().trim() === st.nombre.toLowerCase().trim());
    if (eq) {
      rows.push({
        liga_id: eq.liga_id,
        equipo_id: eq.id,
        zona: st.zona,
        jugados: st.jugados,
        ganados: st.ganados,
        empatados: st.empatados,
        perdidos: st.perdidos,
        goles_favor: st.gf,
        goles_contra: st.gc,
        diferencia_gol: st.dif,
        puntos: st.pts,
      });
    } else {
      console.warn("NOT FOUND:", st.nombre);
    }
  }

  console.log(`PREPARING TO INSERT ${rows.length} ROWS INTO tablas_posiciones...`);
  
  // Limpiar primero
  await supabase.from("tablas_posiciones").delete().neq("jugados", -99);

  const { data: inserted, error: errIns } = await supabase.from("tablas_posiciones").insert(rows).select();
  if (errIns) {
    console.error("INSERT ERROR:", errIns);
  } else {
    console.log("SUCCESSFULLY SEEDED TABLAS_POSICIONES:", inserted.length, "ROWS!");
  }
}

seed();
