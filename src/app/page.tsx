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
    reuniones_calificadas: number;
    cash_collected: number;
    ticket_promedio: number;
    cac: number;
    costo_por_agenda_calificada: number;
    costo_por_show: number;
    roas: number;
    roas_cash_collected: number;
    no_show: number;
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
    agendas: number;
    cierres: number;
    facturacion: number;
    cash_collected: number;
    spend_allocated: number;
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
    // Close rate debe salir de las reuniones asistidas (shows)
    tasa_cierre: c.shows ? (c.cierres / c.shows) * 100 : 0,
    // Show rate: shows / reuniones calificadas
    tasa_show: c.reuniones_calificadas ? (c.shows / c.reuniones_calificadas) * 100 : 0,
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
                const agendas = data?.kpis?.reuniones_agendadas ?? 0;
                const pct = agendas ? (shows / agendas) * 100 : 0;
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

          <Card className="w-full bg-neutral-900/60 backdrop-blur border border-neutral-800 mb-8 transition-all duration-300 hover:shadow-[0_0_0_1px_rgba(56,189,248,0.25),0_20px_60px_-15px_rgba(56,189,248,0.35)]">
            <CardHeader>
              <CardTitle className="text-white">Resumen por métodos de adquisición</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fuente</TableHead>
                      <TableHead>Spend</TableHead>
                      <TableHead>Agendas</TableHead>
                      <TableHead>Show rate</TableHead>
                      <TableHead>Cierres</TableHead>
                      <TableHead>Cash collected</TableHead>
                      <TableHead>Ticket promedio</TableHead>
                      <TableHead>Costo por show</TableHead>
                      <TableHead>Costo por agenda</TableHead>
                      <TableHead>CAC</TableHead>
                      <TableHead>ROAS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                      {(data?.adsByOrigin ?? []).map((row: {
                        anuncio_origen: string;
                        agendas: number;
                        cierres: number;
                        facturacion: number;
                        cash_collected?: number;
                        spend_allocated: number;
                        shows?: number;
                      }) => {
                      const spend = row.spend_allocated || 0;
                      const shows = row.shows ? Number(row.shows) : 0;
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
                        <TableRow key={row.anuncio_origen} className="hover:bg-neutral-800/40">
                          <TableCell className="text-white">{row.anuncio_origen}</TableCell>
                          <TableCell className="text-white">{currency(spend)}</TableCell>
                          <TableCell className="text-white">{agendas}</TableCell>
                          <TableCell className="text-white">{showRate}</TableCell>
                          <TableCell className="text-white">{cierres}</TableCell>
                          <TableCell className="text-white">{currency(cash)}</TableCell>
                          <TableCell className="text-white">{ticket}</TableCell>
                          <TableCell className="text-white">{cpshow}</TableCell>
                          <TableCell className="text-white">{cpo}</TableCell>
                          <TableCell className="text-white">{cac}</TableCell>
                          <TableCell className="text-white">{roas}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

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
        </>
      )}
    </div>
  );
}
