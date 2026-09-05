# Deadlock Tracker

A React and TypeScript application for exploring Deadlock player profiles, match
history, teammates, hero performance, and item usage.

The home page loads hero names and portraits through the installed
`deadlock_api_client` (`HeroesApi.listHeroes`, `/v1/assets/heroes`). API access
lives in `src/services/heroes.ts`. The carousel requests `onlyActive: true` to
exclude unselectable, disabled, or in-development heroes, and displays a fallback
when a portrait is missing.
Rotation pauses on hover or keyboard focus; reduced-motion users can scroll
the row manually.

## Development

```sh
npm install
npm run dev
```

Use `npm run build` for a production build and `npm run lint` to run ESLint.
