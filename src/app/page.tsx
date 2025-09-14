"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, formatISO, startOfDay, endOfDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type ApiResponse = {
  kpis: {
    total_facturacion: number;
    total_gasto_ads: number;
    total_llamadas_tomadas: number;
    total_cierres: number;
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
  }>;
  events: Array<{
    id_evento: string;
    fecha_hora_evento: string;
    closer: string;
    facturacion: number;
    anuncio_origen: string | null;
    resumen_ia: string | null;
  }>;
};

function currency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
}

function generateDemoData(start: Date, end: Date): ApiResponse {
  const days: string[] = [];
  const msPerDay = 24 * 60 * 60 * 1000;
  for (let t = startOfDay(start).getTime(); t <= endOfDay(end).getTime(); t += msPerDay) {
    days.push(format(new Date(t), "yyyy-MM-dd"));
  }
  const series = days.map((d, i) => {
    const fact = 500 + Math.sin(i / 2) * 200 + i * 20;
    const gasto = 300 + Math.cos(i / 3) * 120 + i * 10;
    const llamadas = Math.round(20 + Math.sin(i) * 8 + i * 0.5);
    const cierres = Math.max(0, Math.round(llamadas * (0.25 + Math.sin(i / 4) * 0.05)));
    return { fecha: d, facturacion: Math.max(0, Math.round(fact)), gasto_ads: Math.max(0, Math.round(gasto)), llamadas_tomadas: llamadas, cierres };
  });
  const total_facturacion = series.reduce((s, x) => s + x.facturacion, 0);
  const total_gasto_ads = series.reduce((s, x) => s + x.gasto_ads, 0);
  const total_llamadas_tomadas = series.reduce((s, x) => s + x.llamadas_tomadas, 0);
  const total_cierres = series.reduce((s, x) => s + x.cierres, 0);
  const closers = ["Alex", "Sam", "Jordan", "Taylor"].map((name, idx) => {
    const llamadas = 20 + idx * 7;
    const cierres = Math.round(llamadas * (0.3 - idx * 0.03));
    const fact = cierres * (900 + idx * 150);
    return { closer: name, llamadas_tomadas: llamadas, cierres, facturacion_generada: fact };
  }).sort((a, b) => b.facturacion_generada - a.facturacion_generada);
  const events = series.slice().reverse().slice(0, 12).map((d, i) => {
    const date = new Date(start.getTime() + i * msPerDay + 15 * 60 * 1000);
    return {
      id_evento: `demo-${i}`,
      fecha_hora_evento: date.toISOString(),
      closer: closers[i % closers.length].closer,
      facturacion: i % 3 === 0 ? 1200 + i * 50 : 0,
      anuncio_origen: ["Meta Ads", "Google Ads", "YouTube", "Orgánico"][i % 4],
      resumen_ia: "Resumen IA de ejemplo: llamada centrada en valor, manejo de objeciones y cierre propuesto.",
    };
  });
  return {
    kpis: { total_facturacion, total_gasto_ads, total_llamadas_tomadas, total_cierres },
    series,
    closers,
    events,
  };
}

