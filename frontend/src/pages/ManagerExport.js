import React, { useState, useEffect } from 'react';
import { managerAPI } from '../services/api';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { saveAs } from 'file-saver';

export default function ManagerExport() {
    const [team, setTeam] = useState([]);
    const [filters, setFilters] = useState({ userId: '', startDate: '', endDate: '' });
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        managerAPI.getTeam().then(res => setTeam(res.data.data || [])).catch(() => {});
    }, []);

    const handleExport = async (format) => {
        setExporting(true);
        try {
            const res = await managerAPI.exportData(format, filters);
            const ext = format === 'excel' ? 'xlsx' : 'csv';
            const type = format === 'excel'
                ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                : 'text/csv';
            const blob = new Blob([res.data], { type });
            saveAs(blob, `team_tasks_report.${ext}`);
        } catch (e) {
            alert('Export failed. Please try again.');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div>
            <div className="data-section">
                <div className="data-section-header">
                    <h3>Export Team Data</h3>
                </div>
                <div className="modal-body">
                    <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14 }}>
                        Export your team's task data in Excel or CSV format. Use the filters below to narrow down the data range.
                    </p>

                    <div className="form-row-3">
                        <div className="form-group">
                            <label className="form-label">Team Member</label>
                            <select className="form-select" value={filters.userId}
                                onChange={e => setFilters(f => ({ ...f, userId: e.target.value }))}>
                                <option value="">All Members</option>
                                {team.map(m => (
                                    <option key={m.UserID} value={m.UserID}>{m.FullName}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">From Date</label>
                            <input type="date" className="form-input" value={filters.startDate}
                                onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">To Date</label>
                            <input type="date" className="form-input" value={filters.endDate}
                                onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))} />
                        </div>
                    </div>

                    <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24
                    }}>
                        <button
                            className="btn btn-primary"
                            onClick={() => handleExport('excel')}
                            disabled={exporting}
                            style={{ padding: '20px', justifyContent: 'center', fontSize: 15 }}
                        >
                            <FileSpreadsheet size={20} />
                            {exporting ? 'Exporting...' : 'Export as Excel (.xlsx)'}
                        </button>
                        <button
                            className="btn btn-outline"
                            onClick={() => handleExport('csv')}
                            disabled={exporting}
                            style={{ padding: '20px', justifyContent: 'center', fontSize: 15 }}
                        >
                            <FileText size={20} />
                            {exporting ? 'Exporting...' : 'Export as CSV (.csv)'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
