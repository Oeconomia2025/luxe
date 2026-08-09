#!/usr/bin/env node
// Pulls every product variant from your Shopify store via the Storefront API
// and writes the variant mapping (plus your store credentials) directly into
// index.html. Run it once after entering products in the Shopify admin, and
// again any time you add or change products.
//
// Usage:
//   node scripts/fetch-shopify-variants.mjs <store>.myshopify.com <storefront-token>
//
// or with env vars:
//   SHOPIFY_DOMAIN=... SHOPIFY_STOREFRONT_TOKEN=... node scripts/fetch-shopify-variants.mjs
//
// Matching rules:
//   - The Shopify product HANDLE must equal the site product id
//     (e.g. "signature-cap", "luxe-maxi-dress"). Edit the handle in the
//     Shopify admin under Search engine listing if it doesn't match.
//   - Variant option names must be "Color" and "Size", and the values must
//     match the site exactly (e.g. "Blush Pink", "XL", "One Size").
//   - Single-variant products (no options) map to the site's only
//     color/size combo automatically.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const API_VERSION = '2025-07';
const INDEX_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html');

// Site catalog: product id -> { colors, sizes }. Keep in sync with PRODUCTS
// in index.html. Used to verify coverage and resolve single-variant products.
const CATALOG = {
  'signature-cap':   { colors: ['Black / Pink'], sizes: ['One Size'] },
  'luxe-maxi-dress': { colors: ['Blush Pink', 'Ivory White'], sizes: ['XS','S','M','L','XL','XXL'] },
  'luxe-mini-dress': { colors: ['Onyx', 'Blush Pink', 'Ivory'], sizes: ['XS','S','M','L','XL','XXL'] },
  'hoodie-dress':    { colors: ['Charcoal', 'Bone', 'Blush Pink'], sizes: ['XS / S','M / L','XL / XXL'] },
  'satin-slip-dress':{ colors: ['Champagne', 'Onyx', 'Rose Gold'], sizes: ['XS','S','M','L','XL'] },
  'luxe-tee':        { colors: ['Onyx', 'Ivory', 'Rose'], sizes: ['XS','S','M','L','XL','XXL'] },
  'velvet-cap':      { colors: ['Burgundy', 'Midnight', 'Black'], sizes: ['One Size'] },
  'silk-blouse':     { colors: ['Champagne', 'Onyx', 'Rose Gold'], sizes: ['XS','S','M','L','XL'] },
  'monogram-tote':   { colors: ['Natural', 'Black', 'Blush'], sizes: ['One Size'] },
  'corduroy-cap':    { colors: ['Espresso', 'Champagne', 'Rose'], sizes: ['One Size'] },
  'long-sleeve':     { colors: ['Onyx', 'Ivory', 'Rose'], sizes: ['S','M','L','XL','XXL'] },
  'leather-keychain':{ colors: ['Natural', 'Onyx', 'Blush'], sizes: ['One Size'] },
  'silk-beanie':     { colors: ['Charcoal', 'Ivory', 'Burgundy'], sizes: ['One Size'] },
  'card-holder':     { colors: ['Onyx', 'Cognac', 'Blush'], sizes: ['One Size'] },
  'satin-tank':      { colors: ['Champagne', 'Onyx', 'Rose Gold'], sizes: ['XS','S','M','L','XL'] },
  'enamel-pin':      { colors: ['Gold / Pink', 'Gold / Black'], sizes: ['One Size'] },
};

const domain = process.argv[2] || process.env.SHOPIFY_DOMAIN;
const token = process.argv[3] || process.env.SHOPIFY_STOREFRONT_TOKEN;

if (!domain || !token) {
  console.error('Usage: node scripts/fetch-shopify-variants.mjs <store>.myshopify.com <storefront-token>');
  process.exit(1);
}

const QUERY = `
  query products($cursor: String) {
    products(first: 100, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        handle
        title
        variants(first: 100) {
          nodes {
            id
            title
            availableForSale
            selectedOptions { name value }
          }
        }
      }
    }
  }`;

