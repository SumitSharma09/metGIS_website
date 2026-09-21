"""
Builds the final, static state + per-state-district GeoJSON assets this app
ships from Survey-of-India-sourced data (see districtGeo.ts's new header for
full provenance). Applies, at build time rather than in the browser:
  - name canonicalization to match this app's own state/district spellings
  - the Andhra Pradesh -> Andhra Pradesh + Telangana split (this 2011-census
    -era file predates Telangana's 2014 formation - its districts are all
    still filed under "Andhra Pradesh")
  - the Jammu & Kashmir -> Jammu and Kashmir + Ladakh split (predates the
    2019 Reorganisation Act - same fix this app already applied to the old
    boundary source, just moved from runtime to build time here)
  - deriving Jammu and Kashmir's and Ladakh's *state-level* outlines from
    their own already-split district polygons (dissolve_outer_ring()),
    since the source's state-level file predates the split and has no
    separate Ladakh entry at all - see STATES_TO_DISSOLVE_FROM_DISTRICTS
Output: public/data/india-states.json (one FeatureCollection, all states)
        public/data/districts/<state-slug>.json (one FeatureCollection per
        state - so picking a state only downloads that state's districts,
        not the whole country).
"""
import json
import os
import re

STATE_NAME_MAP = {
    'Andaman & Nicobar Island': 'Andaman & Nicobar Islands',
    'Arunanchal Pradesh': 'Arunachal Pradesh',
    'Dadara & Nagar Havelli': 'Dadra and Nagar Haveli',
    'Daman & Diu': 'Daman and Diu',
    'Jammu & Kashmir': 'Jammu and Kashmir',
    'NCT of Delhi': 'Delhi',
}

# Pre-2016 Telangana districts (this file's Andhra Pradesh district set matches
# the pre-2014 undivided state exactly - confirmed by inspection: 23 districts,
# of which these 10 are Telangana's).
TELANGANA_DISTRICTS = {
    'Adilabad', 'Hyderabad', 'Karimnagar', 'Khammam', 'Mahbubnagar',
    'Medak', 'Nalgonda', 'Nizamabad', 'Rangareddy', 'Warangal',
}

# Matched case/space/punctuation-insensitively below (via `_fold()`) rather
# than as exact strings - a prior version of this set used exact strings and
# silently failed to match the source shapefile's actual spelling for Leh
# ("Leh (ladakh)", with a space before the parenthesis), which left that
# whole district mis-filed under Jammu and Kashmir instead of Ladakh. Folding
# to a single normalized form for comparison makes that whole class of typo
# impossible to reintroduce.
LADAKH_DISTRICTS = {'Leh', 'Leh(ladakh)', 'Leh (ladakh)', 'Kargil'}

# The source shapefile carries one district record for the erstwhile state of
# Jammu & Kashmir with DISTRICT literally set to "Data Not Available" - this
# is the Census department's placeholder for the part of the former princely
# state that isn't under Indian on-the-ground administration (so no Indian
# census was ever conducted there): Gilgit-Baltistan and the
# Mirpur-Muzaffarabad ("Azad Kashmir") area, together referred to by the
# Indian government as Pakistan-occupied Jammu and Kashmir (PoJK). Renamed
# below to that official terminology rather than shipping the confusing
# Census-artifact label verbatim.
#
# LIMITATION (disclosed, not silently papered over): India's own officially
# notified political map (Nov 2019, post-Reorganisation) shows this area
# split between two Union Territories - Gilgit-Baltistan under Ladakh UT and
# Mirpur-Muzaffarabad under Jammu & Kashmir UT - but this source ships it as
# one single combined polygon with no internal boundary between the two
# halves. Drawing a dividing line ourselves would mean inventing geography
# that isn't in any authoritative source, which is worse than the current
# gap, so it isn't attempted here. Instead the whole shape stays filed under
# "Jammu and Kashmir" (its historical undivided parent) and is flagged with
# `claimedNotAdministered: true` so the UI can (and does, see DistrictLayer)
# label it distinctly instead of presenting it as an ordinary, fully
# Indian-administered district.
POJK_RAW_NAME = 'Data Not Available'
POJK_DISPLAY_NAME = 'Pakistan-occupied Jammu and Kashmir (PoJK)'

