#!/usr/bin/env node
// Bundles the site into dist/artifact.html — one self-contained file for Claude Artifacts.
//
// Artifacts supply their own <!doctype>, <html>, <head> and <body>, and their CSP blocks
// fetch/XHR entirely, so the data has to be inlined rather than requested. Scripts may
// still come from cdnjs and jsdelivr, so the three library tags are passed through as-is.

const fs = require("fs");
const path = require("path");

const root = __dirname;
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");

const html = read("index.html");

const body = html.match(/<body>([\s\S]*?)<\/body>/);
if (!body) throw new Error("index.html: no <body> found");

const title = html.match(/<title>[\s\S]*?<\/title>/);
if (!title) throw new Error("index.html: no <title> found");

const fonts = html.match(/<link rel="(?:preconnect|stylesheet)"[^>]*fonts\.g[^>]*>/g) || [];
const cdn = (body[1].match(/<script src="https:\/\/[^"]+"><\/script>/g) || []);
if (cdn.length !== 3) throw new Error("expected 3 CDN script tags, found " + cdn.length);

const markup = body[1].replace(/[ \t]*<script[^>]*><\/script>\n?/g, "").trim();

const out = [
  title[0],
  ...fonts,
  "<style>",
  read("src", "styles.css").trim(),
  "</style>",
  "",
  markup,
  "",
  ...cdn,
  "<script>",
  read("data", "countries-50m.js").trim(),
  "</script>",
  "<script>",
  read("src", "app.js").trim(),
  "</script>",
  ""
].join("\n");

fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(path.join(root, "dist", "artifact.html"), out);

const kb = (Buffer.byteLength(out) / 1024).toFixed(0);
console.log(`dist/artifact.html  ${kb} KB`);
