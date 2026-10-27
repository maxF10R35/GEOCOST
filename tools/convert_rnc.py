#!/usr/bin/env python3
"""GeoCoast SC · RNC SHP -> teselas de segmentos viales servibles por Netlify.

Fuente: Red Nacional de Caminos INEGI/SICT. Usa geometría de red_vial.shp y
atributos Cond_Pav, Recubri y Tipo_Vial de red_vial.dbf; .shx y .prj necesarios.
NO inventa rodamiento para atributos vacíos; clasificación ocurre en rnc-core.js.

Ejemplo:
  python -m pip install pyshp pyproj
  python tools/convert_rnc.py --input /datos/RNC/red_vial.shp \\
      --output data/rnc --year 2025

Salida: manifest.json + tiles/<x>_<y>.ndjson. El paquete de datos de la RNC
puede ser MUY voluminoso: revisar tamaño/cuota de Netlify antes de desplegar.
"""
from __future__ import annotations
import argparse
from collections import OrderedDict
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import shutil

CELL=0.2
FIELDS=('Id_Red','Tipo_Vial','Cond_Pav','Recubri')


def tile(lon,lat): return math.floor(lon/CELL),math.floor(lat/CELL)

class TileWriter:
    def __init__(self,directory):
        self.directory=directory;self.opened=OrderedDict();self.counts={};directory.mkdir(parents=True,exist_ok=True)
    def write(self,id,feature):
        if id in self.opened:
            handle=self.opened.pop(id)
        else:
            if len(self.opened)>=48:
                _,old=self.opened.popitem(last=False);old.close()
            handle=(self.directory/f'{id}.ndjson').open('a',encoding='utf-8')
        self.opened[id]=handle
        handle.write(json.dumps(feature,separators=(',',':'),ensure_ascii=False)+'\n')
        self.counts[id]=self.counts.get(id,0)+1
    def close(self):
        for f in self.opened.values():f.close()
        self.opened.clear()


def main():
    ap=argparse.ArgumentParser(description='Convertir RNC 2025 SHP/DBF/SHX/PRJ a teselas de GeoCoast')
    ap.add_argument('--input',required=True,help='ruta completa a red_vial.shp')
    ap.add_argument('--output',default='data/rnc',help='carpeta de salida')
    ap.add_argument('--year',default='2025');ap.add_argument('--limit',type=int,default=0,help='solo diagnóstico (máx entidades)')
    args=ap.parse_args();shp=Path(args.input);base=shp.with_suffix('')
    required=[base.with_suffix(x) for x in ('.shp','.shx','.dbf','.prj')]
    missing=[str(p) for p in required if not p.is_file()]
    if missing:raise SystemExit('No se puede convertir la RNC: faltan '+', '.join(missing))
    import shapefile
    from pyproj import CRS,Transformer
    src=CRS.from_wkt(base.with_suffix('.prj').read_text(encoding='utf-8'))
    target=CRS.from_epsg(4326)
    transform=Transformer.from_crs(src,target,always_xy=True).transform
    reader=shapefile.Reader(str(shp),encoding='latin1')
    names=[f[0] for f in reader.fields[1:]]
    canon={field:next((x for x in names if x.lower()==field.lower()),None) for field in FIELDS}
    if not canon['Cond_Pav'] or not canon['Recubri'] or not canon['Tipo_Vial']:
        raise SystemExit('La DBF no contiene Cond_Pav, Recubri y Tipo_Vial; revisar la versión de la RNC. Campos: '+', '.join(names))
    dest=Path(args.output);tiles=dest/'tiles'
    if dest.exists() and (dest/'manifest.json').exists():raise SystemExit('Hay RNC instalada en destino. Cambie --output o borre ese directorio de manera explícita.')
    if tiles.exists() and any(tiles.iterdir()):raise SystemExit('La carpeta tiles no está vacía; no se mezclan versiones.')
    writer=TileWriter(tiles);entities=0;parts=0;errors=0
    try:
        for i,entry in enumerate(reader.iterShapeRecords()):
            if args.limit and i>=args.limit:break
            entities+=1
            props={targetField:str(entry.record[names.index(field)] if field else '').strip()
                   for targetField,field in canon.items()}
            geom=entry.shape
            if geom.shapeType not in (3,13,23):continue # polilínea, Z, M
            pts=geom.points
            cut=list(geom.parts)+[len(pts)]
            for start,stop in zip(cut[:-1],cut[1:]):
                for j in range(start+1,stop):
                    try:
                        a=transform(*pts[j-1]);b=transform(*pts[j]);
                        if not all(math.isfinite(v) for v in (*a,*b)):continue
                        if not all(-118.0<=v<=-85.0 for v in (a[0],b[0])) or not all(14<=v<=33 for v in (a[1],b[1])):continue
                        # Dividir geometría larga para no llenar innecesariamente teselas
                        n=max(1,math.ceil(max(abs(b[0]-a[0]),abs(b[1]-a[1]))/(CELL/2)))
                        for s in range(n):
                            x=s/n;y=(s+1)/n
                            u=[round(a[0]+(b[0]-a[0])*x,7),round(a[1]+(b[1]-a[1])*x,7)]
                            v=[round(a[0]+(b[0]-a[0])*y,7),round(a[1]+(b[1]-a[1])*y,7)]
                            if u==v:continue
                            line={'id':f'rnc-{i}-{j}-{s}','tags':{'rnc':True,'rncProps':props},'geometry':[{'lon':u[0],'lat':u[1]},{'lon':v[0],'lat':v[1]}]}
                            # Incluir solo las teselas atravesadas, con tolerancia de borde
                            ids={tile(*u),tile(*v),tile((u[0]+v[0])/2,(u[1]+v[1])/2)}
                            for ix,iy in ids:writer.write(f'{ix}_{iy}',line)
                            parts+=1
                    except (TypeError,ValueError,OverflowError):errors+=1
            if entities%250000==0:print(f'Procesadas {entities:,} entidades; {parts:,} segmentos...',flush=True)
    finally:writer.close()
    meta={'format':'geocoast-rnc-tiles-v1','year':args.year,'tileDegrees':CELL,
          'crs':'EPSG:4326','source':'Red Nacional de Caminos INEGI/SICT','attributes':list(FIELDS),
          'entities':entities,'segments':parts,'transformErrors':errors,
          'generatedAt':datetime.now(timezone.utc).isoformat(),'tiles':sorted(writer.counts)}
    dest.mkdir(parents=True,exist_ok=True)
    (dest/'manifest.json').write_text(json.dumps(meta,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(f'Concluido: {entities:,} entidades, {parts:,} tramos, {len(writer.counts):,} teselas; {errors:,} fallas de geometría. Destino: {dest.resolve()}')

if __name__=='__main__':main()
