const fields = ['color','style','material'];
const arr = (v) => Array.isArray(v) ? v.map(String).map(x => x.toLowerCase()) : [];
export function scoreItem(item, preferences = {}, signals = {likes: [], dislikes: []}) {
  const explicit = fields.reduce((n, field) => n + (arr(preferences[`preferred_${field === 'style' ? 'shirt_styles' : field + 's'}`]).includes(String(item[field]).toLowerCase()) ? 1 : 0), 0) / 3;
  const likes = signals.likes || [], dislikes = signals.dislikes || [];
  const learned = fields.reduce((n, field) => n + (likes.filter(x => x[field] === item[field]).length ? 1 : 0), 0) / 3;
  const penalty = fields.filter(field => dislikes.filter(x => x[field] === item[field]).length).length / 3;
  return Math.max(0, Math.min(100, Math.round((explicit * 0.65 + learned * 0.35) * 100 * (1 - penalty * 0.65))));
}
