const DATA_URL = './data/zines.json';
const VIEWER_URL = './Zaya-main/index.html';

const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const emptyState = document.getElementById('empty-state');
const zineGrid = document.getElementById('zine-grid');
const zineCount = document.getElementById('zine-count');

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeZine(entry) {
  const pdfPath = typeof entry.pdfPath === 'string' ? entry.pdfPath : entry.pdf;
  const slug = String(entry.slug || '').trim();
  const title = String(entry.title || '').trim();

  return {
    id: String(entry.id || slug || slugify(title)).trim(),
    title,
    slug,
    description: String(entry.description || '').trim(),
    date: String(entry.date || '').trim(),
    thumbnail: String(entry.thumbnail || '').trim(),
    pdfPath: String(pdfPath || '').trim(),
    featured: Boolean(entry.featured),
    draft: Boolean(entry.draft),
    category: String(entry.category || '').trim(),
    tags: Array.isArray(entry.tags) ? entry.tags.filter(Boolean).map(String) : [],
    author: String(entry.author || '').trim(),
  };
}

function getViewerPdfPath(pdfPath) {
  if (!pdfPath) {
    return '';
  }

  if (/^(https?:|blob:)/i.test(pdfPath)) {
    return pdfPath;
  }

  if (pdfPath.startsWith('../')) {
    return pdfPath;
  }

  return `../${pdfPath.replace(/^\.?\//, '')}`;
}

function buildViewerHref(zine) {
  const viewerUrl = new URL(VIEWER_URL, window.location.href);
  viewerUrl.searchParams.set('pdf', getViewerPdfPath(zine.pdfPath));
  viewerUrl.searchParams.set('title', zine.title);
  viewerUrl.searchParams.set('id', zine.slug || zine.id);
  return viewerUrl.toString();
}

function formatDate(dateString) {
  if (!dateString) {
    return 'Date unavailable';
  }

  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(parsed);
}

function createCard(zine) {
  const article = document.createElement('article');
  article.className = 'card';

  const image = document.createElement('img');
  image.className = 'card__thumb';
  image.src = zine.thumbnail;
  image.alt = `${zine.title} cover`;
  image.loading = 'lazy';
  article.appendChild(image);

  const body = document.createElement('div');
  body.className = 'card__body';

  const header = document.createElement('div');
  header.className = 'card__header';

  const titleGroup = document.createElement('div');
  titleGroup.className = 'card__title-group';

  const meta = document.createElement('div');
  meta.className = 'card__meta';
  meta.textContent = zine.category || 'Zine';

  const title = document.createElement('h3');
  title.textContent = zine.title;

  titleGroup.append(meta, title);
  header.appendChild(titleGroup);

  if (zine.featured) {
    const badge = document.createElement('span');
    badge.className = 'card__badge';
    badge.textContent = 'Featured';
    header.appendChild(badge);
  }

  const description = document.createElement('p');
  description.className = 'card__description';
  description.textContent = zine.description;

  const tags = document.createElement('p');
  tags.className = 'card__tags';
  tags.textContent = [zine.author, ...zine.tags].filter(Boolean).join(' • ');

  const footer = document.createElement('div');
  footer.className = 'card__footer';

  const date = document.createElement('span');
  date.className = 'card__date';
  date.textContent = formatDate(zine.date);

  const action = document.createElement('a');
  action.className = 'card__action';
  action.href = buildViewerHref(zine);
  action.textContent = 'Open zine';

  footer.append(date, action);
  body.append(header, description);

  if (tags.textContent) {
    body.appendChild(tags);
  }

  body.appendChild(footer);
  article.appendChild(body);

  return article;
}

function renderZines(zines) {
  zineGrid.innerHTML = '';
  zineCount.textContent = String(zines.length);

  if (zines.length === 0) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;
  zines.forEach((zine) => zineGrid.appendChild(createCard(zine)));
}

async function loadZines() {
  try {
    const response = await fetch(DATA_URL, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`Failed to load zine metadata (${response.status})`);
    }

    const data = await response.json();
    const normalized = Array.isArray(data)
      ? data.map(normalizeZine)
      : [];

    const publishedZines = normalized
      .filter((entry) => !entry.draft)
      .filter((entry) => entry.id && entry.title && entry.thumbnail && entry.pdfPath)
      .sort((left, right) => right.date.localeCompare(left.date));

    renderZines(publishedZines);
  } catch (error) {
    console.error('Unable to load zines:', error);
    errorState.hidden = false;
    errorState.textContent = 'The zine directory could not be loaded. Check `data/zines.json` and asset paths.';
  } finally {
    loadingState.hidden = true;
  }
}

loadZines();
