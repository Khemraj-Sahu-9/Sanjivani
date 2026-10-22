/**
 * frontend/src/features/emergency/LiveTestPreflightModal.tsx
 *
 * Feature D — Live Test Preflight Screen:
 * - Mandatory confirmation before outbound dispatch
 * - Masked recipient verification
 * - Exact outgoing SMS text / Voice script preview
 * - Server-controlled provider diagnostics & safety checks
 */

import React, { useState, useEffect } from 'react';
import { liveTestApiService } from '../../services/liveTestService';
import {
  LiveTestPreflightResponse,
  LiveTestDispatchResult,
} from '../../types/liveTest';

interface LiveTestPreflightModalProps {
  familyId: string;
  incidentId: string;
  onClose: () => void;
  onDispatched: (result: LiveTestDispatchResult) => void;
}

export const LiveTestPreflightModal: React.FC<LiveTestPreflightModalProps> = ({
  familyId,
  incidentId,
  onClose,
  onDispatched,
}) => {
  const [preflight, setPreflight] = useState<LiveTestPreflightResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form selections
  const [selectedChannel, setSelectedChannel] = useState<'SMS' | 'VOICE'>('SMS');
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [operatorConfirmed, setOperatorConfirmed] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  useEffect(() => {
    const fetchPreflight = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await liveTestApiService.getPreflight(familyId, incidentId);
        if (res.data?.preflight) {
          setPreflight(res.data.preflight);
          // By default, select all eligible recipients up to the max safety limit
          const eligible = res.data.preflight.eligibleRecipients || [];
          const max = res.data.preflight.providerHealth?.maxRecipients || 3;
          setSelectedRecipientIds(eligible.slice(0, max).map((r) => r.id));
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to generate preflight preview');
      } finally {
        setLoading(false);
      }
    };

    fetchPreflight();
  }, [familyId, incidentId]);

  const handleToggleRecipient = (id: string) => {
    if (selectedRecipientIds.includes(id)) {
      setSelectedRecipientIds(selectedRecipientIds.filter((rId) => rId !== id));
    } else {
      const max = preflight?.providerHealth?.maxRecipients || 3;
      if (selectedRecipientIds.length >= max) {
        setError(`You can select at most ${max} recipients per test dispatch.`);
        return;
      }
      setSelectedRecipientIds([...selectedRecipientIds, id]);
    }
  };

  const handleConfirmDispatch = async () => {
    if (!operatorConfirmed) {
      setError('You must check the confirmation box before proceeding.');
      return;
    }
    if (selectedRecipientIds.length === 0) {
      setError('Please select at least one eligible recipient.');
      return;
    }

    setDispatching(true);
    setError(null);

    try {
      const res = await liveTestApiService.dispatchLiveTest(familyId, {
        incidentId,
        recipientIds: selectedRecipientIds,
        channel: selectedChannel,
        operatorConfirmed: true,
        idempotencyKey: `client-${Date.now()}`,
      });

      if (res.data?.result) {
        onDispatched(res.data.result);
        onClose();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Live dispatch failed');
      setDispatching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto border-2 border-red-500">
        {/* Banner */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <span className="bg-white/20 text-white text-xs px-2.5 py-0.5 rounded font-mono font-bold tracking-wider uppercase">
              Preflight Inspection
            </span>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 p-1.5 rounded-lg text-lg font-bold"
            >
              ✕
            </button>
          </div>
          <h2 className="text-xl font-black mt-2 tracking-tight">LIVE TEST MODE DISPATCH</h2>
          <p className="text-xs text-rose-100 font-semibold mt-1">
            REAL TEST COMMUNICATION TO APPROVED RECIPIENTS; REMAINING ESCALATION IS SIMULATED.
          </p>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 p-3 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              Analyzing provider status, credentials, and allowlisted recipients...
            </div>
          ) : !preflight ? (
            <div className="text-center py-8 text-red-600 text-sm">
              Unable to load preflight information.
            </div>
          ) : (
            <>
              {/* Context metadata */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-gray-500 block">Incident Number:</span>
                  <span className="font-mono font-bold text-gray-800">{incidentId.slice(0, 13)}...</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Target Patient:</span>
                  <span className="font-bold text-gray-800">{preflight.patientName}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Active Telephony Provider:</span>
                  <span className="font-semibold text-blue-700 uppercase">
                    {preflight.providerHealth.provider} ({preflight.providerHealth.isConfigured ? 'Ready' : 'Not Configured'})
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block">Safety Recipient Cap:</span>
                  <span className="font-semibold text-gray-800">
                    Max {preflight.providerHealth.maxRecipients} recipients / dispatch
                  </span>
                </div>
              </div>

              {/* Channel Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Select Communication Channel
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`border rounded-lg p-3 flex items-center gap-3 cursor-pointer transition-colors ${
                      selectedChannel === 'SMS'
                        ? 'border-red-500 bg-red-50/50 text-red-900 ring-2 ring-red-400'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="channel"
                      value="SMS"
                      checked={selectedChannel === 'SMS'}
                      onChange={() => setSelectedChannel('SMS')}
                      className="text-red-600 focus:ring-red-500"
                    />
                    <div>
                      <div className="font-bold text-sm">Real Test SMS</div>
                      <div className="text-xs text-gray-500">Sends labelled SMS alert</div>
                    </div>
                  </label>

                  <label
                    className={`border rounded-lg p-3 flex items-center gap-3 cursor-pointer transition-colors ${
                      selectedChannel === 'VOICE'
                        ? 'border-red-500 bg-red-50/50 text-red-900 ring-2 ring-red-400'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="channel"
                      value="VOICE"
                      checked={selectedChannel === 'VOICE'}
                      onChange={() => setSelectedChannel('VOICE')}
                      className="text-red-600 focus:ring-red-500"
                    />
                    <div>
                      <div className="font-bold text-sm">Automated Voice Call</div>
                      <div className="text-xs text-gray-500">Places automated demo call</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Exact Preview Screen */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Exact Outgoing Payload Preview ({selectedChannel})
                </label>
                <div className="bg-slate-900 text-slate-100 font-mono text-xs p-3.5 rounded-lg border border-slate-700 whitespace-pre-wrap">
                  {selectedChannel === 'SMS' ? preflight.smsPreviewText : preflight.voicePreviewScript}
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Notice: Contains only synthetic test details. Clinical medical records and PHI are never broadcast.
                </p>
              </div>

              {/* Recipient Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Select Intended Allowlisted Recipients
                </label>
                {preflight.eligibleRecipients.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-800">
                    No eligible verified recipients with active consent found for this workspace. Use the &quot;Manage Test Recipients&quot; screen to onboard team members first.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {preflight.eligibleRecipients.map((r) => (
                      <label
                        key={r.id}
                        className="flex items-center justify-between p-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={selectedRecipientIds.includes(r.id)}
                            onChange={() => handleToggleRecipient(r.id)}
                            className="rounded text-red-600 focus:ring-red-500"
                          />
                          <span className="font-bold text-gray-800">{r.displayName}</span>
                          <span className="font-mono text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200">
                            {r.maskedPhone}
                          </span>
                        </div>
                        <span className="text-[11px] text-green-700 font-semibold bg-green-50 px-2 py-0.5 rounded border border-green-200">
                          {r.verificationStatus} • {r.consentStatus === 'CONSENT_GRANTED' ? 'Consented' : 'No Consent'}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {preflight.ineligibleRecipients.length > 0 && (
                  <div className="mt-3">
                    <span className="text-[11px] text-gray-500 font-semibold block mb-1">
                      Ineligible Team Members ({preflight.ineligibleRecipients.length}):
                    </span>
                    <div className="space-y-1 text-xs">
                      {preflight.ineligibleRecipients.map((ir) => (
                        <div key={ir.id} className="text-gray-500 text-[11px] flex items-center justify-between bg-red-50/40 p-1.5 rounded">
                          <span>{ir.displayName}</span>
                          <span className="text-red-700 italic">{ir.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Operator Mandatory Confirmation */}
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                <label className="flex items-start gap-2.5 text-xs text-red-950 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={operatorConfirmed}
                    onChange={(e) => setOperatorConfirmed(e.target.checked)}
                    className="mt-0.5 rounded text-red-600 focus:ring-red-500"
                  />
                  <span>
                    <strong>MANDATORY PREFLIGHT AUTHORIZATION:</strong> I explicitly confirm that I am an authorized demonstration operator. I understand this will dispatch a real {selectedChannel} message to the selected {selectedRecipientIds.length} team member(s), and that all remaining caregiver escalation and hospital handoff workflows remain simulated.
                  </span>
                </label>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-between items-center border-t rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            disabled={dispatching}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Cancel (Send Nothing)
          </button>

          <button
            type="button"
            onClick={handleConfirmDispatch}
            disabled={dispatching || !operatorConfirmed || selectedRecipientIds.length === 0}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition-all"
          >
            {dispatching ? 'Dispatching Test...' : `Confirm & Send Test ${selectedChannel}`}
          </button>
        </div>
      </div>
    </div>
  );
};
