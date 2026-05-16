import React, { useState, useMemo } from 'react';
import Badge from '../../components/ui/Badge';

const DetectionLogTable = ({ data, onViewRow }) => {
  const [query, setQuery] = useState('');
  const [sortField, setSortField] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [filterDefects, setFilterDefects] = useState(false);

  const filtered = useMemo(() => {
    let rows = data;
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter(r =>
        r.bogieNo.toLowerCase().includes(q) ||
        r.component.toLowerCase().includes(q) ||
        r.defect.toLowerCase().includes(q)
      );
    }
    if (filterDefects) {
      rows = rows.filter(r => r.defect !== 'None' && r.defect !== 'nominal');
    }
    if (sortField) {
      rows = [...rows].sort((a, b) => {
        const av = (a[sortField] ?? '').toString().toLowerCase();
        const bv = (b[sortField] ?? '').toString().toLowerCase();
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return rows;
  }, [data, query, filterDefects, sortField, sortAsc]);

  const handleSort = (field) => {
    if (sortField === field) setSortAsc(p => !p);
    else { setSortField(field); setSortAsc(true); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="material-symbols-outlined text-[12px] opacity-30">unfold_more</span>;
    return <span className="material-symbols-outlined text-[12px] text-primary">{sortAsc ? 'arrow_upward' : 'arrow_downward'}</span>;
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant flex flex-col overflow-hidden shadow-xl rounded-sm h-full">
      <div className="p-lg border-b border-outline-variant flex justify-between items-center bg-surface-container-low/50 backdrop-blur-sm flex-wrap gap-md">
        <div className="flex items-center gap-xl">
          <div className="flex flex-col">
            <h2 className="font-display text-[20px] lg:text-[22px] font-black text-primary tracking-tight">DETECTION TELEMETRY</h2>
            <span className="font-label-caps text-[10px] lg:text-[11px] text-outline tracking-widest mt-0.5 uppercase">Live Data Stream Analysis</span>
          </div>
          <div className="relative group">
            <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-outline group-hover:text-primary transition-colors text-[18px]">search</span>
            <input
              className="pl-[42px] pr-md py-2.5 bg-surface-container-low border border-outline-variant/50 font-body-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 w-72 lg:w-80 xl:w-96 text-[13px] lg:text-[14px] rounded-sm transition-all shadow-inner"
              placeholder="Search Component, Bogie ID or Defects..."
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-sm items-center">
          <button
            onClick={() => setFilterDefects(p => !p)}
            className={`px-md py-2 font-label-caps text-[11px] border rounded-sm transition-all flex items-center gap-2 ${
              filterDefects
                ? 'bg-error text-white border-error shadow-lg shadow-error/20'
                : 'bg-surface hover:bg-surface-container-high border-outline-variant text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">{filterDefects ? 'warning' : 'list'}</span>
            {filterDefects ? 'CRITICAL ONLY' : 'ALL ENTRIES'}
          </button>
          <div className="w-px h-6 bg-outline-variant/30" />
          <button onClick={() => { setQuery(''); setFilterDefects(false); setSortField(null); }} className="w-8 h-8 flex items-center justify-center hover:bg-error/10 hover:text-error transition-colors rounded-full text-outline" title="Clear Filters">
            <span className="material-symbols-outlined text-[20px]">filter_alt_off</span>
          </button>
        </div>
      </div>

      <div className="overflow-auto flex-grow custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-surface-container-low z-10 shadow-sm">
            <tr className="font-label-caps text-[11px] lg:text-[12px] text-outline border-b border-outline-variant">
              {[
                { key: null,        label: 'PREVIEW', width: 'w-24 lg:w-28' },
                { key: 'timestamp', label: 'OPERATIONAL CONTEXT' },
                { key: 'bogieNo',   label: 'BOGIE ID' },
                { key: 'component', label: 'COMPONENT' },
                { key: 'defect',    label: 'STATUS / DEFECT' },
                { key: null,        label: 'ACTIONS', width: 'w-28' },
              ].map(col => (
                <th
                  key={col.label}
                  className={`px-lg py-3.5 font-bold select-none ${col.width || ''} ${col.key ? 'cursor-pointer hover:text-primary transition-colors' : ''}`}
                  onClick={col.key ? () => handleSort(col.key) : undefined}
                >
                  <div className="flex items-center gap-xs">
                    {col.label}
                    {col.key && <SortIcon field={col.key} />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-body-sm text-on-surface text-[13px] lg:text-[14px]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-lg py-xl text-center text-outline font-body-sm italic bg-surface/30">
                  No telemetry entries match the current configuration.
                </td>
              </tr>
            ) : (
              filtered.map((row, idx) => {
                const isDefect = row.defect && row.defect.toLowerCase() !== 'none' && row.defect.toLowerCase() !== 'nominal';
                return (
                  <tr
                    key={idx}
                    className={`group border-b transition-all duration-200 ${
                      isDefect
                        ? 'bg-error/5 hover:bg-error/10 border-error/20'
                        : 'border-outline-variant hover:bg-surface-container-low'
                    }`}
                  >
                    <td className="px-lg py-md">
                      <div className="w-18 h-11 lg:w-20 lg:h-12 rounded-sm bg-black overflow-hidden border border-outline-variant group-hover:border-primary transition-colors relative shadow-inner">
                        {row.thumbnail ? (
                          <img src={row.thumbnail} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="thumb" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center opacity-20">
                            <span className="material-symbols-outlined text-[18px]">image</span>
                          </div>
                        )}
                        {isDefect && <div className="absolute top-0 right-0 w-2 h-2 bg-error rounded-bl-sm animate-pulse" />}
                      </div>
                    </td>
                    <td className="px-lg py-md">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-code text-[12px] lg:text-[13px] font-bold text-on-surface">{row.timestamp ?? '—'}</span>
                        <div className="flex items-center gap-1 text-outline">
                          <span className="material-symbols-outlined text-[14px] opacity-60" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                          <span className="font-code text-[11px] lg:text-[12px] tracking-tight">{row.gps ?? '—'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-lg py-md">
                      <span className="font-display font-bold text-[14px] lg:text-[15px] text-primary">{row.bogieNo}</span>
                    </td>
                    <td className="px-lg py-md">
                      <div className="flex flex-col gap-0.5 max-w-[240px]">
                        <span className="font-body-sm font-medium text-on-surface truncate text-[13px] lg:text-[14px]" title={row.component}>{row.component}</span>
                        {row.detections?.length > 0 && (
                          <span className="font-label-caps text-[10px] lg:text-[11px] text-outline uppercase tracking-wider">{row.detections.length} DETECTION CHANNELS</span>
                        )}
                      </div>
                    </td>
                    <td className="px-lg py-md">
                      {isDefect ? (
                        <Badge variant="error" className="py-1.5 uppercase font-bold tracking-widest text-[10px] lg:text-[11px]">CRITICAL: {row.defect}</Badge>
                      ) : (
                        <Badge variant="success" className="py-1.5 uppercase font-bold tracking-widest text-[10px] lg:text-[11px]">NOMINAL</Badge>
                      )}
                    </td>
                    <td className="px-lg py-md text-right">
                      <button
                        onClick={() => onViewRow(row)}
                        className="inline-flex items-center gap-2 font-label-caps text-[11px] lg:text-[12px] px-md py-2 border border-outline-variant bg-surface group-hover:border-primary group-hover:text-primary transition-all rounded-sm font-bold shadow-sm"
                      >
                        VIEW
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="px-lg py-2.5 border-t border-outline-variant bg-surface-container-low/50 font-label-caps text-[11px] lg:text-[12px] text-outline flex items-center justify-between">
        <div className="flex items-center gap-md">
          <span>{filtered.length} / {data.length} ENTRIES</span>
          {filterDefects && <span className="text-error font-bold tracking-widest">• CRITICAL MODE ACTIVE</span>}
        </div>
        {query && <span className="italic tracking-wider">FILTERED BY: "{query}"</span>}
      </div>
    </div>
  );
};

export default DetectionLogTable;