# States whose *state-level* outline this source doesn't ship correctly split
# post-2019 - the state-level shapefile predates the Reorganisation Act and
# only has one combined "Jammu and Kashmir" polygon, with no separate Ladakh
# entry at all. That absence is what made Ladakh silently disappear from
# every state/UT picker that reads india-states.json (the Live Map's state
# search box included) even after the *district*-level Ladakh split was
# fixed above - a state can't be selected if it was never a member of the
# state list to begin with.
#
# Fixed here by deriving both states' outlines directly from their own
# already-split, already-government-sourced *district* polygons (see
# `dissolve_outer_ring()`) instead of trusting the source's stale state
# file for these two - dissolving Jammu and Kashmir's 21 post-split
# districts gives J&K's own current outline, and dissolving Ladakh's 2
# districts (Kargil + Leh (ladakh)) gives Ladakh's. This is not invented
# geography: the dividing line between the two outputs is exactly the real
# Survey-of-India district boundary between Leh/Kargil and the rest of the
# former undivided state, the same line already drawn on every district map
# in this app. Every other state's outline is left exactly as shipped by
# the source (unaffected by this).
STATES_TO_DISSOLVE_FROM_DISTRICTS = {'Jammu and Kashmir', 'Ladakh'}


def slug(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def _fold(name):
    """Case/space/punctuation-insensitive form for matching known district
    names against the source's actual (sometimes inconsistently formatted)
    spelling - see LADAKH_DISTRICTS's comment above for why this matters."""
    return re.sub(r'[^a-z0-9]+', '', name.lower())


_LADAKH_DISTRICTS_FOLDED = {_fold(name) for name in LADAKH_DISTRICTS}


def canonical_state(raw):
    return STATE_NAME_MAP.get(raw, raw)


def _ring_edges(ring):
    return [(tuple(ring[i]), tuple(ring[i + 1])) for i in range(len(ring) - 1)]


def _point_key(pt):
    # Rounded to ~0.11m of precision - enough to treat two coordinates
    # copied from the same source vertex as identical (same reasoning/
    # precision as the now-unused src/pages/live-map/stateOutline.ts, which
    # this replaces for the two states that need it).
    return (round(pt[0], 6), round(pt[1], 6))


def _ring_area(ring):
    """Shoelace formula - used only to pick the true outer boundary out of
    the small stray slivers described below, not for anything geodesic."""
    total = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        total += x1 * y2 - x2 * y1
    return abs(total) / 2.0


def dissolve_outer_ring(features):
    """Dissolves a group of adjacent district polygons down to their single
    combined outer boundary, by canceling out every edge shared by two
    neighboring districts (each side of a shared border walks that exact
    segment in the opposite direction, since every ring in this source winds
    the same way) and keeping only the edges that appear exactly once, then
    walking those into closed ring(s).

    The per-district simplification pass (docs/simplify_geojson.py) was run
    independently on each district, so two neighboring districts'
    once-shared border can disagree by a vertex or two after simplification
    - this leaves a handful of tiny (single-digit-vertex) stray loops in
    addition to the one real boundary ring. Verified by inspection for both
    call sites below (Jammu and Kashmir, Ladakh): the real boundary ring is
    4-5 orders of magnitude larger by area than every stray one, so keeping
    only the single largest-area ring reliably discards the artifacts
    without discarding real geography - there are no actual islands/
    exclaves in either state that this would wrongly drop.

    Returns a single-ring Polygon geometry (no holes - neither state this is
    used for has an internal enclave in this source)."""
    edge_counts = {}
    for feat in features:
        geom = feat['geometry']
        polys = geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]
        for poly in polys:
            for ring in poly:
                for a, b in _ring_edges(ring):
                    ka, kb = _point_key(a), _point_key(b)
                    ukey = (ka, kb) if ka < kb else (kb, ka)
                    if ukey in edge_counts:
                        edge_counts[ukey]['count'] += 1
                    else:
                        edge_counts[ukey] = {'count': 1, 'edge': (a, b)}

    # Directed outer-boundary edges, keyed by their start point - each
    # boundary point has exactly one outgoing edge, so this is enough to
    # walk each ring start-to-close.
    out_edge = {}
    for v in edge_counts.values():
        if v['count'] == 1:
            a, b = v['edge']
            out_edge[_point_key(a)] = (a, b)

    visited = set()
    rings = []
    for start_key in list(out_edge.keys()):
        if start_key in visited:
            continue
        ring = []
        cur_key = start_key
        while cur_key in out_edge and cur_key not in visited:
            a, b = out_edge[cur_key]
            visited.add(cur_key)
            ring.append(list(a))
            cur_key = _point_key(b)
            if cur_key == start_key:
                break
        if len(ring) >= 3:
            ring.append(ring[0])
            rings.append(ring)

    if not rings:
        raise ValueError('dissolve_outer_ring: no closed boundary ring found')
    outer = max(rings, key=_ring_area)
    return {'type': 'Polygon', 'coordinates': [outer]}


