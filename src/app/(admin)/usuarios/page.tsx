"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type UserRow = {
  id_evento: number;
  id_cuenta: number;
  nombre: string;
  rol: "superadmin" | "usuario";
  permisos?: Record<string, unknown> | null;
  fathom?: string | null;
  id_webhook_fathom?: string | null;
};

export default function UsuariosAdmin() {
  const qc = useQueryClient();
  const usersQ = useQuery<{ users: UserRow[] }>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await fetch("/api/usuarios", { cache: "no-store" });
      if (!res.ok) throw new Error("No autorizado o error cargando usuarios");
      return res.json();
    },
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rolSel, setRolSel] = useState<"usuario" | "superadmin">("usuario");
  const [permisosState, setPermisosState] = useState<{
    tarjetas: { enabled: boolean; items: { inversion: boolean; impresiones: boolean; ctr: boolean } };
    graficas: { enabled: boolean };
    resumen_adquisicion: { enabled: boolean };
    leaderboard: { enabled: boolean };
  }>({
    tarjetas: { enabled: true, items: { inversion: true, impresiones: true, ctr: true } },
    graficas: { enabled: true },
    resumen_adquisicion: { enabled: true },
    leaderboard: { enabled: true },
  });
  const [openCreate, setOpenCreate] = useState(false);

  function Toggle({
    value,
    onChange,
    label,
    color = "cyan",
  }: {
    value: boolean;
    onChange: (v: boolean) => void;
    label: string;
    color?: "cyan" | "emerald" | "purple" | "fuchsia" | "blue" | "yellow";
  }) {
    const base =
      color === "emerald"
        ? "border-emerald-500/40 text-emerald-300"
        : color === "purple"
        ? "border-purple-500/40 text-purple-300"
        : color === "fuchsia"
        ? "border-fuchsia-500/40 text-fuchsia-300"
        : color === "blue"
        ? "border-blue-500/40 text-blue-300"
        : color === "yellow"
        ? "border-yellow-500/40 text-yellow-300"
        : "border-cyan-500/40 text-cyan-300";
    return (
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
          value ? `bg-neutral-900/60 ${base}` : "bg-neutral-900/40 border-neutral-700/60 text-neutral-300 hover:text-white hover:border-neutral-500"
        }`}
      >
        {label}: {value ? "ON" : "OFF"}
      </button>
    );
  }

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 px-6 sm:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Panel de usuarios</h1>
        <div className="flex items-center gap-2">
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 hover:text-emerald-200">
                ➕ Agregar usuario
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[680px] bg-neutral-950 border-neutral-800 text-neutral-100 mx-4">
              <DialogHeader>
                <DialogTitle>Agregar usuario</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={async (ev) => {
                  ev.preventDefault();
                  if (creating) return;
                  setError(null);
                  const fd = new FormData(ev.currentTarget as HTMLFormElement);
                  const payload = {
                    nombre: String(fd.get("nombre") || "").trim(),
                    pass: String(fd.get("pass") || "").trim(),
                    rol: rolSel,
                    permisos: rolSel === "superadmin" ? {} : permisosState,
                    fathom_api_key: String(fd.get("fathom_api_key") || "").trim(),
                  };
                  try {
                    setCreating(true);
                    const res = await fetch("/api/usuarios", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload),
                    });
                    if (!res.ok) {
                      const j = await res.json().catch(() => ({}));
                      setError(j?.error || res.statusText);
                      return;
                    }
                    (ev.currentTarget as HTMLFormElement).reset();
                    setRolSel("usuario");
                    setPermisosState({
                      tarjetas: { enabled: true, items: { inversion: true, impresiones: true, ctr: true } },
                      graficas: { enabled: true },
                      resumen_adquisicion: { enabled: true },
                      leaderboard: { enabled: true },
                    });
                    qc.invalidateQueries({ queryKey: ["admin-users"] });
                    setOpenCreate(false);
                  } finally {
                    setCreating(false);
                  }
                }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-neutral-300">Nombre</label>
                    <Input name="nombre" required className="mt-1" />
                  </div>
                  <div>
                    <label className="text-sm text-neutral-300">Clave</label>
                    <Input name="pass" type="password" required className="mt-1" />
                  </div>
                  <div>
                    <label className="text-sm text-neutral-300">Rol</label>
                    <select
                      name="rol"
                      value={rolSel}
                      onChange={(e) => setRolSel(e.target.value === "superadmin" ? "superadmin" : "usuario")}
                      className="w-full mt-1 bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm"
                    >
                      <option value="usuario">Usuario</option>
                      <option value="superadmin">Superadmin</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-neutral-300">Fathom API Key (opcional)</label>
                    <Input name="fathom_api_key" className="mt-1" />
                  </div>
                </div>
                {rolSel === "usuario" && (
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
                    <div className="mb-3 text-sm text-neutral-300">Permisos</div>
                    {/* Tarjetas */}
                    <div className="mb-4">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <div className="text-white font-medium">Tarjetas generales</div>
                        <Toggle
                          label="Activar"
                          color="fuchsia"
                          value={permisosState.tarjetas.enabled}
                          onChange={(v) =>
                            setPermisosState((p) => ({ ...p, tarjetas: { ...p.tarjetas, enabled: v } }))
                          }
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Toggle
                          label="Inversión en Publicidad"
                          color="purple"
                          value={permisosState.tarjetas.items.inversion}
                          onChange={(v) =>
                            setPermisosState((p) => ({ ...p, tarjetas: { ...p.tarjetas, items: { ...p.tarjetas.items, inversion: v } } }))
                          }
                        />
                        <Toggle
                          label="Impresiones"
                          color="blue"
                          value={permisosState.tarjetas.items.impresiones}
                          onChange={(v) =>
                            setPermisosState((p) => ({ ...p, tarjetas: { ...p.tarjetas, items: { ...p.tarjetas.items, impresiones: v } } }))
                          }
                        />
                        <Toggle
                          label="CTR"
                          color="emerald"
                          value={permisosState.tarjetas.items.ctr}
                          onChange={(v) =>
                            setPermisosState((p) => ({ ...p, tarjetas: { ...p.tarjetas, items: { ...p.tarjetas.items, ctr: v } } }))
                          }
                        />
                      </div>
                    </div>
                    {/* Gráficas */}
                    <div className="mb-4">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <div className="text-white font-medium">Gráficas</div>
                        <Toggle
                          label="Activar"
                          color="cyan"
                          value={permisosState.graficas.enabled}
                          onChange={(v) => setPermisosState((p) => ({ ...p, graficas: { enabled: v } }))}
                        />
                      </div>
                    </div>
                    {/* Resumen por Métodos de Adquisición */}
                    <div className="mb-4">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <div className="text-white font-medium">Resumen por Métodos de Adquisición</div>
                        <Toggle
                          label="Activar"
                          color="emerald"
                          value={permisosState.resumen_adquisicion.enabled}
                          onChange={(v) => setPermisosState((p) => ({ ...p, resumen_adquisicion: { enabled: v } }))}
                        />
                      </div>
                    </div>
                    {/* Leaderboard */}
                    <div>
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <div className="text-white font-medium">Leaderboard de Closers</div>
                        <Toggle
                          label="Activar"
                          color="yellow"
                          value={permisosState.leaderboard.enabled}
                          onChange={(v) => setPermisosState((p) => ({ ...p, leaderboard: { enabled: v } }))}
                        />
                      </div>
                    </div>
                  </div>
                )}
                {error && <div className="text-sm text-red-400">{error}</div>}
                <div className="flex justify-end">
                  <Button disabled={creating} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50">
                    {creating ? "Creando..." : "Crear usuario"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            className="bg-neutral-900 border-neutral-800 text-neutral-200 hover:border-cyan-400/40 hover:text-cyan-300"
            onClick={() => window.open("/", "_self")}
          >
            ← Volver
          </Button>
        </div>
      </div>

      {/* Sección de creación movida al modal. */}

      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Usuarios</h2>
        {usersQ.isLoading ? (
          <div className="text-neutral-300">Cargando...</div>
        ) : usersQ.isError ? (
          <div className="text-red-400">Error cargando usuarios</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-300 border-b border-neutral-800">
                  <th className="py-2">ID</th>
                  <th className="py-2">Nombre</th>
                  <th className="py-2">Rol</th>
                  <th className="py-2">Webhook</th>
                  <th className="py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(usersQ.data?.users ?? []).map((u) => (
                  <tr key={u.id_evento} className="border-b border-neutral-800">
                    <td className="py-2">{u.id_evento}</td>
                    <td className="py-2">{u.nombre}</td>
                    <td className="py-2">{u.rol}</td>
                    <td className="py-2">{u.id_webhook_fathom ?? "—"}</td>
                    <td className="py-2 text-right">
                      <Button
                        variant="outline"
                        className="bg-neutral-900 border-neutral-800 text-neutral-200 hover:border-red-400/40 hover:text-red-300"
                        onClick={async () => {
                          if (!confirm(`¿Eliminar usuario ${u.nombre}?`)) return;
                          const res = await fetch(`/api/usuarios/${u.id_evento}`, { method: "DELETE" });
                          if (!res.ok) {
                            alert("No se pudo eliminar");
                            return;
                          }
                          qc.invalidateQueries({ queryKey: ["admin-users"] });
                        }}
                      >
                        Borrar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


