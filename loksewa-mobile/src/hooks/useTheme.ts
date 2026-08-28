/**
 * useTheme — the ONE way screens read colors (master-prompt rule 28).
 *
 * Resolves the user's theme mode (system/light/dark from settingsStore)
 * against the OS color scheme and returns the matching token set. Screens and
 * components must never import `themes.light` directly — that hard-coding is
 * exactly what blocked dark mode previously.
 */
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { themes, type AppTheme } from '../constants/theme';
import { useSettingsStore } from '../stores/settingsStore';

let hydrateScheduled = false;

export function useTheme(): AppTheme {
  const mode = useSettingsStore((s) => s.themeMode);
  const hydrated = useSettingsStore((s) => s.hydrated);
  const hydrate = useSettingsStore((s) => s.hydrate);
  const scheme = useColorScheme();

  // Components can render before the root layout finishes hydrating the
  // settings store; schedule hydration lazily once so early frames still get
  // a sensible theme ('system' default).
  useEffect(() => {
    if (!hydrated && !hydrateScheduled) {
      hydrateScheduled = true;
      hydrate().finally(() => {
        hydrateScheduled = false;
      });
    }
  }, [hydrated, hydrate]);

  const dark = mode === 'dark' || (mode === 'system' && scheme === 'dark');
  return dark ? themes.dark : themes.light;
}