async function fetchAllProducts() {
  const products = [];
  let cursor = null;
  do {
    const res = await fetch(`https://${domain}/api/${API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': token,
      },
      body: JSON.stringify({ query: QUERY, variables: { cursor } }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from Shopify - check the domain and token`);
    const json = await res.json();
    if (json.errors) throw new Error(json.errors.map(e => e.message).join('; '));
    const page = json.data.products;
    products.push(...page.nodes);
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (cursor);
  return products;
}

function buildMapping(products) {
  const mapping = {};
  const warnings = [];

  for (const product of products) {
    const siteProduct = CATALOG[product.handle];
    if (!siteProduct) {
      warnings.push(`Shopify product "${product.title}" (handle: ${product.handle}) has no matching site product - skipped. Edit its handle in the Shopify admin if it should match.`);
      continue;
    }

    for (const variant of product.variants.nodes) {
      const opts = Object.fromEntries(variant.selectedOptions.map(o => [o.name.toLowerCase(), o.value]));
      let color = opts.color;
      let size = opts.size;

      // Single-variant product (Shopify "Default Title") or a missing option:
      // fall back to the site's only color/size when unambiguous.
      if (!color && siteProduct.colors.length === 1) color = siteProduct.colors[0];
      if (!size && siteProduct.sizes.length === 1) size = siteProduct.sizes[0];

      if (!color || !size) {
        warnings.push(`${product.handle}: variant "${variant.title}" is missing a Color or Size option - skipped.`);
        continue;
      }
      if (!siteProduct.colors.includes(color) || !siteProduct.sizes.includes(size)) {
        warnings.push(`${product.handle}: variant "${color} / ${size}" doesn't match any site color/size (site colors: ${siteProduct.colors.join(', ')}; sizes: ${siteProduct.sizes.join(', ')}) - skipped.`);
        continue;
      }
      mapping[`${product.handle}::${color}::${size}`] = variant.id;
    }
  }

  // Report site combos that have no Shopify variant yet
  for (const [id, { colors, sizes }] of Object.entries(CATALOG)) {
    for (const color of colors) {
      for (const size of sizes) {
        if (!mapping[`${id}::${color}::${size}`]) {
          warnings.push(`MISSING in Shopify: ${id} (${color}, ${size}) - customers can't check this combo out.`);
        }
      }
    }
  }

  return { mapping, warnings };
}

function patchIndexHtml(mapping) {
  let html = readFileSync(INDEX_PATH, 'utf8');

  const block = `// SHOPIFY_VARIANTS_START\n  const SHOPIFY_VARIANTS = ${JSON.stringify(mapping, null, 2).replace(/\n/g, '\n  ')};\n  // SHOPIFY_VARIANTS_END`;
  const markerRe = /\/\/ SHOPIFY_VARIANTS_START[\s\S]*?\/\/ SHOPIFY_VARIANTS_END/;
  if (!markerRe.test(html)) throw new Error('SHOPIFY_VARIANTS markers not found in index.html');
  html = html.replace(markerRe, block);

  html = html.replace(/domain: '[^']*',(\s*\n\s*)storefrontToken: '[^']*',/,
    `domain: '${domain}',$1storefrontToken: '${token}',`);

  writeFileSync(INDEX_PATH, html, 'utf8');
}

const products = await fetchAllProducts();
console.log(`Fetched ${products.length} products from ${domain}`);

const { mapping, warnings } = buildMapping(products);
console.log(`Mapped ${Object.keys(mapping).length} variants`);

for (const w of warnings) console.warn('  ! ' + w);

patchIndexHtml(mapping);
console.log('\nindex.html updated: store credentials + variant mapping written.');
console.log(warnings.length
  ? `\n${warnings.length} warning(s) above - fix them in the Shopify admin and re-run this script.`
  : '\nAll site products fully mapped. Checkout is live once you deploy.');
