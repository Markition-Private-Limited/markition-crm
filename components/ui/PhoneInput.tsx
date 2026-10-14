"use client";

import * as React from "react";
import { ChevronDown, Search } from "lucide-react";

type Country = { code: string; name: string; dial: string };

const POPULAR_CODES = ["PK", "US", "GB", "AE", "SA", "IN", "CA", "AU"];

const ALL_COUNTRIES: Country[] = [
  { code: "AF", name: "Afghanistan",           dial: "+93"   },
  { code: "AL", name: "Albania",               dial: "+355"  },
  { code: "DZ", name: "Algeria",               dial: "+213"  },
  { code: "AR", name: "Argentina",             dial: "+54"   },
  { code: "AU", name: "Australia",             dial: "+61"   },
  { code: "AT", name: "Austria",               dial: "+43"   },
  { code: "BH", name: "Bahrain",               dial: "+973"  },
  { code: "BD", name: "Bangladesh",            dial: "+880"  },
  { code: "BE", name: "Belgium",               dial: "+32"   },
  { code: "BR", name: "Brazil",                dial: "+55"   },
  { code: "CA", name: "Canada",                dial: "+1"    },
  { code: "CN", name: "China",                 dial: "+86"   },
  { code: "CO", name: "Colombia",              dial: "+57"   },
  { code: "HR", name: "Croatia",               dial: "+385"  },
  { code: "CY", name: "Cyprus",                dial: "+357"  },
  { code: "CZ", name: "Czech Republic",        dial: "+420"  },
  { code: "DK", name: "Denmark",               dial: "+45"   },
  { code: "EG", name: "Egypt",                 dial: "+20"   },
  { code: "FI", name: "Finland",               dial: "+358"  },
  { code: "FR", name: "France",                dial: "+33"   },
  { code: "DE", name: "Germany",               dial: "+49"   },
  { code: "GH", name: "Ghana",                 dial: "+233"  },
  { code: "GR", name: "Greece",                dial: "+30"   },
  { code: "HK", name: "Hong Kong",             dial: "+852"  },
  { code: "HU", name: "Hungary",               dial: "+36"   },
  { code: "IN", name: "India",                 dial: "+91"   },
  { code: "ID", name: "Indonesia",             dial: "+62"   },
  { code: "IR", name: "Iran",                  dial: "+98"   },
  { code: "IQ", name: "Iraq",                  dial: "+964"  },
  { code: "IE", name: "Ireland",               dial: "+353"  },
  { code: "IL", name: "Israel",                dial: "+972"  },
  { code: "IT", name: "Italy",                 dial: "+39"   },
  { code: "JP", name: "Japan",                 dial: "+81"   },
  { code: "JO", name: "Jordan",                dial: "+962"  },
  { code: "KZ", name: "Kazakhstan",            dial: "+7"    },
  { code: "KE", name: "Kenya",                 dial: "+254"  },
  { code: "KW", name: "Kuwait",                dial: "+965"  },
  { code: "LB", name: "Lebanon",               dial: "+961"  },
  { code: "LY", name: "Libya",                 dial: "+218"  },
  { code: "MY", name: "Malaysia",              dial: "+60"   },
  { code: "MV", name: "Maldives",              dial: "+960"  },
  { code: "MX", name: "Mexico",                dial: "+52"   },
  { code: "MA", name: "Morocco",               dial: "+212"  },
  { code: "MM", name: "Myanmar",               dial: "+95"   },
  { code: "NL", name: "Netherlands",           dial: "+31"   },
  { code: "NZ", name: "New Zealand",           dial: "+64"   },
  { code: "NG", name: "Nigeria",               dial: "+234"  },
  { code: "NO", name: "Norway",                dial: "+47"   },
  { code: "OM", name: "Oman",                  dial: "+968"  },
  { code: "PK", name: "Pakistan",              dial: "+92"   },
  { code: "PS", name: "Palestine",             dial: "+970"  },
  { code: "PH", name: "Philippines",           dial: "+63"   },
  { code: "PL", name: "Poland",                dial: "+48"   },
  { code: "PT", name: "Portugal",              dial: "+351"  },
  { code: "QA", name: "Qatar",                 dial: "+974"  },
  { code: "RO", name: "Romania",               dial: "+40"   },
  { code: "RU", name: "Russia",                dial: "+7"    },
  { code: "SA", name: "Saudi Arabia",          dial: "+966"  },
  { code: "SN", name: "Senegal",               dial: "+221"  },
  { code: "SG", name: "Singapore",             dial: "+65"   },
  { code: "ZA", name: "South Africa",          dial: "+27"   },
  { code: "KR", name: "South Korea",           dial: "+82"   },
  { code: "ES", name: "Spain",                 dial: "+34"   },
  { code: "LK", name: "Sri Lanka",             dial: "+94"   },
  { code: "SE", name: "Sweden",                dial: "+46"   },
  { code: "CH", name: "Switzerland",           dial: "+41"   },
  { code: "SY", name: "Syria",                 dial: "+963"  },
  { code: "TW", name: "Taiwan",                dial: "+886"  },
  { code: "TZ", name: "Tanzania",              dial: "+255"  },
  { code: "TH", name: "Thailand",              dial: "+66"   },
  { code: "TN", name: "Tunisia",               dial: "+216"  },
  { code: "TR", name: "Turkey",                dial: "+90"   },
  { code: "UG", name: "Uganda",                dial: "+256"  },
  { code: "UA", name: "Ukraine",               dial: "+380"  },
  { code: "AE", name: "United Arab Emirates",  dial: "+971"  },
  { code: "GB", name: "United Kingdom",        dial: "+44"   },
  { code: "US", name: "United States",         dial: "+1"    },
  { code: "UZ", name: "Uzbekistan",            dial: "+998"  },
  { code: "VN", name: "Vietnam",               dial: "+84"   },
  { code: "YE", name: "Yemen",                 dial: "+967"  },
  { code: "ZM", name: "Zambia",                dial: "+260"  },
  { code: "ZW", name: "Zimbabwe",              dial: "+263"  },
];

