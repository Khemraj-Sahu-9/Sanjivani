/**
 * backend/src/services/syncService.ts
 *
 * Core synchronization engine for Phase 7 Offline-First Health Records.
 * Manages idempotent batch operations, server-side authorization revalidation,
 * optimistic concurrency diffing, conflict detection, discrete dose recording,
 * and authoritative delta retrieval.
 */

import { db } from '../repositories/database.js';
import { logger } from '../config/logger.js';
import {
  SyncOperationItem,
  SyncBatchResponse,
  SyncOperationResult,
  SyncConflict,
  SyncDeltaResponse,
  PatientProfile,
  MedicationSchedule,
  MedicationDoseOccurrence,
  DoseOccurrenceStatus,
  Appointment,
} from '../types/models.js';

export class SyncService {
  /**
   * Process a batch of queued client operations idempotently.
   */
  async processBatch(
    familyId: string,
    userId: string,
    operations: SyncOperationItem[]
  ): Promise<SyncBatchResponse> {
    // 1. Verify user membership in the target family workspace
    const membership = await db.getUserMembership(familyId, userId);
    if (!membership || membership.status !== 'active') {
      const err = new Error('Access denied. You are not an active member of this family workspace.');
      (err as unknown as { statusCode: number }).statusCode = 403;
      throw err;
    }

    const results: SyncOperationResult[] = [];

    for (const op of operations) {
      try {
        const result = await this.processSingleOperation(familyId, userId, op);
        results.push(result);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown synchronization error';
        logger.error(`[SyncService] Failed to process operation ${op.clientOperationId}:`, { error: message });

        // Record failure in sync operations
        await db.saveSyncOperation({
          family_id: familyId,
          patient_profile_id: op.patientProfileId || null,
          user_id: userId,
          client_operation_id: op.clientOperationId,
          idempotency_key: op.idempotencyKey,
          operation_type: op.operationType,
          payload: op.payload,
          base_revision: op.baseRevision || null,
          client_timestamp: op.clientTimestamp,
          server_received_at: new Date().toISOString(),
          status: 'failed',
          result_payload: null,
          error_category: 'server',
          error_message: message,
          retry_count: (op.retryCount || 0) + 1,
        });

        results.push({
          clientOperationId: op.clientOperationId,
          status: 'failed',
          errorCategory: 'server',
          errorMessage: message,
        });
      }
    }

    const pendingConflicts = await db.listSyncConflicts(familyId, undefined, 'pending');

    return {
      results,
      serverTimestamp: new Date().toISOString(),
      pendingConflictsCount: pendingConflicts.length,
    };
  }

