/**
 * backend/src/integrations/hospital/types.ts
 *
 * Type definitions for Hospital Emergency Receiving Gateway integration.
 */

export interface HospitalHandoffPacket {
  incidentId: string;
  patientHealthId: string;
  patientName: string;
  age?: number;
  gender?: string;
  bloodGroup?: string;
  allergies: string[];
  activeConditions: string[];
  currentMedications: Array<{
    name: string;
    dosage: string;
    frequency?: string;
  }>;
  emergencyContacts: Array<{
    name: string;
    relationship: string;
    phone: string;
  }>;
  location?: {
    latitude: number;
    longitude: number;
    addressDescription?: string;
  };
  triggerTimestamp: string;
  disclaimer: string;
}

export interface HospitalTransmissionResult {
  success: boolean;
  transmissionId: string;
  mode: 'simulated' | 'live';
  destinationHospital: string;
  acknowledgedBy?: string;
  department: string;
  timestamp: string;
  queueStatus: 'RECEIVED' | 'TRIAGED' | 'EN_ROUTE_ADMISSION';
  auditHash: string;
  errorMessage?: string;
  fallbackTriggered: boolean;
}

export interface HospitalGatewayStatus {
  isConfigured: boolean;
  mode: 'simulated' | 'live';
  endpoint: string;
  connected: boolean;
  lastHeartbeat?: string;
}
