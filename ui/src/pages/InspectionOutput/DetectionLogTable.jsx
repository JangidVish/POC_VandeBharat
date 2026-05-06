import React, { useState, useMemo } from 'react';

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
        r.imageId.toLowerCase().includes(q) ||
        r.bogieNo.toLowerCase().includes(q) ||
        r.component.toLowerCase().includes(q) ||
        r.defect.toLowerCase().includes(q)
      );
    }
    if (filterDefects) {
      rows = rows.filter(r => r.defect !== 'None');
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
    <div className="bg-surface-container-lowest border border-outline-variant flex flex-col overflow-hidden shadow-sm h-full">
      <div className="p-md border-b border-outline-variant flex justify-between items-center bg-surface-container-low/30 flex-wrap gap-sm">
        <div className="flex items-center gap-md">
          <h2 className="font-h2 text-h2 text-primary">DETECTION LOG</h2>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
            <input
              className="pl-xl pr-md py-xs bg-surface-container-lowest border border-outline-variant font-body-sm focus:outline-none focus:border-primary w-64 text-body-sm"
              placeholder="Search ID, Bogie, Component…"
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-xs items-center">
          <button
            onClick={() => setFilterDefects(p => !p)}
            className={`px-sm py-xs font-label-caps text-[10px] border rounded-sm transition-colors ${
              filterDefects
                ? 'bg-error text-white border-error'
                : 'hover:bg-surface-container-high border-outline-variant'
            }`}
            title="Show defects only"
          >
            {filterDefects ? 'DEFECTS ONLY ✓' : 'ALL ROWS'}
          </button>
          <button onClick={() => { setQuery(''); setFilterDefects(false); setSortField(null); }} className="p-xs hover:bg-surface-container-high transition-colors" title="Clear filters">
            <span className="material-symbols-outlined text-[20px]">filter_list_off</span>
          </button>
        </div>
      </div>

      <div className="overflow-auto flex-grow custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-surface-container-low z-10">
            <tr className="font-label-caps text-[10px] text-on-surface-variant border-b border-outline-variant">
              {[
                { key: 'imageId', label: 'IMAGE ID' },
                { key: 'bogieNo', label: 'BOGIE NO' },
                { key: 'camera', label: 'CAMERA' },
                { key: 'component', label: 'COMPONENT' },
                { key: 'defect', label: 'DEFECT' },
                { key: null, label: 'BBOX [X,Y,W,H]' },
                { key: null, label: '' },
              ].map(col => (
                <th
                  key={col.label}
                  className={`px-md py-sm font-bold select-none ${col.key ? 'cursor-pointer hover:text-primary' : ''}`}
                  onClick={col.key ? () => handleSort(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-xs">
                    {col.label}
                    {col.key && <SortIcon field={col.key} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-body-sm text-on-surface text-[12px]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-md py-lg text-center text-on-surface-variant font-body-sm">
                  No results match your filter.
                </td>
              </tr>
            ) : (
              filtered.map((row, idx) => (
                <tr
                  key={idx}
                  className={`border-b transition-colors ${
                    row.defect !== 'None'
                      ? 'bg-red-50 border-red-200 hover:bg-red-100'
                      : 'border-outline-variant hover:bg-surface-container-low'
                  }`}
                >
                  <td className="px-md py-sm font-code">{row.imageId}</td>
                  <td className="px-md py-sm">{row.bogieNo}</td>
                  <td className="px-md py-sm">{row.camera}</td>
                  <td className="px-md py-sm font-medium">{row.component}</td>
                  <td className="px-md py-sm">
                    <span className={row.defect !== 'None' ? 'text-error font-medium' : 'text-on-surface-variant'}>
                      {row.defect}
                    </span>
                  </td>
                  <td className="px-md py-sm font-code text-on-surface-variant">{row.bbox}</td>
                  <td className="px-md py-sm">
                    <button
                      onClick={() => onViewRow(row)}
                      className="inline-flex items-center gap-xs font-label-caps text-[10px] px-sm py-xs border border-outline-variant hover:bg-primary hover:text-white hover:border-primary transition-colors rounded-sm"
                    >
                      <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                      VIEW
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="px-md py-xs border-t border-outline-variant bg-surface-container-low/20 font-label-caps text-[10px] text-on-surface-variant">
        {filtered.length} / {data.length} rows
        {filterDefects && ` · defects only`}
        {query && ` · filtered by "${query}"`}
      </div>
    </div>
  );
};

export default DetectionLogTable;
