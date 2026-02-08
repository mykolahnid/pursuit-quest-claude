'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Scatter } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [responses, setResponses] = useState([]);
  const [correlation, setCorrelation] = useState(null);
  const [newSessionName, setNewSessionName] = useState('');
  const [testDataCount, setTestDataCount] = useState(30);
  const [testDataMode, setTestDataMode] = useState('correlated');
  const [actionLoading, setActionLoading] = useState('');

  // Check auth status
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/status');
        const data = await res.json();
        if (!data.isAdmin) {
          router.push('/login');
          return;
        }
      } catch {
        router.push('/login');
        return;
      }
      setLoading(false);
      loadSessions();
    }
    checkAuth();
  }, [router]);

  async function loadSessions() {
    try {
      const res = await fetch('/api/admin/sessions');
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch {
      // ignore
    }
  }

  const loadSessionData = useCallback(async (sessionId) => {
    try {
      const [respRes, corrRes] = await Promise.all([
        fetch(`/api/admin/sessions/${sessionId}/responses`),
        fetch(`/api/admin/sessions/${sessionId}/correlation`),
      ]);
      const respData = await respRes.json();
      const corrData = await corrRes.json();
      setResponses(respData.responses || []);
      setCorrelation(corrData);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (selectedSession) {
      loadSessionData(selectedSession.id);
    }
  }, [selectedSession, loadSessionData]);

  async function handleCreateSession() {
    if (!newSessionName.trim()) return;
    setActionLoading('create');
    try {
      const res = await fetch('/api/admin/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSessionName.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewSessionName('');
        await loadSessions();
        setSelectedSession(data.session);
      }
    } catch {
      // ignore
    }
    setActionLoading('');
  }

  async function handleCloseSession(id) {
    setActionLoading('close');
    try {
      await fetch(`/api/admin/sessions/${id}/close`, { method: 'PUT' });
      await loadSessions();
      if (selectedSession?.id === id) {
        setSelectedSession((prev) => ({ ...prev, status: 'closed' }));
      }
    } catch {
      // ignore
    }
    setActionLoading('');
  }

  async function handleOpenSession(id) {
    setActionLoading('open');
    try {
      await fetch(`/api/admin/sessions/${id}/open`, { method: 'PUT' });
      await loadSessions();
      if (selectedSession?.id === id) {
        setSelectedSession((prev) => ({ ...prev, status: 'open' }));
      }
    } catch {
      // ignore
    }
    setActionLoading('');
  }

  async function handleDeleteSession(id) {
    if (!confirm('Delete this session and all its responses?')) return;
    setActionLoading('delete');
    try {
      await fetch(`/api/admin/sessions/${id}`, { method: 'DELETE' });
      if (selectedSession?.id === id) {
        setSelectedSession(null);
        setResponses([]);
        setCorrelation(null);
      }
      await loadSessions();
    } catch {
      // ignore
    }
    setActionLoading('');
  }

  async function handleGenerateTestData() {
    if (!selectedSession) return;
    setActionLoading('testdata');
    try {
      await fetch(`/api/admin/sessions/${selectedSession.id}/testdata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: testDataCount, mode: testDataMode }),
      });
      await loadSessionData(selectedSession.id);
      await loadSessions();
    } catch {
      // ignore
    }
    setActionLoading('');
  }

  async function handleClearResponses() {
    if (!selectedSession) return;
    if (!confirm('Clear all responses for this session?')) return;
    setActionLoading('clear');
    try {
      await fetch(`/api/admin/sessions/${selectedSession.id}/responses`, {
        method: 'DELETE',
      });
      await loadSessionData(selectedSession.id);
      await loadSessions();
    } catch {
      // ignore
    }
    setActionLoading('');
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  // Chart data — sort by Q1 (anchor) for the line chart
  const sortedResponses = [...responses].sort((a, b) => a.q1_answer - b.q1_answer);

  const lineChartData = {
    labels: sortedResponses.map((_, i) => `P${i + 1}`),
    datasets: [
      {
        label: 'Q1: Chosen Number (1-100)',
        data: sortedResponses.map((r) => r.q1_answer),
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.1)',
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.1,
      },
      {
        label: 'Q2: Estimated African UN Members',
        data: sortedResponses.map((r) => r.q2_answer),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.1,
      },
    ],
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: { display: true, text: 'Responses: Q1 (Anchor) vs Q2 (Estimate)' },
      legend: { position: 'top' },
      tooltip: { mode: 'index', intersect: false },
    },
    scales: {
      x: { title: { display: true, text: 'Participant' } },
      y: { title: { display: true, text: 'Answer Value' }, min: 0 },
    },
  };

  const scatterDatasets = [
    {
      label: 'Q1 vs Q2',
      data: responses.map((r) => ({ x: r.q1_answer, y: r.q2_answer })),
      backgroundColor: 'rgba(75, 192, 192, 0.6)',
      borderColor: 'rgba(75, 192, 192, 1)',
      pointRadius: 6,
      pointHoverRadius: 8,
    },
  ];

  if (correlation?.regression) {
    const reg = correlation.regression;
    scatterDatasets.push({
      label: `Regression (r = ${reg.r})`,
      data: [
        { x: reg.xMin, y: reg.yAtXMin },
        { x: reg.xMax, y: reg.yAtXMax },
      ],
      type: 'line',
      borderColor: 'rgba(255, 159, 64, 1)',
      borderWidth: 2,
      borderDash: [6, 4],
      pointRadius: 0,
      fill: false,
    });
  }

  // Reference line at y=54 (actual answer)
  scatterDatasets.push({
    label: 'Actual Answer (54)',
    data: [
      { x: 0, y: 54 },
      { x: 100, y: 54 },
    ],
    type: 'line',
    borderColor: 'rgba(153, 102, 255, 0.7)',
    borderWidth: 2,
    borderDash: [10, 5],
    pointRadius: 0,
    fill: false,
  });

  const scatterChartData = { datasets: scatterDatasets };

  const scatterChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: { display: true, text: 'Anchoring Effect: Q1 vs Q2' },
      legend: { position: 'top' },
    },
    scales: {
      x: {
        title: { display: true, text: 'Q1: Chosen Number (Anchor)' },
        min: 0,
        max: 105,
      },
      y: {
        title: { display: true, text: 'Q2: Estimated African UN Members' },
        min: 0,
      },
    },
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>Admin Dashboard</h1>
        <button className="btn btn-outline btn-sm" onClick={handleLogout}>
          Logout
        </button>
      </div>

      {/* Create Session */}
      <div className="card">
        <h2>Session Management</h2>
        <div className="create-session-form">
          <input
            type="text"
            placeholder="New session name..."
            value={newSessionName}
            onChange={(e) => setNewSessionName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={handleCreateSession}
            disabled={actionLoading === 'create' || !newSessionName.trim()}
          >
            {actionLoading === 'create' ? 'Creating...' : 'Create & Open'}
          </button>
        </div>

        {/* Sessions Table */}
        {sessions.length > 0 ? (
          <table className="sessions-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Created</th>
                <th>Responses</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr
                  key={s.id}
                  className={selectedSession?.id === s.id ? 'selected' : ''}
                  onClick={() => setSelectedSession(s)}
                >
                  <td>{s.name}</td>
                  <td>
                    <span
                      className={`status-badge ${
                        s.status === 'open' ? 'status-open' : 'status-closed'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td>{new Date(s.created_at).toLocaleDateString()}</td>
                  <td>{s.response_count}</td>
                  <td>
                    {s.status === 'open' ? (
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloseSession(s.id);
                        }}
                        disabled={!!actionLoading}
                      >
                        Close
                      </button>
                    ) : (
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenSession(s.id);
                        }}
                        disabled={!!actionLoading}
                      >
                        Open
                      </button>
                    )}{' '}
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSession(s.id);
                      }}
                      disabled={!!actionLoading}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>
            No sessions yet. Create one above.
          </p>
        )}
      </div>

      {/* Session Details */}
      {selectedSession && (
        <>
          {/* Actions */}
          <div className="card">
            <h2>
              Session: {selectedSession.name}
              <span
                className={`status-badge ${
                  selectedSession.status === 'open'
                    ? 'status-open'
                    : 'status-closed'
                }`}
                style={{ marginLeft: 12, verticalAlign: 'middle' }}
              >
                {selectedSession.status}
              </span>
            </h2>
            <div className="actions-bar">
              <input
                type="number"
                min="1"
                max="500"
                value={testDataCount}
                onChange={(e) => setTestDataCount(parseInt(e.target.value, 10) || 30)}
              />
              <select
                value={testDataMode}
                onChange={(e) => setTestDataMode(e.target.value)}
              >
                <option value="correlated">Correlated</option>
                <option value="random">Random</option>
              </select>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleGenerateTestData}
                disabled={!!actionLoading}
              >
                {actionLoading === 'testdata'
                  ? 'Generating...'
                  : 'Generate Test Data'}
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={handleClearResponses}
                disabled={!!actionLoading}
              >
                {actionLoading === 'clear' ? 'Clearing...' : 'Clear Responses'}
              </button>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {responses.length} response{responses.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Charts */}
          {responses.length > 0 && (
            <>
              <div className="card">
                <div className="charts-grid">
                  <div className="chart-container">
                    <Line data={lineChartData} options={lineChartOptions} />
                  </div>
                  <div className="chart-container">
                    <Scatter data={scatterChartData} options={scatterChartOptions} />
                  </div>
                </div>
              </div>

              {/* Correlation Analysis */}
              {correlation && correlation.r !== null && (
                <div className="card">
                  <h2>Correlation Analysis</h2>
                  <div className="stats-panel">
                    <div className="stat-item">
                      <div className="stat-value">{correlation.r}</div>
                      <div className="stat-label">Pearson r</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-value">
                        {correlation.pValue < 0.001
                          ? '< 0.001'
                          : correlation.pValue?.toFixed(4)}
                      </div>
                      <div className="stat-label">p-value</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-value">{correlation.n}</div>
                      <div className="stat-label">N (samples)</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-value">{correlation.meanQ1}</div>
                      <div className="stat-label">Mean Q1</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-value">{correlation.meanQ2}</div>
                      <div className="stat-label">Mean Q2</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-value">{correlation.tStatistic}</div>
                      <div className="stat-label">t-statistic</div>
                    </div>
                  </div>
                  <div className="interpretation">
                    {correlation.interpretation}
                  </div>
                </div>
              )}
            </>
          )}

          {responses.length === 0 && (
            <div className="card">
              <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                No responses yet. Generate test data or wait for participants to
                submit.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
