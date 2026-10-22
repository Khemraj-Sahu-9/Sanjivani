/**
 * frontend/src/features/emergency/LiveTestComponents.test.tsx
 *
 * Frontend test suite for Phase 6 Live Test Mode:
 * - Recipient management & consent tracking
 * - Preflight confirmation modal with operator authorization
 * - Provenance tracking badges (LIVE_PROVIDER vs SIMULATED)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LiveTestRecipientManager } from './LiveTestRecipientManager';
import { LiveTestPreflightModal } from './LiveTestPreflightModal';
import { liveTestApiService } from '../../services/liveTestService';

vi.mock('../../services/liveTestService', () => ({
  liveTestApiService: {
    listRecipients: vi.fn(),
    addRecipient: vi.fn(),
    verifyRecipient: vi.fn(),
    updateConsent: vi.fn(),
    deleteRecipient: vi.fn(),
    getPreflight: vi.fn(),
    dispatchLiveTest: vi.fn(),
    recordHumanAcknowledgement: vi.fn(),
    listAuditLogs: vi.fn(),
    getProviderHealth: vi.fn(),
  },
}));

describe('Phase 6 — Frontend Live Test Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('LiveTestRecipientManager', () => {
    it('renders allowlisted team members with verification and consent status', async () => {
      vi.mocked(liveTestApiService.listRecipients).mockResolvedValueOnce({
        status: 200,
        data: {
          recipients: [
            {
              id: 'rec-1',
              family_id: 'fam-1',
              display_name: 'Dr. Vikram Sarabhai',
              phone_number: '+919876543210',
              permitted_channel: 'BOTH',
              verification_status: 'VERIFIED',
              consent_status: 'CONSENT_GRANTED',
              consent_recorded_at: '2026-10-22T00:00:00Z',
              consent_notes: 'Consented for live review',
              is_active: true,
              allowed_purpose: 'Hackathon Review',
              created_at: '2026-10-22T00:00:00Z',
              updated_at: '2026-10-22T00:00:00Z',
            },
          ],
        },
      } as any);

      render(<LiveTestRecipientManager familyId="fam-1" onClose={vi.fn()} />);

      expect(await screen.findByText('Live Test Recipients & Allowlist')).toBeInTheDocument();
      expect(screen.getByText('Dr. Vikram Sarabhai')).toBeInTheDocument();
      expect(screen.getByText('+919876543210')).toBeInTheDocument();
      expect(screen.getByText(/Verification: VERIFIED/)).toBeInTheDocument();
      expect(screen.getByText(/Consent: Active/)).toBeInTheDocument();
    });

    it('requires explicit consent checkbox before registering a recipient', async () => {
      vi.mocked(liveTestApiService.listRecipients).mockResolvedValueOnce({
        status: 200,
        data: { recipients: [] },
      } as any);

      render(<LiveTestRecipientManager familyId="fam-1" onClose={vi.fn()} />);

      const addBtn = await screen.findByText('+ Add Consenting Member');
      fireEvent.click(addBtn);

      const nameInput = screen.getByPlaceholderText(/e.g. Khemraj Sahu/i);
      fireEvent.change(nameInput, { target: { value: 'New Team Lead' } });

      const submitBtn = screen.getByText('Save & Verify Member');
      fireEvent.click(submitBtn);

      // Error must trigger because consent was not confirmed
      expect(await screen.findByText(/explicit consent to receive demonstration alerts/i)).toBeInTheDocument();
      expect(liveTestApiService.addRecipient).not.toHaveBeenCalled();
    });
  });

  describe('LiveTestPreflightModal', () => {
    const mockPreflightData = {
      incidentId: 'inc-999-uuid',
      patientName: 'Khemraj Sahu (Critical Demo)',
      healthId: 'SNJ-2026-9999-0001',
      liveModeWarning: 'LIVE TEST MODE — REAL TEST COMMUNICATION TO APPROVED RECIPIENTS',
      simulatedEscalationNotice: 'Caregiver escalation, hospital handoff, and emergency services are 100% simulated.',
      providerHealth: {
        provider: 'mock',
        isConfigured: true,
        liveTestModeEnabled: true,
        supportedChannels: ['SMS', 'VOICE'],
        maxRecipients: 3,
        cooldownSeconds: 30,
        statusMessage: 'Mock Provider Ready',
      },
      eligibleRecipients: [
        {
          id: 'rec-1',
          displayName: 'Antigravity Engineer',
          maskedPhone: '+91 98*** **210',
          permittedChannel: 'BOTH',
          verificationStatus: 'VERIFIED',
          consentStatus: 'CONSENT_GRANTED',
        },
      ],
      ineligibleRecipients: [],
      smsPreviewText: 'TEST ALERT — Sanjivani Health Memory Agent product demonstration for Khemraj Sahu. This is not a real emergency.',
      voicePreviewScript: 'This is a Health Memory Agent product demonstration. This is a test call, not a real emergency.',
    };

    it('renders preflight screen with masked details, exact message preview, and disables confirm until operator authorizes', async () => {
      vi.mocked(liveTestApiService.getPreflight).mockResolvedValueOnce({
        status: 200,
        data: { preflight: mockPreflightData },
      } as any);

      render(
        <LiveTestPreflightModal
          familyId="fam-1"
          incidentId="inc-999-uuid"
          onClose={vi.fn()}
          onDispatched={vi.fn()}
        />
      );

      expect(await screen.findByText('LIVE TEST MODE DISPATCH')).toBeInTheDocument();
      expect(screen.getByText('Antigravity Engineer')).toBeInTheDocument();
      expect(screen.getByText('+91 98*** **210')).toBeInTheDocument();
      expect(screen.getByText(mockPreflightData.smsPreviewText)).toBeInTheDocument();

      // Confirm button should initially be disabled until checkbox is checked
      const confirmBtn = screen.getByRole('button', { name: /Confirm & Send Test SMS/i });
      expect(confirmBtn).toBeDisabled();

      // Check mandatory confirmation checkbox
      const checkbox = screen.getByRole('checkbox', { name: /MANDATORY PREFLIGHT AUTHORIZATION/i });
      fireEvent.click(checkbox);

      expect(confirmBtn).not.toBeDisabled();
    });

    it('dispatches live test with operatorConfirmed=true when confirmed', async () => {
      vi.mocked(liveTestApiService.getPreflight).mockResolvedValueOnce({
        status: 200,
        data: { preflight: mockPreflightData },
      } as any);

      vi.mocked(liveTestApiService.dispatchLiveTest).mockResolvedValueOnce({
        status: 200,
        data: {
          result: {
            incidentId: 'inc-999-uuid',
            channel: 'SMS',
            providerName: 'mock',
            dispatchedCount: 1,
            failedCount: 0,
            results: [],
            simulationNotice: 'Caregiver escalation remains simulated.',
          },
        },
      } as any);

      const onDispatched = vi.fn();
      const onClose = vi.fn();

      render(
        <LiveTestPreflightModal
          familyId="fam-1"
          incidentId="inc-999-uuid"
          onClose={onClose}
          onDispatched={onDispatched}
        />
      );

      await screen.findByText('LIVE TEST MODE DISPATCH');

      const checkbox = screen.getByRole('checkbox', { name: /MANDATORY PREFLIGHT AUTHORIZATION/i });
      fireEvent.click(checkbox);

      const confirmBtn = screen.getByRole('button', { name: /Confirm & Send Test SMS/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(liveTestApiService.dispatchLiveTest).toHaveBeenCalledWith(
          'fam-1',
          expect.objectContaining({
            incidentId: 'inc-999-uuid',
            channel: 'SMS',
            operatorConfirmed: true,
            recipientIds: ['rec-1'],
          })
        );
      });

      expect(onDispatched).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});
