import React, { useState } from 'react';
import { PatientProfile } from '../../types/auth';
import { GroundedSourceReference } from '../../types/memory';
import { healthMemoryApiService } from '../../services/healthMemoryService';
import { documentApiService } from '../../services/documentService';
import { DocumentReviewModal } from '../documents/DocumentReviewModal';
import { DocumentDetailsResponse } from '../../types/document';

interface HealthMemoryChatProps {
  familyId: string;
  patient: PatientProfile;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  sources?: GroundedSourceReference[];
  timestamp: string;
}

const EXAMPLE_PROMPTS = [
  'When was my last blood sugar report?',
  'Show my most recent hemoglobin results.',
  'Which allergies are recorded in my saved documents?',
  'What prescribed medicines are listed in my records?',
  'Summarize my medical history from uploaded reports.',
];

export const HealthMemoryChat: React.FC<HealthMemoryChatProps> = ({ familyId, patient }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Review / Inspection modal state for cited sources
  const [inspectDetails, setInspectDetails] = useState<DocumentDetailsResponse | null>(null);
  const [isOpeningDoc, setIsOpeningDoc] = useState(false);

  const handleSend = async (questionText?: string) => {
    const q = (questionText || inputQuery).trim();
    if (!q || isLoading) return;

    const userMsgId = `usr_${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      content: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setError(null);
    setIsLoading(true);

    try {
      const res = await healthMemoryApiService.askMemory(familyId, patient.id, q, conversationId);
      if (res.error || !res.data) throw new Error(res.error || 'Failed to get answer');

      setConversationId(res.data.conversationId);

      const assistantMsg: ChatMessage = {
        id: `ast_${Date.now()}`,
        sender: 'assistant',
        content: res.data.answer,
        sources: res.data.sources,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error communicating with Health Memory');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenSource = async (docId: string) => {
    try {
      setIsOpeningDoc(true);
      const res = await documentApiService.getDocumentDetails(docId);
      if (res.error || !res.data) throw new Error(res.error || 'Could not load document');
      setInspectDetails(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open source document');
    } finally {
      setIsOpeningDoc(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Patient Context Banner */}
      <div style={styles.patientBanner}>
        <div>
          <span style={styles.contextBadge}>ACTIVE MEMORY CONTEXT</span>
          <h3 style={styles.patientTitle}>
            🧠 {patient.full_name} ({patient.health_id})
          </h3>
          <p style={styles.patientSub}>
            All queries are securely scoped strictly to <strong>{patient.full_name}</strong>&apos;s verified records and extractions.
          </p>
        </div>
        <button
          onClick={() => {
            setMessages([]);
            setConversationId(undefined);
          }}
          style={styles.newChatBtn}
        >
          Clear Chat
        </button>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      {/* Messages Scroll Area */}
      <div style={styles.messagesContainer}>
        {messages.length === 0 ? (
          <div style={styles.emptyState}>
            <span style={{ fontSize: '2.5rem' }}>💬</span>
            <h4 style={styles.emptyHeading}>Ask Sanjivani Health Memory</h4>
            <p style={styles.emptyDesc}>
              Ask questions about past prescriptions, blood test results, allergies, or document dates.
              Answers are strictly grounded in {patient.full_name}&apos;s saved records.
            </p>
            <div style={styles.promptList}>
              {EXAMPLE_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(prompt)}
                  style={styles.promptChip}
                  disabled={isLoading}
                >
                  &quot;{prompt}&quot;
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              style={{
                ...styles.messageRow,
                justifyContent: m.sender === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  ...styles.bubble,
                  backgroundColor: m.sender === 'user' ? '#0284c7' : '#ffffff',
                  color: m.sender === 'user' ? '#ffffff' : '#1f2937',
                  border: m.sender === 'user' ? 'none' : '1px solid #e5e7eb',
                }}
              >
                <div style={styles.bubbleHeader}>
                  <strong style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                    {m.sender === 'user' ? 'You' : 'Sanjivani Agent'}
                  </strong>
                  <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{m.timestamp}</span>
                </div>

                <div style={{ ...styles.bubbleContent, whiteSpace: 'pre-wrap' }}>{m.content}</div>

                {/* Grounded Source References */}
                {m.sources && m.sources.length > 0 && (
                  <div style={styles.sourcesBox}>
                    <div style={styles.sourcesHeader}>📎 GROUNDED SUPPORTING SOURCES:</div>
                    <div style={styles.sourceItems}>
                      {m.sources.map((s, idx) => (
                        <div key={idx} style={styles.sourceTag}>
                          <div style={{ flex: 1 }}>
                            <span style={styles.sourceDocTitle}>{s.documentTitle}</span>
                            <span style={styles.sourceMeta}>
                              ({s.category.replace(/_/g, ' ')}{s.documentDate ? ` • ${s.documentDate}` : ''})
                            </span>
                            {s.snippet && <div style={styles.sourceSnippet}>&quot;{s.snippet}&quot;</div>}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleOpenSource(s.documentId)}
                            style={styles.inspectBtn}
                            disabled={isOpeningDoc}
                          >
                            Inspect Document ↗
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div style={styles.loadingBubble}>
            <span style={{ marginRight: '0.5rem' }}>⏳</span> Retrieving patient records and formulating grounded response...
          </div>
        )}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        style={styles.inputForm}
      >
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder={`Ask anything about ${patient.full_name}'s medical records...`}
          style={styles.chatInput}
          disabled={isLoading}
        />
        <button
          type="submit"
          style={styles.sendBtn}
          disabled={isLoading || !inputQuery.trim()}
        >
          Send
        </button>
      </form>

      {/* Document Review / Inspection Modal */}
      {inspectDetails && (
        <DocumentReviewModal
          details={inspectDetails}
          patientName={patient.full_name}
          onClose={() => setInspectDetails(null)}
          onUpdated={() => {}}
        />
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    border: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    height: '680px',
    overflow: 'hidden',
  },
  patientBanner: {
    padding: '1rem 1.25rem',
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contextBadge: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: '#0284c7',
    letterSpacing: '0.05em',
  },
  patientTitle: {
    margin: '0.15rem 0',
    fontSize: '1.15rem',
    fontWeight: 700,
    color: '#0f172a',
  },
  patientSub: {
    margin: 0,
    fontSize: '0.8rem',
    color: '#64748b',
  },
  newChatBtn: {
    padding: '0.4rem 0.8rem',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#475569',
    fontSize: '0.8rem',
    fontWeight: 500,
    cursor: 'pointer',
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    color: '#b91c1c',
    padding: '0.75rem 1.25rem',
    fontSize: '0.85rem',
    borderBottom: '1px solid #fecaca',
  },
  messagesContainer: {
    flex: 1,
    padding: '1.25rem',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    backgroundColor: '#f8fafc',
  },
  emptyState: {
    margin: 'auto',
    maxWidth: '520px',
    textAlign: 'center',
    padding: '2rem 1rem',
  },
  emptyHeading: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: '#1e293b',
    margin: '0.5rem 0 0.25rem 0',
  },
  emptyDesc: {
    fontSize: '0.875rem',
    color: '#64748b',
    lineHeight: 1.5,
    marginBottom: '1.5rem',
  },
  promptList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  promptChip: {
    padding: '0.6rem 0.9rem',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#0284c7',
    fontSize: '0.85rem',
    textAlign: 'left',
    cursor: 'pointer',
    fontWeight: 500,
  },
  messageRow: {
    display: 'flex',
    width: '100%',
  },
  bubble: {
    maxWidth: '82%',
    padding: '0.85rem 1rem',
    borderRadius: '12px',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
  },
  bubbleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.35rem',
  },
  bubbleContent: {
    fontSize: '0.9rem',
    lineHeight: 1.55,
  },
  sourcesBox: {
    marginTop: '0.85rem',
    paddingTop: '0.75rem',
    borderTop: '1px solid #f1f5f9',
  },
  sourcesHeader: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: '#059669',
    marginBottom: '0.4rem',
  },
  sourceItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  sourceTag: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    padding: '0.4rem 0.6rem',
    borderRadius: '6px',
    gap: '0.75rem',
  },
  sourceDocTitle: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#166534',
  },
  sourceMeta: {
    fontSize: '0.75rem',
    color: '#15803d',
    marginLeft: '0.35rem',
  },
  sourceSnippet: {
    fontSize: '0.75rem',
    color: '#4b5563',
    fontStyle: 'italic',
    marginTop: '0.15rem',
  },
  inspectBtn: {
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    border: '1px solid #059669',
    backgroundColor: '#ffffff',
    color: '#059669',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  loadingBubble: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    padding: '0.75rem 1rem',
    borderRadius: '10px',
    fontSize: '0.85rem',
    color: '#64748b',
    width: 'fit-content',
    fontStyle: 'italic',
  },
  inputForm: {
    display: 'flex',
    padding: '0.85rem 1.25rem',
    backgroundColor: '#ffffff',
    borderTop: '1px solid #e2e8f0',
    gap: '0.75rem',
  },
  chatInput: {
    flex: 1,
    padding: '0.65rem 1rem',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '0.9rem',
    outline: 'none',
  },
  sendBtn: {
    padding: '0.65rem 1.25rem',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#0284c7',
    color: '#ffffff',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
};
