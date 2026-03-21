"use client";

import { useEffect, useState } from "react";
import { webhookService } from "@/lib/services";
import { useRateLimit } from "@/lib/useRateLimit";
import PageShell from "@/components/layout/PageShell";

interface Delivery {
  id: string;
  status: "success" | "failed";
  statusCode: number;
  timestamp: number;
  error?: string;
}

interface Webhook {
  id: string;
  url: string;
  events: string[];
  createdAt: number;
  active: boolean;
}

const AVAILABLE_EVENTS = ["job.completed", "job.failed", "job.timeout"];

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function WebhooksPage() {
  const { rateLimit, capture } = useRateLimit();

  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // New webhook form
  const [showForm, setShowForm] = useState(false);
  const [formUrl, setFormUrl] = useState("");
  const [formEvents, setFormEvents] = useState<string[]>(["job.completed"]);
  const [formSecret, setFormSecret] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Deliveries drawer
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadWebhooks();
  }, []);

  async function loadWebhooks() {
    try {
      const res = await webhookService.list();
      capture(res);
      const raw = res.data.data;
      setWebhooks(Array.isArray(raw) ? raw : raw.webhooks ?? []);
    } catch {
      setError("Failed to load webhooks.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.SubmitEvent) {
    e.preventDefault();
    if (!formUrl.trim() || formEvents.length === 0) return;
    setCreateError("");
    setCreating(true);
    try {
      const res = await webhookService.create(
        formUrl.trim(),
        formEvents,
        formSecret.trim() || undefined
      );
      const created = res.data.data;
      setWebhooks((prev) => [created, ...prev]);
      setShowForm(false);
      setFormUrl("");
      setFormEvents(["job.completed"]);
      setFormSecret("");
    } catch (err: any) {
      setCreateError(err.response?.data?.error || "Failed to create webhook.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      await webhookService.delete(id);
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
      setDeletingId(null);
      if (selectedWebhook?.id === id) setSelectedWebhook(null);
    } catch {
      await loadWebhooks();
    } finally {
      setDeleting(false);
    }
  }

  async function openDeliveries(webhook: Webhook) {
    setSelectedWebhook(webhook);
    setDeliveries([]);
    setDeliveriesLoading(true);
    try {
      const res = await webhookService.getDeliveries(webhook.id);
      const raw = res.data.data;
      setDeliveries(Array.isArray(raw) ? raw : raw.deliveries ?? []);
    } catch {
      setDeliveries([]);
    } finally {
      setDeliveriesLoading(false);
    }
  }

  function toggleEvent(event: string) {
    setFormEvents((prev) =>
      prev.includes(event)
        ? prev.filter((e) => e !== event)
        : [...prev, event]
    );
  }

  return (
    <PageShell title="Webhooks" rateLimit={rateLimit}>
      <div className="max-w-2xl space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Webhooks</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Receive HTTP callbacks when jobs complete. All deliveries are
              HMAC-signed.
            </p>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              + Add webhook
            </button>
          )}
        </div>

        {/* New webhook form */}
        {showForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
            <p className="text-sm font-medium text-gray-900">New webhook</p>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Endpoint URL
                </label>
                <input
                  type="url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://your-server.com/webhook"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Events
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_EVENTS.map((event) => (
                    <button
                      key={event}
                      type="button"
                      onClick={() => toggleEvent(event)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        formEvents.includes(event)
                          ? "bg-blue-50 border-blue-300 text-blue-700"
                          : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}
                    >
                      {event}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Secret{" "}
                  <span className="font-normal text-gray-400">(optional — for HMAC verification)</span>
                </label>
                <input
                  type="text"
                  value={formSecret}
                  onChange={(e) => setFormSecret(e.target.value)}
                  placeholder="your-webhook-secret"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              {createError && (
                <p className="text-xs text-red-600">{createError}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={creating || !formUrl.trim() || formEvents.length === 0}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition-colors"
                >
                  {creating ? "Creating…" : "Create webhook"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setCreateError("");
                  }}
                  className="px-3 py-2 text-sm border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Webhooks list */}
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          {loading ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              Loading…
            </div>
          ) : error ? (
            <div className="px-5 py-8 text-center text-sm text-red-500">
              {error}
            </div>
          ) : webhooks.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-gray-400">No webhooks registered.</p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-2 text-xs text-blue-600 hover:underline"
              >
                Add your first webhook
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {webhooks.map((webhook) => (
                <div key={webhook.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                        webhook.active ? "bg-green-400" : "bg-gray-300"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {webhook.url}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {webhook.events.map((event) => (
                          <span
                            key={event}
                            className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full"
                          >
                            {event}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-1.5">
                        Created {timeAgo(webhook.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => openDeliveries(webhook)}
                        className="text-xs px-2.5 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg transition-colors"
                      >
                        Deliveries
                      </button>
                      {deletingId === webhook.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleDelete(webhook.id)}
                            disabled={deleting}
                            className="text-xs px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg transition-colors"
                          >
                            {deleting ? "Deleting…" : "Confirm"}
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="text-xs px-2.5 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-500 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingId(webhook.id)}
                          className="text-xs px-2.5 py-1.5 border border-gray-200 hover:border-red-200 hover:text-red-600 text-gray-400 rounded-lg transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Deliveries panel */}
        {selectedWebhook && (
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Deliveries
                </p>
                <p className="text-xs text-gray-400 truncate max-w-xs mt-0.5">
                  {selectedWebhook.url}
                </p>
              </div>
              <button
                onClick={() => setSelectedWebhook(null)}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Close
              </button>
            </div>

            {deliveriesLoading ? (
              <div className="px-5 py-6 text-center text-sm text-gray-400">
                Loading deliveries…
              </div>
            ) : deliveries.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-gray-400">
                No deliveries yet.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-400 px-4 py-2.5">
                      Status
                    </th>
                    <th className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">
                      HTTP
                    </th>
                    <th className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">
                      Delivered
                    </th>
                    <th className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">
                      Error
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((d) => (
                    <tr
                      key={d.id}
                      className="border-b border-gray-50 last:border-0"
                    >
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            d.status === "success"
                              ? "bg-green-50 text-green-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {d.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs font-mono text-gray-500">
                        {d.statusCode ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-400">
                        {timeAgo(d.timestamp)}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-400 truncate max-w-[180px]">
                        {d.error ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Verification snippet */}
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-600 mb-2">
            Verifying signatures
          </p>
          <pre className="text-xs font-mono text-gray-500 leading-relaxed overflow-x-auto">{`import hmac, hashlib

def verify(payload: bytes, sig: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, sig)`}</pre>
        </div>

      </div>
    </PageShell>
  );
}