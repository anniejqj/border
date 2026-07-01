/**
 * Interactive Orthographic Globe — Social Science Gallery
 * Strict imitation of the HGIS UW homepage globe.
 * D3 orthographic projection, light paper-map palette,
 * single continuous landmass, subtle graticule, study-area marker.
 */
(function() {
    const STUDY_AREA = { lat: 21.55, lng: 107.97, name: 'Dongxing\u2013M\u00f3ng C\u00e1i' };
    const DATA_URL = 'data/world.json';

    // HGIS UW exact palette
    const SPHERE_FILL = '#ddd4c2';
    const LAND_FILL = '#f5efe2';
    const RULE = '#d6cdbf';
    const RULE_SOFT = '#e9e2d4';
    const MARKER_HALO = '#a08e6f';
    const MARKER_CORE = '#6a5a6e';

    const container = document.getElementById('globe-canvas');
    if (!container) return;

    const wrap = container.parentElement;

    function measure() {
        var w = wrap.clientWidth;
        // Match HGIS responsive height behavior
        var h = Math.min(560, Math.max(360, w));
        return { w: w, h: h };
    }

    var dims = measure();
    var w = dims.w, h = dims.h;
    var radius = Math.min(w, h) * 0.46;

    var svg = d3.select(container)
        .append('svg')
        .attr('width', w)
        .attr('height', h)
        .attr('viewBox', '0 0 ' + w + ' ' + h)
        .style('display', 'block')
        .style('width', '100%')
        .style('height', 'auto')
        .style('overflow', 'visible');

    // Initial rotation toward study area (not dead-center)
    var initialRotate = [-STUDY_AREA.lng + 25, -STUDY_AREA.lat * 0.6, 0];

    var projection = d3.geoOrthographic()
        .scale(radius)
        .translate([w / 2, h / 2])
        .rotate(initialRotate)
        .clipAngle(90);

    var path = d3.geoPath(projection);

    // Defs: radial sphere shade
    var defs = svg.append('defs');
    var grad = defs.append('radialGradient')
        .attr('id', 'sphere-shade')
        .attr('cx', '35%')
        .attr('cy', '35%')
        .attr('r', '70%');
    grad.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(255,255,255,0.18)');
    grad.append('stop').attr('offset', '60%').attr('stop-color', 'rgba(255,255,255,0)');
    grad.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(58,42,38,0.10)');

    // Layers
    var gSphere = svg.append('g');
    var gGraticule = svg.append('g');
    var gLand = svg.append('g');
    var gPoints = svg.append('g');

    gSphere.append('circle')
        .attr('cx', w / 2)
        .attr('cy', h / 2)
        .attr('r', radius)
        .attr('fill', SPHERE_FILL)
        .attr('stroke', RULE)
        .attr('stroke-width', 1);

    gSphere.append('circle')
        .attr('cx', w / 2)
        .attr('cy', h / 2)
        .attr('r', radius)
        .attr('fill', 'url(#sphere-shade)')
        .attr('pointer-events', 'none');

    var graticule = d3.geoGraticule10();
    var landFeature = null;

    fetch(DATA_URL)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            landFeature = landmassToFeature(data.landmass);
            render();
        })
        .catch(function(err) {
            console.error('Failed to load world data:', err);
        });

    function landmassToFeature(landmass) {
        // Convert our compact landmass polygons into a GeoJSON MultiPolygon
        var polys = [];
        landmass.forEach(function(poly) {
            if (poly.type === 'Polygon') {
                polys.push(poly.coords);
            } else if (poly.type === 'MultiPolygon') {
                polys = polys.concat(poly.coords);
            }
        });
        return { type: 'MultiPolygon', coordinates: polys };
    }

    function render() {
        gGraticule.selectAll('path').data([graticule]).join('path')
            .attr('d', path)
            .attr('fill', 'none')
            .attr('stroke', RULE_SOFT)
            .attr('stroke-width', 0.6)
            .attr('opacity', 0.55);

        if (landFeature) {
            gLand.selectAll('path').data([landFeature]).join('path')
                .attr('d', path)
                .attr('fill', LAND_FILL)
                .attr('stroke', RULE)
                .attr('stroke-width', 0.4);
        }

        var pt = [STUDY_AREA.lng, STUDY_AREA.lat];
        var r = projection.rotate();
        var center = [-r[0], -r[1]];
        var visible = d3.geoDistance(pt, center) < Math.PI / 2 - 0.02;
        var c = projection(pt);

        var pointGroup = gPoints.selectAll('g.pt').data([STUDY_AREA]);
        var enter = pointGroup.enter().append('g').attr('class', 'pt');
        enter.append('circle').attr('class', 'halo').attr('r', 7);
        enter.append('circle').attr('class', 'core').attr('r', 3);

        pointGroup.merge(enter)
            .attr('transform', function() {
                if (!c || !visible) return 'translate(-9999,-9999)';
                return 'translate(' + c[0] + ',' + c[1] + ')';
            })
            .attr('opacity', visible ? 1 : 0);

        enter.select('.halo').attr('fill', 'none').attr('stroke', MARKER_HALO).attr('stroke-width', 1.5);
        enter.select('.core').attr('fill', MARKER_CORE);
    }

    // Auto-rotate
    var autoRotate = true;
    var hoverInside = false;
    var lastT = 0;
    var timer = d3.timer(function(t) {
        if (!autoRotate) { lastT = t; return; }
        var dt = t - lastT;
        lastT = t;
        if (!landFeature) return;
        var r = projection.rotate();
        var speed = hoverInside ? 0.003 : 0.012;
        projection.rotate([r[0] + dt * speed, r[1], r[2]]);
        render();
    });

    // Cursor-aware slowdown
    wrap.addEventListener('pointerenter', function() { hoverInside = true; });
    wrap.addEventListener('pointerleave', function() { hoverInside = false; });

    // Drag to rotate
    var dragStart = null;
    svg.call(
        d3.drag()
            .on('start', function(event) {
                autoRotate = false;
                dragStart = { x: event.x, y: event.y, rot: projection.rotate() };
                container.style.cursor = 'grabbing';
            })
            .on('drag', function(event) {
                if (!dragStart) return;
                var dx = event.x - dragStart.x;
                var dy = event.y - dragStart.y;
                var k = 0.4;
                var newRot = [
                    dragStart.rot[0] + dx * k,
                    Math.max(-85, Math.min(85, dragStart.rot[1] - dy * k)),
                    dragStart.rot[2]
                ];
                projection.rotate(newRot);
                render();
            })
            .on('end', function() {
                dragStart = null;
                container.style.cursor = 'grab';
                setTimeout(function() { autoRotate = true; }, 1800);
            })
    );

    // Responsive
    var ro = new ResizeObserver(function() {
        var m = measure();
        if (m.w === w && m.h === h) return;
        w = m.w; h = m.h;
        radius = Math.min(w, h) * 0.46;
        svg.attr('width', w).attr('height', h).attr('viewBox', '0 0 ' + w + ' ' + h);
        projection.scale(radius).translate([w / 2, h / 2]);
        gSphere.selectAll('circle')
            .attr('cx', w / 2).attr('cy', h / 2).attr('r', radius);
        render();
    });
    ro.observe(wrap);

})();
