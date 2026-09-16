import { useState, useEffect } from "react";
export function useUsage() {
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetch("/api/usage")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch usage");
        return res.json();
      })
      .then((data) => {
        setUsage(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, []);

  return { usage, loading, error };
}