  /**
   * Process a single queued operation with strict idempotency and validation.
   */
  private async processSingleOperation(
    familyId: string,
    userId: string,
    op: SyncOperationItem
  ): Promise<SyncOperationResult> {
    // 1. Check idempotency: if already processed, return cached outcome
    const existingByIdempotency = await db.getSyncOperationByIdempotencyKey(familyId, op.idempotencyKey);
    if (existingByIdempotency) {
      logger.info(`[SyncService] Idempotency match hit for key ${op.idempotencyKey}`);
      return {
        clientOperationId: op.clientOperationId,
        status: existingByIdempotency.status,
        resultPayload: existingByIdempotency.result_payload || undefined,
        errorCategory: existingByIdempotency.error_category || undefined,
        errorMessage: existingByIdempotency.error_message || undefined,
      };
    }

    const existingByClientOp = await db.getSyncOperationByClientOpId(familyId, op.clientOperationId);
    if (existingByClientOp) {
      logger.info(`[SyncService] Client operation ID match hit for ${op.clientOperationId}`);
      return {
        clientOperationId: op.clientOperationId,
        status: existingByClientOp.status,
        resultPayload: existingByClientOp.result_payload || undefined,
        errorCategory: existingByClientOp.error_category || undefined,
        errorMessage: existingByClientOp.error_message || undefined,
      };
    }

    // 2. Validate patient authorization if patientProfileId is provided
    if (op.patientProfileId) {
      const patient = await db.getPatientProfileById(op.patientProfileId);
      if (!patient || patient.family_id !== familyId || patient.status === 'archived') {
        await db.saveSyncOperation({
          family_id: familyId,
          patient_profile_id: op.patientProfileId,
          user_id: userId,
          client_operation_id: op.clientOperationId,
          idempotency_key: op.idempotencyKey,
          operation_type: op.operationType,
          payload: op.payload,
          base_revision: op.baseRevision || null,
          client_timestamp: op.clientTimestamp,
          server_received_at: new Date().toISOString(),
          status: 'failed',
          result_payload: null,
          error_category: 'auth',
          error_message: 'Patient profile does not exist or access has been revoked.',
          retry_count: 0,
        });

        return {
          clientOperationId: op.clientOperationId,
          status: 'failed',
          errorCategory: 'auth',
          errorMessage: 'Patient profile does not exist or access has been revoked.',
        };
      }
    }

    // 3. Dispatch operation by type
    switch (op.operationType) {
      case 'PATIENT_UPDATE':
        return this.handlePatientUpdate(familyId, userId, op);

      case 'APPOINTMENT_CREATE':
        return this.handleAppointmentCreate(familyId, userId, op);

      case 'APPOINTMENT_UPDATE':
        return this.handleAppointmentUpdate(familyId, userId, op);

      case 'MEDICATION_DOSE_RECORD':
        return this.handleMedicationDoseRecord(familyId, userId, op);

      case 'MEDICATION_SCHEDULE_CREATE':
        return this.handleMedicationScheduleCreate(familyId, userId, op);

      default: {
        const errorMsg = `Unsupported sync operation type: ${op.operationType}`;
        await db.saveSyncOperation({
          family_id: familyId,
          patient_profile_id: op.patientProfileId || null,
          user_id: userId,
          client_operation_id: op.clientOperationId,
          idempotency_key: op.idempotencyKey,
          operation_type: op.operationType,
          payload: op.payload,
          base_revision: op.baseRevision || null,
          client_timestamp: op.clientTimestamp,
          server_received_at: new Date().toISOString(),
          status: 'failed',
          result_payload: null,
          error_category: 'validation',
          error_message: errorMsg,
          retry_count: 0,
        });

        return {
          clientOperationId: op.clientOperationId,
          status: 'failed',
          errorCategory: 'validation',
          errorMessage: errorMsg,
        };
      }
    }
  }

