"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export function GlobalSearch() {
  const [query, setQuery] = useState("");

  return (
    <div className="relative hidden sm:block sm:max-w-xl">
      <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-muted-foreground">
        <Search className="h-4.5 w-4.5" />
      </div>
      <Input
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        placeholder="Search across leads, clients, projects..."
        className="pl-11 pr-4"
      />
    </div>
  );
}
