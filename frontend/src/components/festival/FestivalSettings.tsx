import { useRef, useState } from 'react';
import { Check, Loader2, Power } from 'lucide-react';
import { useSettingsStore, type FestivalTheme } from '@/store/settingsStore';
import { updatePublicSettings } from '@/lib/api';
import { FestivalArtwork } from './FestivalArtwork';
import { festivalCopy } from './festivalTheme';
import './festival.css';

export default function FestivalSettings({ disabled = false }: { disabled?: boolean }) {
  const theme = useSettingsStore(s => s.settings.festivalTheme);
  const updateSettings = useSettingsStore(s => s.updateSettings);
  const [saving, setSaving] = useState<FestivalTheme | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('Choose a festival to apply its decorations to your storefront.');
  const busy = useRef(false);

  const selectTheme = async (next: FestivalTheme) => {
    if (disabled || busy.current || next === theme) return;
    busy.current = true;
    setSaving(next);
    setError('');
    try {
      const updated = await updatePublicSettings({ festivalTheme: next });
      // A backend that has not been updated must not report a false success.
      if (updated?.festivalTheme !== next) throw new Error('Festival settings could not be saved. Update the backend and try again.');
      updateSettings({ festivalTheme: updated.festivalTheme });
      setMessage(next === 'none' ? 'Decorations are off. Your original storefront is active.' : `${festivalCopy[next].name} is saved for all visitors. Open storefronts refresh within a minute.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save festival decorations. Please try again.');
    } finally {
      busy.current = false;
      setSaving(null);
    }
  };

  return <section className="festival-settings" aria-labelledby="festival-settings-title" aria-busy={saving !== null}>
    <div className="festival-settings-heading">
      <div>
        <p className="festival-settings-kicker">The festive edit</p>
        <h2 id="festival-settings-title">Dress your store for the occasion</h2>
        <p className="festival-settings-summary">Decorate every storefront page with festive objects and a matching toran. Visitors receive a centred festival greeting on the homepage, once per visit or refresh.</p>
      </div>
      <span className="festival-status"><span className="festival-status-dot" />{theme === 'none' ? 'Decorations off' : `${festivalCopy[theme].name} active`}</span>
    </div>
    <div className="festival-options" role="group" aria-label="Storefront festival decoration">
      {(['diwali', 'holi'] as const).map(option => <button key={option} type="button" className="festival-option" aria-pressed={theme === option} aria-label={`Apply ${festivalCopy[option].name} decorations`} disabled={disabled || saving !== null} onClick={() => selectTheme(option)}>
        <div className={`festival-option-visual festival-${option}`}>
          <FestivalArtwork theme={option} idPrefix={`settings-${option}`} />
          <small>{option === 'diwali' ? 'The festival of lights' : 'The colours of togetherness'}</small>
        </div>
        <div className="festival-option-info">
          <div><strong>{festivalCopy[option].name}</strong><small>{festivalCopy[option].detail}</small></div>
          <span className="festival-option-check" aria-hidden="true">{saving === option ? <Loader2 size={14} className="animate-spin" /> : theme === option ? <Check size={14} /> : null}</span>
        </div>
      </button>)}
    </div>
    <div className="festival-settings-bottom">
      <p className="festival-settings-feedback" role="status">{saving !== null ? 'Saving your storefront decoration…' : message}</p>
      <button type="button" className="festival-off" onClick={() => selectTheme('none')} disabled={disabled || saving !== null || theme === 'none'}><Power size={13} />Turn decorations off</button>
    </div>
    {error && <p className="festival-settings-error" role="alert">{error}</p>}
  </section>;
}
