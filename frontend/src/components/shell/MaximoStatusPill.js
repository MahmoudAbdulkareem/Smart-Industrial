import React, { useEffect, useState } from "react";
import { Link2, Link2Off, Loader2 } from "lucide-react";
import api from "../../services/api";

const POLL_MS = 30000;

/**
 * Polls the real GET /api/maximo/test-connection endpoint (backend/controllers/maximoController.js).
 * `configured: false` means the project is legitimately running in local-only mode (no
 * MAXIMO_API_KEY set) per the README — that's a true state, not an error to hide.
 */
export default function MaximoStatusPill() {
    const [state, setState] = useState({ loading: true });

    useEffect(() => {
        let cancelled = false;
        async function check() {
            try {
                const data = await api.get("/api/maximo/test-connection");
                if (!cancelled) setState({ loading: false, ...data });
            } catch (err) {
                if (!cancelled) {
                    setState({ loading: false, configured: false, connected: false, error: err?.data?.error });
                }
            }
        }
        check();
        const id = setInterval(check, POLL_MS);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, []);

   
}

function Pill({ icon, label, tone }) {
    const toneClasses = {
        normal: "bg-status-normal/10 text-status-normal border-status-normal/30",
        elevated: "bg-status-elevated/10 text-status-elevated border-status-elevated/30",
        critical: "bg-status-critical/10 text-status-critical border-status-critical/30",
        info: "bg-status-info/10 text-status-info border-status-info/30",
    };
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium font-mono ${toneClasses[tone]}`}
        >
            {icon}
            {label}
        </span>
    );
}
