"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 px-6 sm:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Panel de usuarios</h1>
        <Button
          variant="outline"
          className="bg-neutral-900 border-neutral-800 text-neutral-200 hover:border-cyan-400/40 hover:text-cyan-300"
          onClick={() => window.open("/", "_self")}
        >
          ← Volver
        </Button>
      </div>

      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Crear usuario</h2>
        <form
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          onSubmit={async (ev) => {
            ev.preventDefault();
            if (creating) return;
            setError(null);
            const fd = new FormData(ev.currentTarget as HTMLFormElement);
            const payload = {
              nombre: String(fd.get("nombre") || "").trim(),
              pass: String(fd.get("pass") || "").trim(),
              rol: String(fd.get("rol") || "usuario").trim(),
              permisos: JSON.parse(String(fd.get("permisos") || "{}") || "{}"),
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
              qc.invalidateQueries({ queryKey: ["admin-users"] });
            } finally {
              setCreating(false);
            }
          }}
        >
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
            <select name="rol" className="w-full mt-1 bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm">
              <option value="usuario">Usuario</option>
              <option value="superadmin">Superadmin</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-neutral-300">Permisos (JSON)</label>
            <Input name="permisos" placeholder='{"tarjetas":{"enabled":true}}' className="mt-1" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm text-neutral-300">Fathom API Key (opcional)</label>
            <Input name="fathom_api_key" className="mt-1" />
          </div>
          {error && <div className="sm:col-span-2 text-sm text-red-400">{error}</div>}
          <div className="sm:col-span-2 flex justify-end">
            <Button disabled={creating} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50">
              {creating ? "Creando..." : "Crear"}
            </Button>
          </div>
        </form>
      </div>

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


