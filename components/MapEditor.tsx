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
import { ChevronUp, ChevronDown } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type LayerConfig = {
  citation: string;
  content_date: string;
  data_format: string;
  description: string;
  disclaimer: string;
  format: string;
  has_child: boolean;
  id: number;
  layers: string;
  matrix_set: string;
  name: string;
  service: string;
  short_description: string;
  source: string;
  source_link: string;
  spatial_resolution: string;
  srs: string;
  styles: string;
  url: string;
  version: string;
};

type TileCoord = [z: number, x: number, y: number];

type WMTSTileImage = {
  getTileCoord: () => TileCoord;
  getImage: () => HTMLImageElement;
};

type LegendEntry = {
  color: string;
  label?: string;
};

type LegendSymbolizer = {
  Raster?: { colormap?: { entries?: LegendEntry[] } };
  Polygon?: { fill?: string };
  Line?: { stroke?: string };
};

type LegendRule = {
  title?: string;
  name?: string;
  symbolizers: LegendSymbolizer[];
};

type LegendLayer = {
  rules?: LegendRule[];
};

type LegendResponse = {
  Legend?: LegendLayer[];
};

const createWMTSSource = (config: LayerConfig) => {
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
    tileLoadFunction: (imageTile: unknown, src: string) => {
      const tile = imageTile as WMTSTileImage;
      const tileCoord = tile.getTileCoord();
      const z = tileCoord[0];
      const x = tileCoord[1];
      const y = tileCoord[2];

      const proxyUrl = `${API_BASE_URL}/api/proxy/wmts?layer=${config.layers}&tilematrix=${z}&tilecol=${x}&tilerow=${y}`;
      tile.getImage().src = proxyUrl;
    }
  });
};

export default function MapEditor() {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  
  const [layerConfigs, setLayerConfigs] = useState<LayerConfig[]>([]);
  const [activeStatus, setActiveStatus] = useState<Record<string, boolean>>({});
  const activeTilesRef = useRef<Record<number, TileLayer<WMTS>>>({});
  const [legendData, setLegendData] = useState<Record<string, LegendResponse>>({});
  const [isLegendExpanded, setIsLegendExpanded] = useState(true);

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
      const isActive = activeStatus[String(config.id)];
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

  const activeLayerConfigs = layerConfigs.filter(c => activeStatus[String(c.id)]);

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
        <div className="absolute bottom-6 right-6 z-10 flex flex-col items-end gap-0 transition-all duration-300">
          
          <button 
            onClick={() => setIsLegendExpanded(!isLegendExpanded)}
            className="bg-white p-1.5 rounded-t-lg shadow-sm border-x border-t border-zinc-200 text-zinc-800 hover:bg-zinc-50 transition-all flex items-center justify-center w-10 h-8"
          >
            {isLegendExpanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
          </button>

          {isLegendExpanded && (
            <div className="w-[380px] bg-white shadow-2xl border-zinc-200 overflow-hidden rounded-l-xl rounded-br-xl animate-in fade-in slide-in-from-bottom-2 duration-200 flex flex-col">
              <div className="bg-[#064e3b] px-5 py-3.5 flex items-center justify-between">
                <h3 className="font-bold text-sm text-white tracking-wide">Legend</h3>
                
                <button className="bg-[#059669] hover:bg-[#047857] text-white text-[10px] font-medium px-4 py-1.5 rounded-full transition-colors">
                  Export area as Image
                </button>
              </div>

              <div className="bg-white">
                {activeLayerConfigs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[90px]">
                    <p className="text-zinc-400 text-[13px] mb-2 font-medium">No layers data is selected</p>
                    <div className="flex items-center gap-3 text-[#064e3b] font-bold">
                      <svg width="24" height="16" viewBox="0 0 28 20" fill="none">
                          <rect x="0.5" y="4.5" width="23" height="11" rx="5.5" fill="white" stroke="#064E3B"/>
                          <circle cx="7" cy="10" r="3.5" fill="#064E3B"/>
                      </svg>
                      <span className="text-[14px]">Activate your layers filter first</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 max-h-[350px] overflow-y-auto custom-scrollbar">
                    <div className="space-y-6">
                      {activeLayerConfigs.map((config) => {
                        const currentLegend = legendData[config.layers];
                        const rules = currentLegend?.Legend?.[0]?.rules || [];

                        return (
                          <div key={config.id} className="animate-in fade-in duration-300">
                            <h4 className="text-[11px] font-bold text-zinc-800 mb-3 flex items-center gap-2 uppercase tracking-tight">
                              <span className="w-1.5 h-1.5 bg-[#059669] rounded-full"></span>
                              {config.name}
                            </h4>
                            
                            <div className="space-y-2.5 pl-4 border-l border-zinc-100 ml-0.5">
                              {rules.map((rule: any, idx: number) => {
                                const symbolizer = rule.symbolizers[0];
                                const colormapEntries = symbolizer?.Raster?.colormap?.entries;
                                
                                if (colormapEntries) {
                                  return colormapEntries.map((entry: any, eIdx: number) => (
                                    <div key={`${idx}-${eIdx}`} className="flex items-center gap-3 group cursor-default">
                                      <div className="w-4 h-4 rounded-sm border border-zinc-200 shadow-sm transition-transform group-hover:scale-110" style={{ backgroundColor: entry.color }} />
                                      <span className="text-[11px] text-zinc-600 font-medium">{entry.label}</span>
                                    </div>
                                  ));
                                }

                                const vectorColor = symbolizer?.Polygon?.fill || symbolizer?.Line?.stroke || "#ccc";
                                return (
                                  <div key={idx} className="flex items-center gap-3 group cursor-default">
                                    <div className="w-4 h-4 rounded-sm border border-zinc-200 shadow-sm transition-transform group-hover:scale-110" style={{ backgroundColor: vectorColor }} />
                                    <span className="text-[11px] text-zinc-600 font-medium">{rule.title || rule.name}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};