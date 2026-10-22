/**
 * backend/src/integrations/hospital/hospitalReceivingInterface.ts
 *
 * Pluggable interface for Hospital Emergency Receiving Gateway integration.
 * In accordance with Section 5 of AGENTS.md, all external communication
 * must go through interface adapters so live and simulated modes can be cleanly swapped.
 */

import { HospitalHandoffPacket, HospitalTransmissionResult, HospitalGatewayStatus } from './types.js';

export interface IHospitalReceivingAdapter {
  /**
   * Transmits a standardized emergency handoff packet to an emergency department.
   */
  transmitEmergencyHandoff(packet: HospitalHandoffPacket): Promise<HospitalTransmissionResult>;

  /**
   * Performs an active health check or connectivity ping against the receiving gateway.
   */
  checkGatewayHealth(): Promise<HospitalGatewayStatus>;

  /**
   * Returns whether the adapter operates in live or simulated demo mode.
   */
  getMode(): 'simulated' | 'live';
}
