'use client';

import { useState, useEffect, useCallback } from 'react';

function getBrowserId() {
  let id = sessionStorage.getItem('browserId');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('browserId', id);
  }
  return id;
}

export default function SurveyPage() {
  const [loading, setLoading] = useState(true);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [sessionName, setSessionName] = useState('');
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [step, setStep] = useState(1); // 1 = Q1, 2 = Q2, 3 = done
  const [q1, setQ1] = useState('');
  const [q2, setQ2] = useState('');
  const [q1Error, setQ1Error] = useState('');
  const [q2Error, setQ2Error] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch('/api/session/status');
        const data = await res.json();

        if (data.open && data.sessionId) {
          setSessionOpen(true);
          setSessionId(data.sessionId);
          setSessionName(data.sessionName || '');

          const submitted = sessionStorage.getItem(`submitted_${data.sessionId}`);
          if (submitted) {
            setAlreadySubmitted(true);
          }
        }
      } catch {
        // Server error - just show not available
      } finally {
        setLoading(false);
      }
    }
    checkStatus();
  }, []);

  const validateQ1 = useCallback((value) => {
    const num = parseInt(value, 10);
    if (value === '' || isNaN(num)) return 'Please enter a number';
    if (!Number.isInteger(Number(value)) || value.includes('.'))
      return 'Please enter a whole number';
    if (num < 1 || num > 100) return 'Number must be between 1 and 100';
    return '';
  }, []);

  const validateQ2 = useCallback((value) => {
    const num = parseInt(value, 10);
    if (value === '' || isNaN(num)) return 'Please enter a number';
    if (!Number.isInteger(Number(value)) || value.includes('.'))
      return 'Please enter a whole number';
    if (num < 0 || num > 1000) return 'Number must be between 0 and 1000';
    return '';
  }, []);

  function handleQ1Next() {
    const error = validateQ1(q1);
    setQ1Error(error);
    if (!error) {
      setStep(2);
    }
  }

  async function handleSubmit() {
    const error = validateQ2(q2);
    setQ2Error(error);
    if (error) return;

    setSubmitting(true);
    setSubmitError('');

    try {
      const browserId = getBrowserId();
      const res = await fetch('/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q1: parseInt(q1, 10),
          q2: parseInt(q2, 10),
          browserId,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        sessionStorage.setItem(`submitted_${sessionId}`, 'true');
        setStep(3);
      } else if (res.status === 409) {
        setAlreadySubmitted(true);
      } else {
        setSubmitError(data.error || 'Failed to submit. Please try again.');
      }
    } catch {
      setSubmitError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleQ1KeyDown(e) {
    // Block decimal point, e, +, -
    if (['.', 'e', 'E', '+', '-'].includes(e.key)) {
      e.preventDefault();
    }
    if (e.key === 'Enter') {
      handleQ1Next();
    }
  }

  function handleQ2KeyDown(e) {
    if (['.', 'e', 'E', '+', '-'].includes(e.key)) {
      e.preventDefault();
    }
    if (e.key === 'Enter') {
      handleSubmit();
    }
  }

  if (loading) {
    return (
      <div className="survey-container">
        <div className="survey-card">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  if (!sessionOpen) {
    return (
      <div className="survey-container">
        <div className="survey-card">
          <div className="status-message">
            <h2>Survey Not Available</h2>
            <p>There is no active survey session at this time. Please check back later.</p>
          </div>
        </div>
      </div>
    );
  }

  if (alreadySubmitted) {
    return (
      <div className="survey-container">
        <div className="survey-card">
          <div className="status-message fade-in">
            <h2>Already Submitted</h2>
            <p>You have already submitted your response for this session. Thank you!</p>
          </div>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="survey-container">
        <div className="survey-card">
          <div className="status-message fade-in">
            <h2>Thank You!</h2>
            <p>Your response has been recorded successfully.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="survey-container">
      <div className="survey-card">
        <h1>Quick Survey</h1>
        <p>Question {step} of 2</p>

        {step === 1 && (
          <div className="fade-in">
            <div className="input-group">
              <label className="question-label">
                Enter a number between 1 and 100:
              </label>
              <input
                type="number"
                min="1"
                max="100"
                step="1"
                value={q1}
                onChange={(e) => {
                  setQ1(e.target.value);
                  if (q1Error) setQ1Error(validateQ1(e.target.value));
                }}
                onKeyDown={handleQ1KeyDown}
                className={q1Error ? 'error' : ''}
                autoFocus
                placeholder="1 - 100"
              />
              {q1Error && <div className="error-text">{q1Error}</div>}
              <div className="hint-text">Whole numbers only</div>
            </div>
            <button className="btn btn-primary" onClick={handleQ1Next}>
              Next
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="fade-in">
            <div className="input-group">
              <label className="question-label">
                How many African countries are members of the United Nations?
              </label>
              <input
                type="number"
                min="0"
                max="1000"
                step="1"
                value={q2}
                onChange={(e) => {
                  setQ2(e.target.value);
                  if (q2Error) setQ2Error(validateQ2(e.target.value));
                }}
                onKeyDown={handleQ2KeyDown}
                className={q2Error ? 'error' : ''}
                autoFocus
                placeholder="0 - 1000"
              />
              {q2Error && <div className="error-text">{q2Error}</div>}
              <div className="hint-text">Enter your best guess</div>
            </div>
            {submitError && (
              <div className="error-text" style={{ marginBottom: 12 }}>
                {submitError}
              </div>
            )}
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
