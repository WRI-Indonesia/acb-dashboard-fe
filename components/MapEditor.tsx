"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import Image from 'next/image';
import WMTS from 'ol/source/WMTS';
import WMTSTileGrid from 'ol/tilegrid/WMTS';
import { get as getProjection } from 'ol/proj';
import { getTopLeft, getWidth } from 'ol/extent';
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ChevronUp, ChevronDown, Map as MapIcon, Layers, Info } from 'lucide-react';

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
    <div className="relative w-full h-screen bg-white flex overflow-hidden font-sans">
      
      {/* LEFT SIDEBAR */}
      <div className="w-[70px] h-full bg-[#031d16] flex flex-col items-center py-6 gap-8 border-r border-white/5 z-30 shadow-2xl relative">
        <div className="w-10 h-10 relative mb-2">
          <Image 
            src="/bsf_logo.png" 
            alt="BSF Logo" 
            fill 
            className="object-contain"
          />
        </div>

        <div className="flex flex-col gap-4 w-full items-center">
          <div className="w-12 h-12 bg-[#062c21] rounded-xl flex items-center justify-center shadow-inner cursor-pointer transition-all border border-white/10">
            <Layers size={22} />
          </div>

          <div className="w-12 h-12 flex items-center justify-center hover:text-[#4ade80] rounded-xl hover:bg-[#062c21]/50 cursor-pointer transition-all">
            <MapIcon size={22} />
          </div>
        </div>
      </div>

      {/* LAYER PANEL (ABSOLUTE) */}
      <div className="absolute left-[70px] top-0 w-[310px] bg-[#20372A] flex flex-col h-fit max-h-screen z-20 shadow-2xl rounded-br-2xl">
        <div className="p-3 pt-[48px] pr-[20px] pb-[24px] pl-[20px] shrink-0">
          <h1 className="text-xl font-medium text-white tracking-tight leading-tight">
            Data Spatial Layer
          </h1>
          <p className="text-[11px] text-[#a1b3ae] mt-2 leading-relaxed">
            Enable/Disable Spatial Layers: Use the toggles to customize your data visualization
          </p>
        </div>

        <div className="bg-[#d9e5db] shadow-inner overflow-hidden rounded-br-2xl min-h-0">
          <div className="overflow-y-auto px-1 py-3 space-y-0.5 custom-scrollbar-light max-h-[calc(100vh-120px)]">
            {layerConfigs.map((layer) => (
              <div 
                key={layer.id} 
                className="flex items-center p-4 rounded-lg transition-all group hover:bg-white/20 gap-4 w-full"
              >
                <Switch 
                  checked={activeStatus[layer.id] || false}
                  onCheckedChange={(val) => setActiveStatus(prev => ({...prev, [layer.id]: val}))}
                  className="data-[state=checked]:bg-[#20372A] data-[state=unchecked]:bg-[#ffffff]/60 shrink-0"
                />
                <div className="flex flex-col flex-1 min-w-0 pr-2">
                  <Label 
                    className="text-[13px] font-bold leading-tight cursor-pointer text-[#062c21] truncate block w-full"
                  >
                    {layer.name}
                  </Label>
                  <p className="text-[10px] mt-1 text-[#062c21]/80 truncate w-full">
                    {layer.short_description || "Lorem ipsum dolor sit amet"}
                  </p>
                </div>
                <Info size={16} className="text-[#062c21]/40 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MAP AREA */}
      <div ref={mapElement} className="flex-1 h-full relative z-10">
        
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
                                      <div className="w-4 h-4 rounded-full border border-zinc-200 shadow-sm transition-transform group-hover:scale-110" style={{ backgroundColor: entry.color }} />
                                      <span className="text-[11px] text-zinc-600 font-medium">{entry.label}</span>
                                    </div>
                                  ));
                                }

                                const vectorColor = symbolizer?.Polygon?.fill || symbolizer?.Line?.stroke || "#ccc";
                                return (
                                  <div key={idx} className="flex items-center gap-3 group cursor-default">
                                    <div className="w-4 h-4 rounded-full border border-zinc-200 shadow-sm transition-transform group-hover:scale-110" style={{ backgroundColor: vectorColor }} />
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

      <style jsx global>{`
        .custom-scrollbar-green::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar-green::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar-green::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};