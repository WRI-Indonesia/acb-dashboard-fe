"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Feature from 'ol/Feature';
import type Geometry from 'ol/geom/Geometry';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import Image from 'next/image';
import { Style, Stroke, Fill } from 'ol/style';
import { ScaleLine } from 'ol/control';
import { Layers } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SiteDetailPanel from '@/components/SiteDetailPanel';
import type { SiteDetailData } from '../../types/site';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type BaseMapType = 'grey' | 'osm' | 'satellite';

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
  country: string;
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
  iso3: string;
}

export default function SiteInformation() {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const vectorSourceRef = useRef<VectorSource | null>(null);
  const scaleLineRef = useRef<HTMLDivElement>(null);
  const [geoData, setGeoData] = useState<GeoDataItem[] | null>(null);
  const pathname = usePathname();
  const [selectedSite, setSelectedSite] = useState<SiteDetailData | null>(null);
  const detailAbortRef = useRef<AbortController | null>(null);
  const [hoverData, setHoverData] = useState<HoverData | null>(null);
  const [pointerPos, setPointerPos] = useState({ x: 0, y: 0 });
  const [baseMapType, setBaseMapType] = useState<BaseMapType>('osm');
  const [showBaseMapMenu, setShowBaseMapMenu] = useState(false);
  const previousMapViewRef = useRef<{ center: [number, number]; zoom: number; rotation: number } | null>(null);
  const baseLayersRef = useRef<{
    grey: TileLayer<XYZ> | null;
    osm: TileLayer<OSM> | null;
    satellite: TileLayer<XYZ> | null;
    satelliteLabels: TileLayer<XYZ> | null;
  }>({ grey: null, osm: null, satellite: null, satelliteLabels: null });

  const focusToFeature = useCallback((feature: Feature<Geometry>) => {
    const map = mapRef.current;
    if (!map || !feature) return;

    const geometry = feature.getGeometry();
    if (!geometry) return;

    const view = map.getView();
    if (!previousMapViewRef.current) {
      const center = view.getCenter();
      const zoom = view.getZoom();
      if (center && zoom != null) {
        previousMapViewRef.current = {
          center: [center[0], center[1]],
          zoom,
          rotation: view.getRotation() ?? 0,
        };
      }
    }

    view.fit(geometry.getExtent(), {
      padding: [100, 100, 100, 560],
      duration: 600,
      maxZoom: 10,
    });
  }, []);

  const restorePreviousMapView = useCallback(() => {
    const map = mapRef.current;
    const previousView = previousMapViewRef.current;
    if (!map || !previousView) return;

    map.getView().animate({
      center: previousView.center,
      zoom: previousView.zoom,
      rotation: previousView.rotation,
      duration: 600,
    });

    previousMapViewRef.current = null;
  }, []);

  const clearSelectedSite = useCallback(() => {
    detailAbortRef.current?.abort();
    detailAbortRef.current = null;
    setSelectedSite(null);
    restorePreviousMapView();
  }, [restorePreviousMapView]);

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

    const greyLayer = new TileLayer({
      source: new XYZ({
        crossOrigin: 'anonymous',
        url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'
      }),
      visible: false
    });
    const osmLayer = new TileLayer({
      source: new OSM({ crossOrigin: 'anonymous' })
    });
    const satelliteLayer = new TileLayer({
      source: new XYZ({
        crossOrigin: 'anonymous',
        url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      }),
      visible: false
    });
    const satelliteLabelsLayer = new TileLayer({
      source: new XYZ({
        crossOrigin: 'anonymous',
        url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
      }),
      visible: false
    });

    baseLayersRef.current = {
      grey: greyLayer,
      osm: osmLayer,
      satellite: satelliteLayer,
      satelliteLabels: satelliteLabelsLayer
    };

    const map = new Map({
      target: mapElement.current,
      layers: [
        greyLayer,
        osmLayer,
        satelliteLayer,
        satelliteLabelsLayer,
        vectorLayer
      ],
      view: new View({
        center: [13139395, -209819],
        zoom: 5,
      }),
    });

    if (scaleLineRef.current) {
      const scaleLine = new ScaleLine({
        target: scaleLineRef.current,
        units: 'metric',
        bar: true,
        text: false,
        steps: 2,
        minWidth: 140
      });
      map.addControl(scaleLine);
    }

    map.on('click', (e) => {
      const feature = map.forEachFeatureAtPixel(e.pixel, (f) => f as Feature<Geometry>);
      if (!feature) {
        clearSelectedSite();
        return;
      }

      const properties = feature.getProperties() as { id?: string | number; name?: string; area?: number };
      const siteId = properties.id;
      if (siteId == null) return;

      focusToFeature(feature);

      detailAbortRef.current?.abort();
      const controller = new AbortController();
      detailAbortRef.current = controller;

      fetch(`${API_BASE_URL}/api/v1/geos/polygon/${siteId}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((json: { message?: string; data?: SiteDetailData }) => {
          if (!json?.data) return;
          setSelectedSite(json.data);
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return;
          console.error('Error fetch site detail:', err);
        });      
    });

    map.on('pointermove', (e) => {
      const feature = map.forEachFeatureAtPixel(e.pixel, (f) => f);
      
      if (feature) {
        const properties = feature.getProperties();
        
        setHoverData({
          name: properties.name,
          area: properties.area,
          id: properties.id,
          country: properties.country
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
  }, [clearSelectedSite, focusToFeature]);

  useEffect(() => {
    const grey = baseLayersRef.current.grey;
    const osm = baseLayersRef.current.osm;
    const satellite = baseLayersRef.current.satellite;
    const satelliteLabels = baseLayersRef.current.satelliteLabels;
    if (!grey || !osm || !satellite || !satelliteLabels) return;

    grey.setVisible(baseMapType === 'grey');
    osm.setVisible(baseMapType === 'osm');
    satellite.setVisible(baseMapType === 'satellite');
    satelliteLabels.setVisible(baseMapType === 'satellite');
  }, [baseMapType]);

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
              area: item.off_area,
              country: item.iso3
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
          onClose={clearSelectedSite}
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
              pathname === '/' ? 'bg-[#3A463D] border-white/10 text-[#4ade80]' : 'text-white/40 hover:text-[#4ade80] hover:bg-[#062c21]/50 border-transparent'
            }`}>
              <Layers size={22} />
            </div>
          </Link>

          <Link href="/site-information">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all ${
              pathname === '/site-information' ? 'bg-[#3A463D] border-white/10 text-[#4ade80]' : 'text-white/40 hover:text-[#4ade80] hover:bg-[#062c21]/50 border-transparent'
            }`}>
              <Image
                src="/site-information.svg"
                alt="Site information"
                width={22}
                height={22}
              />
            </div>
          </Link>
        </div>
      </div>

      <div ref={mapElement} className="flex-1 relative z-10">
        <div className="absolute left-4 bottom-4 z-20 flex flex-col items-start gap-2 text-[12px] text-zinc-700">
          <div
            ref={scaleLineRef}
            className={`map-scale-line relative ${baseMapType === 'satellite' ? 'map-scale-line--dark' : ''}`}
          />
          <div className="h-4" />
          <span className={`text-[11px] font-semibold text-[18px] ${baseMapType === 'satellite' ? 'text-white' : 'text-black'}`}>
            Powered by ESRI
          </span>
        </div>
        <div className="absolute right-4 top-24 z-20 flex flex-col items-end gap-2">
          <div className="flex flex-col bg-white rounded-md border border-zinc-200 overflow-hidden">
            <button
              type="button"
              className="w-9 h-9 flex items-center justify-center text-[#ef4444] hover:bg-zinc-50 transition-colors text-[18px]"
              aria-label="Zoom in"
              onClick={() => {
                const view = mapRef.current?.getView();
                if (!view) return;
                const current = view.getZoom() ?? 0;
                view.animate({ zoom: current + 1, duration: 250 });
              }}
            >
              +
            </button>
            <div className="h-px bg-zinc-200" />
            <button
              type="button"
              className="w-9 h-9 flex items-center justify-center text-[#ef4444] hover:bg-zinc-50 transition-colors text-[18px]"
              aria-label="Zoom out"
              onClick={() => {
                const view = mapRef.current?.getView();
                if (!view) return;
                const current = view.getZoom() ?? 0;
                view.animate({ zoom: current - 1, duration: 250 });
              }}
            >
              -
            </button>
          </div>

          <div className="relative">
            <button
              type="button"
              className="w-9 h-9 flex items-center justify-center bg-white rounded-md border border-zinc-200 text-[#ef4444] hover:bg-zinc-50 transition-colors text-[18px]"
              aria-label="Base map"
              onClick={() => setShowBaseMapMenu((prev) => !prev)}
            >
              <Layers size={16} />
            </button>

            {showBaseMapMenu && (
              <div className="absolute right-0 mt-2 w-40 bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden">
                {(
                  [
                    { id: 'grey', label: 'Grey' },
                    { id: 'osm', label: 'OSM' },
                    { id: 'satellite', label: 'Satellite' }
                  ] as Array<{ id: BaseMapType; label: string }>
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`w-full px-3 py-2 text-left text-[12px] transition-colors ${baseMapType === option.id ? 'bg-[#e7f2ec] text-[#062c21] font-semibold' : 'text-zinc-700 hover:bg-zinc-100'}`}
                    onClick={() => {
                      setBaseMapType(option.id);
                      setShowBaseMapMenu(false);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="absolute top-0 left-0 z-20 flex flex-col w-[600px] shadow-2xl overflow-hidden rounded-br-2xl border-r border-b border-white/10">
          <div className="pt-12 pb-6 px-5 bg-[#3A463D] text-white flex flex-col gap-2">
            <p className="text-[#FBFBF9] text-[1.75rem] font-semibold leading-[100%] tracking-[0]">Site Information</p>
            <p className="font-['inter'] text-[#FBFBF9] text-xs font-regular">
              Explore our interactive map for a comprehensive overview of many restoration and conservation sites, showcasing the planet&apos;s rich biodiversity and protected areas.
            </p>
          </div>

          <div className="bg-[#E3E7D7] p-5 flex flex-col items-center justify-center text-center">
            <div className="bg-[#d3d8c3] w-full flex flex-col items-center justify-center text-center rounded-lg p-3">
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
              <h3 className="text-[#111A13] font-semibold text-xl">To start analysis, select the area on the map</h3>
            </div>
          </div>
        </div>
      </div>

      {hoverData && (
        <div 
          className="absolute z-50 pointer-events-none bg-white rounded-xl shadow-2xl w-[280px] animate-in fade-in zoom-in duration-200 overflow-hidden"
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
                  <span className="text-[11px] font-semibold text-white/80">{hoverData.country}</span>
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
  </div>
  );
}