"use client";
import { useEffect, useRef, useState } from "react";
import "ol/ol.css";
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

  useEffect(() => {
    const map = new Map({
      target: mapElement.current!,
      layers: [new TileLayer({ source: new OSM() })],
      view: new View({ center: [13139395, -209819], zoom: 5 }),
    });
    mapRef.current = map;
    return () => map.setTarget(undefined);
  }, []);

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
    </div>
  );
}