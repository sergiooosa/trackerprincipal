"use client";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ChevronDown, ChevronRight } from "lucide-react";

type UserRow = {
  id_evento: number;
  id_cuenta: number;
  nombre: string;
  rol: "superadmin" | "usuario";
  permisos?: PermissionsState | null; // Tipado más específico
  fathom?: string | null;
  id_webhook_fathom?: string | null;
};

// --- Configuración de Métricas ---

type PermissionGroupState = {
  enabled: boolean;
  items: Record<string, boolean>;
};

type PermissionsState = {
  tarjetas: PermissionGroupState;
  graficas: PermissionGroupState;
  adquisicion: PermissionGroupState;
  leaderboard: PermissionGroupState;
};

const ITEMS_TARJETAS = [
  { key: "inversion", label: "Inversión en Publicidad" },
  { key: "impresiones", label: "Impresiones" },
  { key: "ctr", label: "CTR" },
  { key: "vsl_play_rate", label: "VSL Play Rate" },
  { key: "vsl_engagement", label: "VSL Engagement" },
  { key: "reuniones_agendadas", label: "Reuniones Agendadas" },
  { key: "reuniones_calificadas", label: "Reuniones Calificadas" },
  { key: "reuniones_asistidas", label: "Reuniones Asistidas (Show Rate)" },
  { key: "llamadas_cerradas", label: "Llamadas Cerradas (Close Rate)" },
  { key: "llamadas_canceladas", label: "Llamadas Canceladas" },
  { key: "llamadas_pendientes", label: "Llamadas Pendientes (PDTE)" },
  { key: "no_show", label: "No Show" },
  { key: "facturacion", label: "Facturación" },
  { key: "cash_collected", label: "Cash Collected" },
  { key: "ticket_promedio", label: "Ticket Promedio" },
  { key: "costo_agenda", label: "Costo por Agenda Calificada" },
  { key: "costo_show", label: "Costo por Show" },
  { key: "cac", label: "Costo por Adquisición (CAC)" },
  { key: "roas_facturacion", label: "ROAS (Facturación)" },
  { key: "roas_cash", label: "ROAS (Cash Collected)" },
  { key: "revenue_show", label: "Revenue por Show" },
  { key: "pct_calificacion", label: "% Calificación" },
];

const ITEMS_GRAFICAS = [
  { key: "financiero", label: "Rendimiento Financiero (Area)" },
  { key: "volumen", label: "Volumen de Llamadas (Barra)" },
];

const ITEMS_ADQUISICION = [
  { key: "view", label: "Visualización General" },
];

const ITEMS_LEADERBOARD = [
  { key: "view", label: "Visualización General" },
];

const INITIAL_PERMISOS: PermissionsState = {
  tarjetas: {
    enabled: true,
    items: ITEMS_TARJETAS.reduce((acc, i) => ({ ...acc, [i.key]: true }), {}),
  },
  graficas: {
    enabled: true,
    items: ITEMS_GRAFICAS.reduce((acc, i) => ({ ...acc, [i.key]: true }), {}),
  },
  adquisicion: {
    enabled: true,
    items: ITEMS_ADQUISICION.reduce((acc, i) => ({ ...acc, [i.key]: true }), {}),
  },
  leaderboard: {
    enabled: true,
    items: ITEMS_LEADERBOARD.reduce((acc, i) => ({ ...acc, [i.key]: true }), {}),
  },
};