export default function Home() {
  const today = new Date();
  const defaultStart = startOfDay(addDays(today, -6));
  const defaultEnd = endOfDay(today);
  const [startDate, setStartDate] = useState<Date>(defaultStart);
  const [endDate, setEndDate] = useState<Date>(defaultEnd);

  const { data, isLoading, isError, isFetching } = useQuery<ApiResponse>({
    queryKey: ["dashboard", startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        fecha_inicio: formatISO(startOfDay(startDate)),
        fecha_fin: formatISO(endOfDay(endDate)),
      });
      const res = await fetch(`/api/dashboard?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Error fetching dashboard data");
      return res.json();
    },
  });

  const dataset: ApiResponse = data && !isError ? data : generateDemoData(startDate, endDate);
  const kpis = dataset.kpis;
  const series = dataset.series;
  const closers = useMemo(() => (dataset.closers ?? []).map((c) => ({
    ...c,
    tasa_cierre: c.llamadas_tomadas ? (c.cierres / c.llamadas_tomadas) * 100 : 0,
  })), [dataset]);
  const events = dataset.events ?? [];

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 px-6 sm:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Aura Performance Dashboard - Startup Independiente</h1>
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
              <Button variant="outline" className="bg-neutral-900 border-neutral-800 text-neutral-200">
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
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2">
            {isError && <Badge variant="secondary" className="bg-amber-500/20 text-amber-300 border-amber-500/30">Mostrando datos de demostración</Badge>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="bg-gradient-to-br from-[#0b1220] to-[#0b0f19] border border-[#1b2a4a] shadow-[0_0_0_1px_rgba(59,130,246,0.15),0_10px_40px_-10px_rgba(59,130,246,0.3)]">
              <CardHeader>
                <CardTitle className="text-white">Facturación Total</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold text-cyan-300">{currency(kpis?.total_facturacion || 0)}</CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-[#160e1f] to-[#0e0b19] border border-[#3a214b] shadow-[0_0_0_1px_rgba(168,85,247,0.15),0_10px_40px_-10px_rgba(168,85,247,0.3)]">
              <CardHeader>
                <CardTitle className="text-white">Gasto Total en Ads</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold text-fuchsia-300">{currency(kpis?.total_gasto_ads || 0)}</CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-[#0f1f18] to-[#0b1510] border border-[#1e3a2f] shadow-[0_0_0_1px_rgba(16,185,129,0.15),0_10px_40px_-10px_rgba(16,185,129,0.3)]">
              <CardHeader>
                <CardTitle className="text-white">Tasa de Cierre</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold text-emerald-300">
                {(() => {
                  const totalLlamadas = kpis?.total_llamadas_tomadas || 0;
                  const totalCierres = kpis?.total_cierres || 0;
                  const pct = totalLlamadas ? (totalCierres / totalLlamadas) * 100 : 0;
                  return `${pct.toFixed(1)}%`;
                })()}
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-[#0b1420] to-[#0a0f18] border border-[#1b2a40] shadow-[0_0_0_1px_rgba(59,130,246,0.12),0_10px_40px_-10px_rgba(59,130,246,0.25)]">
              <CardHeader>
                <CardTitle className="text-white">Llamadas Tomadas</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold text-blue-300">{kpis?.total_llamadas_tomadas ?? 0}</CardContent>
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-neutral-900/60 backdrop-blur border border-neutral-800">
              <CardHeader>
                <CardTitle className="text-white">Leaderboard de Closers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Closer</TableHead>
                        <TableHead>Llamadas Tomadas</TableHead>
                        <TableHead>Cierres</TableHead>
                        <TableHead>Tasa de Cierre (%)</TableHead>
                        <TableHead>Facturación Generada</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {closers.map((c) => (
                        <TableRow key={c.closer}>
                          <TableCell className="font-medium">{c.closer}</TableCell>
                          <TableCell>{c.llamadas_tomadas}</TableCell>
                          <TableCell>{c.cierres}</TableCell>
                          <TableCell>{c.tasa_cierre.toFixed(1)}%</TableCell>
                          <TableCell>{currency(c.facturacion_generada || 0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-neutral-900/60 backdrop-blur border border-neutral-800">
              <CardHeader>
                <CardTitle className="text-white">Llamadas Recientes</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {events.map((e) => {
                    const title = `[${new Date(e.fecha_hora_evento).toLocaleString()}] - ${e.closer} - ${currency(e.facturacion || 0)}`;
                    return (
                      <AccordionItem key={e.id_evento} value={e.id_evento}>
                        <AccordionTrigger>{title}</AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2 text-sm text-neutral-300">
                            <div><span className="text-neutral-400">Anuncio:</span> {e.anuncio_origen ?? "N/A"}</div>
                            <div className="text-neutral-200 whitespace-pre-wrap">{e.resumen_ia ?? "Sin resumen"}</div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
