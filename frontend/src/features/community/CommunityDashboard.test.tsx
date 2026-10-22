// @vitest-environment jsdom
/**
 * frontend/src/features/community/CommunityDashboard.test.tsx
 *
 * Frontend unit tests for Phase 8 Health Community, Society Groups & Assistance.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CommunityDashboard } from './CommunityDashboard';
import { communityService } from '../../services/communityService';
import { CommunityGroup, CommunityMembership, AssistanceRequest, BloodDonorRequest } from '../../types/community';

vi.mock('../../services/communityService', () => {
  const serviceMock = {
    listMyGroups: vi.fn(),
    listPublicGroups: vi.fn(),
    getGroup: vi.fn(),
    listMembers: vi.fn(),
    listGroupInvitations: vi.fn(),
    listJoinRequests: vi.fn(),
    listAssistanceRequests: vi.fn(),
    listBloodDonorRequests: vi.fn(),
    listReports: vi.fn(),
    listModerationActions: vi.fn(),
    createGroup: vi.fn(),
    createAssistanceRequest: vi.fn(),
    createBloodDonorRequest: vi.fn(),
    reviewJoinRequest: vi.fn(),
    submitReport: vi.fn(),
    resolveReport: vi.fn(),
    acceptInvitation: vi.fn(),
    declineInvitation: vi.fn(),
  };
  return {
    communityService: serviceMock,
    communityApiService: serviceMock,
  };
});

describe('Phase 8 — Community Dashboard UI', () => {
  const mockUser = {
    id: 'user-p8-test-01',
    email: 'resident@example.com',
    fullName: 'Aditi Rao',
    role: 'member',
  };

  const mockGroup: CommunityGroup = {
    id: 'comm-group-001',
    name: 'Palm Meadows Residential Society',
    description: 'Society assistance network for elderly residents and blood donation emergencies',
    group_type: 'residential_society',
    approximate_locality: 'Whitefield',
    organization_or_building_name: 'Palm Meadows Phase 2',
    membership_policy: 'approval_required',
    moderation_policy: 'standard',
    status: 'active',
    creator_user_id: 'user-p8-test-01',
    created_at: '2026-10-22T00:00:00Z',
    updated_at: '2026-10-22T00:00:00Z',
  };

  const mockMembership: CommunityMembership = {
    id: 'mem-001',
    community_id: 'comm-group-001',
    user_id: 'user-p8-test-01',
    role: 'owner',
    status: 'active',
    joined_at: '2026-10-22T00:00:00Z',
    created_at: '2026-10-22T00:00:00Z',
    updated_at: '2026-10-22T00:00:00Z',
  };

  const mockAssistance: AssistanceRequest = {
    id: 'asst-001',
    community_id: 'comm-group-001',
    request_category: 'appointment_accompaniment',
    title: 'Need escort to local clinic checkup',
    description: 'Looking for a volunteer neighbor to accompany elderly resident to dispensary at 10 AM',
    priority: 'medium',
    creator_user_id: 'user-p8-test-01',
    intended_recipient_name: 'Mrs. Rao',
    approximate_locality: 'Tower B, 4th Floor',
    preferred_date_time: '10:00 AM Tomorrow',
    expiry_time: '2026-10-25T00:00:00Z',
    status: 'open',
    assigned_volunteer_user_id: null,
    contact_sharing_consent: true,
    contact_phone: null,
    created_at: '2026-10-22T00:00:00Z',
    updated_at: '2026-10-22T00:00:00Z',
  };

  const mockBloodDonor: BloodDonorRequest = {
    id: 'bld-001',
    community_id: 'comm-group-001',
    blood_group: 'O+',
    units_needed: 2,
    approximate_locality: 'Whitefield',
    hospital_name: 'Manipal Hospital Whitefield',
    requested_date_time: 'Immediate',
    creator_user_id: 'user-p8-test-01',
    notes: 'ICU Bed 14, Dr. Sharma Attending',
    status: 'open',
    expiry_time: '2026-10-25T00:00:00Z',
    contact_phone: '+919845012345',
    contact_sharing_consent: true,
    created_at: '2026-10-22T00:00:00Z',
    updated_at: '2026-10-22T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (communityService.listMyGroups as any).mockResolvedValue([mockGroup]);
    (communityService.getGroup as any).mockResolvedValue({
      group: mockGroup,
      myMembership: mockMembership,
    });
    (communityService.listAssistanceRequests as any).mockResolvedValue([mockAssistance]);
    (communityService.listBloodDonorRequests as any).mockResolvedValue([mockBloodDonor]);
    (communityService.listMembers as any).mockResolvedValue([mockMembership]);
    (communityService.listJoinRequests as any).mockResolvedValue([]);
    (communityService.listReports as any).mockResolvedValue([]);
    (communityService.listModerationActions as any).mockResolvedValue([]);
    (communityService.listGroupInvitations as any).mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders community dashboard banner, community title, and navigation tabs', async () => {
    render(<CommunityDashboard currentUserId={mockUser.id} />);

    await waitFor(() => {
      expect(screen.getByText(/Palm Meadows Residential Society/i)).toBeInTheDocument();
    });

    // Check privacy guarantee banner
    expect(screen.getByText('Healthcare Privacy Guaranteed')).toBeInTheDocument();
    expect(
      screen.getByText(/Your private medical documents, AI Health Memory, and doctor summaries are never shared/i)
    ).toBeInTheDocument();

    // Check navigation tabs
    expect(screen.getByRole('button', { name: /Elderly & Mutual Assistance/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Blood-Donor Requests/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Members & Join Requests/i })).toBeInTheDocument();
  });

  it('renders assistance request card with priority tag and title', async () => {
    render(<CommunityDashboard currentUserId={mockUser.id} />);

    await waitFor(() => {
      expect(screen.getByText('Need escort to local clinic checkup')).toBeInTheDocument();
    });

    expect(screen.getByText('MEDIUM')).toBeInTheDocument();
    expect(screen.getByText(/Tower B, 4th Floor/i)).toBeInTheDocument();
  });

  it('navigates to Blood Donors tab and displays donor request', async () => {
    render(<CommunityDashboard currentUserId={mockUser.id} />);

    await waitFor(() => {
      expect(screen.getByText(/Palm Meadows Residential Society/i)).toBeInTheDocument();
    });

    const bloodTab = screen.getByRole('button', { name: /Blood-Donor Requests/i });
    fireEvent.click(bloodTab);

    await waitFor(() => {
      expect(screen.getByText('Manipal Hospital Whitefield')).toBeInTheDocument();
      expect(screen.getByText(/GROUP O\+/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /\+ Post Blood Request/i })).toBeInTheDocument();
    });
  });

  it('opens and closes Community Guidelines & Rules modal with explicit privacy boundaries', async () => {
    render(<CommunityDashboard currentUserId={mockUser.id} />);

    await waitFor(() => {
      expect(screen.getByText(/Palm Meadows Residential Society/i)).toBeInTheDocument();
    });

    const rulesBtn = screen.getByRole('button', { name: /View Community Safety Rules/i });
    fireEvent.click(rulesBtn);

    expect(screen.getByText(/Community Safety & Privacy Rules/i)).toBeInTheDocument();
    expect(screen.getByText(/Complete Medical Record Privacy/i)).toBeInTheDocument();
    expect(screen.getByText(/Contact & Location Privacy/i)).toBeInTheDocument();
    expect(screen.getByText(/Strict Non-Emergency Boundary/i)).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /I Understand & Agree/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByText(/Community Safety & Privacy Rules/i)).not.toBeInTheDocument();
  });

  it('opens Create Assistance Request modal', async () => {
    render(<CommunityDashboard currentUserId={mockUser.id} />);

    await waitFor(() => {
      expect(screen.getByText(/Palm Meadows Residential Society/i)).toBeInTheDocument();
    });

    const createBtn = screen.getByRole('button', { name: /\+ Request Assistance/i });
    fireEvent.click(createBtn);

    expect(screen.getByText(/Request Non-Emergency Assistance/i)).toBeInTheDocument();
    expect(screen.getByText(/Category \*/i)).toBeInTheDocument();
    expect(screen.getByText(/Title \/ Summary \*/i)).toBeInTheDocument();
  });

  it('opens Create Blood Donor Request modal with medical disclaimer', async () => {
    render(<CommunityDashboard currentUserId={mockUser.id} />);

    await waitFor(() => {
      expect(screen.getByText(/Palm Meadows Residential Society/i)).toBeInTheDocument();
    });

    const bloodTab = screen.getByRole('button', { name: /Blood-Donor Requests/i });
    fireEvent.click(bloodTab);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /\+ Post Blood Request/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /\+ Post Blood Request/i }));

    expect(screen.getByText(/Post Blood-Donor Request/i)).toBeInTheDocument();
    expect(screen.getByText(/Blood Group Needed \*/i)).toBeInTheDocument();
    expect(screen.getByText(/Medical Disclaimer/i)).toBeInTheDocument();
  });

  it('renders Member Management tab for group owner', async () => {
    render(<CommunityDashboard currentUserId={mockUser.id} />);

    await waitFor(() => {
      expect(screen.getByText(/Palm Meadows Residential Society/i)).toBeInTheDocument();
    });

    const membersTab = screen.getByRole('button', { name: /Members & Join Requests/i });
    fireEvent.click(membersTab);

    await waitFor(() => {
      expect(screen.getByText(/Community Members/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /\+ Invite Resident/i })).toBeInTheDocument();
    });
  });
});
