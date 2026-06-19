// Country → sub-division mapping for the customer address form.
//
// Drives three things on the address step:
//   1. The "Country" dropdown options (full international list — customers
//      may be tourists, not just UAE residents).
//   2. The "State / Emirate / Province / Region" field LABEL — varies by
//      country per the studio's spec:
//        • UAE   → Emirate
//        • US    → State
//        • Canada → Province
//        • all others → Region
//   3. The sub-division dropdown OPTIONS when we have a canonical list
//      (UAE, US, Canada, Saudi Arabia). For other countries the field
//      falls back to free-text input.
//
// The same mapping ALSO controls which address fields are shown — UAE
// customers skip the City + Postal-code rows per the spec.

export type StateLabel = "Emirate" | "State" | "Province" | "Region";

export interface CountryInfo {
    /** Display name — appears in the Country dropdown verbatim. */
    name: string;
    /** ISO 3166-1 alpha-2 region code — drives the emoji flag rendered
     *  next to the country name in the dropdown (mirrors the phone-code
     *  picker pattern). */
    code: string;
    /** Emoji flag. Pre-computed at module load so SelectInput rendering
     *  doesn't have to derive it from `code` per row. */
    flag: string;
    /** Field label used for the sub-division row. */
    stateLabel: StateLabel;
    /** Pre-defined sub-division options. When undefined, the field
     *  renders as a free-text input. */
    states?: string[];
    /** When true the City + Postal-code rows are HIDDEN — UAE addresses
     *  don't use either. Defaults to true for every other country. */
    showCityPostal?: boolean;
}

// United States — 50 states + DC.
const US_STATES = [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
    "Connecticut", "Delaware", "District of Columbia", "Florida", "Georgia",
    "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
    "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
    "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
    "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota",
    "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island",
    "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
    "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
];

// Canada — 10 provinces + 3 territories.
const CA_PROVINCES = [
    "Alberta", "British Columbia", "Manitoba", "New Brunswick",
    "Newfoundland and Labrador", "Northwest Territories", "Nova Scotia",
    "Nunavut", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan",
    "Yukon",
];

// United Arab Emirates — 7 emirates.
const UAE_EMIRATES = [
    "Abu Dhabi", "Ajman", "Dubai", "Fujairah", "Ras Al Khaimah", "Sharjah",
    "Umm Al Quwain",
];

// Saudi Arabia — 13 administrative regions.
const SA_REGIONS = [
    "Al Bahah", "Al Jawf", "Al Madinah", "Al Qassim", "Aseer", "Eastern Province",
    "Hail", "Jazan", "Mecca", "Najran", "Northern Borders", "Riyadh", "Tabuk",
];

