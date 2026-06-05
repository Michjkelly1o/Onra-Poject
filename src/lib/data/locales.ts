// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Locale data
// ─────────────────────────────────────────────────────────────────────────────
//
// Curated lists of countries, cities, currencies, and IANA timezones used by
// the Business & Locations module's Studio profile + Branch creation forms.
//
// Trade-off — full ISO-3166 country list + per-country city sets would weigh
// hundreds of KB. The studio prototype is a small Middle East / SE Asia
// focused app, so we ship the regions our target studios actually operate
// in plus the major Western markets, with a curated city set per country.

export interface Country {
    code: string;
    name: string;
    flag: string;
    /** Suggested currency code — the studio profile auto-fills `Currency` to
     *  this when the country changes (but the user can still override). */
    defaultCurrency: string;
    /** Default IANA timezone — same auto-fill behaviour for the Time zone
     *  field on the studio profile. */
    defaultTimezone: string;
}

export const COUNTRIES: Country[] = [
    { code: "AE", name: "United Arab Emirates", flag: "🇦🇪", defaultCurrency: "AED", defaultTimezone: "Asia/Dubai" },
    { code: "SA", name: "Saudi Arabia",         flag: "🇸🇦", defaultCurrency: "SAR", defaultTimezone: "Asia/Riyadh" },
    { code: "QA", name: "Qatar",                flag: "🇶🇦", defaultCurrency: "QAR", defaultTimezone: "Asia/Qatar" },
    { code: "KW", name: "Kuwait",               flag: "🇰🇼", defaultCurrency: "KWD", defaultTimezone: "Asia/Kuwait" },
    { code: "OM", name: "Oman",                 flag: "🇴🇲", defaultCurrency: "OMR", defaultTimezone: "Asia/Muscat" },
    { code: "BH", name: "Bahrain",              flag: "🇧🇭", defaultCurrency: "BHD", defaultTimezone: "Asia/Bahrain" },
    { code: "JO", name: "Jordan",               flag: "🇯🇴", defaultCurrency: "JOD", defaultTimezone: "Asia/Amman" },
    { code: "LB", name: "Lebanon",              flag: "🇱🇧", defaultCurrency: "LBP", defaultTimezone: "Asia/Beirut" },
    { code: "EG", name: "Egypt",                flag: "🇪🇬", defaultCurrency: "EGP", defaultTimezone: "Africa/Cairo" },
    { code: "TR", name: "Turkey",               flag: "🇹🇷", defaultCurrency: "TRY", defaultTimezone: "Europe/Istanbul" },
    { code: "ID", name: "Indonesia",            flag: "🇮🇩", defaultCurrency: "IDR", defaultTimezone: "Asia/Jakarta" },
    { code: "MY", name: "Malaysia",             flag: "🇲🇾", defaultCurrency: "MYR", defaultTimezone: "Asia/Kuala_Lumpur" },
    { code: "SG", name: "Singapore",            flag: "🇸🇬", defaultCurrency: "SGD", defaultTimezone: "Asia/Singapore" },
    { code: "TH", name: "Thailand",             flag: "🇹🇭", defaultCurrency: "THB", defaultTimezone: "Asia/Bangkok" },
    { code: "PH", name: "Philippines",          flag: "🇵🇭", defaultCurrency: "PHP", defaultTimezone: "Asia/Manila" },
    { code: "VN", name: "Vietnam",              flag: "🇻🇳", defaultCurrency: "VND", defaultTimezone: "Asia/Ho_Chi_Minh" },
    { code: "JP", name: "Japan",                flag: "🇯🇵", defaultCurrency: "JPY", defaultTimezone: "Asia/Tokyo" },
    { code: "KR", name: "South Korea",          flag: "🇰🇷", defaultCurrency: "KRW", defaultTimezone: "Asia/Seoul" },
    { code: "CN", name: "China",                flag: "🇨🇳", defaultCurrency: "CNY", defaultTimezone: "Asia/Shanghai" },
    { code: "IN", name: "India",                flag: "🇮🇳", defaultCurrency: "INR", defaultTimezone: "Asia/Kolkata" },
    { code: "PK", name: "Pakistan",             flag: "🇵🇰", defaultCurrency: "PKR", defaultTimezone: "Asia/Karachi" },
    { code: "AU", name: "Australia",            flag: "🇦🇺", defaultCurrency: "AUD", defaultTimezone: "Australia/Sydney" },
    { code: "NZ", name: "New Zealand",          flag: "🇳🇿", defaultCurrency: "NZD", defaultTimezone: "Pacific/Auckland" },
    { code: "GB", name: "United Kingdom",       flag: "🇬🇧", defaultCurrency: "GBP", defaultTimezone: "Europe/London" },
    { code: "IE", name: "Ireland",              flag: "🇮🇪", defaultCurrency: "EUR", defaultTimezone: "Europe/Dublin" },
    { code: "FR", name: "France",               flag: "🇫🇷", defaultCurrency: "EUR", defaultTimezone: "Europe/Paris" },
    { code: "DE", name: "Germany",              flag: "🇩🇪", defaultCurrency: "EUR", defaultTimezone: "Europe/Berlin" },
    { code: "ES", name: "Spain",                flag: "🇪🇸", defaultCurrency: "EUR", defaultTimezone: "Europe/Madrid" },
    { code: "IT", name: "Italy",                flag: "🇮🇹", defaultCurrency: "EUR", defaultTimezone: "Europe/Rome" },
    { code: "NL", name: "Netherlands",          flag: "🇳🇱", defaultCurrency: "EUR", defaultTimezone: "Europe/Amsterdam" },
    { code: "BE", name: "Belgium",              flag: "🇧🇪", defaultCurrency: "EUR", defaultTimezone: "Europe/Brussels" },
    { code: "PT", name: "Portugal",             flag: "🇵🇹", defaultCurrency: "EUR", defaultTimezone: "Europe/Lisbon" },
    { code: "GR", name: "Greece",               flag: "🇬🇷", defaultCurrency: "EUR", defaultTimezone: "Europe/Athens" },
    { code: "CH", name: "Switzerland",          flag: "🇨🇭", defaultCurrency: "CHF", defaultTimezone: "Europe/Zurich" },
    { code: "AT", name: "Austria",              flag: "🇦🇹", defaultCurrency: "EUR", defaultTimezone: "Europe/Vienna" },
    { code: "SE", name: "Sweden",               flag: "🇸🇪", defaultCurrency: "SEK", defaultTimezone: "Europe/Stockholm" },
    { code: "NO", name: "Norway",               flag: "🇳🇴", defaultCurrency: "NOK", defaultTimezone: "Europe/Oslo" },
    { code: "DK", name: "Denmark",              flag: "🇩🇰", defaultCurrency: "DKK", defaultTimezone: "Europe/Copenhagen" },
    { code: "FI", name: "Finland",              flag: "🇫🇮", defaultCurrency: "EUR", defaultTimezone: "Europe/Helsinki" },
    { code: "PL", name: "Poland",               flag: "🇵🇱", defaultCurrency: "PLN", defaultTimezone: "Europe/Warsaw" },
    { code: "ZA", name: "South Africa",         flag: "🇿🇦", defaultCurrency: "ZAR", defaultTimezone: "Africa/Johannesburg" },
    { code: "NG", name: "Nigeria",              flag: "🇳🇬", defaultCurrency: "NGN", defaultTimezone: "Africa/Lagos" },
    { code: "KE", name: "Kenya",                flag: "🇰🇪", defaultCurrency: "KES", defaultTimezone: "Africa/Nairobi" },
    { code: "MA", name: "Morocco",              flag: "🇲🇦", defaultCurrency: "MAD", defaultTimezone: "Africa/Casablanca" },
    { code: "US", name: "United States",        flag: "🇺🇸", defaultCurrency: "USD", defaultTimezone: "America/New_York" },
    { code: "CA", name: "Canada",               flag: "🇨🇦", defaultCurrency: "CAD", defaultTimezone: "America/Toronto" },
    { code: "MX", name: "Mexico",               flag: "🇲🇽", defaultCurrency: "MXN", defaultTimezone: "America/Mexico_City" },
    { code: "BR", name: "Brazil",               flag: "🇧🇷", defaultCurrency: "BRL", defaultTimezone: "America/Sao_Paulo" },
    { code: "AR", name: "Argentina",            flag: "🇦🇷", defaultCurrency: "ARS", defaultTimezone: "America/Argentina/Buenos_Aires" },
    { code: "CL", name: "Chile",                flag: "🇨🇱", defaultCurrency: "CLP", defaultTimezone: "America/Santiago" },
    { code: "CO", name: "Colombia",             flag: "🇨🇴", defaultCurrency: "COP", defaultTimezone: "America/Bogota" },
];

