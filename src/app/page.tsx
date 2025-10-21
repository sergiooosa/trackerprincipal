"use client";
import { useMemo, useState } from "react";
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
// Importación dinámica para evitar problemas SSR/hidratación
let XLSX: (typeof import("xlsx")) | undefined;
//
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type ApiResponse = {
  kpis: {
    total_facturacion: number;
    total_gasto_ads: number;
    total_llamadas_tomadas: number;
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
    llamadas_canceladas: number;
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
    categoria?: string | null;
    cash_collected?: number | null;
    facturacion: number;
    anuncio_origen: string | null;
    resumen_ia: string | null;
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
    padre_campana?: string;
    agendas: number;
    cierres: number;
    facturacion: number;
    cash_collected: number;
    spend_allocated: number;
    shows?: number;
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

  const { data, isLoading, isError, isFetching, error } = useQuery<ApiResponse>({
    queryKey: ["dashboard", "id:2", "tz:America/Bogota", startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        fecha_inicio: formatISO(startOfDay(startDate)),
        fecha_fin: formatISO(endOfDay(endDate)),
        id_cuenta: "2",
        tz: "America/Bogota",
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
  const series = dataset?.series ?? [];
  const closers = useMemo(() => (dataset?.closers ?? []).map((c) => ({
    ...c,
    // Close rate: llamadas calificadas / llamadas cerradas (corregido)
    tasa_cierre: c.llamadas_tomadas && c.cierres ? (c.cierres / c.llamadas_tomadas) * 100 : 0,
    // Show rate: shows / reuniones calificadas
    tasa_show: c.reuniones_calificadas && c.shows ? (c.shows / c.reuniones_calificadas) * 100 : 0,
  })), [dataset]);
  const events = dataset?.events ?? [];

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 px-6 sm:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">AutoKpi - Traking Automático</h1>
        <div className="flex items-center gap-3">
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
          <Button
            onClick={() => {
              if (!dataset) return;
              const doExport = async () => {
                if (!XLSX) {
                  // Intentar ESM primero para navegadores modernos (usado por Vercel/Next en client)
                  let mod: typeof import("xlsx");
                  try {
                    mod = (await import("xlsx/xlsx.mjs")) as unknown as typeof import("xlsx");
                  } catch {
                    mod = (await import("xlsx")) as typeof import("xlsx");
                  }
                  XLSX = mod;
                }
                const xlsx = XLSX as NonNullable<typeof XLSX>;
                const wb = xlsx.utils.book_new();

                const safeAppend = (name: string, rows: Array<Record<string, unknown>>) => {
                  try {
                    const ws = xlsx.utils.json_to_sheet(rows);
                    xlsx.utils.book_append_sheet(wb, ws, name.slice(0, 31));
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
                safeAppend("Eventos", dataset.events || []);
                safeAppend("Ads_por_Origen", dataset.adsByOrigin || []);
                safeAppend("Pendientes_PDTE", dataset.pendientes || []);

                const fileName = `dashboard_export_${format(startDate, "yyyyMMdd")}_${format(endDate, "yyyyMMdd")}_id3.xlsx`;
                xlsx.writeFile(wb, fileName);
              };
              void doExport();
            }}
            className="bg-neutral-900 border border-neutral-800 text-neutral-200 hover:border-cyan-400/40 hover:text-cyan-300"
            variant="outline"
          >
            📊 Exportar a Excel
          </Button>
        </div>
      </div>

      {isLoading || isFetching ? (
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
            <Card className="bg-gradient-to-br from-[#160e1f] to-[#0e0b19] border border-[#3a214b] shadow-[0_0_0_1px_rgba(168,85,247,0.15),0_10px_40px_-10px_rgba(168,85,247,0.3)]">
              <CardHeader><CardTitle className="text-white">Inversión en publicidad</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-fuchsia-300">{currency(data?.kpis?.total_gasto_ads || 0)}</CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-[#0b1420] to-[#0a0f18] border border-[#1b2a40] shadow-[0_0_0_1px_rgba(59,130,246,0.12),0_10px_40px_-10px_rgba(59,130,246,0.25)]">
              <CardHeader><CardTitle className="text-white">Impresiones</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-blue-300">{(data?.kpis?.impresiones ?? 0).toLocaleString()}</CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-[#0b1220] to-[#0b0f19] border border-[#1b2a4a] shadow-[0_0_0_1px_rgba(59,130,246,0.15),0_10px_40px_-10px_rgba(59,130,246,0.3)]">
              <CardHeader><CardTitle className="text-white">CTR</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-cyan-300">{Number(data?.kpis?.ctr ?? 0).toFixed(2)}%</CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-[#0f1f18] to-[#0b1510] border border-[#1e3a2f] shadow-[0_0_0_1px_rgba(16,185,129,0.15),0_10px_40px_-10px_rgba(16,185,129,0.3)]">
              <CardHeader><CardTitle className="text-white">VSL PLAY RATE %</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-emerald-300">{Number(data?.kpis?.vsl_play_rate ?? 0).toFixed(1)}%</CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-[#0f1f18] to-[#0b1510] border border-[#1e3a2f] shadow-[0_0_0_1px_rgba(16,185,129,0.15),0_10px_40px_-10px_rgba(16,185,129,0.3)]">
              <CardHeader><CardTitle className="text-white">VSL ENGAGEMENT %</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-emerald-300">{Number(data?.kpis?.vsl_engagement ?? 0).toFixed(1)}%</CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-[#0b1220] to-[#0b0f19] border border-[#1b2a4a] shadow-[0_0_0_1px_rgba(59,130,246,0.15),0_10px_40px_-10px_rgba(59,130,246,0.3)]">
              <CardHeader><CardTitle className="text-white">Reuniones agendadas</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-cyan-300">{(data?.kpis?.reuniones_agendadas ?? 0).toLocaleString()}</CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-[#0b1220] to-[#0b0f19] border border-[#1b2a4a] shadow-[0_0_0_1px_rgba(59,130,246,0.15),0_10px_40px_-10px_rgba(59,130,246,0.3)]">
              <CardHeader><CardTitle className="text-white">Reuniones calificadas</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-cyan-300">{(data?.kpis?.reuniones_calificadas ?? 0).toLocaleString()}</CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-[#0b1220] to-[#0b0f19] border border-[#1b2a4a] shadow-[0_0_0_1px_rgba(59,130,246,0.15),0_10px_40px_-10px_rgba(59,130,246,0.3)]">
              <CardHeader><CardTitle className="text-white">Reuniones asistidas (show rate)</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-cyan-300">{(() => {
                const shows = data?.kpis?.total_llamadas_tomadas ?? 0;
                const agendasEfectivas = data?.kpis?.agendas_efectivas ?? 0; // agendas sin PDTE menos canceladas
                const pct = agendasEfectivas ? (shows / agendasEfectivas) * 100 : 0;
                return `${shows.toLocaleString()} (${pct.toFixed(1)}%)`;
              })()}</CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-[#0f1f18] to-[#0b1510] border border-[#1e3a2f] shadow-[0_0_0_1px_rgba(16,185,129,0.15),0_10px_40px_-10px_rgba(16,185,129,0.3)]">
              <CardHeader><CardTitle className="text-white">Llamadas cerradas (close rate)</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-emerald-300">{(() => {
                const sales = data?.kpis?.total_cierres ?? 0;
                const shows = data?.kpis?.total_llamadas_tomadas ?? 0;
                const pct = shows ? (sales / shows) * 100 : 0;
                return `${sales.toLocaleString()} (${pct.toFixed(1)}%)`;
              })()}</CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-[#220b0b] to-[#150a0a] border border-[#4a1b1b] shadow-[0_0_0_1px_rgba(248,113,113,0.15),0_10px_40px_-10px_rgba(248,113,113,0.3)]">
              <CardHeader><CardTitle className="text-white">Llamadas canceladas</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-red-300">{(data?.kpis?.llamadas_canceladas ?? 0).toLocaleString()}</CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-[#0b1220] to-[#0b0f19] border border-[#1b2a4a] shadow-[0_0_0_1px_rgba(59,130,246,0.15),0_10px_40px_-10px_rgba(59,130,246,0.3)]">
              <CardHeader>
                <CardTitle className="text-white">Facturación</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold text-cyan-300">{currency(data?.kpis?.total_facturacion || 0)}</CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-[#0f1f18] to-[#0b1510] border border-[#1e3a2f] shadow-[0_0_0_1px_rgba(16,185,129,0.15),0_10px_40px_-10px_rgba(16,185,129,0.3)]">
              <CardHeader><CardTitle className="text-white">Cash Collected</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-emerald-300">{currency(data?.kpis?.cash_collected || 0)}</CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-[#0b1420] to-[#0a0f18] border border-[#1b2a40] shadow-[0_0_0_1px_rgba(59,130,246,0.12),0_10px_40px_-10px_rgba(59,130,246,0.25)]">
              <CardHeader><CardTitle className="text-white">Ticket promedio</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-blue-300">{currency(data?.kpis?.ticket_promedio || 0)}</CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-[#160e1f] to-[#0e0b19] border border-[#3a214b] shadow-[0_0_0_1px_rgba(168,85,247,0.15),0_10px_40px_-10px_rgba(168,85,247,0.3)]">
              <CardHeader><CardTitle className="text-white">Costo por agenda calificada</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-fuchsia-300">{currency(data?.kpis?.costo_por_agenda_calificada || 0)}</CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-[#160e1f] to-[#0e0b19] border border-[#3a214b] shadow-[0_0_0_1px_rgba(168,85,247,0.15),0_10px_40px_-10px_rgba(168,85,247,0.3)]">
              <CardHeader><CardTitle className="text-white">Costo por show</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-fuchsia-300">{currency(data?.kpis?.costo_por_show || 0)}</CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-[#160e1f] to-[#0e0b19] border border-[#3a214b] shadow-[0_0_0_1px_rgba(168,85,247,0.15),0_10px_40px_-10px_rgba(168,85,247,0.3)]">
              <CardHeader><CardTitle className="text-white">Costo por adquisición (CAC)</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-fuchsia-300">{currency(data?.kpis?.cac || 0)}</CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-[#0f1f18] to-[#0b1510] border border-[#1e3a2f] shadow-[0_0_0_1px_rgba(16,185,129,0.15),0_10px_40px_-10px_rgba(16,185,129,0.3)]">
              <CardHeader><CardTitle className="text-white">ROAS (Facturación)</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-emerald-300">{data?.kpis?.roas ? data.kpis.roas.toFixed(2) + "x" : "—"}</CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-[#0f1f18] to-[#0b1510] border border-[#1e3a2f] shadow-[0_0_0_1px_rgba(16,185,129,0.15),0_10px_40px_-10px_rgba(16,185,129,0.3)]">
              <CardHeader><CardTitle className="text-white">ROAS (Cash Collected)</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-emerald-300">{data?.kpis?.roas_cash_collected ? data.kpis.roas_cash_collected.toFixed(2) + "x" : "—"}</CardContent>
            </Card>
            
            {/* Nuevos tableros */}
            <Card className="bg-gradient-to-br from-[#1a0f2e] to-[#0f0a1a] border border-[#4a2c5a] shadow-[0_0_0_1px_rgba(147,51,234,0.15),0_10px_40px_-10px_rgba(147,51,234,0.3)]">
              <CardHeader><CardTitle className="text-white">Revenue por Show</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-purple-300">
                {(() => {
                  const cashCollected = data?.kpis?.cash_collected || 0;
                  const llamadasCalificadas = data?.kpis?.reuniones_calificadas || 0;
                  return llamadasCalificadas > 0 ? currency(cashCollected / llamadasCalificadas) : "$0";
                })()}
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-[#0f1a2e] to-[#0a0f1a] border border-[#2c4a5a] shadow-[0_0_0_1px_rgba(59,130,246,0.15),0_10px_40px_-10px_rgba(59,130,246,0.3)]">
              <CardHeader><CardTitle className="text-white">% Calificación</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold text-blue-300">
                {(() => {
                  const asistieron = data?.kpis?.total_llamadas_tomadas || 0;
                  const calificadas = data?.kpis?.reuniones_calificadas || 0;
                  return calificadas > 0 ? ((asistieron / calificadas) * 100).toFixed(1) + "%" : "0%";
                })()}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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
          </div>

          {/* ... sección movida al final ... */}

          <div className="w-full bg-neutral-900/60 backdrop-blur rounded-xl border border-neutral-800 shadow-[0_0_30px_rgba(0,0,0,0.3)] mb-8 p-6">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-white font-sans tracking-wide">Resumen por Métodos de Adquisición</h3>
              <p className="text-neutral-300/80 text-sm mt-1">Métricas de rendimiento por fuente de tráfico</p>
            </div>
            
            <div className="overflow-x-auto">
              <div className="min-w-full">
                {/* Header */}
                <div className="grid grid-cols-11 gap-3 pb-4 mb-4 border-b border-neutral-600/20">
                  <div className="text-neutral-300 font-semibold text-sm uppercase tracking-wider">Padre campaña / Creativo</div>
                  <div className="text-neutral-300 font-semibold text-sm uppercase tracking-wider">Spend</div>
                  <div className="text-neutral-300 font-semibold text-sm uppercase tracking-wider">Agendas</div>
                  <div className="text-neutral-300 font-semibold text-sm uppercase tracking-wider">Show Rate</div>
                  <div className="text-neutral-300 font-semibold text-sm uppercase tracking-wider">Cierres</div>
                  <div className="text-neutral-300 font-semibold text-sm uppercase tracking-wider">Cash Collected</div>
                  <div className="text-neutral-300 font-semibold text-sm uppercase tracking-wider">Ticket Promedio</div>
                  <div className="text-neutral-300 font-semibold text-sm uppercase tracking-wider">Costo/Show</div>
                  <div className="text-neutral-300 font-semibold text-sm uppercase tracking-wider">Costo/Agenda</div>
                  <div className="text-neutral-300 font-semibold text-sm uppercase tracking-wider">CAC</div>
                  <div className="text-neutral-300 font-semibold text-sm uppercase tracking-wider">ROAS</div>
                </div>

                {/* Grouped Rows by padre_campana */}
                {(() => {
                  type AdsRow = NonNullable<ApiResponse["adsByOrigin"]>[number];
                  const groups = (data?.adsByOrigin ?? []).reduce<Record<string, AdsRow[]>>((acc, item) => {
                    const key = (item.padre_campana || 'sin_padre');
                    (acc[key] ||= []).push(item as AdsRow);
                    return acc;
                  }, {});
                  return Object.entries(groups).map(([padre, items]) => {
                    const totals = items.reduce(
                      (agg, it) => ({
                        spend: agg.spend + (it.spend_allocated || 0),
                        agendas: agg.agendas + (it.agendas || 0),
                        shows: agg.shows + (it.shows || 0),
                        cierres: agg.cierres + (it.cierres || 0),
                        fact: agg.fact + (it.facturacion || 0),
                        cash: agg.cash + (it.cash_collected || 0),
                      }),
                      { spend: 0, agendas: 0, shows: 0, cierres: 0, fact: 0, cash: 0 }
                    );
                    const groupShowRate = totals.agendas ? ((totals.shows / totals.agendas) * 100).toFixed(1) + "%" : "—";
                    const groupRoas = totals.spend ? (totals.fact / totals.spend).toFixed(2) + "x" : "—";
                    const groupCpo = totals.agendas ? currency(totals.spend / totals.agendas) : "$0";
                    const groupCpShow = totals.shows ? currency(totals.spend / totals.shows) : "$0";
                    const groupCac = totals.cierres ? currency(totals.spend / totals.cierres) : "$0";

                    return (
                      <div key={padre} className="mb-2">
                        {/* Parent Row */}
                        <details className="group bg-neutral-800/20 rounded-lg">
                          <summary className="cursor-pointer grid grid-cols-11 gap-3 py-3 px-2 items-center rounded-lg hover:bg-neutral-700/20">
                            <div className="font-bold text-white text-sm flex items-center gap-2">
                              <span className="inline-block w-2 h-2 rounded-full bg-cyan-400" />
                              {padre}
                            </div>
                            <div className="text-gray-300 text-sm">{currency(totals.spend)}</div>
                            <div className="text-cyan-300 font-medium text-sm">{totals.agendas}</div>
                            <div className="text-cyan-300 font-medium text-sm">{groupShowRate}</div>
                            <div className="text-emerald-400 font-semibold text-sm">{totals.cierres}</div>
                            <div className="text-emerald-400 font-semibold text-sm">{currency(totals.cash)}</div>
                            <div className="text-emerald-400 font-semibold text-sm">{totals.cierres ? currency(totals.cash / totals.cierres) : "$0"}</div>
                            <div className="text-gray-300 text-sm">{groupCpShow}</div>
                            <div className="text-gray-300 text-sm">{groupCpo}</div>
                            <div className="text-gray-300 text-sm">{groupCac}</div>
                            <div className="text-emerald-400 font-bold text-sm">{groupRoas}</div>
                          </summary>

                          {/* Child Rows: creatives */}
                          <div className="px-2 pb-2">
                            {items
                              .sort((a, b) => (b.cash_collected || 0) - (a.cash_collected || 0))
                              .map((row, index) => {
                                const spend = row.spend_allocated || 0;
                                const shows = row.shows || 0;
                                const cierres = row.cierres || 0;
                                const agendas = row.agendas || 0;
                                const fact = row.facturacion || 0;
                                const showRate = agendas ? ((shows / agendas) * 100).toFixed(1) + "%" : "—";
                                const roas = spend ? (fact / spend).toFixed(2) + "x" : "—";
                                const cpo = agendas ? currency(spend / agendas) : "$0";
                                const cpshow = shows ? currency(spend / shows) : "$0";
                                const cac = cierres ? currency(spend / cierres) : "$0";
                                const cash = row.cash_collected ? Number(row.cash_collected) : 0;
                                const ticket = cierres ? currency(cash / cierres) : "$0";

                                return (
                                  <div key={row.anuncio_origen} className={`ml-4 grid grid-cols-11 gap-3 py-2 px-2 rounded-lg ${index % 2 === 0 ? 'bg-neutral-800/10' : 'bg-transparent'}`}>
                                    <div className="text-white text-sm">{row.anuncio_origen}</div>
                                    <div className="text-gray-300 text-sm">{currency(spend)}</div>
                                    <div className="text-cyan-300 text-sm">{agendas}</div>
                                    <div className="text-cyan-300 text-sm">{showRate}</div>
                                    <div className="text-emerald-400 text-sm">{cierres}</div>
                                    <div className="text-emerald-400 text-sm">{currency(cash)}</div>
                                    <div className="text-emerald-400 text-sm">{ticket}</div>
                                    <div className="text-gray-300 text-sm">{cpshow}</div>
                                    <div className="text-gray-300 text-sm">{cpo}</div>
                                    <div className="text-gray-300 text-sm">{cac}</div>
                                    <div className="text-emerald-400 text-sm">{roas}</div>
                                  </div>
                                );
                              })}
                          </div>
                        </details>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>

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
                        <div className="mb-3">
                          <input
                            placeholder="Buscar lead..."
                            className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm placeholder:text-white"
                            value={closerFilter[c.closer] ?? ''}
                            onChange={(ev) => setCloserFilter((prev) => ({ ...prev, [c.closer]: ev.target.value }))}
                          />
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
                                if (!q) return true;
                                return (e.cliente ?? '').toLowerCase().includes(q);
                              }).map((e) => (
                                <TableRow key={e.id_evento}>
                                  <TableCell className="text-white">{new Date(e.fecha_hora_evento).toLocaleString()}</TableCell>
                                  <TableCell className="text-white">{e.cliente ?? "—"}</TableCell>
                                  <TableCell className="text-white">{(() => { 
                                    // Siempre mostrar "Sí" para Asistió por defecto
                                    return <span className="inline-flex items-center">
                                      <span className="w-6 h-6 rounded-full inline-flex items-center justify-center text-[10px] font-semibold border bg-emerald-500/20 text-emerald-300 border-emerald-400/40">
                                        Sí
                                      </span>
                                    </span>; 
                                  })()}</TableCell>
                                  <TableCell className="text-white">{(() => { 
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
                                    <Dialog>
                                      <DialogTrigger asChild>
                                        <Button variant="outline" className="bg-neutral-900 border-neutral-800 text-neutral-200 hover:border-cyan-400/40 hover:text-cyan-300">Ver notas</Button>
                                      </DialogTrigger>
                                      <DialogContent className="sm:max-w-[800px] max-h-[90vh] bg-neutral-950 border-neutral-800 text-neutral-100 mx-4">
                                        <DialogHeader>
                                          <DialogTitle>Detalle de la llamada</DialogTitle>
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
                                            // Refrescar dashboard
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
                                  </TableCell>
                                </TableRow>
                              ))}
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
                  <div className="grid grid-cols-6 gap-3 p-4 text-xs uppercase tracking-wider text-neutral-300 bg-neutral-900/60">
                    <div>Fecha</div>
                    <div>Lead</div>
                    <div>Origen</div>
                    <div>Email</div>
                    <div>Closer</div>
                    <div className="text-right pr-2">Estado</div>
                  </div>
                  {(dataset?.pendientes ?? []).map((p, idx) => (
                    <div
                      key={p.id_registro_agenda}
                      className={`grid grid-cols-6 gap-3 items-center px-4 py-3 border-t border-neutral-800 ${idx % 2 === 0 ? "bg-neutral-900/30" : "bg-transparent"}`}
                    >
                      <div className="text-white text-sm">{new Date(p.fecha).toLocaleDateString()}</div>
                      <div className="text-white text-sm font-medium">{p.nombre_de_lead}</div>
                      <div className="text-neutral-300 text-sm">{p.origen}</div>
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
