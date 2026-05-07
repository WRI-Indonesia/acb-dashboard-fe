"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import TileWMS from 'ol/source/TileWMS';
import Image from 'next/image';
import WMTS from 'ol/source/WMTS';
import WMTSTileGrid from 'ol/tilegrid/WMTS';
import { defaults as defaultControls, ScaleLine } from 'ol/control';
import { get as getProjection } from 'ol/proj';
import { getTopLeft, getWidth } from 'ol/extent';
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ChevronUp, ChevronDown, Layers, GripVertical, Eye, X, Droplet } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
  info?: boolean;
  info_label?: string;
  info_field?: string;
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
  quantity?: string;
};

type LegendSymbolizer = {
  Raster?: { colormap?: { entries?: LegendEntry[], type?: string } };
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

type BaseMapType = 'grey' | 'osm' | 'satellite';

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
    crossOrigin: 'anonymous',
    url: `${API_BASE_URL}/api/v1/proxy/wmts`,
    layer: config.layers,
    matrixSet: config.matrix_set || "WebMercatorQuad",
    format: "image/png",
    projection: projection!,
    requestEncoding: 'KVP',
    tileGrid: tileGrid,
    style: '',
    tileLoadFunction: (imageTile: unknown) => {
      const tile = imageTile as WMTSTileImage;
      const tileCoord = tile.getTileCoord();
      const z = tileCoord[0];
      const x = tileCoord[1];
      const y = tileCoord[2];

      const proxyUrl = `${API_BASE_URL}/api/v1/proxy/wmts?layer=${config.layers}&tilematrix=${z}&tilecol=${x}&tilerow=${y}`;
      tile.getImage().crossOrigin = 'anonymous';
      tile.getImage().src = proxyUrl;
    }
  });
};

function parseGetFeatureInfoJson(
  json: unknown,
  labels: string[],
  fields: string[]
): { label: string; value: string }[] {
  if (!json || typeof json !== 'object') return [];
  const root = json as Record<string, unknown>;

  let features: unknown[] | null = null;

  if (Array.isArray(root.features)) {
    features = root.features;
  } else if (Array.isArray(root.Features)) {
    features = root.Features;
  } else if (Array.isArray(root.results)) {
    features = root.results;
  }

  if (!features || features.length === 0) return [];

  const feature = features[0] as Record<string, unknown>;
  const props = (feature.properties || feature.attributes || feature) as Record<string, unknown>;

  const rows: { label: string; value: string }[] = [];

  if (labels.length > 0 && fields.length > 0) {
    const minLen = Math.min(labels.length, fields.length);
    for (let i = 0; i < minLen; i++) {
      const value = props[fields[i]];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        rows.push({ label: labels[i], value: String(value) });
      }
    }
  } else {
    for (const [key, val] of Object.entries(props)) {
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        rows.push({ label: key, value: String(val) });
      }
    }
  }

  return rows;
}

function parseGetFeatureInfoText(
  text: string,
  labels: string[],
  fields: string[]
): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];

  if (labels.length > 0 && fields.length > 0) {
    const minLen = Math.min(labels.length, fields.length);
    for (let i = 0; i < minLen; i++) {
      const fieldName = fields[i];
      const patterns = [
        new RegExp(`${fieldName}\\s*[:=]\\s*["']?([^"'\\n]+)["']?`, 'i'),
        new RegExp(`${fieldName}\\s+([^\\n]+)`, 'i'),
      ];
      let found = false;
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          rows.push({ label: labels[i], value: match[1].trim() });
          found = true;
          break;
        }
      }
      if (!found) {
        rows.push({ label: labels[i], value: '-' });
      }
    }
  }

  return rows;
}

