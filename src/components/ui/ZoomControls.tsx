import React, { useEffect } from 'react';
import { Plus, Minus, Maximize2, Eye, EyeOff } from 'lucide-react';

interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  isDecluttered?: boolean;
  onToggleDeclutter?: () => void;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onResetZoom,
  isDecluttered = false,
  onToggleDeclutter,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in input, select, or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        onZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        onZoomOut();
      } else if (e.key === '0' || e.key === 'Home') {
        e.preventDefault();
        onResetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onZoomIn, onZoomOut, onResetZoom]);

  return (
    <div className="fixed bottom-6 right-6 z-20 flex flex-col items-center space-y-1.5 select-none">
      <div className="flex flex-col bg-gray-950/85 backdrop-blur-md border border-gray-800/80 rounded-2xl shadow-2xl p-1 text-gray-200">
        <button
          onClick={onZoomIn}
          className="p-2.5 rounded-xl hover:bg-gray-800/80 text-gray-300 hover:text-white transition-all active:scale-95 flex items-center justify-center group"
          title="Zoom In (+ or Scroll Up)"
          aria-label="Zoom In"
        >
          <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
        </button>

        <button
          onClick={onResetZoom}
          className="p-2.5 rounded-xl hover:bg-gray-800/80 text-gray-300 hover:text-white transition-all active:scale-95 flex items-center justify-center group"
          title="Reset Zoom / Fit View (0)"
          aria-label="Reset Zoom"
        >
          <Maximize2 className="w-4 h-4 group-hover:scale-110 transition-transform text-cyan-400" />
        </button>

        <button
          onClick={onZoomOut}
          className="p-2.5 rounded-xl hover:bg-gray-800/80 text-gray-300 hover:text-white transition-all active:scale-95 flex items-center justify-center group"
          title="Zoom Out (- or Scroll Down)"
          aria-label="Zoom Out"
        >
          <Minus className="w-4 h-4 group-hover:scale-110 transition-transform" />
        </button>

        {onToggleDeclutter && (
          <>
            <div className="my-1 border-t border-gray-800/80 w-6 self-center" />
            <button
              onClick={onToggleDeclutter}
              className={`p-2.5 rounded-xl transition-all active:scale-95 flex items-center justify-center group ${
                isDecluttered
                  ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40'
                  : 'hover:bg-gray-800/80 text-gray-400 hover:text-gray-200'
              }`}
              title={isDecluttered ? 'Restore Control Panels' : 'Declutter View (Collapse Panels)'}
              aria-label={isDecluttered ? 'Restore Control Panels' : 'Declutter View'}
            >
              {isDecluttered ? (
                <Eye className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
              ) : (
                <EyeOff className="w-4 h-4 group-hover:scale-110 transition-transform" />
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
