"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import Image from 'next/image';
import { Style, Stroke, Fill } from 'ol/style';
import { ChevronDown, ChevronUp, Layers, Map as MapIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SiteDetailPanel from '@/components/SiteDetailPanel';
import type { SiteDetailData } from '../../types/site';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const polygonStyle = new Style({
  stroke: new Stroke({
    color: '#ff0000',
    width: 2,
  }),
  fill: new Fill({
    color: 'rgba(255, 0, 0, 0.1)',
  }),
});

type HoverData = {
  name: string;
  area: number;
  id?: string | number;
}

type Position = number[];
type PointGeometry = {
  type: 'Point';
  coordinates: Position;
}
type MultiPointGeometry = {
  type: 'MultiPoint';
  coordinates: Position[];
}
type LineStringGeometry = {
  type: 'LineString';
  coordinates: Position[];
}
type MultiLineStringGeometry = {
  type: 'MultiLineString';
  coordinates: Position[][];
}
type PolygonGeometry = {
  type: 'Polygon';
  coordinates: Position[][];
}
type MultiPolygonGeometry = {
  type: 'MultiPolygon';
  coordinates: Position[][][];
}
type GeometryCollectionGeometry = {
  type: 'GeometryCollection';
  geometries: GeoJSONGeometry[];
}
type GeoJSONGeometry =
  | PointGeometry
  | MultiPointGeometry
  | LineStringGeometry
  | MultiLineStringGeometry
  | PolygonGeometry
  | MultiPolygonGeometry
  | GeometryCollectionGeometry;

type GeoDataItem = {
  ahpname: string;
  ahpsiteid: string | number;
  off_area: number;
  geometry: GeoJSONGeometry;
}

export default function SiteInformation() {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const vectorSourceRef = useRef<VectorSource | null>(null);
  const [geoData, setGeoData] = useState<GeoDataItem[] | null>(null);
  const pathname = usePathname();
  const [isLegendExpanded, setIsLegendExpanded] = useState(true);
  const [selectedSite, setSelectedSite] = useState<SiteDetailData | null>(null);
  const [hoverData, setHoverData] = useState<HoverData | null>(null);
  const [pointerPos, setPointerPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/v1/geos/polygon`)
      .then(res => res.json())
      .then(data => setGeoData(data))
      .catch(err => console.error("Error fetch polygon:", err));
  }, []);

  useEffect(() => {
    if (!mapElement.current) return;
    
    const vectorSource = new VectorSource();
    vectorSourceRef.current = vectorSource;

    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: polygonStyle
    });

    const map = new Map({
      target: mapElement.current,
      layers: [
        new TileLayer({ source: new OSM() }),
        vectorLayer
      ],
      view: new View({
        center: [13139395, -209819],
        zoom: 5,
      }),
    });

    map.on('click', (e) => {
      const feature = map.forEachFeatureAtPixel(e.pixel, (f) => f);
      if (feature) {
        const properties = feature.getProperties();
        setSelectedSite(properties as unknown as SiteDetailData);
      }
    });

    map.on('pointermove', (e) => {
      const feature = map.forEachFeatureAtPixel(e.pixel, (f) => f);
      
      if (feature) {
        const properties = feature.getProperties();
        
        setHoverData({
          name: properties.name,
          area: properties.area,
          id: properties.id
        });
        setPointerPos({ x: e.pixel[0], y: e.pixel[1] });
        
        map.getTargetElement().style.cursor = 'pointer';
      } else {
        setHoverData(null);
        map.getTargetElement().style.cursor = '';
      }
    });

    mapRef.current = map;
    return () => map.setTarget(undefined);
  }, []);

  useEffect(() => {
    if (geoData && Array.isArray(geoData) && vectorSourceRef.current) {
      try {
        const featureCollection = {
          type: 'FeatureCollection',
          features: geoData.map((item) => ({
            type: 'Feature',
            geometry: item.geometry, 
            properties: {
              name: item.ahpname,
              id: item.ahpsiteid,
              area: item.off_area
            }
          }))
        };

        const features = new GeoJSON().readFeatures(featureCollection, {
          featureProjection: 'EPSG:3857',
          dataProjection: 'EPSG:4326'
        });
        
        vectorSourceRef.current.clear();
        vectorSourceRef.current.addFeatures(features);

        if (features.length > 0 && mapRef.current && vectorSourceRef.current) {
          const extent = vectorSourceRef.current.getExtent();
          if (extent) {
            mapRef.current.getView().fit(extent, { 
              padding: [100, 100, 100, 100], 
              duration: 1000 
            });
          }
        }
      } catch (error) {
        console.error("Error fetching GeoJSON:", error);
      }
    }
  }, [geoData]);

  return (
    <div className="relative w-full h-screen bg-white flex overflow-hidden font-sans">
      {selectedSite && (
        <SiteDetailPanel
          site={selectedSite}
          onClose={() => setSelectedSite(null)}
        />
      )}
      
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
          <Link href="/">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all border ${
              pathname === '/' ? 'bg-[#062c21] border-white/10 text-[#4ade80]' : 'text-white/40 hover:text-[#4ade80] hover:bg-[#062c21]/50 border-transparent'
            }`}>
              <Layers size={22} />
            </div>
          </Link>

          <Link href="/site-information">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all border ${
              pathname === '/site-information' ? 'bg-[#062c21] border-white/10 text-[#4ade80]' : 'text-white/40 hover:text-[#4ade80] hover:bg-[#062c21]/50 border-transparent'
            }`}>
              <MapIcon size={22} />
            </div>
          </Link>
        </div>
      </div>

      <div ref={mapElement} className="flex-1 relative z-10">
        <div className="absolute top-0 left-0 z-20 flex flex-col w-[500px] shadow-2xl overflow-hidden rounded-br-2xl border-r border-b border-white/10">
          <div className="bg-[#20372a] p-6">
            <h1 className="text-white text-xl font-bold">Site Information</h1>
            <p className="text-[#a1b3ae] text-xs mt-2 leading-relaxed">
              Explore our interactive map for a comprehensive overview of many restoration and conservation sites, showcasing the planet`&apos;`s rich biodiversity and protected areas.
            </p>
          </div>

          <div className="bg-[#E3E7D7] py-4 flex flex-col items-center justify-center text-center">
            <div className="bg-[#d3d8c3] flex flex-col items-center justify-center text-center rounded-lg p-3">
              <div className="w-10 h-10 bg-[#062c21]/10 rounded-full flex items-center justify-center mb-3">
                <div className="relative w-8 h-8"> 
                  <Image 
                    src="/search.png" 
                    alt="Search Icon" 
                    fill
                    sizes="20px"
                    className="object-contain"
                  />
                </div>
              </div>
              <h3 className="text-[#062c21] font-bold text-sm">To start analysis, search your area here or select the area on the map</h3>
            </div>
          </div>
        </div>
      </div>

      {hoverData && !selectedSite && (
        <div 
          className="absolute z-50 pointer-events-none bg-white rounded-xl shadow-2xl border border-zinc-100 w-[280px] animate-in fade-in zoom-in duration-200 overflow-hidden"
          style={{ 
            left: pointerPos.x + 85, 
            top: pointerPos.y + 15 
          }}
        >
          <div className="relative w-full h-40">
            <Image 
              src="/forest_placeholder.jpg" 
              fill 
              className="object-cover" 
              alt="Preview Site" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
              <h4 className="font-bold text-[15px] leading-tight line-clamp-2">
                {hoverData.name}
              </h4>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-white/80">Sulawesi, Indonesia</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-[13px] font-bold">
                    {Number(hoverData.area).toLocaleString()}
                  </span>
                  <span className="text-[10px] font-semibold text-white/80">ha</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DYNAMIC LEGEND */}
      <div className="absolute bottom-6 right-6 z-10 flex flex-col items-end gap-0 transition-all duration-300">
        <button 
          onClick={() => setIsLegendExpanded(!isLegendExpanded)}
          className="bg-white p-1.5 rounded-t-lg shadow-sm border-x border-t border-zinc-200 text-zinc-800 hover:bg-zinc-50 transition-all flex items-center justify-center w-10 h-8"
        >
          {isLegendExpanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
        </button>

        {isLegendExpanded && (
          <div className="w-[380px] bg-white shadow-2xl overflow-hidden rounded-l-xl rounded-br-xl animate-in fade-in slide-in-from-bottom-2 duration-200 flex flex-col">
            
            <div className="bg-[#064e3b] px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-sm text-white tracking-wide">Legend</h3>
              
              <button className="bg-[#059669] hover:bg-[#047857] text-white text-[10px] font-medium px-4 py-1.5 rounded-full transition-colors">
                Export area as Image
              </button>
            </div>

            <div className="bg-white">
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}