  /**
   * Handle Patient Profile Update with optimistic concurrency diffing.
   */
  private async handlePatientUpdate(
    familyId: string,
    userId: string,
    op: SyncOperationItem
  ): Promise<SyncOperationResult> {
    const patientId = (op.payload.patientId as string) || op.patientProfileId;
    if (!patientId) {
      return this.recordFailure(familyId, userId, op, 'validation', 'Missing patientId in payload');
    }

    const currentPatient = await db.getPatientProfileById(patientId);
    if (!currentPatient || currentPatient.family_id !== familyId) {
      return this.recordFailure(familyId, userId, op, 'auth', 'Patient profile not found in family');
    }

    // Check for conflicting edits if baseRevision is provided
    if (op.baseRevision) {
      const serverUpdatedAt = new Date(currentPatient.updated_at).getTime();
      const clientBaseTime = new Date(op.baseRevision).getTime();

      if (serverUpdatedAt > clientBaseTime) {
        // Server record was updated since client took snapshot. Compare edited fields.
        const candidateUpdates = (op.payload.updates as Record<string, unknown>) || op.payload;
        const conflictingFields: string[] = [];

        for (const [key, localVal] of Object.entries(candidateUpdates)) {
          if (['id', 'created_at', 'updated_at', 'health_id', 'family_id'].includes(key)) continue;
          const serverVal = (currentPatient as unknown as Record<string, unknown>)[key];
          // If server value differs from local value
          if (serverVal !== undefined && serverVal !== localVal) {
            conflictingFields.push(key);
          }
        }

        if (conflictingFields.length > 0) {
          // Detected real conflict! Create a SyncConflict record and leave patient untouched
          const conflict = await db.createSyncConflict({
            family_id: familyId,
            patient_profile_id: patientId,
            client_operation_id: op.clientOperationId,
            entity_type: 'patient_profile',
            entity_id: patientId,
            field_name: conflictingFields.join(','),
            local_value: candidateUpdates,
            server_value: {
              full_name: currentPatient.full_name,
              relationship_to_creator: currentPatient.relationship_to_creator,
              category: currentPatient.category,
              date_of_birth: currentPatient.date_of_birth,
              gender: currentPatient.gender,
            },
            base_value: null,
            resolution_status: 'pending',
          });

          await db.saveSyncOperation({
            family_id: familyId,
            patient_profile_id: patientId,
            user_id: userId,
            client_operation_id: op.clientOperationId,
            idempotency_key: op.idempotencyKey,
            operation_type: op.operationType,
            payload: op.payload,
            base_revision: op.baseRevision,
            client_timestamp: op.clientTimestamp,
            server_received_at: new Date().toISOString(),
            status: 'conflict',
            result_payload: { conflictId: conflict.id },
            error_category: 'conflict',
            error_message: `Concurrent update detected on fields: ${conflictingFields.join(', ')}`,
            retry_count: 0,
          });

          return {
            clientOperationId: op.clientOperationId,
            status: 'conflict',
            errorCategory: 'conflict',
            errorMessage: `Concurrent update detected on fields: ${conflictingFields.join(', ')}`,
            conflict,
          };
        }
      }
    }

    // No conflict, safe to update
    const candidateUpdates = ((op.payload.updates as Record<string, unknown>) || op.payload) as Record<string, unknown>;
    const cleanUpdates: Partial<PatientProfile> = {};
    if (candidateUpdates.full_name || candidateUpdates.fullName) {
      cleanUpdates.full_name = (candidateUpdates.full_name || candidateUpdates.fullName) as string;
    }
    if (candidateUpdates.relationship_to_creator !== undefined || candidateUpdates.relationshipToCreator !== undefined) {
      cleanUpdates.relationship_to_creator = (candidateUpdates.relationship_to_creator !== undefined
        ? candidateUpdates.relationship_to_creator
        : candidateUpdates.relationshipToCreator) as string | null;
    }
    if (candidateUpdates.date_of_birth !== undefined || candidateUpdates.dateOfBirth !== undefined) {
      cleanUpdates.date_of_birth = (candidateUpdates.date_of_birth !== undefined
        ? candidateUpdates.date_of_birth
        : candidateUpdates.dateOfBirth) as string | null;
    }
    if (candidateUpdates.gender !== undefined) cleanUpdates.gender = candidateUpdates.gender as PatientProfile['gender'];
    if (candidateUpdates.category !== undefined) cleanUpdates.category = candidateUpdates.category as PatientProfile['category'];

    const updated = await db.updatePatientProfile(patientId, cleanUpdates);

    await db.saveSyncOperation({
      family_id: familyId,
      patient_profile_id: patientId,
      user_id: userId,
      client_operation_id: op.clientOperationId,
      idempotency_key: op.idempotencyKey,
      operation_type: op.operationType,
      payload: op.payload,
      base_revision: op.baseRevision || null,
      client_timestamp: op.clientTimestamp,
      server_received_at: new Date().toISOString(),
      status: 'synced',
      result_payload: updated as unknown as Record<string, unknown>,
      retry_count: 0,
    });

    return {
      clientOperationId: op.clientOperationId,
      status: 'synced',
      serverEntityId: updated.id,
      resultPayload: updated as unknown as Record<string, unknown>,
    };
  }

