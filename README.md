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
