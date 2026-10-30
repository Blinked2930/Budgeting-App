import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Users, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

export const NetDebtWidget: React.FC = () => {
  const groups = useQuery((api as any).groups?.getMyGroups || (api as any).groups?.listGroups, {});

  if (groups === undefined) {
    return (
      <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-sm animate-pulse flex justify-between items-center">
        <div className="h-4 w-28 bg-slate-200 rounded-md" />
        <div className="h-4 w-12 bg-slate-200 rounded-md" />
      </div>
    );
  }

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3 font-sans">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
            <Users className="w-4 h-4" />
          </div>
          <span className="font-bold text-slate-900 text-sm">Splitup Trip Groups</span>
        </div>
        <span className="text-xs font-semibold text-slate-400">{groups.length} Active</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100 flex items-center gap-2">
          <ArrowDownLeft className="w-4 h-4 text-emerald-600 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-500 font-medium">To Receive</p>
            <p className="text-xs font-bold text-emerald-700 font-mono">0 ALL</p>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-100 flex items-center gap-2">
          <ArrowUpRight className="w-4 h-4 text-rose-600 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-500 font-medium">To Pay Out</p>
            <p className="text-xs font-bold text-rose-700 font-mono">0 ALL</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetDebtWidget;