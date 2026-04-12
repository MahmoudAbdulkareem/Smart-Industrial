import { useState, useEffect, useCallback } from "react";

export function useApi(path, interval = 0) {
    const [data,    setData]    = useState(null);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState(null);

    const fetch_ = useCallback(async () => {
        try {
            const token = localStorage.getItem("token");
            const res   = await fetch("/api" + path, {
                headers: { Authorization: token ? "Bearer " + token : "" },
            });
            if (!res.ok) throw new Error(await res.text());
            setData(await res.json());
            setError(null);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [path]);

    useEffect(() => {
        fetch_();
        if (interval > 0) {
            const id = setInterval(fetch_, interval);
            return () => clearInterval(id);
        }
    }, [fetch_, interval]);

    return { data, loading, error, refresh: fetch_ };
}
