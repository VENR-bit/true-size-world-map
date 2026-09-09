(function(){
  var R = 6371.0088;
  var world = window.WORLD_50M;
  var fc = topojson.feature(world, world.objects.countries);
  var borders = topojson.mesh(world, world.objects.countries, function(a, b){ return a !== b; });
  var sphere = {type: "Sphere"};
  var graticule = d3.geoGraticule().step([15, 15]);

  // Natural Earth splits some countries across several features -- Australia and Ashmore
  // and Cartier Is. share ISO code 036 -- and leaves five disputed territories with no
  // code at all. Fold features sharing a code into one country, keeping the name of its
  // largest piece, and give the code-less ones a key of their own so each keeps its own
  // name and area instead of collapsing onto a single undefined key.
  var byId = {}, features = [], trueArea = {}, totalLand = 0, biggestPart = {};
  fc.features.forEach(function(f, i){
    var id = f.id != null ? String(f.id) : "u" + i;
    var part = d3.geoArea(f), cur = byId[id];
    if (cur){
      var a = cur.geometry.type === "MultiPolygon" ? cur.geometry.coordinates : [cur.geometry.coordinates];
      var b = f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [f.geometry.coordinates];
      cur.geometry = {type: "MultiPolygon", coordinates: a.concat(b)};
      if (part > biggestPart[id]){ cur.properties.name = f.properties.name; biggestPart[id] = part; }
    } else {
      byId[id] = {type: "Feature", id: id, properties: {name: f.properties.name}, geometry: f.geometry};
      biggestPart[id] = part;
      features.push(byId[id]);
    }
  });
  features.forEach(function(f){
    var a = d3.geoArea(f);
    trueArea[f.id] = a;
    totalLand += a;
  });

  var ALL = [
    {id:"equalEarth", name:"Equal Earth", year:"2018", group:"Equal-area \u2014 true sizes", prop:"Equal-area", make:function(){ return d3.geoEqualEarth(); }},
    {id:"mollweide", name:"Mollweide", year:"1805", group:"Equal-area \u2014 true sizes", prop:"Equal-area", make:function(){ return d3.geoMollweide && d3.geoMollweide(); }},
    {id:"eckert4", name:"Eckert IV", year:"1906", group:"Equal-area \u2014 true sizes", prop:"Equal-area", make:function(){ return d3.geoEckert4 && d3.geoEckert4(); }},
    {id:"hammer", name:"Hammer", year:"1892", group:"Equal-area \u2014 true sizes", prop:"Equal-area", make:function(){ return d3.geoHammer && d3.geoHammer(); }},
    {id:"gallPeters", name:"Gall\u2013Peters", year:"1855", group:"Equal-area \u2014 true sizes", prop:"Equal-area", make:function(){ return d3.geoCylindricalEqualArea && d3.geoCylindricalEqualArea().parallel(45); }},
    {id:"robinson", name:"Robinson", year:"1963", group:"Compromise \u2014 sizes close", prop:"Compromise", make:function(){ return d3.geoRobinson && d3.geoRobinson(); }},
    {id:"naturalEarth", name:"Natural Earth", year:"2012", group:"Compromise \u2014 sizes close", prop:"Compromise", make:function(){ return d3.geoNaturalEarth1(); }},
    {id:"mercator", name:"Mercator", year:"1569", group:"Conformal \u2014 true angles", prop:"Conformal", clips:true, make:function(){ return d3.geoMercator(); }}
  ];
  var PROJ = ALL.filter(function(p){ try { return !!p.make(); } catch(e){ return false; } });

  PROJ.forEach(function(p){
    var pr = p.make().fitExtent([[0, 0], [1000, 1000]], sphere);
    var b = d3.geoPath(pr).bounds(sphere);
    p.aspect = (b[1][0] - b[0][0]) / (b[1][1] - b[0][1]) || 2;
  });

  var current = PROJ[0], selected = "304", hovered = null;
  var projection = null, path = null, unitScale = 1;
  var gRoot = null, labelG = null, tf = d3.zoomIdentity, MAXK = 14;
  var DUR = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220;

  // Local area scale at a point (map units squared per steradian), from the
  // projection's Jacobian: |d(x,y)/d(lon,lat)| divided by the cos(lat) the sphere contributes.
  function localScale(lon, lat){
    var e = 0.05, r = Math.PI / 180;
    var a = projection([lon - e, lat]), b = projection([lon + e, lat]);
    var c = projection([lon, lat - e]), d = projection([lon, lat + e]);
    if (!a || !b || !c || !d) return NaN;
    var xl = (b[0] - a[0]) / (2 * e * r), yl = (b[1] - a[1]) / (2 * e * r);
    var xp = (d[0] - c[0]) / (2 * e * r), yp = (d[1] - c[1]) / (2 * e * r);
    return Math.abs(xl * yp - yl * xp) / Math.cos(lat * r);
  }

  // How many times its true size a country is drawn, relative to true scale at 0\u00B0,0\u00B0.
  function sizeFactor(id){
    var f = byId[id];
    if (!f || !trueArea[id]) return NaN;
    if (current.clips && id === "010") return NaN;   // Antarctica runs off a Mercator sheet
    var pa = Math.abs(path.area(f));
    if (!(pa > 0)) return NaN;
    return (pa / trueArea[id]) / unitScale;
  }

  var svg = d3.select("#map"), plate = document.getElementById("plate");

  function draw(reset){
    if (reset) tf = d3.zoomIdentity;
    var w = plate.clientWidth || 900;
    var maxH = Math.max(260, Math.min(window.innerHeight * 0.66, 560));
    var h = Math.round(Math.min(Math.max((w - (w < 520 ? 46 : 62)) / current.aspect + 28, 240), maxH));
    plate.style.height = h + "px";

    var padL = w < 520 ? 30 : 46;
    projection = current.make().fitExtent([[padL, 14], [w - 16, h - 14]], sphere);
    path = d3.geoPath(projection);
    unitScale = localScale(0, 0);

    svg.attr("viewBox", "0 0 " + w + " " + h);
    svg.selectAll("*").remove();
    var g = svg.append("g").attr("id", "mapgroup");

    g.append("path").attr("class", "sphere-fill").attr("d", path(sphere));
    var grat = g.append("g").attr("class", "grat-layer");
    grat.append("path").attr("class", "graticule").attr("d", path(graticule()));

    g.append("g").selectAll("path").data(features).join("path")
      .attr("class", function(d){ return "country" + (d.id === selected ? " sel" : ""); })
      .attr("d", path)
      .style("cursor", "pointer")
      .on("pointerenter", function(ev, d){ hovered = d.id; readout(d.id); })
      .on("pointerleave", function(){ hovered = null; readout(selected); })
      .on("click", function(ev, d){ selected = d.id; markSelection(); readout(d.id); });

    g.append("path").attr("class", "borders").attr("d", path(borders));
    g.append("path").attr("class", "sphere-line").attr("d", path(sphere));

    if (document.getElementById("t-tissot").checked){
      var circle = d3.geoCircle().radius(6), pts = [];
      [-60, -30, 0, 30, 60].forEach(function(lat){
        for (var lon = -160; lon <= 160; lon += 40) pts.push([lon, lat]);
      });
      g.append("g").selectAll("path").data(pts).join("path")
        .attr("class", "tissot")
        .attr("d", function(p){ return path(circle.center(p)()); });
    }

    if (document.getElementById("t-grat").checked){
      var labels = [[-60,"60\u00B0S"], [-30,"30\u00B0S"], [0,"0\u00B0"], [30,"30\u00B0N"], [60,"60\u00B0N"]];
      labelG = grat.append("g").attr("class", "par-labels");
      labelG.selectAll("text").data(labels).join("text")
        .attr("class", "par-label")
        .attr("text-anchor", "end")
        .attr("x", function(d){ var p = projection([-179.99, d[0]]); return p ? p[0] - 7 : -99; })
        .attr("y", function(d){ var p = projection([-179.99, d[0]]); return p ? p[1] + 3.4 : -99; })
        .text(function(d){ return d[1]; });
    } else {
      grat.select(".graticule").remove();
    }

    g.append("path").attr("class", "sel-outline").attr("id", "sel-outline");
    markSelection();

    // Pan is bounded by the plate itself, so the world cannot be dragged out of sight.
    gRoot = g;
    var sb = path.bounds(sphere);
    zoom.translateExtent([[sb[0][0] - 24, sb[0][1] - 24], [sb[1][0] + 24, sb[1][1] + 24]]);
    svg.call(zoom.transform, tf);
    applyTransform();
  }

  // Zooming scales the whole plate uniformly: relative areas are untouched.
  function applyTransform(){
    if (!gRoot) return;
    gRoot.attr("transform", tf);
    if (labelG) labelG.style("font-size", (9.5 / tf.k) + "px");
    document.getElementById("z-read").textContent = "\u00D7" + (tf.k < 9.95 ? tf.k.toFixed(1) : Math.round(tf.k));
    document.getElementById("z-out").disabled = tf.k <= 1.001;
    document.getElementById("z-reset").disabled = tf.k <= 1.001;
    document.getElementById("z-in").disabled = tf.k >= MAXK - 0.001;
  }

  var zoom = d3.zoom().scaleExtent([1, MAXK])
    .on("zoom", function(ev){ tf = ev.transform; applyTransform(); })
    .on("start", function(){ svg.node().classList.add("grabbing"); })
    .on("end", function(){ svg.node().classList.remove("grabbing"); });

  function zoomBy(f){ svg.transition().duration(DUR).call(zoom.scaleBy, f); }
  function resetView(){ svg.transition().duration(DUR).call(zoom.transform, d3.zoomIdentity); }

  function markSelection(){
    svg.selectAll(".country").classed("sel", function(d){ return d.id === selected; });
    var f = byId[selected];
    svg.select("#sel-outline").attr("d", f ? path(f) : null);
  }

  var fmt2 = d3.format(".2f"), fmt1 = d3.format(".1f");

  function readout(id){
    var f = byId[id];
    if (!f) return;
    var km2 = trueArea[id] * R * R;
    var share = trueArea[id] / totalLand * 100;
    document.getElementById("ro-name").textContent = f.properties.name;
    document.getElementById("ro-sub").innerHTML = "\u2248 " + (km2 >= 1e6 ? fmt2(km2 / 1e6) + " million km\u00B2" : d3.format(",")(Math.round(km2 / 1000) * 1000) + " km\u00B2")
      + " \u00B7 " + (share < 0.1 ? "<0.1" : fmt1(share)) + "% of land";
    var k = sizeFactor(id), val = document.getElementById("ro-val"), cap = document.getElementById("ro-cap");
    if (!isFinite(k)){
      val.textContent = "\u2014";
      val.className = "ro-val";
      cap.innerHTML = "runs off<br>this sheet";
      return;
    }
    var ok = Math.abs(Math.log(k)) < 0.015;
    val.textContent = (k >= 10 ? fmt1(k) : fmt2(k)) + "\u00D7";
    val.className = "ro-val " + (ok ? "ok" : "off");
    cap.innerHTML = ok ? "its<br>true size" : (k > 1 ? "too<br>large" : "too<br>small");
  }

  var CHECK = ["304", "643", "124", "076", "356", "180", "036"];
  var rowsEl = document.getElementById("rows");

  function buildRows(){
    rowsEl.innerHTML = "";
    CHECK.forEach(function(id){
      var f = byId[id];
      if (!f) return;
      var b = document.createElement("button");
      b.className = "row";
      b.type = "button";
      b.dataset.id = id;
      b.innerHTML = '<span class="rn"></span><span class="rf"></span><span class="bar"><span class="fill"></span><span class="tick"></span></span>';
      b.querySelector(".rn").textContent = f.properties.name;
      b.addEventListener("click", function(){ selected = id; markSelection(); readout(id); });
      b.addEventListener("pointerenter", function(){ readout(id); });
      b.addEventListener("pointerleave", function(){ readout(selected); });
      b.addEventListener("focus", function(){ readout(id); });
      rowsEl.appendChild(b);
    });
  }

  function pos(k){ return Math.max(0, Math.min(1, (Math.log(k) / Math.LN2 + 2) / 7)) * 100; }

  function updateRows(){
    Array.prototype.forEach.call(rowsEl.children, function(b){
      var k = sizeFactor(b.dataset.id);
      var rf = b.querySelector(".rf"), fill = b.querySelector(".fill");
      if (!isFinite(k)){ rf.textContent = "\u2014"; rf.className = "rf"; fill.style.width = "0%"; return; }
      var ok = Math.abs(Math.log(k)) < 0.015;
      rf.textContent = (k >= 10 ? fmt1(k) : fmt2(k)) + "\u00D7";
      rf.className = "rf" + (ok ? " ok" : "");
      var a = pos(1), c = pos(k);
      fill.style.left = Math.min(a, c) + "%";
      fill.style.width = Math.max(Math.abs(c - a), 1.2) + "%";
      fill.className = "fill" + (ok ? " ok" : "");
    });
  }

  // Projection register
  var reg = document.getElementById("register"), lastGroup = null;
  PROJ.forEach(function(p){
    if (p.group !== lastGroup){
      var h = document.createElement("p");
      h.className = "pgroup";
      h.textContent = p.group;
      reg.appendChild(h);
      lastGroup = p.group;
    }
    var l = document.createElement("label");
    l.className = "proj";
    l.innerHTML = '<input type="radio" name="proj"><span class="pname"></span><span class="pyear"></span>';
    l.querySelector(".pname").textContent = p.name;
    l.querySelector(".pyear").textContent = p.year;
    var input = l.querySelector("input");
    input.value = p.id;
    input.checked = p.id === current.id;
    input.addEventListener("change", function(){
      current = p;
      draw(true);
      updateRows();
      readout(hovered || selected);
      meta();
    });
    reg.appendChild(l);
  });

  function meta(){
    document.getElementById("m-proj").textContent = current.name + ", " + current.year;
    document.getElementById("m-prop").innerHTML = current.prop +
      (current.prop === "Equal-area" ? "" : '<span class="warn">sizes ' + (current.prop === "Conformal" ? "wrong" : "shift") + "</span>");
    document.getElementById("check-hint").innerHTML = current.prop === "Equal-area"
      ? "Every figure reads 1.00\u00D7 \u2014 that is what equal-area means. Choose Mercator to watch them break."
      : "Each figure is that country&rsquo;s drawn area against its true share of the globe. Equal Earth holds every one at 1.00\u00D7.";
  }

  document.getElementById("t-grat").addEventListener("change", function(){ draw(false); });
  document.getElementById("t-tissot").addEventListener("change", function(){ draw(false); });

  svg.call(zoom);
  document.getElementById("z-in").addEventListener("click", function(){ zoomBy(1.6); });
  document.getElementById("z-out").addEventListener("click", function(){ zoomBy(1 / 1.6); });
  document.getElementById("z-reset").addEventListener("click", resetView);
  svg.on("keydown", function(ev){
    var k = ev.key, step = 48;
    if (k === "+" || k === "=") { ev.preventDefault(); zoomBy(1.6); }
    else if (k === "-" || k === "_") { ev.preventDefault(); zoomBy(1 / 1.6); }
    else if (k === "0") { ev.preventDefault(); resetView(); }
    else if (k.indexOf("Arrow") === 0){
      ev.preventDefault();
      var dx = k === "ArrowLeft" ? step : k === "ArrowRight" ? -step : 0;
      var dy = k === "ArrowUp" ? step : k === "ArrowDown" ? -step : 0;
      svg.transition().duration(DUR / 2).call(zoom.translateBy, dx / tf.k, dy / tf.k);
    }
  });

  var raf = null, lastW = 0;
  new ResizeObserver(function(){
    if (plate.clientWidth === lastW) return;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function(){ lastW = plate.clientWidth; draw(true); });
  }).observe(plate);

  buildRows();
  draw(true);
  updateRows();
  readout(selected);
  meta();
})();
