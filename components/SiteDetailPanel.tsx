"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SiteDetailData, BiodiversityIndexData, SiteImage } from '../types/site';
import Image from 'next/image';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, X } from 'lucide-react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

const siteDetailData: SiteDetailData = {
    country: "Indonesia",
    ahp_name: "Humbo Community Managed Forestry (FMNR) Project",
    area_ha: 2801.99,
    class_description: "Restoration",
    deforestation: {
        annual: "-13.4",
        change: "134.1",
        graph_data: [0.1278, 0.7254, 0.1584, 0.5067, 0.3663, 0.0306, 1.71, 1.3383, 1.2519, 0.0207, 0.5904],
        pct: -0.92,
        text: "This project location has experienced forest loss of up to 134.1 ha in the past 10 years, with the annual historical rate of deforestation of -0.92% (-13.41 ha/year)",
        risk_text: "The selected area has a high average risk of future deforestation."
    },
    carbon_emission: {
        potential_avoided: [
            { "project_duration": 10, "total_co2eq": 15332.77 },
            { "project_duration": 15, "total_co2eq": 15332.77 },
            { "project_duration": 20, "total_co2eq": 15332.77 }
        ],
        potential_sequestered: [
            { "project_duration": 10, "total_co2eq": 527132.03 },
            { "project_duration": 15, "total_co2eq": 527132.03 },
            { "project_duration": 20, "total_co2eq": 527132.03 }
        ]
    },
    biodiversity_index_analysis: {
        simpson: [
            { "year": 2004, "value": 2.2450 },
            { "year": 2005, "value": 4.6917 },
            { "year": 2007, "value": 1.7478 }
        ],
        shannon: [
            { "year": 2004, "value": 2.2450 },
            { "year": 2005, "value": 4.6917 },
            { "year": 2007, "value": 1.7478 }
        ]
    },
    images: []
};

const SIMPSON_DIVERSITY_THRESHOLD = 0.8;
const SHANNON_DIVERSITY_THRESHOLD = 2.2;

const DEFAULT_IMAGE_HEIGHT_RATIO = 0.32;
const FALLBACK_IMAGES = [
    { src: '/forest_p1.png', alt: 'Site image 1' },
    { src: '/forest_p2.png', alt: 'Site image 2' }
];

const getImageMimeType = (filename?: string | null) => {
    const extension = filename?.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'jpg':
        case 'jpeg':
            return 'image/jpeg';
        case 'png':
            return 'image/png';
        case 'webp':
            return 'image/webp';
        case 'gif':
            return 'image/gif';
        default:
            return 'image/jpeg';
    }
};

const buildImageSrc = (image?: SiteImage | null) => {
    if (!image?.image_base64) return null;
    if (image.image_base64.startsWith('data:')) return image.image_base64;
    const mimeType = getImageMimeType(image.filename);
    return `data:${mimeType};base64,${image.image_base64}`;
};

const SECTION_INFO_PARAGRAPH =
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\
     Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\
     Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\
     Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\
     Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";
const SECTION_INFO_FIELDS = [
    {
        label: 'Overview',
        value: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'
    },
    {
        label: 'Method',
        value: 'Lorem ipsum dolor sit amet, sed do eiusmod tempor incididunt.'
    },
    {
        label: 'Notes',
        value: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do.'
    }
];


