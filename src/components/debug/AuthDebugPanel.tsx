import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { X, Bug, ChevronDown, ChevronUp, Trash2, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type LogEntry = {
  id: string;
  timestamp: Date;
  type: "event" | "storage" | "decision" | "error" | "info";
  source: string;
  message: string;
  data?: unknown;
};

const MAX_LOGS = 100;

// Global log store so we can capture events even before the panel mounts
const globalLogs: LogEntry[] = [];
const subscribers = new Set<() => void>();

export function pushAuthLog(
  type: LogEntry["type"],
  source: string,
  message: string,
  data?: unknown
) {
  const entry: LogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    type,
    source,
    message,
    data,
  };
  globalLogs.unshift(entry);
  if (globalLogs.length > MAX_LOGS) globalLogs.pop();
  subscribers.forEach((cb) => cb());
}

// Hook to subscribe to logs
function useAuthLogs() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const cb = () => forceUpdate((n) => n + 1);
    subscribers.add(cb);
    return () => {
      subscribers.delete(cb);
    };
  }, []);

  return globalLogs;
}

// Storage key helper
const getAuthStorageKey = (): string | undefined => {
  return (supabase.auth as any)?.storageKey as string | undefined;
};

const readStorageRaw = (): { key: string | null; value: unknown } => {
  try {
    const key = getAuthStorageKey() ?? null;
    if (!key) return { key: null, value: null };
    const raw = localStorage.getItem(key);
    return { key, value: raw ? JSON.parse(raw) : null };
  } catch {
    return { key: null, value: null };
  }
};

export function AuthDebugPanel() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const logs = useAuthLogs();
  const auth = useAuth();
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      pushAuthLog(
        "event",
        "onAuthStateChange",
        `${event}`,
        { userId: session?.user?.id, expiresAt: (session as any)?.expires_at }
      );
    });

    return () => subscription.unsubscribe();
  }, []);

  // Log storage on mount and when panel opens
  useEffect(() => {
    if (open) {
      const { key, value } = readStorageRaw();
      const session = (value as any)?.currentSession ?? (value as any)?.session ?? value;
      pushAuthLog(
        "storage",
        "localStorage",
        `Key: ${key ?? "(not found)"}`,
        {
          hasSession: !!session,
          userId: session?.user?.id,
          expiresAt: session?.expires_at,
        }
      );
    }
  }, [open]);

  const clearLogs = useCallback(() => {
    globalLogs.length = 0;
    subscribers.forEach((cb) => cb());
  }, []);

  const copyLogs = useCallback(() => {
    const text = logs
      .map((l) => `[${l.timestamp.toISOString()}] [${l.type.toUpperCase()}] [${l.source}] ${l.message}${l.data ? " " + JSON.stringify(l.data) : ""}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [logs]);

  const typeColor: Record<LogEntry["type"], string> = {
    event: "text-blue-400",
    storage: "text-yellow-400",
    decision: "text-green-400",
    error: "text-red-400",
    info: "text-gray-400",
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-[9999] p-3 rounded-full bg-gray-900 text-white shadow-lg hover:bg-gray-800 transition-colors"
        title="Abrir painel de diagnóstico de autenticação"
      >
        <Bug className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-[420px] max-w-[95vw] bg-gray-900 text-gray-100 rounded-lg shadow-2xl border border-gray-700 font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-800 rounded-t-lg">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-primary" />
          <span className="font-semibold">Auth Debug</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setExpanded(!expanded)} className="p-1 hover:bg-gray-700 rounded" title={expanded ? "Minimizar" : "Expandir"}>
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button onClick={() => setOpen(false)} className="p-1 hover:bg-gray-700 rounded" title="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <>
          {/* Status Summary */}
          <div className="px-3 py-2 border-b border-gray-700 space-y-1 bg-gray-850">
            <div className="flex justify-between">
              <span className="text-gray-400">Context user:</span>
              <span className={auth.user ? "text-green-400" : "text-red-400"}>
                {auth.user?.id?.slice(0, 8) ?? "null"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Context isLoading:</span>
              <span>{String(auth.isLoading)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Session expires_at:</span>
              <span>
                {(auth.session as any)?.expires_at
                  ? new Date((auth.session as any).expires_at * 1000).toLocaleTimeString()
                  : "–"}
              </span>
            </div>
          </div>

          {/* Logs */}
          <div className="h-48 overflow-y-auto px-2 py-1 space-y-1">
            {logs.length === 0 && (
              <div className="text-gray-500 text-center py-4">Nenhum log ainda</div>
            )}
            {logs.map((log) => (
              <div key={log.id} className="flex gap-2 leading-tight">
                <span className="text-gray-500 shrink-0">
                  {log.timestamp.toLocaleTimeString()}
                </span>
                <span className={cn("shrink-0 uppercase", typeColor[log.type])}>
                  [{log.type.slice(0, 3)}]
                </span>
                <span className="text-gray-300 shrink-0">[{log.source}]</span>
                <span className="text-gray-100 break-all">{log.message}</span>
                {log.data && (
                  <span className="text-gray-500 break-all">
                    {JSON.stringify(log.data)}
                  </span>
                )}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-gray-700 bg-gray-800 rounded-b-lg">
            <button
              onClick={clearLogs}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-100"
            >
              <Trash2 className="w-3 h-3" /> Limpar
            </button>
            <button
              onClick={copyLogs}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-100"
            >
              {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
