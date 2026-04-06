"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import WMTS from 'ol/source/WMTS';
import WMTSTileGrid from 'ol/tilegrid/WMTS';
import { get as getProjection } from 'ol/proj';
import { getTopLeft, getWidth } from 'ol/extent';
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const createWMTSSource = (config: any) => {
  const projection = getProjection("EPSG:3857");
  const projectionExtent = projection!.getExtent();
  const size = getWidth(projectionExtent) / 256;
  const resolutions = new Array(26);
  const matrixIds = new Array(26);

  for (let z = 0; z < 26; ++z) {
    resolutions[z] = size / Math.pow(2, z);
    matrixIds[z] = z.toString();
  }

  const tileGrid = new WMTSTileGrid({
    origin: getTopLeft(projectionExtent),
    resolutions: resolutions,
    matrixIds: matrixIds,
  });

  return new WMTS({
    url: `${API_BASE_URL}/api/proxy/wmts`,
    layer: config.layers,
    matrixSet: config.matrix_set || "WebMercatorQuad",
    format: "image/png",
    projection: projection!,
    requestEncoding: 'KVP',
    tileGrid: tileGrid,
    style: '',
    tileLoadFunction: (imageTile: any, src: string) => {
      const tileCoord = imageTile.getTileCoord();
      const z = tileCoord[0];
      const x = tileCoord[1];
      const y = tileCoord[2];

      const proxyUrl = `${API_BASE_URL}/api/proxy/wmts?layer=${config.layers}&tilematrix=${z}&tilecol=${x}&tilerow=${y}`;
      imageTile.getImage().src = proxyUrl;
    }
  });
};

export default function MapEditor() {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  
  const [layerConfigs, setLayerConfigs] = useState<any[]>([]);
  const [activeStatus, setActiveStatus] = useState<Record<number, boolean>>({});
  const activeTilesRef = useRef<Record<number, TileLayer<WMTS>>>({});
  const [legendData, setLegendData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!mapElement.current) return;

    const map = new Map({
      target: mapElement.current,
      layers: [
        new TileLayer({ source: new OSM() })
      ],
      view: new View({
        center: [13139395, -209819], 
        zoom: 5,
      }),
    });

    mapRef.current = map;
    return () => map.setTarget(undefined);
  }, []);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/layers`)
      .then(res => res.json())
      .then(data => setLayerConfigs(data))
      .catch(err => console.error("Gagal load layers:", err));
  }, []);

  useEffect(() => {
    Object.keys(activeStatus).forEach((id) => {
      const config = layerConfigs.find((c) => c.id === parseInt(id));
      if (activeStatus[id] && config && !legendData[config.layers]) {
        fetch(`${API_BASE_URL}/api/proxy/legend?layer=${config.layers}`)
          .then((res) => res.json())
          .then((data) => {
            setLegendData((prev) => ({ ...prev, [config.layers]: data }));
          })
          .catch((err) => console.error("Error fetching legend:", err));
      }
    });
  }, [activeStatus, layerConfigs]);

  useEffect(() => {
    if (!mapRef.current || layerConfigs.length === 0) return;

    layerConfigs.forEach((config) => {
      const isActive = activeStatus[config.id];
      const isLoaded = activeTilesRef.current[config.id];

      if (isActive && !isLoaded) {
        const newLayer = new TileLayer({
          source: createWMTSSource(config),
          opacity: 0.8
        });
        mapRef.current?.addLayer(newLayer);
        activeTilesRef.current[config.id] = newLayer;
      } else if (!isActive && isLoaded) {
        mapRef.current?.removeLayer(isLoaded);
        delete activeTilesRef.current[config.id];
      }
    });
  }, [activeStatus, layerConfigs]);

  const activeLayerConfigs = layerConfigs.filter(c => activeStatus[c.id]);

  return (
    <div className="relative w-full h-screen bg-zinc-950 flex overflow-hidden">
      {/* SIDEBAR */}
      <div className="w-80 h-full bg-zinc-900 border-r border-zinc-800 p-6 z-20 flex flex-col shadow-xl">
        <h1 className="text-xl font-bold text-white mb-6 tracking-tight">Spatial Explorer</h1>
        <div className="space-y-4 overflow-y-auto custom-scrollbar">
          {layerConfigs.map((layer) => (
            <div key={layer.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/30 border border-zinc-800/50 hover:bg-zinc-800/60 transition-all">
              <div className="space-y-1 flex-1 pr-4">
                <Label className="text-sm font-semibold text-zinc-100 cursor-pointer">{layer.name}</Label>
                <p className="text-[10px] text-zinc-500 line-clamp-1">{layer.short_description}</p>
              </div>
              <Switch 
                checked={activeStatus[layer.id] || false}
                onCheckedChange={(val) => setActiveStatus(prev => ({...prev, [layer.id]: val}))}
              />
            </div>
          ))}
        </div>
      </div>

      {/* MAP AREA */}
      <div ref={mapElement} className="flex-1 h-full relative">
        
        {/* DYNAMIC LEGEND */}
        {activeLayerConfigs.length > 0 && (
          <Card className="absolute bottom-6 right-6 z-10 w-72 bg-zinc-950/90 text-white p-5 shadow-2xl border-zinc-800 backdrop-blur-md rounded-2xl flex flex-col">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-xs uppercase tracking-widest text-emerald-500">Legend</h3>
              <span className="text-[9px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">Live Data</span>
            </div>

            <div className="space-y-6 max-h-96 overflow-y-auto custom-scrollbar pr-1">
              {activeLayerConfigs.map((config) => {
                const currentLegend = legendData[config.layers];
                const layerData = currentLegend?.Legend?.[0];
                const rules = layerData?.rules || [];

                return (
                  <div key={config.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <h4 className="text-[11px] font-bold text-zinc-200 mb-3 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                      {config.name}
                    </h4>
                    
                    <div className="space-y-1.5 pl-3">
                      {rules.map((rule: any, idx: number) => {
                        const symbolizer = rule.symbolizers[0];
                        const colormapEntries = symbolizer?.Raster?.colormap?.entries;
                        
                        if (colormapEntries) {
                          return colormapEntries.map((entry: any, eIdx: number) => (
                            <div key={`${idx}-${eIdx}`} className="flex items-center gap-2 group">
                              <div 
                                className="w-3 h-3 rounded-sm border border-white/10 shadow-sm"
                                style={{ backgroundColor: entry.color }}
                              />
                              <span className="text-[10px] text-zinc-400 group-hover:text-zinc-200 transition-colors">
                                {entry.label}
                              </span>
                            </div>
                          ));
                        }

                        const vectorColor = symbolizer?.Polygon?.fill || symbolizer?.Line?.stroke || "#ccc";
                        return (
                          <div key={idx} className="flex items-center gap-2 group">
                            <div 
                              className="w-3 h-3 rounded-sm border border-white/10 shadow-sm"
                              style={{ backgroundColor: vectorColor }}
                            />
                            <span className="text-[10px] text-zinc-400 group-hover:text-zinc-200 transition-colors">
                              {rule.title || rule.name || "Unnamed Boundary"}
                            </span>
                          </div>
                        );
                      })}

                      {!currentLegend && (
                        <p className="text-[10px] text-zinc-600 animate-pulse italic">Loading colors...</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};