// --- Componentes UI ---

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent 
        transition-colors duration-200 ease-in-out focus:outline-none 
        ${checked ? "bg-emerald-500" : "bg-neutral-700"}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 
          transition duration-200 ease-in-out
          ${checked ? "translate-x-5" : "translate-x-0"}
        `}
      />
    </button>
  );
}

function SectionGroup({
  title,
  groupState,
  itemsConfig,
  onGroupChange,
  onItemChange,
}: {
  title: string;
  groupState: PermissionGroupState;
  itemsConfig: { key: string; label: string }[];
  onGroupChange: (val: boolean) => void;
  onItemChange: (key: string, val: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-neutral-800 rounded-lg overflow-hidden bg-neutral-900/30 mb-3">
      <div className="flex items-center justify-between p-3 bg-neutral-900/50">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>
          <span className="font-medium text-neutral-200 select-none cursor-pointer" onClick={() => setExpanded(!expanded)}>
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500 uppercase tracking-wider">{groupState.enabled ? "Activo" : "Inactivo"}</span>
          <Switch checked={groupState.enabled} onChange={onGroupChange} />
        </div>
      </div>
      
      {expanded && (
        <div className="p-3 border-t border-neutral-800 bg-neutral-950/30">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {itemsConfig.map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <span className="text-sm text-neutral-400">{item.label}</span>
                <Switch
                  checked={groupState.items[item.key] ?? false}
                  onChange={(v) => onItemChange(item.key, v)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

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
  const [openCreate, setOpenCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  
  const [permisos, setPermisos] = useState<PermissionsState>(INITIAL_PERMISOS);

  // Cargar datos al abrir modal
  useEffect(() => {
    if (openCreate) {
      if (editingUser) {
        // Modo Edición
        setRolSel(editingUser.rol);
        setError(null);
        if (editingUser.rol === 'usuario' && editingUser.permisos) {
          // Fusionar permisos guardados con la estructura actual (para no romper si hay nuevos items)
          const merged = { ...INITIAL_PERMISOS };
          // Deep merge simple para los 4 grupos
          (['tarjetas', 'graficas', 'adquisicion', 'leaderboard'] as const).forEach(key => {
            const savedGroup = editingUser.permisos?.[key];
            if (savedGroup) {
              merged[key] = {
                enabled: savedGroup.enabled ?? true,
                items: { ...merged[key].items, ...savedGroup.items }
              };
            }
          });
          setPermisos(merged);
        } else {
          setPermisos(INITIAL_PERMISOS);
        }
      } else {
        // Modo Creación (Reset)
        setPermisos(INITIAL_PERMISOS);
        setRolSel("usuario");
        setError(null);
      }
    }
  }, [openCreate, editingUser]);

  const handleGroupChange = (groupKey: keyof PermissionsState, val: boolean) => {
    setPermisos((prev) => {
      const group = prev[groupKey];
      const newItems = { ...group.items };
      Object.keys(newItems).forEach((k) => (newItems[k] = val));
      return {
        ...prev,
        [groupKey]: { enabled: val, items: newItems },
      };
    });
  };

  const handleItemChange = (groupKey: keyof PermissionsState, itemKey: string, val: boolean) => {
    setPermisos((prev) => {
      const group = prev[groupKey];
      const newItems = { ...group.items, [itemKey]: val };
      const allTrue = Object.values(newItems).every((v) => v === true);
      return {
        ...prev,
        [groupKey]: { enabled: allTrue, items: newItems },
      };
    });
  };

  const handleOpenCreate = () => {
    setEditingUser(null);
    setOpenCreate(true);
  };

  const handleOpenEdit = (user: UserRow) => {
    setEditingUser(user);
    setOpenCreate(true);
  };

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 px-6 sm:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Panel de usuarios</h1>
        <div className="flex items-center gap-2">
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button 
                onClick={handleOpenCreate}
                className="bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 hover:text-emerald-200"
              >
                ➕ Agregar usuario
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] bg-neutral-950 border-neutral-800 text-neutral-100 mx-4 max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingUser ? "Editar usuario" : "Agregar nuevo usuario"}</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-6 pt-4"
                onSubmit={async (ev) => {
                  ev.preventDefault();
                  if (creating) return;
                  setError(null);
                  const fd = new FormData(ev.currentTarget as HTMLFormElement);
                  const passVal = String(fd.get("pass") || "").trim();
                  
                  // Validación: pass requerido solo al crear
                  if (!editingUser && !passVal) {
                    setError("La contraseña es obligatoria al crear.");
                    return;
                  }

                  const payload = {
                    nombre: String(fd.get("nombre") || "").trim(),
                    pass: passVal || undefined, // undefined para no enviar si está vacío en edit
                    rol: rolSel,
                    permisos: rolSel === "superadmin" ? {} : permisos,
                    fathom_api_key: String(fd.get("fathom_api_key") || "").trim(),
                  };

                  try {
                    setCreating(true);
                    let res;
                    if (editingUser) {
                      // UPDATE
                      res = await fetch(`/api/usuarios/${editingUser.id_evento}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                      });
                    } else {
                      // CREATE
                      res = await fetch("/api/usuarios", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                      });
                    }

                    if (!res.ok) {
                      const j = await res.json().catch(() => ({}));
                      setError(j?.error || res.statusText);
                      return;
                    }
                    qc.invalidateQueries({ queryKey: ["admin-users"] });
                    setOpenCreate(false);
                  } finally {
                    setCreating(false);
                  }
                }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-neutral-400 font-medium mb-1 block">Nombre</label>
                    <Input 
                      name="nombre" 
                      required 
                      className="bg-neutral-900 border-neutral-800" 
                      placeholder="Ej. Juan Perez"
                      defaultValue={editingUser?.nombre || ""} 
                    />
                  </div>
                  <div>
                    <label className="text-sm text-neutral-400 font-medium mb-1 block">
                      {editingUser ? "Nueva Contraseña (opcional)" : "Contraseña"}
                    </label>
                    <Input 
                      name="pass" 
                      type="password" 
                      required={!editingUser} // Solo requerida al crear
                      className="bg-neutral-900 border-neutral-800" 
                      placeholder={editingUser ? "Dejar vacío para mantener" : "••••••••"} 
                    />
                  </div>
                  <div>
                    <label className="text-sm text-neutral-400 font-medium mb-1 block">Rol</label>
                    <select
                      name="rol"
                      value={rolSel}
                      onChange={(e) => setRolSel(e.target.value === "superadmin" ? "superadmin" : "usuario")}
                      className="w-full h-10 bg-neutral-900 border border-neutral-800 rounded-md px-3 text-sm text-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-700"
                    >
                      <option value="usuario">Usuario</option>
                      <option value="superadmin">Superadmin</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-neutral-400 font-medium mb-1 block">Fathom API Key (Opcional)</label>
                    <Input 
                      name="fathom_api_key" 
                      className="bg-neutral-900 border-neutral-800" 
                      placeholder="sk_..."
                      defaultValue={editingUser?.fathom || ""} 
                    />
                  </div>
                </div>

                {rolSel === "usuario" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-neutral-800">
                      <span className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">Permisos de visualización</span>
                    </div>
                    
                    <SectionGroup
                      title="Tarjetas y KPIs"
                      groupState={permisos.tarjetas}
                      itemsConfig={ITEMS_TARJETAS}
                      onGroupChange={(v) => handleGroupChange("tarjetas", v)}
                      onItemChange={(k, v) => handleItemChange("tarjetas", k, v)}
                    />
                    
                    <SectionGroup
                      title="Gráficas de Rendimiento"
                      groupState={permisos.graficas}
                      itemsConfig={ITEMS_GRAFICAS}
                      onGroupChange={(v) => handleGroupChange("graficas", v)}
                      onItemChange={(k, v) => handleItemChange("graficas", k, v)}
                    />

                    <SectionGroup
                      title="Resumen por Métodos de Adquisición"
                      groupState={permisos.adquisicion}
                      itemsConfig={ITEMS_ADQUISICION}
                      onGroupChange={(v) => handleGroupChange("adquisicion", v)}
                      onItemChange={(k, v) => handleItemChange("adquisicion", k, v)}
                    />

                    <SectionGroup
                      title="Leaderboard de Closers"
                      groupState={permisos.leaderboard}
                      itemsConfig={ITEMS_LEADERBOARD}
                      onGroupChange={(v) => handleGroupChange("leaderboard", v)}
                      onItemChange={(k, v) => handleItemChange("leaderboard", k, v)}
                    />
                  </div>
                )}

                {error && (
                  <div className="p-3 rounded-md bg-red-900/20 border border-red-900/50 text-red-300 text-sm">
                    {error}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2 border-t border-neutral-800">
                  <Button type="button" variant="ghost" onClick={() => setOpenCreate(false)} className="text-neutral-400 hover:text-white">
                    Cancelar
                  </Button>
                  <Button disabled={creating} type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white min-w-[120px]">
                    {creating ? "Guardando..." : (editingUser ? "Guardar Cambios" : "Crear Usuario")}
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

      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-6 overflow-hidden">
        <h2 className="text-lg font-semibold mb-4 text-white">Usuarios registrados</h2>
        {usersQ.isLoading ? (
          <div className="text-neutral-400 animate-pulse">Cargando lista...</div>
        ) : usersQ.isError ? (
          <div className="text-red-400 bg-red-900/10 p-4 rounded-lg border border-red-900/30">
            Error cargando usuarios. Verifica tu sesión.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead>
                <tr className="text-neutral-400 border-b border-neutral-800">
                  <th className="py-3 px-4 font-medium">ID</th>
                  <th className="py-3 px-4 font-medium">Nombre</th>
                  <th className="py-3 px-4 font-medium">Rol</th>
                  <th className="py-3 px-4 font-medium">Fathom Webhook</th>
                  <th className="py-3 px-4 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {(usersQ.data?.users ?? []).map((u) => (
                  <tr key={u.id_evento} className="hover:bg-neutral-900/40 transition-colors">
                    <td className="py-3 px-4 text-neutral-500 font-mono text-xs">{u.id_evento}</td>
                    <td className="py-3 px-4 text-neutral-200 font-medium">{u.nombre}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          u.rol === "superadmin"
                            ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                            : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        }`}
                      >
                        {u.rol === "superadmin" ? "Super Admin" : "Usuario"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-neutral-400 text-xs font-mono">
                      {u.id_webhook_fathom && u.id_webhook_fathom !== "na" ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          ● Activo <span className="text-neutral-600">({u.id_webhook_fathom.slice(0, 8)}...)</span>
                        </span>
                      ) : (
                        <span className="text-neutral-600">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/30 h-8"
                          onClick={() => handleOpenEdit(u)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300 hover:bg-red-950/30 h-8"
                          onClick={async () => {
                            if (!confirm(`¿Eliminar usuario "${u.nombre}" permanentemente?`)) return;
                            const res = await fetch(`/api/usuarios/${u.id_evento}`, { method: "DELETE" });
                            if (!res.ok) {
                              alert("No se pudo eliminar");
                              return;
                            }
                            qc.invalidateQueries({ queryKey: ["admin-users"] });
                          }}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {usersQ.data?.users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-neutral-500">
                      No hay usuarios registrados aparte de ti.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
