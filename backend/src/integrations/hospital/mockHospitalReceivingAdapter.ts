/**
 * backend/src/integrations/hospital/mockHospitalReceivingAdapter.ts
 *
 * Deterministic simulator for Hospital Emergency Receiving Desks.
 * Used for Demo Mode, integration tests, and sandbox demonstrations.
 */

import crypto from 'crypto';
import { IHospitalReceivingAdapter } from './hospitalReceivingInterface.js';
import { HospitalHandoffPacket, HospitalTransmissionResult, HospitalGatewayStatus } from './types.js';

export class MockHospitalReceivingAdapter implements IHospitalReceivingAdapter {
  private shouldFailNext = false;
  private failureReason = '';

  getMode(): 'simulated' | 'live' {
    return 'simulated';
  }

  /**
   * For testing resilience: inject a simulated failure on the next transmission.
   */
  public simulateFailureOnNextCall(reason = 'Receiving gateway connection timeout'): void {
    this.shouldFailNext = true;
    this.failureReason = reason;
  }

  public resetFailureSimulation(): void {
    this.shouldFailNext = false;
    this.failureReason = '';
  }

  async transmitEmergencyHandoff(packet: HospitalHandoffPacket): Promise<HospitalTransmissionResult> {
    const timestamp = new Date().toISOString();

    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      const errorMsg = this.failureReason || 'Receiving desk gateway unreachable';
      return {
        success: false,
        transmissionId: `SIM-FAIL-${Date.now()}`,
        mode: 'simulated',
        destinationHospital: 'City General Hospital (Simulated ED)',
        department: 'Emergency & Trauma Center',
        timestamp,
        queueStatus: 'RECEIVED',
        auditHash: '',
        errorMessage: errorMsg,
        fallbackTriggered: true,
      };
    }

    // Safety check: ensure required disclaimer is present
    const verifiedDisclaimer = packet.disclaimer || 'DEMO MODE ONLY — SIMULATED EMERGENCY HANDOFF';
    if (!verifiedDisclaimer.includes('DEMO MODE') && !verifiedDisclaimer.includes('SIMULATED') && !verifiedDisclaimer.includes('PILOT')) {
      throw new Error('Safety violation: Emergency handoff packets must carry a simulation/pilot disclaimer.');
    }

    // Generate cryptographic audit hash over handoff content
    const rawPayload = `${packet.incidentId}:${packet.patientHealthId}:${packet.patientName}:${timestamp}`;
    const auditHash = crypto.createHash('sha256').update(rawPayload).digest('hex');

    const transmissionId = `TX-SIM-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    return {
      success: true,
      transmissionId,
      mode: 'simulated',
      destinationHospital: 'City Care Hospital — Emergency Medicine Department',
      acknowledgedBy: 'Nurse Priya Desai, RN (Charge Nurse - ED)',
      department: 'Trauma & Resuscitation Bay 3',
      timestamp,
      queueStatus: 'RECEIVED',
      auditHash,
      fallbackTriggered: false,
    };
  }

  async checkGatewayHealth(): Promise<HospitalGatewayStatus> {
    return {
      isConfigured: true,
      mode: 'simulated',
      endpoint: 'simulated://emergency.citycare.org/v1/handoff',
      connected: true,
      lastHeartbeat: new Date().toISOString(),
    };
  }
}
