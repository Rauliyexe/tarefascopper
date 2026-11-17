import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';

export interface RowAction {
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

interface RowActionsProps {
  actions: RowAction[];
  align?: 'left' | 'right';
}

/**
 * Menu de ações por linha de tabela (Editar / Excluir / ações do módulo).
 * Renderizado via Portal (document.body) com position: fixed para sobrepor
 * perfeitamente qualquer tabela, card ou container com overflow-hidden/auto.
 */
export const RowActions: React.FC<RowActionsProps> = ({ actions, align = 'right' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left?: number; right?: number } | null>(null);

  // Calcula coordenadas exatas da viewport para sobrepor perfeitamente
  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const approxMenuHeight = actions.length * 36 + 12;

    const spaceBelow = window.innerHeight - rect.bottom;
    const shouldOpenUp = spaceBelow < approxMenuHeight && rect.top > approxMenuHeight;

    const top = shouldOpenUp ? rect.top - approxMenuHeight - 4 : rect.bottom + 4;

    if (align === 'right') {
      const right = Math.max(8, window.innerWidth - rect.right);
      setPosition({ top, right });
    } else {
      const left = Math.max(8, rect.left);
      setPosition({ top, left });
    }
  };

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = (e: Event) => {
      // Se rolar a página ou container, fecha o menu para evitar descolamento visual
      if (e.target !== menuRef.current) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  const menuNode = isOpen && position && (
    <div
      ref={menuRef}
      role="menu"
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: position.left !== undefined ? `${position.left}px` : undefined,
        right: position.right !== undefined ? `${position.right}px` : undefined,
        zIndex: 9999,
      }}
      className="w-48 py-1.5 rounded-xl bg-white dark:bg-night-900 border border-gray-200 dark:border-night-800 shadow-2xl animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/10 dark:ring-white/10"
    >
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            role="menuitem"
            type="button"
            disabled={action.disabled}
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              action.onClick();
            }}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
              action.variant === 'danger'
                ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-night-800'
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
            <span className="truncate">{action.label}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="relative inline-block text-left">
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(prev => !prev);
        }}
        aria-label="Mais ações"
        title="Mais ações"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
          isOpen
            ? 'bg-gray-200 dark:bg-night-700 text-gray-900 dark:text-white ring-1 ring-gray-300 dark:ring-night-600'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-night-800'
        }`}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(menuNode, document.body)}
    </div>
  );
};

export default RowActions;
