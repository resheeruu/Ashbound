# Development

## Requirements

- Node.js >= 22
- npm

## Setup

```bash
npm ci
cp .env.example .env
npm run db:migrate
npm run dev
```

## Testing

```bash
npm run test:unit
```

## Type Check

```bash
npm run typecheck
```

## Build

```bash
npm run build
```
