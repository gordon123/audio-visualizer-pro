
import React from 'react';
import type { Theme } from '../types';
import { THEMES } from '../constants';
import { createGradient } from '../utils/colors';

interface ThemePickerProps {
  onThemeSelect: (settings: Theme['settings'] & { theme: Theme['name'] }) => void;
}

const ThemePicker: React.FC<ThemePickerProps> = ({ onThemeSelect }) => {
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {THEMES.map((theme: Theme) => {
          const gradientCss = `linear-gradient(45deg, ${theme.settings.stops.map(s => `${s.color} ${s.position * 100}%`).join(', ')})`;
          return (
            <button
              key={theme.name}
              onClick={() => onThemeSelect({ ...theme.settings, theme: theme.name })}
              className="px-3 py-2 text-sm rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-500"
              style={{ 
                  background: gradientCss,
                  color: theme.name === 'ice' ? '#111' : '#fff',
                  textShadow: theme.name !== 'ice' ? '1px 1px 2px rgba(0,0,0,0.7)' : 'none'
              }}
            >
              {theme.name.charAt(0).toUpperCase() + theme.name.slice(1)}
            </button>
          )
        })}
      </div>
    </div>
  );
};

export default ThemePicker;
