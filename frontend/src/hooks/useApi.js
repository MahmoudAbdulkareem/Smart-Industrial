import { useState, useEffect, useCallback } from "react";

// Gets the token from localStorage
function getToken() {
  return localStorage.getItem("token");
}

export function useApi(endpoint, interval = 5000) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetchData = useCallback(async () => {
    const token = getToken();
    try {
      const res = await fetch(`/api${endpoint}`, {
        headers: {
          // Send the token with every request
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      if (res.status === 401) {
        // Token missing or expired — clear storage and reload to go to login
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/";
        return;
      }

      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, interval);
    return () => clearInterval(id);
  }, [fetchData, interval]);

  return { data, loading, error };
}
