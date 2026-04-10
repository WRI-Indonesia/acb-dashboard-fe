"use client";

import React, { useState } from 'react';
import type { SiteDetailData, BiodiversityIndexData } from '../types/site';
import Image from 'next/image';
import { ChevronDown, ChevronUp, Share2 } from 'lucide-react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

const siteDetailData = {
    country: "Indonesia",
    ahp_name: "Humbo Community Managed Forestry (FMNR) Project",
    area_ha: 2801.99,
    class_description: "Restoration",
    deforestation: {
        annual: "-13.4",
        change: "134.1",
        graph_data: [0.1278, 0.7254, 0.1584, 0.5067, 0.3663, 0.0306, 1.71, 1.3383, 1.2519, 0.0207, 0.5904],
        pct: -0.92,
        text: "This project location has experienced forest loss of up to 134.1 ha in the past 10 years, with the annual historical rate of deforestation of -0.92% (-13.41 ha/year)"
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
    }
};

const SIMPSON_DIVERSITY_THRESHOLD = 0.8;
const SHANNON_DIVERSITY_THRESHOLD = 2.2;


const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    return (
        <div className="relative bg-[#e3e7c7] pb-6">
            <button onClick={() => setIsCollapsed(!isCollapsed)} className="w-full flex justify-between items-center p-4 bg-[#e3e7c7]">
                <h3 className="font-bold text-lg text-[#265F44]">{title}</h3>
                {isCollapsed ? <ChevronDown className="text-[#265F44]" /> : <ChevronUp className="text-[#265F44]"/>}
            </button>
            {!isCollapsed && <div className="rounded-lg py-0 px-6">{children}</div>}

            <div
                className="absolute left-4 right-4 h-[2px] bg-[#9fb59f] rounded-lg opacity-80"
                style={{ bottom: 10, pointerEvents: 'none' }}
            />
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
        chart: { type: 'column', backgroundColor: '#c8d2c3' },
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
            color: '#d9534f',
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
    },
    title: {
        text: title,
        align: 'left',
        margin: 18,
        style: { color: '#265F44', fontWeight: 'bold', fontSize: '18px' }
    },
    xAxis: {
        categories: data.map(d => d.year.toString()),
        labels: { style: { color: '#265F44' } },
        lineColor: '#265F44',
        tickColor: '#265F44',
    },
    yAxis: {
        min: 0,
        title: { text: '', style: { color: '#265F44' } },
        labels: { style: { color: '#265F44' } },
        gridLineColor: '#b7cbb7',
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

    if (!site) return null;

    const resolvedSite: typeof siteDetailData = {
        country: site.country ?? siteDetailData.country,
        ahp_name: site.ahp_name ?? siteDetailData.ahp_name,
        area_ha: site.area_ha ?? siteDetailData.area_ha,
        class_description: site.class_description ?? siteDetailData.class_description,
        deforestation: site.deforestation ?? siteDetailData.deforestation,
        carbon_emission: site.carbon_emission ?? siteDetailData.carbon_emission,
        biodiversity_index_analysis: site.biodiversity_index_analysis ?? siteDetailData.biodiversity_index_analysis,
    };

    return (
        <div className="absolute top-0 left-[70px] w-[500px] h-full bg-[#e3e7c7] z-40 shadow-2xl overflow-y-auto custom-scrollbar-detail">
            <div className="pt-[48px] pb-[24px] px-[20px] bg-[#3A463D] text-white">
                <h2 className="text-xl font-bold">Site Information</h2>
                <p className="text-xs text-white/80 mt-1">
                    Explore our interactive map for a comprehensive overview of many restoration and conservation sites, showcasing the planet`&apos;`s rich biodiversity and protected areas.
                </p>
            </div>

            <div className="px-4 py-3 bg-[#c8d2c3]">
                <h3 className="font-bold text-[15px] text-[#1c3b2e]">
                    {resolvedSite.ahp_name}
                </h3>
                <div className="flex items-center gap-2 text-[12px] text-[#2f5b47] mt-1">
                    <span>{resolvedSite.country ?? 'Country: -'}</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-0 p-4 bg-[#c8d2c3]">
                <div className="relative h-44 rounded-l-lg overflow-hidden">
                    <Image
                        src="/forest_p1.png"
                        fill
                        sizes="(max-width: 640px) 100vw, 240px"
                        className="object-cover"
                        alt="Site image 1"
                    />
                </div>
                <div className="relative h-44 rounded-r-lg overflow-hidden">
                    <Image
                        src="/forest_p2.png"
                        fill
                        sizes="(max-width: 640px) 100vw, 240px"
                        className="object-cover"
                        alt="Site image 2"
                    />
                </div>
            </div>
            
            <div className="p-4 flex justify-between items-center bg-[#c8d2c3]">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Image
                            src="/icon_hectare.png"
                            width={18}
                            height={18}
                            alt="Hectare icon"
                        />
                        <span className="text-[#265f44]">{Number(Number(resolvedSite.area_ha).toFixed(2)).toLocaleString()} ha</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Image
                            src="/icon_restoration.png"
                            width={18}
                            height={18}
                            alt="Restoration icon"
                        />
                        <span className="font-semibold text-[#265f44]">{resolvedSite.class_description}</span>
                    </div>
                </div>
                <Share2 className="cursor-pointer bg-[#265F44]" />
            </div>

            <Section title="Deforestation">
                <div className="bg-[#c8d2c3] p-4 rounded-lg shadow">
                    <h4 className="font-semibold mb-2 text-[#265F44]">Deforestation in this project area in the past 10 years</h4>
                    <HighchartsReact highcharts={Highcharts} options={getDeforestationChartOptions(resolvedSite.deforestation?.graph_data)} />
                    <div className="mt-4 grid grid-cols-5 gap-4 items-start">
                        <div className="col-span-2">
                            {/* Example: show annual value rounded if available */}
                            <p className="text-2xl font-bold text-[#265F44]">
                                {resolvedSite.deforestation.annual ? Number(Number(resolvedSite.deforestation.annual).toFixed(2)).toLocaleString() : '-'} ha/year
                            </p>
                        </div>
                        <div className="col-span-3">
                            <p className="text-[11px] leading-relaxed text-[#5a6b5f]">
                                {resolvedSite.deforestation.text}
                            </p>
                        </div>
                    </div>
                    <div className="mt-3 rounded-md bg-[#9fb59f] px-3 py-2">
                        <p className="text-[11px] font-semibold text-[#1f3d2e] text-center">
                            The selected area has a low average risk of future deforestation.
                        </p>
                    </div>
                </div>
            </Section>

            <Section title="Carbon Emission">
                <div>
                    <div className="flex items-center justify-between bg-[#1f5b3f] rounded-lg p-1">
                        {[10, 15, 20].map(year => (
                            <button
                                key={year}
                                onClick={() => setActiveTab(year)}
                                className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-colors ${
                                    activeTab === year
                                        ? 'bg-[#9fb59f] text-[#1f3d2e]'
                                        : 'text-white/90'
                                }`}
                            >
                                {year} Year
                            </button>
                        ))}
                    </div>

                    <div className="mt-4 bg-[#C8D2C3] rounded-lg overflow-hidden">
                        <div className="grid grid-cols-5 items-stretch">
                            <div className="col-span-4 p-3">
                                <h4 className="font-semibold text-[#265F44] text-[12px]">Potential Avoided Carbon Emission</h4>
                                <div className="mt-2 grid grid-cols-4 gap-3 items-start">
                                    <div className="col-span-2">
                                        <p className="text-2xl font-bold text-[#265F44]">
                                            {(() => {
                                                const val = resolvedSite.carbon_emission.potential_avoided.find(p => p.project_duration === activeTab)?.total_co2eq;
                                                return val !== undefined ? Number(val.toFixed(2)).toLocaleString() : '-';
                                            })()} ton
                                        </p>
                                        <p className="text-[11px] text-[#5a6b5f]">of Carbon emission can be avoided</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-[10px] leading-relaxed text-[#5a6b5f]">
                                            The Avoided Deforestation project in this area has the potential to avoid 0 tonnes of CO2eq emissions over the 40 years of project duration
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="col-span-1 relative min-h-[76px]">
                                <Image
                                    src="/forest_p3.png"
                                    fill
                                    sizes="120px"
                                    className="object-cover"
                                    alt="Carbon emission visual"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 bg-[#C8D2C3] rounded-lg">
                        <h4 className="font-semibold text-[#265F44] text-[12px] p-3">Carbon accumulation from natural forest regrowth</h4>
                        <div className="mt-2 grid grid-cols-5 gap-3 items-start px-3">
                            <div className="col-span-2">
                                <p className="text-2xl font-bold text-[#265F44]">
                                    {(() => {
                                        const val = resolvedSite.carbon_emission.potential_sequestered.find(p => p.project_duration === activeTab)?.total_co2eq;
                                        return val !== undefined ? Number(val.toFixed(2)).toLocaleString() : '-';
                                    })()} ton
                                </p>
                                <p className="text-[11px] text-[#5a6b5f]">of CO2eq potentially accumulated</p>
                            </div>
                            <div className="col-span-3">
                                <p className="text-[10px] leading-relaxed text-[#5a6b5f]">
                                    The ecosystem restoration through natural regeneration project in this area could potentially sequester 104,255.92 tonnes of CO2eq during 40 years of project duration.
                                </p>
                            </div>
                        </div>
                        <div className="mt-3 relative h-[10rem] overflow-hidden rounded-b-lg">
                            <Image
                                src="/forest_p1.png"
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
                <div>
                    <HighchartsReact
                        highcharts={Highcharts}
                        options={biodiversityChartOptions(
                            'Annual Simpson Diversity Index',
                            resolvedSite.biodiversity_index_analysis.simpson,
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
                            resolvedSite.biodiversity_index_analysis.shannon,
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
    );
}
