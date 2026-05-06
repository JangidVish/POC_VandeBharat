import React from 'react';

const JsonViewer = ({ data }) => {
  return (
    <div className="bg-[#1e293b] border border-outline flex flex-col overflow-hidden h-full shadow-sm">
      <div className="p-md border-b border-[#334155] flex justify-between items-center bg-[#0f172a]">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-[#94a3b8] text-[18px]">data_object</span>
          <h2 className="font-h2 text-h2 text-[#f8fafc] text-body-base">METADATA OUTPUT</h2>
        </div>
        <button className="text-[#94a3b8] hover:text-white transition-colors flex items-center gap-xs font-label-caps text-[10px] border border-[#334155] px-sm py-1">
          <span className="material-symbols-outlined text-[14px]">content_copy</span> COPY
        </button>
      </div>
      
      <div className="p-lg overflow-auto flex-grow custom-scrollbar font-code text-[12px] text-[#cbd5e1] leading-relaxed">
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </div>
      
      <div className="p-sm bg-[#0f172a] border-t border-[#334155] flex justify-between items-center text-[#64748b] font-label-caps text-[10px]">
        <span>SCHEMA: V.2.4</span>
        <span>LINE: 1, COL: 1</span>
      </div>
    </div>
  );
};

export default JsonViewer;
