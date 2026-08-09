# Luxe Site: Shopify Setup Guide

The site is fully wired for Shopify checkout. It just needs your store credentials. Follow these steps and checkout goes live.

## How it works

Customers browse and fill their bag on the Luxe site as usual. When they click "Secure Checkout", the site sends the bag to Shopify's Storefront API and redirects them to Shopify's hosted checkout page with their items pre-loaded. Shopify handles payment, taxes, shipping, and order emails. Until credentials are added, the checkout button shows a friendly "store is being set up" message.

## Step 1: Create the store

Sign up at shopify.com. The Basic plan (about $39/mo) is standard. The Starter plan ($5/mo) also supports this checkout flow.

## Step 2: Enter the products

Add each product below in the Shopify admin (Products, then Add product).

**Important:** After saving each product, click "Edit" under Search engine listing and set the **URL handle** to exactly the handle shown below. The sync script matches products by handle.

For products with options, add a **Color** option and a **Size** option with the exact values listed (spelling and capitalization matter). Shopify creates a variant for every combination. Products marked "no options needed" can be left as single-variant products.

| Product title | Handle | Price | Colors | Sizes |
|---|---|---|---|---|
| The Signature Cap | `signature-cap` | $48 | Black / Pink | One Size (no options needed) |
| The Luxe Maxi Dress | `luxe-maxi-dress` | $88 | Blush Pink, Ivory White | XS, S, M, L, XL, XXL |
| The Luxe Mini | `luxe-mini-dress` | $72 | Onyx, Blush Pink, Ivory | XS, S, M, L, XL, XXL |
| The Hoodie Dress | `hoodie-dress` | $118 | Charcoal, Bone, Blush Pink | XS / S, M / L, XL / XXL |
| The Satin Slip | `satin-slip-dress` | $98 | Champagne, Onyx, Rose Gold | XS, S, M, L, XL |
| The Luxe Tee | `luxe-tee` | $64 | Onyx, Ivory, Rose | XS, S, M, L, XL, XXL |
| Velvet Crown Cap | `velvet-cap` | $58 | Burgundy, Midnight, Black | One Size |
| The Statement Blouse | `silk-blouse` | $148 | Champagne, Onyx, Rose Gold | XS, S, M, L, XL |
| Monogram Canvas Tote | `monogram-tote` | $42 | Natural, Black, Blush | One Size |
| Corduroy Signature Cap | `corduroy-cap` | $56 | Espresso, Champagne, Rose | One Size |
| Luxe Long Sleeve | `long-sleeve` | $78 | Onyx, Ivory, Rose | S, M, L, XL, XXL |
| Gold L Keychain | `leather-keychain` | $32 | Natural, Onyx, Blush | One Size |
| Silk-Lined Beanie | `silk-beanie` | $48 | Charcoal, Ivory, Burgundy | One Size |
| Bifold Card Holder | `card-holder` | $52 | Onyx, Cognac, Blush | One Size |
| The Satin Tank | `satin-tank` | $68 | Champagne, Onyx, Rose Gold | XS, S, M, L, XL |
| Gold L Enamel Pin | `enamel-pin` | $14 | Gold / Pink, Gold / Black | One Size |

Products with multiple colors but "One Size" should get just a **Color** option (the script fills in "One Size" automatically).

Tips:
- Set inventory tracking per variant if you want Shopify to stop overselling.
- The site advertises free shipping over $75. Set that up under Settings, Shipping and delivery, so checkout matches.
- The site shows an 8.75% estimated tax. Shopify calculates the real tax at checkout based on the buyer's address.

## Step 3: Get the Storefront API token

1. In the Shopify admin go to Settings, then "Apps and sales channels", then "Develop apps".
2. Click "Create an app", name it something like "Luxe Site".
3. Under Configuration, click "Configure" next to Storefront API and enable these scopes:
   - `unauthenticated_read_product_listings`
   - `unauthenticated_write_checkouts`
   - `unauthenticated_read_checkouts`
4. Click "Install app".
5. Under API credentials, copy the **Storefront API access token** (this token is public-safe, it only allows reading products and creating carts).

## Step 4: Run the sync script

From the `luxe-site-v2` folder:

```
node scripts/fetch-shopify-variants.mjs your-store.myshopify.com YOUR_STOREFRONT_TOKEN
```

The script:
- pulls every product and variant from your store,
- writes the variant mapping and your credentials directly into `index.html`,
- warns about any product or variant that doesn't line up with the site.

Fix any warnings in the Shopify admin and re-run until it reports everything mapped.

## Step 5: Deploy

Redeploy the site. The "Integration Pending" notice in the cart disappears automatically once credentials are in place, and the checkout button starts sending customers to Shopify.

## Re-running later

Any time you add products or variants in Shopify, run the script again and redeploy. If you change products on the site itself, also update the `CATALOG` list at the top of `scripts/fetch-shopify-variants.mjs` to match.
