import { useState, useEffect } from "react";
export interface UsageData {
  planName: string;
  documents: { used: number; limit: number | null };
  templates: { used: number; limit: number | null };
  contacts: { used: number; limit: number | null };
  publicForms: { used: number; limit: number | null };
  publicFormSubmissions: { used: number; limit: number | null };
  bulkSendBatches: { used: number; limit: number | null };
  bulkSendRecipients: { used: number; limit: number | null };
  storage: { used: number | null; limit: number | null };
}

export function useUsage() {
  const [usage, setUsage] = useState<UsageData | null>(null);
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

