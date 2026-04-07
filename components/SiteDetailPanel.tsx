"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { ChevronDown, ChevronUp, Share2, TreeDeciduous } from 'lucide-react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

// Dummy data based on the user's example
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


const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    return (
        <div className="border-b border-zinc-200 bg-[#e3e7c7]">
            <button onClick={() => setIsCollapsed(!isCollapsed)} className="w-full flex justify-between items-center p-4 bg-[#e3e7c7]">
                <h3 className="font-bold text-lg text-[#265F44]">{title}</h3>
                {isCollapsed ? <ChevronDown className="text-[#265F44]" /> : <ChevronUp className="text-[#265F44]"/>}
            </button>
            {!isCollapsed && <div className="rounded-lg p-6">{children}</div>}
        </div>
    );
};

const chartOptions: Highcharts.Options = {
    chart: { type: 'column', backgroundColor: '#c8d2c3' },
    title: { text: '' },
    xAxis: {
        categories: ['2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020'],
        crosshair: true
    },
    yAxis: {
        min: 0,
        title: { text: '' },
        labels: { format: '{value}%' },
    },
    series: [{
        name: 'Deforestation',
        type: 'column',
        data: siteDetailData.deforestation.graph_data.slice(0, 10).map(v => v * 100),
        color: '#d9534f',
        borderWidth: 0
    }]
};

const biodiversityChartOptions = (title: string, data: any[]): Highcharts.Options => ({
    chart: { type: 'line' },
    title: { text: title },
    xAxis: {
        categories: data.map(d => d.year.toString())
    },
    yAxis: {
        title: { text: 'Index Value' }
    },
    series: [{
        name: title,
        type: 'line',
        data: data.map(d => d.value),
        color: '#d9534f'
    }]
});


export default function SiteDetailPanel({ site, onClose }: { site: any; onClose: () => void }) {
    const [activeTab, setActiveTab] = useState(10);

    if (!site) return null;

    return (
        <div className="absolute top-0 left-[70px] w-[500px] h-full bg-[#E3E7D7] z-40 shadow-2xl overflow-y-auto">
            <div className="p-4 bg-[#20372a] text-white">
                <button onClick={onClose} className="mb-2 text-sm">&larr; Back to Map</button>
                <h2 className="text-xl font-bold">Site Information</h2>
                <p className="text-xs text-white/80 mt-1">
                    Explore our interactive map for a comprehensive overview of many restoration and conservation sites, showcasing the planet's rich biodiversity and protected areas.
                </p>
            </div>

            <div className="px-4 py-3 bg-[#e3e7d7]">
                <h3 className="font-bold text-[15px] text-[#1c3b2e]">
                    {siteDetailData.ahp_name}
                </h3>
                <div className="flex items-center gap-2 text-[12px] text-[#2f5b47] mt-1">
                    <span>Lampung, Sumatra, Indonesia</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-0 p-4">
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
            
            <div className="p-4 flex justify-between items-center bg-[#e3e7d7] border-b border-zinc-200">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                            <Image
                                src="/icon_hectare.png"
                                width={18}
                                height={18}
                                alt="Hectare icon"
                            />
                        <span className="text-[#265f44]">{Number(siteDetailData.area_ha).toLocaleString()} ha</span>
                    </div>
                    <div className="flex items-center gap-2">
                            <Image
                                src="/icon_restoration.png"
                                width={18}
                                height={18}
                                alt="Restoration icon"
                            />
                        <span className="font-semibold text-[#265f44]">{siteDetailData.class_description}</span>
                    </div>
                </div>
                <Share2 className="cursor-pointer bg-[#265F44]" />
            </div>

            <Section title="Deforestation">
                <div className="bg-[#c8d2c3] p-4 rounded-lg shadow">
                    <h4 className="font-semibold mb-2 text-[#265F44]">Deforestation in this project area in the past 10 years</h4>
                    <HighchartsReact highcharts={Highcharts} options={chartOptions} />
                    <div className="mt-4 grid grid-cols-5 gap-4 items-start">
                        <div className="col-span-2">
                            <p className="text-2xl font-bold text-[#265F44]">74.2 ha/year</p>
                        </div>
                        <div className="col-span-3">
                            <p className="text-[11px] leading-relaxed text-[#5a6b5f]">
                                {siteDetailData.deforestation.text}
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
                <div className="bg-[#c8d2c3] p-4 shadow">
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

                    <div className="mt-4 bg-[#d6decf] rounded-lg p-3">
                        <h4 className="font-semibold text-[#265F44] text-[12px]">Potential Avoided Carbon Emission</h4>
                        <div className="mt-2 grid grid-cols-5 gap-3 items-start">
                            <div className="col-span-2">
                                <p className="text-2xl font-bold text-[#265F44]">
                                    {Number(siteDetailData.carbon_emission.potential_avoided.find(p => p.project_duration === activeTab)?.total_co2eq).toLocaleString()} ton
                                </p>
                                <p className="text-[11px] text-[#5a6b5f]">of Carbon emission can be avoided</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-[10px] leading-relaxed text-[#5a6b5f]">
                                    The Avoided Deforestation project in this area has the potential to avoid 0 tonnes of CO2eq emissions over the 40 years of project duration
                                </p>
                            </div>
                            <div className="col-span-1">
                                <div className="relative h-14 rounded-md overflow-hidden">
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
                    </div>

                    <div className="mt-3 bg-[#d6decf] rounded-lg p-3">
                        <h4 className="font-semibold text-[#265F44] text-[12px]">Carbon accumulation from natural forest regrowth</h4>
                        <div className="mt-2 grid grid-cols-5 gap-3 items-start">
                            <div className="col-span-2">
                                <p className="text-2xl font-bold text-[#265F44]">
                                    {Number(siteDetailData.carbon_emission.potential_sequestered.find(p => p.project_duration === activeTab)?.total_co2eq).toLocaleString()} ton
                                </p>
                                <p className="text-[11px] text-[#5a6b5f]">of CO2eq potentially accumulated</p>
                            </div>
                            <div className="col-span-3">
                                <p className="text-[10px] leading-relaxed text-[#5a6b5f]">
                                    The ecosystem restoration through natural regeneration project in this area could potentially sequester 104,255.92 tonnes of CO2eq during 40 years of project duration.
                                </p>
                            </div>
                        </div>
                        <div className="mt-3 relative h-14 rounded-md overflow-hidden">
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
                <div className="bg-white p-4 rounded-lg shadow mb-4">
                    <HighchartsReact highcharts={Highcharts} options={biodiversityChartOptions('Annual Simpson Diversity Index', siteDetailData.biodiversity_index_analysis.simpson)} />
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                    <HighchartsReact highcharts={Highcharts} options={biodiversityChartOptions('Annual Shannon Diversity Index', siteDetailData.biodiversity_index_analysis.shannon)} />
                </div>
            </Section>
        </div>
    );
}
