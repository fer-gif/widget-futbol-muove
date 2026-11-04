"use client";

import { useState } from "react";

type Props = {
  role: "superadmin" | "periodista";
  clientes?: { id: string; nombre_medio: string }[];
};

export default function LoginForm({ role, clientes = [] }: Props) {
  const [clienteId, setClienteId] = useState(clientes[0]?.id || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const esPeriodista = role === "periodista";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (esPeriodista && !clienteId) return setError("Seleccioná tu medio.");
    if (!password) return setError("Ingresá tu clave.");

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, password, clienteId }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        window.location.reload();
        return;
      }
      setError(data?.error || "No se pudo iniciar sesión.");
    } catch {
      setError("Error de conexión con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans flex items-center justify-center px-4 py-12">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-[#121214] border border-[#27272a] rounded-2xl p-8 shadow-2xl shadow-black/80 space-y-5"
      >
        <div className="text-center mb-2">
          <h1 className="text-3xl font-extrabold text-white tracking-wide">
            MUOVE <span className="text-[#ff7900]">{esPeriodista ? "CMS" : "SUPER-ADMIN"}</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-2">
            {esPeriodista
              ? "Acceso exclusivo para periodistas de medios asociados"
              : "Acceso restringido al equipo de Muove"}
          </p>
        </div>

        {esPeriodista && (
          <label className="block">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Medio</span>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="mt-2 w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff7900]"
            >
              {clientes.length === 0 && <option value="">No hay medios activos</option>}
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre_medio}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            {esPeriodista ? "Clave de acceso" : "Contraseña"}
          </span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff7900]"
            placeholder="••••••"
            autoFocus
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#ff7900] hover:bg-[#ff8f26] disabled:opacity-60 text-black font-extrabold py-3 rounded-xl transition-all"
        >
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