  /**
   * Handle Appointment Creation idempotently.
   */
  private async handleAppointmentCreate(
    familyId: string,
    userId: string,
    op: SyncOperationItem
  ): Promise<SyncOperationResult> {
    const { title, doctorName, specialty, location, scheduledAt, reason, notes, patientProfileId } =
      op.payload as {
        title: string;
        doctorName?: string;
        specialty?: string;
        location?: string;
        scheduledAt: string;
        reason?: string;
        notes?: string;
        patientProfileId: string;
      };

    if (!title || !scheduledAt || !patientProfileId) {
      return this.recordFailure(familyId, userId, op, 'validation', 'Title, scheduledAt, and patientProfileId are required');
    }

    // Check if duplicate appointment already exists for this patient at the exact same time
    const existingAppts = await db.listAppointmentsByPatient(patientProfileId);
    const duplicate = existingAppts.find(
      (a: Appointment) =>
        (a.appointment_datetime === scheduledAt || a.appointment_date === scheduledAt.split('T')[0]) &&
        a.title.toLowerCase().trim() === title.toLowerCase().trim() &&
        a.status !== 'cancelled'
    );

    if (duplicate) {
      // Idempotent success without creating double appointment
      await db.saveSyncOperation({
        family_id: familyId,
        patient_profile_id: patientProfileId,
        user_id: userId,
        client_operation_id: op.clientOperationId,
        idempotency_key: op.idempotencyKey,
        operation_type: op.operationType,
        payload: op.payload,
        base_revision: op.baseRevision || null,
        client_timestamp: op.clientTimestamp,
        server_received_at: new Date().toISOString(),
        status: 'synced',
        result_payload: duplicate as unknown as Record<string, unknown>,
        retry_count: 0,
      });

      return {
        clientOperationId: op.clientOperationId,
        status: 'synced',
        serverEntityId: duplicate.id,
        resultPayload: duplicate as unknown as Record<string, unknown>,
      };
    }

    const apptDate = scheduledAt.includes('T') ? scheduledAt.split('T')[0]! : scheduledAt;
    const apptTime = scheduledAt.includes('T') ? scheduledAt.split('T')[1]!.substring(0, 5) : '10:00';

    const appt = await db.createAppointment({
      family_id: familyId,
      patient_profile_id: patientProfileId,
      title,
      doctor_name: doctorName || null,
      facility_name: specialty || null,
      appointment_date: apptDate,
      appointment_time: apptTime,
      appointment_datetime: scheduledAt,
      timezone: 'Asia/Kolkata',
      location: location || null,
      notes: notes || reason || null,
      status: 'scheduled',
      created_by: userId,
    });

    await db.saveSyncOperation({
      family_id: familyId,
      patient_profile_id: patientProfileId,
      user_id: userId,
      client_operation_id: op.clientOperationId,
      idempotency_key: op.idempotencyKey,
      operation_type: op.operationType,
      payload: op.payload,
      base_revision: op.baseRevision || null,
      client_timestamp: op.clientTimestamp,
      server_received_at: new Date().toISOString(),
      status: 'synced',
      result_payload: appt as unknown as Record<string, unknown>,
      retry_count: 0,
    });

    return {
      clientOperationId: op.clientOperationId,
      status: 'synced',
      serverEntityId: appt.id,
      resultPayload: appt as unknown as Record<string, unknown>,
    };
  }

