"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Shuffle, Trash2, Upload, Image as ImageIcon, X, ShoppingBag } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { FormActions, ModuleHeader, Notice } from "@/components/crud-ui";
import {
  DEFAULT_DASHBOARD_QUOTES,
  normalizeDashboardMotivation,
} from "@/lib/dashboard-personalization";

type F = {
  name: string;
  address: string;
  whatsapp: string;
  email: string;
  timezone: string;
  currency: string;
  invoice_prefix: string;
  order_prefix: string;
  sku_prefix: string;
};

const empty: F = {
  name: "",
  address: "",
  whatsapp: "",
  email: "",
  timezone: "Asia/Jakarta",
  currency: "IDR",
  invoice_prefix: "INV",
  order_prefix: "ORD",
  sku_prefix: "SKU",
};

const cleanPrefix = (value: string, fallback: string) =>
  value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 12) || fallback;

export function BusinessSettingsManager({ businessId, role }: { businessId: string; role: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<F>(empty);
  const [provider, setProvider] = useState("manual");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [useLogoAsFavicon, setUseLogoAsFavicon] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [logoPreviewError, setLogoPreviewError] = useState(false);
  const [faviconPreviewError, setFaviconPreviewError] = useState(false);
  const [autoReminder, setAutoReminder] = useState(false);
  const [catalogEnabled, setCatalogEnabled] = useState(false);
  const [catalogDescription, setCatalogDescription] = useState("Bagikan katalog dan terima pesanan online dengan lebih rapi.");
  const [catalogShowPrices, setCatalogShowPrices] = useState(true);
  const [catalogAcceptOrders, setCatalogAcceptOrders] = useState(true);
  const [motivationEnabled, setMotivationEnabled] = useState(true);
  const [quotes, setQuotes] = useState<string[]>([...DEFAULT_DASHBOARD_QUOTES]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const canOwner = role === "owner";

  useEffect(() => {
    void (async () => {
      const [{ data: b }, { data: s }] = await Promise.all([
        supabase
          .from("businesses")
          .select("name,address,whatsapp,email,timezone,currency,invoice_prefix,order_prefix,sku_prefix,logo_url")
          .eq("id", businessId)
          .single(),
        supabase
          .from("business_settings")
          .select("key,value")
          .eq("business_id", businessId)
          .in("key", ["whatsapp_provider", "auto_reminder", "dashboard_motivation", "favicon_url", "use_logo_as_favicon", "catalog_enabled", "catalog_description", "catalog_show_prices", "catalog_accept_orders"]),
      ]);

      if (b) {
        setLogoUrl(b.logo_url ? String(b.logo_url) : null);
        setLogoPreviewError(false);
        setForm({
          name: b.name,
          address: b.address ?? "",
          whatsapp: b.whatsapp ?? "",
          email: b.email ?? "",
          timezone: b.timezone ?? "Asia/Jakarta",
          currency: b.currency ?? "IDR",
          invoice_prefix: b.invoice_prefix ?? "INV",
          order_prefix: b.order_prefix ?? "ORD",
          sku_prefix: b.sku_prefix ?? "SKU",
        });
      }

      for (const row of s ?? []) {
        if (row.key === "whatsapp_provider") {
          setProvider(String((row.value as Record<string, unknown>)?.provider ?? "manual"));
        }
        if (row.key === "auto_reminder") {
          setAutoReminder(Boolean((row.value as Record<string, unknown>)?.enabled));
        }
        if (row.key === "favicon_url") { setFaviconUrl(String((row.value as Record<string, unknown>)?.url ?? "") || null); setFaviconPreviewError(false); }
        if (row.key === "use_logo_as_favicon") setUseLogoAsFavicon(Boolean((row.value as Record<string, unknown>)?.enabled ?? true));
        if (row.key === "catalog_enabled") setCatalogEnabled(Boolean((row.value as Record<string, unknown>)?.enabled));
        if (row.key === "catalog_description") setCatalogDescription(String((row.value as Record<string, unknown>)?.text ?? ""));
        if (row.key === "catalog_show_prices") setCatalogShowPrices(Boolean((row.value as Record<string, unknown>)?.enabled ?? true));
        if (row.key === "catalog_accept_orders") setCatalogAcceptOrders(Boolean((row.value as Record<string, unknown>)?.enabled ?? true));
        if (row.key === "dashboard_motivation") {
          const parsed = normalizeDashboardMotivation(row.value);
          setMotivationEnabled(parsed.enabled);
          setQuotes(parsed.quotes);
        }
      }
    })();
  }, [businessId, supabase]);

  function updateQuote(index: number, value: string) {
    setQuotes((current) => current.map((quote, i) => (i === index ? value : quote)));
  }

  function addQuote() {
    setQuotes((current) => (current.length >= 20 ? current : [...current, ""]));
  }

  function removeQuote(index: number) {
    setQuotes((current) => {
      const next = current.filter((_, i) => i !== index);
      return next.length ? next : [""];
    });
  }

  function resetQuotes() {
    setQuotes([...DEFAULT_DASHBOARD_QUOTES]);
    setMotivationEnabled(true);
  }

  async function uploadBrandAsset(kind: "logo" | "favicon", file: File) {
    if (!canOwner) return;
    const setter = kind === "logo" ? setUploadingLogo : setUploadingFavicon;
    setter(true);
    setMsg(null);
    try {
      if (!file.type.startsWith("image/")) throw new Error("File harus berupa gambar.");
      if (file.size > 2 * 1024 * 1024) throw new Error("Ukuran file maksimal 2 MB.");
      const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
      const path = `${businessId}/${kind}-${Date.now()}.${ext}`;
      const bucket = supabase.storage.from("branding");
      const { error: uploadError } = await bucket.upload(path, file, {
        cacheControl: "3600", upsert: true, contentType: file.type,
      });
      if (uploadError) {
        const message = String(uploadError.message || "");
        if (/bucket.*not found|not found.*bucket/i.test(message)) {
          throw new Error("Storage branding belum tersedia. Jalankan migration supabase/migrations/202609240005_branding_uploads_hardening.sql di Supabase, lalu coba upload lagi.");
        }
        if (/row-level security|rls|policy/i.test(message)) {
          throw new Error(`Upload ditolak oleh policy Storage branding. Pastikan migration 202609240005_branding_uploads_hardening.sql sudah dijalankan dan akun ini adalah Owner aktif. Detail: ${message}`);
        }
        throw uploadError;
      }
      const { data } = supabase.storage.from("branding").getPublicUrl(path);
      const url = `${data.publicUrl}?v=${Date.now()}`;
      if (kind === "logo") {
        const { data: savedBusiness, error } = await supabase
          .from("businesses")
          .update({ logo_url: url })
          .eq("id", businessId)
          .select("id,logo_url")
          .single();
        if (error) throw error;
        const savedUrl = String(savedBusiness?.logo_url ?? "");
        if (!savedUrl) throw new Error("Logo berhasil di-upload tetapi belum tersimpan di data usaha.");
        setLogoUrl(savedUrl);
        setLogoPreviewError(false);
      } else {
        const { error } = await supabase.from("business_settings").upsert({ business_id: businessId, key: "favicon_url", value: { url } }, { onConflict: "business_id,key" });
        if (error) throw error;
        setFaviconUrl(url);
        setFaviconPreviewError(false);
      }
      window.dispatchEvent(new CustomEvent("imersorder:branding-updated", { detail: { logoUrl: kind === "logo" ? url : logoUrl, faviconUrl: kind === "favicon" ? url : faviconUrl } }));
      setMsg({ kind: "success", text: `${kind === "logo" ? "Logo" : "Favicon"} berhasil diperbarui.` });
    } catch (e) {
      const err = e as { message?: string; details?: string; hint?: string; code?: string; statusCode?: string | number };
      const detail = [err?.message, err?.details, err?.hint].filter(Boolean).join(" — ");
      const text = detail || (e instanceof Error ? e.message : "Gagal mengunggah gambar.");
      setMsg({ kind: "error", text });
    } finally {
      setter(false);
    }
  }

  async function removeBrandAsset(kind: "logo" | "favicon") {
    if (!canOwner) return;
    setMsg(null);
    if (kind === "logo") {
      const { error } = await supabase.from("businesses").update({ logo_url: null }).eq("id", businessId);
      if (error) return setMsg({ kind: "error", text: error.message });
      setLogoUrl(null);
      setLogoPreviewError(false);
    } else {
      const { error } = await supabase.from("business_settings").upsert({ business_id: businessId, key: "favicon_url", value: { url: null } }, { onConflict: "business_id,key" });
      if (error) return setMsg({ kind: "error", text: error.message });
      setFaviconUrl(null);
      setFaviconPreviewError(false);
    }
    window.dispatchEvent(new Event("imersorder:branding-updated"));
    setMsg({ kind: "success", text: `${kind === "logo" ? "Logo" : "Favicon"} dihapus.` });
  }

  async function saveFaviconPreference(enabled: boolean) {
    setUseLogoAsFavicon(enabled);
    if (!canOwner) return;
    const { error } = await supabase.from("business_settings").upsert({ business_id: businessId, key: "use_logo_as_favicon", value: { enabled } }, { onConflict: "business_id,key" });
    if (error) setMsg({ kind: "error", text: error.message });
    window.dispatchEvent(new Event("imersorder:branding-updated"));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canOwner) {
      setMsg({ kind: "error", text: "Hanya owner yang dapat mengubah pengaturan usaha." });
      return;
    }

    const cleanedQuotes = quotes.map((quote) => quote.trim()).filter(Boolean).slice(0, 20);
    if (motivationEnabled && cleanedQuotes.length === 0) {
      setMsg({ kind: "error", text: "Isi minimal satu quote motivasi atau nonaktifkan quote dashboard." });
      return;
    }

    setSaving(true);
    setMsg(null);
    const skuPrefix = cleanPrefix(form.sku_prefix, "SKU");
    const { error } = await supabase
      .from("businesses")
      .update({
        ...form,
        name: form.name.trim(),
        address: form.address.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        email: form.email.trim() || null,
        invoice_prefix: cleanPrefix(form.invoice_prefix, "INV"),
        order_prefix: cleanPrefix(form.order_prefix, "ORD"),
        sku_prefix: skuPrefix,
      })
      .eq("id", businessId);

    if (!error) {
      const settings = await supabase.from("business_settings").upsert(
        [
          { business_id: businessId, key: "whatsapp_provider", value: { provider } },
          { business_id: businessId, key: "auto_reminder", value: { enabled: provider !== "manual" && autoReminder } },
          { business_id: businessId, key: "use_logo_as_favicon", value: { enabled: useLogoAsFavicon } },
          { business_id: businessId, key: "catalog_enabled", value: { enabled: catalogEnabled } },
          { business_id: businessId, key: "catalog_description", value: { text: catalogDescription.trim() } },
          { business_id: businessId, key: "catalog_show_prices", value: { enabled: catalogShowPrices } },
          { business_id: businessId, key: "catalog_accept_orders", value: { enabled: catalogAcceptOrders } },
          {
            business_id: businessId,
            key: "dashboard_motivation",
            value: { enabled: motivationEnabled, quotes: cleanedQuotes },
          },
        ],
        { onConflict: "business_id,key" },
      );
      if (settings.error) {
        setSaving(false);
        setMsg({ kind: "error", text: settings.error.message });
        return;
      }
    }

    setSaving(false);
    if (error) {
      setMsg({ kind: "error", text: error.message });
      return;
    }

    setForm((value) => ({ ...value, sku_prefix: skuPrefix }));
    if (cleanedQuotes.length) setQuotes(cleanedQuotes);
    setMsg({ kind: "success", text: "Pengaturan usaha dan quote dashboard tersimpan." });
  }

  return (
    <>
      <ModuleHeader
        title="Pengaturan Usaha"
        subtitle="Profil, sapaan dashboard, kode otomatis, nomor dokumen, dan preferensi integrasi"
      />
      {msg ? <Notice kind={msg.kind}>{msg.text}</Notice> : null}
      <form className="formPanel" onSubmit={save}>
        <h2>Profil Usaha</h2>
        <div className="fieldGrid">
          <label className="formField full">
            Nama Usaha
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="formField full">
            Alamat
            <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </label>
          <label className="formField">
            WhatsApp
            <input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
          </label>
          <label className="formField">
            Email
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
        </div>

        <div className="settingsSectionHead">
          <div>
            <h2>Branding & Identitas</h2>
            <p>Upload logo usaha dan favicon langsung dari Pengaturan. File disimpan di Supabase Storage instalasi ini.</p>
          </div>
          <span className="settingsFeatureIcon"><ImageIcon size={17} /></span>
        </div>
        <div className="brandingCurrent">
          <div className="brandingCurrentPreview">
            {logoUrl && !logoPreviewError ? <img key={logoUrl} src={logoUrl} alt="Logo usaha yang sedang digunakan" onError={() => setLogoPreviewError(true)} /> : <ImageIcon size={34} />}
          </div>
          <div className="brandingCurrentCopy">
            <span className={logoUrl && !logoPreviewError ? "brandingStatus active" : "brandingStatus"}>{logoUrl && !logoPreviewError ? "✓ LOGO AKTIF" : "BELUM ADA LOGO"}</span>
            <strong>{logoUrl && !logoPreviewError ? "Logo ini sedang digunakan aplikasi" : "Upload logo usaha untuk mengganti identitas aplikasi"}</strong>
            <small>{logoUrl && !logoPreviewError ? "Logo yang tampil di sini akan digunakan pada header, dashboard, login, dan katalog publik." : "Setelah upload berhasil, preview ini langsung berubah agar bisa dipastikan sebelum pindah halaman."}</small>
          </div>
        </div>
        <div className="brandingUploadGrid">
          <div className="brandingUploadCard">
            <div className="brandingPreview">{logoUrl && !logoPreviewError ? <img key={logoUrl} src={logoUrl} alt="Logo usaha" onError={() => setLogoPreviewError(true)} /> : <ImageIcon size={28} />}</div>
            <div className="brandingUploadCopy"><strong>Logo Usaha</strong><small>PNG, JPG, WEBP · maksimal 2 MB</small></div>
            {canOwner ? <div className="brandingActions">
              <label className="miniButton primary"><Upload size={14} /> {uploadingLogo ? "Mengunggah..." : logoUrl ? "Ganti Logo" : "Upload Logo"}<input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={uploadingLogo} onChange={(e) => { const f=e.target.files?.[0]; if(f) void uploadBrandAsset("logo", f); e.currentTarget.value=""; }} /></label>
              {logoUrl ? <button type="button" className="miniButton danger" onClick={() => void removeBrandAsset("logo")}><X size={14}/> Hapus</button> : null}
            </div> : null}
          </div>
          <div className="brandingUploadCard">
            <div className="brandingPreview faviconPreview">{faviconUrl && !faviconPreviewError ? <img key={faviconUrl} src={faviconUrl} alt="Favicon" onError={() => setFaviconPreviewError(true)} /> : <ImageIcon size={24} />}</div>
            <div className="brandingUploadCopy"><strong>Favicon</strong><small>Ikon tab browser/PWA · maksimal 2 MB</small></div>
            {canOwner ? <div className="brandingActions">
              <label className="miniButton primary"><Upload size={14} /> {uploadingFavicon ? "Mengunggah..." : faviconUrl ? "Ganti Favicon" : "Upload Favicon"}<input type="file" accept="image/png,image/jpeg,image/webp,image/x-icon" hidden disabled={uploadingFavicon} onChange={(e) => { const f=e.target.files?.[0]; if(f) void uploadBrandAsset("favicon", f); e.currentTarget.value=""; }} /></label>
              {faviconUrl ? <button type="button" className="miniButton danger" onClick={() => void removeBrandAsset("favicon")}><X size={14}/> Hapus</button> : null}
            </div> : null}
          </div>
        </div>
        <label className="checkboxField brandingFaviconToggle">
          <input type="checkbox" checked={useLogoAsFavicon} disabled={!canOwner} onChange={(e) => void saveFaviconPreference(e.target.checked)} />
          Gunakan logo utama sebagai favicon jika favicon khusus tidak digunakan
        </label>

        <div className="settingsSectionHead">
          <div>
            <h2>Katalog Online</h2>
            <p>Aktifkan halaman katalog publik di alamat utama aplikasi. Pengunjung tidak perlu login untuk melihat dan mengirim pesanan.</p>
          </div>
          <span className="settingsFeatureIcon"><ShoppingBag size={17} /></span>
        </div>
        <div className="catalogSettingsBox">
          <label className="checkboxField catalogMainToggle"><input type="checkbox" checked={catalogEnabled} disabled={!canOwner} onChange={e=>setCatalogEnabled(e.target.checked)} /><span><strong>Katalog Online Aktif</strong><small>{catalogEnabled ? "URL utama akan membuka katalog publik." : "URL utama tetap meminta login."}</small></span></label>
          <div className="fieldGrid">
            <label className="formField full">Deskripsi Katalog<input value={catalogDescription} disabled={!canOwner} onChange={e=>setCatalogDescription(e.target.value)} placeholder="Katering, kue, custom, jasa, dan lainnya" /></label>
            <label className="checkboxField"><input type="checkbox" checked={catalogShowPrices} disabled={!canOwner} onChange={e=>setCatalogShowPrices(e.target.checked)} />Tampilkan harga</label>
            <label className="checkboxField"><input type="checkbox" checked={catalogAcceptOrders} disabled={!canOwner} onChange={e=>setCatalogAcceptOrders(e.target.checked)} />Terima pesanan online</label>
          </div>
          <div className="catalogUrlHint"><strong>URL katalog:</strong> alamat utama aplikasi ini. Customer cukup membuka URL tersebut tanpa login.</div>
        </div>

        <div className="settingsSectionHead">
          <div>
            <h2>Sapaan & Quote Dashboard</h2>
            <p>Nama mengikuti akun yang sedang login. Quote dipilih acak setiap kali Dashboard dibuka.</p>
          </div>
          <span className="settingsFeatureIcon"><Shuffle size={17} /></span>
        </div>
        <label className="checkboxField motivationToggle">
          <input
            type="checkbox"
            checked={motivationEnabled}
            onChange={(e) => setMotivationEnabled(e.target.checked)}
          />
          Tampilkan quote motivasi di bawah sapaan
        </label>
        <div className="quoteEditorList">
          {quotes.map((quote, index) => (
            <div className="quoteEditorRow" key={`quote-${index}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <textarea
                value={quote}
                maxLength={180}
                onChange={(e) => updateQuote(index, e.target.value)}
                placeholder={`Quote motivasi ${index + 1}`}
                disabled={!canOwner}
              />
              {canOwner ? (
                <button type="button" className="quoteDelete" onClick={() => removeQuote(index)} aria-label={`Hapus quote ${index + 1}`}>
                  <Trash2 size={16} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
        {canOwner ? (
          <div className="quoteEditorActions">
            <button type="button" className="miniButton primary" onClick={addQuote} disabled={quotes.length >= 20}>
              <Plus size={14} /> Tambah Quote
            </button>
            <button type="button" className="miniButton" onClick={resetQuotes}>Isi 10 Quote Bawaan</button>
            <small>{quotes.length}/20 quote</small>
          </div>
        ) : null}

        <h2 style={{ marginTop: 20 }}>Kode Otomatis</h2>
        <div className="fieldGrid">
          <label className="formField">
            Prefix SKU Produk/Jasa
            <input
              maxLength={12}
              value={form.sku_prefix}
              onChange={(e) => setForm({ ...form, sku_prefix: cleanPrefix(e.target.value, "") })}
              placeholder="SKU"
            />
            <span className="formHint">
              Contoh hasil: {cleanPrefix(form.sku_prefix, "SKU")}-000001. Nomor dibuat otomatis dan aman dari duplikat.
            </span>
          </label>
          <label className="formField">
            Prefix Order
            <input value={form.order_prefix} onChange={(e) => setForm({ ...form, order_prefix: e.target.value })} />
          </label>
          <label className="formField">
            Prefix Invoice
            <input value={form.invoice_prefix} onChange={(e) => setForm({ ...form, invoice_prefix: e.target.value })} />
          </label>
          <label className="formField">
            Timezone
            <input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
          </label>
          <label className="formField">
            Currency
            <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          </label>
        </div>

        <h2 style={{ marginTop: 20 }}>WhatsApp</h2>
        <div className="fieldGrid">
          <label className="formField">
            Provider
            <select value={provider} onChange={(e) => { const next=e.target.value; setProvider(next); if(next==="manual") setAutoReminder(false); }}>
              <option value="manual">Manual wa.me</option>
              <option value="fonnte">Fonnte</option>
              <option value="starsender">Starsender</option>
            </select>
            <span className="formHint">Token provider tetap disimpan server-side, bukan di database.</span>
          </label>
          <label className="checkboxField">
            <input
              type="checkbox"
              checked={provider !== "manual" && autoReminder}
              disabled={provider === "manual"}
              onChange={(e) => setAutoReminder(e.target.checked)}
            />
            Auto kirim reminder WhatsApp
          </label>
          <div className="full">
            <Notice kind="info">
              Reminder jatuh tempo di Dashboard/Piutang selalu aktif. Pengiriman WhatsApp otomatis hanya berjalan jika Fonnte/Starsender dipilih, token gateway tersedia, dan Auto kirim reminder diaktifkan.
            </Notice>
          </div>
        </div>
        <FormActions saving={saving} submitLabel="Simpan Pengaturan" />
      </form>
      {!canOwner ? (
        <Notice kind="info">Role Anda hanya dapat melihat pengaturan. Perubahan profil usaha khusus owner.</Notice>
      ) : null}
    </>
  );
}
