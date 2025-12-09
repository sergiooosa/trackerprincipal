/* eslint-disable react-hooks/exhaustive-deps */
"use client";
import { useQuery } from "@tanstack/react-query";

type LogItem = {
  id_evento: number;
  id_cuenta: number;
  usuario_asociado: string | null;
  accion: string;
  detalles: Record<string, unknown> | null;
  fecha_y_hora_evento: string;
};

export default function Logs() {
  const q = useQuery<{ logs: LogItem[] }>({
    queryKey: ["admin-logs"],
    queryFn: async () => {
      const res = await fetch("/api/logs?limit=300", { cache: "no-store" });
      if (!res.ok) throw new Error("No autorizado o error cargando logs");
      return res.json();
    },
  });
  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 px-6 sm:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Logs de acciones</h1>
        <button
          className="bg-neutral-900 border border-neutral-800 text-neutral-200 hover:border-cyan-400/40 hover:text-cyan-300 px-3 py-2 rounded-md text-sm"
          onClick={() => window.open("/", "_self")}
        >
          ← Volver
        </button>
      </div>
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-6">
        {q.isLoading ? (
          <div className="text-neutral-300">Cargando...</div>
        ) : q.isError ? (
          <div className="text-red-400">Error cargando logs</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-300 border-b border-neutral-800">
                  <th className="py-2">Fecha</th>
                  <th className="py-2">Usuario</th>
                  <th className="py-2">Acción</th>
                  <th className="py-2">Detalles</th>
                </tr>
              </thead>
              <tbody>
                {(q.data?.logs ?? []).map((l) => (
                  <tr key={l.id_evento} className="border-b border-neutral-800">
                    <td className="py-2">{new Date(l.fecha_y_hora_evento).toLocaleString()}</td>
                    <td className="py-2">{l.usuario_asociado ?? "—"}</td>
                    <td className="py-2">{l.accion}</td>
                    <td className="py-2">
                      <pre className="whitespace-pre-wrap text-xs text-neutral-300">
                        {JSON.stringify(l.detalles || {}, null, 2)}
                      </pre>
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


