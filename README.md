# Rizz Admin Panel Backend

NestJS backend scaffolded with Prisma ORM and PostgreSQL.

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL` for your PostgreSQL instance.
2. Install dependencies with `npm install`.
3. Generate the Prisma client with `npm run prisma:generate`.
4. Run migrations with `npm run prisma:migrate:dev`.
5. Start the app with `npm run start:dev`.

## Scripts

- `npm run start:dev` - run the API in watch mode
- `npm run build` - compile the project
- `npm run prisma:migrate:dev` - create and apply local migrations
- `npm run prisma:migrate:deploy` - apply migrations in deploy environments
- `npm run prisma:studio` - open Prisma Studio
- `npm run prisma:seed` - seed the database

## API

- `GET /api/health` - health check
- `GET /api/pages` - fetch the full page tree
- `POST /api/pages` - create a page or nested page tree
- `PUT /api/pages/:id` / `PATCH /api/pages/:id` - update a page
- `DELETE /api/pages/:id` - delete a page and its children
- `GET /api/pages/:pageId/hero` - fetch hero for a page
- `POST /api/pages/:pageId/hero` - create hero for a page
- `PUT /api/pages/:pageId/hero` - replace hero for a page
- `PATCH /api/pages/:pageId/hero` - partially update hero for a page
- `DELETE /api/pages/:pageId/hero` - delete hero for a page
- `GET /api/hero/:heroId` - fetch hero directly by hero id
- `PATCH /api/hero/:heroId` - partially update hero directly by hero id
- `GET /api/pages/:pageId/faqs` - fetch all FAQs for a page with JSON-LD schema
- `GET /api/pages/:pageId/faqs/schema` - fetch JSON-LD schema for all enabled FAQs on a page
- `GET /api/pages/:pageId/faqs/:faqId` - fetch a single FAQ on a page
- `POST /api/pages/:pageId/faqs` - create a FAQ for a page
- `PUT /api/pages/:pageId/faqs/:faqId` - replace a FAQ for a page
- `PATCH /api/pages/:pageId/faqs/:faqId` - partially update a FAQ for a page
- `DELETE /api/pages/:pageId/faqs/:faqId` - delete a FAQ for a page
 - `GET /api/categories` - fetch all categories
 - `GET /api/categories/:id` - fetch a single category
 - `POST /api/categories` - create a category
 - `PUT /api/categories/:id` - replace a category
 - `PATCH /api/categories/:id` - partially update a category
 - `DELETE /api/categories/:id` - delete a category
- `POST /api/products` - create a product with optional nested data
- `POST /api/products/:productId/variants` - add a variant to a product
- `POST /api/products/:productId/images` - add an image to a product (optional `variant_id`)
- `POST /api/products/:productId/seo` - add SEO data to a product
- `POST /api/products/:productId/translations` - add a translation
- `POST /api/products/:productId/faqs` - add a FAQ
- `POST /api/products/:productId/reviews` - add a review

## Example page tree payload

```json
{
  "title": "Home",
  "slug": "home",
  "children": [
    {
      "title": "Product Page",
      "slug": "product-page",
      "children": [
        { "title": "Sandals", "slug": "sandals" },
        { "title": "Shoes", "slug": "shoes" }
      ]
    }
  ]
}
```

## Create product variant API

### Endpoint

`POST /api/products/:productId/variants`

### Example payload

```json
{
  "sku": "PROD-1001-BLK-42",
  "variant_name": "Black / 42",
  "price": 3200,
  "sale_price": 2999,
  "stock_qty": 12,
  "attributes": {"color": "Black", "size": "42"},
  "barcode": "0123456789012",
  "is_default": true,
  "status": "active"
}
```

## Create product media API

### Endpoint

`POST /api/products/:productId/media`

### Example payload

```json
{
  "media_type": "IMAGE",
  "media_url": "https://cdn.example.com/products/prod-1001/gallery-1.jpg",
  "thumbnail_url": "https://cdn.example.com/products/prod-1001/gallery-1-thumb.jpg",
  "alt_text": "Classic Sneakers - side view",
  "title": "Side view",
  "sort_order": 1,
  "is_primary": false,
  "is_featured": false,
  "status": "ACTIVE",
  "variant_id": null
}
```

## Example hero payload

```json
{
  "type": "image",
  "backgroundImageUrl": "https://cdn.example.com/banners/home.jpg",
  "slogan": "Discover more",
  "title": "Step Into Comfort",
  "subtitle": "New arrivals for every season",
  "keyPoints": ["Free shipping", "30-day return", "Premium materials"],
  "isActive": true,
  "order": 1
}
```

## Example FAQ payload

```json
{
  "question": "How long does shipping take?",
  "answer": "Shipping usually takes 3-5 business days.",
  "short_answer": "3-5 business days",
  "answer_type": "text",
  "intent_type": "shipping",
  "seo_title": "Shipping timeline for orders",
  "seo_description": "Learn how long shipping takes and what affects delivery times.",
  "slug": "how-long-does-shipping-take",
  "schema_enabled": true,
  "ai_summary": "This FAQ explains the standard delivery window.",
  "entity_tags": ["shipping", "delivery"],
  "source_url": "https://example.com/shipping",
  "fact_check_status": "verified",
  "last_verified_at": "2026-05-15T00:00:00.000Z",
  "context": "Use this answer on checkout and delivery pages."
}
```

## Create product API

### Endpoint

`POST /api/products`

### Notes

- The core create request only accepts basic fields and optional `seo`.
- Add variants, images, translations, FAQs, and reviews using the dedicated endpoints after the product is created.
- Arrays like `tags`, `key_features`, `materials`, `use_cases`, `benefits` default to empty when omitted.

### Recommended UI flow

1) Create core product first with basic fields only.
2) After save, add child data using the dedicated endpoints:
  - `POST /api/products/:productId/variants`
  - `POST /api/products/:productId/images`
  - `POST /api/products/:productId/translations`
  - `POST /api/products/:productId/faqs`
  - `POST /api/products/:productId/reviews`
  - `POST /api/products/:productId/seo`

### Example payload

```json
{
  "sku": "PROD-1001",
  "name": "Classic Sneakers",
  "slug": "classic-sneakers",
  "short_description": "Everyday sneakers with breathable mesh.",
  "description": "Lightweight sneakers designed for daily use.",
  "key_features": ["Breathable mesh", "Rubber outsole"],
  "materials": ["Mesh", "Rubber"],
  "use_cases": ["Daily wear", "Walking"],
  "benefits": ["All-day comfort", "Lightweight"],
  "brand_id": "brand_01",
  "category_id": "cat_01",
  "status": "active", 
  "is_featured": true,
  "is_published": true,
  "tags": ["sneakers", "mens"],
  "gender": "men",
  "age_group": "adult",
  "material": "mesh",
  "tax_class": "standard",
  "seo": {
    "meta_title": "Classic Sneakers - Lightweight Daily Shoes",
    "meta_description": "Buy Classic Sneakers with breathable mesh and rubber outsole.",
    "meta_keywords": "sneakers, mesh shoes",
    "canonical_url": "https://example.com/products/classic-sneakers",
    "slug": "classic-sneakers",
    "og_title": "Classic Sneakers",
    "og_description": "Lightweight sneakers for everyday comfort.",
    "og_image": "https://cdn.example.com/products/prod-1001/og.jpg",
    "schema_json": {"@type": "Product", "name": "Classic Sneakers"}
  }
}
```