  /**
   * Handle Appointment Update with safeguard against reviving cancelled appointments.
   */
  private async handleAppointmentUpdate(
    familyId: string,
    userId: string,
    op: SyncOperationItem
  ): Promise<SyncOperationResult> {
    const appointmentId = (op.payload.appointmentId as string) || (op.payload.id as string);
    if (!appointmentId) {
      return this.recordFailure(familyId, userId, op, 'validation', 'Missing appointmentId');
    }

    const appt = await db.getAppointmentById(appointmentId);
    if (!appt || appt.family_id !== familyId) {
      return this.recordFailure(familyId, userId, op, 'validation', 'Appointment not found in family');
    }

    // Safeguard: Cannot update an appointment that has been cancelled on the server
    if (appt.status === 'cancelled') {
      return this.recordFailure(
        familyId,
        userId,
        op,
        'conflict',
        'Cannot update an appointment that has already been cancelled on the server'
      );
    }

    const updates = (op.payload.updates as Partial<Appointment>) || {};
    const updated = await db.updateAppointment(appointmentId, updates);

    await db.saveSyncOperation({
      family_id: familyId,
      patient_profile_id: appt.patient_profile_id,
      user_id: userId,
      client_operation_id: op.clientOperationId,
      idempotency_key: op.idempotencyKey,
      operation_type: op.operationType,
      payload: op.payload,
      base_revision: op.baseRevision || null,
      client_timestamp: op.clientTimestamp,
      server_received_at: new Date().toISOString(),
      status: 'synced',
      result_payload: updated as unknown as Record<string, unknown>,
      retry_count: 0,
    });

    return {
      clientOperationId: op.clientOperationId,
      status: 'synced',
      serverEntityId: updated.id,
      resultPayload: updated as unknown as Record<string, unknown>,
    };
  }

  /**
   * Handle Medication Dose Recording as discrete, timestamped events.
   */
  private async handleMedicationDoseRecord(
    familyId: string,
    userId: string,
    op: SyncOperationItem
  ): Promise<SyncOperationResult> {
    const { scheduleId, scheduledTime, status, notes, takenAt } = op.payload as {
      scheduleId: string;
      scheduledTime: string;
      status: 'taken' | 'skipped' | 'missed';
      notes?: string;
      takenAt?: string;
    };

    if (!scheduleId || !scheduledTime || !status) {
      return this.recordFailure(familyId, userId, op, 'validation', 'scheduleId, scheduledTime, and status are required');
    }

    const schedule = await db.getMedicationScheduleById(scheduleId);
    if (!schedule || schedule.family_id !== familyId) {
      return this.recordFailure(familyId, userId, op, 'auth', 'Medication schedule not found');
    }

    // Check if schedule is discontinued
    if (schedule.status === 'discontinued') {
      return this.recordFailure(
        familyId,
        userId,
        op,
        'conflict',
        'Cannot record dose for a discontinued medication schedule'
      );
    }

    // Look for existing dose occurrence for this scheduled_time
    const occurrences = await db.listDoseOccurrences(schedule.patient_profile_id, '1970-01-01', '2099-12-31');
    const existing = occurrences.find(
      (o: MedicationDoseOccurrence) => o.schedule_id === scheduleId && o.scheduled_time === scheduledTime
    );

    let doseResult;
    if (existing) {
      // If already recorded as taken, idempotent return
      if (existing.status === status && status === 'taken') {
        doseResult = existing;
      } else {
        doseResult = await db.updateDoseOccurrenceStatus(
          existing.id,
          status as DoseOccurrenceStatus,
          userId,
          notes || existing.acknowledgement_note || undefined
        );
      }
    } else {
      // Create dose occurrence
      const schedDate = scheduledTime.includes('T') ? scheduledTime.split('T')[0]! : new Date().toISOString().split('T')[0]!;
      const created = await db.createDoseOccurrences([
        {
          schedule_id: scheduleId,
          patient_profile_id: schedule.patient_profile_id,
          family_id: familyId,
          scheduled_date: schedDate,
          scheduled_time: scheduledTime,
          scheduled_datetime: scheduledTime,
          status: status as DoseOccurrenceStatus,
          dose_instruction: schedule.dosage_instruction,
          acknowledged_at: status === 'taken' ? (takenAt || op.clientTimestamp) : null,
          acknowledged_by: userId,
          acknowledgement_note: notes || null,
        },
      ]);
      doseResult = created[0];
    }

    await db.saveSyncOperation({
      family_id: familyId,
      patient_profile_id: schedule.patient_profile_id,
      user_id: userId,
      client_operation_id: op.clientOperationId,
      idempotency_key: op.idempotencyKey,
      operation_type: op.operationType,
      payload: op.payload,
      base_revision: op.baseRevision || null,
      client_timestamp: op.clientTimestamp,
      server_received_at: new Date().toISOString(),
      status: 'synced',
      result_payload: doseResult as unknown as Record<string, unknown>,
      retry_count: 0,
    });

    return {
      clientOperationId: op.clientOperationId,
      status: 'synced',
      serverEntityId: doseResult?.id,
      resultPayload: doseResult as unknown as Record<string, unknown>,
    };
  }