const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const infoPanelRef = useRef<HTMLDivElement>(null);
    const infoButtonRef = useRef<HTMLButtonElement>(null);
    const [infoPanelTop, setInfoPanelTop] = useState(0);
    const [infoPanelLeft, setInfoPanelLeft] = useState(0);
    const [infoPanelAnchor, setInfoPanelAnchor] = useState<DOMRect | null>(null);

    const toggleCollapse = () => {
        setIsCollapsed((prev) => !prev);
        setIsInfoOpen(false);
    };

    useLayoutEffect(() => {
        if (!isInfoOpen || !infoPanelAnchor) return;

        const padding = 12;
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;
        const panelWidth = infoPanelRef.current?.offsetWidth ?? 380;
        const panelHeight = infoPanelRef.current?.offsetHeight ?? Math.min(500, Math.floor(viewportH * 0.6));
        const detailPanel = document.querySelector('[data-site-detail-panel="true"]') as HTMLElement | null;
        const detailPanelRect = detailPanel?.getBoundingClientRect() ?? null;

        let left = infoPanelAnchor.right + 12;
        if (detailPanelRect && left < detailPanelRect.right + 12) {
            left = detailPanelRect.right + 12;
        }
        if (left + panelWidth > viewportW - padding && detailPanelRect) {
            left = detailPanelRect.left - panelWidth - 12;
        }
        if (left + panelWidth > viewportW - padding) {
            left = infoPanelAnchor.left - panelWidth - 12;
        }
        if (left < padding) left = padding;

        let top = infoPanelAnchor.top;
        if (top + panelHeight > viewportH - padding) {
            top = viewportH - panelHeight - padding;
        }
        if (top < padding) top = padding;

        setInfoPanelTop(top);
        setInfoPanelLeft(left);
    }, [isInfoOpen, infoPanelAnchor]);

    useEffect(() => {
        if (!isInfoOpen) return;

        const handleOutsideClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (!target) return;
            if (infoPanelRef.current?.contains(target)) return;
            if (infoButtonRef.current?.contains(target)) return;
            setIsInfoOpen(false);
        };

        const handleScroll = () => {
            if (infoButtonRef.current) {
                setInfoPanelAnchor(infoButtonRef.current.getBoundingClientRect());
            }
        };

        const detailPanel = document.querySelector('[data-site-detail-panel="true"]');
        if (detailPanel) {
            detailPanel.addEventListener('scroll', handleScroll, { passive: true });
        }
        window.addEventListener('scroll', handleScroll, { passive: true });

        document.addEventListener('click', handleOutsideClick);

        return () => {
            document.removeEventListener('click', handleOutsideClick);
            if (detailPanel) {
                detailPanel.removeEventListener('scroll', handleScroll);
            }
            window.removeEventListener('scroll', handleScroll);
        };
    }, [isInfoOpen]);

    return (
        <div className="relative flex flex-col gap-3 p-5 bg-[#E3E7D7]">
            <div className="w-full flex justify-between items-center bg-[#E3E7D7]">
                <div className="flex items-center gap-2">
                    <button type="button" onClick={toggleCollapse} className="flex items-center">
                        <h3 className="font-semibold text-2xl text-[#FF581D]">{title}</h3>
                    </button>
                    <button
                        type="button"
                        className="shrink-0 p-1 hover:bg-white/10 rounded-full transition-colors"
                        aria-label={`Info ${title}`}
                        aria-expanded={isInfoOpen}
                        onClick={(event) => {
                            event.stopPropagation();
                            const nextOpen = !isInfoOpen;
                            if (nextOpen && infoButtonRef.current) {
                                setInfoPanelAnchor(infoButtonRef.current.getBoundingClientRect());
                            }
                            setIsInfoOpen(nextOpen);
                        }}
                        ref={infoButtonRef}
                    >
                        <Image
                            src="/info.svg"
                            alt="Info"
                            width={18}
                            height={18}
                            className="text-[#062c21]/40"
                        />
                    </button>
                </div>
                <button type="button" onClick={toggleCollapse} className="p-1">
                    {isCollapsed ? <ChevronDown className="text-[#265F44]" /> : <ChevronUp className="text-[#265F44]" />}
                </button>
            </div>
            {isInfoOpen && (
                <div
                    className="fixed w-[380px] max-h-[60vh] bg-white z-[100] border border-black flex flex-col rounded-lg"
                    style={{
                        top: `${infoPanelTop}px`,
                        left: `${infoPanelLeft}px`
                    }}
                    ref={infoPanelRef}
                >
                    <div className="p-4 flex flex-col w-full max-h-[60vh] p-4 overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Image src="/info.svg" alt="Info" width={20} height={20} className="text-zinc-500" />
                                <h4 className="text-[1rem] font-bold text-[#062c21]">Detail Information</h4>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsInfoOpen(false)}
                                className="p-1 hover:bg-zinc-100 rounded-full"
                                aria-label={`Close info ${title}`}
                            >
                                <X size={16} className="text-zinc-400" />
                            </button>
                        </div>

                        <div className="w-full h-px bg-zinc-100 mb-4" />

                        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar-detail text-[#062c21]">
                            <div className="space-y-4">
                                <p className="text-[12px] leading-relaxed opacity-80 w-full">
                                    {SECTION_INFO_PARAGRAPH}
                                </p>

                                <div className="grid gap-3">
                                    {SECTION_INFO_FIELDS.map((field) => (
                                        <div key={field.label}>
                                            <span className="text-[11px] font-bold uppercase opacity-50 block">{field.label}</span>
                                            <span className="text-[12px]">{field.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {!isCollapsed && (
                <div className="rounded-lg flex flex-col gap-3">
                    {children}
                    <div className="absolute left-4 right-4 bottom-2 h-[1px] bg-[#BAC0A7] rounded-lg opacity-80 pointer-events-none" />
                </div>
            )}
        </div>
    );
};

const getDeforestationChartOptions = (graphData?: number[]): Highcharts.Options => {
    const data = Array.isArray(graphData) ? graphData.slice(-10) : [];
    const n = data.length;
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - n + 1;
    const categories = data.map((_, i) => String(startYear + i));

    return {
        chart: {
            type: 'column',
            backgroundColor: '#c8d2c3',
            spacing: [12, 12, 12, 12],
        },
        title: { text: '' },
        xAxis: { categories, crosshair: true },
        yAxis: {
            min: 0,
            title: { text: '' },
            labels: { format: '{value}%' },
        },
        series: [{
            showInLegend: false,
            type: 'column',
            data: data.map(v => Number((Number(v) * 100).toFixed(2))),
            color: '#FF581D',
            borderWidth: 0
        }],
        credits: { enabled: false }
    };
};

const getBiodiversityPointColor = (
    value: number,
    threshold: number,
    lowColor: string,
    highColor: string
) => (value >= threshold ? highColor : lowColor);

const biodiversityChartOptions = (
    title: string,
    data: BiodiversityIndexData[],
    legendItems: { name: string; color: string }[],
    threshold: number
): Highcharts.Options => ({
    chart: {
        type: 'line',
        backgroundColor: '#C8D2C3',
        borderRadius: 8,
        spacing: [12, 12, 12, 12],
    },
    title: {
        text: title,
        align: 'left',
        margin: 18,
        style: {
            color: '#265F44',
            fontFamily: '"Acumin Pro Condensed", sans-serif',
            fontWeight: '600',
            fontSize: '20px',
            lineHeight: '20px',
            letterSpacing: '0px',
        }
    },
    xAxis: {
        categories: data.map(d => d.year.toString()),
        labels: { style: { color: '#265F44' } },
        lineColor: '#265F44',
        tickColor: '#265F44',
        gridLineWidth: 1,
        gridLineColor: '#FFFFFF',
        gridLineDashStyle: 'Dash',
    },
    yAxis: {
        min: 0,
        title: { text: '', style: { color: '#265F44' } },
        labels: { style: { color: '#265F44' } },
        gridLineColor: '#FFFFFF',
        gridLineDashStyle: 'Dash',
    },
    legend: {
        enabled: true,
        align: 'right',
        verticalAlign: 'top',
        layout: 'horizontal',
        y: 4,
        itemStyle: { color: '#265F44', fontWeight: 'bold' },
        symbolRadius: 6,
    },
    series: [
        {
            name: legendItems[0]?.name ?? title,
            type: 'line',
            data: data.map((d) => {
                const pointColor = getBiodiversityPointColor(
                    d.value,
                    threshold,
                    legendItems[1]?.color ?? legendItems[0]?.color ?? '#b91c1c',
                    legendItems[0]?.color ?? '#b91c1c'
                );
                return {
                    y: Number(d.value.toFixed(2)),
                    marker: {
                        symbol: 'circle',
                        fillColor: pointColor,
                        lineColor: pointColor,
                        lineWidth: 2,
                        radius: 5
                    }
                };
            }),
            color: '#265F44',
            marker: {
                enabled: true,
                fillColor: legendItems[0]?.color ?? '#b91c1c',
                lineColor: legendItems[0]?.color ?? '#b91c1c',
                lineWidth: 2,
                radius: 5,
            },
            lineWidth: 2,
            states: {
                hover: {
                    lineWidth: 3
                }
            },
            showInLegend: true,
        },
        ...legendItems.slice(1).map((item) => ({
            name: item.name,
            type: 'line',
            data: data.length ? [{ x: 0, y: null }] : [],
            color: item.color,
            lineWidth: 0,
            marker: {
                enabled: true,
                fillColor: item.color,
                lineColor: item.color,
                lineWidth: 2,
                radius: 5
            },
            enableMouseTracking: false,
            showInLegend: true,
        }))
    ],
    plotOptions: {
        series: {
            marker: {
                enabled: true
            }
        }
    },
    credits: { enabled: false },
});

type SiteDetailPanelProps = {
    site: SiteDetailData;
    onClose: () => void;
}

export default function SiteDetailPanel({ site }: SiteDetailPanelProps) {
    const [activeTab, setActiveTab] = useState(10);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [imageRatios, setImageRatios] = useState<Record<number, number>>({});

    useEffect(() => {
        setActiveImageIndex(0);
        setImageRatios({});
    }, [site?.ahp_name, site?.images]);

    const maxHeightRatio = Math.max(
        DEFAULT_IMAGE_HEIGHT_RATIO,
        ...Object.values(imageRatios)
    );
    const imageContainerStyle: React.CSSProperties = {
        aspectRatio: 1 / maxHeightRatio,
        minHeight: '11rem',
        maxHeight: '400px'
    };

    const handleImageLoad = (index: number) => (img: HTMLImageElement) => {
        if (!img?.naturalWidth || !img?.naturalHeight) return;
        const ratio = img.naturalHeight / img.naturalWidth;
        setImageRatios((prev) => {
            if (prev[index] === ratio) return prev;
            return { ...prev, [index]: ratio };
        });
    };

    if (!site) return null;

    const resolvedSite: typeof siteDetailData = {
        country: site.country ?? siteDetailData.country,
        ahp_name: site.ahp_name ?? siteDetailData.ahp_name,
        area_ha: site.area_ha ?? siteDetailData.area_ha,
        class_description: site.class_description ?? siteDetailData.class_description,
        deforestation: site.deforestation ?? siteDetailData.deforestation,
        carbon_emission: site.carbon_emission ?? siteDetailData.carbon_emission,
        biodiversity_index_analysis: site.biodiversity_index_analysis ?? siteDetailData.biodiversity_index_analysis,
        images: site.images ?? siteDetailData.images,
    };

    const deforestation = resolvedSite.deforestation ?? siteDetailData.deforestation;
    const carbonEmission = resolvedSite.carbon_emission ?? siteDetailData.carbon_emission;
    const biodiversityIndex = resolvedSite.biodiversity_index_analysis ?? siteDetailData.biodiversity_index_analysis;

    const siteImages = (resolvedSite.images ?? [])
        .map((image, index) => {
            const src = buildImageSrc(image);
            if (!src) return null;
            return {
                src,
                alt: image?.filename
                    ? `Site image ${index + 1} (${image.filename})`
                    : `Site image ${index + 1}`
            };
        })
        .filter((image): image is { src: string; alt: string } => Boolean(image));

    const isCarousel = siteImages.length > 1;
    const showSingleImage = siteImages.length === 1;

    return (
        <div className="absolute top-0 left-[70px] w-[600px] h-full bg-[#E3E7D7] z-40 shadow-2xl overflow-visible" data-site-detail-panel="true">
            <div className="h-full overflow-y-auto custom-scrollbar-detail">
            <div className="pt-12 pb-6 px-5 bg-[#3A463D] text-white">
                <p className="text-[1.75rem] font-semibold">Site Information</p>
                <p className="font-['inter'] text-xs text-white font-normal">
                    Explore our interactive map for a comprehensive overview of many restoration and conservation sites, showcasing the planet&apos;s rich biodiversity and protected areas.
                </p>
            </div>

            <div className="bg-[#c8d2c3] flex flex-col gap-3 p-5">
                <div>
                    <p className="font-semibold text-2xl text-[#265F44]">
                        {resolvedSite.ahp_name}
                    </p>
                    <div className="flex items-center text-xl text-[#265F44]">
                        <span>{resolvedSite.country ?? 'Country: -'}</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                    {isCarousel ? (
                        <div
                            className="relative w-full overflow-hidden rounded-lg bg-[#c8d2c3]"
                            style={imageContainerStyle}
                        >
                            <div
                                className="absolute inset-0 flex transition-transform duration-500 ease-in-out"
                                style={{ transform: `translateX(-${activeImageIndex * 100}%)` }}
                            >
                                {siteImages.map((image, index) => (
                                    <div key={`${image.alt}-${index}`} className="relative h-full min-w-full">
                                        <Image
                                            src={image.src}
                                            fill
                                            sizes="(max-width: 640px) 100vw, 520px"
                                            className="object-cover"
                                            alt={image.alt}
                                            unoptimized
                                            onLoadingComplete={handleImageLoad(index)}
                                        />
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={() => setActiveImageIndex((prev) => (prev - 1 + siteImages.length) % siteImages.length)}
                                className="absolute left-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-[#265F44] text-white shadow-md transition hover:bg-[#1f4b36]"
                                aria-label="Previous image"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveImageIndex((prev) => (prev + 1) % siteImages.length)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-[#265F44] text-white shadow-md transition hover:bg-[#1f4b36]"
                                aria-label="Next image"
                            >
                                <ChevronRight size={18} />
                            </button>
                            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#E3E7D7]/80 px-3 py-1">
                                {siteImages.map((_, index) => (
                                    <span
                                        key={`indicator-${index}`}
                                        className={`h-2 w-2 rounded-full ${index === activeImageIndex ? 'bg-[#265F44]' : 'bg-[#BAC0A7]'}`}
                                    />
                                ))}
                            </div>
                        </div>
                    ) : showSingleImage ? (
                        <div
                            className="relative w-full overflow-hidden rounded-lg"
                            style={imageContainerStyle}
                        >
                            <Image
                                src={siteImages[0].src}
                                fill
                                sizes="(max-width: 640px) 100vw, 520px"
                                className="object-cover"
                                alt={siteImages[0].alt}
                                unoptimized
                                onLoadingComplete={handleImageLoad(0)}
                            />
                        </div>
                    ) : (
                        <div className="flex w-full flex-row">
                            {FALLBACK_IMAGES.map((image, index) => (
                                <div
                                    key={image.src}
                                    className={`relative h-44 flex-1 overflow-hidden ${index === 0 ? 'rounded-l-lg' : 'rounded-r-lg'}`}
                                >
                                    <Image
                                        src={image.src}
                                        fill
                                        sizes="(max-width: 640px) 100vw, 264px"
                                        className="object-cover"
                                        alt={image.alt}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="flex gap-2">
                            <Image
                                src="/icon_hectare.png"
                                width={18}
                                height={18}
                                alt="Hectare icon"
                            />
                            <span className="font-['inter'] text-[#265F44] text-base font-semibold">{Number(Number(resolvedSite.area_ha).toFixed(2)).toLocaleString()} ha</span>
                        </div>
                        <div className="flex gap-2">
                            <Image
                                src="/icon_restoration.png"
                                width={18}
                                height={18}
                                alt="Restoration icon"
                            />
                            <span className="font-['inter'] text-[#265F44] text-base font-semibold">{resolvedSite.class_description}</span>
                        </div>
                    </div>
                    {/* <Share2 className="cursor-pointer bg-[#FF581D] p-[2px] rounded-sm" /> */}
                </div>
            </div>

            <Section title="Deforestation">
                <div className="bg-[#c8d2c3] flex flex-col rounded-lg gap-1 p-3">
                    <h4 className="font-semibold text-xl text-[#265F44]">Deforestation in this project area in the past 10 years</h4>
                    <HighchartsReact highcharts={Highcharts} options={getDeforestationChartOptions(deforestation?.graph_data)} />
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-row gap-5">
                            <p className="text-[2rem] text-nowrap font-semibold text-[#265F44]">
                                {deforestation?.annual ? Number(Number(deforestation?.annual).toFixed(2)).toLocaleString() : '-'} ha/year
                            </p>
                            <p className="text-xs font-[inter] text-[leading-relaxed text-[#5a6b5f]">
                                {deforestation?.text}
                            </p>
                        </div>
                        <div className="rounded-md bg-[#9BB69B] p-2">
                            <p className="text-sm font-semibold text-[#265F44] text-center">
                                {deforestation?.risk_text}
                            </p>
                        </div>
                    </div>
                </div>
            </Section>

            <Section title="Carbon Emission">
                <div className="flex flex-col gap-3 bg-[#c8d2c3]">
                    <div className="flex items-center justify-between bg-[#FF581D] rounded-lg h-[44px] p-1">
                        {[10, 15, 20].map(year => (
                            <button
                                key={year}
                                onClick={() => setActiveTab(year)}
                                className={`flex-1 font-semibold rounded-md transition-colors ${
                                    activeTab === year
                                        ? 'bg-[#FF7746] text-[#FBFBF9] text-xl items-center px-3 py-1'
                                        : 'text-[#FBFBF9] text-xl items-center'
                                }`}
                            >
                                {year} Years
                            </button>
                        ))}
                    </div>

                    <div className="bg-[#C8D2C3] rounded-lg overflow-hidden">
                        <div className="flex items-stretch min-h-[140px]">
                            <div className="flex flex-col p-3 gap-3">
                                <p className="font-semibold text-[#265F44] text-xl tracking-tight">
                                    Potential Avoided Carbon Emission
                                </p>
                                <div className="flex flex-row w-[424px] items-center gap-4">
                                    <div className="flex">
                                        <div className="flex flex-col w-[162px]">
                                            <p className="text-[clamp(1rem,2.8vw,1.75rem)] leading-tight font-bold text-[#265F44] break-words max-w-full">
                                                {(() => {
                                                    const val = carbonEmission?.potential_avoided.find(p => p.project_duration === activeTab)?.total_co2eq;
                                                    return val !== undefined ? Number(val.toFixed(2)).toLocaleString() : '-';
                                                })()}<span className="whitespace-nowrap"> ton</span>
                                            </p>
                                            <p className="mt-2 font-[inter] text-xs leading-snug text-[#265F44]">
                                                of Carbon emission can be avoided
                                            </p>
                                        </div>
                                    </div>
                                    <p className="font-[inter] text-xs leading-snug text-[#5B635E] max-w-[320px]">
                                        The Avoided Deforestation project in this area has the potential to avoid 0 tonnes of CO2eq emissions over the 40 years of project duration
                                    </p>
                                </div>
                            </div>
                            <div className="relative w-[120px] md:w-[126px] shrink-0">
                                <Image
                                    src="/forest_p3.png"
                                    fill
                                    sizes="126px"
                                    className="object-cover"
                                    alt="Carbon emission visual"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col bg-[#C8D2C3] rounded-lg p-3 gap-3">
                        <h4 className="font-semibold text-[#265F44] text-xl">Carbon Accumulation from Natural Forest Regrowth</h4>
                        <div className="flex flex-row gap-4 items-end">
                            <div className="flex">
                                <div className="flex flex-col w-[162px]">
                                    <p className="text-[clamp(1rem,2.8vw,1.75rem)] leading-tight font-bold text-[#265F44] break-words max-w-full">
                                        {(() => {
                                            const val = carbonEmission?.potential_sequestered.find(p => p.project_duration === activeTab)?.total_co2eq;
                                            return val !== undefined ? Number(val.toFixed(2)).toLocaleString() : '-';
                                        })()}<span className="whitespace-nowrap"> ton</span>
                                    </p>
                                    <p className="font-[inter] text-xs text-[#265F44]">of CO2eq potentially accumulated</p>
                                </div>
                            </div>
                            <div className="w-full">
                                <p className="font-[inter] text-xs text-[#5B635E]">
                                    The ecosystem restoration through natural regeneration project in this area could potentially sequester 104,255.92 tonnes of CO2eq during 40 years of project duration.
                                </p>
                            </div>
                        </div>
                        <div className="relative h-[10rem] overflow-hidden rounded-b-lg -mx-3 -mb-3">
                            <Image
                                src="/carbon.png"
                                fill
                                sizes="(max-width: 640px) 100vw, 420px"
                                className="object-cover"
                                alt="Forest regrowth"
                            />
                        </div>
                    </div>
                </div>
            </Section>

            <Section title="Biodiversity Index Analysis">
                <div className="bg-[#c8d2c3]">
                    <HighchartsReact
                        highcharts={Highcharts}
                        options={biodiversityChartOptions(
                            'Annual Simpson Diversity Index',
                            biodiversityIndex?.simpson ?? [],
                            [
                                { name: 'Very high diversity', color: '#dc2626' },
                                { name: 'High diversity', color: '#b91c1c' }
                            ],
                            SIMPSON_DIVERSITY_THRESHOLD
                        )}
                    />
                </div>
                <div>
                    <HighchartsReact
                        highcharts={Highcharts}
                        options={biodiversityChartOptions(
                            'Annual Shannon Diversity Index',
                            biodiversityIndex?.shannon ?? [],
                            [
                                { name: 'High diversity', color: '#dc2626' },
                                { name: 'Moderate diversity', color: '#f59e0b' }
                            ],
                            SHANNON_DIVERSITY_THRESHOLD
                        )}
                    />
                </div>
            </Section>
            </div>
        </div>
    );
}