def load(path):
    return json.load(open(path))


def write(path, fc):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        json.dump(fc, f, separators=(',', ':'))
    print(f'{path}: {len(fc["features"])} features, {os.path.getsize(path)} bytes')


def build_states(states_path, out_path, dissolved_overrides):
    """`dissolved_overrides`: {state_name: Polygon geometry} - for
    STATES_TO_DISSOLVE_FROM_DISTRICTS, replacing (Jammu and Kashmir) or
    adding (Ladakh, which has no entry at all in the source state file)
    an outline derived from that state's own district polygons instead of
    the source's stale, pre-2019, undivided one. See that constant's
    comment for why."""
    data = load(states_path)
    features = []
    seen_states = set()
    for feat in data['features']:
        raw_name = feat['properties']['ST_NM']
        name = canonical_state(raw_name)
        seen_states.add(name)
        geometry = dissolved_overrides.get(name, feat['geometry'])
        features.append({
            'type': 'Feature',
            'properties': {'st_nm': name},
            'geometry': geometry,
        })

    # Ladakh isn't in the source state file at all (see
    # STATES_TO_DISSOLVE_FROM_DISTRICTS) - append it rather than overwrite.
    for name, geometry in dissolved_overrides.items():
        if name not in seen_states:
            features.append({
                'type': 'Feature',
                'properties': {'st_nm': name},
                'geometry': geometry,
            })

    write(out_path, {'type': 'FeatureCollection', 'features': features})


def build_districts(districts_path, out_dir):
    data = load(districts_path)
    by_state = {}
    for feat in data['features']:
        raw_state = feat['properties']['ST_NM']
        district = feat['properties']['DISTRICT']
        state = canonical_state(raw_state)

        if raw_state == 'Andhra Pradesh' and district in TELANGANA_DISTRICTS:
            state = 'Telangana'
        if state == 'Jammu and Kashmir' and _fold(district) in _LADAKH_DISTRICTS_FOLDED:
            state = 'Ladakh'

        properties = {'st_nm': state, 'district': district}
        if state == 'Jammu and Kashmir' and district == POJK_RAW_NAME:
            properties['district'] = POJK_DISPLAY_NAME
            # Not an ordinary district: no Indian civic administration, no
            # census, no monitoring towers possible there. Flagged so the UI
            # can say so plainly instead of an unexplained "No monitored
            # sites" that reads like an ordinary data gap.
            properties['claimedNotAdministered'] = True

        out_feat = {
            'type': 'Feature',
            'properties': properties,
            'geometry': feat['geometry'],
        }
        by_state.setdefault(state, []).append(out_feat)

    for state, feats in sorted(by_state.items()):
        write(os.path.join(out_dir, f'{slug(state)}.json'), {'type': 'FeatureCollection', 'features': feats})

    print(f'\n{len(by_state)} states written to {out_dir}')
    return by_state


if __name__ == '__main__':
    import sys
    states_in, districts_in, out_root = sys.argv[1], sys.argv[2], sys.argv[3]
    by_state = build_districts(districts_in, os.path.join(out_root, 'districts'))
    dissolved_overrides = {
        state: dissolve_outer_ring(by_state[state])
        for state in STATES_TO_DISSOLVE_FROM_DISTRICTS
        if state in by_state
    }
    for state, geom in dissolved_overrides.items():
        print(f'Dissolved {state} state outline from its own {len(by_state[state])} district(s): '
              f'{len(geom["coordinates"][0])} points')
    build_states(states_in, os.path.join(out_root, 'india-states.json'), dissolved_overrides)