const POPULAR = POPULAR_CODES.map((c) => ALL_COUNTRIES.find((x) => x.code === c)!).filter(Boolean);
const DEFAULT_COUNTRY = ALL_COUNTRIES.find((c) => c.code === "PK")!;

// Flag image via flagcdn.com — works on all platforms, no emoji font needed
function Flag({ code, size = 20 }: { code: string; size?: number }) {
  const h = Math.round(size * 0.75);
  return (
    <img
      src={`https://flagcdn.com/w${size}/${code.toLowerCase()}.png`}
      srcSet={`https://flagcdn.com/w${size * 2}/${code.toLowerCase()}.png 2x`}
      width={size}
      height={h}
      alt={code}
      className="inline-block rounded-[2px] object-cover"
      style={{ minWidth: size }}
    />
  );
}

function detectCountry(value: string): { country: Country; local: string } {
  if (!value) return { country: DEFAULT_COUNTRY, local: "" };
  const sorted = [...ALL_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (value.startsWith(c.dial)) {
      return { country: c, local: value.slice(c.dial.length).trimStart() };
    }
  }
  return { country: DEFAULT_COUNTRY, local: value };
}

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

export function PhoneInput({ value, onChange, placeholder = "300 1234567", className = "", id }: PhoneInputProps) {
  const { country: initialCountry, local: initialLocal } = React.useMemo(() => detectCountry(value), []);

  const [country, setCountry] = React.useState<Country>(initialCountry);
  const [local, setLocal] = React.useState(initialLocal);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const prevValue = React.useRef(value);
  React.useEffect(() => {
    if (value === prevValue.current) return;
    prevValue.current = value;
    const { country: c, local: l } = detectCountry(value);
    setCountry(c);
    setLocal(l);
  }, [value]);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  React.useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  const emit = (c: Country, l: string) => {
    const full = l.trim() ? `${c.dial} ${l.trim()}` : "";
    prevValue.current = full;
    onChange(full);
  };

  const handleCountrySelect = (c: Country) => {
    setCountry(c);
    setOpen(false);
    setQuery("");
    emit(c, local);
  };

  const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const l = e.target.value.replace(/[^\d\s\-().]/g, "");
    setLocal(l);
    emit(country, l);
  };

  const filtered = React.useMemo(() => {
    if (!query) return null;
    const q = query.toLowerCase();
    return ALL_COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div ref={wrapRef} className={`relative flex h-10 overflow-visible rounded-[16px] border border-border bg-surface focus-within:border-accent focus-within:ring-2 focus-within:ring-ring/20 ${className}`}>
      {/* Flag + dial code trigger */}
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setQuery(""); }}
        className="flex shrink-0 items-center gap-2 rounded-l-[15px] border-r border-border bg-surface-muted px-3 text-sm font-medium text-foreground hover:bg-surface-elevated transition-colors"
      >
        <Flag code={country.code} size={20} />
        <span className="text-muted-foreground">{country.dial}</span>
        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Number input */}
      <input
        id={id}
        type="tel"
        value={local}
        onChange={handleLocalChange}
        placeholder={placeholder}
        maxLength={15}
        className="min-w-0 flex-1 bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
      />

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-[18px] border border-border bg-surface shadow-2xl shadow-black/20">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country or code…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {filtered ? (
              filtered.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">No results</p>
              ) : (
                filtered.map((c) => <CountryRow key={c.code} country={c} selected={c.code === country.code} onSelect={handleCountrySelect} />)
              )
            ) : (
              <>
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Popular</p>
                {POPULAR.map((c) => <CountryRow key={c.code} country={c} selected={c.code === country.code} onSelect={handleCountrySelect} />)}
                <div className="my-1 border-t border-border" />
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">All Countries</p>
                {ALL_COUNTRIES.map((c) => <CountryRow key={c.code} country={c} selected={c.code === country.code} onSelect={handleCountrySelect} />)}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CountryRow({ country, selected, onSelect }: { country: Country; selected: boolean; onSelect: (c: Country) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(country)}
      className={`flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2 text-left text-sm transition-colors hover:bg-surface-muted ${selected ? "bg-accent/10 text-accent" : "text-foreground"}`}
    >
      <Flag code={country.code} size={20} />
      <span className="flex-1 truncate">{country.name}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{country.dial}</span>
    </button>
  );
}
