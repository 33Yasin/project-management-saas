import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export default function App() {
  const [health, setHealth] = useState<{ status: string; timestamp: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchHealth = () => {
    setLoading(true);
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setHealth(data);
        setError(null);
      })
      .catch((err) => {
        setError(err.message);
        setHealth(null);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    let ignore = false;
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!ignore) {
          setHealth(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err.message);
          setHealth(null);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Project Management SaaS
        </h1>
        <p className="text-sm text-gray-500 mb-6">Phase 0 — Setup & Connectivity Check</p>

        {!health && !error && (
          <p className="text-gray-400 text-sm">Connecting to API...</p>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700 mb-4">
            <p className="font-medium text-sm">API Connection Failed</p>
            <p className="text-xs mt-1 font-mono">{error}</p>
          </div>
        )}

        {health && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-md p-4 text-emerald-800 mb-4">
            <p className="font-semibold text-sm flex items-center gap-1.5">
              <span>●</span> API Connected Successfully
            </p>
            <div className="mt-2 text-xs space-y-1 text-emerald-700 font-mono">
              <p>Status: {health.status}</p>
              <p>Server Time: {health.timestamp}</p>
            </div>
          </div>
        )}

        <div className="pt-2">
          <Button
            onClick={fetchHealth}
            disabled={loading}
            className="w-full cursor-pointer"
          >
            {loading ? 'Checking...' : 'Check Connection'}
          </Button>
        </div>
      </div>
    </div>
  );
}
