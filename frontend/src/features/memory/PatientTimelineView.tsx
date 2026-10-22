import React, { useEffect, useState, useCallback } from 'react';
import { TimelineEvent } from '../../types/memory';
import { PatientProfile } from '../../types/auth';
import { healthMemoryApiService } from '../../services/healthMemoryService';
import { documentApiService } from '../../services/documentService';
import { DocumentReviewModal } from '../documents/DocumentReviewModal';
import { DocumentDetailsResponse } from '../../types/document';

interface PatientTimelineViewProps {
  familyId: string;
  patient: PatientProfile;
}

export const PatientTimelineView: React.FC<PatientTimelineViewProps> = ({ familyId, patient }) => {
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [filterType, setFilterType] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inspection modal
  const [inspectDoc, setInspectDoc] = useState<DocumentDetailsResponse | null>(null);

  const loadTimeline = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await healthMemoryApiService.getTimeline(familyId, patient.id);
      if (res.error || !res.data) throw new Error(res.error || 'Failed to load timeline');
      setTimeline(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching timeline');
    } finally {
      setIsLoading(false);
    }
  }, [familyId, patient.id]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  const handleOpenDocument = async (documentId: string) => {
    try {
      const res = await documentApiService.getDocumentDetails(documentId);
      if (res.error || !res.data) throw new Error(res.error || 'Failed to load document');
      setInspectDoc(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error opening document');
    }
  };

  const filteredTimeline = timeline.filter((item) => {
    if (filterType && item.eventType !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchDesc = item.description.toLowerCase().includes(q);
      const matchHighlights = (item.highlights || []).some((h) => h.toLowerCase().includes(q));
      if (!matchTitle && !matchDesc && !matchHighlights) return false;
    }
    return true;
  });

  const getEventIcon = (type: TimelineEvent['eventType']) => {
    switch (type) {
      case 'prescription': return '💊';
      case 'lab_report': return '🧪';
      case 'hospital_visit': return '🏥';
      case 'imaging': return '🩻';
      case 'vaccination': return '💉';
      default: return '📄';
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>📅 Chronological Medical History Timeline</h3>
          <p style={styles.subTitle}>
            Verified events, laboratory tests, prescriptions, and report dates for <strong>{patient.full_name}</strong>
          </p>
        </div>
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}

      {/* Filter and Search Bar */}
      <div style={styles.filterBar}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Event Type:</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={styles.select}
          >
            <option value="">All Event Types</option>
            <option value="prescription">💊 Prescriptions</option>
            <option value="lab_report">🧪 Lab Reports</option>
            <option value="hospital_visit">🏥 Hospital Visits / Summaries</option>
            <option value="imaging">🩻 Diagnostic Imaging</option>
            <option value="vaccination">💉 Vaccinations</option>
            <option value="other">📄 Other Reports</option>
          </select>
        </div>

        <div style={{ ...styles.filterGroup, flex: 1 }}>
          <label style={styles.filterLabel}>Search Timeline:</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events, doctors, test names, medicines..."
            style={styles.searchInput}
          />
        </div>
      </div>

      {/* Timeline Stream */}
      {isLoading ? (
        <div style={styles.loadingBox}>Loading chronological history...</div>
      ) : filteredTimeline.length === 0 ? (
        <div style={styles.emptyState}>
          <span style={{ fontSize: '2.5rem' }}>📅</span>
          <h4 style={styles.emptyTitle}>No timeline events found</h4>
          <p style={styles.emptySub}>Upload medical records to populate the chronological timeline.</p>
        </div>
      ) : (
        <div style={styles.timelineList}>
          {filteredTimeline.map((item, index) => (
            <div key={item.id} style={styles.timelineItem}>
              {/* Timeline marker and vertical connector */}
              <div style={styles.markerColumn}>
                <div style={styles.iconCircle}>{getEventIcon(item.eventType)}</div>
                {index < filteredTimeline.length - 1 && <div style={styles.verticalLine} />}
              </div>

              {/* Event Card */}
              <div style={styles.eventCard}>
                <div style={styles.cardTopRow}>
                  <div>
                    <span style={styles.eventDate}>
                      {item.date} {item.isDateConfirmed ? '✓' : '(upload date)'}
                    </span>
                    <h4 style={styles.cardTitle}>{item.title}</h4>
                    <span style={styles.cardDesc}>{item.description}</span>
                  </div>

                  <span
                    style={{
                      ...styles.verifiedTag,
                      backgroundColor: item.isVerified ? '#dcfce7' : '#fef3c7',
                      color: item.isVerified ? '#166534' : '#92400e',
                    }}
                  >
                    {item.isVerified ? '✓ CONFIRMED' : 'NEEDS REVIEW'}
                  </span>
                </div>

                {/* Clinical Highlights */}
                {item.highlights && item.highlights.length > 0 && (
                  <div style={styles.highlightsContainer}>
                    {item.highlights.map((h, i) => (
                      <span key={i} style={styles.highlightBadge}>
                        {h}
                      </span>
                    ))}
                  </div>
                )}

                <div style={styles.cardFooter}>
                  <button
                    onClick={() => handleOpenDocument(item.documentId)}
                    style={styles.openDocBtn}
                  >
                    Open Source Document ↗
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {inspectDoc && (
        <DocumentReviewModal
          details={inspectDoc}
          patientName={patient.full_name}
          onClose={() => setInspectDoc(null)}
          onUpdated={loadTimeline}
        />
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  header: {
    padding: '0.5rem 0',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0,
  },
  subTitle: {
    fontSize: '0.85rem',
    color: '#64748b',
    margin: '0.25rem 0 0 0',
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    color: '#b91c1c',
    padding: '0.75rem',
    borderRadius: '6px',
    fontSize: '0.85rem',
  },
  filterBar: {
    display: 'flex',
    gap: '1rem',
    backgroundColor: '#ffffff',
    padding: '0.85rem 1rem',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    flexWrap: 'wrap',
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  filterLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#475569',
  },
  select: {
    padding: '0.45rem 0.75rem',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '0.85rem',
    backgroundColor: '#ffffff',
  },
  searchInput: {
    padding: '0.45rem 0.75rem',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '0.85rem',
    width: '100%',
  },
  timelineList: {
    display: 'flex',
    flexDirection: 'column',
    marginTop: '0.5rem',
  },
  timelineItem: {
    display: 'flex',
    gap: '1.25rem',
  },
  markerColumn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '36px',
  },
  iconCircle: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#e0f2fe',
    border: '2px solid #0284c7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1rem',
    zIndex: 2,
  },
  verticalLine: {
    width: '2px',
    flex: 1,
    backgroundColor: '#cbd5e1',
    margin: '0.25rem 0',
  },
  eventCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    padding: '1rem',
    marginBottom: '1.25rem',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
  },
  cardTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  eventDate: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#0284c7',
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontSize: '1.05rem',
    fontWeight: 700,
    color: '#0f172a',
    margin: '0.2rem 0',
  },
  cardDesc: {
    fontSize: '0.8rem',
    color: '#64748b',
  },
  verifiedTag: {
    fontSize: '0.7rem',
    fontWeight: 700,
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
  },
  highlightsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.4rem',
    margin: '0.75rem 0',
  },
  highlightBadge: {
    backgroundColor: '#f1f5f9',
    color: '#334155',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 500,
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    borderTop: '1px solid #f8fafc',
    paddingTop: '0.5rem',
  },
  openDocBtn: {
    background: 'none',
    border: 'none',
    color: '#0284c7',
    fontWeight: 600,
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
  loadingBox: {
    padding: '3rem',
    textAlign: 'center',
    color: '#64748b',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
  },
  emptyState: {
    padding: '3rem 1.5rem',
    textAlign: 'center',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
  },
  emptyTitle: {
    fontSize: '1.1rem',
    fontWeight: 600,
    color: '#334155',
    margin: '0.5rem 0 0.25rem 0',
  },
  emptySub: {
    fontSize: '0.85rem',
    color: '#64748b',
    margin: 0,
  },
};