// Comprehensive country list — covers the major markets a Dubai studio is
// most likely to see as visitors / residents. Countries without a curated
// sub-division list fall through to free-text input.
export const COUNTRIES: CountryInfo[] = [
    { name: "United Arab Emirates", code: "AE", flag: "🇦🇪", stateLabel: "Emirate",  states: UAE_EMIRATES, showCityPostal: false },
    { name: "United States",        code: "US", flag: "🇺🇸", stateLabel: "State",    states: US_STATES },
    { name: "Canada",               code: "CA", flag: "🇨🇦", stateLabel: "Province", states: CA_PROVINCES },
    { name: "Saudi Arabia",         code: "SA", flag: "🇸🇦", stateLabel: "Region",   states: SA_REGIONS },
    { name: "Qatar",                code: "QA", flag: "🇶🇦", stateLabel: "Region" },
    { name: "Kuwait",               code: "KW", flag: "🇰🇼", stateLabel: "Region" },
    { name: "Oman",                 code: "OM", flag: "🇴🇲", stateLabel: "Region" },
    { name: "Bahrain",              code: "BH", flag: "🇧🇭", stateLabel: "Region" },
    { name: "Egypt",                code: "EG", flag: "🇪🇬", stateLabel: "Region" },
    { name: "Jordan",               code: "JO", flag: "🇯🇴", stateLabel: "Region" },
    { name: "Lebanon",              code: "LB", flag: "🇱🇧", stateLabel: "Region" },
    { name: "United Kingdom",       code: "GB", flag: "🇬🇧", stateLabel: "Region" },
    { name: "Germany",              code: "DE", flag: "🇩🇪", stateLabel: "Region" },
    { name: "France",               code: "FR", flag: "🇫🇷", stateLabel: "Region" },
    { name: "Spain",                code: "ES", flag: "🇪🇸", stateLabel: "Region" },
    { name: "Italy",                code: "IT", flag: "🇮🇹", stateLabel: "Region" },
    { name: "Netherlands",          code: "NL", flag: "🇳🇱", stateLabel: "Region" },
    { name: "Belgium",              code: "BE", flag: "🇧🇪", stateLabel: "Region" },
    { name: "Switzerland",          code: "CH", flag: "🇨🇭", stateLabel: "Region" },
    { name: "Austria",              code: "AT", flag: "🇦🇹", stateLabel: "Region" },
    { name: "Portugal",             code: "PT", flag: "🇵🇹", stateLabel: "Region" },
    { name: "Sweden",               code: "SE", flag: "🇸🇪", stateLabel: "Region" },
    { name: "Norway",               code: "NO", flag: "🇳🇴", stateLabel: "Region" },
    { name: "Denmark",              code: "DK", flag: "🇩🇰", stateLabel: "Region" },
    { name: "Finland",              code: "FI", flag: "🇫🇮", stateLabel: "Region" },
    { name: "Ireland",              code: "IE", flag: "🇮🇪", stateLabel: "Region" },
    { name: "Poland",               code: "PL", flag: "🇵🇱", stateLabel: "Region" },
    { name: "Russia",               code: "RU", flag: "🇷🇺", stateLabel: "Region" },
    { name: "Turkey",               code: "TR", flag: "🇹🇷", stateLabel: "Region" },
    { name: "Greece",               code: "GR", flag: "🇬🇷", stateLabel: "Region" },
    { name: "Australia",            code: "AU", flag: "🇦🇺", stateLabel: "Region" },
    { name: "New Zealand",          code: "NZ", flag: "🇳🇿", stateLabel: "Region" },
    { name: "India",                code: "IN", flag: "🇮🇳", stateLabel: "State"  },
    { name: "Pakistan",             code: "PK", flag: "🇵🇰", stateLabel: "Region" },
    { name: "Bangladesh",           code: "BD", flag: "🇧🇩", stateLabel: "Region" },
    { name: "Sri Lanka",            code: "LK", flag: "🇱🇰", stateLabel: "Region" },
    { name: "Nepal",                code: "NP", flag: "🇳🇵", stateLabel: "Region" },
    { name: "Indonesia",            code: "ID", flag: "🇮🇩", stateLabel: "Region" },
    { name: "Malaysia",             code: "MY", flag: "🇲🇾", stateLabel: "Region" },
    { name: "Singapore",            code: "SG", flag: "🇸🇬", stateLabel: "Region" },
    { name: "Philippines",          code: "PH", flag: "🇵🇭", stateLabel: "Region" },
    { name: "Thailand",             code: "TH", flag: "🇹🇭", stateLabel: "Region" },
    { name: "Vietnam",              code: "VN", flag: "🇻🇳", stateLabel: "Region" },
    { name: "Japan",                code: "JP", flag: "🇯🇵", stateLabel: "Region" },
    { name: "South Korea",          code: "KR", flag: "🇰🇷", stateLabel: "Region" },
    { name: "China",                code: "CN", flag: "🇨🇳", stateLabel: "Region" },
    { name: "Hong Kong",            code: "HK", flag: "🇭🇰", stateLabel: "Region" },
    { name: "Taiwan",               code: "TW", flag: "🇹🇼", stateLabel: "Region" },
    { name: "South Africa",         code: "ZA", flag: "🇿🇦", stateLabel: "Region" },
    { name: "Nigeria",              code: "NG", flag: "🇳🇬", stateLabel: "Region" },
    { name: "Kenya",                code: "KE", flag: "🇰🇪", stateLabel: "Region" },
    { name: "Ghana",                code: "GH", flag: "🇬🇭", stateLabel: "Region" },
    { name: "Morocco",              code: "MA", flag: "🇲🇦", stateLabel: "Region" },
    { name: "Tunisia",              code: "TN", flag: "🇹🇳", stateLabel: "Region" },
    { name: "Mexico",               code: "MX", flag: "🇲🇽", stateLabel: "Region" },
    { name: "Brazil",               code: "BR", flag: "🇧🇷", stateLabel: "Region" },
    { name: "Argentina",            code: "AR", flag: "🇦🇷", stateLabel: "Region" },
    { name: "Chile",                code: "CL", flag: "🇨🇱", stateLabel: "Region" },
    { name: "Colombia",             code: "CO", flag: "🇨🇴", stateLabel: "Region" },
    { name: "Peru",                 code: "PE", flag: "🇵🇪", stateLabel: "Region" },
];

const COUNTRY_INDEX = new Map<string, CountryInfo>(COUNTRIES.map(c => [c.name, c]));

/** Look up a country's metadata. Returns a generic "Region" + free-text
 *  fallback when the country isn't in our list (so the form never breaks
 *  if a legacy customer record carries an unknown country string). */
export function getCountryInfo(country: string): CountryInfo {
    return COUNTRY_INDEX.get(country) ?? {
        name: country, code: "", flag: "🌐", stateLabel: "Region",
    };
}