/** Cities per country. Falls back to `[]` when the country has no curated
 *  list — the form just shows an empty dropdown the user can override later
 *  via free-text once Phase 4 wires real geocoding. */
export const CITIES_BY_COUNTRY: Record<string, string[]> = {
    AE: ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain", "Al Ain"],
    SA: ["Riyadh", "Jeddah", "Mecca", "Medina", "Dammam", "Khobar", "Taif", "Tabuk"],
    QA: ["Doha", "Al Wakrah", "Al Khor", "Lusail", "Al Rayyan"],
    KW: ["Kuwait City", "Hawalli", "Salmiya", "Jahra", "Farwaniya"],
    OM: ["Muscat", "Salalah", "Nizwa", "Sohar", "Sur"],
    BH: ["Manama", "Riffa", "Muharraq", "Hamad Town", "A'ali"],
    JO: ["Amman", "Zarqa", "Irbid", "Aqaba", "Madaba"],
    LB: ["Beirut", "Tripoli", "Sidon", "Tyre", "Byblos"],
    EG: ["Cairo", "Alexandria", "Giza", "Sharm El Sheikh", "Hurghada"],
    TR: ["Istanbul", "Ankara", "Izmir", "Antalya", "Bursa"],
    ID: ["Jakarta", "Surabaya", "Bandung", "Medan", "Bali (Denpasar)", "Yogyakarta", "Semarang"],
    MY: ["Kuala Lumpur", "Penang", "Johor Bahru", "Ipoh", "Kota Kinabalu"],
    SG: ["Singapore"],
    TH: ["Bangkok", "Chiang Mai", "Phuket", "Pattaya", "Krabi"],
    PH: ["Manila", "Cebu", "Davao", "Quezon City", "Makati"],
    VN: ["Ho Chi Minh City", "Hanoi", "Da Nang", "Hai Phong"],
    JP: ["Tokyo", "Osaka", "Yokohama", "Kyoto", "Sapporo", "Fukuoka"],
    KR: ["Seoul", "Busan", "Incheon", "Daegu", "Daejeon"],
    CN: ["Beijing", "Shanghai", "Shenzhen", "Guangzhou", "Hong Kong"],
    IN: ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Pune"],
    PK: ["Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad"],
    AU: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Gold Coast"],
    NZ: ["Auckland", "Wellington", "Christchurch", "Queenstown"],
    GB: ["London", "Manchester", "Birmingham", "Edinburgh", "Glasgow", "Liverpool"],
    IE: ["Dublin", "Cork", "Galway", "Limerick"],
    FR: ["Paris", "Lyon", "Marseille", "Toulouse", "Nice", "Bordeaux"],
    DE: ["Berlin", "Munich", "Hamburg", "Frankfurt", "Cologne", "Stuttgart"],
    ES: ["Madrid", "Barcelona", "Valencia", "Seville", "Bilbao", "Málaga"],
    IT: ["Rome", "Milan", "Naples", "Florence", "Venice", "Turin"],
    NL: ["Amsterdam", "Rotterdam", "The Hague", "Utrecht"],
    BE: ["Brussels", "Antwerp", "Ghent", "Bruges"],
    PT: ["Lisbon", "Porto", "Faro", "Coimbra"],
    GR: ["Athens", "Thessaloniki", "Patras", "Heraklion"],
    CH: ["Zurich", "Geneva", "Basel", "Bern", "Lausanne"],
    AT: ["Vienna", "Salzburg", "Graz", "Innsbruck"],
    SE: ["Stockholm", "Gothenburg", "Malmö", "Uppsala"],
    NO: ["Oslo", "Bergen", "Stavanger", "Trondheim"],
    DK: ["Copenhagen", "Aarhus", "Odense", "Aalborg"],
    FI: ["Helsinki", "Tampere", "Turku", "Oulu"],
    PL: ["Warsaw", "Krakow", "Wrocław", "Poznań", "Gdańsk"],
    ZA: ["Johannesburg", "Cape Town", "Durban", "Pretoria"],
    NG: ["Lagos", "Abuja", "Kano", "Ibadan"],
    KE: ["Nairobi", "Mombasa", "Kisumu", "Nakuru"],
    MA: ["Casablanca", "Marrakech", "Fez", "Rabat", "Tangier"],
    US: ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego", "Dallas", "San Francisco"],
    CA: ["Toronto", "Montreal", "Vancouver", "Calgary", "Ottawa", "Edmonton"],
    MX: ["Mexico City", "Guadalajara", "Monterrey", "Puebla", "Tijuana"],
    BR: ["São Paulo", "Rio de Janeiro", "Brasília", "Salvador", "Belo Horizonte"],
    AR: ["Buenos Aires", "Córdoba", "Rosario", "Mendoza"],
    CL: ["Santiago", "Valparaíso", "Concepción"],
    CO: ["Bogotá", "Medellín", "Cali", "Cartagena"],
};

