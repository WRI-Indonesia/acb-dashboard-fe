// Shared type for site detail data
export interface BiodiversityIndexData {
    year: number;
    value: number;
}

export interface CarbonEmissionData {
    project_duration: number;
    total_co2eq: number;
}

export interface DeforestationData {
    annual: string;
    change: string;
    graph_data: number[];
    pct: number;
    text: string;
}

export interface CarbonEmissionBlock {
    potential_avoided: CarbonEmissionData[];
    potential_sequestered: CarbonEmissionData[];
}

export interface BiodiversityIndexAnalysis {
    simpson: BiodiversityIndexData[];
    shannon: BiodiversityIndexData[];
}

export interface SiteDetailData {
    country: string | null;
    ahp_name: string | null;
    area_ha: number | null;
    class_description: string | null;
    deforestation: DeforestationData | null;
    carbon_emission: CarbonEmissionBlock | null;
    biodiversity_index_analysis: BiodiversityIndexAnalysis | null;
}