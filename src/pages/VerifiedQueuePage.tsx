import { useState, useMemo, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Download,
  Search,
  Edit,
  Trash2,
  Eye,
  AlertTriangle,
  ArrowUpDown,
  Users,
  ListFilter,
  Building2,
  MapPin,
  Mail,
  Phone,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { storageService } from "@/lib/db";
import { exportToExcel } from "@/lib/excelExport";
import type { ContactRecord } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import EditContactModal from "@/components/verified/EditContactModal";
import ViewCardModal from "@/components/verified/ViewCardModal";

// ─── helper: clickable card thumbnail ────────────────────────────────────────
function CardThumb({
  record,
  onClick,
}: {
  record: ContactRecord;
  onClick: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!record.originalImage) return;
    const objectUrl = URL.createObjectURL(record.originalImage);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [record.id, record.originalImage]);

  return (
    <button
      type="button"
      onClick={onClick}
      title="Click to preview card"
      className="w-12 h-8 rounded-md border border-border overflow-hidden shrink-0 bg-muted hover:opacity-80 hover:ring-2 hover:ring-primary/40 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {url ? (
        <img
          src={url}
          alt="Business card"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Eye className="w-3 h-3 text-muted-foreground/50" />
        </div>
      )}
    </button>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────
export default function VerifiedQueuePage() {
  const navigate = useNavigate();
  const records = useLiveQuery(() => storageService.getVerifiedContacts(), []);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [selectedCity, setSelectedCity] = useState<string>("ALL");
  const [selectedCountry, setSelectedCountry] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("newest");

  const [viewingRecord, setViewingRecord] = useState<ContactRecord | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ContactRecord | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<ContactRecord | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const availableCities = useMemo(() => {
    if (!records) return [];
    return Array.from(
      new Set(
        records
          .map((r) => r.verifiedData.city?.trim())
          .filter((c): c is string => Boolean(c))
      )
    ).sort();
  }, [records]);

  const availableCountries = useMemo(() => {
    if (!records) return [];
    return Array.from(
      new Set(
        records
          .map((r) => r.verifiedData.country?.trim())
          .filter((c): c is string => Boolean(c))
      )
    ).sort();
  }, [records]);

  const filteredRecords = useMemo(() => {
    let result = records || [];
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter((r) => {
        const v = r.verifiedData;
        return (
          v.fullName?.toLowerCase().includes(s) ||
          v.companyName?.toLowerCase().includes(s) ||
          v.email?.toLowerCase().includes(s) ||
          v.phone?.includes(s) ||
          v.city?.toLowerCase().includes(s) ||
          v.country?.toLowerCase().includes(s)
        );
      });
    }
    if (selectedCity !== "ALL")
      result = result.filter((r) => r.verifiedData.city?.trim() === selectedCity);
    if (selectedCountry !== "ALL")
      result = result.filter(
        (r) => r.verifiedData.country?.trim() === selectedCountry
      );

    return [...result].sort((a, b) => {
      if (sortBy === "newest")
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "oldest")
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === "name_asc") {
        const na = (a.verifiedData.fullName || a.verifiedData.companyName || "").toLowerCase();
        const nb = (b.verifiedData.fullName || b.verifiedData.companyName || "").toLowerCase();
        return na.localeCompare(nb);
      }
      if (sortBy === "name_desc") {
        const na = (a.verifiedData.fullName || a.verifiedData.companyName || "").toLowerCase();
        const nb = (b.verifiedData.fullName || b.verifiedData.companyName || "").toLowerCase();
        return nb.localeCompare(na);
      }
      if (sortBy === "company_asc") {
        const ca = (a.verifiedData.companyName || "").toLowerCase();
        const cb = (b.verifiedData.companyName || "").toLowerCase();
        return ca.localeCompare(cb);
      }
      return 0;
    });
  }, [records, search, selectedCity, selectedCountry, sortBy]);

  const activeFilterCount = [
    search.trim() !== "",
    selectedCity !== "ALL",
    selectedCountry !== "ALL",
  ].filter(Boolean).length;

  const allSelected =
    filteredRecords.length > 0 && selectedIds.size === filteredRecords.length;

  const handleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredRecords.map((r) => r.id)));
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleExport = (exportSelectedOnly = false) => {
    let data = records || [];
    if (exportSelectedOnly) data = data.filter((r) => selectedIds.has(r.id));
    if (data.length === 0) {
      toast.error("No contacts available to export");
      return;
    }
    exportToExcel(
      data,
      `verified-contacts-${new Date().toISOString().split("T")[0]}.xlsx`
    );
    toast.success(`Exported ${data.length} contacts successfully`);
  };

  const confirmDelete = async () => {
    if (!deletingRecord) return;
    try {
      await storageService.deleteContact(deletingRecord.id);
      const next = new Set(selectedIds);
      next.delete(deletingRecord.id);
      setSelectedIds(next);
      toast.success("Contact deleted.");
    } catch {
      toast.error("Failed to delete contact.");
    } finally {
      setIsDeleteModalOpen(false);
      setDeletingRecord(null);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setSelectedCity("ALL");
    setSelectedCountry("ALL");
    setSortBy("newest");
  };

  if (!records) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-24">
      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">
            Verified Contacts
          </h1>

          {/* Export buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {selectedIds.size > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 sm:h-9 text-xs sm:text-sm border-[#007BC2]/40 hover:bg-[#007BC2]/10 text-[#007BC2] font-semibold rounded-xl px-2.5 sm:px-3"
                onClick={() => handleExport(true)}
              >
                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-1.5 text-[#007BC2]" />
                <span className="hidden xs:inline">Export Selected</span>
                <span className="xs:hidden">Selected</span>
                <span className="ml-1 sm:ml-1.5 bg-[#007BC2] text-white text-[10px] sm:text-xs rounded-full px-1.5 py-0.5 leading-none font-bold">
                  {selectedIds.size}
                </span>
              </Button>
            )}
            <Button
              size="sm"
              className="h-8 sm:h-9 text-xs sm:text-sm bg-[#007BC2] hover:bg-[#0064a0] text-white font-semibold rounded-xl shadow-xs px-2.5 sm:px-3"
              onClick={() => handleExport(false)}
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-1.5 text-white" />
              Export to Excel
            </Button>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-muted-foreground">
          Review, filter, edit and export your verified business card contacts.
        </p>
      </div>


      {/* ── Table Container ──────────────────────────────────────── */}
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">

        {/* Filter Toolbar */}
        <div className="p-4 sm:p-5 border-b bg-muted/30 space-y-3">
          {/* Row 1: Search + active filter badge */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search by name, company, email, city…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 bg-background border-border focus-visible:ring-primary/30 text-sm w-full"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {activeFilterCount > 0 && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0 h-10 px-3 rounded-md border bg-background hover:bg-muted"
              >
                <X className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset</span>
                <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {activeFilterCount}
                </span>
              </button>
            )}
          </div>

          {/* Row 2: Dropdowns + Select All */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {/* City */}
            <Select value={selectedCity} onValueChange={(val) => val && setSelectedCity(val)}>
              <SelectTrigger
                className={`h-9 w-auto min-w-[130px] text-xs font-semibold rounded-xl bg-background border-border transition-colors gap-1.5 ${selectedCity !== "ALL"
                    ? "border-[#007BC2] text-[#007BC2] bg-[#007BC2]/10 font-bold"
                    : "hover:border-[#007BC2]/50"
                  }`}
              >
                <MapPin className={`w-3.5 h-3.5 shrink-0 ${selectedCity !== "ALL" ? "text-[#007BC2]" : "text-muted-foreground"}`} />
                <SelectValue placeholder="City: All" />
              </SelectTrigger>
              <SelectContent side="bottom" sideOffset={6} align="start" className="min-w-[160px]">
                <SelectItem value="ALL">All Cities</SelectItem>
                {availableCities.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Country */}
            <Select value={selectedCountry} onValueChange={(val) => val && setSelectedCountry(val)}>
              <SelectTrigger
                className={`h-9 w-auto min-w-[140px] text-xs font-semibold rounded-xl bg-background border-border transition-colors gap-1.5 ${selectedCountry !== "ALL"
                    ? "border-[#007BC2] text-[#007BC2] bg-[#007BC2]/10 font-bold"
                    : "hover:border-[#007BC2]/50"
                  }`}
              >
                <ListFilter className={`w-3.5 h-3.5 shrink-0 ${selectedCountry !== "ALL" ? "text-[#007BC2]" : "text-muted-foreground"}`} />
                <SelectValue placeholder="Country: All" />
              </SelectTrigger>
              <SelectContent side="bottom" sideOffset={6} align="start" className="min-w-[180px]">
                <SelectItem value="ALL">All Countries</SelectItem>
                {availableCountries.map((country) => (
                  <SelectItem key={country} value={country}>
                    {country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortBy} onValueChange={(val) => val && setSortBy(val)}>
              <SelectTrigger className="h-9 w-auto min-w-[150px] text-xs font-semibold rounded-xl bg-background border-border hover:border-[#007BC2]/50 transition-colors gap-1.5">
                <ArrowUpDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="Sort: Newest" />
              </SelectTrigger>
              <SelectContent side="bottom" sideOffset={6} align="start" className="min-w-[170px]">
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="name_asc">Name A → Z</SelectItem>
                <SelectItem value="name_desc">Name Z → A</SelectItem>
                <SelectItem value="company_asc">Company A → Z</SelectItem>
              </SelectContent>
            </Select>


            {/* Divider */}
            <div className="h-6 w-px bg-border mx-1 hidden sm:block" />

            {/* Select All */}
            {/* <Button
              variant={allSelected ? "secondary" : "ghost"}
              size="sm"
              onClick={handleSelectAll}
              disabled={filteredRecords.length === 0}
              className="h-9 px-3 text-xs font-medium gap-1.5"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              {allSelected ? "Deselect All" : "Select All"}
            </Button> */}
          </div>
        </div>

        {/* ── Empty State ─────────────────────────────────────────── */}
        {filteredRecords.length === 0 ? (
          <div className="py-20 px-6 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm">
              <Users className="w-8 h-8" />
            </div>
            <div className="space-y-1.5 max-w-sm">
              <h3 className="text-xl font-bold text-foreground tracking-tight">
                {records.length === 0 ? "No verified contacts yet" : "No matching contacts found"}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {records.length === 0
                  ? "Your scanned business cards will appear here after you review and save them."
                  : "No contacts match your current search filters. Try adjusting or resetting them."}
              </p>
            </div>
            {records.length === 0 ? (
              <Button
                size="default"
                className="mt-2 h-11 px-7 rounded-xl font-semibold text-xs bg-[#007BC2] hover:bg-[#0064a0] text-white shadow-md shadow-[#007BC2]/20"
                onClick={() => navigate("/")}
              >
                Scan Your First Card
              </Button>

            ) : (
              activeFilterCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 h-9 text-xs rounded-xl"
                  onClick={resetFilters}
                >
                  <X className="w-3.5 h-3.5 mr-1.5" />
                  Reset Filters
                </Button>
              )
            )}
          </div>
        ) : (
          <>
            {/* ── Desktop Table ───────────────────────────────────── */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="w-12 px-5 py-3.5 text-center">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all"
                        className="translate-y-px"
                      />
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Contact
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Company
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Details
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Location
                    </th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredRecords.map((record: ContactRecord) => {
                    const v = record.verifiedData;
                    const location = [v.city, v.country]
                      .filter(Boolean)
                      .join(", ");
                    const isSelected = selectedIds.has(record.id);
                    return (
                      <tr
                        key={record.id}
                        className={`group transition-colors ${isSelected
                          ? "bg-primary/5 hover:bg-primary/8"
                          : "hover:bg-muted/40"
                          }`}
                      >
                        {/* Checkbox */}
                        <td className="px-5 py-4 text-center">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(record.id)}
                            className="translate-y-px"
                          />
                        </td>

                        {/* Contact */}
                        <td className="px-4 py-4 min-w-[180px]">
                          <div className="flex items-center gap-3">
                            <CardThumb
                              record={record}
                              onClick={() => {
                                setViewingRecord(record);
                                setIsViewModalOpen(true);
                              }}
                            />
                            <div className="min-w-0">
                              <div className="font-semibold text-foreground truncate">
                                {v.fullName || "—"}
                              </div>
                              {v.jobTitle && (
                                <div className="text-xs text-muted-foreground truncate mt-0.5">
                                  {v.jobTitle}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Company */}
                        <td className="px-4 py-4 min-w-[140px]">
                          {v.companyName ? (
                            <div className="flex items-center gap-2">
                              <Building2 className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                              <span className="font-medium text-foreground truncate">
                                {v.companyName}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Contact Details */}
                        <td className="px-4 py-4 min-w-[200px]">
                          <div className="space-y-1">
                            {v.email && (
                              <div className="flex items-center gap-1.5">
                                <Mail className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                                <span className="text-sm text-foreground truncate">
                                  {v.email}
                                </span>
                              </div>
                            )}
                            {v.phone && (
                              <div className="flex items-center gap-1.5">
                                <Phone className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                                <span className="text-xs text-muted-foreground">
                                  {v.phone}
                                </span>
                              </div>
                            )}
                            {!v.email && !v.phone && (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </div>
                        </td>

                        {/* Location */}
                        <td className="px-4 py-4 min-w-[140px]">
                          {location ? (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                              <span className="text-sm font-medium text-foreground">
                                {location}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="View Card"
                              className="h-8 w-8 rounded-lg hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400"
                              onClick={() => {
                                setViewingRecord(record);
                                setIsViewModalOpen(true);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Edit Contact"
                              className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary"
                              onClick={() => {
                                setEditingRecord(record);
                                setIsEditModalOpen(true);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Delete Contact"
                              className="h-8 w-8 rounded-lg hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                              onClick={() => {
                                setDeletingRecord(record);
                                setIsDeleteModalOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Table footer count */}
              <div className="px-5 py-3 border-t bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {filteredRecords.length === records.length
                    ? `${records.length} contact${records.length !== 1 ? "s" : ""}`
                    : `${filteredRecords.length} of ${records.length} contacts`}
                </span>
                {selectedIds.size > 0 && (
                  <span className="font-medium text-primary">
                    {selectedIds.size} selected
                  </span>
                )}
              </div>
            </div>

            {/* ── Mobile / Tablet Cards ────────────────────────────── */}
            <div className="lg:hidden">
              {/* Mobile Select All bar */}
              <div className="px-4 py-2.5 border-b bg-muted/20 flex items-center justify-between">
                <button
                  onClick={handleSelectAll}
                  className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                    className="pointer-events-none"
                  />
                  {allSelected ? "Deselect All" : "Select All"}
                </button>
                <span className="text-xs text-muted-foreground">
                  {filteredRecords.length} contact{filteredRecords.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="p-4 space-y-3">
                {filteredRecords.map((record: ContactRecord) => {
                  const v = record.verifiedData;
                  const location = [v.city, v.country]
                    .filter(Boolean)
                    .join(", ");
                  const isSelected = selectedIds.has(record.id);
                  return (
                    <div
                      key={record.id}
                      className={`rounded-xl border transition-all ${isSelected
                        ? "border-primary/40 bg-primary/5 shadow-sm"
                        : "border-border bg-card shadow-sm hover:shadow-md hover:border-border/80"
                        }`}
                    >
                      {/* Card Header */}
                      <div className="px-4 pt-4 pb-3 flex items-start gap-3">
                        <div className="mt-0.5">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(record.id)}
                          />
                        </div>
                        <CardThumb
                          record={record}
                          onClick={() => {
                            setViewingRecord(record);
                            setIsViewModalOpen(true);
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-foreground text-sm truncate">
                            {v.fullName || "—"}
                          </div>
                          {v.jobTitle && (
                            <div className="text-xs text-muted-foreground truncate mt-0.5">
                              {v.jobTitle}
                            </div>
                          )}
                        </div>
                        {location && (
                          <span className="text-[10px] font-semibold shrink-0 ml-auto bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                            {location}
                          </span>
                        )}
                      </div>

                      {/* Card Body */}
                      <div className="px-4 pb-3 space-y-2">
                        {v.companyName && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Building2 className="w-3.5 h-3.5 shrink-0" />
                            <span className="font-medium text-foreground truncate">
                              {v.companyName}
                            </span>
                          </div>
                        )}
                        {v.email && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Mail className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{v.email}</span>
                          </div>
                        )}
                        {v.phone && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Phone className="w-3.5 h-3.5 shrink-0" />
                            <span>{v.phone}</span>
                          </div>
                        )}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="px-4 py-3 border-t border-border/60 flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 text-xs font-semibold rounded-xl border-[#007BC2]/30 text-[#007BC2] bg-[#007BC2]/5 hover:bg-[#007BC2]/15 gap-1.5"
                          onClick={() => {
                            setViewingRecord(record);
                            setIsViewModalOpen(true);
                          }}
                        >
                          <Eye className="w-3.5 h-3.5 text-[#007BC2]" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 text-xs font-semibold rounded-xl border-[#007BC2]/30 text-[#007BC2] bg-[#007BC2]/5 hover:bg-[#007BC2]/15 gap-1.5"
                          onClick={() => {
                            setEditingRecord(record);
                            setIsEditModalOpen(true);
                          }}
                        >
                          <Edit className="w-3.5 h-3.5 text-[#007BC2]" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-3 text-xs font-semibold rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 gap-1.5"
                          onClick={() => {
                            setDeletingRecord(record);
                            setIsDeleteModalOpen(true);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Modals ───────────────────────────────────────────────── */}
      <ViewCardModal
        isOpen={isViewModalOpen}
        setIsOpen={setIsViewModalOpen}
        record={viewingRecord}
      />
      <EditContactModal
        isOpen={isEditModalOpen}
        setIsOpen={setIsEditModalOpen}
        record={editingRecord}
      />

      {/* Delete Confirmation */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader className="flex flex-row items-start gap-4 space-y-0">
            <div className="bg-red-100 dark:bg-red-900/30 p-2.5 rounded-xl text-red-600 dark:text-red-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-base font-semibold">
                Delete Contact
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-foreground">
                  {deletingRecord?.verifiedData.fullName ||
                    deletingRecord?.verifiedData.companyName ||
                    "this contact"}
                </span>
                ? This action cannot be undone.
              </DialogDescription>
            </div>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteModalOpen(false)}
              className="h-9 px-4 text-xs font-semibold rounded-xl border-[#007BC2]/40 text-[#007BC2] bg-[#007BC2]/5 hover:bg-[#007BC2]/15 hover:border-[#007BC2]"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={confirmDelete}
            >
              Delete Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
