import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(scriptDirectory, '..');
const contentDirectory = path.join(rootDirectory, 'content', 'zines');
const outputFile = path.join(rootDirectory, 'data', 'zines.json');

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function parseScalar(value) {
  const trimmed = stripWrappingQuotes(String(value || '').trim());

  if (!trimmed) {
    return '';
  }

  if (trimmed === 'true') {
    return true;
  }

  if (trimmed === 'false') {
    return false;
  }

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed
      .slice(1, -1)
      .split(',')
      .map((item) => stripWrappingQuotes(item.trim()))
      .filter(Boolean);
  }

  return trimmed;
}

function parseFrontmatter(source) {
  const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);

  if (!match) {
    return {};
  }

  const lines = match[1].split(/\r?\n/);
  const result = {};
  let currentKey = null;

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    const propertyMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (propertyMatch) {
      const [, key, rawValue] = propertyMatch;
      currentKey = key;
      result[key] = rawValue.trim() ? parseScalar(rawValue) : [];
      continue;
    }

    const listItemMatch = line.match(/^\s*-\s+(.*)$/);
    if (listItemMatch && currentKey) {
      if (!Array.isArray(result[currentKey])) {
        result[currentKey] = [];
      }

      result[currentKey].push(parseScalar(listItemMatch[1]));
    }
  }

  return result;
}

function normalizeAssetPath(value) {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return '';
  }

  if (/^(https?:|blob:)/i.test(normalized)) {
    return normalized;
  }

  return `/${normalized.replace(/^\.?\//, '')}`;
}

function normalizeEntry(entry, fallbackSlug) {
  const title = String(entry.title || '').trim();
  const slug = String(entry.slug || fallbackSlug || slugify(title)).trim() || slugify(title);
  const pdf = normalizeAssetPath(entry.pdf || entry.pdfPath);
  const tags = Array.isArray(entry.tags)
    ? entry.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
    : [];

  return {
    id: String(entry.id || slug).trim() || slug,
    title,
    slug,
    description: String(entry.description || '').trim(),
    date: String(entry.date || '').trim(),
    thumbnail: normalizeAssetPath(entry.thumbnail),
    pdf,
    pdfPath: pdf,
    featured: Boolean(entry.featured),
    draft: Boolean(entry.draft),
    category: String(entry.category || '').trim(),
    tags,
    author: String(entry.author || '').trim(),
  };
}

async function readEntryFiles() {
  try {
    const directoryEntries = await fs.readdir(contentDirectory, { withFileTypes: true });

    return directoryEntries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry) => path.join(contentDirectory, entry.name));
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

async function generateZinesJson() {
  const entryFiles = await readEntryFiles();
  const zines = [];

  for (const entryFile of entryFiles) {
    const fileContents = await fs.readFile(entryFile, 'utf8');
    const frontmatter = parseFrontmatter(fileContents);
    const fallbackSlug = path.basename(entryFile, path.extname(entryFile));
    zines.push(normalizeEntry(frontmatter, fallbackSlug));
  }

  zines.sort((left, right) => right.date.localeCompare(left.date) || left.title.localeCompare(right.title));

  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, `${JSON.stringify(zines, null, 2)}\n`, 'utf8');

  console.log(`Generated ${path.relative(rootDirectory, outputFile)} from ${zines.length} content entries.`);
}

generateZinesJson().catch((error) => {
  console.error('Failed to generate zine data.', error);
  process.exitCode = 1;
});
