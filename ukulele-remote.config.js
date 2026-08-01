module.exports = {
  apps : [{
    name: "ukulele-remote",
    // Serves the pre-built dist/ from `npm run build:web`. Previously this ran
    // start-web.js (the Metro dev server) permanently, costing ~1 GB of RAM.
    script: "serve-web.js",
    node_args: "--max-old-space-size=128",
    autorestart: true,
    watch: false
  }]
}
