import React, { useState } from 'react';
import { BarChart3, Table2 } from 'lucide-react';

export interface ChartTableData {
  columns: string[];
  rows: (string | number)[][];
}

interface ChartCardProps {
  title: string;
  subtitle?: string;
  /** Nota de rodapé — use para declarar a origem dos números. */
  footnote?: string;
  /** Equivalente em tabela: todo valor do gráfico precisa ser alcançável sem hover. */
  table: ChartTableData;
  children: React.ReactNode;
  className?: string;
}

/**
 * Card padrão dos gráficos, com alternância gráfico/tabela.
 *
 * A tabela não é um extra: é o caminho de leitura para quem não distingue as
 * cores, usa leitor de tela ou precisa do número exato.
 */
export const ChartCard: React.FC<ChartCardProps> = ({ title, subtitle, footnote, table, children, className }) => {
  const [showTable, setShowTable] = useState(false);

  return (
    <div
      className={`p-5 rounded-2xl bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 shadow-xs flex flex-col ${
        className || ''
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">{title}</h3>
          {subtitle && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{subtitle}</p>}
        </div>

        <button
          type="button"
          onClick={() => setShowTable(prev => !prev)}
          aria-pressed={showTable}
          title={showTable ? 'Ver como gráfico' : 'Ver os dados em tabela'}
          className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-night-800 text-[11px] font-semibold text-gray-600 dark:text-gray-300 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
        >
          {showTable ? <BarChart3 className="w-3.5 h-3.5" /> : <Table2 className="w-3.5 h-3.5" />}
          <span>{showTable ? 'Gráfico' : 'Dados'}</span>
        </button>
      </div>

      <div className="flex-1 min-w-0">
        {showTable ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-gray-500 dark:text-gray-400 border-b border-gray-200/80 dark:border-night-800">
                <tr>
                  {table.columns.map((column, index) => (
                    <th key={column} className={`py-2 pr-3 font-medium ${index > 0 ? 'text-right' : ''}`}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-night-800">
                {table.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td
                        key={cellIndex}
                        className={`py-2 pr-3 ${
                          cellIndex === 0
                            ? 'text-gray-700 dark:text-gray-300'
                            : 'text-right font-mono tabular-nums text-gray-900 dark:text-white'
                        }`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </div>

      {footnote && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-3 leading-relaxed">{footnote}</p>}
    </div>
  );
};
