'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { SiteHeader } from '@/components/site-header';
import { getAccessToken } from '@/lib/api-client';
import {
  fetchPartnerChannels,
  rotatePartnerChannelKey,
  testPartnerWebhook,
  updatePartnerChannel,
  type PartnerChannelRow,
} from '@/lib/admin-api';

export default function AdminPartnersPage() {
  const [channels, setChannels] = useState<PartnerChannelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<{ code: string; apiKey: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [webhookDrafts, setWebhookDrafts] = useState<Record<string, string>>({});
  const [webhookResult, setWebhookResult] = useState<{ code: string; message: string } | null>(null);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setError('Please sign in as admin.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchPartnerChannels(token);
      setChannels(rows);
      setWebhookDrafts(
        Object.fromEntries(rows.map((row) => [row.id, row.webhookUrl ?? ''])),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load partner channels');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(channel: PartnerChannelRow) {
    const token = getAccessToken();
    if (!token) return;
    setBusyId(channel.id);
    try {
      await updatePartnerChannel(token, channel.id, { isActive: !channel.isActive });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  }

  async function rotateKey(channel: PartnerChannelRow) {
    const token = getAccessToken();
    if (!token) return;
    if (!window.confirm(`Rotate API key for ${channel.name}? The old key stops working immediately.`)) {
      return;
    }
    setBusyId(channel.id);
    try {
      const result = await rotatePartnerChannelKey(token, channel.id);
      setNewKey({ code: result.code, apiKey: result.apiKey });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Key rotation failed');
    } finally {
      setBusyId(null);
    }
  }

  async function saveWebhook(channel: PartnerChannelRow) {
    const token = getAccessToken();
    if (!token) return;
    setBusyId(channel.id);
    setWebhookResult(null);
    try {
      const webhookUrl = webhookDrafts[channel.id]?.trim() || null;
      await updatePartnerChannel(token, channel.id, { webhookUrl });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save webhook URL');
    } finally {
      setBusyId(null);
    }
  }

  async function sendTestWebhook(channel: PartnerChannelRow) {
    const token = getAccessToken();
    if (!token) return;
    setBusyId(channel.id);
    setWebhookResult(null);
    try {
      const result = await testPartnerWebhook(token, channel.id);
      setWebhookResult({
        code: channel.code,
        message: result.ok
          ? `Test delivered (${result.status ?? 200}) · event ${result.eventId ?? ''}`
          : result.error ?? 'Webhook test failed',
      });
    } catch (e) {
      setWebhookResult({
        code: channel.code,
        message: e instanceof Error ? e.message : 'Webhook test failed',
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Link href="/admin" className="text-sm font-medium text-brand hover:underline">
          ← Admin dashboard
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-charcoal">OTA partner integrations</h1>
        <p className="mt-2 text-gray-600">
          RedBus and AbhiBus sell through the same seat inventory as your website and agents.
          Configure webhook URLs to push inventory changes (website/agent sales, cancellations, trip
          cancels) so partners do not need to poll seat maps constantly.
        </p>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {webhookResult && (
          <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <p className="font-semibold">{webhookResult.code} webhook test</p>
            <p className="mt-1">{webhookResult.message}</p>
          </div>
        )}

        {newKey && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
            <p className="font-semibold text-amber-900">New API key for {newKey.code}</p>
            <p className="mt-2 break-all font-mono text-xs text-amber-950">{newKey.apiKey}</p>
            <p className="mt-2 text-amber-800">Copy this now — it will not be shown again.</p>
            <button type="button" className="mt-3 text-brand hover:underline" onClick={() => setNewKey(null)}>
              Dismiss
            </button>
          </div>
        )}

        {loading && <p className="mt-8 text-sm text-gray-500">Loading partner channels…</p>}

        {!loading && (
          <div className="mt-8 space-y-4">
            {channels.map((channel) => (
              <div key={channel.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-charcoal">{channel.name}</h2>
                    <p className="text-sm text-gray-500">Code: {channel.code}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Key prefix: {channel.apiKeyPrefix}… · {channel._count.bookings} bookings
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      System user: {channel.systemUser.email}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      channel.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {channel.isActive ? 'Active' : 'Disabled'}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    disabled={busyId === channel.id}
                    onClick={() => toggleActive(channel)}
                  >
                    {channel.isActive ? 'Disable channel' : 'Enable channel'}
                  </button>
                  <button
                    type="button"
                    className="btn-primary text-sm"
                    disabled={busyId === channel.id}
                    onClick={() => rotateKey(channel)}
                  >
                    Rotate API key
                  </button>
                </div>

                <div className="mt-5 border-t border-gray-100 pt-4">
                  <label className="text-sm font-medium text-charcoal" htmlFor={`webhook-${channel.id}`}>
                    Inventory webhook URL
                  </label>
                  <p className="mt-1 text-xs text-gray-500">
                    POST notifications when seats are booked/released on your website, agents, or another
                    channel. See docs/partner-api.md § Webhooks.
                  </p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input
                      id={`webhook-${channel.id}`}
                      type="url"
                      className="input flex-1 font-mono text-xs"
                      placeholder="https://partner.example.com/shivasakti/inventory"
                      value={webhookDrafts[channel.id] ?? ''}
                      onChange={(e) =>
                        setWebhookDrafts((prev) => ({ ...prev, [channel.id]: e.target.value }))
                      }
                    />
                    <button
                      type="button"
                      className="btn-secondary text-sm"
                      disabled={busyId === channel.id}
                      onClick={() => saveWebhook(channel)}
                    >
                      Save URL
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-sm"
                      disabled={busyId === channel.id || !channel.webhookUrl}
                      onClick={() => sendTestWebhook(channel)}
                    >
                      Send test
                    </button>
                  </div>
                  {channel.webhookUrl && (
                    <p className="mt-2 text-xs text-gray-500">
                      Active: <span className="font-mono">{channel.webhookUrl}</span>
                    </p>
                  )}
                </div>

                <p className="mt-4 text-xs text-gray-500">
                  Base URL:{' '}
                  <span className="font-mono">
                    {(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1')}/partner/v1
                  </span>
                </p>
              </div>
            ))}

            {channels.length === 0 && (
              <p className="text-sm text-gray-500">
                No partner channels yet. Run <code className="rounded bg-gray-100 px-1">npm run db:seed</code>{' '}
                in the API app to create RedBus and AbhiBus channels.
              </p>
            )}
          </div>
        )}

        <div className="mt-10 card">
          <h2 className="font-semibold text-charcoal">Integration flow</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gray-700">
            <li>Search trips — same inventory as shivasakti.in</li>
            <li>Fetch seat map for boarding/dropping sequences</li>
            <li>Lock seats (hold ~10 minutes)</li>
            <li>Confirm with your unique partnerReference (idempotent)</li>
            <li>Cancel via partnerReference when the passenger cancels on your platform</li>
            <li>Subscribe to inventory webhooks for real-time seat updates from other channels</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
