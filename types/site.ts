// Shared type for site detail data
export interface BiodiversityIndexData {
    year: number;
    value: number;
}

export interface CarbonEmissionData {
    project_duration: number;
    total_co2eq: number;
}

export interface SiteDetailData {
    country: string;
    ahp_name: string;
    area_ha: number;
    class_description: string;
    deforestation: {
        annual: string;
        change: string;
        graph_data: number[];
        pct: number;
        text: string;
    };
    carbon_emission: {
        potential_avoided: CarbonEmissionData[];
        potential_sequestered: CarbonEmissionData[];
    };
    biodiversity_index_analysis: {
        simpson: BiodiversityIndexData[];
        shannon: BiodiversityIndexData[];
    };
}