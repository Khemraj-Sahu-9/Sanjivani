/**
 * frontend/src/features/emergency/LiveTestRecipientManager.tsx
 *
 * Controlled Team Recipient Management for Phase 6 Live Test Mode:
 * - Verified allowlist of team members
 * - Explicit consent tracking and revocation
 * - Phone number validation (E.164)
 */

import React, { useState, useEffect } from 'react';
import { liveTestApiService } from '../../services/liveTestService';
import { LiveTestRecipient, LiveTestChannel } from '../../types/liveTest';

interface LiveTestRecipientManagerProps {
  familyId: string;
  onClose: () => void;
}

export const LiveTestRecipientManager: React.FC<LiveTestRecipientManagerProps> = ({
  familyId,
  onClose,
}) => {
  const [recipients, setRecipients] = useState<LiveTestRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('+91');
  const [permittedChannel, setPermittedChannel] = useState<LiveTestChannel>('BOTH');
  const [allowedPurpose, setAllowedPurpose] = useState('HMA Hackathon Demonstration & Testing');
  const [consentGranted, setConsentGranted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchRecipients = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await liveTestApiService.listRecipients(familyId);
      if (res.data?.recipients) {
        setRecipients(res.data.recipients);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load recipients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipients();
  }, [familyId]);

  const handleAddRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentGranted) {
      setError('You must confirm that this team member has given explicit consent to receive demonstration alerts.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await liveTestApiService.addRecipient(familyId, {
        displayName,
        phoneNumber,
        permittedChannel,
        allowedPurpose,
        verified: true, // Auto-mark verified for admin onboarding in demo
        consentNotes: 'Explicit consent granted during team setup',
      });

      if (res.data?.recipient) {
        setSuccessMsg(`Recipient "${displayName}" added and verified successfully!`);
        setShowAddForm(false);
        setDisplayName('');
        setPhoneNumber('+91');
        setConsentGranted(false);
        await fetchRecipients();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to register recipient');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleConsent = async (r: LiveTestRecipient) => {
    const newStatus = r.consent_status === 'CONSENT_GRANTED' ? 'CONSENT_REVOKED' : 'CONSENT_GRANTED';
    try {
      await liveTestApiService.updateConsent(familyId, r.id, newStatus, `Operator toggled consent to ${newStatus}`);
      await fetchRecipients();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update consent');
    }
  };

  const handleVerify = async (r: LiveTestRecipient) => {
    try {
      await liveTestApiService.verifyRecipient(familyId, r.id, 'VERIFIED', 'Verified by team operator');
      await fetchRecipients();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to verify recipient');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await liveTestApiService.deleteRecipient(familyId, id);
      await fetchRecipients();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete recipient');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-amber-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white p-6 flex justify-between items-center rounded-t-xl">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-amber-900/60 text-amber-200 text-xs px-2 py-0.5 rounded font-mono uppercase tracking-wider font-bold">
                Phase 6 Safety Control
              </span>
              <h2 className="text-xl font-bold">Live Test Recipients & Allowlist</h2>
            </div>
            <p className="text-sm text-amber-100 mt-1">
              Strictly restrict real test SMS & automated voice calls to consenting team members only.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-amber-800 p-2 rounded-lg text-lg font-bold"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Important Security Banner */}
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded text-xs text-amber-900 space-y-1">
            <p className="font-bold">⚠️ STRICT SERVER-SIDE ENFORCEMENT RULES:</p>
            <ul className="list-disc pl-5 space-y-0.5">
              <li>Emergency numbers (112, 911, 100) are blocked with zero exceptions.</li>
              <li>Fictional demo contacts (e.g. <code>+91-98765-XXXXX</code>) cannot receive real calls or SMS.</li>
              <li>Revoking consent immediately prohibits all subsequent outbound dispatches.</li>
              <li>Outgoing alerts contain only safe test notices without private clinical details.</li>
            </ul>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-sm">
              {successMsg}
            </div>
          )}

          {/* Action Bar */}
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-gray-800">
              Registered Team Members ({recipients.length})
            </h3>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {showAddForm ? 'Cancel' : '+ Add Consenting Member'}
            </button>
          </div>

          {/* Add Recipient Form */}
          {showAddForm && (
            <form onSubmit={handleAddRecipient} className="bg-gray-50 border border-gray-200 rounded-lg p-5 space-y-4">
              <h4 className="font-bold text-sm text-gray-700">Add Consenting Team Member</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Khemraj Sahu (Lead)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Phone Number (E.164 Normalized)
                  </label>
                  <input
                    type="text"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+919876543210"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Permitted Channels</label>
                  <select
                    value={permittedChannel}
                    onChange={(e) => setPermittedChannel(e.target.value as LiveTestChannel)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="BOTH">Both SMS & Automated Voice Call</option>
                    <option value="SMS">SMS Only</option>
                    <option value="VOICE">Automated Voice Call Only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Testing Purpose</label>
                  <input
                    type="text"
                    value={allowedPurpose}
                    onChange={(e) => setAllowedPurpose(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="bg-amber-100/60 p-3 rounded-lg border border-amber-200">
                <label className="flex items-start gap-2 text-xs text-amber-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentGranted}
                    onChange={(e) => setConsentGranted(e.target.checked)}
                    className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span>
                    <strong>Explicit Consent Agreement:</strong> I confirm this team member has explicitly agreed to receive demonstration test communications, understands calls/messages are tests and not real emergencies, and controls this physical telephone.
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold"
                >
                  {submitting ? 'Registering...' : 'Save & Verify Member'}
                </button>
              </div>
            </form>
          )}

          {/* Recipients List */}
          {loading ? (
            <div className="text-center py-8 text-gray-500 text-sm">Loading recipients...</div>
          ) : recipients.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-500 text-sm">
              No team members registered yet. Add at least one consenting member to enable Live Test Mode dispatches.
            </div>
          ) : (
            <div className="space-y-3">
              {recipients.map((r) => (
                <div
                  key={r.id}
                  className={`border rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                    r.consent_status === 'CONSENT_GRANTED' && r.verification_status === 'VERIFIED'
                      ? 'border-gray-200 bg-white'
                      : 'border-red-200 bg-red-50/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-800">{r.display_name}</span>
                      <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                        {r.phone_number}
                      </span>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-medium">
                        {r.permitted_channel}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                      <span>Purpose: {r.allowed_purpose}</span>
                      <span>•</span>
                      <span
                        className={`font-semibold ${
                          r.verification_status === 'VERIFIED' ? 'text-green-700' : 'text-amber-700'
                        }`}
                      >
                        Verification: {r.verification_status}
                      </span>
                      <span>•</span>
                      <span
                        className={`font-semibold ${
                          r.consent_status === 'CONSENT_GRANTED' ? 'text-green-700' : 'text-red-700'
                        }`}
                      >
                        Consent: {r.consent_status === 'CONSENT_GRANTED' ? 'Active' : 'REVOKED'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {r.verification_status !== 'VERIFIED' && (
                      <button
                        onClick={() => handleVerify(r)}
                        className="px-2.5 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded font-medium"
                      >
                        Verify
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleConsent(r)}
                      className={`px-2.5 py-1 text-xs rounded font-medium border ${
                        r.consent_status === 'CONSENT_GRANTED'
                          ? 'border-red-300 text-red-700 hover:bg-red-50'
                          : 'border-green-300 text-green-700 hover:bg-green-50'
                      }`}
                    >
                      {r.consent_status === 'CONSENT_GRANTED' ? 'Revoke Consent' : 'Grant Consent'}
                    </button>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-100 rounded"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end border-t rounded-b-xl">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-sm font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
