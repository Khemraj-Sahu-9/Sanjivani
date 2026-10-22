# COMMUNITY.md — Health Community, Society Groups & Elderly Assistance Network

> **Phase 8 Documentation — Sanjivani (Health Memory Agent)**
> This document details the architecture, privacy safeguards, non-emergency assistance workflows, blood-donor coordination, and moderation mechanisms for society and community networks.

---

## 1. Overview & Core Philosophy

Sanjivani Phase 8 introduces a **hyperlocal health support and mutual assistance layer** connecting neighbors, apartment complexes, and residential societies. The module facilitates non-emergency elderly care, mutual errand assistance, and community blood-donor appeals while maintaining an **absolute privacy boundary** between public/community interactions and private personal health records.

### Non-Negotiable Safety & Privacy Principles

1. **Strict Healthcare Privacy Isolation**: Community groups, owners, and moderators have **zero access** to family workspaces, medical records, OCR documents, timelines, or doctor summaries.
2. **Non-Emergency Boundary**: The community network is strictly for mutual, non-urgent neighborly aid (e.g., pharmacy pickup, appointment accompaniment, welfare checks). It is **never** an emergency response or 112/ambulance dispatch service.
3. **No Clinical Advice or Diagnosis**: Community members and volunteers are neighbors, not clinical practitioners. They must not provide medical diagnosis or treatment.
4. **Blood Donation Disclaimers**: Sanjivani facilitates contact coordination only. All biological eligibility screening, antibody testing, cross-matching, and collection remain exclusively the responsibility of licensed blood banks and hospitals.
5. **Privacy-First Contact Sharing**: Exact residential addresses and phone numbers are redacted by default and shared only through explicit user consent via authorized, time-bound contact grants upon volunteer assignment.

---

## 2. Community Groups & Membership Lifecycle

### Group Types
- `residential_society`: Housing societies, gated communities, resident welfare associations (RWAs).
- `apartment_building`: Standalone apartment buildings or condo blocks.
- `neighborhood`: Local street, block, or ward networks.
- `other_local`: Community clubs, senior citizen centers, volunteer hubs.

### Membership Policies
| Policy | Join Mechanism |
|--------|----------------|
| `open` | Any authenticated user can join immediately. |
| `approval_required` | User submits a join request with optional apartment/flat notes; owner/moderator approves or rejects. |
| `invite_only` | Requires a direct single-use/expiring invitation code sent to user email. |

### Role Hierarchy & Permissions
- **`owner`**: Community creator. Full administrative privileges: update settings, manage roles, review join requests, invite members, moderate content, remove members.
- **`moderator`**: Designated community manager. Can review join requests, invite members, hide content, and take moderation actions.
- **`member`**: Standard verified resident. Can view requests, post non-emergency assistance appeals, express volunteer interest, post/respond to blood donor requests, and report abuse.

---

## 3. Non-Emergency Elderly Assistance Workflow

### Categories of Assistance
- `grocery_supplies`: Essential grocery and provisions delivery.
- `appointment_accompaniment`: Accompanying an elderly resident to a planned local clinic or dispensary visit.
- `transport_assistance`: Help coordinating local transport or rides for seniors.
- `errands`: General errands and pharmacy medication pickups.
- `welfare_check`: Friendly physical or phone check-in on a senior living alone.
- `caregiver_contact`: Assisting an elderly resident in contacting their primary family caregiver.
- `other_support`: Non-medical mutual neighborly aid.

### Lifecycle & Volunteer Coordination State Machine
```
[Open] ──(Neighbor expresses interest)──> [Interest Received]
   │                                              │
   └───────────(Creator assigns volunteer)────────┴──────────> [Assigned]
                                                                  │
                                                        (Volunteer starts)
                                                                  │
                                                                  ▼
[Cancelled] <───────────────────────────────────────────── [In Progress]
                                                                  │
                                                         (Creator completes)
                                                                  │
                                                                  ▼
                                                             [Completed]
```

