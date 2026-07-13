// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Locale data (Jul 2026 — 3-tier country/state/city)
// ─────────────────────────────────────────────────────────────────────────────
//
// Curated country / subdivision / city dataset used by every location-capturing
// form (Branch, Customer / POS, Studio profile). Trade-off vs shipping a full
// ISO country-state-city library (~1.2 MB gzipped): this file is ~40 KB
// gzipped, ships instantly on Vercel, and covers 99% of realistic studio
// operating regions with accurate per-state timezone resolution.
//
// Structure:
//   COUNTRIES  → each has flag, currency, default TZ, an adaptive "state label"
//                (Emirate / Province / State / Region / Governorate / …), and
//                a list of STATES.
//   State      → has its OWN IANA timezone (this is the key insight — countries
//                like Indonesia, US, Canada, AU, RU, BR, MX span multiple zones,
//                so state is the primary TZ signal) + a list of major cities.
//
// Resolvers:
//   `resolveBranchTimezone(country?, state?, city?)` — state wins, city as
//   fallback (looked up across every state), country default last.
//   `statesForCountry(name)` — populate the State dropdown.
//   `citiesForState(country, state)` — populate the City dropdown.
//   `stateLabelForCountry(name)` — the adaptive label for the middle field.

export interface State {
    /** Short code — usually the ISO 3166-2 subdivision code (e.g. "DU" for
     *  Dubai, "JI" for East Java, "CA" for California). Used as a stable key
     *  when we index cities by state. */
    code: string;
    /** English display name (e.g. "Dubai", "East Java", "California"). */
    name: string;
    /** IANA timezone for this state (e.g. "Asia/Dubai", "Asia/Jakarta"). */
    timezone: string;
    /** Major cities in this state — top 5–15 per state so the dropdown stays
     *  navigable without needing search + virtualization. */
    cities: string[];
}

export interface Country {
    code: string;
    name: string;
    flag: string;
    /** Suggested currency code — auto-fills the Currency field on studio
     *  profile when country changes. */
    defaultCurrency: string;
    /** Default IANA timezone — fallback when no state is picked yet. For
     *  multi-TZ countries this is the "capital" zone. */
    defaultTimezone: string;
    /** Adaptive label for the middle dropdown — what THIS country calls its
     *  first-level subdivision. Renders as the Field label on the form
     *  ("Emirate" for UAE, "Province" for Indonesia, "State" for US, etc.).
     *  Undefined = country has no meaningful subdivision (e.g. Singapore,
     *  Vatican) → the State field is hidden and cities are picked directly
     *  under Country. */
    stateLabel?: string;
    /** Ordered list of states/regions/emirates. Empty for city-states. */
    states: State[];
}

// ─── Countries ───────────────────────────────────────────────────────────────