  /**
   * Handle Medication Schedule Creation.
   */
  private async handleMedicationScheduleCreate(
    familyId: string,
    userId: string,
    op: SyncOperationItem
  ): Promise<SyncOperationResult> {
    const { patientProfileId, medicationName, dosage, frequency, timesOfDay, startDate, endDate, instructions, prescribedBy } =
      op.payload as {
        patientProfileId: string;
        medicationName: string;
        dosage: string;
        frequency: string;
        timesOfDay: string[];
        startDate: string;
        endDate?: string;
        instructions?: string;
        prescribedBy?: string;
      };

    if (!patientProfileId || !medicationName || !dosage || !frequency || !startDate) {
      return this.recordFailure(familyId, userId, op, 'validation', 'Required medication schedule fields missing');
    }

    // Check for duplicate active schedule with same medication name
    const existingSchedules = await db.listMedicationSchedulesByPatient(patientProfileId, 'active');
    const duplicate = existingSchedules.find(
      (s: MedicationSchedule) =>
        s.medicine_name.toLowerCase().trim() === medicationName.toLowerCase().trim() &&
        s.start_date === startDate
    );

    if (duplicate) {
      await db.saveSyncOperation({
        family_id: familyId,
        patient_profile_id: patientProfileId,
        user_id: userId,
        client_operation_id: op.clientOperationId,
        idempotency_key: op.idempotencyKey,
        operation_type: op.operationType,
        payload: op.payload,
        base_revision: op.baseRevision || null,
        client_timestamp: op.clientTimestamp,
        server_received_at: new Date().toISOString(),
        status: 'synced',
        result_payload: duplicate as unknown as Record<string, unknown>,
        retry_count: 0,
      });

      return {
        clientOperationId: op.clientOperationId,
        status: 'synced',
        serverEntityId: duplicate.id,
        resultPayload: duplicate as unknown as Record<string, unknown>,
      };
    }

    const schedule = await db.createMedicationSchedule({
      family_id: familyId,
      patient_profile_id: patientProfileId,
      medicine_name: medicationName,
      dosage_instruction: dosage,
      frequency,
      scheduled_times: timesOfDay || ['09:00'],
      start_date: startDate,
      end_date: endDate || null,
      instructions: instructions || null,
      prescriber_name: prescribedBy || null,
      status: 'active',
      created_by: userId,
    });

    await db.saveSyncOperation({
      family_id: familyId,
      patient_profile_id: patientProfileId,
      user_id: userId,
      client_operation_id: op.clientOperationId,
      idempotency_key: op.idempotencyKey,
      operation_type: op.operationType,
      payload: op.payload,
      base_revision: op.baseRevision || null,
      client_timestamp: op.clientTimestamp,
      server_received_at: new Date().toISOString(),
      status: 'synced',
      result_payload: schedule as unknown as Record<string, unknown>,
      retry_count: 0,
    });

    return {
      clientOperationId: op.clientOperationId,
      status: 'synced',
      serverEntityId: schedule.id,
      resultPayload: schedule as unknown as Record<string, unknown>,
    };
  }

