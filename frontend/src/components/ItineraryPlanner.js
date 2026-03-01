import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { itineraryAPI, chatAPI, paymentAPI } from '../services/api';

/* ──────────────────────────────────────────────
   Constants
────────────────────────────────────────────── */

/** Estimated daily cost per person (PKR) by budget level */
const BUDGET_ESTIMATES = {
  LOW:    { min: 3000,  max: 6000,  label: 'Budget',  emoji: '💚', color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/20' },
  MEDIUM: { min: 6000,  max: 15000, label: 'Medium',  emoji: '💛', color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
  LUXURY: { min: 15000, max: 40000, label: 'Luxury',  emoji: '💎', color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
};

const INTEREST_OPTIONS = [
  { id: 'History',           emoji: '🏛️' },
  { id: 'Culture',           emoji: '🎭' },
  { id: 'Food',              emoji: '🍛' },
  { id: 'Shopping',          emoji: '🛍️' },
  { id: 'Nature',            emoji: '🌿' },
  { id: 'Religious sites',   emoji: '🕌' },
  { id: 'Modern attractions',emoji: '🏙️' },
];

const MOOD_OPTIONS = [
  { value: 'RELAXING',   label: 'Relaxing',    emoji: '🧘', gradient: 'from-teal-400 to-cyan-500',    desc: 'Peaceful & calm' },
  { value: 'SPIRITUAL',  label: 'Spiritual',   emoji: '🕌', gradient: 'from-amber-500 to-yellow-400',  desc: 'Sacred & mindful' },
  { value: 'HISTORICAL', label: 'Historical',  emoji: '🏛️', gradient: 'from-stone-500 to-amber-600',  desc: 'Rich heritage' },
  { value: 'FOODIE',     label: 'Foodie',      emoji: '🍛', gradient: 'from-orange-500 to-red-500',    desc: 'Culinary delights' },
  { value: 'FUN',        label: 'Fun & Thrill',emoji: '🎢', gradient: 'from-pink-500 to-purple-500',   desc: 'Exciting adventures' },
  { value: 'SHOPPING',   label: 'Shopping',    emoji: '🛍️', gradient: 'from-violet-500 to-blue-500',  desc: 'Bazaars & malls' },
  { value: 'NATURE',     label: 'Nature',      emoji: '🌿', gradient: 'from-green-500 to-emerald-500', desc: 'Parks & gardens' },
  { value: 'ROMANTIC',   label: 'Romantic',    emoji: '💕', gradient: 'from-rose-500 to-pink-400',     desc: 'For couples' },
  { value: 'FAMILY',     label: 'Family',      emoji: '👨‍👩‍👧‍👦', gradient: 'from-blue-500 to-sky-500', desc: 'Fun for all ages' },
];

const SLOT_STYLE = {
  morning:   { color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300', dot: 'bg-amber-500'  },
  afternoon: { color: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',         dot: 'bg-sky-500'    },
  evening:   { color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300', dot: 'bg-purple-500' },
  default:   { color: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',        dot: 'bg-gray-400'   },
};

/* ──────────────────────────────────────────────
   Helpers
────────────────────────────────────────────── */
const fmt = (d) => {
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const padDate = (d) => {
  const dt = new Date();
  dt.setDate(dt.getDate() + d);
  return dt.toISOString().split('T')[0];
};

const slotStyle = (slot) => SLOT_STYLE[slot?.toLowerCase()] || SLOT_STYLE.default;

const CATEGORY_ICONS = {
  'Historical':   '🏛️', 'Spiritual':    '🕌', 'Food':       '🍛',
  'Shopping':     '🛍️', 'Nature':       '🌿', 'Adventure':  '🎢',
  'Entertainment':'🎭', 'Modern':       '🏙️', 'Relaxation': '🧘',
  'Religious':    '☪️',  'Museum':       '🖼️', 'Garden':     '🌺',
  default:        '📍',
};

const categoryIcon = (cat) => CATEGORY_ICONS[cat] || CATEGORY_ICONS.default;

/* ──────────────────────────────────────────────
   Sub-components
────────────────────────────────────────────── */

/** Big mood selection card */
const MoodCard = ({ mood, selected, onClick }) => (
  <motion.button
    type="button"
    onClick={onClick}
    whileHover={{ scale: 1.04 }}
    whileTap={{ scale: 0.97 }}
    className={`relative overflow-hidden rounded-2xl p-4 flex flex-col gap-2 transition-all border-2 text-left
      ${selected
        ? 'border-white shadow-2xl shadow-purple-500/40 scale-105'
        : 'border-transparent opacity-80 hover:opacity-100'
      }`}
  >
    <div className={`absolute inset-0 bg-gradient-to-br ${mood.gradient} opacity-${selected ? '100' : '60'}`} />
    <div className="relative z-10">
      <span className="text-3xl">{mood.emoji}</span>
      <p className="font-bold text-white text-sm mt-1">{mood.label}</p>
      <p className="text-white/75 text-xs">{mood.desc}</p>
      {selected && (
        <div className="absolute top-0 right-0 w-5 h-5 bg-white rounded-full flex items-center justify-center">
          <span className="text-green-600 text-xs">✓</span>
        </div>
      )}
    </div>
  </motion.button>
);

/** Place item in a day card */
const PlaceItem = ({ item, dayIdx, itemIdx, itinerary, loading, onLock, onReplace, onRemove }) => {
  const locked = (itinerary.locked_place_ids || []).includes(item.place_id);
  const ss = slotStyle(item.slot);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors group"
    >
      {/* Slot indicator */}
      <div className="flex-shrink-0 flex flex-col items-center gap-1">
        <div className={`w-2.5 h-2.5 rounded-full ${ss.dot}`} />
        {itemIdx < 99 && <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />}
      </div>

      {/* Place info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ss.color}`}>
            {item.slot || 'visit'}
          </span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {categoryIcon(item.category)} {item.name}
          </span>
        </div>
        {item.category && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 ml-0">{item.category}</p>
        )}
      </div>

      {/* Actions (visible on hover) */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          disabled={loading}
          onClick={() => onLock(item.place_id, locked)}
          title={locked ? 'Unlock place' : 'Lock place (keep on regeneration)'}
          className={`p-1.5 rounded-lg text-xs transition-colors ${
            locked
              ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400'
          }`}
        >
          {locked ? '🔒' : '🔓'}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => onReplace(dayIdx, itemIdx)}
          title="Replace with another place"
          className="p-1.5 rounded-lg text-xs hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 transition-colors"
        >
          🔄
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => onRemove(dayIdx, itemIdx)}
          title="Remove place"
          className="p-1.5 rounded-lg text-xs hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 transition-colors"
        >
          ✕
        </button>
      </div>
    </motion.div>
  );
};

/** Day card */
const DayCard = ({ day, dayIdx, itinerary, loading, onRegenDay, onLock, onReplace, onRemove, onReorder }) => {
  const items = day.items || [];
  // Group by slot for overview
  const morning   = items.filter(i => i.slot?.toLowerCase() === 'morning');
  const afternoon = items.filter(i => i.slot?.toLowerCase() === 'afternoon');
  const evening   = items.filter(i => i.slot?.toLowerCase() === 'evening');
  const other     = items.filter(i => !['morning','afternoon','evening'].includes(i.slot?.toLowerCase()));

  const renderGroup = (label, group, icon) => {
    if (!group.length) return null;
    return (
      <div>
        <div className="flex items-center gap-2 mb-1 px-3">
          <span className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider">{icon} {label}</span>
        </div>
        <AnimatePresence>
          {group.map((item, idx) => {
            const globalIdx = items.indexOf(item);
            return (
              <PlaceItem
                key={`${dayIdx}-${globalIdx}`}
                item={item}
                dayIdx={dayIdx}
                itemIdx={globalIdx}
                itinerary={itinerary}
                loading={loading}
                onLock={onLock}
                onReplace={onReplace}
                onRemove={onRemove}
              />
            );
          })}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden"
    >
      {/* Day header */}
      <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-800 border-b border-gray-100 dark:border-gray-700">
        <div>
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Day {dayIdx + 1} · {day.date ? fmt(day.date) : ''}
          </p>
          <h4 className="font-bold text-gray-900 dark:text-white text-sm">{day.title || `Day ${dayIdx + 1}`}</h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{items.length} place{items.length !== 1 ? 's' : ''}</span>
          <button
            type="button"
            disabled={loading}
            onClick={() => onRegenDay(dayIdx)}
            className="px-3 py-1.5 text-xs font-medium rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors disabled:opacity-50"
          >
            🔄 Regenerate day
          </button>
        </div>
      </div>

      {/* Places */}
      <div className="p-3 space-y-2">
        {morning.length > 0 && renderGroup('Morning', morning, '🌅')}
        {afternoon.length > 0 && renderGroup('Afternoon', afternoon, '☀️')}
        {evening.length > 0 && renderGroup('Evening', evening, '🌙')}
        {other.length > 0 && renderGroup('Visit', other, '📍')}
        {items.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No places — try regenerating.</p>
        )}
      </div>
    </motion.div>
  );
};

/* ──────────────────────────────────────────────
   Main Component
────────────────────────────────────────────── */
export default function ItineraryPlanner() {
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  /* Form state */
  const [city, setCity]               = useState('Lahore');
  const [startDate, setStartDate]     = useState(padDate(1));
  const [endDate, setEndDate]         = useState(padDate(4));
  const [travelers, setTravelers]     = useState(2);
  const [budgetLevel, setBudgetLevel] = useState('MEDIUM');
  const [pace, setPace]               = useState('BALANCED');
  const [interests, setInterests]     = useState(['History', 'Culture', 'Food']);
  const [mood, setMood]               = useState('');

  /* Result state */
  const [itinerary, setItinerary] = useState(null);
  const [notes, setNotes]         = useState('');
  const [aiAdvice, setAiAdvice]   = useState('');
  const [copied, setCopied]       = useState(false);

  const selectedInterestsLabel = useMemo(() => interests.join(' · '), [interests]);
  const foundMood = useMemo(() => MOOD_OPTIONS.find(m => m.value === mood), [mood]);

  /* Load latest on mount */
  useEffect(() => {
    let mounted = true;
    itineraryAPI.list().then(res => {
      const list = res.data?.itineraries || [];
      if (mounted && list.length) {
        setItinerary(list[0]);
        setNotes(list[0]?.notes || '');
      }
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  const toggleInterest = useCallback((id) => {
    setInterests(prev => prev.includes(id)
      ? prev.filter(x => x !== id)
      : [...prev, id]);
  }, []);

  /* ── Generate ── */
  const handleGenerate = async (e) => {
    e?.preventDefault?.();
    setLoading(true);
    setError('');
    setAiAdvice('');
    try {
      const res = await itineraryAPI.generate({
        city, start_date: startDate, end_date: endDate,
        travelers: Number(travelers) || 1,
        budget_level: budgetLevel, interests, pace, mood,
      });
      const it = res.data?.itinerary;
      setItinerary(it);
      setNotes(it?.notes || '');

      // Non-blocking AI tip
      try {
        const msg = [
          `User is planning a ${foundMood ? foundMood.label : ''} trip to ${it.city} (${it.start_date} → ${it.end_date}).`,
          `${it.travelers} travelers, ${it.budget_level} budget, ${it.pace} pace.`,
          `Interests: ${(it.interests || []).join(', ')}.`,
          'Give a 2-sentence warm welcome + 3 quick local tips for this mood and interests.'
        ].join(' ');
        const chatRes = await chatAPI.sendMessage(msg);
        setAiAdvice(chatRes.data?.reply || '');
      } catch { /* non-critical */ }
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to generate itinerary');
    } finally {
      setLoading(false);
    }
  };

  /* ── Save notes ── */
  const handleSaveNotes = async () => {
    if (!itinerary?.id) return;
    setLoading(true);
    try {
      const res = await itineraryAPI.update(itinerary.id, { notes });
      setItinerary(res.data?.itinerary);
    } catch (err) {
      setError(err?.message || 'Failed to save notes');
    } finally { setLoading(false); }
  };

  /* ── Day / place actions ── */
  const makeAction = (apiCall) => async (...args) => {
    if (!itinerary?.id) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiCall(...args);
      setItinerary(res.data?.itinerary);
    } catch (err) {
      setError(err?.message || 'Action failed');
    } finally { setLoading(false); }
  };

  const handleRegenerateDay  = makeAction((di) => itineraryAPI.regenerateDay(itinerary.id, di));
  const handleRegenerateFull = makeAction(() => itineraryAPI.regenerateFull(itinerary.id, { mood }));
  const handleReplacePlace   = makeAction((di, ii) => itineraryAPI.replacePlace(itinerary.id, di, ii, null));
  const handleRemovePlace    = makeAction((di, ii) => itineraryAPI.removePlace(itinerary.id, di, ii));
  const handleLockPlace      = makeAction((pid, locked) => itineraryAPI.lockPlace(itinerary.id, pid, !locked));

  /* ── Share ── */
  const handleShare = () => {
    const url = `${window.location.origin}/itinerary?id=${itinerary?.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  /* ── Email Itinerary ── */
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent]       = useState(false);

  const handleEmailItinerary = async () => {
    if (!itinerary) return;
    setEmailSending(true);
    try {
      // Build a plain-text summary for email
      const daysSummary = (itinerary.days || []).map((d, i) =>
        `Day ${i+1} (${d.date || ''}) - ${d.title || ''}\n` +
        (d.items || []).map(it => `  • [${it.slot || 'Visit'}] ${it.name} (${it.category || ''})`).join('\n')
      ).join('\n\n');

      await paymentAPI.sendConfirmation(null, {
        type: 'itinerary',
        subject: `Your ${itinerary.city} Itinerary`,
        body: `🗺️ ${itinerary.city} Itinerary\n${itinerary.start_date} → ${itinerary.end_date}\nPace: ${itinerary.pace} | Budget: ${itinerary.budget_level}\n\n${daysSummary}\n\n${notes ? `Notes: ${notes}` : ''}`,
      });
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 3000);
    } catch {
      // Silently fail — email is a nice-to-have
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 3000);
    } finally { setEmailSending(false); }
  };

  /* ── Trip stats (memo) ── */
  const tripStats = useMemo(() => {
    if (!itinerary) return null;
    const days = itinerary.days || [];
    const totalPlaces = days.reduce((sum, d) => sum + (d.items?.length || 0), 0);
    const numDays = days.length || 1;
    const numTravelers = itinerary.travelers || Number(travelers) || 1;
    const budgetInfo = BUDGET_ESTIMATES[itinerary.budget_level] || BUDGET_ESTIMATES.MEDIUM;
    const totalMin = budgetInfo.min * numDays * numTravelers;
    const totalMax = budgetInfo.max * numDays * numTravelers;
    const fmtPKR = (n) => `PKR ${n.toLocaleString()}`;
    return {
      totalPlaces, numDays, numTravelers,
      dailyCost: `${fmtPKR(budgetInfo.min)} – ${fmtPKR(budgetInfo.max)}`,
      totalCost: `${fmtPKR(totalMin)} – ${fmtPKR(totalMax)}`,
      budgetInfo,
      avgPerDay: Math.round(totalPlaces / numDays),
    };
  }, [itinerary, travelers]);

  /* ── PDF export ── */
  const handleExport = () => {
    if (!itinerary) return;
    const moodInfo = foundMood ? `${foundMood.emoji} ${foundMood.label}` : '';
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${itinerary.city} Itinerary</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Inter', Arial, sans-serif; background: #f8fafc; color: #1e293b; }
  .hero { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 40px; }
  .hero h1 { font-size: 32px; font-weight: 700; }
  .hero p  { font-size: 14px; opacity: 0.85; margin-top: 6px; }
  .container { max-width: 780px; margin: 0 auto; padding: 32px 24px; }
  .day { background: white; border-radius: 16px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
  .day-header { border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 14px; }
  .day-title  { font-size: 16px; font-weight: 700; color: #1e293b; }
  .day-date   { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
  .slot-label { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px; margin-right: 8px; }
  .morning   { background: #fef3c7; color: #92400e; }
  .afternoon { background: #dbeafe; color: #1e40af; }
  .evening   { background: #f3e8ff; color: #6b21a8; }
  .item      { display: flex; align-items: flex-start; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
  .item:last-child { border-bottom: none; }
  .item-name { font-size: 14px; font-weight: 600; }
  .item-cat  { font-size: 11px; color: #94a3b8; }
  .notes-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-top: 20px; }
  .footer    { text-align: center; font-size: 11px; color: #94a3b8; margin-top: 30px; }
</style>
</head>
<body>
<div class="hero">
  <h1>${itinerary.city} Travel Itinerary</h1>
  <p>${itinerary.start_date} → ${itinerary.end_date} · Pace: ${itinerary.pace} · Budget: ${itinerary.budget_level}${moodInfo ? ` · Mood: ${moodInfo}` : ''}</p>
</div>
<div class="container">
${(itinerary.days || []).map((d) => `
<div class="day">
  <div class="day-header">
    <div class="day-date">${d.date || ''}</div>
    <div class="day-title">${d.title || ''}</div>
  </div>
  ${(d.items || []).map(it => `
  <div class="item">
    <span class="slot-label ${it.slot?.toLowerCase() || ''}">${it.slot || 'Visit'}</span>
    <div>
      <div class="item-name">${it.name}</div>
      <div class="item-cat">${it.category || ''}</div>
    </div>
  </div>`).join('')}
</div>`).join('')}
${notes ? `<div class="notes-box"><strong>My Notes</strong><br><br>${notes.replace(/</g,'&lt;')}</div>` : ''}
<div class="footer">Generated by Travello AI · ${new Date().toLocaleDateString()}</div>
</div>
<script>window.onload = () => { window.print(); };</script>
</body>
</html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  /* ── Render ── */
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">

      {/* ── Header Banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 p-6 text-white shadow-xl">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&auto=format&fit=crop")' }} />
        <div className="relative z-10">
          <h2 className="text-2xl font-bold">🗺️ AI Itinerary Planner</h2>
          <p className="text-purple-200 mt-1 text-sm">Personalized day-by-day plans for Lahore, powered by AI</p>
        </div>
      </div>

      {/* ── Form Card ── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Plan your trip</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Set your preferences to generate a personalised itinerary</p>
          </div>
        </div>

        <form onSubmit={handleGenerate} className="p-6 space-y-7">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Basic inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: 'City', type: 'text',   val: city,      set: setCity },
              { label: 'Start date', type: 'date', val: startDate, set: setStartDate },
              { label: 'End date',   type: 'date', val: endDate,   set: setEndDate },
            ].map(({ label, type, val, set }) => (
              <div key={label}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
                <input
                  type={type}
                  value={val}
                  onChange={e => set(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-white text-sm outline-none focus:border-violet-500 transition-colors"
                />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Travelers</label>
              <input
                type="number" min={1} max={20}
                value={travelers}
                onChange={e => setTravelers(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-white text-sm outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Budget</label>
              <select
                value={budgetLevel}
                onChange={e => setBudgetLevel(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-white text-sm outline-none focus:border-violet-500"
              >
                <option value="LOW">💚 Budget / Low</option>
                <option value="MEDIUM">💛 Medium</option>
                <option value="LUXURY">💎 Luxury</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Travel Pace</label>
              <select
                value={pace}
                onChange={e => setPace(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-white text-sm outline-none focus:border-violet-500"
              >
                <option value="RELAXED">🐢 Relaxed (3/day)</option>
                <option value="BALANCED">⚖️ Balanced (4–5/day)</option>
                <option value="PACKED">🚀 Packed (6+/day)</option>
              </select>
            </div>
          </div>

          {/* Interests */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Interests <span className="text-xs font-normal text-gray-400">({interests.length} selected)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map(({ id, emoji }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleInterest(id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all ${
                    interests.includes(id)
                      ? 'bg-violet-600 text-white border-violet-600 shadow-md'
                      : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-violet-400'
                  }`}
                >
                  <span>{emoji}</span> {id}
                </button>
              ))}
            </div>
            {interests.length > 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Selected: {selectedInterestsLabel}</p>
            )}
          </div>

          {/* Mood Cards */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              🎭 Mood — How do you want to feel?
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
              {MOOD_OPTIONS.map(m => (
                <MoodCard
                  key={m.value}
                  mood={m}
                  selected={mood === m.value}
                  onClick={() => setMood(mood === m.value ? '' : m.value)}
                />
              ))}
            </div>
            {foundMood && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-purple-600 dark:text-purple-400 mt-3 flex items-center gap-2"
              >
                {foundMood.emoji} <strong>{foundMood.label}</strong> — places will be tailored to this vibe.
              </motion.p>
            )}
          </div>

          {/* Submit */}
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-60 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2"
            >
              {loading ? '⏳ Generating…' : '✨ Generate Itinerary'}
            </button>

            {itinerary && (
              <>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleExport}
                  className="px-5 py-3 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl font-medium text-sm"
                >
                  📄 Export PDF
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  className="px-5 py-3 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl font-medium text-sm"
                >
                  {copied ? '✅ Copied!' : '🔗 Share'}
                </button>
                <button
                  type="button"
                  disabled={emailSending}
                  onClick={handleEmailItinerary}
                  className="px-5 py-3 border border-indigo-200 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl font-medium text-sm disabled:opacity-50"
                >
                  {emailSent ? '✅ Sent!' : emailSending ? '📧 Sending…' : '📧 Email Itinerary'}
                </button>
              </>
            )}
          </div>
        </form>
      </div>

      {/* ── Itinerary Result ── */}
      <AnimatePresence mode="wait">
        {itinerary && (
          <motion.div
            key={itinerary.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            className="space-y-4"
          >
            {/* Result Header */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-100 dark:border-gray-700 p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-lg">{itinerary.city} Itinerary</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {itinerary.start_date} → {itinerary.end_date} · {itinerary.pace} pace · {itinerary.budget_level} budget
                  {itinerary.mood && <span> · {MOOD_OPTIONS.find(m => m.value === itinerary.mood)?.emoji} {itinerary.mood}</span>}
                </p>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={handleRegenerateFull}
                className="px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium text-sm rounded-xl shadow disabled:opacity-50 transition-all"
              >
                🔄 Regenerate Full Trip
              </button>
            </div>

            {/* Trip Budget & Stats Summary */}
            {tripStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Days',           value: tripStats.numDays,       icon: '📅', color: 'text-blue-600 dark:text-blue-400' },
                  { label: 'Total Places',   value: tripStats.totalPlaces,   icon: '📍', color: 'text-emerald-600 dark:text-emerald-400' },
                  { label: 'Avg/Day',        value: `${tripStats.avgPerDay} places`, icon: '⚡', color: 'text-amber-600 dark:text-amber-400' },
                  { label: 'Travelers',      value: tripStats.numTravelers,  icon: '👥', color: 'text-purple-600 dark:text-purple-400' },
                ].map(s => (
                  <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 text-center">
                    <span className="text-2xl">{s.icon}</span>
                    <p className={`text-lg font-bold ${s.color} mt-1`}>{s.value}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Budget Estimation Card */}
            {tripStats && (
              <div className={`rounded-2xl border border-gray-100 dark:border-gray-700 p-5 ${tripStats.budgetInfo.bg}`}>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                      {tripStats.budgetInfo.emoji} Estimated Trip Budget
                      <span className={`text-xs px-2 py-0.5 rounded-full ${tripStats.budgetInfo.bg} ${tripStats.budgetInfo.color} font-medium`}>
                        {tripStats.budgetInfo.label}
                      </span>
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Based on {tripStats.numDays} day(s) × {tripStats.numTravelers} traveler(s) · Estimates for food, transport & activities
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${tripStats.budgetInfo.color}`}>{tripStats.totalCost}</p>
                    <p className="text-xs text-gray-400">{tripStats.dailyCost} / person / day</p>
                  </div>
                </div>
              </div>
            )}

            {/* Day cards */}
            <div className="space-y-4">
              {(itinerary.days || []).map((day, dayIdx) => (
                <DayCard
                  key={day.date || dayIdx}
                  day={day}
                  dayIdx={dayIdx}
                  itinerary={itinerary}
                  loading={loading}
                  onRegenDay={handleRegenerateDay}
                  onLock={handleLockPlace}
                  onReplace={handleReplacePlace}
                  onRemove={handleRemovePlace}
                />
              ))}
            </div>

            {/* AI Advice */}
            <AnimatePresence>
              {aiAdvice && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-100 dark:border-purple-800 rounded-2xl p-5"
                >
                  <h4 className="text-sm font-bold text-purple-800 dark:text-purple-200 mb-2">🤖 AI Personalised Tips</h4>
                  <p className="text-sm text-purple-900 dark:text-purple-100 whitespace-pre-line leading-relaxed">{aiAdvice}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Notes */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-100 dark:border-gray-700 p-5">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                📓 Personal Notes / Travel Journal
              </label>
              <textarea
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white text-sm outline-none focus:border-violet-500 resize-none transition-colors"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add reminders, restaurant picks, packing notes…"
              />
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSaveNotes}
                  className="px-5 py-2.5 bg-gray-900 dark:bg-white dark:text-gray-900 text-white rounded-xl font-medium text-sm hover:opacity-90 disabled:opacity-60"
                >
                  💾 Save Notes
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
