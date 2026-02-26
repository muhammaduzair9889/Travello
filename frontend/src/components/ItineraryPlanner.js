import { useEffect, useMemo, useState } from 'react';
import { itineraryAPI, chatAPI } from '../services/api';

const INTEREST_OPTIONS = [
  'History',
  'Culture',
  'Food',
  'Shopping',
  'Nature',
  'Religious sites',
  'Modern attractions',
];

const formatDate = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDefaultStart = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatDate(d);
};

const getDefaultEnd = () => {
  const d = new Date();
  d.setDate(d.getDate() + 4);
  return formatDate(d);
};

export default function ItineraryPlanner() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [city, setCity] = useState('Lahore');
  const [startDate, setStartDate] = useState(getDefaultStart());
  const [endDate, setEndDate] = useState(getDefaultEnd());
  const [travelers, setTravelers] = useState(2);
  const [budgetLevel, setBudgetLevel] = useState('MEDIUM');
  const [pace, setPace] = useState('BALANCED');
  const [interests, setInterests] = useState(['History', 'Culture', 'Food']);

  const [itinerary, setItinerary] = useState(null);
  const [notes, setNotes] = useState('');
  const [aiAdvice, setAiAdvice] = useState('');

  const selectedInterestsLabel = useMemo(() => interests.join(', '), [interests]);

  useEffect(() => {
    let mounted = true;
    const loadLatest = async () => {
      try {
        const res = await itineraryAPI.list();
        const list = res.data?.itineraries || [];
        if (mounted && list.length) {
          setItinerary(list[0]);
          setNotes(list[0]?.notes || '');
        }
      } catch {
        // ignore
      }
    };
    loadLatest();
    return () => { mounted = false; };
  }, []);

  const toggleInterest = (value) => {
    setInterests((prev) => {
      if (prev.includes(value)) return prev.filter((x) => x !== value);
      return [...prev, value];
    });
  };

  const handleGenerate = async (e) => {
    e?.preventDefault?.();
    setLoading(true);
    setError('');
    setAiAdvice('');
    try {
      const res = await itineraryAPI.generate({
        city,
        start_date: startDate,
        end_date: endDate,
        travelers: Number(travelers) || 1,
        budget_level: budgetLevel,
        interests,
        pace,
      });
      const it = res.data?.itinerary;
      setItinerary(it);
      setNotes(it?.notes || '');

      // Ask AI for mood-aware suggestions based on the generated plan
      try {
        const summaryMessage = [
          `User is planning a trip to ${it.city} from ${it.start_date} to ${it.end_date}.`,
          `Travelers: ${it.travelers}. Budget: ${it.budget_level}. Pace: ${it.pace}.`,
          `Interests: ${(it.interests || []).join(', ') || 'not specified'}.`,
          'Suggest a short, friendly summary of this itinerary and 3 extra personalized tips (food, culture, or relaxing spots) based on this plan and the likely mood of the traveler.'
        ].join(' ');
        const chatRes = await chatAPI.sendMessage(summaryMessage);
        setAiAdvice(chatRes.data?.reply || '');
      } catch (adviceErr) {
        // Non-critical; just log to console and continue
        // eslint-disable-next-line no-console
        console.error('AI advice error', adviceErr);
      }
    } catch (err) {
      setError(err?.message || 'Failed to generate itinerary');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!itinerary?.id) return;
    setLoading(true);
    setError('');
    try {
      const res = await itineraryAPI.update(itinerary.id, { notes });
      setItinerary(res.data?.itinerary);
    } catch (err) {
      setError(err?.message || 'Failed to save notes');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateDay = async (dayIndex) => {
    if (!itinerary?.id) return;
    setLoading(true);
    setError('');
    try {
      const res = await itineraryAPI.regenerateDay(itinerary.id, dayIndex);
      setItinerary(res.data?.itinerary);
    } catch (err) {
      setError(err?.message || 'Failed to regenerate day');
    } finally {
      setLoading(false);
    }
  };

  const handleReplacePlace = async (dayIndex, itemIndex) => {
    if (!itinerary?.id) return;
    setLoading(true);
    setError('');
    try {
      const res = await itineraryAPI.replacePlace(itinerary.id, dayIndex, itemIndex, null);
      setItinerary(res.data?.itinerary);
    } catch (err) {
      setError(err?.message || 'Failed to replace place');
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePlace = async (dayIndex, itemIndex) => {
    if (!itinerary?.id) return;
    setLoading(true);
    setError('');
    try {
      const res = await itineraryAPI.removePlace(itinerary.id, dayIndex, itemIndex);
      setItinerary(res.data?.itinerary);
    } catch (err) {
      setError(err?.message || 'Failed to remove place');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPdf = () => {
    if (!itinerary) return;
    const html = `
      <html>
        <head>
          <title>Itinerary - ${itinerary.city}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { margin: 0 0 6px; }
            .meta { margin: 0 0 18px; color: #444; }
            .day { margin: 18px 0; padding-top: 12px; border-top: 1px solid #ddd; }
            .item { margin: 6px 0; }
            .slot { font-weight: bold; text-transform: capitalize; }
          </style>
        </head>
        <body>
          <h1>${itinerary.city} Itinerary</h1>
          <div class="meta">${itinerary.start_date} → ${itinerary.end_date} • Pace: ${itinerary.pace} • Budget: ${itinerary.budget_level}</div>
          ${(itinerary.days || []).map((d) => `
            <div class="day">
              <h2 style="margin:0 0 8px;">${d.title} (${d.date})</h2>
              ${(d.items || []).map((it) => `
                <div class="item"><span class="slot">${it.slot || ''}</span> — ${it.name} (${it.category})</div>
              `).join('')}
            </div>
          `).join('')}
          ${notes ? `<h2>Notes</h2><div>${String(notes).replace(/</g, '&lt;')}</div>` : ''}
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>
    `;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div className="bg-white dark:bg-surface-900 rounded-2xl shadow-soft border border-gray-100 dark:border-surface-800 p-6 lg:p-8">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white font-display">Generate your trip plan</h3>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Budget + interests + pace → a multi-day Lahore itinerary you can edit.
        </p>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleGenerate} className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">City</label>
              <input className="input w-full" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Travelers</label>
              <input
                type="number"
                min="1"
                className="input w-full"
                value={travelers}
                onChange={(e) => setTravelers(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Start date</label>
              <input type="date" className="input w-full" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="form-label">End date</label>
              <input type="date" className="input w-full" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Budget</label>
              <select className="input w-full" value={budgetLevel} onChange={(e) => setBudgetLevel(e.target.value)}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="LUXURY">Luxury</option>
              </select>
            </div>
            <div>
              <label className="form-label">Pace</label>
              <select className="input w-full" value={pace} onChange={(e) => setPace(e.target.value)}>
                <option value="RELAXED">Relaxed (3 places/day)</option>
                <option value="BALANCED">Balanced (4–5 places/day)</option>
                <option value="PACKED">Packed (6+ places/day)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Interests</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {INTEREST_OPTIONS.map((opt) => {
                const active = interests.includes(opt);
                return (
                  <button
                    type="button"
                    key={opt}
                    onClick={() => toggleInterest(opt)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      active
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white dark:bg-surface-900 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-surface-700 hover:bg-gray-50 dark:hover:bg-surface-800'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Selected: {selectedInterestsLabel || 'None'}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-medium"
            >
              {loading ? 'Generating…' : 'Generate Itinerary'}
            </button>

            {itinerary && (
              <button
                type="button"
                onClick={handleExportPdf}
                className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-surface-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-surface-800 font-medium"
              >
                Export / Print as PDF
              </button>
            )}
          </div>
        </form>
      </div>

      {itinerary && (
        <div className="bg-white dark:bg-surface-900 rounded-2xl shadow-soft border border-gray-100 dark:border-surface-800 p-6 lg:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white font-display">
                {itinerary.city} • {itinerary.start_date} → {itinerary.end_date}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                Pace: {itinerary.pace} • Budget: {itinerary.budget_level}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-6">
            {(itinerary.days || []).map((day, dayIdx) => (
              <div key={day.date || dayIdx} className="border border-gray-100 dark:border-surface-800 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{day.date}</div>
                    <div className="font-semibold text-gray-900 dark:text-white">{day.title}</div>
                  </div>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleRegenerateDay(dayIdx)}
                    className="px-3 py-2 rounded-xl border border-gray-200 dark:border-surface-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-surface-800 text-sm"
                  >
                    Regenerate day
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {(day.items || []).map((item, itemIdx) => (
                    <div
                      key={`${dayIdx}-${itemIdx}`}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 dark:bg-surface-800"
                    >
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          <span className="capitalize">{item.slot || 'slot'}</span> — {item.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{item.category}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleReplacePlace(dayIdx, itemIdx)}
                          className="px-3 py-2 rounded-xl border border-gray-200 dark:border-surface-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-surface-700 text-sm"
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleRemovePlace(dayIdx, itemIdx)}
                          className="px-3 py-2 rounded-xl border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <label className="form-label">Personal notes (Travel Journal)</label>
            <textarea
              rows={5}
              className="input w-full mt-2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add your notes, reminders, and preferences…"
            />
            <div className="mt-3">
              <button
                type="button"
                disabled={loading}
                onClick={handleSaveNotes}
                className="px-5 py-2.5 rounded-xl bg-gray-900 dark:bg-white dark:text-gray-900 text-white hover:opacity-90 disabled:opacity-60 font-medium"
              >
                Save notes
              </button>
            </div>
          </div>

          {aiAdvice && (
            <div className="mt-8 p-4 rounded-2xl bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800">
              <h4 className="text-sm font-semibold text-primary-800 dark:text-primary-200 mb-2">
                Smart suggestions for your trip
              </h4>
              <p className="text-sm text-primary-900 dark:text-primary-100 whitespace-pre-line">
                {aiAdvice}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

