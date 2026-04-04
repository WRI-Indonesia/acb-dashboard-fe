"use client";
import { useEffect, useRef, useState } from "react";
import "ol/ol.css";
import { Map, View } from "ol";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import OSM from "ol/source/OSM";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function MapEditor() {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const [showMangrove, setShowMangrove] = useState(false);

  const dummyMangrove = {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [[[110, -1], [118, -1], [118, -5], [110, -5], [110, -1]]] },
      properties: { name: "Mangrove Area" }
    }]
  };

  useEffect(() => {
    const map = new Map({
      target: mapElement.current!,
      layers: [new TileLayer({ source: new OSM() })],
      view: new View({ 
        center: [13139395, -209819], // Koordinat Indonesia
        zoom: 5 
      }),
    });
    mapRef.current = map;
    return () => map.setTarget(undefined);
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    
    if (showMangrove) {
      const layer = new VectorLayer({
        source: new VectorSource({ 
          features: new GeoJSON().readFeatures(dummyMangrove, {
            featureProjection: 'EPSG:3857' // Penting agar koordinat pas dengan peta
          }) 
        }),
        properties: { id: "mangrove-layer" }
      });
      mapRef.current.addLayer(layer);
    } else {
      mapRef.current.getLayers().forEach(l => {
        if (l.get("id") === "mangrove-layer") mapRef.current?.removeLayer(l);
      });
    }
  }, [showMangrove]);

  return (
    <div className="relative w-full h-screen">
      <div ref={mapElement} className="w-full h-full" />
      <div className="absolute top-4 left-4 z-10 w-64 bg-background/90 p-4 rounded-lg border shadow-sm backdrop-blur">
        <h2 className="font-semibold mb-4 text-sm tracking-tight">Data Spatial Layer</h2>
        <div className="flex items-center justify-between">
          <Label htmlFor="mangrove" className="text-xs">Mangrove Layer</Label>
          <Switch id="mangrove" checked={showMangrove} onCheckedChange={setShowMangrove} />
        </div>
      </div>
    </div>
  );
}