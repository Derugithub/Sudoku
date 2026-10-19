import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { translator, type Translate } from '@/i18n';
import { DEFAULT_SETTINGS, migrateSettings, type Settings } from '@/lib/settings-model';
import { KEYS, readRaw, writeRaw } from '@/lib/storage';

type SettingsValue = {
  settings: Settings;
  loaded: boolean;
  update: (patch: Partial<Settings>) => void;
  t: Translate;
};

const SettingsContext = createContext<SettingsValue>({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  update: () => undefined,
  t: translator('en'),
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    readRaw(KEYS.settings).then((raw) => {
      if (!alive) return;
      const { settings: next, changed } = migrateSettings(raw);
      // Rewrite once so dropped keys (the old three-mistake toggle) leave storage.
      if (changed) void writeRaw(KEYS.settings, JSON.stringify(next));
      setSettings(next);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void writeRaw(KEYS.settings, JSON.stringify(next));
      return next;
    });
  }, []);

  const t = useMemo(() => translator(settings.language), [settings.language]);
  const value = useMemo(() => ({ settings, loaded, update, t }), [settings, loaded, update, t]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  return useContext(SettingsContext);
}

export function useT(): Translate {
  return useContext(SettingsContext).t;
}