export interface CurrencyOption {
    code: string;
    label: string;  // "AED — UAE Dirham"
    symbol: string;
}

export const CURRENCIES: CurrencyOption[] = [
    { code: "AED", symbol: "AED",  label: "AED — UAE Dirham" },
    { code: "SAR", symbol: "SR",   label: "SAR — Saudi Riyal" },
    { code: "QAR", symbol: "QR",   label: "QAR — Qatari Riyal" },
    { code: "KWD", symbol: "KD",   label: "KWD — Kuwaiti Dinar" },
    { code: "OMR", symbol: "OMR",  label: "OMR — Omani Rial" },
    { code: "BHD", symbol: "BD",   label: "BHD — Bahraini Dinar" },
    { code: "JOD", symbol: "JD",   label: "JOD — Jordanian Dinar" },
    { code: "LBP", symbol: "LL",   label: "LBP — Lebanese Pound" },
    { code: "EGP", symbol: "EGP",  label: "EGP — Egyptian Pound" },
    { code: "TRY", symbol: "₺",    label: "TRY — Turkish Lira" },
    { code: "IDR", symbol: "Rp",   label: "IDR — Indonesian Rupiah" },
    { code: "MYR", symbol: "RM",   label: "MYR — Malaysian Ringgit" },
    { code: "SGD", symbol: "S$",   label: "SGD — Singapore Dollar" },
    { code: "THB", symbol: "฿",    label: "THB — Thai Baht" },
    { code: "PHP", symbol: "₱",    label: "PHP — Philippine Peso" },
    { code: "VND", symbol: "₫",    label: "VND — Vietnamese Dong" },
    { code: "JPY", symbol: "¥",    label: "JPY — Japanese Yen" },
    { code: "KRW", symbol: "₩",    label: "KRW — South Korean Won" },
    { code: "CNY", symbol: "¥",    label: "CNY — Chinese Yuan" },
    { code: "INR", symbol: "₹",    label: "INR — Indian Rupee" },
    { code: "PKR", symbol: "Rs",   label: "PKR — Pakistani Rupee" },
    { code: "AUD", symbol: "A$",   label: "AUD — Australian Dollar" },
    { code: "NZD", symbol: "NZ$",  label: "NZD — New Zealand Dollar" },
    { code: "GBP", symbol: "£",    label: "GBP — Pound Sterling" },
    { code: "EUR", symbol: "€",    label: "EUR — Euro" },
    { code: "CHF", symbol: "CHF",  label: "CHF — Swiss Franc" },
    { code: "SEK", symbol: "kr",   label: "SEK — Swedish Krona" },
    { code: "NOK", symbol: "kr",   label: "NOK — Norwegian Krone" },
    { code: "DKK", symbol: "kr",   label: "DKK — Danish Krone" },
    { code: "PLN", symbol: "zł",   label: "PLN — Polish Złoty" },
    { code: "ZAR", symbol: "R",    label: "ZAR — South African Rand" },
    { code: "NGN", symbol: "₦",    label: "NGN — Nigerian Naira" },
    { code: "KES", symbol: "KSh",  label: "KES — Kenyan Shilling" },
    { code: "MAD", symbol: "MAD",  label: "MAD — Moroccan Dirham" },
    { code: "USD", symbol: "$",    label: "USD — US Dollar" },
    { code: "CAD", symbol: "C$",   label: "CAD — Canadian Dollar" },
    { code: "MXN", symbol: "$",    label: "MXN — Mexican Peso" },
    { code: "BRL", symbol: "R$",   label: "BRL — Brazilian Real" },
    { code: "ARS", symbol: "$",    label: "ARS — Argentine Peso" },
    { code: "CLP", symbol: "$",    label: "CLP — Chilean Peso" },
    { code: "COP", symbol: "$",    label: "COP — Colombian Peso" },
];

