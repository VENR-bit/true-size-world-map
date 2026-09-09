# The World at True Size

An interactive equal-area world map: every country is drawn at its correct share of the
Earth's surface, and the page shows you the arithmetic rather than asking you to trust it.

Open `index.html` in a browser. No build step, no install.

## Why equal-area

A sphere cannot be flattened without stretching something. Gauss proved it; Tissot showed
the consequence: a flat map can hold **area** true or **shape** true, never both at once.
This map holds area exact and spends the error on shape, mostly near the poles and the
outer edges. That is the honest trade if what you want is correct sizes.

The default projection is **Equal Earth** (Šavrič, Patterson & Jenny, 2018).

## What it does

- **Eight projections**, grouped by what they preserve — five equal-area (Equal Earth,
  Mollweide, Eckert IV, Hammer, Gall–Peters), two compromise (Robinson, Natural Earth),
  and Mercator, flagged in the masthead as getting sizes wrong.
- **Size check**: for the current projection, how many times its true size each country is
  drawn. On any equal-area projection every figure reads exactly `1.00×`.
- **Pan and pinch-zoom** to `14×`, bounded so the world cannot be dragged off the plate.
  Zoom is a uniform scale of the whole plate, so it cannot change relative areas — every
  figure holds at any magnification.
- **Click or hover** a country for its true land area and its share of all land.
- Distortion circles (Tissot's indicatrix): equal 6° circles on the globe. On an
  equal-area projection their shape changes and their area never does.

## How "size on this map" is measured

For a country, its drawn area divided by its true area on the sphere:

```
factor = (path.area(country) / d3.geoArea(country)) / s0
```

`path.area` is the projected area in map units²; `d3.geoArea` is the true area in
steradians. `s0` normalises by the projection's local area scale at 0°, 0°, computed from
the Jacobian determinant of the projection there:

```
s0 = |∂(x,y)/∂(λ,φ)| / cos(φ)
```

So `1.00×` means "drawn at true scale", and Mercator's Greenland at `16.4×` means it
occupies sixteen times the area it should relative to the equator.

A note for anyone modifying this: an earlier version measured `s0` with a small polygon
instead of the Jacobian, and wound the ring the wrong way. d3 uses spherical winding, so
it read that ring as the entire sphere and every factor came out `0.00×`. The Jacobian has
no orientation to get wrong.

## What it shows

Greenland, across projections — the classic case, since it sits at 60–83°N:

| Projection | Property | Greenland | Canada | Russia | DR Congo |
|---|---|---|---|---|---|
| Equal Earth, Mollweide, Eckert IV, Hammer, Gall–Peters | equal-area | 1.00× | 1.00× | 1.00× | 1.00× |
| Robinson | compromise | 1.97× | 1.48× | 1.50× | 1.00× |
| Natural Earth | compromise | 2.13× | 1.53× | 1.55× | 1.00× |
| Mercator | conformal | 16.4× | 5.14× | 4.90× | 1.01× |

Mercator is not a bad map, it is a navigator's map: a straight line on it is a constant
compass bearing, which is why it rules at sea and on screens that pan and zoom. The price
is area.

## Layout

```
index.html              the page
src/styles.css          all styling, themed for light and dark
src/app.js              projections, size measurement, zoom, interaction
data/countries-50m.js   Natural Earth 1:50m country polygons as TopoJSON
build.js                bundles everything into dist/artifact.html
dist/artifact.html      single-file build, published as a Claude Artifact
```

The data ships as a script that assigns `window.WORLD_50M` rather than a `.json` file that
gets fetched, so the page works when opened directly from `file://` and inside sandboxes
that block XHR.

To rebuild the single-file version after editing:

```
node build.js
```

## Data and libraries

- Country polygons: [Natural Earth](https://www.naturalearthdata.com/) 1:50m via
  [world-atlas](https://github.com/topojson/world-atlas). Natural Earth is public domain.
- [D3](https://d3js.org/) (ISC), `d3-geo-projection` (ISC), `topojson-client` (BSD-3),
  loaded from CDN at runtime — nothing is vendored.
- Type: Archivo, Archivo Narrow and IBM Plex Mono via Google Fonts.

## Known limits

- Areas are measured from 1:50m polygons, so they land within a fraction of a percent of
  official figures rather than matching them exactly (Greenland 2.15 vs 2.166 M km²).
- Antarctica runs past the edge of a Mercator sheet, so its size factor there reads `—`
  rather than a number that would be wrong.
- Natural Earth gives five disputed territories no ISO code (Somaliland, Kosovo,
  N. Cyprus, Indian Ocean Ter., Siachen Glacier); they are keyed separately so each keeps
  its own name and area. Australia and Ashmore and Cartier Is. share code 036 and are
  folded into one country.
