/**
 * Stori local application server
 *
 * Zero external dependencies: Node 18+ is enough to run the app.
 * Data is written to .stori-data.json after the first change, keeping the
 * demo self-contained while leaving room to replace the data layer with a DB.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const INDEX_FILE = path.join(ROOT, 'index.html');
const DATA_FILE = path.join(ROOT, '.stori-data.json');

const seededClips = [
  { id: 'clip-reach', time: '03:14–03:48', score: 94, title: 'Reach is a vanity metric if nobody remembers you.', reason: 'Strong contrarian hook. This mirrors your best-performing LinkedIn opener pattern.', type: 'Hook', watch: '41 sec', visual: '' },
  { id: 'clip-signals', time: '11:07–11:49', score: 91, title: 'The three signals that tell you a viewer will come back.', reason: 'A concise framework with a practical takeaway—your audience saves these most.', type: 'Framework', watch: '42 sec', visual: 'c2' },
  { id: 'clip-views', time: '24:32–25:08', score: 88, title: 'We had 2M views and still couldn’t sell a thing.', reason: 'Specific story tension makes this a high-retention short-form moment.', type: 'Story', watch: '36 sec', visual: 'c3' },
  { id: 'clip-identity', time: '31:15–31:52', score: 85, title: 'Good content creates a tiny change in how someone sees themselves.', reason: 'Thoughtful, quotable insight that fits your newsletter and carousel formats.', type: 'Insight', watch: '37 sec', visual: 'c2' },
  { id: 'clip-useful', time: '36:01–36:38', score: 82, title: 'Build the habit of being useful before being visible.', reason: 'Clear belief statement that invites high-quality conversation.', type: 'Hook', watch: '37 sec', visual: '' },
  { id: 'clip-loop', time: '40:02–40:43', score: 79, title: 'A retention loop starts before anyone presses play.', reason: 'Great bridge to a 3-slide educational carousel.', type: 'Framework', watch: '41 sec', visual: 'c3' },
];

const defaultData = {
  brand: {
    statement: 'Clear thinking for creators building durable audiences. We earn attention with useful tension—not empty hype.',
    cues: 'Warmly direct, specific, calm confidence',
    confidence: 86,
    learned: [
      'Prefers “you” over “creators” in hooks',
      'Removes inflated claims and superlatives',
      'Adds an actionable takeaway near the end',
      'Uses 2–4 focused hashtags, not a cloud',
    ],
  },
  projects: [
    {
      id: 'project-retention',
      title: 'Why retention beats reach in 2025',
      sourceUrl: '',
      duration: '43:18',
      words: 6420,
      status: 'ready',
      createdAt: '2026-11-21T09:30:00.000Z',
      clips: seededClips.map((clip) => ({ ...clip, saved: false })),
      copies: {},
    },
  ],
  calendar: [
    { id: 'cal-linkedin', day: 'Mon', date: 21, platform: 'LinkedIn', time: '11:00 AM', title: 'Contrarian hook', tone: 'linkedin' },
    { id: 'cal-tiktok', day: 'Tue', date: 22, platform: 'Reel', time: '9:30 AM', title: '3 retention signals', tone: 'tiktok' },
    { id: 'cal-newsletter', day: 'Wed', date: 23, platform: 'Newsletter', time: '8:00 AM', title: 'Audience return', tone: 'news' },
    { id: 'cal-carousel', day: 'Thu', date: 24, platform: 'LinkedIn carousel', time: '11:00 AM', title: 'Retention framework', tone: 'linkedin' },
    { id: 'cal-tiktok2', day: 'Fri', date: 25, platform: 'TikTok', time: '5:30 PM', title: 'Views vs. return', tone: 'tiktok' },
    { id: 'cal-story', day: 'Sun', date: 27, platform: 'IG story', time: '10:00 AM', title: 'Behind the episode', tone: 'news' },
  ],
  performance: [4.2, 5.5, 4.7, 6.2, 7.4, 8.6],
  activity: [],
};

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function loadData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return clone(defaultData); }
}
let data = loadData();
function saveData() { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
function error(res, status, message) { json(res, status, { error: message }); }
function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) { reject(new Error('Request body is too large.')); req.destroy(); }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch { reject(new Error('Body must be valid JSON.')); }
    });
    req.on('error', reject);
  });
}
function getProject(id) { return data.projects.find((project) => project.id === id); }
function recordActivity(type, message) {
  data.activity.unshift({ id: `activity-${Date.now()}`, type, message, at: new Date().toISOString() });
  data.activity = data.activity.slice(0, 30);
}
function newId(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

// This is a deterministic local stand-in for the model stage. Replace this
// function with a provider call (Whisper + an LLM) in production; its output
// contract is intentionally the same as a model-generated clip plan.
function analyzeProject(project) {
  const variation = Math.max(0, Math.min(5, Math.round((data.performance.at(-1) || 6) - 5)));
  project.status = 'ready';
  project.clips = seededClips.map((clip, index) => ({
    ...clip,
    id: `${project.id}-${clip.id}`,
    score: Math.min(99, clip.score + (index < 2 ? variation : 0)),
    saved: false,
  }));
  recordActivity('analysis', `Found ${project.clips.length} high-potential moments in “${project.title}”.`);
  return project;
}

async function api(req, res, pathname) {
  const parts = pathname.split('/').filter(Boolean);
  const method = req.method;

  if (method === 'GET' && pathname === '/api/health') return json(res, 200, { ok: true, provider: 'local-demo', dataFile: path.basename(DATA_FILE) });
  if (method === 'GET' && pathname === '/api/state') return json(res, 200, data);
  if (method === 'GET' && pathname === '/api/projects') return json(res, 200, data.projects);
  if (method === 'GET' && pathname === '/api/brand') return json(res, 200, data.brand);
  if (method === 'GET' && pathname === '/api/calendar') return json(res, 200, data.calendar);
  if (method === 'GET' && pathname === '/api/performance') return json(res, 200, { values: data.performance, insight: 'Practical, counterintuitive hooks are earning stronger return attention.' });

  if (method === 'POST' && pathname === '/api/projects') {
    const body = await readJson(req);
    const title = String(body.title || '').trim();
    if (!title) return error(res, 422, 'A source title is required.');
    const project = { id: newId('project'), title, sourceUrl: String(body.sourceUrl || '').trim(), duration: 'Processing', words: 0, status: 'analyzing', createdAt: new Date().toISOString(), clips: [] };
    data.projects.unshift(project);
    recordActivity('upload', `Added “${title}” to the repurposing queue.`);
    saveData();
    return json(res, 201, project);
  }

  if (parts[0] === 'api' && parts[1] === 'projects' && parts[2]) {
    const project = getProject(parts[2]);
    if (!project) return error(res, 404, 'Project not found.');
    if (method === 'GET' && parts.length === 3) return json(res, 200, project);
    if (method === 'POST' && parts[3] === 'analyze') {
      const plan = analyzeProject(project);
      saveData();
      return json(res, 200, plan);
    }
    if (method === 'POST' && parts[3] === 'generate') {
      if (!project.clips.length) analyzeProject(project);
      project.clips = project.clips.map((clip, index) => ({ ...clip, score: Math.max(70, Math.min(99, clip.score + (index % 2 === 0 ? 1 : -1))) })).sort((a, b) => b.score - a.score);
      recordActivity('generate', `Refreshed clip suggestions for “${project.title}”.`);
      saveData();
      return json(res, 200, { clips: project.clips });
    }
    if (method === 'POST' && parts[3] === 'copy') {
      const body = await readJson(req);
      const platform = String(body.platform || 'LinkedIn').trim();
      const content = String(body.content || '').trim();
      if (!content) return error(res, 422, 'Copy cannot be empty.');
      project.copies = project.copies || {};
      project.copies[platform] = { content, updatedAt: new Date().toISOString() };
      data.brand.confidence = Math.min(99, data.brand.confidence + 1);
      recordActivity('copy', `Saved an edited ${platform} draft as brand feedback.`);
      saveData();
      return json(res, 200, { platform, content, brandConfidence: data.brand.confidence });
    }
    if (method === 'POST' && parts[3] === 'clips' && parts[4] && parts[5] === 'save') {
      const clip = project.clips.find((item) => item.id === parts[4]);
      if (!clip) return error(res, 404, 'Clip not found.');
      clip.saved = !clip.saved;
      recordActivity('clip', `${clip.saved ? 'Saved' : 'Removed'} “${clip.title}”.`);
      saveData();
      return json(res, 200, clip);
    }
  }

  if (method === 'PUT' && pathname === '/api/brand') {
    const body = await readJson(req);
    data.brand.statement = String(body.statement || data.brand.statement).trim();
    data.brand.cues = String(body.cues || data.brand.cues).trim();
    data.brand.confidence = Math.min(99, data.brand.confidence + 1);
    recordActivity('brand', 'Updated brand memory.');
    saveData();
    return json(res, 200, data.brand);
  }

  if (method === 'POST' && pathname === '/api/calendar') {
    const body = await readJson(req);
    const item = { id: newId('calendar'), day: String(body.day || 'Tue'), date: Number(body.date || 22), platform: String(body.platform || 'LinkedIn'), time: String(body.time || '9:30 AM'), title: String(body.title || 'New repurposed post'), tone: String(body.tone || 'linkedin') };
    data.calendar.push(item);
    recordActivity('schedule', `Scheduled “${item.title}” for ${item.day}.`);
    saveData();
    return json(res, 201, item);
  }

  if (method === 'POST' && pathname === '/api/performance') {
    const body = await readJson(req);
    const engagement = Number(body.engagement);
    if (!Number.isFinite(engagement) || engagement < 0 || engagement > 100) return error(res, 422, 'Engagement must be a number from 0 to 100.');
    data.performance = [...data.performance.slice(-5), engagement];
    const best = engagement >= Math.max(...data.performance);
    if (best) data.brand.confidence = Math.min(99, data.brand.confidence + 1);
    recordActivity('performance', `Recorded ${engagement.toFixed(1)}% engagement for “${String(body.name || 'a post')}”.`);
    saveData();
    return json(res, 201, { engagement, best, nextRecommendation: best ? 'Use a decisive opening in the next clip.' : 'Test a shorter hook and an earlier takeaway.' });
  }

  return error(res, 404, 'API route not found.');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url.pathname);
    if (req.method !== 'GET' && req.method !== 'HEAD') return error(res, 405, 'Method not allowed.');
    if (url.pathname !== '/' && url.pathname !== '/index.html') return error(res, 404, 'Page not found.');
    const html = fs.readFileSync(INDEX_FILE);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    if (req.method === 'HEAD') return res.end();
    return res.end(html);
  } catch (err) {
    console.error(err);
    return error(res, 500, err.message || 'Unexpected server error.');
  }
});

server.listen(PORT, () => {
  console.log(`Stori is running at http://localhost:${PORT}`);
});
