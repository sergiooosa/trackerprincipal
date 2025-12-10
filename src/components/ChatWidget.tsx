"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, X, Send, FileSpreadsheet, Sparkles, RefreshCw, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDateRange } from "@/contexts/DateRangeContext";
import { useQuery } from "@tanstack/react-query";

type Message = {
  role: "user" | "model";
  content: string;
  timestamp?: Date;
  file?: {
    name: string;
    content: string;
    mime: string;
  };
};

// Sugerencias de preguntas comunes
const SUGGESTIONS = [
  "¿Cómo van las ventas esta semana?",
  "¿Cuál es el show rate actual?",
  "¿Qué closer tiene mejor desempeño?",
  "Muéstrame los creativos con más agendas",
];

export default function ChatWidget() {
  const { startDate, endDate } = useDateRange();
  const [isOpen, setIsOpen] = useState(false);
  
  // Verificar permisos del usuario
  const meQuery = useQuery<{ user: { nombre: string; rol: string; permisos?: Record<string, unknown> } | null }>({
    queryKey: ["auth-me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) return { user: null };
      return res.json();
    },
  });

  const canViewChatbot = () => {
    // Verificar variable de entorno primero
    if (process.env.NEXT_PUBLIC_CHATBOT_ENABLED !== 'true') return false;
    
    const me = meQuery.data?.user;
    // Si no hay usuario logueado, mostrar el chat por defecto
    if (!me) return true;
    
    // Superadmin siempre puede ver
    if (me.rol === "superadmin") return true;
    
    // Si no tiene permisos definidos (legacy), permitir por compatibilidad
    if (!me.permisos || Object.keys(me.permisos).length === 0) return true;
    
    const p = me.permisos as Record<string, { enabled?: boolean; items?: Record<string, boolean> }> | undefined;
    if (!p) return true;
    
    const group = p['chatbot'];
    // Si el grupo no existe, permitir por defecto
    if (!group) return true;
    
    // Verificar el item específico 'view'
    if (group.items && 'view' in group.items) {
      return group.items['view'] === true;
    }
    
    // Si no hay item específico, usar el estado global del grupo
    return group.enabled !== false;
  };
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "model",
      content: "¡Hola! Soy **Aura**, tu asistente de análisis. 🚀\n\nPuedo ayudarte a:\n- Analizar métricas de ventas y marketing\n- Revisar performance de closers\n- Generar reportes en Excel\n- Identificar áreas de mejora\n\n¿En qué puedo ayudarte hoy?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll cuando hay nuevos mensajes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus en input al abrir
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = useCallback(async (customMessage?: string) => {
    const messageToSend = customMessage || input.trim();
    if (!messageToSend || loading) return;

    const userMsg: Message = { role: "user", content: messageToSend, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Preparar historial (últimos 10 mensajes)
      const historyToSend = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      historyToSend.push({ role: "user", content: messageToSend });

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: historyToSend,
          dateRange: startDate && endDate ? {
            start: startDate.toISOString(),
            end: endDate.toISOString()
          } : undefined
        }),
        credentials: "include", // CRÍTICO: Incluir cookies en iframes
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Error en la respuesta");
      }

      const data = await res.json();

      const botMsg: Message = {
        role: "model",
        content: data.response || "Lo siento, no pude procesar eso.",
        timestamp: new Date(),
        file: data.file
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Error desconocido";
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          content: `❌ ${errorMsg === "No autorizado" ? "Tu sesión ha expirado. Por favor recarga la página." : "Error de conexión. Por favor intenta de nuevo."}`,
          timestamp: new Date()
        }
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, startDate, endDate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const clearChat = () => {
    setMessages([{
      role: "model",
      content: "Chat reiniciado. ¿En qué puedo ayudarte?",
      timestamp: new Date()
    }]);
  };

  // Verificar si debe renderizar (después de todos los hooks)
  if (!canViewChatbot()) {
    return null;
  }

  // Parsear markdown básico para mostrar negritas y listas
  const renderContent = (content: string) => {
    // Convertir **texto** a negritas y listas
    const parts = content.split(/(\*\*[^*]+\*\*|\n- )/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
      }
      if (part === "\n- ") {
        return <span key={i}><br />• </span>;
      }
      // Convertir \n a <br />
      return part.split("\n").map((line, j) => (
        <span key={`${i}-${j}`}>
          {j > 0 && <br />}
          {line}
        </span>
      ));
    });
  };

  return (
    <>
      {/* Botón flotante */}
      {!isOpen && (
        <button
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-lg shadow-emerald-500/30 z-50 flex items-center justify-center transition-all duration-300 hover:scale-110 group"
          onClick={() => setIsOpen(true)}
          aria-label="Abrir chat con Aura"
        >
          <Bot className="h-7 w-7 text-white group-hover:scale-110 transition-transform" />
          <span className="absolute -top-1 -right-1 h-3 w-3 bg-amber-400 rounded-full animate-pulse" />
        </button>
      )}

      {/* Ventana de chat */}
      {isOpen && (
        <Card className="fixed bottom-6 right-6 w-[400px] h-[600px] flex flex-col bg-neutral-950/95 backdrop-blur-xl border-neutral-800/50 shadow-2xl shadow-black/50 z-50 overflow-hidden rounded-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800/50 bg-gradient-to-r from-neutral-900 to-neutral-900/50">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <span className="absolute bottom-0 right-0 h-3 w-3 bg-emerald-400 rounded-full border-2 border-neutral-950" />
              </div>
              <div>
                <span className="font-semibold text-white text-sm">Aura AI</span>
                <p className="text-xs text-neutral-400">Analista de datos</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-neutral-800/50"
                onClick={clearChat}
                title="Reiniciar conversación"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-neutral-800/50"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-neutral-800" ref={scrollRef}>
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl p-3 text-sm ${
                    m.role === "user"
                      ? "bg-gradient-to-br from-emerald-600/30 to-teal-600/20 text-emerald-50 border border-emerald-500/20 rounded-br-md"
                      : "bg-neutral-900/80 text-neutral-200 border border-neutral-800/50 rounded-bl-md"
                  }`}
                >
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {renderContent(m.content)}
                  </div>
                  {m.file && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <a
                        href={`data:${m.file.mime};base64,${m.file.content}`}
                        download={m.file.name}
                        className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors bg-emerald-500/10 rounded-lg px-3 py-2"
                      >
                        <FileSpreadsheet className="h-5 w-5" />
                        <span className="font-medium">{m.file.name}</span>
                      </a>
                    </div>
                  )}
                  {m.timestamp && (
                    <div className={`text-xs mt-2 ${m.role === "user" ? "text-emerald-400/50" : "text-neutral-500"}`}>
                      {m.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-neutral-900/80 border border-neutral-800/50 rounded-2xl rounded-bl-md p-4">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="h-2 w-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="h-2 w-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="h-2 w-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-xs text-neutral-400 ml-2">Aura está analizando...</span>
                  </div>
                </div>
              </div>
            )}

            {/* Sugerencias (solo si hay pocos mensajes) */}
            {messages.length <= 2 && !loading && (
              <div className="pt-2">
                <p className="text-xs text-neutral-500 mb-2 flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  Preguntas sugeridas:
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSubmit(s)}
                      className="text-xs bg-neutral-900/50 hover:bg-neutral-800/80 text-neutral-300 px-3 py-1.5 rounded-full border border-neutral-800/50 hover:border-emerald-500/30 transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-neutral-800/50 bg-neutral-900/30">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pregunta sobre métricas, closers, creativos..."
                className="flex-1 min-h-[44px] max-h-[120px] resize-none bg-neutral-950/80 border border-neutral-800/50 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all"
                rows={1}
              />
              <Button
                type="button"
                onClick={() => handleSubmit()}
                disabled={loading || !input.trim()}
                className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[10px] text-neutral-600 mt-2 text-center">
              Aura analiza datos en tiempo real • Solo lectura
            </p>
          </div>
        </Card>
      )}
    </>
  );
}
