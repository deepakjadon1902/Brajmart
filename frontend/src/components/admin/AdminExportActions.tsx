import { FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { exportAdminData, type ExportColumn } from '@/lib/adminExport';

type AdminExportActionsProps<T> = {
  title: string;
  fileName: string;
  rows: T[];
  columns: ExportColumn<T>[];
  className?: string;
};

const AdminExportActions = <T,>({ title, fileName, rows, columns, className = '' }: AdminExportActionsProps<T>) => {
  const disabled = rows.length === 0;

  const runExport = () => {
    if (disabled) {
      toast.info('No rows available to export');
      return;
    }
    exportAdminData({ title, fileName, rows, columns, format: 'excel' });
    toast.success(`${title} Excel export downloaded`);
  };

  const buttonClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-amber-500/50 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`} aria-label={`${title} export actions`}>
      <button type="button" onClick={runExport} disabled={disabled} className={buttonClass} title="Download Excel-compatible spreadsheet">
        <FileSpreadsheet size={15} />
        Excel
      </button>
    </div>
  );
};

export default AdminExportActions;
