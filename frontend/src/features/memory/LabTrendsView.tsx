import React, { useEffect, useState, useCallback } from 'react';
import { LabTrendSeries } from '../../types/memory';
import { PatientProfile } from '../../types/auth';
import { healthMemoryApiService } from '../../services/healthMemoryService';
import { documentApiService } from '../../services/documentService';
import { DocumentReviewModal } from '../documents/DocumentReviewModal';
import { DocumentDetailsResponse } from '../../types/document';

interface LabTrendsViewProps {
  familyId: string;
  patient: PatientProfile;
}

export const LabTrendsView: React.FC<LabTrendsViewProps> = ({ familyId, patient }) => {
  const [trends, setTrends] = useState<LabTrendSeries[]>([]);
  const [selectedSeriesName, setSelectedSeriesName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inspection modal
  const [inspectDoc, setInspectDoc] = useState<DocumentDetailsResponse | null>(null);

  const loadTrends = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await healthMemoryApiService.getLabTrends(familyId, patient.id);
      if (res.error || !res.data) throw new Error(res.error || 'Failed to load laboratory trends');
      setTrends(res.data);
      if (res.data.length > 0 && !selectedSeriesName) {
        setSelectedSeriesName(res.data[0]?.testName || '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching laboratory trends');
    } finally {
      setIsLoading(false);
    }
  }, [familyId, patient.id, selectedSeriesName]);

  useEffect(() => {
    loadTrends();
  }, [loadTrends]);

  const activeSeries = trends.find((t) => t.testName === selectedSeriesName) || trends[0];

  const handleOpenDoc = async (docId: string) => {
    try {
      const res = await documentApiService.getDocumentDetails(docId);
      if (res.error || !res.data) throw new Error(res.error || 'Failed to load document');
      setInspectDoc(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error opening source document');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>🧪 Historical Laboratory Trends</h3>
          <p style={styles.subTitle}>
            Chronological values, units, reference ranges, and source documents for <strong>{patient.full_name}</strong>
          </p>
        </div>
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}

      {isLoading ? (
        <div style={styles.loadingBox}>Analyzing laboratory records...</div>
      ) : trends.length === 0 ? (
        <div style={styles.emptyState}>
          <span style={{ fontSize: '2.5rem' }}>🧪</span>
          <h4 style={styles.emptyTitle}>No structured laboratory results found</h4>
          <p style={styles.emptySub}>
            Upload and review blood test or pathology laboratory reports to track health values over time.
          </p>
        </div>
      ) : (
        <div style={styles.contentGrid}>
          {/* Left: Test Selector */}
          <div style={styles.testList}>
            <div style={styles.testListHeader}>Available Lab Tests ({trends.length})</div>
            {trends.map((t) => (
              <button
                key={t.testName}
                onClick={() => setSelectedSeriesName(t.testName)}
                style={{
                  ...styles.testItemBtn,
                  backgroundColor: activeSeries?.testName === t.testName ? '#e0f2fe' : '#ffffff',
                  borderColor: activeSeries?.testName === t.testName ? '#0284c7' : '#e2e8f0',
                  color: activeSeries?.testName === t.testName ? '#0369a1' : '#334155',
                }}
              >
                <div style={{ fontWeight: 600 }}>{t.testName}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {t.dataPoints.length} reading(s) • {t.unit || 'unit not specified'}
                </div>
              </button>
            ))}
          </div>

          {/* Right: Trend Data Points & Table */}
          {activeSeries && (
            <div style={styles.trendDetails}>
              <div style={styles.seriesHeader}>
                <div>
                  <h4 style={styles.seriesTitle}>{activeSeries.testName}</h4>
                  <span style={styles.seriesUnit}>Unit: {activeSeries.unit || 'standard'}</span>
                </div>
                <div style={styles.readingCountBadge}>
                  {activeSeries.dataPoints.length} Record(s) Found
                </div>
              </div>

              {/* Table of Readings */}
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.trHead}>
                      <th style={styles.th}>Date</th>
                      <th style={styles.th}>Result Value</th>
                      <th style={styles.th}>Reference Range</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Source Document</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSeries.dataPoints.map((dp, idx) => (
                      <tr key={idx} style={styles.tr}>
                        <td style={styles.td}>
                          <strong>{dp.date}</strong>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.valPill}>
                            {dp.rawResultValue} {dp.unit}
                          </span>
                        </td>
                        <td style={styles.td}>
                          {dp.referenceRange ? dp.referenceRange : <span style={{ color: '#94a3b8' }}>None printed</span>}
                        </td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.statusTag,
                              backgroundColor: dp.isVerified ? '#dcfce7' : '#fef3c7',
                              color: dp.isVerified ? '#166534' : '#92400e',
                            }}
                          >
                            {dp.isVerified ? '✓ CONFIRMED' : 'NEEDS REVIEW'}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <button
                            onClick={() => handleOpenDoc(dp.documentId)}
                            style={styles.sourceDocLink}
                          >
                            {dp.documentTitle} ↗
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Clinical Notice */}
              <div style={styles.clinicalNotice}>
                ℹ️ <strong>Clinical Note:</strong> Laboratory reference ranges vary between individual testing laboratories and methods. Always have test results evaluated in clinical context by a licensed physician.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {inspectDoc && (
        <DocumentReviewModal
          details={inspectDoc}
          patientName={patient.full_name}
          onClose={() => setInspectDoc(null)}
          onUpdated={loadTrends}
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
    padding: '0.25rem 0',
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
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '280px 1fr',
    gap: '1.25rem',
  },
  testList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  testListHeader: {
    fontSize: '0.8rem',
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase',
    marginBottom: '0.25rem',
  },
  testItemBtn: {
    textAlign: 'left',
    padding: '0.75rem',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  trendDetails: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  seriesHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #f1f5f9',
    paddingBottom: '0.75rem',
  },
  seriesTitle: {
    margin: 0,
    fontSize: '1.2rem',
    fontWeight: 700,
    color: '#0f172a',
  },
  seriesUnit: {
    fontSize: '0.8rem',
    color: '#64748b',
  },
  readingCountBadge: {
    backgroundColor: '#f1f5f9',
    padding: '0.3rem 0.6rem',
    borderRadius: '6px',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#334155',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.875rem',
    textAlign: 'left',
  },
  trHead: {
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
  },
  th: {
    padding: '0.65rem 0.85rem',
    color: '#475569',
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  tr: {
    borderBottom: '1px solid #f1f5f9',
  },
  td: {
    padding: '0.75rem 0.85rem',
    color: '#1e293b',
  },
  valPill: {
    backgroundColor: '#e0f2fe',
    color: '#0369a1',
    fontWeight: 700,
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
  },
  statusTag: {
    fontSize: '0.7rem',
    fontWeight: 700,
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
  },
  sourceDocLink: {
    background: 'none',
    border: 'none',
    color: '#0284c7',
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
    fontSize: '0.85rem',
  },
  clinicalNotice: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    padding: '0.75rem 1rem',
    fontSize: '0.8rem',
    color: '#475569',
  },
};
