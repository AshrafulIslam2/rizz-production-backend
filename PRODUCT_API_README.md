# Product API Reference

This file documents the current product endpoints in the NestJS backend so the frontend or another service can implement against them directly.

## Base Path

All routes are served under `/api`.

## Product Routes

### Get all products

`GET /api/products`

Returns the product list ordered by `created_at` descending.

### Get one product

`GET /api/products/:productId`

Returns one product with related data:

- variants
- images
- media
- seo
- translations
- faqs
- reviews

### Create product

`POST /api/products`

Required fields:

- `sku`
- `name`
- `slug`
- `brand_id`
- `category_id`

Optional fields include:

- `short_description`
- `description`
- `key_features`
- `materials`
- `use_cases`
- `benefits`
- `status`
- `is_featured`
- `is_published`
- `tags`
- `gender`
- `age_group`
- `material`
- `tax_class`
- `seo`

Example payload:

```json
{
  "sku": "sandals-sandals",
  "name": "sandals-sandals",
  "slug": "sandals-sandals",
  "short_description": "sandals-sandals",
  "description": "sandals-sandals",
  "key_features": ["sandals-sandals"],
  "materials": ["sandals-sandals"],
  "use_cases": ["sandals-sandals"],
  "benefits": ["sandals-sandals"],
  "brand_id": "sandals-sandals",
  "category_id": "cmp75t2040001vlos5xmq8xos",
  "status": "DRAFT",
  "is_featured": true,
  "is_published": false,
  "tags": ["sandals-sandals"],
  "gender": "men",
  "age_group": "sandals-sandals",
  "material": "sandals-sandals",
  "tax_class": "sandals-sandals",
  "seo": {
    "meta_title": "Sandals",
    "meta_description": "Sandals product page",
    "slug": "sandals-sandals"
  }
}
```

### Update basic product info

`PATCH /api/products/:productId/basic-info`

This endpoint updates the main product fields in one request.

Rules:

- Any field may be omitted.
- Omitted fields keep their current value.
- `sku` and `slug` are checked for uniqueness when changed.
- `category_id` is checked for existence when changed.
- Nullable JSON `specifications` can be set to `null` to clear it.

Fields supported by this endpoint:

- `sku`
- `name`
- `slug`
- `short_description`
- `description`
- `key_features`
- `materials`
- `specifications`
- `use_cases`
- `how_to_use`
- `benefits`
- `problem_solved`
- `brand_id`
- `category_id`
- `status`
- `is_featured`
- `is_published`
- `tags`
- `gender`
- `age_group`
- `material`
- `tax_class`
- `weight`
- `length`
- `width`
- `height`

Example payload:

```json
{
  "sku": "sandals-sandals",
  "name": "sandals-sandals",
  "slug": "sandals-sandals",
  "short_description": "sandals-sandals",
  "description": "sandals-sandals",
  "key_features": ["sandals-sandals"],
  "materials": ["sandals-sandals"],
  "specifications": null,
  "use_cases": ["sandals-sandals"],
  "how_to_use": null,
  "benefits": ["sandals-sandals"],
  "problem_solved": null,
  "brand_id": "sandals-sandals",
  "category_id": "cmp75t2040001vlos5xmq8xos",
  "status": "DRAFT",
  "is_featured": true,
  "is_published": false,
  "tags": ["sandals-sandals"],
  "gender": "men",
  "age_group": "sandals-sandals",
  "material": "sandals-sandals",
  "tax_class": "sandals-sandals",
  "weight": null,
  "length": null,
  "width": null,
  "height": null
}
```

## Related Product Resources

### Variants

`POST /api/products/:productId/variants`

`GET /api/products/:productId/variants`

### Images

`POST /api/products/:productId/images`

### SEO

`POST /api/products/:productId/seo`

### Translations

`POST /api/products/:productId/translations`

### FAQs

`POST /api/products/:productId/faqs`

### Reviews

`POST /api/products/:productId/reviews`

### Media

`POST /api/products/:productId/media`

## Notes

- `faq_json` was removed from the product table and is no longer part of the Prisma model.
- Use the dedicated FAQ relation endpoints instead of storing FAQ content on the product row.
- Create products first, then attach variants, images, SEO, translations, FAQs, reviews, and media through the child endpoints.