1. **Creation**: Requester inputs assistance category, title, description, priority (`low`, `medium`, `high`), approximate locality (e.g. "Tower B, 4th Floor"), preferred time window, and optional contact phone/address.
2. **Privacy Masking**: General community members see only the approximate locality and summary. Exact phone and address are hidden (`null`).
3. **Interest Logging**: Interested neighbors log volunteer interest with optional availability notes.
4. **Explicit Assignment & Contact Grant**: The requester reviews interested volunteers and explicitly assigns one. On assignment:
   - Status transitions to `assigned`.
   - A `contact_sharing_grant` record is created for the assigned volunteer with a 72-hour validity window.
   - The assigned volunteer can now inspect the revealed phone number and flat address.
5. **Completion**: Once delivered, the creator marks the request `completed`.

---

## 4. Blood-Donor Coordination

### Workflow
1. **Donor Appeal**: When a patient needs blood in an accredited hospital or blood bank, family members post an appeal with:
   - Blood group needed: `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`, or `any`.
   - Number of units needed.
   - Hospital name, city, and locality.
   - Clinical verification notes (e.g. "Bed 14 ICU, Attending Dr. Sharma").
   - Explicit consent to share contact phone with responding donors.
2. **Community Discovery**: Society members view active appeals filtered by blood group.
3. **Donor Response**: Willing donors register interest with their verified blood group and availability.
4. **Creator Contact**: The creator reviews responding donors and updates status to `contacted`. Contact sharing grant is issued for direct communication.
5. **Fulfillment**: Once donors donate or hospital requirements are met, creator marks request `fulfilled`.

### Mandatory Medical & Clinical Disclaimers
Every blood donor screen, form, and modal displays mandatory disclaimers:
- Sanjivani facilitates contact coordination only.
- Sanjivani does NOT test blood, check antibodies, or verify clinical donor eligibility.
- All biological eligibility screening, infectious disease testing (HIV, Hepatitis, Syphilis, Malaria), cross-matching, and collection remain exclusively the responsibility of authorized blood banks and hospital pathology departments.

---

## 5. Contact Privacy & Time-Bound Grants

To prevent resident doxxing, harassment, or data scraping:

```
[General Community Member]
  │
  ├── Request Card: approximate_locality only ("Tower B, 4th Floor")
  └── Phone & Exact Address: NULL / Redacted

[Assigned Volunteer / Contacted Donor]
  │
  └── ContactSharingGrant exists AND expires_at > NOW()
        ├── Revealed contact_phone
        └── Revealed exact_address
```

- Contact sharing grants are created in `contact_sharing_grants` table.
- Grants specify `grantee_user_id`, `resource_type`, `resource_id`, `granted_fields`, and `expires_at`.
- Grants can be explicitly revoked by the creator at any time or expire automatically after the assistance window closes.

---

## 6. Moderation & Abuse Prevention

### Community Reports
Any member can report suspicious requests, offensive conduct, commercial spam, or violations of privacy rules:
- Categories: `spam`, `harassment`, `inappropriate_medical_advice`, `commercial_solicitation`, `safety_concern`, `other`.
- Reports enter the community moderation queue.

### Moderation Actions
Community owners and moderators can review pending reports and take audit-logged actions:
- `warn_user`: Sends an official warning notification to the offender.
- `hide_content`: Hides the flagged assistance request or blood appeal from public view.
- `suspend_member`: Suspends the member's ability to post or volunteer in the community.
- `remove_member`: Expels the offending user from the community group.
- `dismiss`: Resolves the report without punitive action if deemed a false alarm.

All actions produce permanent audit records in `moderation_actions` including moderator user ID, timestamp, and action reason.

---

## 7. Healthcare Privacy Isolation Verification

The Sanjivani Phase 8 community implementation strictly isolates healthcare domains:
1. Community database tables (`community_groups`, `community_memberships`, `assistance_requests`, `blood_donor_requests`) do NOT have foreign keys or relationships to private patient health tables (`patient_profiles`, `medical_documents`, `extracted_fields`, `ai_health_memories`).
2. API endpoints under `/api/communities` never return medical document IDs, OCR summaries, or clinical metrics.
3. Community owners and moderators attempting to access a member's family workspace or patient profile receive an immediate `403 Forbidden` response from the backend authorization layer.
4. Community notification dispatches strictly use community notification categories without leaking family health details.