export interface TimezoneOption {
    iana: string;
    label: string;          // "(UTC+04:00) Abu Dhabi"
    /** UTC offset in minutes — kept here so views can format dates in the
     *  chosen zone without re-parsing the label. */
    offsetMinutes: number;
}

export const TIMEZONES: TimezoneOption[] = [
    { iana: "Pacific/Midway",                 label: "(UTC-11:00) Midway Island",        offsetMinutes:  -11 * 60 },
    { iana: "Pacific/Honolulu",               label: "(UTC-10:00) Honolulu",             offsetMinutes:  -10 * 60 },
    { iana: "America/Anchorage",              label: "(UTC-09:00) Anchorage",            offsetMinutes:  -9  * 60 },
    { iana: "America/Los_Angeles",            label: "(UTC-08:00) Los Angeles",          offsetMinutes:  -8  * 60 },
    { iana: "America/Denver",                 label: "(UTC-07:00) Denver",               offsetMinutes:  -7  * 60 },
    { iana: "America/Chicago",                label: "(UTC-06:00) Chicago",              offsetMinutes:  -6  * 60 },
    { iana: "America/Mexico_City",            label: "(UTC-06:00) Mexico City",          offsetMinutes:  -6  * 60 },
    { iana: "America/New_York",               label: "(UTC-05:00) New York",             offsetMinutes:  -5  * 60 },
    { iana: "America/Toronto",                label: "(UTC-05:00) Toronto",              offsetMinutes:  -5  * 60 },
    { iana: "America/Bogota",                 label: "(UTC-05:00) Bogotá",               offsetMinutes:  -5  * 60 },
    { iana: "America/Santiago",               label: "(UTC-04:00) Santiago",             offsetMinutes:  -4  * 60 },
    { iana: "America/Sao_Paulo",              label: "(UTC-03:00) São Paulo",            offsetMinutes:  -3  * 60 },
    { iana: "America/Argentina/Buenos_Aires", label: "(UTC-03:00) Buenos Aires",         offsetMinutes:  -3  * 60 },
    { iana: "Atlantic/Azores",                label: "(UTC-01:00) Azores",               offsetMinutes:  -1  * 60 },
    { iana: "Europe/London",                  label: "(UTC+00:00) London",               offsetMinutes:   0       },
    { iana: "Europe/Dublin",                  label: "(UTC+00:00) Dublin",               offsetMinutes:   0       },
    { iana: "Africa/Casablanca",              label: "(UTC+01:00) Casablanca",           offsetMinutes:   1  * 60 },
    { iana: "Europe/Paris",                   label: "(UTC+01:00) Paris",                offsetMinutes:   1  * 60 },
    { iana: "Europe/Berlin",                  label: "(UTC+01:00) Berlin",               offsetMinutes:   1  * 60 },
    { iana: "Europe/Madrid",                  label: "(UTC+01:00) Madrid",               offsetMinutes:   1  * 60 },
    { iana: "Europe/Rome",                    label: "(UTC+01:00) Rome",                 offsetMinutes:   1  * 60 },
    { iana: "Europe/Amsterdam",               label: "(UTC+01:00) Amsterdam",            offsetMinutes:   1  * 60 },
    { iana: "Europe/Stockholm",               label: "(UTC+01:00) Stockholm",            offsetMinutes:   1  * 60 },
    { iana: "Europe/Athens",                  label: "(UTC+02:00) Athens",               offsetMinutes:   2  * 60 },
    { iana: "Europe/Helsinki",                label: "(UTC+02:00) Helsinki",             offsetMinutes:   2  * 60 },
    { iana: "Africa/Cairo",                   label: "(UTC+02:00) Cairo",                offsetMinutes:   2  * 60 },
    { iana: "Africa/Johannesburg",            label: "(UTC+02:00) Johannesburg",         offsetMinutes:   2  * 60 },
    { iana: "Europe/Istanbul",                label: "(UTC+03:00) Istanbul",             offsetMinutes:   3  * 60 },
    { iana: "Europe/Moscow",                  label: "(UTC+03:00) Moscow",               offsetMinutes:   3  * 60 },
    { iana: "Asia/Riyadh",                    label: "(UTC+03:00) Riyadh",               offsetMinutes:   3  * 60 },
    { iana: "Asia/Qatar",                     label: "(UTC+03:00) Doha",                 offsetMinutes:   3  * 60 },
    { iana: "Asia/Kuwait",                    label: "(UTC+03:00) Kuwait",               offsetMinutes:   3  * 60 },
    { iana: "Asia/Bahrain",                   label: "(UTC+03:00) Bahrain",              offsetMinutes:   3  * 60 },
    { iana: "Asia/Beirut",                    label: "(UTC+03:00) Beirut",               offsetMinutes:   3  * 60 },
    { iana: "Asia/Amman",                     label: "(UTC+03:00) Amman",                offsetMinutes:   3  * 60 },
    { iana: "Africa/Nairobi",                 label: "(UTC+03:00) Nairobi",              offsetMinutes:   3  * 60 },
    { iana: "Asia/Dubai",                     label: "(UTC+04:00) Abu Dhabi",            offsetMinutes:   4  * 60 },
    { iana: "Asia/Muscat",                    label: "(UTC+04:00) Muscat",               offsetMinutes:   4  * 60 },
    { iana: "Asia/Tehran",                    label: "(UTC+03:30) Tehran",               offsetMinutes:   3  * 60 + 30 },
    { iana: "Asia/Karachi",                   label: "(UTC+05:00) Karachi",              offsetMinutes:   5  * 60 },
    { iana: "Asia/Kolkata",                   label: "(UTC+05:30) Kolkata",              offsetMinutes:   5  * 60 + 30 },
    { iana: "Asia/Dhaka",                     label: "(UTC+06:00) Dhaka",                offsetMinutes:   6  * 60 },
    { iana: "Asia/Bangkok",                   label: "(UTC+07:00) Bangkok",              offsetMinutes:   7  * 60 },
    { iana: "Asia/Jakarta",                   label: "(UTC+07:00) Jakarta",              offsetMinutes:   7  * 60 },
    { iana: "Asia/Ho_Chi_Minh",               label: "(UTC+07:00) Ho Chi Minh City",     offsetMinutes:   7  * 60 },
    { iana: "Asia/Shanghai",                  label: "(UTC+08:00) Shanghai",             offsetMinutes:   8  * 60 },
    { iana: "Asia/Hong_Kong",                 label: "(UTC+08:00) Hong Kong",            offsetMinutes:   8  * 60 },
    { iana: "Asia/Singapore",                 label: "(UTC+08:00) Singapore",            offsetMinutes:   8  * 60 },
    { iana: "Asia/Kuala_Lumpur",              label: "(UTC+08:00) Kuala Lumpur",         offsetMinutes:   8  * 60 },
    { iana: "Asia/Manila",                    label: "(UTC+08:00) Manila",               offsetMinutes:   8  * 60 },
    { iana: "Asia/Tokyo",                     label: "(UTC+09:00) Tokyo",                offsetMinutes:   9  * 60 },
    { iana: "Asia/Seoul",                     label: "(UTC+09:00) Seoul",                offsetMinutes:   9  * 60 },
    { iana: "Australia/Sydney",               label: "(UTC+10:00) Sydney",               offsetMinutes:  10  * 60 },
    { iana: "Australia/Melbourne",            label: "(UTC+10:00) Melbourne",            offsetMinutes:  10  * 60 },
    { iana: "Australia/Brisbane",             label: "(UTC+10:00) Brisbane",             offsetMinutes:  10  * 60 },
    { iana: "Pacific/Auckland",               label: "(UTC+12:00) Auckland",             offsetMinutes:  12  * 60 },
];

export function countryByName(name: string): Country | undefined {
    return COUNTRIES.find(c => c.name === name);
}

export function timezoneLabel(iana: string): string {
    return TIMEZONES.find(t => t.iana === iana)?.label ?? iana;
}
