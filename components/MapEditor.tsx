"use client";
import { useEffect, useRef, useState } from "react";
import "ol/ol.css";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import { Stroke, Style } from "ol/style";
import { Map, View } from "ol";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export default function MapEditor() {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);

  const [layers, setLayers] = useState({
    administrative_boundaries: false,
    current_land_cover: false,
    elevation: false,
    future_deforestation_risk: false,
    historical_deforestation_risk: false,
    mangrove: false,
    protected_area: false,
    slope: false
  });
  
  const activeLayers = Object.entries(layers)
    .filter(([_, isActive]) => isActive)
    .map(([key]) => key);

  useEffect(() => {
    const map = new Map({
      target: mapElement.current!,
      layers: [new TileLayer({ source: new OSM() })],
      view: new View({ center: [13139395, -209819], zoom: 5 }),
    });
    mapRef.current = map;
    return () => map.setTarget(undefined);
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    const layerId = "admin-layer";

    if (layers.administrative_boundaries) {
      const adminLayer = new VectorLayer({
        source: new VectorSource({
          url: "http://localhost:8000/api/layers/administrative",
          format: new GeoJSON(),
        }),
        style: new Style({
          stroke: new Stroke({
            color: "#3b82f6",
            width: 2,
          }),
        }),
      });
      
      adminLayer.set("id", layerId);
      mapRef.current.addLayer(adminLayer);
    } else {
      const allLayers = mapRef.current.getLayers().getArray();
      const layerToRemove = allLayers.find(layer => layer.get("id") === layerId);
      if (layerToRemove) {
        mapRef.current.removeLayer(layerToRemove);
      }
    }
  }, [layers.administrative_boundaries]);

  return (
    <div className="relative w-full h-screen">
      <div ref={mapElement} className="w-full h-full" />
      
      <Card className="absolute top-4 left-4 z-10 w-72 bg-zinc-900 text-white p-5 shadow-2xl border-zinc-700">
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="administrative_boundaries" className="text-sm font-medium cursor-pointer">Administrative Boundaries</Label>
              <Switch 
                id="administrative_boundaries"
                checked={layers.administrative_boundaries}
                onCheckedChange={(val) => setLayers({...layers, administrative_boundaries: val})}
                className="data-[state=checked]:bg-blue-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="current_land_cover" className="text-sm font-medium cursor-pointer">Current Land Cover</Label>
              <Switch 
                id="current_land_cover"
                checked={layers.current_land_cover}
                onCheckedChange={(val) => setLayers({...layers, current_land_cover: val})}
                className="data-[state=checked]:bg-blue-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="elevation" className="text-sm font-medium cursor-pointer">Elevation</Label>
              <Switch 
                id="elevation"
                checked={layers.elevation}
                onCheckedChange={(val) => setLayers({...layers, elevation: val})}
                className="data-[state=checked]:bg-blue-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="future_deforestation_risk" className="text-sm font-medium cursor-pointer">Future Deforestation Risk</Label>
              <Switch 
                id="future_deforestation_risk"
                checked={layers.future_deforestation_risk}
                onCheckedChange={(val) => setLayers({...layers, future_deforestation_risk: val})}
                className="data-[state=checked]:bg-blue-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="historical_deforestation_risk" className="text-sm font-medium cursor-pointer">Historical Deforestation Risk</Label>
              <Switch 
                id="historical_deforestation_risk"
                checked={layers.historical_deforestation_risk}
                onCheckedChange={(val) => setLayers({...layers, historical_deforestation_risk: val})}
                className="data-[state=checked]:bg-blue-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="mangrove" className="text-sm font-medium cursor-pointer">Mangrove</Label>
              <Switch 
                id="mangrove"
                checked={layers.mangrove}
                onCheckedChange={(val) => setLayers({...layers, mangrove: val})}
                className="data-[state=checked]:bg-blue-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="protected_area" className="text-sm font-medium cursor-pointer">Protected Area / Kawasan Hutan</Label>
              <Switch 
                id="protected_area"
                checked={layers.protected_area}
                onCheckedChange={(val) => setLayers({...layers, protected_area: val})}
                className="data-[state=checked]:bg-blue-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="slope" className="text-sm font-medium cursor-pointer">Slope</Label>
              <Switch 
                id="slope"
                checked={layers.slope}
                onCheckedChange={(val) => setLayers({...layers, slope: val})}
                className="data-[state=checked]:bg-blue-500"
              />
            </div>
          </div>
        </div>
      </Card>
      {activeLayers.length > 0 && (
        <Card className="absolute bottom-4 right-4 z-10 w-64 bg-zinc-900/90 text-white p-4 shadow-2xl border-zinc-700 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3 border-b border-zinc-700 pb-2">
            <h3 className="font-bold text-sm tracking-tight">Legend</h3>
            <button className="text-[10px] bg-emerald-800 px-2 py-1 rounded hover:bg-emerald-700 transition-colors">
              Export area as Image
            </button>
          </div>

          <div className="space-y-4 max-h-60 overflow-y-auto custom-scrollbar">
            {layers.administrative_boundaries && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                  <span className="w-3 h-3 border border-blue-500 rounded-full"></span>
                  Administrative Boundaries
                </div>
                <div className="pl-5 flex items-center gap-2 text-[11px] text-zinc-400">
                  <span className="w-2 h-2 bg-blue-500/30 border border-blue-500 rounded-full"></span>
                  Administrative Boundaries - District
                </div>
              </div>
            )}

            {layers.current_land_cover && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                  <span className="grid grid-cols-2 gap-0.5">
                    <span className="w-1.5 h-1.5 bg-green-600"></span>
                    <span className="w-1.5 h-1.5 bg-orange-400"></span>
                  </span>
                  Current land cover
                </div>
                <div className="pl-5 space-y-1.5">
                  {[
                    { color: "bg-green-700", label: "Forest" },
                    { color: "bg-yellow-400", label: "Grassland" },
                    { color: "bg-orange-400", label: "Cropland" },
                    { color: "bg-blue-400", label: "Wetlands" },
                    { color: "bg-zinc-600", label: "Built-up" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3 text-[11px] text-zinc-400">
                      <span className={`w-2 h-2 rounded-full ${item.color}`}></span>
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}