export const COUNTRIES: Country[] = [
    // ── GCC ──
    {
        code: "AE", name: "United Arab Emirates", flag: "🇦🇪",
        defaultCurrency: "AED", defaultTimezone: "Asia/Dubai",
        stateLabel: "Emirate",
        states: [
            { code: "DU", name: "Dubai",           timezone: "Asia/Dubai", cities: ["Dubai", "Dubai Marina", "Jumeirah", "Deira", "Bur Dubai", "Business Bay", "Downtown Dubai", "Jumeirah Village Circle"] },
            { code: "AZ", name: "Abu Dhabi",       timezone: "Asia/Dubai", cities: ["Abu Dhabi", "Al Ain", "Al Reem Island", "Yas Island", "Saadiyat Island"] },
            { code: "SH", name: "Sharjah",         timezone: "Asia/Dubai", cities: ["Sharjah", "Al Nahda", "Al Majaz", "Al Khan"] },
            { code: "AJ", name: "Ajman",           timezone: "Asia/Dubai", cities: ["Ajman", "Al Nuaimiya", "Al Rashidiya"] },
            { code: "RK", name: "Ras Al Khaimah",  timezone: "Asia/Dubai", cities: ["Ras Al Khaimah", "Al Marjan Island", "Al Hamra"] },
            { code: "FU", name: "Fujairah",        timezone: "Asia/Dubai", cities: ["Fujairah", "Dibba"] },
            { code: "UQ", name: "Umm Al Quwain",   timezone: "Asia/Dubai", cities: ["Umm Al Quwain"] },
        ],
    },
    {
        code: "SA", name: "Saudi Arabia", flag: "🇸🇦",
        defaultCurrency: "SAR", defaultTimezone: "Asia/Riyadh",
        stateLabel: "Region",
        states: [
            { code: "01", name: "Riyadh",         timezone: "Asia/Riyadh", cities: ["Riyadh", "Diriyah", "Al Kharj"] },
            { code: "02", name: "Makkah",         timezone: "Asia/Riyadh", cities: ["Jeddah", "Mecca", "Taif", "Rabigh"] },
            { code: "03", name: "Madinah",        timezone: "Asia/Riyadh", cities: ["Medina", "Yanbu", "Al Ula"] },
            { code: "04", name: "Eastern",        timezone: "Asia/Riyadh", cities: ["Dammam", "Khobar", "Dhahran", "Jubail", "Qatif", "Hofuf"] },
            { code: "05", name: "Asir",           timezone: "Asia/Riyadh", cities: ["Abha", "Khamis Mushait", "Bisha"] },
            { code: "06", name: "Tabuk",          timezone: "Asia/Riyadh", cities: ["Tabuk", "NEOM"] },
            { code: "07", name: "Hail",           timezone: "Asia/Riyadh", cities: ["Hail"] },
            { code: "08", name: "Northern Borders", timezone: "Asia/Riyadh", cities: ["Arar"] },
            { code: "09", name: "Jazan",          timezone: "Asia/Riyadh", cities: ["Jazan"] },
            { code: "10", name: "Najran",         timezone: "Asia/Riyadh", cities: ["Najran"] },
            { code: "11", name: "Al Baha",        timezone: "Asia/Riyadh", cities: ["Al Baha"] },
            { code: "12", name: "Al Jouf",        timezone: "Asia/Riyadh", cities: ["Sakaka"] },
            { code: "13", name: "Al Qassim",      timezone: "Asia/Riyadh", cities: ["Buraidah", "Unaizah"] },
        ],
    },
    {
        code: "QA", name: "Qatar", flag: "🇶🇦",
        defaultCurrency: "QAR", defaultTimezone: "Asia/Qatar",
        stateLabel: "Municipality",
        states: [
            { code: "DA", name: "Doha",           timezone: "Asia/Qatar", cities: ["Doha", "West Bay", "The Pearl", "Msheireb"] },
            { code: "WA", name: "Al Wakrah",      timezone: "Asia/Qatar", cities: ["Al Wakrah"] },
            { code: "RA", name: "Al Rayyan",      timezone: "Asia/Qatar", cities: ["Al Rayyan", "Education City", "Lusail"] },
            { code: "KH", name: "Al Khor",        timezone: "Asia/Qatar", cities: ["Al Khor"] },
            { code: "DR", name: "Al Daayen",      timezone: "Asia/Qatar", cities: ["Al Daayen"] },
        ],
    },
    {
        code: "KW", name: "Kuwait", flag: "🇰🇼",
        defaultCurrency: "KWD", defaultTimezone: "Asia/Kuwait",
        stateLabel: "Governorate",
        states: [
            { code: "KU", name: "Al Asimah",      timezone: "Asia/Kuwait", cities: ["Kuwait City", "Sharq", "Salmiya"] },
            { code: "HA", name: "Hawalli",        timezone: "Asia/Kuwait", cities: ["Hawalli", "Salmiya", "Jabriya"] },
            { code: "FA", name: "Al Farwaniyah",  timezone: "Asia/Kuwait", cities: ["Farwaniya", "Ardiya"] },
            { code: "AH", name: "Al Ahmadi",      timezone: "Asia/Kuwait", cities: ["Ahmadi", "Fahaheel", "Mangaf"] },
            { code: "MU", name: "Mubarak Al-Kabeer", timezone: "Asia/Kuwait", cities: ["Sabah Al Salem", "Mubarak Al-Kabeer"] },
            { code: "JA", name: "Al Jahra",       timezone: "Asia/Kuwait", cities: ["Jahra"] },
        ],
    },
    {
        code: "OM", name: "Oman", flag: "🇴🇲",
        defaultCurrency: "OMR", defaultTimezone: "Asia/Muscat",
        stateLabel: "Governorate",
        states: [
            { code: "MU", name: "Muscat",         timezone: "Asia/Muscat", cities: ["Muscat", "Muttrah", "Seeb", "Bawshar"] },
            { code: "DA", name: "Dhofar",         timezone: "Asia/Muscat", cities: ["Salalah"] },
            { code: "BS", name: "Al Batinah North", timezone: "Asia/Muscat", cities: ["Sohar"] },
            { code: "SH", name: "Ash Sharqiyah North", timezone: "Asia/Muscat", cities: ["Sur", "Ibra"] },
            { code: "DK", name: "Ad Dakhiliyah", timezone: "Asia/Muscat", cities: ["Nizwa", "Bahla"] },
        ],
    },
    {
        code: "BH", name: "Bahrain", flag: "🇧🇭",
        defaultCurrency: "BHD", defaultTimezone: "Asia/Bahrain",
        stateLabel: "Governorate",
        states: [
            { code: "13", name: "Capital",        timezone: "Asia/Bahrain", cities: ["Manama", "Adliya", "Juffair"] },
            { code: "14", name: "Southern",       timezone: "Asia/Bahrain", cities: ["Riffa", "Isa Town", "Hamad Town"] },
            { code: "15", name: "Muharraq",       timezone: "Asia/Bahrain", cities: ["Muharraq", "Amwaj Islands"] },
            { code: "16", name: "Northern",       timezone: "Asia/Bahrain", cities: ["Al Budaiya", "Bani Jamra"] },
        ],
    },
    // ── Levant + Egypt + Turkey ──
    {
        code: "JO", name: "Jordan", flag: "🇯🇴",
        defaultCurrency: "JOD", defaultTimezone: "Asia/Amman",
        stateLabel: "Governorate",
        states: [
            { code: "AM", name: "Amman",          timezone: "Asia/Amman", cities: ["Amman", "Sweifieh", "Abdoun"] },
            { code: "ZA", name: "Zarqa",          timezone: "Asia/Amman", cities: ["Zarqa"] },
            { code: "IR", name: "Irbid",          timezone: "Asia/Amman", cities: ["Irbid"] },
            { code: "AQ", name: "Aqaba",          timezone: "Asia/Amman", cities: ["Aqaba"] },
            { code: "MA", name: "Madaba",         timezone: "Asia/Amman", cities: ["Madaba"] },
        ],
    },
    {
        code: "LB", name: "Lebanon", flag: "🇱🇧",
        defaultCurrency: "LBP", defaultTimezone: "Asia/Beirut",
        stateLabel: "Governorate",
        states: [
            { code: "BA", name: "Beirut",         timezone: "Asia/Beirut", cities: ["Beirut", "Hamra", "Achrafieh"] },
            { code: "MJ", name: "Mount Lebanon",  timezone: "Asia/Beirut", cities: ["Jounieh", "Baabda", "Aley"] },
            { code: "AS", name: "North",          timezone: "Asia/Beirut", cities: ["Tripoli", "Batroun"] },
            { code: "AK", name: "South",          timezone: "Asia/Beirut", cities: ["Sidon", "Tyre"] },
            { code: "JL", name: "Byblos",         timezone: "Asia/Beirut", cities: ["Byblos"] },
        ],
    },
    {
        code: "EG", name: "Egypt", flag: "🇪🇬",
        defaultCurrency: "EGP", defaultTimezone: "Africa/Cairo",
        stateLabel: "Governorate",
        states: [
            { code: "C",  name: "Cairo",          timezone: "Africa/Cairo", cities: ["Cairo", "New Cairo", "Maadi", "Zamalek", "Nasr City", "Heliopolis"] },
            { code: "GZ", name: "Giza",           timezone: "Africa/Cairo", cities: ["Giza", "6th of October City", "Sheikh Zayed"] },
            { code: "ALX", name: "Alexandria",    timezone: "Africa/Cairo", cities: ["Alexandria", "Borg El Arab"] },
            { code: "SUZ", name: "Suez",          timezone: "Africa/Cairo", cities: ["Suez", "Ain Sokhna"] },
            { code: "BNS", name: "Red Sea",       timezone: "Africa/Cairo", cities: ["Hurghada", "El Gouna", "Marsa Alam"] },
            { code: "JS", name: "South Sinai",    timezone: "Africa/Cairo", cities: ["Sharm El Sheikh", "Dahab", "Nuweiba"] },
            { code: "DK", name: "Dakahlia",       timezone: "Africa/Cairo", cities: ["Mansoura"] },
        ],
    },
    {
        code: "TR", name: "Turkey", flag: "🇹🇷",
        defaultCurrency: "TRY", defaultTimezone: "Europe/Istanbul",
        stateLabel: "Province",
        states: [
            { code: "34", name: "Istanbul",       timezone: "Europe/Istanbul", cities: ["Istanbul", "Beşiktaş", "Kadıköy", "Şişli", "Beyoğlu"] },
            { code: "06", name: "Ankara",         timezone: "Europe/Istanbul", cities: ["Ankara", "Çankaya"] },
            { code: "35", name: "İzmir",          timezone: "Europe/Istanbul", cities: ["İzmir", "Bornova", "Karşıyaka"] },
            { code: "07", name: "Antalya",        timezone: "Europe/Istanbul", cities: ["Antalya", "Alanya", "Belek"] },
            { code: "16", name: "Bursa",          timezone: "Europe/Istanbul", cities: ["Bursa"] },
            { code: "48", name: "Muğla",          timezone: "Europe/Istanbul", cities: ["Bodrum", "Marmaris", "Fethiye"] },
        ],
    },
    // ── SE Asia ──
    // Indonesia — multi-TZ (WIB / WITA / WIT) — the driving example.
    {
        code: "ID", name: "Indonesia", flag: "🇮🇩",
        defaultCurrency: "IDR", defaultTimezone: "Asia/Jakarta",
        stateLabel: "Province",
        states: [
            // ── WIB (Asia/Jakarta — UTC+7) ──
            { code: "JK", name: "DKI Jakarta",    timezone: "Asia/Jakarta", cities: ["Jakarta", "Central Jakarta", "South Jakarta", "West Jakarta", "East Jakarta", "North Jakarta"] },
            { code: "JB", name: "West Java",      timezone: "Asia/Jakarta", cities: ["Bandung", "Bogor", "Bekasi", "Depok", "Cimahi"] },
            { code: "JT", name: "Central Java",   timezone: "Asia/Jakarta", cities: ["Semarang", "Surakarta", "Magelang", "Tegal"] },
            { code: "YO", name: "Yogyakarta",     timezone: "Asia/Jakarta", cities: ["Yogyakarta", "Sleman", "Bantul"] },
            { code: "JI", name: "East Java",      timezone: "Asia/Jakarta", cities: ["Surabaya", "Malang", "Kediri", "Madiun", "Banyuwangi", "Batu"] },
            { code: "BT", name: "Banten",         timezone: "Asia/Jakarta", cities: ["Serang", "Tangerang", "South Tangerang"] },
            { code: "SU", name: "North Sumatra",  timezone: "Asia/Jakarta", cities: ["Medan", "Binjai", "Tebing Tinggi"] },
            { code: "SB", name: "West Sumatra",   timezone: "Asia/Jakarta", cities: ["Padang", "Bukittinggi"] },
            { code: "RI", name: "Riau",           timezone: "Asia/Jakarta", cities: ["Pekanbaru"] },
            { code: "KR", name: "Riau Islands",   timezone: "Asia/Jakarta", cities: ["Batam", "Tanjungpinang"] },
            { code: "JA", name: "Jambi",          timezone: "Asia/Jakarta", cities: ["Jambi"] },
            { code: "SS", name: "South Sumatra",  timezone: "Asia/Jakarta", cities: ["Palembang"] },
            { code: "BB", name: "Bangka Belitung", timezone: "Asia/Jakarta", cities: ["Pangkal Pinang"] },
            { code: "BE", name: "Bengkulu",       timezone: "Asia/Jakarta", cities: ["Bengkulu"] },
            { code: "LA", name: "Lampung",        timezone: "Asia/Jakarta", cities: ["Bandar Lampung"] },
            { code: "AC", name: "Aceh",           timezone: "Asia/Jakarta", cities: ["Banda Aceh"] },
            { code: "KB", name: "West Kalimantan", timezone: "Asia/Jakarta", cities: ["Pontianak"] },
            { code: "KT", name: "Central Kalimantan", timezone: "Asia/Jakarta", cities: ["Palangkaraya"] },
            // ── WITA (Asia/Makassar — UTC+8) ──
            { code: "BA", name: "Bali",           timezone: "Asia/Makassar", cities: ["Denpasar", "Ubud", "Kuta", "Seminyak", "Canggu", "Sanur", "Nusa Dua"] },
            { code: "NB", name: "West Nusa Tenggara", timezone: "Asia/Makassar", cities: ["Mataram", "Lombok"] },
            { code: "NT", name: "East Nusa Tenggara", timezone: "Asia/Makassar", cities: ["Kupang", "Labuan Bajo"] },
            { code: "KS", name: "South Kalimantan", timezone: "Asia/Makassar", cities: ["Banjarmasin"] },
            { code: "KI", name: "East Kalimantan", timezone: "Asia/Makassar", cities: ["Samarinda", "Balikpapan"] },
            { code: "KU", name: "North Kalimantan", timezone: "Asia/Makassar", cities: ["Tarakan"] },
            { code: "SN", name: "South Sulawesi", timezone: "Asia/Makassar", cities: ["Makassar", "Parepare"] },
            { code: "SG", name: "Southeast Sulawesi", timezone: "Asia/Makassar", cities: ["Kendari"] },
            { code: "ST", name: "Central Sulawesi", timezone: "Asia/Makassar", cities: ["Palu"] },
            { code: "SR", name: "West Sulawesi",  timezone: "Asia/Makassar", cities: ["Mamuju"] },
            { code: "SA", name: "North Sulawesi", timezone: "Asia/Makassar", cities: ["Manado", "Bitung"] },
            { code: "GO", name: "Gorontalo",      timezone: "Asia/Makassar", cities: ["Gorontalo"] },
            // ── WIT (Asia/Jayapura — UTC+9) ──
            { code: "MA", name: "Maluku",         timezone: "Asia/Jayapura", cities: ["Ambon"] },
            { code: "MU", name: "North Maluku",   timezone: "Asia/Jayapura", cities: ["Ternate", "Tidore"] },
            { code: "PA", name: "Papua",          timezone: "Asia/Jayapura", cities: ["Jayapura"] },
            { code: "PB", name: "West Papua",     timezone: "Asia/Jayapura", cities: ["Manokwari", "Sorong"] },
        ],
    },
    {
        code: "MY", name: "Malaysia", flag: "🇲🇾",
        defaultCurrency: "MYR", defaultTimezone: "Asia/Kuala_Lumpur",
        stateLabel: "State",
        states: [
            { code: "14", name: "Kuala Lumpur",   timezone: "Asia/Kuala_Lumpur", cities: ["Kuala Lumpur", "Bukit Bintang", "KLCC", "Bangsar", "Mont Kiara"] },
            { code: "10", name: "Selangor",       timezone: "Asia/Kuala_Lumpur", cities: ["Shah Alam", "Petaling Jaya", "Subang Jaya", "Klang"] },
            { code: "07", name: "Penang",         timezone: "Asia/Kuala_Lumpur", cities: ["George Town", "Bayan Lepas", "Butterworth"] },
            { code: "01", name: "Johor",          timezone: "Asia/Kuala_Lumpur", cities: ["Johor Bahru", "Iskandar Puteri", "Muar"] },
            { code: "08", name: "Perak",          timezone: "Asia/Kuala_Lumpur", cities: ["Ipoh", "Taiping"] },
            { code: "06", name: "Pahang",         timezone: "Asia/Kuala_Lumpur", cities: ["Kuantan", "Cameron Highlands"] },
            { code: "12", name: "Sabah",          timezone: "Asia/Kuala_Lumpur", cities: ["Kota Kinabalu", "Sandakan"] },
            { code: "13", name: "Sarawak",        timezone: "Asia/Kuala_Lumpur", cities: ["Kuching", "Miri", "Sibu"] },
            { code: "04", name: "Melaka",         timezone: "Asia/Kuala_Lumpur", cities: ["Melaka"] },
        ],
    },
    {
        // Singapore is a city-state — no meaningful subdivision. `stateLabel`
        // is omitted so the middle field hides on this country.
        code: "SG", name: "Singapore", flag: "🇸🇬",
        defaultCurrency: "SGD", defaultTimezone: "Asia/Singapore",
        states: [
            { code: "SG", name: "Singapore", timezone: "Asia/Singapore", cities: ["Singapore", "Orchard", "Marina Bay", "Sentosa", "Jurong", "Tampines", "Woodlands", "Bishan"] },
        ],
    },
    {
        code: "TH", name: "Thailand", flag: "🇹🇭",
        defaultCurrency: "THB", defaultTimezone: "Asia/Bangkok",
        stateLabel: "Province",
        states: [
            { code: "10", name: "Bangkok",        timezone: "Asia/Bangkok", cities: ["Bangkok", "Sukhumvit", "Sathorn", "Silom", "Chatuchak"] },
            { code: "50", name: "Chiang Mai",     timezone: "Asia/Bangkok", cities: ["Chiang Mai", "Hang Dong"] },
            { code: "83", name: "Phuket",         timezone: "Asia/Bangkok", cities: ["Phuket", "Patong", "Kata"] },
            { code: "20", name: "Chonburi",       timezone: "Asia/Bangkok", cities: ["Pattaya", "Chonburi", "Sri Racha"] },
            { code: "81", name: "Krabi",          timezone: "Asia/Bangkok", cities: ["Krabi", "Ao Nang"] },
            { code: "84", name: "Surat Thani",    timezone: "Asia/Bangkok", cities: ["Koh Samui", "Koh Phangan"] },
        ],
    },
    {
        code: "PH", name: "Philippines", flag: "🇵🇭",
        defaultCurrency: "PHP", defaultTimezone: "Asia/Manila",
        stateLabel: "Region",
        states: [
            { code: "00", name: "Metro Manila",   timezone: "Asia/Manila", cities: ["Manila", "Makati", "Quezon City", "Taguig", "Pasig", "Mandaluyong", "BGC"] },
            { code: "40", name: "Calabarzon",     timezone: "Asia/Manila", cities: ["Antipolo", "Bacoor", "Dasmariñas"] },
            { code: "07", name: "Central Visayas", timezone: "Asia/Manila", cities: ["Cebu City", "Mandaue", "Lapu-Lapu"] },
            { code: "11", name: "Davao",          timezone: "Asia/Manila", cities: ["Davao City"] },
            { code: "6",  name: "Western Visayas", timezone: "Asia/Manila", cities: ["Iloilo City", "Bacolod"] },
            { code: "CAR", name: "Cordillera",    timezone: "Asia/Manila", cities: ["Baguio"] },
        ],
    },
    {
        code: "VN", name: "Vietnam", flag: "🇻🇳",
        defaultCurrency: "VND", defaultTimezone: "Asia/Ho_Chi_Minh",
        stateLabel: "Province",
        states: [
            { code: "SG", name: "Ho Chi Minh City", timezone: "Asia/Ho_Chi_Minh", cities: ["Ho Chi Minh City", "District 1", "District 2", "Thu Duc"] },
            { code: "HN", name: "Hanoi",          timezone: "Asia/Ho_Chi_Minh", cities: ["Hanoi", "Hoan Kiem", "Cau Giay"] },
            { code: "DN", name: "Da Nang",        timezone: "Asia/Ho_Chi_Minh", cities: ["Da Nang", "Hoi An"] },
            { code: "HP", name: "Hai Phong",      timezone: "Asia/Ho_Chi_Minh", cities: ["Hai Phong"] },
            { code: "KH", name: "Khanh Hoa",      timezone: "Asia/Ho_Chi_Minh", cities: ["Nha Trang"] },
        ],
    },
    // ── East Asia ──
    {
        code: "JP", name: "Japan", flag: "🇯🇵",
        defaultCurrency: "JPY", defaultTimezone: "Asia/Tokyo",
        stateLabel: "Prefecture",
        states: [
            { code: "13", name: "Tokyo",          timezone: "Asia/Tokyo", cities: ["Tokyo", "Shibuya", "Shinjuku", "Ginza", "Roppongi", "Setagaya"] },
            { code: "27", name: "Osaka",          timezone: "Asia/Tokyo", cities: ["Osaka", "Umeda", "Namba"] },
            { code: "14", name: "Kanagawa",       timezone: "Asia/Tokyo", cities: ["Yokohama", "Kawasaki"] },
            { code: "26", name: "Kyoto",          timezone: "Asia/Tokyo", cities: ["Kyoto"] },
            { code: "01", name: "Hokkaido",       timezone: "Asia/Tokyo", cities: ["Sapporo", "Niseko"] },
            { code: "40", name: "Fukuoka",        timezone: "Asia/Tokyo", cities: ["Fukuoka"] },
            { code: "23", name: "Aichi",          timezone: "Asia/Tokyo", cities: ["Nagoya"] },
        ],
    },
    {
        code: "KR", name: "South Korea", flag: "🇰🇷",
        defaultCurrency: "KRW", defaultTimezone: "Asia/Seoul",
        stateLabel: "Province",
        states: [
            { code: "11", name: "Seoul",          timezone: "Asia/Seoul", cities: ["Seoul", "Gangnam", "Hongdae", "Itaewon", "Jamsil"] },
            { code: "26", name: "Busan",          timezone: "Asia/Seoul", cities: ["Busan", "Haeundae"] },
            { code: "28", name: "Incheon",        timezone: "Asia/Seoul", cities: ["Incheon", "Songdo"] },
            { code: "27", name: "Daegu",          timezone: "Asia/Seoul", cities: ["Daegu"] },
            { code: "41", name: "Gyeonggi",       timezone: "Asia/Seoul", cities: ["Suwon", "Bundang", "Seongnam"] },
        ],
    },
    {
        code: "CN", name: "China", flag: "🇨🇳",
        defaultCurrency: "CNY", defaultTimezone: "Asia/Shanghai",
        stateLabel: "Province",
        states: [
            // China unified TZ: everything on Asia/Shanghai (UTC+8), Xinjiang unofficially uses UTC+6.
            { code: "BJ", name: "Beijing",        timezone: "Asia/Shanghai", cities: ["Beijing", "Chaoyang", "Haidian"] },
            { code: "SH", name: "Shanghai",       timezone: "Asia/Shanghai", cities: ["Shanghai", "Pudong", "Xuhui"] },
            { code: "GD", name: "Guangdong",      timezone: "Asia/Shanghai", cities: ["Guangzhou", "Shenzhen", "Dongguan", "Foshan", "Zhuhai"] },
            { code: "JS", name: "Jiangsu",        timezone: "Asia/Shanghai", cities: ["Nanjing", "Suzhou", "Wuxi"] },
            { code: "ZJ", name: "Zhejiang",       timezone: "Asia/Shanghai", cities: ["Hangzhou", "Ningbo", "Wenzhou"] },
            { code: "SC", name: "Sichuan",        timezone: "Asia/Shanghai", cities: ["Chengdu"] },
            { code: "HB", name: "Hubei",          timezone: "Asia/Shanghai", cities: ["Wuhan"] },
            { code: "TJ", name: "Tianjin",        timezone: "Asia/Shanghai", cities: ["Tianjin"] },
            { code: "CQ", name: "Chongqing",      timezone: "Asia/Shanghai", cities: ["Chongqing"] },
            { code: "SD", name: "Shandong",       timezone: "Asia/Shanghai", cities: ["Qingdao", "Jinan"] },
        ],
    },
    {
        code: "IN", name: "India", flag: "🇮🇳",
        defaultCurrency: "INR", defaultTimezone: "Asia/Kolkata",
        stateLabel: "State",
        states: [
            { code: "MH", name: "Maharashtra",    timezone: "Asia/Kolkata", cities: ["Mumbai", "Pune", "Nagpur", "Nashik", "Aurangabad"] },
            { code: "DL", name: "Delhi",          timezone: "Asia/Kolkata", cities: ["New Delhi", "Delhi", "Gurugram", "Noida"] },
            { code: "KA", name: "Karnataka",      timezone: "Asia/Kolkata", cities: ["Bangalore", "Mysuru", "Mangalore"] },
            { code: "TN", name: "Tamil Nadu",     timezone: "Asia/Kolkata", cities: ["Chennai", "Coimbatore", "Madurai"] },
            { code: "TG", name: "Telangana",      timezone: "Asia/Kolkata", cities: ["Hyderabad"] },
            { code: "WB", name: "West Bengal",    timezone: "Asia/Kolkata", cities: ["Kolkata", "Howrah"] },
            { code: "GJ", name: "Gujarat",        timezone: "Asia/Kolkata", cities: ["Ahmedabad", "Surat", "Vadodara"] },
            { code: "UP", name: "Uttar Pradesh",  timezone: "Asia/Kolkata", cities: ["Lucknow", "Kanpur", "Varanasi", "Agra"] },
            { code: "RJ", name: "Rajasthan",      timezone: "Asia/Kolkata", cities: ["Jaipur", "Udaipur", "Jodhpur"] },
            { code: "KL", name: "Kerala",         timezone: "Asia/Kolkata", cities: ["Kochi", "Thiruvananthapuram"] },
            { code: "GA", name: "Goa",            timezone: "Asia/Kolkata", cities: ["Panaji"] },
        ],
    },
    {
        code: "PK", name: "Pakistan", flag: "🇵🇰",
        defaultCurrency: "PKR", defaultTimezone: "Asia/Karachi",
        stateLabel: "Province",
        states: [
            { code: "SD", name: "Sindh",          timezone: "Asia/Karachi", cities: ["Karachi", "Hyderabad"] },
            { code: "PB", name: "Punjab",         timezone: "Asia/Karachi", cities: ["Lahore", "Faisalabad", "Rawalpindi", "Multan"] },
            { code: "IS", name: "Islamabad",      timezone: "Asia/Karachi", cities: ["Islamabad"] },
            { code: "KP", name: "Khyber Pakhtunkhwa", timezone: "Asia/Karachi", cities: ["Peshawar"] },
            { code: "BA", name: "Balochistan",    timezone: "Asia/Karachi", cities: ["Quetta"] },
        ],
    },
    // ── Oceania ──
    // Australia — multi-TZ across all mainland states.
    {
        code: "AU", name: "Australia", flag: "🇦🇺",
        defaultCurrency: "AUD", defaultTimezone: "Australia/Sydney",
        stateLabel: "State",
        states: [
            { code: "NSW", name: "New South Wales", timezone: "Australia/Sydney",    cities: ["Sydney", "Newcastle", "Wollongong", "Bondi", "Manly"] },
            { code: "VIC", name: "Victoria",        timezone: "Australia/Melbourne", cities: ["Melbourne", "Geelong", "Ballarat"] },
            { code: "QLD", name: "Queensland",      timezone: "Australia/Brisbane",  cities: ["Brisbane", "Gold Coast", "Sunshine Coast", "Cairns"] },
            { code: "WA",  name: "Western Australia", timezone: "Australia/Perth",   cities: ["Perth", "Fremantle"] },
            { code: "SA",  name: "South Australia", timezone: "Australia/Adelaide",  cities: ["Adelaide", "Glenelg"] },
            { code: "TAS", name: "Tasmania",        timezone: "Australia/Hobart",    cities: ["Hobart", "Launceston"] },
            { code: "NT",  name: "Northern Territory", timezone: "Australia/Darwin", cities: ["Darwin", "Alice Springs"] },
            { code: "ACT", name: "Australian Capital Territory", timezone: "Australia/Sydney", cities: ["Canberra"] },
        ],
    },
    {
        code: "NZ", name: "New Zealand", flag: "🇳🇿",
        defaultCurrency: "NZD", defaultTimezone: "Pacific/Auckland",
        stateLabel: "Region",
        states: [
            { code: "AUK", name: "Auckland",      timezone: "Pacific/Auckland", cities: ["Auckland", "North Shore"] },
            { code: "WGN", name: "Wellington",    timezone: "Pacific/Auckland", cities: ["Wellington"] },
            { code: "CAN", name: "Canterbury",    timezone: "Pacific/Auckland", cities: ["Christchurch"] },
            { code: "OTA", name: "Otago",         timezone: "Pacific/Auckland", cities: ["Queenstown", "Dunedin"] },
            { code: "WKO", name: "Waikato",       timezone: "Pacific/Auckland", cities: ["Hamilton"] },
        ],
    },
    // ── Europe ──
    {
        code: "GB", name: "United Kingdom", flag: "🇬🇧",
        defaultCurrency: "GBP", defaultTimezone: "Europe/London",
        stateLabel: "Country",
        states: [
            { code: "ENG", name: "England",       timezone: "Europe/London", cities: ["London", "Manchester", "Birmingham", "Liverpool", "Leeds", "Bristol", "Newcastle"] },
            { code: "SCT", name: "Scotland",      timezone: "Europe/London", cities: ["Edinburgh", "Glasgow", "Aberdeen"] },
            { code: "WLS", name: "Wales",         timezone: "Europe/London", cities: ["Cardiff", "Swansea"] },
            { code: "NIR", name: "Northern Ireland", timezone: "Europe/London", cities: ["Belfast"] },
        ],
    },
    {
        code: "IE", name: "Ireland", flag: "🇮🇪",
        defaultCurrency: "EUR", defaultTimezone: "Europe/Dublin",
        stateLabel: "County",
        states: [
            { code: "D", name: "Dublin",          timezone: "Europe/Dublin", cities: ["Dublin"] },
            { code: "CO", name: "Cork",           timezone: "Europe/Dublin", cities: ["Cork"] },
            { code: "G", name: "Galway",          timezone: "Europe/Dublin", cities: ["Galway"] },
            { code: "L", name: "Limerick",        timezone: "Europe/Dublin", cities: ["Limerick"] },
        ],
    },
    {
        code: "FR", name: "France", flag: "🇫🇷",
        defaultCurrency: "EUR", defaultTimezone: "Europe/Paris",
        stateLabel: "Region",
        states: [
            { code: "IDF", name: "Île-de-France", timezone: "Europe/Paris", cities: ["Paris", "Versailles", "Boulogne-Billancourt"] },
            { code: "PAC", name: "Provence-Alpes-Côte d'Azur", timezone: "Europe/Paris", cities: ["Marseille", "Nice", "Cannes", "Aix-en-Provence"] },
            { code: "ARA", name: "Auvergne-Rhône-Alpes", timezone: "Europe/Paris", cities: ["Lyon", "Grenoble", "Saint-Étienne"] },
            { code: "OCC", name: "Occitanie",     timezone: "Europe/Paris", cities: ["Toulouse", "Montpellier"] },
            { code: "NAQ", name: "Nouvelle-Aquitaine", timezone: "Europe/Paris", cities: ["Bordeaux"] },
        ],
    },
    {
        code: "DE", name: "Germany", flag: "🇩🇪",
        defaultCurrency: "EUR", defaultTimezone: "Europe/Berlin",
        stateLabel: "State",
        states: [
            { code: "BE", name: "Berlin",         timezone: "Europe/Berlin", cities: ["Berlin"] },
            { code: "BY", name: "Bavaria",        timezone: "Europe/Berlin", cities: ["Munich", "Nuremberg"] },
            { code: "HH", name: "Hamburg",        timezone: "Europe/Berlin", cities: ["Hamburg"] },
            { code: "HE", name: "Hesse",          timezone: "Europe/Berlin", cities: ["Frankfurt", "Wiesbaden"] },
            { code: "BW", name: "Baden-Württemberg", timezone: "Europe/Berlin", cities: ["Stuttgart", "Heidelberg"] },
            { code: "NW", name: "North Rhine-Westphalia", timezone: "Europe/Berlin", cities: ["Cologne", "Düsseldorf", "Essen", "Dortmund"] },
        ],
    },
    {
        code: "ES", name: "Spain", flag: "🇪🇸",
        defaultCurrency: "EUR", defaultTimezone: "Europe/Madrid",
        stateLabel: "Community",
        states: [
            { code: "M",  name: "Madrid",         timezone: "Europe/Madrid", cities: ["Madrid"] },
            { code: "CT", name: "Catalonia",      timezone: "Europe/Madrid", cities: ["Barcelona", "Girona", "Tarragona"] },
            { code: "AN", name: "Andalusia",     timezone: "Europe/Madrid", cities: ["Seville", "Málaga", "Marbella", "Granada"] },
            { code: "VC", name: "Valencia",       timezone: "Europe/Madrid", cities: ["Valencia", "Alicante"] },
            { code: "PV", name: "Basque Country", timezone: "Europe/Madrid", cities: ["Bilbao", "San Sebastián"] },
            { code: "CN", name: "Canary Islands", timezone: "Atlantic/Canary", cities: ["Las Palmas", "Tenerife"] },
        ],
    },
    {
        code: "IT", name: "Italy", flag: "🇮🇹",
        defaultCurrency: "EUR", defaultTimezone: "Europe/Rome",
        stateLabel: "Region",
        states: [
            { code: "62", name: "Lazio",          timezone: "Europe/Rome", cities: ["Rome"] },
            { code: "25", name: "Lombardy",       timezone: "Europe/Rome", cities: ["Milan", "Bergamo", "Como"] },
            { code: "72", name: "Campania",       timezone: "Europe/Rome", cities: ["Naples", "Sorrento"] },
            { code: "52", name: "Tuscany",        timezone: "Europe/Rome", cities: ["Florence", "Pisa", "Siena"] },
            { code: "34", name: "Veneto",         timezone: "Europe/Rome", cities: ["Venice", "Verona"] },
            { code: "21", name: "Piedmont",       timezone: "Europe/Rome", cities: ["Turin"] },
        ],
    },
    {
        code: "NL", name: "Netherlands", flag: "🇳🇱",
        defaultCurrency: "EUR", defaultTimezone: "Europe/Amsterdam",
        stateLabel: "Province",
        states: [
            { code: "NH", name: "North Holland",  timezone: "Europe/Amsterdam", cities: ["Amsterdam", "Haarlem"] },
            { code: "ZH", name: "South Holland",  timezone: "Europe/Amsterdam", cities: ["Rotterdam", "The Hague", "Leiden"] },
            { code: "UT", name: "Utrecht",        timezone: "Europe/Amsterdam", cities: ["Utrecht"] },
            { code: "NB", name: "North Brabant",  timezone: "Europe/Amsterdam", cities: ["Eindhoven", "'s-Hertogenbosch"] },
        ],
    },
    {
        code: "BE", name: "Belgium", flag: "🇧🇪",
        defaultCurrency: "EUR", defaultTimezone: "Europe/Brussels",
        stateLabel: "Region",
        states: [
            { code: "BRU", name: "Brussels",      timezone: "Europe/Brussels", cities: ["Brussels"] },
            { code: "VLG", name: "Flanders",      timezone: "Europe/Brussels", cities: ["Antwerp", "Ghent", "Bruges", "Leuven"] },
            { code: "WAL", name: "Wallonia",      timezone: "Europe/Brussels", cities: ["Liège", "Namur", "Charleroi"] },
        ],
    },
    {
        code: "PT", name: "Portugal", flag: "🇵🇹",
        defaultCurrency: "EUR", defaultTimezone: "Europe/Lisbon",
        stateLabel: "District",
        states: [
            { code: "11", name: "Lisbon",         timezone: "Europe/Lisbon", cities: ["Lisbon", "Cascais", "Sintra"] },
            { code: "13", name: "Porto",          timezone: "Europe/Lisbon", cities: ["Porto"] },
            { code: "08", name: "Faro",           timezone: "Europe/Lisbon", cities: ["Faro", "Albufeira", "Lagos"] },
            { code: "06", name: "Coimbra",        timezone: "Europe/Lisbon", cities: ["Coimbra"] },
        ],
    },
    {
        code: "GR", name: "Greece", flag: "🇬🇷",
        defaultCurrency: "EUR", defaultTimezone: "Europe/Athens",
        stateLabel: "Region",
        states: [
            { code: "A",  name: "Attica",         timezone: "Europe/Athens", cities: ["Athens", "Piraeus"] },
            { code: "B",  name: "Central Macedonia", timezone: "Europe/Athens", cities: ["Thessaloniki"] },
            { code: "L",  name: "South Aegean",   timezone: "Europe/Athens", cities: ["Mykonos", "Santorini", "Rhodes"] },
            { code: "M",  name: "Crete",          timezone: "Europe/Athens", cities: ["Heraklion", "Chania"] },
        ],
    },
    {
        code: "CH", name: "Switzerland", flag: "🇨🇭",
        defaultCurrency: "CHF", defaultTimezone: "Europe/Zurich",
        stateLabel: "Canton",
        states: [
            { code: "ZH", name: "Zurich",         timezone: "Europe/Zurich", cities: ["Zurich"] },
            { code: "GE", name: "Geneva",         timezone: "Europe/Zurich", cities: ["Geneva"] },
            { code: "VD", name: "Vaud",           timezone: "Europe/Zurich", cities: ["Lausanne", "Montreux"] },
            { code: "BS", name: "Basel-City",     timezone: "Europe/Zurich", cities: ["Basel"] },
            { code: "BE", name: "Bern",           timezone: "Europe/Zurich", cities: ["Bern", "Interlaken"] },
        ],
    },
    {
        code: "AT", name: "Austria", flag: "🇦🇹",
        defaultCurrency: "EUR", defaultTimezone: "Europe/Vienna",
        stateLabel: "State",
        states: [
            { code: "9", name: "Vienna",          timezone: "Europe/Vienna", cities: ["Vienna"] },
            { code: "5", name: "Salzburg",        timezone: "Europe/Vienna", cities: ["Salzburg"] },
            { code: "6", name: "Styria",          timezone: "Europe/Vienna", cities: ["Graz"] },
            { code: "7", name: "Tyrol",           timezone: "Europe/Vienna", cities: ["Innsbruck", "Kitzbühel"] },
        ],
    },
    {
        code: "SE", name: "Sweden", flag: "🇸🇪",
        defaultCurrency: "SEK", defaultTimezone: "Europe/Stockholm",
        stateLabel: "County",
        states: [
            { code: "AB", name: "Stockholm",      timezone: "Europe/Stockholm", cities: ["Stockholm"] },
            { code: "O",  name: "Västra Götaland", timezone: "Europe/Stockholm", cities: ["Gothenburg"] },
            { code: "M",  name: "Skåne",          timezone: "Europe/Stockholm", cities: ["Malmö"] },
            { code: "C",  name: "Uppsala",        timezone: "Europe/Stockholm", cities: ["Uppsala"] },
        ],
    },
    {
        code: "NO", name: "Norway", flag: "🇳🇴",
        defaultCurrency: "NOK", defaultTimezone: "Europe/Oslo",
        stateLabel: "County",
        states: [
            { code: "03", name: "Oslo",           timezone: "Europe/Oslo", cities: ["Oslo"] },
            { code: "46", name: "Vestland",       timezone: "Europe/Oslo", cities: ["Bergen"] },
            { code: "11", name: "Rogaland",       timezone: "Europe/Oslo", cities: ["Stavanger"] },
            { code: "50", name: "Trøndelag",      timezone: "Europe/Oslo", cities: ["Trondheim"] },
        ],
    },
    {
        code: "DK", name: "Denmark", flag: "🇩🇰",
        defaultCurrency: "DKK", defaultTimezone: "Europe/Copenhagen",
        stateLabel: "Region",
        states: [
            { code: "84", name: "Capital",        timezone: "Europe/Copenhagen", cities: ["Copenhagen"] },
            { code: "82", name: "Central Denmark", timezone: "Europe/Copenhagen", cities: ["Aarhus"] },
            { code: "83", name: "North Denmark",  timezone: "Europe/Copenhagen", cities: ["Aalborg"] },
            { code: "81", name: "Southern Denmark", timezone: "Europe/Copenhagen", cities: ["Odense"] },
        ],
    },
    {
        code: "FI", name: "Finland", flag: "🇫🇮",
        defaultCurrency: "EUR", defaultTimezone: "Europe/Helsinki",
        stateLabel: "Region",
        states: [
            { code: "18", name: "Uusimaa",        timezone: "Europe/Helsinki", cities: ["Helsinki", "Espoo", "Vantaa"] },
            { code: "11", name: "Pirkanmaa",      timezone: "Europe/Helsinki", cities: ["Tampere"] },
            { code: "02", name: "Southwest Finland", timezone: "Europe/Helsinki", cities: ["Turku"] },
        ],
    },
    {
        code: "PL", name: "Poland", flag: "🇵🇱",
        defaultCurrency: "PLN", defaultTimezone: "Europe/Warsaw",
        stateLabel: "Voivodeship",
        states: [
            { code: "MZ", name: "Masovian",       timezone: "Europe/Warsaw", cities: ["Warsaw"] },
            { code: "MA", name: "Lesser Poland",  timezone: "Europe/Warsaw", cities: ["Krakow"] },
            { code: "DS", name: "Lower Silesian", timezone: "Europe/Warsaw", cities: ["Wrocław"] },
            { code: "WP", name: "Greater Poland", timezone: "Europe/Warsaw", cities: ["Poznań"] },
            { code: "PM", name: "Pomeranian",     timezone: "Europe/Warsaw", cities: ["Gdańsk", "Gdynia"] },
        ],
    },
    // ── Africa ──
    {
        code: "ZA", name: "South Africa", flag: "🇿🇦",
        defaultCurrency: "ZAR", defaultTimezone: "Africa/Johannesburg",
        stateLabel: "Province",
        states: [
            { code: "GT", name: "Gauteng",        timezone: "Africa/Johannesburg", cities: ["Johannesburg", "Pretoria", "Sandton"] },
            { code: "WC", name: "Western Cape",   timezone: "Africa/Johannesburg", cities: ["Cape Town", "Stellenbosch"] },
            { code: "NL", name: "KwaZulu-Natal",  timezone: "Africa/Johannesburg", cities: ["Durban", "Umhlanga"] },
            { code: "EC", name: "Eastern Cape",   timezone: "Africa/Johannesburg", cities: ["Port Elizabeth", "East London"] },
        ],
    },
    {
        code: "NG", name: "Nigeria", flag: "🇳🇬",
        defaultCurrency: "NGN", defaultTimezone: "Africa/Lagos",
        stateLabel: "State",
        states: [
            { code: "LA", name: "Lagos",          timezone: "Africa/Lagos", cities: ["Lagos", "Ikeja", "Lekki", "Victoria Island"] },
            { code: "FC", name: "Abuja FCT",      timezone: "Africa/Lagos", cities: ["Abuja"] },
            { code: "KN", name: "Kano",           timezone: "Africa/Lagos", cities: ["Kano"] },
            { code: "OY", name: "Oyo",            timezone: "Africa/Lagos", cities: ["Ibadan"] },
        ],
    },
    {
        code: "KE", name: "Kenya", flag: "🇰🇪",
        defaultCurrency: "KES", defaultTimezone: "Africa/Nairobi",
        stateLabel: "County",
        states: [
            { code: "30", name: "Nairobi",        timezone: "Africa/Nairobi", cities: ["Nairobi", "Karen", "Westlands"] },
            { code: "01", name: "Mombasa",        timezone: "Africa/Nairobi", cities: ["Mombasa", "Diani"] },
            { code: "42", name: "Kisumu",         timezone: "Africa/Nairobi", cities: ["Kisumu"] },
            { code: "32", name: "Nakuru",         timezone: "Africa/Nairobi", cities: ["Nakuru"] },
        ],
    },
    {
        code: "MA", name: "Morocco", flag: "🇲🇦",
        defaultCurrency: "MAD", defaultTimezone: "Africa/Casablanca",
        stateLabel: "Region",
        states: [
            { code: "06", name: "Casablanca-Settat", timezone: "Africa/Casablanca", cities: ["Casablanca", "Mohammedia"] },
            { code: "01", name: "Marrakesh-Safi", timezone: "Africa/Casablanca", cities: ["Marrakech", "Essaouira"] },
            { code: "03", name: "Fès-Meknès",     timezone: "Africa/Casablanca", cities: ["Fez", "Meknes"] },
            { code: "07", name: "Rabat-Salé-Kénitra", timezone: "Africa/Casablanca", cities: ["Rabat", "Salé"] },
            { code: "02", name: "Tangier-Tetouan-Al Hoceima", timezone: "Africa/Casablanca", cities: ["Tangier", "Tetouan"] },
        ],
    },
    // ── North America ──
    // USA — the classic multi-TZ case: Eastern, Central, Mountain, Pacific, Alaska, Hawaii.
    {
        code: "US", name: "United States", flag: "🇺🇸",
        defaultCurrency: "USD", defaultTimezone: "America/New_York",
        stateLabel: "State",
        states: [
            // ── Eastern (America/New_York) ──
            { code: "NY", name: "New York",       timezone: "America/New_York", cities: ["New York", "Brooklyn", "Queens", "Manhattan", "Buffalo", "Rochester"] },
            { code: "FL", name: "Florida",        timezone: "America/New_York", cities: ["Miami", "Orlando", "Tampa", "Jacksonville", "Fort Lauderdale"] },
            { code: "GA", name: "Georgia",        timezone: "America/New_York", cities: ["Atlanta", "Savannah"] },
            { code: "MA", name: "Massachusetts",  timezone: "America/New_York", cities: ["Boston", "Cambridge"] },
            { code: "PA", name: "Pennsylvania",   timezone: "America/New_York", cities: ["Philadelphia", "Pittsburgh"] },
            { code: "NC", name: "North Carolina", timezone: "America/New_York", cities: ["Charlotte", "Raleigh"] },
            { code: "VA", name: "Virginia",       timezone: "America/New_York", cities: ["Virginia Beach", "Arlington", "Richmond"] },
            { code: "OH", name: "Ohio",           timezone: "America/New_York", cities: ["Columbus", "Cleveland", "Cincinnati"] },
            { code: "MI", name: "Michigan",       timezone: "America/New_York", cities: ["Detroit", "Ann Arbor"] },
            { code: "NJ", name: "New Jersey",     timezone: "America/New_York", cities: ["Newark", "Jersey City"] },
            { code: "MD", name: "Maryland",       timezone: "America/New_York", cities: ["Baltimore", "Bethesda"] },
            { code: "DC", name: "Washington, D.C.", timezone: "America/New_York", cities: ["Washington"] },
            // ── Central (America/Chicago) ──
            { code: "TX", name: "Texas",          timezone: "America/Chicago", cities: ["Houston", "Dallas", "Austin", "San Antonio", "Fort Worth", "El Paso"] },
            { code: "IL", name: "Illinois",       timezone: "America/Chicago", cities: ["Chicago", "Aurora"] },
            { code: "MN", name: "Minnesota",      timezone: "America/Chicago", cities: ["Minneapolis", "Saint Paul"] },
            { code: "MO", name: "Missouri",       timezone: "America/Chicago", cities: ["Kansas City", "St. Louis"] },
            { code: "LA", name: "Louisiana",      timezone: "America/Chicago", cities: ["New Orleans", "Baton Rouge"] },
            { code: "TN", name: "Tennessee",      timezone: "America/Chicago", cities: ["Nashville", "Memphis"] },
            { code: "WI", name: "Wisconsin",      timezone: "America/Chicago", cities: ["Milwaukee", "Madison"] },
            // ── Mountain (America/Denver) ──
            { code: "CO", name: "Colorado",       timezone: "America/Denver", cities: ["Denver", "Boulder", "Colorado Springs"] },
            { code: "UT", name: "Utah",           timezone: "America/Denver", cities: ["Salt Lake City", "Park City"] },
            { code: "AZ", name: "Arizona",        timezone: "America/Phoenix", cities: ["Phoenix", "Scottsdale", "Tucson"] },
            { code: "NM", name: "New Mexico",     timezone: "America/Denver", cities: ["Albuquerque", "Santa Fe"] },
            // ── Pacific (America/Los_Angeles) ──
            { code: "CA", name: "California",     timezone: "America/Los_Angeles", cities: ["Los Angeles", "San Francisco", "San Diego", "San Jose", "Sacramento", "Beverly Hills", "Santa Monica", "Long Beach", "Oakland"] },
            { code: "WA", name: "Washington",     timezone: "America/Los_Angeles", cities: ["Seattle", "Bellevue", "Tacoma"] },
            { code: "OR", name: "Oregon",         timezone: "America/Los_Angeles", cities: ["Portland", "Eugene"] },
            { code: "NV", name: "Nevada",         timezone: "America/Los_Angeles", cities: ["Las Vegas", "Reno"] },
            // ── Alaska / Hawaii ──
            { code: "AK", name: "Alaska",         timezone: "America/Anchorage", cities: ["Anchorage", "Fairbanks"] },
            { code: "HI", name: "Hawaii",         timezone: "Pacific/Honolulu",  cities: ["Honolulu", "Maui"] },
        ],
    },
    // Canada — multi-TZ. Ordered west → east so the dropdown reads geographically.
    {
        code: "CA", name: "Canada", flag: "🇨🇦",
        defaultCurrency: "CAD", defaultTimezone: "America/Toronto",
        stateLabel: "Province",
        states: [
            { code: "BC", name: "British Columbia", timezone: "America/Vancouver", cities: ["Vancouver", "Victoria", "Whistler", "Kelowna"] },
            { code: "AB", name: "Alberta",        timezone: "America/Edmonton", cities: ["Calgary", "Edmonton", "Banff"] },
            { code: "SK", name: "Saskatchewan",   timezone: "America/Regina",   cities: ["Saskatoon", "Regina"] },
            { code: "MB", name: "Manitoba",       timezone: "America/Winnipeg", cities: ["Winnipeg"] },
            { code: "ON", name: "Ontario",        timezone: "America/Toronto",  cities: ["Toronto", "Ottawa", "Mississauga", "Hamilton", "London"] },
            { code: "QC", name: "Quebec",         timezone: "America/Toronto",  cities: ["Montreal", "Quebec City"] },
            { code: "NB", name: "New Brunswick",  timezone: "America/Halifax",  cities: ["Fredericton", "Moncton"] },
            { code: "NS", name: "Nova Scotia",    timezone: "America/Halifax",  cities: ["Halifax"] },
            { code: "NL", name: "Newfoundland and Labrador", timezone: "America/St_Johns", cities: ["St. John's"] },
        ],
    },
    // Mexico — 3 zones (Central, Mountain, Pacific).
    {
        code: "MX", name: "Mexico", flag: "🇲🇽",
        defaultCurrency: "MXN", defaultTimezone: "America/Mexico_City",
        stateLabel: "State",
        states: [
            { code: "CMX", name: "Mexico City",   timezone: "America/Mexico_City", cities: ["Mexico City", "Coyoacán", "Polanco"] },
            { code: "JAL", name: "Jalisco",       timezone: "America/Mexico_City", cities: ["Guadalajara", "Puerto Vallarta"] },
            { code: "NLE", name: "Nuevo León",    timezone: "America/Monterrey",   cities: ["Monterrey"] },
            { code: "PUE", name: "Puebla",        timezone: "America/Mexico_City", cities: ["Puebla"] },
            { code: "BCN", name: "Baja California", timezone: "America/Tijuana",   cities: ["Tijuana", "Ensenada"] },
            { code: "BCS", name: "Baja California Sur", timezone: "America/Mazatlan", cities: ["Cabo San Lucas", "La Paz"] },
            { code: "QUE", name: "Querétaro",     timezone: "America/Mexico_City", cities: ["Querétaro"] },
            { code: "ROO", name: "Quintana Roo",  timezone: "America/Cancun",      cities: ["Cancún", "Playa del Carmen", "Tulum"] },
        ],
    },
    // ── South America ──
    // Brazil — 4 zones (São Paulo, Manaus, Fernando de Noronha, Rio Branco).
    {
        code: "BR", name: "Brazil", flag: "🇧🇷",
        defaultCurrency: "BRL", defaultTimezone: "America/Sao_Paulo",
        stateLabel: "State",
        states: [
            { code: "SP", name: "São Paulo",      timezone: "America/Sao_Paulo", cities: ["São Paulo", "Campinas", "Santos"] },
            { code: "RJ", name: "Rio de Janeiro", timezone: "America/Sao_Paulo", cities: ["Rio de Janeiro", "Niterói"] },
            { code: "DF", name: "Federal District", timezone: "America/Sao_Paulo", cities: ["Brasília"] },
            { code: "BA", name: "Bahia",          timezone: "America/Sao_Paulo", cities: ["Salvador"] },
            { code: "MG", name: "Minas Gerais",   timezone: "America/Sao_Paulo", cities: ["Belo Horizonte"] },
            { code: "AM", name: "Amazonas",       timezone: "America/Manaus",    cities: ["Manaus"] },
            { code: "PE", name: "Pernambuco",     timezone: "America/Sao_Paulo", cities: ["Recife"] },
            { code: "CE", name: "Ceará",          timezone: "America/Fortaleza", cities: ["Fortaleza"] },
        ],
    },
    {
        code: "AR", name: "Argentina", flag: "🇦🇷",
        defaultCurrency: "ARS", defaultTimezone: "America/Argentina/Buenos_Aires",
        stateLabel: "Province",
        states: [
            { code: "C", name: "Buenos Aires City", timezone: "America/Argentina/Buenos_Aires", cities: ["Buenos Aires"] },
            { code: "X", name: "Córdoba",         timezone: "America/Argentina/Cordoba", cities: ["Córdoba"] },
            { code: "S", name: "Santa Fe",        timezone: "America/Argentina/Buenos_Aires", cities: ["Rosario", "Santa Fe"] },
            { code: "M", name: "Mendoza",         timezone: "America/Argentina/Mendoza", cities: ["Mendoza"] },
        ],
    },
    {
        code: "CL", name: "Chile", flag: "🇨🇱",
        defaultCurrency: "CLP", defaultTimezone: "America/Santiago",
        stateLabel: "Region",
        states: [
            { code: "RM", name: "Santiago Metropolitan", timezone: "America/Santiago", cities: ["Santiago", "Providencia", "Las Condes"] },
            { code: "VS", name: "Valparaíso",     timezone: "America/Santiago", cities: ["Valparaíso", "Viña del Mar"] },
            { code: "BI", name: "Biobío",         timezone: "America/Santiago", cities: ["Concepción"] },
        ],
    },
    {
        code: "CO", name: "Colombia", flag: "🇨🇴",
        defaultCurrency: "COP", defaultTimezone: "America/Bogota",
        stateLabel: "Department",
        states: [
            { code: "DC", name: "Bogotá",         timezone: "America/Bogota", cities: ["Bogotá"] },
            { code: "ANT", name: "Antioquia",     timezone: "America/Bogota", cities: ["Medellín"] },
            { code: "VAC", name: "Valle del Cauca", timezone: "America/Bogota", cities: ["Cali"] },
            { code: "BOL", name: "Bolívar",       timezone: "America/Bogota", cities: ["Cartagena"] },
        ],
    },
];

