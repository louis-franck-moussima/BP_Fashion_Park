import { deleteApp, initializeApp } from 'firebase/app';
import { collection, getDocs, getFirestore } from 'firebase/firestore';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const projectId = 'bp-fashion-park-4c84c';
const origin = 'https://bp-fashion-park-4c84c.web.app';
const output = join(process.cwd(), 'dist', 'bp_fashion_park', 'browser');
const app = initializeApp({
  apiKey: 'AIzaSyDpCTc1InBWY1sVCN0npV8J4jH8bFjqz2c',
  authDomain: `${projectId}.firebaseapp.com`,
  projectId,
});
const db = getFirestore(app);

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const slugify = (value = '') => value.toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

try {
  const [productSnapshot, categorySnapshot, shell] = await Promise.all([
    getDocs(collection(db, 'products')),
    getDocs(collection(db, 'categories')),
    readFile(join(output, 'index.html'), 'utf8'),
  ]);
  const categories = new Map(categorySnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() }]));
  const categoryPath = id => {
    const path = [];
    const visited = new Set();
    let current = categories.get(id);
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      path.unshift(current);
      current = current.parentCategoryId ? categories.get(current.parentCategoryId) : undefined;
    }
    return path;
  };
  let generated = 0;
  for (const doc of productSnapshot.docs) {
    const product = { id: doc.id, ...doc.data() };
    if ((product.status ?? 'published') !== 'published') continue;
    const path = categoryPath(product.category);
    if (!path.length || path.some(category => !category.active)) continue;
    const routeId = `${slugify(product.name)}--${product.id}`;
    const route = `${path.map(category => category.slug).join('/')}/product/${routeId}`;
    const url = `${origin}/${route}`;
    const image = product.images?.find(item => /^https:\/\//i.test(item.url))?.url;
    const description = String(product.description || `Discover ${product.name} at BP Fashion Park.`)
      .replace(/\s+/g, ' ').trim().slice(0, 160);
    const title = `${product.name} | BP Fashion Park`.slice(0, 65);
    const tags = [
      `<meta property="og:site_name" content="BP Fashion Park">`,
      `<meta property="og:type" content="product">`,
      `<meta property="og:title" content="${escapeHtml(title)}">`,
      `<meta property="og:description" content="${escapeHtml(description)}">`,
      `<meta property="og:url" content="${escapeHtml(url)}">`,
      image ? `<meta property="og:image" content="${escapeHtml(image)}">` : '',
      `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`,
      image ? `<meta name="twitter:image" content="${escapeHtml(image)}">` : '',
      `<link rel="canonical" href="${escapeHtml(url)}">`,
    ].filter(Boolean).join('\n    ');
    const html = shell
      .replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`)
      .replace(/<meta\s+name="description"[\s\S]*?>/i, `<meta name="description" content="${escapeHtml(description)}">`)
      .replace('</head>', `    ${tags}\n  </head>`);
    const file = join(output, `${route}.html`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, html, 'utf8');
    generated += 1;
  }
  console.log(`Generated ${generated} static product social preview page(s).`);
} catch (error) {
  console.warn(`Social preview pages were not generated: ${error instanceof Error ? error.message : error}`);
}
await deleteApp(app);