  /**
   * Helper to persist a failed operation record and return failure result.
   */
  private async recordFailure(
    familyId: string,
    userId: string,
    op: SyncOperationItem,
    category: 'auth' | 'validation' | 'conflict' | 'server',
    message: string
  ): Promise<SyncOperationResult> {
    await db.saveSyncOperation({
      family_id: familyId,
      patient_profile_id: op.patientProfileId || null,
      user_id: userId,
      client_operation_id: op.clientOperationId,
      idempotency_key: op.idempotencyKey,
      operation_type: op.operationType,
      payload: op.payload,
      base_revision: op.baseRevision || null,
      client_timestamp: op.clientTimestamp,
      server_received_at: new Date().toISOString(),
      status: 'failed',
      result_payload: null,
      error_category: category,
      error_message: message,
      retry_count: (op.retryCount || 0) + 1,
    });

    return {
      clientOperationId: op.clientOperationId,
      status: 'failed',
      errorCategory: category,
      errorMessage: message,
    };
  }

  /**
   * Resolve an outstanding conflict.
   */
  async resolveConflict(
    familyId: string,
    userId: string,
    conflictId: string,
    resolution: 'resolved_client' | 'resolved_server' | 'resolved_merged',
    resolvedValue?: Record<string, unknown>
  ): Promise<SyncConflict> {
    const membership = await db.getUserMembership(familyId, userId);
    if (!membership || membership.status !== 'active') {
      const err = new Error('Access denied. You are not an active member of this family workspace.');
      (err as unknown as { statusCode: number }).statusCode = 403;
      throw err;
    }

    const conflict = await db.getSyncConflictById(conflictId);
    if (!conflict || conflict.family_id !== familyId) {
      const err = new Error('Conflict not found');
      (err as unknown as { statusCode: number }).statusCode = 404;
      throw err;
    }

    // Apply chosen resolution value to target entity if using client or merged value
    if (resolution === 'resolved_client') {
      if (conflict.entity_type === 'patient_profile') {
        await db.updatePatientProfile(conflict.entity_id, conflict.local_value as Partial<PatientProfile>);
      }
    } else if (resolution === 'resolved_merged' && resolvedValue) {
      if (conflict.entity_type === 'patient_profile') {
        await db.updatePatientProfile(conflict.entity_id, resolvedValue as Partial<PatientProfile>);
      }
    }

    return db.resolveSyncConflict(conflictId, resolution, userId, resolvedValue || conflict.local_value);
  }

  /**
   * Retrieve authoritative delta changes since client's last sync timestamp.
   */
  async getSyncDelta(
    familyId: string,
    userId: string,
    sinceIso: string,
    patientProfileId?: string
  ): Promise<SyncDeltaResponse> {
    const membership = await db.getUserMembership(familyId, userId);
    if (!membership || membership.status !== 'active') {
      const err = new Error('Access denied. You are not an active member of this family workspace.');
      (err as unknown as { statusCode: number }).statusCode = 403;
      throw err;
    }

    const changes = await db.getChangesSince(familyId, sinceIso, patientProfileId);
    const conflicts = await db.listSyncConflicts(familyId, patientProfileId, 'pending');

    return {
      ...changes,
      conflicts,
      serverTimestamp: new Date().toISOString(),
    };
  }

  /**
   * Get sync status overview for family workspace.
   */
  async getSyncStatus(familyId: string, userId: string) {
    const membership = await db.getUserMembership(familyId, userId);
    if (!membership || membership.status !== 'active') {
      const err = new Error('Access denied. You are not an active member of this family workspace.');
      (err as unknown as { statusCode: number }).statusCode = 403;
      throw err;
    }

    const pendingConflicts = await db.listSyncConflicts(familyId, undefined, 'pending');
    const recentOperations = await db.listSyncOperations(familyId, 20);

    return {
      familyId,
      pendingConflictsCount: pendingConflicts.length,
      recentOperations,
      serverTimestamp: new Date().toISOString(),
    };
  }
}

export const syncService = new SyncService();
