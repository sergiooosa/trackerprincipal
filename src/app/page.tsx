"use client";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, formatISO, startOfDay, endOfDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
// Importación estática de XLSX para exportación a Excel
import * as XLSX from "xlsx";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type EventItem = {
  id_evento: string;
  fecha_hora_evento: string;
  closer: string;
  cliente?: string | null;
  categoria?: string | null;
  cash_collected?: number | null;
  facturacion: number;
  anuncio_origen: string | null;
  resumen_ia: string | null;
  link_llamada?: string | null;
  tipo_registro?: string;
};

function RevivirForm({
  evento,
  clientId,
  timezone,
  onDone,
}: {
  evento: EventItem;
  clientId: string;
  timezone: string;
  onDone: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const defaultDt = format(new Date(evento.fecha_hora_evento), "yyyy-MM-dd'T'HH:mm");
  return (
    <form
      className="space-y-4"
      onSubmit={async (ev) => {
        ev.preventDefault();
        if (submitting) return;
        const form = ev.currentTarget as HTMLFormElement;
        const fd = new FormData(form);
        const idAgendaStr = String(evento.id_evento || "").replace(/^NS-/, "");
        const payload = {
          id_registro_agenda: Number(idAgendaStr),
          id_cuenta: clientId,
          tz: timezone,
          fecha_evento_local: String(fd.get("fecha_evento_local") || ""),
          closer: String(fd.get("closer") || "").trim(),
          correo_closer: String(fd.get("correo_closer") || "").trim(),
          cliente: String(fd.get("cliente") || "").trim(),
          email_lead: String(fd.get("email_lead") || "").trim(),
          categoria: String(fd.get("categoria") || "").toLowerCase(),
          cash_collected: Number(fd.get("cash_collected") || 0),
          facturacion: Number(fd.get("facturacion") || 0),
          anuncio_origen: String(fd.get("anuncio_origen") || "").toLowerCase(),
          link_llamada: String(fd.get("link_llamada") || ""),
          transcripcion: String(fd.get("transcripcion") || ""),
        };
        for (const [k, v] of Object.entries(payload)) {
          if (v === "" || v === null || (typeof v === "number" && Number.isNaN(v))) {
            alert(`Campo requerido faltante o inválido: ${k}`);
            return;
          }
        }
        try {
          setSubmitting(true);
          const res = await fetch("/api/eventos/revivir", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const msg = await res.json().catch(() => ({}));
            alert(`Error al revivir: ${msg?.error || res.statusText}`);
            return;
          }
          onDone();
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-neutral-300">Nombre del lead</label>
          <Input name="cliente" defaultValue={evento.cliente ?? ""} required className="mt-1" />
        </div>
        <div>
          <label className="text-sm text-neutral-300">Email del lead</label>
          <Input name="email_lead" type="email" required className="mt-1" />
        </div>
        <div>
          <label className="text-sm text-neutral-300">Fecha y hora del evento ({timezone})</label>
          <Input name="fecha_evento_local" type="datetime-local" required className="mt-1" defaultValue={defaultDt} />
        </div>
        <div>
          <label className="text-sm text-neutral-300">Closer</label>
          <Input name="closer" defaultValue={evento.closer} required className="mt-1" />
        </div>
        <div>
          <label className="text-sm text-neutral-300">Correo del closer</label>
          <Input name="correo_closer" type="email" required className="mt-1" />
        </div>
        <div>
          <label className="text-sm text-neutral-300">Categoría</label>
          <select name="categoria" required className="w-full mt-1 bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm">
            <option value="ofertada">Ofertada</option>
            <option value="no_ofertada">No_ofertada</option>
            <option value="cerrada">Cerrada</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-neutral-300">Cash collected</label>
          <Input name="cash_collected" type="number" step="0.01" min="0" required className="mt-1" defaultValue={Number(evento.cash_collected ?? 0)} />
        </div>
        <div>
          <label className="text-sm text-neutral-300">Facturación</label>
          <Input name="facturacion" type="number" step="0.01" min="0" required className="mt-1" defaultValue={Number(evento.facturacion ?? 0)} />
        </div>
        <div>
          <label className="text-sm text-neutral-300">Anuncio origen</label>
          <Input name="anuncio_origen" required className="mt-1" placeholder="exactamente como en Meta, en minúscula o &quot;no&quot;" defaultValue={(evento.anuncio_origen ?? "").toLowerCase()} />
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm text-neutral-300">Link de la llamada</label>
          <Input name="link_llamada" required className="mt-1" placeholder="pega el link o escribe algo si no tienes" />
        </div>
        <div className="sm:col-span-2">
          <div className="text-xs text-neutral-400 mb-1">Si no la tienes solo escribe &quot;no&quot;</div>
          <textarea name="transcripcion" required className="w-full h-40 bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button disabled={submitting} type="submit" className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed">
          {submitting ? "Analizando con IA..." : "Revivir"}
        </Button>
      </div>
    </form>
  );
}

type ApiResponse = {
  kpis: {
    total_facturacion: number;
    total_gasto_ads: number;
    total_llamadas_tomadas: number;
    llamadas_tomadas_agendas?: number;
    total_cierres: number;
    impresiones: number;
    ctr: number;
    vsl_play_rate: number;
    vsl_engagement: number;
    reuniones_agendadas: number;
    agendas_efectivas: number;
    reuniones_calificadas: number;
    cash_collected: number;
    ticket_promedio: number;
    cac: number;
    costo_por_agenda_calificada: number;
    costo_por_show: number;
    roas: number;
    roas_cash_collected: number;
    no_show: number;
    no_show_agendas: number;
    llamadas_canceladas: number;
    llamadas_pendientes: number;
    show_rate_real?: number;
    asistieron_show_agendas?: number;
    total_esperado_show_agendas?: number;
  };
  series: Array<{
    fecha: string;
    facturacion: number;
    gasto_ads: number;
    llamadas_tomadas: number;
    cierres: number;
  }>;
  closers: Array<{
    closer: string;
    llamadas_tomadas: number;
    cierres: number;
    facturacion_generada: number;
    cash_collected: number;
    reuniones_calificadas: number;
    shows: number;
  }>;
  events: Array<{
    id_evento: string;
    fecha_hora_evento: string;
    closer: string;
    cliente?: string | null;
    email_lead?: string | null;
    categoria?: string | null;
    cash_collected?: number | null;
    facturacion: number;
    anuncio_origen: string | null;
    resumen_ia: string | null;
    link_llamada?: string | null;
    tipo_registro?: string;
  }>;
  adsKpis?: {
    spend: number;
    impresiones: number;
    clicks: number;
    ctr_pct: number;
    vsl_play_rate: number;
    vsl_engagement: number;
    reuniones_agendadas: number;
  } | null;
  callsKpis?: {
    reuniones_asistidas: number;
    reuniones_calificadas: number;
    llamadas_cerradas: number;
    facturacion: number;
    fees: number;
  } | null;
  adsByOrigin?: Array<{
    anuncio_origen: string;
    agendas: number;
    tomadas: number;
    calificadas: number;
    cierres: number;
    facturacion: number;
    cash_collected: number;
    spend_allocated: number;
    shows?: number;
    show_rate_pct?: number;
    close_rate_pct?: number;
    llamadas_pendientes?: number;
  }>;
  hoy?: {
    fecha: string;
    llamadas_tomadas: number;
    llamadas_calificadas: number;
    cierres: number;
    fees_real: number;
    facturacion_real: number;
    anuncio_mas_efectivo: string;
    llamadas_agendadas: number;
    llamadas_canceladas: number;
    no_show: number;
    llamadas_ofertadas: number;
    fees_resumen: number;
    facturacion_total: number;
    gasto_ads: number;
    impresiones_totales: number;
    clicks_unicos: number;
    play_rate: number;
    engagement: number;
    cpm: number;
    cpc: number;
    ctr: number;
    agendamientos_ads: number;
  } | null;
  pendientes?: Array<{
    id_registro_agenda: number;
    fecha: string;
    nombre_de_lead: string;
    origen: string;
    email_lead: string;
    categoria: string;
    closer: string;
    fecha_de_la_reunion: string | null;
  }>;
};

function currency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
}

// Datos de demo eliminados: ya no se usan.

export default function Home() {
  const queryClient = useQueryClient();
  const today = new Date();
  const defaultStart = startOfDay(addDays(today, -6));
  const defaultEnd = endOfDay(today);
  const [startDate, setStartDate] = useState<Date>(defaultStart);
  const [endDate, setEndDate] = useState<Date>(defaultEnd);
  const [closerFilter, setCloserFilter] = useState<Record<string, string>>({});
  const [closerStatusFilter, setCloserStatusFilter] = useState<Record<string, string>>({});
  const [creativoFilter, setCreativoFilter] = useState<string>("");
  const [adquisicionOpen, setAdquisicionOpen] = useState<boolean>(true);

  // Configuración del cliente desde variables de entorno
  const clientId = process.env.NEXT_PUBLIC_CLIENT_ID || "2";
  const timezone = process.env.NEXT_PUBLIC_CLIENT_TIMEZONE || "America/Bogota";
  const clientName = process.env.NEXT_PUBLIC_CLIENT_NAME || "AutoKpi";
  const [openCreate, setOpenCreate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [openLogin, setOpenLogin] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isInIframe, setIsInIframe] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  // Verificar si estamos en cliente y en iframe (solo en cliente)
  useEffect(() => {
    setIsClient(true);
    setIsInIframe(typeof window !== "undefined" && window.self !== window.top);
  }, []);

  const meQuery = useQuery<{ user: { nombre: string; rol: string; permisos?: Record<string, unknown> } | null }>({
    queryKey: ["me"],
    queryFn: async () => {
      console.log("[Frontend] Ejecutando queryFn de /api/auth/me");
      console.log("[Frontend] Cookies antes del fetch:", document.cookie);
      
      const res = await fetch("/api/auth/me", { 
        cache: "no-store",
        credentials: "include" // CRÍTICO: Incluir cookies en iframes
      });
      
      console.log("[Frontend] Response status:", res.status);
      console.log("[Frontend] Response headers:", [...res.headers.entries()]);
      
      if (!res.ok) {
        console.error("[Frontend] Error en /api/auth/me:", res.status, res.statusText);
        throw new Error("No se pudo verificar la sesión");
      }
      
      const data = await res.json();
      console.log("[Frontend] Datos recibidos de /api/auth/me:", data);
      console.log("[Frontend] Usuario encontrado:", !!data.user);
      
      return data;
    },
    refetchOnWindowFocus: true, // Refrescar cuando la ventana recupera el foco
    refetchOnMount: true, // Refrescar al montar el componente
  });
  const me = meQuery.data?.user ?? null;

  // Efecto para verificar sesión periódicamente cuando está en iframe (GHL)
  useEffect(() => {
    if (!isInIframe || !isClient) return; // Solo en iframes y en cliente
    
    console.log("[Frontend] Detectado iframe - iniciando verificación periódica de sesión");
    
    // Verificar sesión cada 2 segundos si no hay usuario
    const interval = setInterval(async () => {
      if (!me) {
        console.log("[Frontend] Sin sesión detectada, verificando...");
        const check = await fetch("/api/auth/me", { 
          credentials: "include",
          cache: "no-store" 
        });
        const data = await check.json();
        
        if (data.user) {
          console.log("[Frontend] ✅ Sesión encontrada en verificación periódica!");
          queryClient.setQueryData(["me"], data);
        } else {
          console.log("[Frontend] ❌ Aún sin sesión");
        }
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [me, queryClient, isInIframe, isClient]);

  // Función auxiliar para verificar permisos
  const canView = (
    u: typeof me, 
    section: 'tarjetas' | 'graficas' | 'adquisicion' | 'leaderboard', 
    item?: string
  ): boolean => {
    if (!u) return false;
    if (u.rol === "superadmin") return true;
    
    // Si no tiene permisos definidos (legacy), permitimos ver todo por compatibilidad
    if (!u.permisos || Object.keys(u.permisos).length === 0) return true;

    // Validar estructura de permisos
    const p = u.permisos as Record<string, { enabled?: boolean; items?: Record<string, boolean> }> | undefined;
    if (!p) return true;

    const group = p[section];
    
    // Si la sección no existe en los permisos, permitimos por defecto
    if (!group) return true;

    // Si se pide un item específico dentro de la sección
    if (item) {
      // Verificar directamente el estado del item si existe
      if (group.items && item in group.items) {
        return group.items[item] === true;
      }
      // Si el item no está definido explícitamente, usamos el estado global de la sección
      return group.enabled !== false;
    }

    // Si solo se pide la sección general (para el contenedor)
    // Mostramos la sección si: enabled es true, O si hay al menos un item activo
    if (group.enabled === true) return true;
    
    // Aunque enabled sea false (porque no todos están activos), 
    // mostramos la sección si hay al menos un item activo
    if (group.items && Object.values(group.items).some(v => v === true)) {
      return true;
    }
    
    return false;
  };

  const { data, isLoading, isError, isFetching, error } = useQuery<ApiResponse>({
    queryKey: ["dashboard", `id:${clientId}`, `tz:${timezone}`, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        fecha_inicio: formatISO(startOfDay(startDate)),
        fecha_fin: formatISO(endOfDay(endDate)),
        id_cuenta: clientId,
        tz: timezone,
      });
      const res = await fetch(`/api/dashboard?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body?.error || res.statusText || "Error fetching dashboard data";
        throw new Error(msg);
      }
      return res.json();
    },
  });

  const dataset: ApiResponse | undefined = data && !isError ? data : undefined;
  // const kpis = dataset?.kpis; // no se usa ya; KPIs vienen de adsKpis/callsKpis arriba
  const series = useMemo(() => {
    return (dataset?.series ?? []).map(item => ({
      ...item,
      fecha: format(new Date(item.fecha), 'yyyy-MM-dd')
    }));
  }, [dataset]);
  const closers = useMemo(() => (dataset?.closers ?? []).map((c) => ({
    ...c,
    // Close rate: cierres / llamadas calificadas (corregido)
    tasa_cierre: c.reuniones_calificadas && c.cierres ? (c.cierres / c.reuniones_calificadas) * 100 : 0,
    // Show rate: shows / reuniones calificadas
    tasa_show: c.reuniones_calificadas && c.shows ? (c.shows / c.reuniones_calificadas) * 100 : 0,
  })), [dataset]);
  const totalShowsEventos = useMemo(
    () => (dataset?.closers ?? []).reduce((sum, c) => sum + Number(c.shows ?? 0), 0),
    [dataset]
  );
  const totalCalificadasEventos = useMemo(
    () => (dataset?.closers ?? []).reduce((sum, c) => sum + Number(c.reuniones_calificadas ?? 0), 0),
    [dataset]
  );
  const totalCierresEventos = useMemo(
    () => (dataset?.closers ?? []).reduce((sum, c) => sum + Number(c.cierres ?? 0), 0),
    [dataset]
  );
  const events = dataset?.events ?? [];

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 px-6 sm:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{clientName} - Traking Automático</h1>
        <div className="flex items-center gap-3">
          {me?.rol === "superadmin" && (
            <Button
              variant="outline"
              className="bg-neutral-900 border border-neutral-800 text-neutral-200 hover:border-cyan-400/40 hover:text-cyan-300"
              onClick={() => window.open("/usuarios", "_self")}
            >
              Usuarios
            </Button>
          )}
          {me?.rol === "superadmin" && (
            <Button
              variant="outline"
              className="bg-neutral-900 border border-neutral-800 text-neutral-200 hover:border-cyan-400/40 hover:text-cyan-300"
              onClick={() => window.open("/logs", "_self")}
            >
              Logs
            </Button>
          )}
          {!me ? (
            <Dialog open={openLogin} onOpenChange={setOpenLogin}>
              <DialogTrigger asChild>
                <Button className="bg-neutral-900 border border-neutral-800 text-neutral-200 hover:border-cyan-400/40 hover:text-cyan-300" variant="outline">
                  Iniciar sesión
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[420px] bg-neutral-950 border-neutral-800 text-neutral-100 mx-4">
                <DialogHeader>
                  <DialogTitle>Iniciar sesión</DialogTitle>
                </DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={async (ev) => {
                    ev.preventDefault();
                    if (loggingIn) return;
                    setLoginError(null);
                    const fd = new FormData(ev.currentTarget as HTMLFormElement);
                    const clave = String(fd.get("clave") || "");
                    const remember = fd.get("remember") === "on";
                    if (!clave) {
                      setLoginError("Ingresa la clave.");
                      return;
                    }
                    try {
                      setLoggingIn(true);
                      const res = await fetch("/api/auth/login", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ clave, remember }),
                        credentials: "include", // CRÍTICO: Incluir cookies en iframes
                      });
                      if (!res.ok) {
                        const j = await res.json().catch(() => ({}));
                        setLoginError(j?.error || res.statusText);
                        return;
                      }
                      
                      const loginData = await res.json();
                      console.log("[Login] Login exitoso, respuesta:", loginData);
                      
                      // Verificar cookies después del login
                      console.log("[Login] Cookies después del login:", document.cookie);
                      
                      setOpenLogin(false);
                      
                      // Invalidar y forzar refetch inmediato
                      await queryClient.invalidateQueries({ queryKey: ["me"] });
                      
                      // Esperar un momento y forzar otro refetch (por si acaso)
                      setTimeout(async () => {
                        console.log("[Login] Forzando segundo refetch de sesión...");
                        await queryClient.refetchQueries({ queryKey: ["me"] });
                        
                        // Verificar resultado
                        const meAfterRefetch = queryClient.getQueryData<{ user: { nombre: string } | null }>(["me"]);
                        console.log("[Login] Estado después del refetch:", meAfterRefetch);
                        
                        if (!meAfterRefetch?.user) {
                          console.warn("[Login] ⚠️ Sesión no detectada después del refetch. Intentando fetch manual...");
                          // Último intento: fetch manual
                          const manualCheck = await fetch("/api/auth/me", { 
                            credentials: "include",
                            cache: "no-store" 
                          });
                          const manualData = await manualCheck.json();
                          console.log("[Login] Resultado fetch manual:", manualData);
                          
                          if (manualData.user) {
                            // Actualizar manualmente el cache de React Query
                            queryClient.setQueryData(["me"], manualData);
                            console.log("[Login] ✅ Sesión actualizada manualmente en cache");
                          }
                        }
                      }, 500);
                    } finally {
                      setLoggingIn(false);
                    }
                  }}
                >
                  <div>
                    <label className="text-sm text-neutral-300">Clave</label>
                    <Input name="clave" type="password" required className="mt-1" />
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      name="remember"
                      id="remember"
                      className="h-4 w-4 rounded border-neutral-800 bg-neutral-900 text-emerald-600 focus:ring-emerald-600"
                    />
                    <label
                      htmlFor="remember"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-neutral-300"
                    >
                      ¿Confiar en este dispositivo?
                    </label>
                  </div>
                  {loginError && <div className="text-sm text-red-400">{loginError}</div>}
                  <div className="flex justify-end">
                    <Button disabled={loggingIn} type="submit" className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50">
                      {loggingIn ? "Entrando..." : "Entrar"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          ) : (
            <Button
              className="bg-neutral-900 border border-neutral-800 text-neutral-200 hover:border-red-400/40 hover:text-red-300"
              variant="outline"
              onClick={async () => {
                await fetch("/api/auth/logout", { 
                  method: "POST",
                  credentials: "include" // CRÍTICO: Incluir cookies en iframes
                });
                queryClient.invalidateQueries({ queryKey: ["me"] });
              }}
            >
              Cerrar sesión ({me.nombre})
            </Button>
          )}
          <Select
            onValueChange={(v) => {
              const t = new Date();
              if (v === "today") {
                setStartDate(startOfDay(t));
                setEndDate(endOfDay(t));
              } else if (v === "7") {
                setStartDate(startOfDay(addDays(t, -6)));
                setEndDate(endOfDay(t));
              } else if (v === "30") {
                setStartDate(startOfDay(addDays(t, -29)));
                setEndDate(endOfDay(t));
              }
            }}
          >
            <SelectTrigger className="w-[180px] bg-neutral-900 border-neutral-800">
              <SelectValue placeholder="Rango rápido" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="7">Últimos 7 días</SelectItem>
              <SelectItem value="30">Últimos 30 días</SelectItem>
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="bg-neutral-900 border-neutral-800 text-white hover:bg-neutral-800 hover:text-white">
                {`${format(startDate, "yyyy-MM-dd")} - ${format(endDate, "yyyy-MM-dd")}`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-neutral-950 border-neutral-800" align="end">
              <div className="flex gap-2 p-3">
                <Calendar mode="single" selected={startDate} onSelect={(d) => d && setStartDate(startOfDay(d))} />
                <Calendar mode="single" selected={endDate} onSelect={(d) => d && setEndDate(endOfDay(d))} />
              </div>
            </PopoverContent>
          </Popover>
          {me && (
            <Dialog open={openCreate} onOpenChange={setOpenCreate}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 hover:text-emerald-200">
                  ➕ Agregar llamada
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[820px] bg-neutral-950 border-neutral-800 text-neutral-100 mx-4">
                <DialogHeader>
                  <DialogTitle>Agregar llamada</DialogTitle>
                </DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={async (ev) => {
                    ev.preventDefault();
                    if (isCreating) return;
                    const form = ev.currentTarget as HTMLFormElement;
                    const fd = new FormData(form);
                    const payload = {
                      id_cuenta: clientId,
                      tz: timezone,
                      fecha_evento_local: String(fd.get("fecha_evento_local") || ""),
                      closer: String(fd.get("closer") || "").trim(),
                      correo_closer: String(fd.get("correo_closer") || "").trim(),
                      cliente: String(fd.get("cliente") || "").trim(),
                      email_lead: String(fd.get("email_lead") || "").trim(),
                      categoria: String(fd.get("categoria") || "").toLowerCase(),
                      cash_collected: Number(fd.get("cash_collected") || 0),
                      facturacion: Number(fd.get("facturacion") || 0),
                      anuncio_origen: String(fd.get("anuncio_origen") || "").toLowerCase(),
                      link_llamada: String(fd.get("link_llamada") || ""),
                      transcripcion: String(fd.get("transcripcion") || ""),
                    };
                    for (const [k, v] of Object.entries(payload)) {
                      if (v === "" || v === null || (typeof v === "number" && Number.isNaN(v))) {
                        alert(`Campo requerido faltante o inválido: ${k}`);
                        return;
                      }
                    }
                    try {
                      setIsCreating(true);
                      const res = await fetch("/api/eventos", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                      });
                      if (!res.ok) {
                        const msg = await res.json().catch(() => ({}));
                        alert(`Error creando llamada: ${msg?.error || res.statusText}`);
                        return;
                      }
                      setOpenCreate(false);
                      (document.activeElement as HTMLElement | null)?.blur();
                      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
                    } finally {
                      setIsCreating(false);
                    }
                  }}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-neutral-300">Nombre del lead</label>
                      <Input name="cliente" required className="mt-1" />
                    </div>
                    <div>
                      <label className="text-sm text-neutral-300">Email del lead</label>
                      <Input name="email_lead" type="email" required className="mt-1" />
                    </div>
                    <div>
                      <label className="text-sm text-neutral-300">Fecha y hora del evento ({timezone})</label>
                      <Input name="fecha_evento_local" type="datetime-local" required className="mt-1" />
                    </div>
                    <div>
                      <label className="text-sm text-neutral-300">Closer</label>
                      <Input name="closer" required className="mt-1" />
                    </div>
                    <div>
                      <label className="text-sm text-neutral-300">Correo del closer</label>
                      <Input name="correo_closer" type="email" required className="mt-1" />
                    </div>
                    <div>
                      <label className="text-sm text-neutral-300">Categoría</label>
                      <select name="categoria" required className="w-full mt-1 bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm">
                        <option value="ofertada">Ofertada</option>
                        <option value="no_ofertada">No_ofertada</option>
                        <option value="cerrada">Cerrada</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-neutral-300">Cash collected</label>
                      <Input name="cash_collected" type="number" step="0.01" min="0" required className="mt-1" />
                    </div>
                    <div>
                      <label className="text-sm text-neutral-300">Facturación</label>
                      <Input name="facturacion" type="number" step="0.01" min="0" required className="mt-1" />
                    </div>
                    <div>
                      <label className="text-sm text-neutral-300">Anuncio origen</label>
                      <Input name="anuncio_origen" required className="mt-1" placeholder="exactamente como en Meta, en minúscula o &quot;no&quot;" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-sm text-neutral-300">Link de la llamada</label>
                      <Input name="link_llamada" required className="mt-1" placeholder="pega el link o escribe algo si no tienes" />
                    </div>
                    <div className="sm:col-span-2">
                      <div className="text-xs text-neutral-400 mb-1">Si no la tienes solo escribe &quot;no&quot;</div>
                      <textarea name="transcripcion" required className="w-full h-40 bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button disabled={isCreating} type="submit" className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed">
                      {isCreating ? "Analizando con IA..." : "Guardar"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
          <Button
            onClick={() => {
              if (!dataset) return;
              const wb = XLSX.utils.book_new();

              const safeAppend = (name: string, rows: Array<Record<string, unknown>>) => {
                try {
                  const ws = XLSX.utils.json_to_sheet(rows);
                  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
                } catch {}
              };

              const kpisEntries = Object.entries(dataset.kpis || {}).map(([metric, value]) => ({ metric, value }));
              safeAppend("KPIs", kpisEntries);

              if (dataset.adsKpis) safeAppend("Ads_KPIs", [dataset.adsKpis]);
              if (dataset.callsKpis) safeAppend("Calls_KPIs", [dataset.callsKpis]);
              if (dataset.hoy) safeAppend("Hoy", [dataset.hoy]);

              safeAppend("Series", dataset.series || []);
              safeAppend("Closers", (dataset.closers || []).map((c) => ({
                ...c,
                tasa_cierre: c.llamadas_tomadas && c.cierres ? (c.cierres / c.llamadas_tomadas) * 100 : 0,
                tasa_show: c.reuniones_calificadas && c.shows ? (c.shows / c.reuniones_calificadas) * 100 : 0,
              })));
              // Truncar resumen_ia para evitar error de 32767 caracteres en Excel
              safeAppend("Eventos", (dataset.events || []).map((e) => ({
                ...e,
                resumen_ia: (e.resumen_ia || '').length > 32000 ? (e.resumen_ia || '').slice(0, 32000) + '...' : e.resumen_ia,
              })));
              safeAppend("Ads_por_Origen", dataset.adsByOrigin || []);
              safeAppend("Pendientes_PDTE", dataset.pendientes || []);

              const fileName = `dashboard_export_${format(startDate, "yyyyMMdd")}_${format(endDate, "yyyyMMdd")}_id3.xlsx`;
              XLSX.writeFile(wb, fileName);
            }}
            className="bg-neutral-900 border border-neutral-800 text-neutral-200 hover:border-cyan-400/40 hover:text-cyan-300"
            variant="outline"
          >
            📊 Exportar a Excel
          </Button>
        </div>
      </div>

      {!me ? (
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-8 text-center">
          <div className="text-xl text-white font-semibold mb-2">Inicia sesión para ver el dashboard</div>
          <div className="text-neutral-300 mb-4">Presiona &quot;Iniciar sesión&quot; en la parte superior.</div>
          
          {/* Debug info solo en desarrollo o si está en iframe */}
          {isClient && (process.env.NODE_ENV === "development" || isInIframe) && (
            <div className="mt-4 p-4 bg-neutral-950 border border-neutral-700 rounded text-left text-xs text-neutral-400">
              <div className="font-semibold text-neutral-300 mb-2">🔍 Debug Info:</div>
              <div>En iframe: {isInIframe ? "Sí" : "No"}</div>
              <div>Cookies: {typeof document !== "undefined" && document.cookie ? "Presentes" : "No hay cookies"}</div>
              <div>Session token en cookies: {typeof document !== "undefined" && document.cookie.includes("session_token") ? "✅ Sí" : "❌ No"}</div>
              <div>Query status: {meQuery.status}</div>
              <div>Query error: {meQuery.error ? String(meQuery.error) : "Ninguno"}</div>
              <div className="mt-2">
                <button
                  onClick={() => {
                    console.log("[Debug] Forzando refetch manual...");
                    queryClient.refetchQueries({ queryKey: ["me"] });
                  }}
                  className="px-3 py-1 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-500"
                >
                  🔄 Forzar Refetch
                </button>
              </div>
            </div>
          )}
        </div>
      ) : isLoading || isFetching ? (
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-neutral-900 rounded-md" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="h-72 bg-neutral-900 rounded-md" />
            <div className="h-72 bg-neutral-900 rounded-md" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="h-96 bg-neutral-900 rounded-md" />
            <div className="h-96 bg-neutral-900 rounded-md" />
          </div>
        </div>
      ) : isError ? (
        <div className="space-y-3">
          <div className="text-red-400">No se pudieron cargar los datos.</div>
          <pre className="bg-neutral-950 border border-neutral-800 rounded-md p-3 text-sm text-red-300 whitespace-pre-wrap">
            {(error as Error)?.message}
          </pre>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-8">
            {canView(me, 'tarjetas', 'inversion') && (
            <Card className="bg-gradient-to-br from-[#160e1f] to-[#0e0b19] border border-[#3a214b] shadow-[0_0_0_1px_rgba(168,85,247,0.15),0_10px_40px_-10px_rgba(168,85,247,0.3)]">
              <CardHeader><CardTitle className="text-white">Inversión en publicidad</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-fuchsia-300">{currency(data?.kpis?.total_gasto_ads || 0)}</CardContent>
            </Card>
            )}
            {canView(me, 'tarjetas', 'impresiones') && (
            <Card className="bg-gradient-to-br from-[#0b1420] to-[#0a0f18] border border-[#1b2a40] shadow-[0_0_0_1px_rgba(59,130,246,0.12),0_10px_40px_-10px_rgba(59,130,246,0.25)]">
              <CardHeader><CardTitle className="text-white">Impresiones</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-blue-300">{(data?.kpis?.impresiones ?? 0).toLocaleString()}</CardContent>
            </Card>
            )}
            {canView(me, 'tarjetas', 'ctr') && (
            <Card className="bg-gradient-to-br from-[#0b1220] to-[#0b0f19] border border-[#1b2a4a] shadow-[0_0_0_1px_rgba(59,130,246,0.15),0_10px_40px_-10px_rgba(59,130,246,0.3)]">
              <CardHeader><CardTitle className="text-white">CTR</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-cyan-300">{Number(data?.kpis?.ctr ?? 0).toFixed(2)}%</CardContent>
            </Card>
            )}
            {canView(me, 'tarjetas', 'vsl_play_rate') && (
            <Card className="bg-gradient-to-br from-[#0f1f18] to-[#0b1510] border border-[#1e3a2f] shadow-[0_0_0_1px_rgba(16,185,129,0.15),0_10px_40px_-10px_rgba(16,185,129,0.3)]">
              <CardHeader><CardTitle className="text-white">VSL PLAY RATE %</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-emerald-300">{Number(data?.kpis?.vsl_play_rate ?? 0).toFixed(1)}%</CardContent>
            </Card>
            )}
            {canView(me, 'tarjetas', 'vsl_engagement') && (
            <Card className="bg-gradient-to-br from-[#0f1f18] to-[#0b1510] border border-[#1e3a2f] shadow-[0_0_0_1px_rgba(16,185,129,0.15),0_10px_40px_-10px_rgba(16,185,129,0.3)]">
              <CardHeader><CardTitle className="text-white">VSL ENGAGEMENT %</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-emerald-300">{Number(data?.kpis?.vsl_engagement ?? 0).toFixed(1)}%</CardContent>
            </Card>
            )}
            
            {canView(me, 'tarjetas', 'reuniones_agendadas') && (
            <Card className="bg-gradient-to-br from-[#0b1220] to-[#0b0f19] border border-[#1b2a4a] shadow-[0_0_0_1px_rgba(59,130,246,0.15),0_10px_40px_-10px_rgba(59,130,246,0.3)]">
              <CardHeader><CardTitle className="text-white">Reuniones agendadas</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-cyan-300">{(data?.kpis?.reuniones_agendadas ?? 0).toLocaleString()}</CardContent>
            </Card>
            )}
            {canView(me, 'tarjetas', 'reuniones_calificadas') && (
            <Card className="bg-gradient-to-br from-[#0b1220] to-[#0b0f19] border border-[#1b2a4a] shadow-[0_0_0_1px_rgba(59,130,246,0.15),0_10px_40px_-10px_rgba(59,130,246,0.3)]">
              <CardHeader><CardTitle className="text-white">Reuniones calificadas</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-cyan-300">{totalCalificadasEventos.toLocaleString()}</CardContent>
            </Card>
            )}
            {canView(me, 'tarjetas', 'reuniones_asistidas') && (
            <Card className="bg-gradient-to-br from-[#0b1220] to-[#0b0f19] border border-[#1b2a4a] shadow-[0_0_0_1px_rgba(59,130,246,0.15),0_10px_40px_-10px_rgba(59,130,246,0.3)]">
              <CardHeader><CardTitle className="text-white">Reuniones asistidas (show rate)</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-cyan-300">{(() => {
                // Mantener el numerador visible desde eventos (consistencia con Leaderboard)
                const showsVisibles = totalShowsEventos;
                // Solo el porcentaje (show rate) se calcula desde agendas por fecha de la reunión:
                // asistieron = ('Cerrada','Ofertada','No_Ofertada')
                // total_esperado = ('Cerrada','Ofertada','No_Ofertada','no_show')
                const pct = Number(data?.kpis?.show_rate_real ?? 0);
                return `${showsVisibles.toLocaleString()} (${pct.toFixed(1)}%)`;
              })()}</CardContent>
            </Card>
            )}
            {canView(me, 'tarjetas', 'llamadas_cerradas') && (
            <Card className="bg-gradient-to-br from-[#0f1f18] to-[#0b1510] border border-[#1e3a2f] shadow-[0_0_0_1px_rgba(16,185,129,0.15),0_10px_40px_-10px_rgba(16,185,129,0.3)]">
              <CardHeader><CardTitle className="text-white">Llamadas cerradas (close rate)</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-emerald-300">{(() => {
                const sales = totalCierresEventos;
                const calificadas = totalCalificadasEventos;
                const pct = calificadas ? (sales / calificadas) * 100 : 0;
                return `${sales.toLocaleString()} (${pct.toFixed(1)}%)`;
              })()}</CardContent>
            </Card>
            )}

            {canView(me, 'tarjetas', 'llamadas_canceladas') && (
            <Card className="bg-gradient-to-br from-[#220b0b] to-[#150a0a] border border-[#4a1b1b] shadow-[0_0_0_1px_rgba(248,113,113,0.15),0_10px_40px_-10px_rgba(248,113,113,0.3)]">
              <CardHeader><CardTitle className="text-white">Llamadas canceladas</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-red-300">{(data?.kpis?.llamadas_canceladas ?? 0).toLocaleString()}</CardContent>
            </Card>
            )}

            {canView(me, 'tarjetas', 'llamadas_pendientes') && (
            <Card className="bg-gradient-to-br from-[#1f1a0b] to-[#13100a] border border-[#3a321b] shadow-[0_0_0_1px_rgba(234,179,8,0.15),0_10px_40px_-10px_rgba(234,179,8,0.3)]">
              <CardHeader><CardTitle className="text-white">Llamadas pendientes (PDTE)</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-yellow-300">{(data?.kpis?.llamadas_pendientes ?? 0).toLocaleString()}</CardContent>
            </Card>
            )}

            {canView(me, 'tarjetas', 'no_show') && (
            <Card className="bg-gradient-to-br from-[#1f1510] to-[#130f0a] border border-[#3a2d1b] shadow-[0_0_0_1px_rgba(251,146,60,0.15),0_10px_40px_-10px_rgba(251,146,60,0.3)]">
              <CardHeader><CardTitle className="text-white">No Show</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-orange-300">{(data?.kpis?.no_show_agendas ?? 0).toLocaleString()}</CardContent>
            </Card>
            )}

            {canView(me, 'tarjetas', 'facturacion') && (
            <Card className="bg-gradient-to-br from-[#0b1220] to-[#0b0f19] border border-[#1b2a4a] shadow-[0_0_0_1px_rgba(59,130,246,0.15),0_10px_40px_-10px_rgba(59,130,246,0.3)]">
              <CardHeader>
                <CardTitle className="text-white">Facturación</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold text-cyan-300">{currency(data?.kpis?.total_facturacion || 0)}</CardContent>
            </Card>
            )}
            {canView(me, 'tarjetas', 'cash_collected') && (
            <Card className="bg-gradient-to-br from-[#0f1f18] to-[#0b1510] border border-[#1e3a2f] shadow-[0_0_0_1px_rgba(16,185,129,0.15),0_10px_40px_-10px_rgba(16,185,129,0.3)]">
              <CardHeader><CardTitle className="text-white">Cash Collected</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-emerald-300">{currency(data?.kpis?.cash_collected || 0)}</CardContent>
            </Card>
            )}
            
            {canView(me, 'tarjetas', 'ticket_promedio') && (
            <Card className="bg-gradient-to-br from-[#0b1420] to-[#0a0f18] border border-[#1b2a40] shadow-[0_0_0_1px_rgba(59,130,246,0.12),0_10px_40px_-10px_rgba(59,130,246,0.25)]">
              <CardHeader><CardTitle className="text-white">Ticket promedio</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-blue-300">{currency(data?.kpis?.ticket_promedio || 0)}</CardContent>
            </Card>
            )}
            {canView(me, 'tarjetas', 'costo_agenda') && (
            <Card className="bg-gradient-to-br from-[#160e1f] to-[#0e0b19] border border-[#3a214b] shadow-[0_0_0_1px_rgba(168,85,247,0.15),0_10px_40px_-10px_rgba(168,85,247,0.3)]">
              <CardHeader><CardTitle className="text-white">Costo por agenda calificada</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-fuchsia-300">{currency(data?.kpis?.costo_por_agenda_calificada || 0)}</CardContent>
            </Card>
            )}
            {canView(me, 'tarjetas', 'costo_show') && (
            <Card className="bg-gradient-to-br from-[#160e1f] to-[#0e0b19] border border-[#3a214b] shadow-[0_0_0_1px_rgba(168,85,247,0.15),0_10px_40px_-10px_rgba(168,85,247,0.3)]">
              <CardHeader><CardTitle className="text-white">Costo por show</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-fuchsia-300">{currency(data?.kpis?.costo_por_show || 0)}</CardContent>
            </Card>
            )}
            {canView(me, 'tarjetas', 'cac') && (
            <Card className="bg-gradient-to-br from-[#160e1f] to-[#0e0b19] border border-[#3a214b] shadow-[0_0_0_1px_rgba(168,85,247,0.15),0_10px_40px_-10px_rgba(168,85,247,0.3)]">
              <CardHeader><CardTitle className="text-white">Costo por adquisición (CAC)</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-fuchsia-300">{currency(data?.kpis?.cac || 0)}</CardContent>
            </Card>
            )}
            {canView(me, 'tarjetas', 'roas_facturacion') && (
            <Card className="bg-gradient-to-br from-[#0f1f18] to-[#0b1510] border border-[#1e3a2f] shadow-[0_0_0_1px_rgba(16,185,129,0.15),0_10px_40px_-10px_rgba(16,185,129,0.3)]">
              <CardHeader><CardTitle className="text-white">ROAS (Facturación)</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-emerald-300">{data?.kpis?.roas ? data.kpis.roas.toFixed(2) + "x" : "—"}</CardContent>
            </Card>
            )}
            {canView(me, 'tarjetas', 'roas_cash') && (
            <Card className="bg-gradient-to-br from-[#0f1f18] to-[#0b1510] border border-[#1e3a2f] shadow-[0_0_0_1px_rgba(16,185,129,0.15),0_10px_40px_-10px_rgba(16,185,129,0.3)]">
              <CardHeader><CardTitle className="text-white">ROAS (Cash Collected)</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-emerald-300">{data?.kpis?.roas_cash_collected ? data.kpis.roas_cash_collected.toFixed(2) + "x" : "—"}</CardContent>
            </Card>
            )}
            
            {/* Nuevos tableros */}
            {canView(me, 'tarjetas', 'revenue_show') && (
            <Card className="bg-gradient-to-br from-[#1a0f2e] to-[#0f0a1a] border border-[#4a2c5a] shadow-[0_0_0_1px_rgba(147,51,234,0.15),0_10px_40px_-10px_rgba(147,51,234,0.3)]">
              <CardHeader><CardTitle className="text-white">Revenue por Show</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-purple-300">
                {(() => {
                  const cashCollected = data?.kpis?.cash_collected || 0;
                  const llamadasCalificadas = totalCalificadasEventos;
                  return llamadasCalificadas > 0 ? currency(cashCollected / llamadasCalificadas) : "$0";
                })()}
              </CardContent>
            </Card>
            )}
            
            {canView(me, 'tarjetas', 'pct_calificacion') && (
            <Card className="bg-gradient-to-br from-[#0f1a2e] to-[#0a0f1a] border border-[#2c4a5a] shadow-[0_0_0_1px_rgba(59,130,246,0.15),0_10px_40px_-10px_rgba(59,130,246,0.3)]">
              <CardHeader><CardTitle className="text-white">% Calificación</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-blue-300">
                {(() => {
                  const asistieron = totalShowsEventos;
                  const calificadas = totalCalificadasEventos;
                  return asistieron > 0 ? ((calificadas / asistieron) * 100).toFixed(1) + "%" : "0%";
                })()}
              </CardContent>
            </Card>
            )}
          </div>

          {canView(me, 'graficas') && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {canView(me, 'graficas', 'financiero') && (
            <Card className="bg-neutral-900/60 backdrop-blur border border-neutral-800">
              <CardHeader>
                <CardTitle className="text-white">Rendimiento Financiero</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer>
                    <AreaChart data={series} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="colorFact" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.6} />
                          <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorAd" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.6} />
                          <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                      <XAxis dataKey="fecha" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #262626" }} />
                      <Legend />
                      <Area type="monotone" dataKey="facturacion" name="Facturación" stroke="#22d3ee" fill="url(#colorFact)" />
                      <Area type="monotone" dataKey="gasto_ads" name="Gasto Ads" stroke="#a78bfa" fill="url(#colorAd)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            )}

            {canView(me, 'graficas', 'volumen') && (
            <Card className="bg-neutral-900/60 backdrop-blur border border-neutral-800">
              <CardHeader>
                <CardTitle className="text-white">Volumen de Llamadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer>
                    <BarChart data={series} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                      <XAxis dataKey="fecha" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #262626" }} />
                      <Legend />
                      <Bar dataKey="llamadas_tomadas" name="Llamadas Tomadas" stackId="a" fill="#60a5fa" />
                      <Bar dataKey="cierres" name="Cierres" stackId="a" fill="#34d399" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            )}
          </div>
          )}

          {/* ... sección movida al final ... */}

          {canView(me, 'adquisicion') && (
          <div className="w-full bg-neutral-900/60 backdrop-blur rounded-xl border border-neutral-800 shadow-[0_0_30px_rgba(0,0,0,0.3)] mb-8 p-6">
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                  <h3 className="text-2xl font-bold text-white font-sans tracking-wide">Resumen por Métodos de Adquisición</h3>
                  <p className="text-neutral-300/80 text-sm mt-1">Métricas de rendimiento por fuente de tráfico</p>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setAdquisicionOpen((v) => !v)}
                    className="bg-neutral-900 border-neutral-800 text-white hover:bg-neutral-800 hover:text-white"
                  >
                    {adquisicionOpen ? "Ocultar" : "Mostrar"}
                  </Button>
                </div>
              </div>
              {adquisicionOpen && (
                <div className="mt-4">
                  <Input
                    placeholder="Buscar creativo..."
                    className="bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm placeholder:text-white"
                    value={creativoFilter}
                    onChange={(ev) => setCreativoFilter(ev.target.value)}
                  />
                </div>
              )}
            </div>
            
            {adquisicionOpen && (
            <div className="overflow-x-auto">
              <div className="min-w-full hidden md:block">
                {/* Header */}
                <div className="grid grid-cols-15 gap-3 pb-4 mb-4 border-b border-neutral-600/20">
                  <div className="text-neutral-300 font-semibold text-sm uppercase tracking-wider whitespace-normal break-words leading-tight max-w-[220px]">Creativo</div>
                  <div className="text-neutral-300 font-semibold text-sm uppercase tracking-wider whitespace-normal break-words leading-tight max-w-[120px]">Spend</div>
                  <div className="text-neutral-300 font-semibold text-sm uppercase tracking-wider whitespace-normal break-words leading-tight max-w-[110px]">Agendas</div>
                  <div className="text-neutral-300 font-semibold text-sm uppercase tracking-wider whitespace-normal break-words leading-tight max-w-[110px]">Tomadas</div>
                  <div className="text-neutral-300 font-semibold text-sm uppercase tracking-wider whitespace-normal break-words leading-tight max-w-[120px]">Calificadas</div>
                  <div className="text-neutral-300 font-semibold text-sm uppercase tracking-wider whitespace-normal break-words leading-tight max-w-[120px]">Show Rate</div>
                  <div className="text-neutral-300 font-semibold text-sm uppercase tracking-wider whitespace-normal break-words leading-tight max-w-[110px]">Cierres</div>
                  <div className="text-neutral-300 font-semibold text-sm uppercase tracking-wider whitespace-normal break-words leading-tight max-w-[120px]">Close Rate</div>
                  <div className="text-neutral-300 font-semibold text-sm uppercase tracking-wider whitespace-normal break-words leading-tight max-w-[140px]">Cash Collected</div>
                  <div className="text-neutral-300 font-semibold text-sm uppercase tracking-wider whitespace-normal break-words leading-tight max-w-[150px]">Ticket Promedio</div>
                  <div className="text-neutral-300 font-semibold text-sm uppercase tracking-wider whitespace-normal break-words leading-tight max-w-[140px]">Costo/Show</div>
                  <div className="text-neutral-300 font-semibold text-sm uppercase tracking-wider whitespace-normal break-words leading-tight max-w-[140px]">Costo/Agenda</div>
                  <div className="text-neutral-300 font-semibold text-sm uppercase tracking-wider whitespace-normal break-words leading-tight max-w-[100px]">CAC</div>
                  <div className="text-neutral-300 font-semibold text-sm uppercase tracking-wider whitespace-normal break-words leading-tight max-w-[100px]">ROAS</div>
                  <div className="text-neutral-300 font-semibold text-sm uppercase tracking-wider whitespace-normal break-words leading-tight max-w-[120px]">Pendientes</div>
                </div>

                {/* Rows: Direct creatives */}
                {(() => {
                  const filtered = (data?.adsByOrigin ?? [])
                    .filter((row) => {
                      const q = creativoFilter.toLowerCase().trim();
                      if (!q) return true;
                      return (row.anuncio_origen ?? "").toLowerCase().includes(q);
                    })
                    .sort((a, b) => {
                      const cashA = a.cash_collected || 0;
                      const cashB = b.cash_collected || 0;
                      if (cashA !== cashB) return cashB - cashA;
                      const agendasA = a.agendas || 0;
                      const agendasB = b.agendas || 0;
                      if (agendasA !== agendasB) return agendasB - agendasA;
                      const spendA = a.spend_allocated || 0;
                      const spendB = b.spend_allocated || 0;
                      if (spendA !== spendB) return spendB - spendA;
                      return (a.anuncio_origen || '').localeCompare(b.anuncio_origen || '');
                    });

                  const totalCreativos = filtered.length;
                  const sumSpend = filtered.reduce((s, r) => s + (r.spend_allocated || 0), 0);
                  const sumAgendas = filtered.reduce((s, r) => s + (r.agendas || 0), 0);
                  const sumTomadas = filtered.reduce((s, r) => s + (r.tomadas || 0), 0);
                  const sumCalif = filtered.reduce((s, r) => s + (r.calificadas || 0), 0);
                  const sumCierres = filtered.reduce((s, r) => s + (r.cierres || 0), 0);
                  const sumCash = filtered.reduce((s, r) => s + Number(r.cash_collected || 0), 0);
                  const sumFact = filtered.reduce((s, r) => s + (r.facturacion || 0), 0);
                  const sumPend = filtered.reduce((s, r) => s + (r.llamadas_pendientes || 0), 0);

                  const totalShowRate = sumAgendas > 0 ? (sumTomadas / sumAgendas) * 100 : 0;
                  const totalCloseRate = sumAgendas > 0 ? (sumCierres / sumAgendas) * 100 : 0;

                  // Promedio simple de % por creativo (solo filas con dato válido)
                  const showRateValues = filtered.map(r => {
                    if (r.show_rate_pct !== undefined && r.show_rate_pct !== null) return Number(r.show_rate_pct);
                    const ag = r.agendas || 0;
                    const tm = r.tomadas || 0;
                    return ag > 0 ? (tm / ag) * 100 : null;
                  }).filter((v): v is number => v !== null && !Number.isNaN(v));
                  const closeRateValues = filtered.map(r => {
                    if (r.close_rate_pct !== undefined && r.close_rate_pct !== null) return Number(r.close_rate_pct);
                    const ag = r.agendas || 0;
                    const ci = r.cierres || 0;
                    return ag > 0 ? (ci / ag) * 100 : null;
                  }).filter((v): v is number => v !== null && !Number.isNaN(v));
                  const avgShowRate = showRateValues.length > 0 ? (showRateValues.reduce((s, v) => s + v, 0) / showRateValues.length) : 0;
                  const avgCloseRate = closeRateValues.length > 0 ? (closeRateValues.reduce((s, v) => s + v, 0) / closeRateValues.length) : 0;
                  const totalTicket = sumCierres > 0 ? sumCash / sumCierres : 0;
                  const totalCpShow = sumTomadas > 0 ? sumSpend / sumTomadas : 0;
                  const totalCpAgenda = sumAgendas > 0 ? sumSpend / sumAgendas : 0;
                  const totalCAC = sumCierres > 0 ? sumSpend / sumCierres : 0;
                  const totalROAS = sumSpend > 0 ? (sumFact / sumSpend) : 0;

                  return (
                    <>
                      {filtered.map((row, index) => {
                        const spend = row.spend_allocated || 0;
                        const tomadas = row.tomadas || 0;
                        const calificadas = row.calificadas || 0;
                        const cierres = row.cierres || 0;
                        const agendas = row.agendas || 0;
                        const fact = row.facturacion || 0;
                        const showRate = row.show_rate_pct !== undefined ? row.show_rate_pct.toFixed(1) + "%" : "—";
                        const roas = spend ? (fact / spend).toFixed(2) + "x" : "—";
                        const cpo = agendas ? currency(spend / agendas) : "$0";
                        const cpshow = tomadas ? currency(spend / tomadas) : "$0";
                        const cac = cierres ? currency(spend / cierres) : "$0";
                        const cash = row.cash_collected ? Number(row.cash_collected) : 0;
                        const ticket = cierres ? currency(cash / cierres) : "$0";
                        const closeRate = row.close_rate_pct !== undefined ? row.close_rate_pct.toFixed(1) + "%" : "—";
                        const pendientes = row.llamadas_pendientes || 0;

                        return (
                          <div key={row.anuncio_origen} className={`grid grid-cols-15 gap-3 py-3 px-2 rounded-lg ${index % 2 === 0 ? 'bg-neutral-800/10' : 'bg-transparent'} hover:bg-neutral-700/20 transition-colors`}>
                            <div className="text-white text-sm whitespace-normal break-words leading-tight max-w-[220px]">{row.anuncio_origen}</div>
                            <div className="text-gray-300 text-sm leading-tight max-w-[120px]">{currency(spend)}</div>
                            <div className="text-cyan-300 text-sm leading-tight max-w-[110px]">{agendas}</div>
                            <div className="text-blue-300 text-sm leading-tight max-w-[110px]">{tomadas}</div>
                            <div className="text-purple-300 text-sm leading-tight max-w-[120px]">{calificadas}</div>
                            <div className="text-cyan-300 text-sm leading-tight max-w-[120px]">{showRate}</div>
                            <div className="text-emerald-400 text-sm leading-tight max-w-[110px]">{cierres}</div>
                            <div className="text-emerald-400 text-sm leading-tight max-w-[120px]">{closeRate}</div>
                            <div className="text-emerald-400 text-sm leading-tight max-w-[140px]">{currency(cash)}</div>
                            <div className="text-emerald-400 text-sm leading-tight max-w-[150px]">{ticket}</div>
                            <div className="text-gray-300 text-sm leading-tight max-w-[140px]">{cpshow}</div>
                            <div className="text-gray-300 text-sm leading-tight max-w-[140px]">{cpo}</div>
                            <div className="text-gray-300 text-sm leading-tight max-w-[100px]">{cac}</div>
                            <div className="text-emerald-400 text-sm leading-tight max-w-[100px]">{roas}</div>
                            <div className="text-yellow-300 text-sm leading-tight max-w-[120px]">{pendientes}</div>
                          </div>
                        );
                      })}

                      {/* Totales */}
                      <div className="grid grid-cols-15 gap-3 py-3 px-2 mt-4 rounded-lg border-t border-neutral-600/30 bg-neutral-800/20">
                        <div className="text-white text-sm font-semibold whitespace-normal break-words leading-tight max-w-[220px]">
                          Totales ({totalCreativos.toLocaleString()} creativos)
                        </div>
                        <div className="text-gray-100 text-sm font-semibold leading-tight max-w-[120px]">{currency(sumSpend)}</div>
                        <div className="text-cyan-200 text-sm font-semibold leading-tight max-w-[110px]">{sumAgendas.toLocaleString()}</div>
                        <div className="text-blue-200 text-sm font-semibold leading-tight max-w-[110px]">{sumTomadas.toLocaleString()}</div>
                        <div className="text-purple-200 text-sm font-semibold leading-tight max-w-[120px]">{sumCalif.toLocaleString()}</div>
                        <div className="text-cyan-200 text-sm font-semibold leading-tight max-w-[120px]">
                          {totalShowRate.toFixed(1)}% <span className="text-neutral-400">(avg {avgShowRate.toFixed(1)}%)</span>
                        </div>
                        <div className="text-emerald-200 text-sm font-semibold leading-tight max-w-[110px]">{sumCierres.toLocaleString()}</div>
                        <div className="text-emerald-200 text-sm font-semibold leading-tight max-w-[120px]">
                          {totalCloseRate.toFixed(1)}% <span className="text-neutral-400">(avg {avgCloseRate.toFixed(1)}%)</span>
                        </div>
                        <div className="text-emerald-200 text-sm font-semibold leading-tight max-w-[140px]">{currency(sumCash)}</div>
                        <div className="text-emerald-200 text-sm font-semibold leading-tight max-w-[150px]">{currency(totalTicket)}</div>
                        <div className="text-gray-100 text-sm font-semibold leading-tight max-w-[140px]">{currency(totalCpShow)}</div>
                        <div className="text-gray-100 text-sm font-semibold leading-tight max-w-[140px]">{currency(totalCpAgenda)}</div>
                        <div className="text-gray-100 text-sm font-semibold leading-tight max-w-[100px]">{currency(totalCAC)}</div>
                        <div className="text-emerald-200 text-sm font-semibold leading-tight max-w-[100px]">{sumSpend > 0 ? `${totalROAS.toFixed(2)}x` : "—"}</div>
                        <div className="text-yellow-200 text-sm font-semibold leading-tight max-w-[120px]">{sumPend.toLocaleString()}</div>
                      </div>
                    </>
                  );
                })()}
              </div>
              {/* Layout compacto para pantallas pequeñas */}
              <div className="md:hidden">
                {(() => {
                  const filtered = (data?.adsByOrigin ?? [])
                    .filter((row) => {
                      const q = creativoFilter.toLowerCase().trim();
                      if (!q) return true;
                      return (row.anuncio_origen ?? "").toLowerCase().includes(q);
                    })
                    .sort((a, b) => {
                      const cashA = a.cash_collected || 0;
                      const cashB = b.cash_collected || 0;
                      if (cashA !== cashB) return cashB - cashA;
                      const agendasA = a.agendas || 0;
                      const agendasB = b.agendas || 0;
                      if (agendasA !== agendasB) return agendasB - agendasA;
                      const spendA = a.spend_allocated || 0;
                      const spendB = b.spend_allocated || 0;
                      if (spendA !== spendB) return spendB - spendA;
                      return (a.anuncio_origen || '').localeCompare(b.anuncio_origen || '');
                    });

                  const totalCreativos = filtered.length;
                  const sumSpend = filtered.reduce((s, r) => s + (r.spend_allocated || 0), 0);
                  const sumAgendas = filtered.reduce((s, r) => s + (r.agendas || 0), 0);
                  const sumTomadas = filtered.reduce((s, r) => s + (r.tomadas || 0), 0);
                  const sumCalif = filtered.reduce((s, r) => s + (r.calificadas || 0), 0);
                  const sumCierres = filtered.reduce((s, r) => s + (r.cierres || 0), 0);
                  const sumCash = filtered.reduce((s, r) => s + Number(r.cash_collected || 0), 0);
                  const sumFact = filtered.reduce((s, r) => s + (r.facturacion || 0), 0);
                  const sumPend = filtered.reduce((s, r) => s + (r.llamadas_pendientes || 0), 0);

                  const totalShowRate = sumAgendas > 0 ? (sumTomadas / sumAgendas) * 100 : 0;
                  const totalCloseRate = sumAgendas > 0 ? (sumCierres / sumAgendas) * 100 : 0;

                  const showRateValues = filtered.map(r => {
                    if (r.show_rate_pct !== undefined && r.show_rate_pct !== null) return Number(r.show_rate_pct);
                    const ag = r.agendas || 0;
                    const tm = r.tomadas || 0;
                    return ag > 0 ? (tm / ag) * 100 : null;
                  }).filter((v): v is number => v !== null && !Number.isNaN(v));
                  const closeRateValues = filtered.map(r => {
                    if (r.close_rate_pct !== undefined && r.close_rate_pct !== null) return Number(r.close_rate_pct);
                    const ag = r.agendas || 0;
                    const ci = r.cierres || 0;
                    return ag > 0 ? (ci / ag) * 100 : null;
                  }).filter((v): v is number => v !== null && !Number.isNaN(v));
                  const avgShowRate = showRateValues.length > 0 ? (showRateValues.reduce((s, v) => s + v, 0) / showRateValues.length) : 0;
                  const avgCloseRate = closeRateValues.length > 0 ? (closeRateValues.reduce((s, v) => s + v, 0) / closeRateValues.length) : 0;

                  return (
                    <>
                      {filtered.map((row) => {
                        const spend = row.spend_allocated || 0;
                        const tomadas = row.tomadas || 0;
                        const calificadas = row.calificadas || 0;
                        const cierres = row.cierres || 0;
                        const agendas = row.agendas || 0;
                        const fact = row.facturacion || 0;
                        const showRate = row.show_rate_pct !== undefined ? row.show_rate_pct.toFixed(1) + "%" : (agendas > 0 ? ((tomadas / agendas) * 100).toFixed(1) + "%" : "—");
                        const roas = spend ? (fact / spend).toFixed(2) + "x" : "—";
                        const cpo = agendas ? currency(spend / agendas) : "$0";
                        const cpshow = tomadas ? currency(spend / tomadas) : "$0";
                        const cac = cierres ? currency(spend / cierres) : "$0";
                        const cash = row.cash_collected ? Number(row.cash_collected) : 0;
                        const ticket = cierres ? currency(cash / cierres) : "$0";
                        const closeRate = row.close_rate_pct !== undefined ? row.close_rate_pct.toFixed(1) + "%" : (agendas > 0 ? ((cierres / agendas) * 100).toFixed(1) + "%" : "—");
                        const pendientes = row.llamadas_pendientes || 0;

                        return (
                          <div key={row.anuncio_origen} className="bg-neutral-800/30 rounded-lg p-3 mb-3">
                            <div className="text-white font-medium text-sm whitespace-normal break-words leading-tight mb-2">
                              {row.anuncio_origen}
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              <div className="text-neutral-400">Spend</div><div className="text-gray-200">{currency(spend)}</div>
                              <div className="text-neutral-400">Agendas</div><div className="text-cyan-200">{agendas}</div>
                              <div className="text-neutral-400">Tomadas</div><div className="text-blue-200">{tomadas}</div>
                              <div className="text-neutral-400">Calificadas</div><div className="text-purple-200">{calificadas}</div>
                              <div className="text-neutral-400">Show Rate</div><div className="text-cyan-200">{showRate}</div>
                              <div className="text-neutral-400">Cierres</div><div className="text-emerald-200">{cierres}</div>
                              <div className="text-neutral-400">Close Rate</div><div className="text-emerald-200">{closeRate}</div>
                              <div className="text-neutral-400">Cash</div><div className="text-emerald-200">{currency(cash)}</div>
                              <div className="text-neutral-400">Ticket</div><div className="text-emerald-200">{ticket}</div>
                              <div className="text-neutral-400">Costo/Show</div><div className="text-gray-200">{cpshow}</div>
                              <div className="text-neutral-400">Costo/Agenda</div><div className="text-gray-200">{cpo}</div>
                              <div className="text-neutral-400">CAC</div><div className="text-gray-200">{cac}</div>
                              <div className="text-neutral-400">ROAS</div><div className="text-emerald-200">{roas}</div>
                              <div className="text-neutral-400">Pendientes</div><div className="text-yellow-200">{pendientes}</div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Totales (compacto) */}
                      <div className="bg-neutral-800/40 rounded-lg p-3 mt-4 border border-neutral-700/40">
                        <div className="text-white font-semibold text-sm whitespace-normal break-words leading-tight mb-2">
                          Totales ({totalCreativos.toLocaleString()} creativos)
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <div className="text-neutral-400">Spend</div><div className="text-gray-100 font-semibold">{currency(sumSpend)}</div>
                          <div className="text-neutral-400">Agendas</div><div className="text-cyan-200 font-semibold">{sumAgendas.toLocaleString()}</div>
                          <div className="text-neutral-400">Tomadas</div><div className="text-blue-200 font-semibold">{sumTomadas.toLocaleString()}</div>
                          <div className="text-neutral-400">Calificadas</div><div className="text-purple-200 font-semibold">{sumCalif.toLocaleString()}</div>
                          <div className="text-neutral-400">Show Rate</div>
                          <div className="text-cyan-200 font-semibold">{totalShowRate.toFixed(1)}% <span className="text-neutral-400">(avg {avgShowRate.toFixed(1)}%)</span></div>
                          <div className="text-neutral-400">Cierres</div><div className="text-emerald-200 font-semibold">{sumCierres.toLocaleString()}</div>
                          <div className="text-neutral-400">Close Rate</div>
                          <div className="text-emerald-200 font-semibold">{totalCloseRate.toFixed(1)}% <span className="text-neutral-400">(avg {avgCloseRate.toFixed(1)}%)</span></div>
                          <div className="text-neutral-400">Cash</div><div className="text-emerald-200 font-semibold">{currency(sumCash)}</div>
                          <div className="text-neutral-400">Ticket</div><div className="text-emerald-200 font-semibold">{currency(sumCierres > 0 ? sumCash / sumCierres : 0)}</div>
                          <div className="text-neutral-400">Costo/Show</div><div className="text-gray-100 font-semibold">{currency(sumTomadas > 0 ? sumSpend / sumTomadas : 0)}</div>
                          <div className="text-neutral-400">Costo/Agenda</div><div className="text-gray-100 font-semibold">{currency(sumAgendas > 0 ? sumSpend / sumAgendas : 0)}</div>
                          <div className="text-neutral-400">CAC</div><div className="text-gray-100 font-semibold">{currency(sumCierres > 0 ? sumSpend / sumCierres : 0)}</div>
                          <div className="text-neutral-400">ROAS</div><div className="text-emerald-200 font-semibold">{sumSpend > 0 ? `${(sumFact / sumSpend).toFixed(2)}x` : "—"}</div>
                          <div className="text-neutral-400">Pendientes</div><div className="text-yellow-200 font-semibold">{sumPend.toLocaleString()}</div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
            )}
          </div>
          )}

          {canView(me, 'leaderboard') && (
          <Card className="bg-neutral-900/60 backdrop-blur border border-neutral-800 mb-8 transition-all duration-300 hover:shadow-[0_0_0_1px_rgba(56,189,248,0.25),0_20px_60px_-15px_rgba(56,189,248,0.35)]">
            <CardHeader>
              <CardTitle className="text-white">Leaderboard de Closers</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {closers.map((c) => {
                  const calls = (events || []).filter((e) => e.closer === c.closer);
                  return (
                    <AccordionItem key={c.closer} value={c.closer}>
                      <AccordionTrigger className="hover:bg-neutral-800/40 rounded-lg transition-all duration-300">
                        <div className="flex w-full items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="size-2 rounded-full bg-emerald-400 shadow-[0_0_12px_2px_rgba(16,185,129,0.7)]" />
                            <span className="font-medium">{c.closer}</span>
                          </div>
                          <div className="text-sm text-neutral-300 flex items-center gap-4">
                            <span>{c.llamadas_tomadas} llamadas</span>
                            <span>{c.cierres} cierres</span>
                            <span>{c.tasa_cierre.toFixed(1)}%</span>
                            <span>{currency(c.facturacion_generada || 0)}</span>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="mb-3 flex flex-col sm:flex-row gap-2">
                          <input
                            placeholder="Buscar lead..."
                            className="w-full sm:flex-1 bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm placeholder:text-white"
                            value={closerFilter[c.closer] ?? ''}
                            onChange={(ev) => setCloserFilter((prev) => ({ ...prev, [c.closer]: ev.target.value }))}
                          />
                          <select
                            className="w-full sm:w-56 bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm text-white"
                            value={closerStatusFilter[c.closer] ?? 'all'}
                            onChange={(ev) => setCloserStatusFilter((prev) => ({ ...prev, [c.closer]: ev.target.value }))}
                          >
                            <option value="all">Todas</option>
                            <option value="asistidas">Asistidas</option>
                            <option value="no_show">No Show</option>
                            <option value="cerrada">Cerrada</option>
                            <option value="ofertada">Ofertada</option>
                            <option value="no_ofertada">No_Ofertada</option>
                          </select>
                        </div>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Lead</TableHead>
                                <TableHead>Asistió</TableHead>
                                <TableHead>Ofertado</TableHead>
                                <TableHead>Cerrado</TableHead>
                                <TableHead>Cash</TableHead>
                                <TableHead>Facturación</TableHead>
                                <TableHead>Notas</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {calls.filter((e) => {
                                const q = (closerFilter[c.closer] ?? '').toLowerCase().trim();
                                const status = (closerStatusFilter[c.closer] ?? 'all');
                                const byText = !q || (e.cliente ?? '').toLowerCase().includes(q);
                                if (!byText) return false;
                                const normalizedCat = (e.categoria ?? '')
                                  .toString()
                                  .toLowerCase()
                                  .replace(/[\s]+/g, '_')
                                  .trim();
                                const esNoShow = e.tipo_registro === 'no_show';
                                if (status === 'all') return true;
                                if (status === 'no_show') return esNoShow;
                                if (status === 'asistidas') return !esNoShow;
                                // categorías específicas (solo aplican a asistidas)
                                if (status === 'cerrada') return !esNoShow && normalizedCat === 'cerrada';
                                if (status === 'ofertada') return !esNoShow && normalizedCat === 'ofertada';
                                if (status === 'no_ofertada') return !esNoShow && normalizedCat === 'no_ofertada';
                                return true;
                              }).map((e) => {
                                const esNoShow = e.tipo_registro === 'no_show';
                                return (
                                <TableRow key={e.id_evento}>
                                  <TableCell className="text-white">{new Date(e.fecha_hora_evento).toLocaleString()}</TableCell>
                                  <TableCell className="text-white">{e.cliente ?? "—"}</TableCell>
                                  <TableCell className="text-white">{(() => { 
                                    // No Show muestra "No", demás muestran "Sí"
                                    if (esNoShow) {
                                      return <span className="inline-flex items-center">
                                        <span className="w-6 h-6 rounded-full inline-flex items-center justify-center text-[10px] font-semibold border bg-red-500/20 text-red-300 border-red-400/40">
                                          No
                                        </span>
                                      </span>;
                                    }
                                    return <span className="inline-flex items-center">
                                      <span className="w-6 h-6 rounded-full inline-flex items-center justify-center text-[10px] font-semibold border bg-emerald-500/20 text-emerald-300 border-emerald-400/40">
                                        Sí
                                      </span>
                                    </span>; 
                                  })()}</TableCell>
                                  <TableCell className="text-white">{(() => { 
                                    if (esNoShow) {
                                      return <span className="inline-flex items-center">
                                        <span className="w-6 h-6 rounded-full inline-flex items-center justify-center text-[10px] font-semibold border bg-red-500/20 text-red-300 border-red-400/40">
                                          No
                                        </span>
                                      </span>;
                                    }
                                    const normalized = (e.categoria ?? '')
                                      .toString()
                                      .toLowerCase()
                                      .replace(/[_\s]+/g, ' ')
                                      .trim();
                                    const cerrado = normalized === 'cerrada' || (e.facturacion ?? 0) > 0;
                                    const ofertado = normalized === 'ofertada' || cerrado;
                                    return <span className="inline-flex items-center">
                                      <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-[10px] font-semibold border ${ofertado ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40" : "bg-red-500/20 text-red-300 border-red-400/40"}`}>
                                        {ofertado ? "Sí" : "No"}
                                      </span>
                                    </span>; 
                                  })()}</TableCell>
                                  <TableCell className="text-white">{(() => { 
                                    if (esNoShow) {
                                      return <span className="inline-flex items-center">
                                        <span className="w-6 h-6 rounded-full inline-flex items-center justify-center text-[10px] font-semibold border bg-red-500/20 text-red-300 border-red-400/40">
                                          No
                                        </span>
                                      </span>;
                                    }
                                    const normalized = (e.categoria ?? '')
                                      .toString()
                                      .toLowerCase()
                                      .replace(/[_\s]+/g, ' ')
                                      .trim();
                                    const cerrado = normalized === 'cerrada' || (e.facturacion ?? 0) > 0;
                                    return <span className="inline-flex items-center">
                                      <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-[10px] font-semibold border ${cerrado ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40" : "bg-red-500/20 text-red-300 border-red-400/40"}`}>
                                        {cerrado ? "Sí" : "No"}
                                      </span>
                                    </span>; 
                                  })()}</TableCell>
                                  <TableCell className="text-white">{currency(e.cash_collected ?? 0)}</TableCell>
                                  <TableCell className="text-white">{currency(e.facturacion ?? 0)}</TableCell>
                                  <TableCell className="text-white space-x-2">
                                    {!esNoShow && (
                                      <>
                                        <Dialog>
                                          <DialogTrigger asChild>
                                            <Button variant="outline" className="bg-neutral-900 border-neutral-800 text-neutral-200 hover:border-cyan-400/40 hover:text-cyan-300">Ver notas</Button>
                                          </DialogTrigger>
                                          <DialogContent className="sm:max-w-[800px] max-h-[90vh] bg-neutral-950 border-neutral-800 text-neutral-100 mx-4">
                                            <DialogHeader>
                                              <DialogTitle className="flex items-center justify-between">
                                                <span>Detalle de la llamada</span>
                                                {e.link_llamada && (
                                                  <Button
                                                    variant="outline"
                                                    className="bg-cyan-500/10 border-cyan-400/40 text-cyan-300 hover:bg-cyan-500/20"
                                                    onClick={() => window.open(e.link_llamada || '', '_blank')}
                                                  >
                                                    🔗 Ver grabación
                                                  </Button>
                                                )}
                                              </DialogTitle>
                                            </DialogHeader>
                                            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                <div className="text-sm"><span className="text-neutral-400">Lead:</span> {e.cliente ?? '—'}</div>
                                                <div className="text-sm"><span className="text-neutral-400">Closer:</span> {e.closer}</div>
                                                <div className="text-sm"><span className="text-neutral-400">Fecha:</span> {new Date(e.fecha_hora_evento).toLocaleString()}</div>
                                              </div>
                                              <div>
                                                <div className="text-sm mb-2"><span className="text-neutral-400">Resumen:</span></div>
                                                <div className="text-neutral-200 whitespace-pre-wrap max-h-[50vh] overflow-auto rounded-md border border-neutral-800 p-3">{e.resumen_ia ?? 'Sin resumen'}</div>
                                              </div>
                                            </div>
                                          </DialogContent>
                                        </Dialog>
                                        <Dialog>
                                          <DialogTrigger asChild>
                                            <Button variant="outline" className="bg-neutral-900 border-neutral-800 text-neutral-200 hover:border-emerald-400/40 hover:text-emerald-300">Configurar</Button>
                                          </DialogTrigger>
                                          <DialogContent className="sm:max-w-[560px] bg-neutral-950 border-neutral-800 text-neutral-100 mx-4">
                                            <DialogHeader>
                                              <DialogTitle>Configurar llamada</DialogTitle>
                                            </DialogHeader>
                                            <form
                                              className="space-y-4"
                                              onSubmit={async (ev) => {
                                                ev.preventDefault();
                                                const form = ev.currentTarget as HTMLFormElement;
                                                const formData = new FormData(form);
                                                const payload = {
                                                  categoria: String(formData.get('categoria') || '').toLowerCase(),
                                                  cash_collected: formData.get('cash_collected') ? Number(formData.get('cash_collected')) : null,
                                                  facturacion: formData.get('facturacion') ? Number(formData.get('facturacion')) : null,
                                                };
                                                await fetch(`/api/eventos/${e.id_evento}`, {
                                                  method: 'PATCH',
                                                  headers: { 'Content-Type': 'application/json' },
                                                  body: JSON.stringify(payload),
                                                });
                                                queryClient.invalidateQueries({ queryKey: ["dashboard"] });
                                                (document.activeElement as HTMLElement)?.click();
                                              }}
                                            >
                                              <div>
                                                <label className="text-sm text-neutral-300">Categoría</label>
                                                <select
                                                  name="categoria"
                                                  defaultValue={(e.categoria ?? '').toLowerCase() || 'no ofertada'}
                                                  className="w-full mt-1 bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm"
                                                >
                                                  <option value="no ofertada">No ofertada</option>
                                                  <option value="ofertada">Ofertada</option>
                                                  <option value="cerrada">Cerrada</option>
                                                </select>
                                              </div>
                                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                  <label className="text-sm text-neutral-300">Cash collected</label>
                                                  <Input name="cash_collected" type="number" step="0.01" defaultValue={e.cash_collected ?? 0} className="mt-1" />
                                                </div>
                                                <div>
                                                  <label className="text-sm text-neutral-300">Facturación</label>
                                                  <Input name="facturacion" type="number" step="0.01" defaultValue={e.facturacion ?? 0} className="mt-1" />
                                                </div>
                                              </div>
                                              <div className="flex justify-end gap-2 pt-2">
                                                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500">Guardar</Button>
                                              </div>
                                            </form>
                                          </DialogContent>
                                        </Dialog>
                                      </>
                                    )}
                                    {esNoShow && (
                                      <Dialog>
                                        <DialogTrigger asChild>
                                          <Button variant="outline" className="bg-neutral-900 border-neutral-800 text-neutral-200 hover:border-emerald-400/40 hover:text-emerald-300">Revivir</Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-[820px] bg-neutral-950 border-neutral-800 text-neutral-100 mx-4">
                                          <DialogHeader>
                                            <DialogTitle>Revivir no show</DialogTitle>
                                          </DialogHeader>
                                          <RevivirForm
                                            evento={e}
                                            clientId={clientId}
                                            timezone={timezone}
                                            onDone={async () => {
                                              queryClient.invalidateQueries({ queryKey: ["dashboard"] });
                                              (document.activeElement as HTMLElement | null)?.click();
                                            }}
                                          />
                                        </DialogContent>
                                      </Dialog>
                                    )}
                                    {!esNoShow && (
                                      <Dialog>
                                        <DialogTrigger asChild>
                                          <Button variant="outline" className="bg-neutral-900 border-neutral-800 text-neutral-200 hover:border-red-400/40 hover:text-red-300">Borrar llamada</Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-[520px] bg-neutral-950 border-neutral-800 text-neutral-100 mx-4">
                                          <DialogHeader>
                                            <DialogTitle>Confirmar eliminación</DialogTitle>
                                          </DialogHeader>
                                          <div className="space-y-4">
                                            <p className="text-sm text-neutral-300">
                                              ¿Estás seguro que quieres eliminar la llamada con nombre de lead: <span className="font-semibold">{e.cliente ?? "—"}</span>?
                                            </p>
                                            <div className="flex justify-end gap-2">
                                              <Button
                                                className="bg-red-600 hover:bg-red-500"
                                                onClick={async () => {
                                                  const resp = await fetch(`/api/eventos/${e.id_evento}?id_cuenta=${clientId}`, { method: "DELETE" });
                                                  if (!resp.ok && resp.status !== 204) {
                                                    const j = await resp.json().catch(() => ({}));
                                                    alert(`No se pudo eliminar: ${j?.error || resp.statusText}`);
                                                    return;
                                                  }
                                                  queryClient.invalidateQueries({ queryKey: ["dashboard"] });
                                                  (document.activeElement as HTMLElement | null)?.click();
                                                }}
                                              >
                                                Confirmar
                                              </Button>
                                            </div>
                                          </div>
                                        </DialogContent>
                                      </Dialog>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>
          )}

          {/* Llamadas pendientes (al final) */}
          <Card className="bg-gradient-to-br from-[#0b0b12] to-[#0a0a0e] border border-[#2a2a3a] mb-8 overflow-hidden">
            <CardHeader className="bg-[linear-gradient(90deg,#111827,transparent)] border-b border-[#2a2a3a]">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_12px_2px_rgba(250,204,21,0.6)]" />
                  Llamadas pendientes
                </CardTitle>
                <span className="text-xs text-neutral-400">{(dataset?.pendientes?.length ?? 0).toLocaleString()} pendientes</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <div className="min-w-[720px]">
                  <div className="grid grid-cols-4 gap-3 p-4 text-xs uppercase tracking-wider text-neutral-300 bg-neutral-900/60">
                    <div>Lead</div>
                    <div>Email</div>
                    <div>Closer</div>
                    <div className="text-right pr-2">Estado</div>
                  </div>
                  {(dataset?.pendientes ?? []).map((p, idx) => (
                    <div
                      key={p.id_registro_agenda}
                      className={`grid grid-cols-4 gap-3 items-center px-4 py-3 border-t border-neutral-800 ${idx % 2 === 0 ? "bg-neutral-900/30" : "bg-transparent"}`}
                    >
                      <div className="text-white text-sm font-medium">{p.nombre_de_lead}</div>
                      <div className="text-neutral-300 text-sm truncate">{p.email_lead}</div>
                      <div className="text-neutral-300 text-sm">{p.closer}</div>
                      <div className="flex justify-end pr-2">
                        <span className="px-2 py-1 rounded-full text-[10px] font-semibold border bg-yellow-500/15 text-yellow-300 border-yellow-400/40">
                          Pendiente
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
