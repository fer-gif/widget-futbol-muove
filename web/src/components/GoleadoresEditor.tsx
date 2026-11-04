"use client";

// Edición de la tabla de goleadores de una liga. La usan los diarios (/admin,
// solo sus ligas: lo filtra el servidor) y el super-admin.
import { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db-client";
import { toast } from "@/components/Toaster";

type Liga = { id: string; nombre_liga: string };
type Equipo = { id: string; nombre_equipo: string; logo_url?: string | null; liga_id?: string | null };
type Goleador = { id: string; liga_id: string; equipo_id: string | null; nombre: string; goles: number };

const normalizar = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

export default function GoleadoresEditor({ ligas, equipos }: { ligas: Liga[]; equipos: Equipo[] }) {
  const [ligaElegida, setLigaId] = useState("");
  // Las ligas llegan después del primer render: sin elección, la primera.
  const ligaId = ligaElegida || ligas[0]?.id || "";
  const [lista, setLista] = useState<Goleador[]>([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [nuevo, setNuevo] = useState({ nombre: "", equipoId: "", goles: 1 });
  const [guardando, setGuardando] = useState(false);

  const equiposLiga = useMemo(
    () => equipos.filter((e) => e.liga_id === ligaId).sort((a, b) => a.nombre_equipo.localeCompare(b.nombre_equipo)),
    [equipos, ligaId]
  );
  const equipoPorId = useMemo(() => new Map(equipos.map((e) => [e.id, e])), [equipos]);

  const cargar = useCallback(async () => {
    if (!ligaId) return;
    setCargando(true);
    const { data, error } = await db
      .from("goleadores")
      .select("id, liga_id, equipo_id, nombre, goles")
      .eq("liga_id", ligaId)
      .order("goles", { ascending: false })
      .order("nombre", { ascending: true });
    setCargando(false);
    if (error) {
      toast.error(/goleadores/.test(error.message) ? "Falta correr la migración 006 en Supabase." : error.message);
      return;
    }
    setLista((data as Goleador[]) || []);
  }, [ligaId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  const ordenar = (l: Goleador[]) => [...l].sort((a, b) => b.goles - a.goles || a.nombre.localeCompare(b.nombre));

  async function cambiarGoles(g: Goleador, delta: number) {
    const goles = Math.max(0, g.goles + delta);
    if (goles === g.goles) return;
    const anterior = lista;
    setLista(ordenar(lista.map((x) => (x.id === g.id ? { ...x, goles } : x))));
    const { error } = await db.from("goleadores").update({ goles, actualizado: new Date().toISOString() }).eq("id", g.id);
    if (error) {
      setLista(anterior);
      toast.error(`No se pudo guardar: ${error.message}`);
    }
  }

  async function borrar(g: Goleador) {
    if (!window.confirm(`¿Borrar a ${g.nombre} de la tabla de goleadores?`)) return;
    const { error } = await db.from("goleadores").delete().eq("id", g.id);
    if (error) return toast.error(`No se pudo borrar: ${error.message}`);
    setLista(lista.filter((x) => x.id !== g.id));
    toast.success(`${g.nombre} eliminado.`);
  }

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    const nombre = nuevo.nombre.trim().replace(/\s+/g, " ");
    if (nombre.length < 2) return toast.error("Escribí el nombre del jugador.");
    if (!nuevo.equipoId) return toast.error("Elegí el equipo.");
    const existente = lista.find((g) => normalizar(g.nombre) === normalizar(nombre) && g.equipo_id === nuevo.equipoId);
    setGuardando(true);
    try {
      if (existente) {
        await cambiarGoles(existente, nuevo.goles);
        toast.success(`${existente.nombre} ya estaba: se le sumaron ${nuevo.goles}.`);
      } else {
        const { error } = await db.from("goleadores").insert({
          liga_id: ligaId,
          equipo_id: nuevo.equipoId,
          nombre,
          goles: Math.max(0, nuevo.goles),
        });
        if (error) throw new Error(error.message);
        toast.success(`${nombre} agregado.`);
        await cargar();
      }
      setNuevo({ nombre: "", equipoId: nuevo.equipoId, goles: 1 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  const filtrados = busqueda
    ? lista.filter((g) => normalizar(`${g.nombre} ${equipoPorId.get(g.equipo_id || "")?.nombre_equipo || ""}`).includes(normalizar(busqueda)))
    : lista;
  const campo =
    "bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#ff7900]/50";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <form onSubmit={agregar} className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 h-fit space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white">Sumar goles</h2>
          <p className="text-xs text-zinc-400 mt-1">
            Si el jugador ya está en la tabla, se le suman los goles. Si no, se agrega.
          </p>
        </div>
        {ligas.length > 1 && (
          <select value={ligaId} onChange={(e) => setLigaId(e.target.value)} className={`${campo} w-full`} aria-label="Liga">
            {ligas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre_liga}
              </option>
            ))}
          </select>
        )}
        <input
          value={nuevo.nombre}
          onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
          placeholder="Nombre y apellido"
          aria-label="Nombre del jugador"
          className={`${campo} w-full`}
          list="goleadores-existentes"
        />
        <datalist id="goleadores-existentes">
          {lista.map((g) => (
            <option key={g.id} value={g.nombre} />
          ))}
        </datalist>
        <select
          value={nuevo.equipoId}
          onChange={(e) => setNuevo({ ...nuevo, equipoId: e.target.value })}
          aria-label="Equipo"
          className={`${campo} w-full`}
        >
          <option value="">Equipo…</option>
          {equiposLiga.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre_equipo}
            </option>
          ))}
        </select>
        <label className="flex items-center justify-between gap-3 text-sm text-zinc-300">
          Goles a sumar
          <input
            type="number"
            min={1}
            max={20}
            value={nuevo.goles}
            onChange={(e) => setNuevo({ ...nuevo, goles: Math.max(1, Number(e.target.value) || 1) })}
            className={`${campo} w-20 text-center`}
          />
        </label>
        <button
          type="submit"
          disabled={guardando || !ligaId}
          className="w-full bg-[#ff7900] hover:bg-[#ff8c1a] text-black font-bold py-3 rounded-xl text-sm disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </form>

      <div className="lg:col-span-2 bg-[#121214] border border-[#27272a] rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-white">
            Tabla de goleadores <span className="text-zinc-500 font-normal text-sm">({lista.length})</span>
          </h2>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar jugador o equipo"
            aria-label="Buscar"
            className={`${campo} w-full sm:w-64`}
          />
        </div>

        {cargando ? (
          <p className="text-sm text-zinc-400">Cargando…</p>
        ) : filtrados.length === 0 ? (
          <p className="text-sm text-zinc-400">{lista.length ? "No hay coincidencias." : "Todavía no hay goleadores cargados."}</p>
        ) : (
          <ol className="divide-y divide-[#27272a]">
            {filtrados.map((g) => {
              const eq = g.equipo_id ? equipoPorId.get(g.equipo_id) : undefined;
              return (
                <li key={g.id} className="flex items-center gap-3 py-2.5">
                  {eq?.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={eq.logo_url} alt="" className="w-7 h-7 object-contain shrink-0" />
                  ) : (
                    <span className="w-7 h-7 shrink-0" />
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-white truncate">{g.nombre}</span>
                    <span className="block text-xs text-zinc-400 truncate">{eq?.nombre_equipo || "Sin equipo"}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => cambiarGoles(g, -1)}
                      disabled={g.goles === 0}
                      aria-label={`Restar un gol a ${g.nombre}`}
                      className="w-8 h-8 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-white font-bold disabled:opacity-30"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-lg font-black text-white tabular-nums">{g.goles}</span>
                    <button
                      type="button"
                      onClick={() => cambiarGoles(g, 1)}
                      aria-label={`Sumar un gol a ${g.nombre}`}
                      className="w-8 h-8 rounded-lg bg-[#ff7900]/15 hover:bg-[#ff7900]/30 text-[#ff7900] font-bold"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => borrar(g)}
                      aria-label={`Borrar a ${g.nombre}`}
                      className="ml-1 w-8 h-8 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                    >
                      🗑
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
