/* global AbortController */
/**
 * backend/src/integrations/hospital/hospitalReceivingAdapter.ts
 *
 * Production driver for live hospital emergency receiving gateways.
 * Connects to an external HL7/FHIR or REST emergency intake portal.
 */

import crypto from 'crypto';
import { IHospitalReceivingAdapter } from './hospitalReceivingInterface.js';
import { HospitalHandoffPacket, HospitalTransmissionResult, HospitalGatewayStatus } from './types.js';

export interface HospitalAdapterConfig {
  gatewayUrl: string;
  apiKey?: string;
  timeoutMs?: number;
  hospitalName?: string;
}

export class HospitalReceivingAdapter implements IHospitalReceivingAdapter {
  private config: HospitalAdapterConfig;

  constructor(config: HospitalAdapterConfig) {
    this.config = {
      timeoutMs: 8000,
      hospitalName: 'Regional Emergency Medical Network',
      ...config,
    };
  }

  getMode(): 'simulated' | 'live' {
    return 'live';
  }

  async transmitEmergencyHandoff(packet: HospitalHandoffPacket): Promise<HospitalTransmissionResult> {
    const timestamp = new Date().toISOString();

    if (!this.config.gatewayUrl || this.config.gatewayUrl.trim() === '') {
      return {
        success: false,
        transmissionId: `ERR-NO-URL-${Date.now()}`,
        mode: 'live',
        destinationHospital: this.config.hospitalName || 'Unknown Hospital',
        department: 'Emergency Intake',
        timestamp,
        queueStatus: 'RECEIVED',
        auditHash: '',
        errorMessage: 'Hospital receiving gateway URL is not configured.',
        fallbackTriggered: true,
      };
    }

    const payload = JSON.stringify({
      resourceType: 'EmergencyHandoffPacket',
      incidentId: packet.incidentId,
      patient: {
        healthId: packet.patientHealthId,
        name: packet.patientName,
        age: packet.age,
        gender: packet.gender,
        bloodGroup: packet.bloodGroup,
      },
      clinicalSummary: {
        allergies: packet.allergies,
        activeConditions: packet.activeConditions,
        currentMedications: packet.currentMedications,
      },
      contacts: packet.emergencyContacts,
      location: packet.location,
      triggerTimestamp: packet.triggerTimestamp,
      disclaimer: packet.disclaimer,
    });

    const rawPayloadHash = `${packet.incidentId}:${packet.patientHealthId}:${timestamp}`;
    const auditHash = crypto.createHash('sha256').update(rawPayloadHash).digest('hex');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Sanjivani-Handoff-Version': '1.0',
        'X-Sanjivani-Audit-Hash': auditHash,
      };

      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }

      const response = await fetch(this.config.gatewayUrl, {
        method: 'POST',
        headers,
        body: payload,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown HTTP error');
        return {
          success: false,
          transmissionId: `HTTP-${response.status}-${Date.now()}`,
          mode: 'live',
          destinationHospital: this.config.hospitalName || 'External Emergency Gateway',
          department: 'Emergency Intake',
          timestamp,
          queueStatus: 'RECEIVED',
          auditHash,
          errorMessage: `Gateway responded with HTTP ${response.status}: ${errorText}`,
          fallbackTriggered: true,
        };
      }

      const responseData = (await response.json().catch(() => ({}))) as any;

      return {
        success: true,
        transmissionId: responseData.transmissionId || `LIVE-TX-${Date.now()}`,
        mode: 'live',
        destinationHospital: responseData.destinationHospital || this.config.hospitalName || 'External Emergency Gateway',
        acknowledgedBy: responseData.acknowledgedBy || 'ED Triage Gateway System',
        department: responseData.department || 'Emergency Medicine',
        timestamp,
        queueStatus: responseData.queueStatus || 'RECEIVED',
        auditHash,
        fallbackTriggered: false,
      };
    } catch (err: any) {
      const isTimeout = err?.name === 'AbortError';
      const errorMessage = isTimeout
        ? `Connection to hospital gateway timed out after ${this.config.timeoutMs}ms`
        : `Network exception during hospital handoff transmission: ${err?.message || 'Unknown network error'}`;

      return {
        success: false,
        transmissionId: `ERR-NET-${Date.now()}`,
        mode: 'live',
        destinationHospital: this.config.hospitalName || 'External Emergency Gateway',
        department: 'Emergency Intake',
        timestamp,
        queueStatus: 'RECEIVED',
        auditHash,
        errorMessage,
        fallbackTriggered: true,
      };
    }
  }

  async checkGatewayHealth(): Promise<HospitalGatewayStatus> {
    if (!this.config.gatewayUrl) {
      return {
        isConfigured: false,
        mode: 'live',
        endpoint: '',
        connected: false,
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const pingUrl = this.config.gatewayUrl.replace(/\/handoff\/?$/, '/health');

      const response = await fetch(pingUrl, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      return {
        isConfigured: true,
        mode: 'live',
        endpoint: this.config.gatewayUrl,
        connected: response.ok,
        lastHeartbeat: new Date().toISOString(),
      };
    } catch {
      return {
        isConfigured: true,
        mode: 'live',
        endpoint: this.config.gatewayUrl,
        connected: false,
      };
    }
  }
}
