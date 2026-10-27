# -*- coding: utf-8 -*-
"""Uso: python tools/build_referencias.py ref_ruta_22oct2026.csv  (ejecutar en la raíz del proyecto GeoCost_SC)
Genera data/zt_centroides.csv, data/referencias.json y data/origen_map.json"""
import sys, json, glob, math, re, unicodedata
import numpy as np, pandas as pd
ref = pd.read_csv(sys.argv[1], low_memory=False)

def ring_centroid(ring):
    lat0 = np.mean([p[1] for p in ring]); k = math.cos(math.radians(lat0))
    x = [p[0]*k for p in ring]; y = [p[1] for p in ring]
    a = cx = cy = 0.0
    for i in range(len(ring)):
        j = (i+1) % len(ring); c = x[i]*y[j]-x[j]*y[i]
        a += c; cx += (x[i]+x[j])*c; cy += (y[i]+y[j])*c
    if abs(a) < 1e-12: return None, 0
    return (cy/(3*a), cx/(3*a)/k), abs(a)/2

rows = {}
for f in glob.glob('data/zt/*.json'):
    if f.endswith('index.json'): continue
    for z in json.load(open(f, encoding='utf-8')):
        best, area = None, -1
        for ring in z['rings']:
            c, a = ring_centroid(ring)
            if c and a > area: best, area = c, a
        b = z['bbox']; w = (b[2]-b[0])*111.32*math.cos(math.radians((b[1]+b[3])/2))
        if best is None: best = ((b[1]+b[3])/2, (b[0]+b[2])/2)
        rows[str(z['id'])] = (round(best[0], 5), round(best[1], 5), round(w, 1))
need = ref.ZonaDestino.astype(str).drop_duplicates()
cen = pd.DataFrame([(z, *rows[z], 'poligono ZT (data/zt)', 'zona') for z in need if z in rows],
                   columns=['ZonaDestino', 'lat', 'lon', 'ancho_km', 'fuente', 'precision'])
cen.to_csv('data/zt_centroides.csv', index=False, encoding='utf-8-sig')
print('centroides: %d de %d ZT (%.2f%%)' % (len(cen), len(need), 100*len(cen)/len(need)),
      '| zonas amplias >15 km:', int((cen.ancho_km > 15).sum()))

m = ref.merge(cen[['ZonaDestino', 'lat', 'lon', 'ancho_km']], on='ZonaDestino')
r0 = lambda v: None if pd.isna(v) else int(round(v))
cols = ['IdOrigen', 'ZT', 'Tipo', 'Kms', 'lat', 'lon', 'Mediana', 'Base', 'Ajustes', 'Casetas', 'Min', 'Max',
        'nFleteros', 'TieneCasetas', 'Fecha', 'Estado', 'Municipio', 'Ancho']
data = [[r.IdOrigen, r.ZonaDestino, r.TipoConexion, None if pd.isna(r.Kms) else round(r.Kms, 1), r.lat, r.lon,
         r0(r.Tarifa_Mediana), r0(r.Base_Mediana), r0(r.Ajustes_Mediana), r0(r.Casetas_Mediana), r0(r.Tarifa_Min),
         r0(r.Tarifa_Max), int(r.n_fleteros), int(bool(r.Tiene_Casetas)), str(r.Fecha_Mas_Reciente)[:10],
         None if pd.isna(r.Estado) else r.Estado, None if pd.isna(r.Municipio) else r.Municipio, r.ancho_km]
        for r in m.itertuples()]
json.dump({'cols': cols, 'rows': data, 'corte': str(ref.Fecha_Mas_Reciente.max())[:10]},
          open('data/referencias.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('referencias.json filas:', len(data))

# origen GeoCost (bodegas.json) -> IdOrigen por nombre normalizado; si hay varios, el de más filas
n = lambda s: re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFD', str(s).lower()).encode('ascii', 'ignore').decode())
cnt = ref.groupby(['IdOrigen', 'Origen']).size().reset_index(name='n').sort_values('n', ascending=False)
alias = {'Merida': 'EC19', 'Texcoco': 'ED39', 'Cancun (Pmxa)': 'EB91', 'Valladolid OL': 'EB97', 'Valladolid': 'EB97',
         'Tapachula (U.E.)': 'EC03', 'Arriaga (Virtual)': 'EC08', 'Toluca': 'EB47', 'Huajuapan de Leon': 'EC01'}
mapa, sin = {}, []
for name, *_ in json.load(open('data/bodegas.json', encoding='utf-8')):
    hit = cnt[cnt.Origen.map(n) == n(name)]
    if name in alias: mapa[name] = alias[name]
    elif len(hit): mapa[name] = hit.IdOrigen.iloc[0]
    else: sin.append(name)
json.dump(mapa, open('data/origen_map.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print('origen_map:', len(mapa), '| sin equivalente:', sin)