export default function MapEditor() {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const infoPanelRef = useRef<HTMLDivElement>(null);
  const scaleLineRef = useRef<HTMLDivElement>(null);
  
  const [layerConfigs, setLayerConfigs] = useState<LayerConfig[]>([]);
  const [activeStatus, setActiveStatus] = useState<Record<string, boolean>>({});
  const activeTilesRef = useRef<Record<number, TileLayer<WMTS>>>({});
  const [legendData, setLegendData] = useState<Record<string, LegendResponse>>({});
  const [isLegendExpanded, setIsLegendExpanded] = useState(true);
  const [legendOrder, setLegendOrder] = useState<number[]>([]);
  const draggedLegendIdRef = useRef<number | null>(null);
  const [draggingLegendId, setDraggingLegendId] = useState<number | null>(null);
  const [selectedInfoLayer, setSelectedInfoLayer] = useState<LayerConfig | null>(null);
  const [infoPanelTop, setInfoPanelTop] = useState<number>(0);
  const [infoPanelAnchor, setInfoPanelAnchor] = useState<DOMRect | null>(null);
  const [baseMapType, setBaseMapType] = useState<BaseMapType>('osm');
  const [showBaseMapMenu, setShowBaseMapMenu] = useState(false);
  
  const [layerVisibility, setLayerVisibility] = useState<Record<number, boolean>>({});
  const [layerOpacity, setLayerOpacity] = useState<Record<number, number>>({});
  const [showOpacitySlider, setShowOpacitySlider] = useState<Record<number, boolean>>({});
  const [layerSearchText, setLayerSearchText] = useState('');
  const [infoPanelLeft, setInfoPanelLeft] = useState<number>(0);

  const [featureInfoData, setFeatureInfoData] = useState<{
    layerName: string;
    rows: { label: string; value: string }[];
  } | null>(null);
  const [featureInfoPos, setFeatureInfoPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const featureInfoRef = useRef<HTMLDivElement>(null);
  const wmsInfoSourcesRef = useRef<Record<number, TileWMS>>({});

  const baseLayersRef = useRef<{
    grey: TileLayer<XYZ> | null;
    osm: TileLayer<OSM> | null;
    satellite: TileLayer<XYZ> | null;
    satelliteLabels: TileLayer<XYZ> | null;
  }>({ grey: null, osm: null, satellite: null, satelliteLabels: null });

  const getWmsInfoSource = (layer: LayerConfig) => {
    const cached = wmsInfoSourcesRef.current[layer.id];
    if (cached) return cached;

    // WMTS → WMS URL: GeoServer GWC WMTS → standard WMS
    const wmsUrl = layer.url.replace(/\/gwc\/service\/wmts$/, '/wms');

    const source = new TileWMS({
      url: wmsUrl,
      params: {
        LAYERS: layer.layers,
        VERSION: layer.version || '1.3.0',
      },
      crossOrigin: 'anonymous',
    });
    wmsInfoSourcesRef.current[layer.id] = source;
    return source;
  };

  const openInfoPanel = (rect: DOMRect, layer: LayerConfig) => {
    setInfoPanelAnchor(rect);
    setSelectedInfoLayer(layer);
  };

  useLayoutEffect(() => {
    if (!selectedInfoLayer || !infoPanelAnchor) return;

    const padding = 12;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const panelWidth = infoPanelRef.current?.offsetWidth ?? 300;
    const panelHeight = infoPanelRef.current?.offsetHeight ?? Math.min(420, Math.floor(viewportH * 0.5));

    let left = infoPanelAnchor.right + 12;
    if (left + panelWidth > viewportW - padding) {
      left = infoPanelAnchor.left - panelWidth - 12;
    }
    if (left < padding) left = padding;

    let top = infoPanelAnchor.top + infoPanelAnchor.height / 2 - panelHeight / 2;
    if (top + panelHeight > viewportH - padding) {
      top = viewportH - panelHeight - padding;
    }
    if (top < padding) top = padding;

    setInfoPanelTop(top);
    setInfoPanelLeft(left);
  }, [selectedInfoLayer, infoPanelAnchor]);

  useEffect(() => {
    if (!selectedInfoLayer) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (infoPanelRef.current?.contains(target)) return;
      if (target.closest('[data-info-trigger="true"]')) return;

      setSelectedInfoLayer(null);
    };

    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [selectedInfoLayer]);

  const isFutureDefLayer = (config: LayerConfig) => {
    if (!config) return false;
    const layerId = String(config.layers || '').toLowerCase();
    const name = String(config.name || '').toLowerCase();
    return (
      layerId === 'future_defrisk' ||
      layerId.includes('future_def') ||
      (name.includes('future') && name.includes('deforest'))
    );
  };

  useEffect(() => {
    if (!mapElement.current) return;

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
      controls: defaultControls({ zoom: false }),
      layers: [
        greyLayer,
        osmLayer,
        satelliteLayer,
        satelliteLabelsLayer
      ],
      view: new View({
        center: [12822263.927616559, 700859.3957921019],
        zoom: 5.001605390785985,
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

    mapRef.current = map;
    return () => map.setTarget(undefined);
  }, []);

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
    fetch(`${API_BASE_URL}/api/v1/layers`)
      .then(res => res.json())
      .then(data => setLayerConfigs(data))
      .catch(err => console.error("Gagal load layers:", err));
  }, []);

  useEffect(() => {
    Object.keys(activeStatus).forEach((id) => {
      const config = layerConfigs.find((c) => c.id === parseInt(id));
      if (activeStatus[id] && config && !legendData[config.layers]) {
        fetch(`${API_BASE_URL}/api/v1/proxy/legend?layer=${config.layers}`)
          .then((res) => res.json())
          .then((data) => {
            setLegendData((prev) => ({ ...prev, [config.layers]: data }));
          })
          .catch((err) => console.error("Error fetching legend:", err));
      }
    });
  }, [activeStatus, layerConfigs, legendData]);

  useEffect(() => {
    if (!featureInfoData) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (featureInfoRef.current?.contains(target)) return;
      setFeatureInfoData(null);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [featureInfoData]);

  useEffect(() => {
    if (!mapRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleMapClick = async (evt: any) => {
      setFeatureInfoData(null);

      const activeInfoLayers = layerConfigs.filter(
        (c) => activeStatus[String(c.id)] && c.info === true
      );
      if (activeInfoLayers.length === 0) return;

      const view = mapRef.current!.getView();
      const layer = activeInfoLayers[0];
      const wmsUrl = layer.url;
      if (!wmsUrl) return;

      const resolution = view.getResolution();
      if (!resolution) return;
      const projection = view.getProjection();
      const infoSource = getWmsInfoSource(layer);
      const infoParams = {
        INFO_FORMAT: 'application/json',
        FEATURE_COUNT: 1,
        QUERY_LAYERS: layer.layers,
      };

      const labels = (layer.info_label || '').split(';').map(s => s.trim()).filter(Boolean);
      const fields = (layer.info_field || '').split(';').map(s => s.trim()).filter(Boolean);

      const infoUrl = infoSource.getFeatureInfoUrl(
        evt.coordinate,
        resolution,
        projection,
        infoParams
      );
      if (!infoUrl) return;

      const proxyUrl = `${API_BASE_URL}/api/v1/proxy?url=${encodeURIComponent(infoUrl)}`;

      try {
        const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });

        if (!res.ok) {
          const fallbackUrl = infoSource.getFeatureInfoUrl(
            evt.coordinate,
            resolution,
            projection,
            { ...infoParams, INFO_FORMAT: 'text/plain' }
          );
          if (!fallbackUrl) return;
          const fallbackProxyUrl = `${API_BASE_URL}/api/v1/proxy?url=${encodeURIComponent(fallbackUrl)}`;
          const fallbackRes = await fetch(fallbackProxyUrl, { signal: AbortSignal.timeout(10000) });
          if (!fallbackRes.ok) return;
          const text = await fallbackRes.text();
          const rows = parseGetFeatureInfoText(text, labels, fields);
          if (rows.length === 0) return;

          const pos = mapRef.current!.getEventPixel(evt.originalEvent);
          setFeatureInfoPos({ top: pos[1] + 10, left: pos[0] + 10 });
          setFeatureInfoData({ layerName: layer.name, rows });
          return;
        }

        const json = await res.json();
        const rows = parseGetFeatureInfoJson(json, labels, fields);
        if (rows.length === 0) return;

        const pos = mapRef.current!.getEventPixel(evt.originalEvent);
        setFeatureInfoPos({ top: pos[1] + 10, left: pos[0] + 10 });
        setFeatureInfoData({ layerName: layer.name, rows });
      } catch (err) {
        console.error(`GetFeatureInfo error for ${layer.name}:`, err);
      }
    };

    mapRef.current.on('click', handleMapClick);
    return () => { mapRef.current?.un('click', handleMapClick); };
  }, [activeStatus, layerConfigs]);

  useEffect(() => {
    if (!mapRef.current || layerConfigs.length === 0) return;

    layerConfigs.forEach((config) => {
      const isActive = activeStatus[String(config.id)];
      const isLoaded = activeTilesRef.current[config.id];

      if (isActive && !isLoaded) {
        const orderIndex = legendOrder.indexOf(config.id);
        const zBase = 10;
        const z = orderIndex === -1 ? zBase : zBase + (legendOrder.length - orderIndex);
        const opacity = layerOpacity[config.id] ?? 0.8;
        const newLayer = new TileLayer({
          source: createWMTSSource(config),
          opacity
        });
        newLayer.setZIndex(z);
        mapRef.current?.addLayer(newLayer);
        activeTilesRef.current[config.id] = newLayer;
      } else if (!isActive && isLoaded) {
        mapRef.current?.removeLayer(isLoaded);
        delete activeTilesRef.current[config.id];
      }
    });
  }, [activeStatus, layerConfigs, legendOrder, layerOpacity]);

  useEffect(() => {
    Object.entries(layerOpacity).forEach(([idStr, opacity]) => {
      const id = Number(idStr);
      const layer = activeTilesRef.current[id];
      if (layer && typeof opacity === 'number') {
        layer.setOpacity(opacity);
      }
    });
  }, [layerOpacity]);

  useEffect(() => {
    const activeIds = layerConfigs.filter(c => activeStatus[String(c.id)]).map(c => c.id);
    const activeSet = new Set(activeIds);
    setLayerVisibility((prev) => {
      const next: Record<number, boolean> = {};
      for (const id of activeIds) next[id] = prev[id] ?? true;
      const prevKeys = Object.keys(prev).map(Number).filter(k => activeSet.has(k));
      const sameLen = prevKeys.length === Object.keys(next).length;
      const same = sameLen && prevKeys.every((k) => prev[k] === next[k]);
      return same ? prev : next;
    });
  }, [activeStatus, layerConfigs]);

  useEffect(() => {
    Object.entries(layerVisibility).forEach(([idStr, visible]) => {
      const id = Number(idStr);
      const layer = activeTilesRef.current[id];
      if (layer) layer.setVisible(visible);
    });
  }, [layerVisibility]);

  useEffect(() => {
    if (!mapRef.current) return;
    const zBase = 10;
    const activeIds = new Set(Object.keys(activeStatus).filter(k => activeStatus[k]).map(Number));
    const orderedActiveIds = legendOrder.filter((id) => activeIds.has(id));

    orderedActiveIds.forEach((id, index) => {
      const layer = activeTilesRef.current[id];
      if (!layer) return;
      const z = zBase + (orderedActiveIds.length - index);
      layer.setZIndex(z);
    });
  }, [legendOrder, activeStatus]);

  const activeLayerConfigs = layerConfigs.filter(c => activeStatus[String(c.id)]);
  const normalizedLayerSearch = layerSearchText.trim().toLowerCase();
  const filteredLayerConfigs = layerConfigs.filter((layer) => {
    if (!normalizedLayerSearch) return true;
    const target = `${layer.name} ${layer.short_description} ${layer.layers}`.toLowerCase();
    return target.includes(normalizedLayerSearch);
  });
  const orderedActiveLayerConfigs = (() => {
    if (legendOrder.length === 0) return activeLayerConfigs;
    const byId = new globalThis.Map<number, LayerConfig>(activeLayerConfigs.map(c => [c.id, c] as const));
    return legendOrder.map(id => byId.get(id)).filter(Boolean) as LayerConfig[];
  })();

  useEffect(() => {
    const activeIds = activeLayerConfigs.map(c => c.id);
    const activeIdSet = new Set(activeIds);

    setLegendOrder((prev) => {
      const kept = prev.filter((id) => activeIdSet.has(id));
      const keptSet = new Set(kept);
      const missing = activeIds.filter((id) => !keptSet.has(id));
      const next = [...kept, ...missing];

      if (next.length === prev.length && next.every((v, i) => v === prev[i])) {
        return prev;
      }
      return next;
    });
  }, [activeStatus, layerConfigs, activeLayerConfigs]);

  const handleLegendDragStart = (id: number) => (e: React.DragEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target?.closest?.('[data-no-drag="true"]')) {
      e.preventDefault();
      return;
    }
    draggedLegendIdRef.current = id;
    setDraggingLegendId(id);
    document.body.style.cursor = 'grabbing';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(id));
  };

  const handleLegendDragEnd = () => {
    draggedLegendIdRef.current = null;
    setDraggingLegendId(null);
    document.body.style.cursor = '';
  };

  const handleLegendDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleLegendDrop = (targetId: number) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const fromRaw = draggedLegendIdRef.current ?? Number(e.dataTransfer.getData('text/plain'));
    const fromId = Number.isFinite(fromRaw) ? Number(fromRaw) : null;
    if (!fromId || fromId === targetId) return;
    setLegendOrder((prev) => {
      const next = prev.slice();
      const fromIdx = next.indexOf(fromId);
      const toIdx = next.indexOf(targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, fromId);
      return next;
    });
    draggedLegendIdRef.current = null;
  };

  const toggleLegendVisibility = (id: number) => {
    setLayerVisibility((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));
  };

  const deactivateLayer = (id: number) => {
    setActiveStatus((prev) => ({ ...prev, [String(id)]: false }));
  };
  const pathname = usePathname();

  const handleExportMapAsImage = async () => {
    const mapArea = mapElement.current;
    if (!mapArea || !mapRef.current) return;

    // Get Canvas from OpenLayers
    const mapCanvas = mapRef.current.getViewport().querySelector('canvas');
    if (!mapCanvas) {
      alert('Map canvas not found.');
      return;
    }

    const width = mapArea.offsetWidth;
    const height = mapArea.offsetHeight;

    let scaleCanvas: HTMLCanvasElement | null = null;
    let scaleW = 0;
    let scaleH = 0;
    let scaleCanvasW = 0;
    let scaleCanvasH = 0;
    if (scaleLineRef.current) {
      const scaleEl = scaleLineRef.current;
      scaleW = Math.max(scaleEl.offsetWidth, scaleEl.scrollWidth);
      scaleH = Math.max(scaleEl.offsetHeight, scaleEl.scrollHeight);
      if (scaleW > 0 && scaleH > 0) {
        scaleCanvas = await html2canvas(scaleEl, {
          backgroundColor: null,
          useCORS: true,
          logging: false,
          scale: 2,
          width: scaleW,
          height: scaleH,
        });
        scaleCanvasW = scaleCanvas.width;
        scaleCanvasH = scaleCanvas.height;
      }
    }

    const legendExportDiv = document.createElement('div');
    legendExportDiv.style.position = 'absolute';
    legendExportDiv.style.left = '-99999px';
    legendExportDiv.style.top = '0';
    legendExportDiv.style.background = '#fff';
    legendExportDiv.style.borderRadius = '0';
    legendExportDiv.style.boxShadow = 'none';
    legendExportDiv.style.padding = '24px';
    legendExportDiv.style.display = 'inline-block';
    legendExportDiv.style.fontFamily = 'inherit';
    legendExportDiv.style.color = '#222';
    legendExportDiv.style.maxWidth = '520px';
    legendExportDiv.style.minWidth = 'unset';
    legendExportDiv.style.width = 'fit-content';
    legendExportDiv.style.fontSize = '14px';

    const legendList = orderedActiveLayerConfigs.length === 0 ? layerConfigs : orderedActiveLayerConfigs;
    const estimateLegendRows = (config: LayerConfig) => {
      const legend = legendData[config.layers];
      const rules = legend?.Legend?.[0]?.rules || [];
      let rows = 1;

      for (const rule of rules) {
        const symbolizer = rule.symbolizers[0];
        const entries = symbolizer?.Raster?.colormap?.entries;
        if (entries && entries.length > 0) {
          rows += entries.length;
        } else {
          rows += 1;
        }
      }

      return rows;
    };

    const totalRows = legendList.reduce((sum, config) => sum + estimateLegendRows(config), 0);
    const columnCount = totalRows > 36 ? 3 : totalRows > 18 ? 2 : 1;
    const legendMaxWidth = columnCount === 1 ? 520 : columnCount === 2 ? 760 : 980;
    legendExportDiv.style.maxWidth = `${legendMaxWidth}px`;
    legendExportDiv.style.width = 'fit-content';

    const columns: LayerConfig[][] = Array.from({ length: columnCount }, () => []);
    const columnHeights = new Array(columnCount).fill(0);

    legendList.forEach((config) => {
      const rows = estimateLegendRows(config);
      let targetCol = 0;
      for (let i = 1; i < columnCount; i += 1) {
        if (columnHeights[i] < columnHeights[targetCol]) targetCol = i;
      }
      columns[targetCol].push(config);
      columnHeights[targetCol] += rows;
    });

    legendExportDiv.innerHTML = `
      <div style="display:flex;gap:32px;align-items:flex-start;width:fit-content;">
        ${columns.map((column) => `
          <div style="display:flex;flex-direction:column;gap:24px;min-width:200px;">
            ${column.map((config) => {
          const legend = legendData[config.layers];
          const rules = legend?.Legend?.[0]?.rules || [];
          return `
            <div>
              <div style=\"font-weight:bold;font-size:15px;margin-bottom:10px;\">${config.name}</div>
              <div style=\"display:flex;flex-direction:column;gap:7px;\">
                ${rules.map((rule: LegendRule) => {
                        const symbolizer = rule.symbolizers[0];
                        const colormapEntries = symbolizer?.Raster?.colormap?.entries;
                        const colormapType = symbolizer?.Raster?.colormap?.type;
                        const labeledCount = colormapEntries ? colormapEntries.filter((e: LegendEntry) => e.label && String(e.label).trim() !== '').length : 0;
                        const isRamp = colormapEntries && colormapEntries.length > 2 && colormapEntries.every((e: LegendEntry) => e.color) && (colormapType === 'ramp' || labeledCount >= 2) && isFutureDefLayer(config);

                        if (isRamp) {
                          const boxH = 120;
                          const quantities = colormapEntries.map((e: LegendEntry) => Number(e.quantity));
                          const hasQuant = quantities.every((q: number) => !isNaN(q));
                          let stopsStr: string;
                          if (hasQuant) {
                            const min = quantities[0];
                            const max = quantities[quantities.length - 1];
                            stopsStr = colormapEntries.map((e: LegendEntry, i: number) => {
                              const q = Number(e.quantity);
                              const pct = max > min ? ((q - min) / (max - min)) * 100 : (i / (colormapEntries.length - 1)) * 100;
                              return `${e.color} ${pct}%`;
                            }).join(', ');
                          } else {
                            stopsStr = colormapEntries.map((e: LegendEntry) => e.color).join(', ');
                          }
                          const gradient = `linear-gradient(to bottom, ${stopsStr})`;
                          const topLabel = colormapEntries[0].label || colormapEntries[0].quantity || '';
                          const bottomLabel = colormapEntries[colormapEntries.length - 1].label || colormapEntries[colormapEntries.length - 1].quantity || '';
                          const middleLabelEntry = colormapEntries.slice(1, -1).find((e: LegendEntry) => e.label && String(e.label).trim() !== '');
                          const middleLabel = middleLabelEntry ? middleLabelEntry.label : '';

                          return `
                            <div style="display:flex;align-items:flex-start;gap:12px;justify-content:flex-start;">
                              <div style="width:16px;height:${boxH}px;border:1px solid #ccc;border-radius:6px;overflow:hidden;background:${gradient};"></div>
                              <div style="display:flex;flex-direction:column;justify-content:space-between;height:${boxH}px;min-width:60px;font-size:12px;color:#333;">
                                <span>${topLabel}</span>
                                ${middleLabel ? `<span style=\"text-align:center;\">${middleLabel}</span>` : '<span />'}
                                <span>${bottomLabel}</span>
                              </div>
                            </div>
                          `;
                        } else if (colormapEntries) {
                          return `
                            <div style="margin-top: 4px; background: transparent;">
                              ${colormapEntries.map((entry: LegendEntry) => `
                                    <div style="margin-bottom: 6px; white-space: nowrap; height: 16px; display: block; background: transparent;">
                                      <span style="display: inline-block; width: 14px; height: 14px; border-radius: 50%; background: ${entry.color}; border: 1px solid rgba(0,0,0,0.1); vertical-align: middle;"></span>
                                      <span style="display: inline-block; vertical-align: middle; padding-left: 10px; font-size: 12px; color: #333; line-height: 14px; font-family: sans-serif;">${entry.label || ''}</span>
                                    </div>
                                  `).join('')}
                            </div>
                          `;
                        }
                        const vectorColor = symbolizer?.Polygon?.fill || symbolizer?.Line?.stroke || "#ccc";
                        return `
                          <div style="margin-bottom: 6px; white-space: nowrap; height: 16px; display: block; background: transparent;">
                            <span style="display: inline-block; width: 14px; height: 14px; border-radius: 50%; background: ${vectorColor}; border: 1px solid rgba(0,0,0,0.1); vertical-align: middle;"></span>
                            <span style="display: inline-block; vertical-align: middle; padding-left: 10px; font-size: 12px; color: #333; line-height: 14px; font-family: sans-serif;">${rule.title || rule.name || ''}</span>
                          </div>
                        `;
                }).join('')}
              </div>
            </div>
          `;
            }).join('')}
          </div>
        `).join('')}
      </div>
    `;

    document.body.appendChild(legendExportDiv);

    // Render legend
    const legendCanvas = await html2canvas(legendExportDiv, {
      backgroundColor: null,
      useCORS: true,
      logging: false,
      scale: 1,
      width: legendExportDiv.offsetWidth,
      height: legendExportDiv.offsetHeight,
    });
    const legendW = legendExportDiv.offsetWidth;
    const legendH = legendExportDiv.offsetHeight;

    document.body.removeChild(legendExportDiv);

    // Merge map and legend
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = width;
    exportCanvas.height = height;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(
      mapCanvas,
      0, 0, mapCanvas.width, mapCanvas.height,
      0, 0, width, height
    );

    if (scaleCanvas) {
      const scaleX = 24;
      const scaleY = Math.max(height - scaleH - 24, 24);
      const drawW = scaleW || scaleCanvasW;
      const drawH = scaleH || scaleCanvasH;
      ctx.drawImage(scaleCanvas, scaleX, scaleY, drawW, drawH);
    }

    const legendX = Math.max(width - legendW - 24, 24);
    const legendY = Math.max(height - legendH - 24, 24);
    ctx.drawImage(legendCanvas, legendX, legendY, legendW, legendH);

    // Download
    exportCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'map-export.png';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  };

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
          <Link href="/">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all ${
              pathname === '/' ? 'bg-[#3A463D] text-white' : 'text-white/40 hover:text-[#4ade80] hover:bg-[#062c21]/50 border-transparent'
            }`}>
              <Layers size={22} />
            </div>
          </Link>

          <Link href="/site-information">
            <div className={`group w-12 h-12 rounded-xl flex items-center justify-center shadow-inner cursor-pointer transition-all border ${
              pathname === '/site-information' ? 'bg-[#3A463D] border-white/10 text-white' : 'hover:bg-[#062c21]/50 border-transparent text-white/50'
            }`}>
              <span
                aria-hidden="true"
                className="block w-[22px] h-[22px] bg-[#FFFFFF]/40 transition-colors group-hover:bg-[#4ade80]"
                style={{
                  WebkitMaskImage: "url('/site-information.svg')",
                  maskImage: "url('/site-information.svg')",
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  maskPosition: 'center',
                  WebkitMaskSize: 'contain',
                  maskSize: 'contain'
                }}
              />
            </div>
          </Link>
        </div>
      </div>

      {/* LAYER PANEL (ABSOLUTE) */}
      <div className="absolute left-[70px] top-0 w-[310px] bg-[#3A463D] flex flex-col h-auto max-h-screen [@media(max-height:840px)]:max-h-[80vh] z-20 rounded-br-2xl">
        <div className="p-3 pt-[48px] pr-[20px] pb-[24px] pl-[20px] shrink-0">
          <h1 className="text-xl font-medium text-[24px] text-white tracking-tight leading-tight">
            Data Spatial Layer
          </h1>
          <p className="text-[12px] text-[#a1b3ae] mt-2 leading-relaxed">
            Enable/Disable Spatial Layers: Use the toggles to customize your data visualization
          </p>
        </div>

        <div className="bg-[#d9e5db] shadow-inner overflow-hidden rounded-br-2xl min-h-0 flex flex-col flex-1">
          <div className="px-3 pt-3 pb-1 shrink-0">
            <input
              type="text"
              value={layerSearchText}
              onChange={(e) => setLayerSearchText(e.target.value)}
              placeholder="Search layers..."
              className="w-full h-9 rounded-md border border-[#b8c9bc] bg-white/90 px-3 text-[12px] text-[#2b3f35] placeholder:text-[#7f9487] focus:outline-none focus:ring-2 focus:ring-[#20372A]/20"
            />
          </div>

          <div className="overflow-y-auto px-1 py-3 space-y-0.5 custom-scrollbar-light flex-1">
            {filteredLayerConfigs.map((layer) => (
              <div 
                key={layer.id} 
                className="flex items-center p-4 rounded-lg transition-all group hover:bg-white/20 gap-4 w-full"
              >
                <Switch 
                  checked={activeStatus[layer.id] || false}
                  onCheckedChange={(val) => setActiveStatus(prev => ({...prev, [layer.id]: val}))}
                  className="data-[state=checked]:bg-[#FF581D] data-[state=unchecked]:bg-[#ffffff]/60 shrink-0 data-[state=unchecked]:border-[#FECDBC] data-[state=checked]:border-[#B12E00]"
                />
                <div className="flex flex-col flex-1 min-w-0 pr-2">
                  <Label className="text-[16px] font-medium leading-tight cursor-pointer text-[#4C3838] truncate block w-full">
                    {layer.name}
                  </Label>
                  <p className="text-[12px] font-normal mt-1 text-[#4C3838] truncate w-full">
                    {layer.short_description}
                  </p>
                </div>
              <button
                type="button"
                className="shrink-0 p-1 hover:bg-white/10 rounded-full transition-colors"
                data-info-trigger="true"
                onClick={(e) => {
                  e.stopPropagation();
                  if (selectedInfoLayer?.id === layer.id) {
                    setSelectedInfoLayer(null);
                    return;
                  }
                  openInfoPanel(e.currentTarget.getBoundingClientRect(), layer);
                }}
              >
                  <Image src="/info.svg" alt="Info" width={20} height={20} className={selectedInfoLayer?.id === layer.id ? "text-white" : "text-[#062c21]/40"} />
              </button>
              </div>
            ))}
            {filteredLayerConfigs.length === 0 && (
              <div className="px-4 py-6 text-center text-[12px] text-[#5f7368]">
                No matching layers found.
              </div>
            )}
          </div>
        </div>
        
      </div>

      {selectedInfoLayer && (
        <div 
          className="absolute w-[300px] max-h-[50vh] bg-white z-[100] border border-black flex flex-col rounded-lg"
          style={{ 
            top: `${infoPanelTop}px`,
            left: `${infoPanelLeft}px`
          }}
          ref={infoPanelRef}
        >
          <div className="p-4 flex flex-col w-full max-h-[50vh] p-3 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Image src="/info.svg" alt="Info" width={20} height={20} className="text-zinc-500" />
                <h2 className="text-[1rem] font-bold text-[#062c21]">Detail Information</h2>
              </div>
              <button onClick={() => setSelectedInfoLayer(null)} className="p-1 hover:bg-zinc-100 rounded-full">
                <X size={16} className="text-zinc-400" />
              </button>
            </div>
            
            <div className="w-full h-px bg-zinc-100 mb-4" />

            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar-detail text-[#062c21]">
              <div className="space-y-4">
                <p className="text-[12px] leading-relaxed opacity-80 w-[255px]">
                  {selectedInfoLayer.description}
                </p>

                <div className="grid gap-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase opacity-50 block">Date of Content</span>
                    <span className="text-[12px]">{selectedInfoLayer.content_date || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase opacity-50 block">Spatial Resolution</span>
                    <span className="text-[12px]">{selectedInfoLayer.spatial_resolution || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase opacity-50 block">Source</span>
                    <span className="text-[12px] font-medium">{selectedInfoLayer.source || '-'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FEATURE INFO POPUP (from map click) */}
      {featureInfoData && (
        <div
          ref={featureInfoRef}
          className="absolute w-[320px] max-h-[50vh] bg-white z-[110] border border-black flex flex-col rounded-lg shadow-2xl"
          style={{
            top: Math.min(featureInfoPos.top, window.innerHeight - 200),
            left: Math.min(featureInfoPos.left, window.innerWidth - 340),
          }}
        >
          <div className="p-4 flex flex-col w-full max-h-[50vh] p-3 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Image src="/info.svg" alt="Info" width={20} height={20} className="text-zinc-500" />
                <h2 className="text-[1rem] font-bold text-[#062c21]">{featureInfoData.layerName}</h2>
              </div>
              <button
                onClick={() => setFeatureInfoData(null)}
                className="p-1 hover:bg-zinc-100 rounded-full"
              >
                <X size={16} className="text-zinc-400" />
              </button>
            </div>

            <div className="w-full h-px bg-zinc-100 mb-4" />

            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar-detail text-[#062c21]">
              <div className="space-y-4">
                {featureInfoData.rows.map((row, idx) => (
                  <div key={idx}>
                    <span className="text-[11px] font-bold uppercase opacity-50 block">
                      {row.label}
                    </span>
                    <span className="text-[12px]">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAP AREA */}
      <div ref={mapElement} className="flex-1 h-full relative z-10">
        <div className="absolute left-4 bottom-4 z-20 flex flex-col items-start gap-2 text-[12px] text-zinc-700">
          <div
            ref={scaleLineRef}
            className={`map-scale-line relative ${baseMapType === 'satellite' ? 'map-scale-line--dark' : ''}`}
          />
          <div className="h-4" />
          <span className={`mr-[20px] text-[11px] font-semibold text-[18px] ${baseMapType === 'satellite' ? 'text-white' : 'text-black'}`}>
            Powered by ESRI
          </span>
        </div>
        <div className="absolute right-4 top-24 z-20 flex flex-col items-end gap-2">
          <div className="flex flex-col bg-white rounded-md border border-zinc-200 overflow-hidden">
            <button
              type="button"
              className="w-[33px] h-[33px] flex items-center justify-center text-[#FA412B] hover:bg-zinc-50 transition-colors text-[30px]"
              aria-label="Zoom in"
              onClick={() => {
                const view = mapRef.current?.getView();
                if (!view) return;
                const current = view.getZoom() ?? 0;
                const center = view.getCenter();
                const zoom = current + 1;
                if (center) {
                  console.log('Zoom In:', {
                    x: center[0],
                    y: center[1],
                    zoom: zoom
                  });
                }
                view.animate({ zoom, duration: 250 });
              }}
            >
              <Image
                src="/zoom_in.png"
                alt="Zoom in"
                width={17}
                height={17}
                className="object-contain"
              />
            </button>
            <div className="h-px bg-zinc-200" />
            <button
              type="button"
              className="w-[33px] h-[33px] flex items-center justify-center text-[#FA412B] hover:bg-zinc-50 transition-colors text-[18px]"
              aria-label="Zoom out"
              onClick={() => {
                const view = mapRef.current?.getView();
                if (!view) return;
                const current = view.getZoom() ?? 0;
                const center = view.getCenter();
                const zoom = current - 1;
                if (center) {
                  console.log('Zoom Out:', {
                    x: center[0],
                    y: center[1],
                    zoom: zoom
                  });
                }
                view.animate({ zoom, duration: 250 });
              }}
            >
              <Image
                src="/zoom_out.png"
                alt="Zoom out"
                width={17}
                height={17}
                className="object-contain"
              />
            </button>
          </div>

          <div className="relative">
            <button
              type="button"
              className="w-9 h-9 flex items-center justify-center bg-white rounded-md border border-zinc-200 text-[#FA412B] hover:bg-zinc-50 transition-colors text-[18px]"
              aria-label="Base map"
              onClick={() => setShowBaseMapMenu((prev) => !prev)}
            >
              <Layers size={17} />
            </button>

            {showBaseMapMenu && (
              <div className="absolute right-0 mt-2 w-60 bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden">
                {(
                  [
                    { id: 'grey', label: 'Grey', preview: '/gray.png' },
                    { id: 'osm', label: 'OSM', preview: '/osm.png' },
                    { id: 'satellite', label: 'Satellite', preview: '/satellite.png' }
                  ] as Array<{ id: BaseMapType; label: string; preview: string }>
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`w-full px-4 py-3 text-left transition-colors ${baseMapType === option.id ? 'bg-[#e7f2ec] text-[#062c21] font-semibold' : 'text-zinc-700 hover:bg-zinc-100'}`}
                    onClick={() => {
                      setBaseMapType(option.id);
                      setShowBaseMapMenu(false);
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative w-24 h-16 shrink-0 rounded-md overflow-hidden border border-zinc-200">
                        <Image
                          src={option.preview}
                          alt={`${option.label} preview`}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      </div>
                      <span className="text-[14px]">{option.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* DYNAMIC LEGEND */}
        <div className="absolute bottom-6 right-6 z-10 flex flex-col items-end gap-0 transition-all duration-300">
          
          <button 
            onClick={() => setIsLegendExpanded(!isLegendExpanded)}
            className="bg-white p-1.5 rounded-t-lg shadow-sm border-x border-t border-zinc-200 text-zinc-800 hover:bg-zinc-50 transition-all flex items-center justify-center w-10 h-8"
          >
            {isLegendExpanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
          </button>

          <div className="w-[340px]">
            <div className="bg-[#3A463D] flex items-center justify-between h-[48px] px-[16px] py-[20px] rounded-tl-xl shadow-2xl">
              <h3 className="text-[18px] font-semibold text-white tracking-wide">Legend</h3>
              <button
                className="font-[inter] bg-[#C3D2C3] text-[#515151] text-xs rounded-full transition-colors w-[155px] h-[30px] font-semibold flex items-center justify-center"
                onClick={handleExportMapAsImage}
                type="button"
              >
                Export area as Image
              </button>
            </div>
          </div>

          {isLegendExpanded && (
            <div className="w-[340px] bg-white shadow-2xl border-zinc-200 overflow-hidden rounded-br-xl animate-in fade-in slide-in-from-bottom-2 duration-200 flex flex-col">
              <div className="bg-white">
                {activeLayerConfigs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[92px] gap-2">
                    <div className="relative w-10 h-10"> 
                      <Image 
                        src="/search.png" 
                        alt="Search Icon" 
                        fill
                        sizes="51px"
                        className="object-contain"
                      />
                    </div>
                    <p className="font-semibold text-sm text-[#515151]">To see legend, select spatial data layer first</p>
                  </div>
                ) : (
                  <div className="p-6 max-h-[380px] overflow-y-auto custom-scrollbar">
                    <div className="space-y-6">
                      {orderedActiveLayerConfigs.map((config, index) => {
                        const currentLegend = legendData[config.layers];
                        const rules = currentLegend?.Legend?.[0]?.rules || [];

                        return (
                          <div
                            key={config.id}
                            className={`relative rounded-xl border border-zinc-200 bg-white p-4 animate-in fade-in duration-300 ${index === 0 ? '' : '-mt-6'} ${draggingLegendId === config.id ? 'shadow-2xl opacity-70 cursor-grabbing' : 'shadow-sm cursor-grab'}`}
                            style={{ zIndex: 50 - index }}
                            draggable={!showOpacitySlider[config.id]}
                            onDragStart={handleLegendDragStart(config.id)}
                            onDragEnd={handleLegendDragEnd}
                            onDragOverCapture={handleLegendDragOver}
                            onDropCapture={handleLegendDrop(config.id)}
                          >
                            <div className="flex justify-between gap-3 mb-3">
                              <h4 className="text-[11px] font-bold text-zinc-800 flex items-center gap-2 uppercase tracking-tight min-w-0">
                                <GripVertical size={14} className="text-zinc-400 shrink-0" />
                                <span className="truncate">{config.name}</span>
                              </h4>

                              <div className="flex items-center gap-2 shrink-0" data-no-drag="true">
                                <div className="relative" data-no-drag="true">
                                  <button
                                    type="button"
                                    className="p-1"
                                    aria-label="Layer opacity"
                                    onClick={() => setShowOpacitySlider(prev => ({ ...prev, [config.id]: !prev[config.id] }))}
                                  >
                                    <Droplet size={16} className="text-zinc-700/60 hover:text-[#059669]" />
                                  </button>
                                  {showOpacitySlider[config.id] && (
                                    <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-zinc-200 rounded-lg shadow-xl px-4 py-3 flex flex-col items-center min-w-[160px]" style={{ minWidth: 160 }}>
                                      <input
                                        type="range"
                                        min={0.1}
                                        max={1}
                                        step={0.01}
                                        value={layerOpacity[config.id] ?? 0.8}
                                        onChange={e => {
                                          const val = parseFloat(e.target.value);
                                          setLayerOpacity(prev => ({ ...prev, [config.id]: val }));
                                        }}
                                        className="w-full accent-[#059669]"
                                      />
                                      <span className="text-[11px] text-zinc-700 mt-1">{((layerOpacity[config.id] ?? 0.8) * 100).toFixed(0)}%</span>
                                    </div>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => toggleLegendVisibility(config.id)}
                                  className="p-1"
                                  aria-label="Toggle visibility"
                                  data-no-drag="true"
                                >
                                  <Eye
                                    size={16}
                                    className={(layerVisibility[config.id] ?? true) ? 'text-zinc-700' : 'text-zinc-700/30'}
                                  />
                                </button>

                                <div className="relative" data-no-drag="true">
                                  <button
                                    type="button"
                                    className="p-1"
                                    data-info-trigger="true"
                                    aria-label="Layer description"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (selectedInfoLayer?.id === config.id) {
                                        setSelectedInfoLayer(null);
                                        return;
                                      }
                                      openInfoPanel(e.currentTarget.getBoundingClientRect(), config);
                                    }}
                                  >
                                    <Image
                                      src="/info.svg"
                                      alt="Info"
                                      width={20}
                                      height={20}
                                      className="text-zinc-700/60"
                                    />
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => deactivateLayer(config.id)}
                                  className="p-1"
                                  aria-label="Disable layer"
                                  data-no-drag="true"
                                >
                                  <X size={16} className="text-zinc-700/60 hover:text-zinc-900" />
                                </button>
                              </div>
                            </div>
                            
                           <div className="space-y-2.5">
                              {rules.map((rule: LegendRule, idx: number) => {
                                const symbolizer = rule.symbolizers[0];
                                const colormapEntries = symbolizer?.Raster?.colormap?.entries;
                                const colormapType = symbolizer?.Raster?.colormap?.type;
                                const isRamp = colormapEntries && colormapEntries.length > 2 && colormapEntries.every((e: LegendEntry) => e.color) && (colormapType === 'ramp' || colormapEntries.some((e: LegendEntry) => e.label && String(e.label).trim() !== '')) && isFutureDefLayer(config);

                                if (isRamp) {
                                  const heightPx = 120;
                                  const quantities = colormapEntries.map((e: LegendEntry) => Number(e.quantity));
                                  const hasQuant = quantities.every((q: number) => !isNaN(q));
                                  let gradient: string;
                                  if (hasQuant) {
                                    const min = quantities[0];
                                    const max = quantities[quantities.length - 1];
                                    const stops = colormapEntries.map((e: LegendEntry, i: number) => {
                                      const q = Number(e.quantity);
                                      const pct = max > min ? ((q - min) / (max - min)) * 100 : (i / (colormapEntries.length - 1)) * 100;
                                      return `${e.color} ${pct}%`;
                                    }).join(', ');
                                    gradient = `linear-gradient(to bottom, ${stops})`;
                                  } else {
                                    gradient = `linear-gradient(to bottom, ${colormapEntries.map((e: LegendEntry) => e.color).join(',')})`;
                                  }

                                  const topLabel = colormapEntries[0].label || colormapEntries[0].quantity || '';
                                  const bottomLabel = colormapEntries[colormapEntries.length - 1].label || colormapEntries[colormapEntries.length - 1].quantity || '';
                                  const middleLabelEntry = colormapEntries.slice(1, -1).find((e: LegendEntry) => e.label && String(e.label).trim() !== '');
                                  const middleLabel = middleLabelEntry ? middleLabelEntry.label : '';

                                  return (
                                    <div key={idx} className="flex items-start gap-3 w-full">
                                      <div className="w-4" style={{ height: heightPx, background: gradient, borderColor: '#e5e7eb' }} />

                                      <div className="flex flex-col justify-between" style={{ height: heightPx }}>
                                        <span className="text-[11px] text-zinc-600 font-medium" style={{ minWidth: 56 }}>{topLabel}</span>
                                        {middleLabel ? <span className="text-[11px] text-zinc-600 font-medium" style={{ minWidth: 56 }}>{middleLabel}</span> : <span />}
                                        <span className="text-[11px] text-zinc-600 font-medium" style={{ minWidth: 56 }}>{bottomLabel}</span>
                                      </div>
                                    </div>
                                  );
                                }

                                if (colormapEntries) {
                                  return colormapEntries.map((entry: LegendEntry, eIdx: number) => (
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
    </div>
  );
};