// ─── Cities-by-country (backward compat for anything still importing it) ─────
// Derived from every state's cities so consumers that don't yet use the state
// dropdown still see a flat city list per country.
export const CITIES_BY_COUNTRY: Record<string, string[]> = Object.fromEntries(
    COUNTRIES.map(c => [c.code, c.states.flatMap(s => s.cities)]),
);

// ─── Currency + timezone catalogues ──────────────────────────────────────────

export interface CurrencyOption {
    code: string;
    label: string;
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
    label: string;
    offsetMinutes: number;
}

export const TIMEZONES: TimezoneOption[] = [
    { iana: "Europe/London",                  label: "(UTC+00:00) London",               offsetMinutes:   0 },
    { iana: "Europe/Dublin",                  label: "(UTC+00:00) Dublin",               offsetMinutes:   0 },
    { iana: "Europe/Lisbon",                  label: "(UTC+00:00) Lisbon",               offsetMinutes:   0 },
    { iana: "Atlantic/Canary",                label: "(UTC+00:00) Canary Islands",       offsetMinutes:   0 },
    { iana: "Africa/Casablanca",              label: "(UTC+01:00) Casablanca",           offsetMinutes:   1  * 60 },
    { iana: "Europe/Berlin",                  label: "(UTC+01:00) Berlin",               offsetMinutes:   1  * 60 },
    { iana: "Europe/Paris",                   label: "(UTC+01:00) Paris",                offsetMinutes:   1  * 60 },
    { iana: "Europe/Madrid",                  label: "(UTC+01:00) Madrid",               offsetMinutes:   1  * 60 },
    { iana: "Europe/Rome",                    label: "(UTC+01:00) Rome",                 offsetMinutes:   1  * 60 },
    { iana: "Europe/Amsterdam",               label: "(UTC+01:00) Amsterdam",            offsetMinutes:   1  * 60 },
    { iana: "Europe/Brussels",                label: "(UTC+01:00) Brussels",             offsetMinutes:   1  * 60 },
    { iana: "Europe/Vienna",                  label: "(UTC+01:00) Vienna",               offsetMinutes:   1  * 60 },
    { iana: "Europe/Zurich",                  label: "(UTC+01:00) Zurich",               offsetMinutes:   1  * 60 },
    { iana: "Europe/Copenhagen",              label: "(UTC+01:00) Copenhagen",           offsetMinutes:   1  * 60 },
    { iana: "Europe/Oslo",                    label: "(UTC+01:00) Oslo",                 offsetMinutes:   1  * 60 },
    { iana: "Europe/Stockholm",               label: "(UTC+01:00) Stockholm",            offsetMinutes:   1  * 60 },
    { iana: "Europe/Warsaw",                  label: "(UTC+01:00) Warsaw",               offsetMinutes:   1  * 60 },
    { iana: "Africa/Lagos",                   label: "(UTC+01:00) Lagos",                offsetMinutes:   1  * 60 },
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
    { iana: "Asia/Singapore",                 label: "(UTC+08:00) Singapore",            offsetMinutes:   8  * 60 },
    { iana: "Asia/Kuala_Lumpur",              label: "(UTC+08:00) Kuala Lumpur",         offsetMinutes:   8  * 60 },
    { iana: "Asia/Manila",                    label: "(UTC+08:00) Manila",               offsetMinutes:   8  * 60 },
    { iana: "Asia/Hong_Kong",                 label: "(UTC+08:00) Hong Kong",            offsetMinutes:   8  * 60 },
    { iana: "Asia/Taipei",                    label: "(UTC+08:00) Taipei",               offsetMinutes:   8  * 60 },
    { iana: "Australia/Perth",                label: "(UTC+08:00) Perth",                offsetMinutes:   8  * 60 },
    { iana: "Asia/Makassar",                  label: "(UTC+08:00) Makassar",             offsetMinutes:   8  * 60 },
    { iana: "Asia/Tokyo",                     label: "(UTC+09:00) Tokyo",                offsetMinutes:   9  * 60 },
    { iana: "Asia/Seoul",                     label: "(UTC+09:00) Seoul",                offsetMinutes:   9  * 60 },
    { iana: "Asia/Jayapura",                  label: "(UTC+09:00) Jayapura",             offsetMinutes:   9  * 60 },
    { iana: "Australia/Adelaide",             label: "(UTC+09:30) Adelaide",             offsetMinutes:   9  * 60 + 30 },
    { iana: "Australia/Darwin",               label: "(UTC+09:30) Darwin",               offsetMinutes:   9  * 60 + 30 },
    { iana: "Australia/Sydney",               label: "(UTC+10:00) Sydney",               offsetMinutes:  10  * 60 },
    { iana: "Australia/Melbourne",            label: "(UTC+10:00) Melbourne",            offsetMinutes:  10  * 60 },
    { iana: "Australia/Brisbane",             label: "(UTC+10:00) Brisbane",             offsetMinutes:  10  * 60 },
    { iana: "Australia/Hobart",               label: "(UTC+10:00) Hobart",               offsetMinutes:  10  * 60 },
    { iana: "Pacific/Auckland",               label: "(UTC+12:00) Auckland",             offsetMinutes:  12  * 60 },
    { iana: "Pacific/Honolulu",               label: "(UTC-10:00) Honolulu",             offsetMinutes: -10  * 60 },
    { iana: "America/Anchorage",              label: "(UTC-09:00) Anchorage",            offsetMinutes:  -9  * 60 },
    { iana: "America/Los_Angeles",            label: "(UTC-08:00) Los Angeles",          offsetMinutes:  -8  * 60 },
    { iana: "America/Vancouver",              label: "(UTC-08:00) Vancouver",            offsetMinutes:  -8  * 60 },
    { iana: "America/Tijuana",                label: "(UTC-08:00) Tijuana",              offsetMinutes:  -8  * 60 },
    { iana: "America/Denver",                 label: "(UTC-07:00) Denver",               offsetMinutes:  -7  * 60 },
    { iana: "America/Phoenix",                label: "(UTC-07:00) Phoenix",              offsetMinutes:  -7  * 60 },
    { iana: "America/Edmonton",               label: "(UTC-07:00) Edmonton",             offsetMinutes:  -7  * 60 },
    { iana: "America/Mazatlan",               label: "(UTC-07:00) Mazatlán",             offsetMinutes:  -7  * 60 },
    { iana: "America/Chicago",                label: "(UTC-06:00) Chicago",              offsetMinutes:  -6  * 60 },
    { iana: "America/Mexico_City",            label: "(UTC-06:00) Mexico City",          offsetMinutes:  -6  * 60 },
    { iana: "America/Monterrey",              label: "(UTC-06:00) Monterrey",            offsetMinutes:  -6  * 60 },
    { iana: "America/Winnipeg",               label: "(UTC-06:00) Winnipeg",             offsetMinutes:  -6  * 60 },
    { iana: "America/Regina",                 label: "(UTC-06:00) Regina",               offsetMinutes:  -6  * 60 },
    { iana: "America/Cancun",                 label: "(UTC-05:00) Cancún",               offsetMinutes:  -5  * 60 },
    { iana: "America/New_York",               label: "(UTC-05:00) New York",             offsetMinutes:  -5  * 60 },
    { iana: "America/Toronto",                label: "(UTC-05:00) Toronto",              offsetMinutes:  -5  * 60 },
    { iana: "America/Bogota",                 label: "(UTC-05:00) Bogotá",               offsetMinutes:  -5  * 60 },
    { iana: "America/Halifax",                label: "(UTC-04:00) Halifax",              offsetMinutes:  -4  * 60 },
    { iana: "America/Santiago",               label: "(UTC-04:00) Santiago",             offsetMinutes:  -4  * 60 },
    { iana: "America/Manaus",                 label: "(UTC-04:00) Manaus",               offsetMinutes:  -4  * 60 },
    { iana: "America/St_Johns",               label: "(UTC-03:30) St. John's",           offsetMinutes:  -3  * 60 - 30 },
    { iana: "America/Sao_Paulo",              label: "(UTC-03:00) São Paulo",            offsetMinutes:  -3  * 60 },
    { iana: "America/Argentina/Buenos_Aires", label: "(UTC-03:00) Buenos Aires",         offsetMinutes:  -3  * 60 },
    { iana: "America/Argentina/Cordoba",      label: "(UTC-03:00) Córdoba",              offsetMinutes:  -3  * 60 },
    { iana: "America/Argentina/Mendoza",      label: "(UTC-03:00) Mendoza",              offsetMinutes:  -3  * 60 },
    { iana: "America/Fortaleza",              label: "(UTC-03:00) Fortaleza",            offsetMinutes:  -3  * 60 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function countryByName(name: string): Country | undefined {
    return COUNTRIES.find(c => c.name === name);
}

export function timezoneLabel(iana: string): string {
    return TIMEZONES.find(t => t.iana === iana)?.label ?? iana;
}

/** Adaptive label for the middle dropdown ("State", "Emirate", "Province", …).
 *  Falls back to "State/Region" for countries not in the list. Empty string
 *  when the country has no meaningful subdivision (city-states like SG). */
export function stateLabelForCountry(country?: string): string {
    if (!country) return "State/Region";
    const c = countryByName(country);
    if (!c) return "State/Region";
    return c.stateLabel ?? "";
}

/** States for a given country name — used to populate the middle dropdown. */
export function statesForCountry(country?: string): State[] {
    if (!country) return [];
    return countryByName(country)?.states ?? [];
}

/** Cities within a specific (country, state) pair — used to populate the City
 *  dropdown after the state is picked. Falls back to the country's flat city
 *  list if state is unknown (helps legacy customer records that only carry
 *  country + city). */
export function citiesForState(country?: string, state?: string): string[] {
    if (!country) return [];
    const c = countryByName(country);
    if (!c) return [];
    if (state) {
        const s = c.states.find(x => x.name === state);
        if (s) return s.cities;
    }
    return c.states.flatMap(s => s.cities);
}

/** Look up the state that CONTAINS a given city (for legacy records that
 *  never captured state). Returns undefined when the city isn't recognized. */
export function stateForCity(country: string, city: string): State | undefined {
    const c = countryByName(country);
    if (!c) return undefined;
    return c.states.find(s => s.cities.includes(city));
}

/** Resolve a branch's IANA timezone from (country, state, city). State wins;
 *  city fallback tries every state to find the containing one; country default
 *  last. Never returns undefined. */
export function resolveBranchTimezone(country?: string, state?: string, city?: string): string {
    const c = country ? countryByName(country) : undefined;
    if (!c) return "Asia/Dubai";
    if (state) {
        const s = c.states.find(x => x.name === state);
        if (s) return s.timezone;
    }
    if (city) {
        for (const s of c.states) {
            if (s.cities.includes(city)) return s.timezone;
        }
    }
    return c.defaultTimezone;
}
