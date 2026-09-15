require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json({ limit: '5mb' })); // logo uploads come through as base64 data URLs
app.use(express.static('public'));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const SEASON_YEAR = Number(process.env.SEASON_YEAR) || 2026;

// Scoring matrix. Everything not covered here scores 0.
function computePoints(type, newTerm, prevTerm) {
  const t = Number(newTerm);
  const p = prevTerm != null ? Number(prevTerm) : null;

  if (type === 'competitor') {
    if (t === 3) return 10;
    if (t === 2) return 9;
    if (t === 1) return 8;
    return 0;
  }

  if (type === 'renewal') {
    if (t === 3) {
      if (p === 1 || p === 2) return 7;
      if (p === 3) return 3;
      return 0;
    }
    if (t === 2) return 2;
    if (t === 1) return 1;
    return 0;
  }

  return 0;
}

const LOGOS_DIR = path.join(__dirname, 'public', 'logos');
const LOGO_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];

// Drop an image straight into public/logos/ named after the agency
// (e.g. "SSKB.png", "BCS Strata.png") and it's picked up automatically —
// no admin upload needed. Filename (minus extension), lowercased and
// trimmed, must match how the agency name is typed on nominations.
function loadStaticLogos() {
  const logos = {};
  if (!fs.existsSync(LOGOS_DIR)) return logos;
  for (const filename of fs.readdirSync(LOGOS_DIR)) {
    const ext = path.extname(filename).toLowerCase();
    if (!LOGO_EXTENSIONS.includes(ext)) continue;
    const base = path.basename(filename, ext);
    const key = base.trim().toLowerCase();
    if (!key) continue;
    logos[key] = { name: base, logoUrl: `/logos/${encodeURIComponent(filename)}` };
  }
  return logos;
}

const SPONSOR_LOGOS_DIR = path.join(__dirname, 'public', 'sponsors');

// Same idea as public/logos/, but for sponsors: drop a file in
// public/sponsors/ named after the sponsor (e.g. "BCP Plumbing.png") and
// it fills in automatically for any sponsor record with that name that
// doesn't already have a logo uploaded through the admin panel.
function loadStaticSponsorLogos() {
  const logos = {};
  if (!fs.existsSync(SPONSOR_LOGOS_DIR)) return logos;
  for (const filename of fs.readdirSync(SPONSOR_LOGOS_DIR)) {
    const ext = path.extname(filename).toLowerCase();
    if (!LOGO_EXTENSIONS.includes(ext)) continue;
    const base = path.basename(filename, ext);
    const key = base.trim().toLowerCase();
    if (!key) continue;
    logos[key] = `/sponsors/${encodeURIComponent(filename)}`;
  }
  return logos;
}

// --- helpers -----------------------------------------------------------

function toManagerOut(m) {
  if (!m) return null;
  return { id: m.id, name: m.name, agency: m.agency || '' };
}

function toSchemeOut(s, opts) {
  if (!s) return null;
  const out = {
    id: s.id,
    suburb: s.suburb,
    planType: s.plan_type,
    module: s.module,
    lotCount: s.lot_count,
    currentManagerId: s.current_manager_id,
    currentTerm: s.current_term,
  };
  if (opts && opts.includePrivate) {
    out.schemeName = s.scheme_name || '';
    out.cts = s.cts || '';
  }
  return out;
}

function toEventOut(e) {
  if (!e) return null;
  return {
    id: e.id,
    type: e.type,
    schemeId: e.scheme_id,
    managerId: e.manager_id,
    newTerm: e.new_term,
    prevTerm: e.prev_term,
    points: e.points,
    date: e.date,
  };
}

function toSponsorOut(s, staticSponsorLogos) {
  const staticLogo = (staticSponsorLogos || {})[(s.name || '').trim().toLowerCase()];
  return {
    id: s.id,
    name: s.name,
    logoUrl: s.logo_url || staticLogo || '',
    logoName: s.logo_name || '',
    websiteUrl: s.website_url || '',
    position: s.position || 1,
    active: s.active !== false,
    nominatedBy: s.nominated_by || '',
    nominatedByAgency: s.nominated_by_agency || '',
    sponsorshipPrice: s.sponsorship_price,
    commissionOwed: s.commission_owed,
    commissionPaid: !!s.commission_paid,
  };
}

function toInviteOut(i) {
  return {
    id: i.id,
    eventId: i.event_id,
    businessName: i.business_name,
    contactName: i.contact_name || '',
    eventType: i.event_type,
    schemeName: i.scheme_label,
    newTerm: i.new_term,
    nominatedBy: i.nominated_by || '',
    nominatedByAgency: i.nominated_by_agency || '',
    status: i.status || 'pending',
    logoUrl: i.logo_url || '',
    tagline: i.tagline || '',
    websiteUrl: i.website_url || '',
    iconUrl: i.icon_url || '',
  };
}

// --- bulk read: everything the front end needs to render ---------------

async function fetchAllData({ includePrivate }) {
  const [managers, schemes, events, sponsors, invites, logos] = await Promise.all([
    supabase.from('strata_managers').select('*'),
    supabase.from('strata_schemes').select('*'),
    supabase.from('strata_events').select('*').order('date', { ascending: false }),
    supabase.from('strata_sponsors').select('*'),
    supabase.from('strata_sponsor_invites').select('*'),
    supabase.from('strata_agency_logos').select('*'),
  ]);
  for (const r of [managers, schemes, events, sponsors, invites, logos]) {
    if (r.error) throw r.error;
  }

  const agencyLogos = loadStaticLogos();
  for (const row of logos.data) {
    agencyLogos[row.key] = { name: row.name, logoUrl: row.logo_url };
  }
  const staticSponsorLogos = loadStaticSponsorLogos();

  return {
    managers: managers.data.map(toManagerOut),
    schemes: schemes.data.map((s) => toSchemeOut(s, { includePrivate })),
    events: events.data.map(toEventOut),
    sponsors: sponsors.data.map((s) => toSponsorOut(s, staticSponsorLogos)),
    sponsorInvites: invites.data.map(toInviteOut),
    agencyLogos,
    seasonYear: SEASON_YEAR,
  };
}

// Public route — never includes scheme_name/cts, so nothing the site
// serves to a visitor's browser can leak the private verification fields.
app.get('/api/data', async (req, res) => {
  try {
    res.json(await fetchAllData({ includePrivate: false }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin route — includes scheme_name/cts for verification. Note: this is
// only as protected as the admin page itself, which right now is just a
// client-side password prompt. Anyone who knows this URL can call it
// directly. Worth locking down properly if that verification data needs
// real protection.
app.get('/api/admin/data', async (req, res) => {
  try {
    res.json(await fetchAllData({ includePrivate: true }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- managers ------------------------------------------------------------

app.patch('/api/managers/:id', async (req, res) => {
  const { name, agency } = req.body;
  const { data, error } = await supabase
    .from('strata_managers')
    .update({ name, agency })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(toManagerOut(data));
});

// --- schemes ---------------------------------------------------------------

app.patch('/api/schemes/:id', async (req, res) => {
  const { suburb, planType, module, lotCount, schemeName, cts } = req.body;
  const { data, error } = await supabase
    .from('strata_schemes')
    .update({ suburb, plan_type: planType, module, lot_count: Number(lotCount), scheme_name: schemeName || null, cts: cts || null })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(toSchemeOut(data, { includePrivate: true }));
});

function buildSchemeLabel(scheme) {
  if (!scheme) return 'Building';
  const parts = [scheme.suburb, scheme.plan_type, scheme.module, scheme.lot_count ? `${scheme.lot_count} lots` : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Building';
}

// --- events (nominations) ---------------------------------------------

// Record/nominate a win, upgrade, or loss. Either pass an existing
// managerId/schemeId, or pass the new-record fields and one gets created.
// source: 'public' marks a submission from the public nomination form,
// where every field — including the tradie/contractor business name and
// their own name — is mandatory. It's how the site is monetised. Admin's
// own "Record a win" doesn't send this flag, so it isn't held to it.
app.post('/api/events', async (req, res) => {
  try {
    const {
      managerId, managerName, agency,
      schemeId, suburb, planType, module, lotCount, schemeName, cts,
      type, newTerm, prevTerm, date,
      source, businessName, contactName,
    } = req.body;

    if (source === 'public') {
      const missing = [];
      if (!managerId && (!managerName || !managerName.trim())) missing.push('managerName');
      if (!managerId && (!agency || !agency.trim())) missing.push('agency');
      if (!schemeId && (!suburb || !suburb.trim())) missing.push('suburb');
      if (!schemeId && (!module || !module.trim())) missing.push('module');
      if (!schemeId && !lotCount) missing.push('lotCount');
      if (!schemeId && (!schemeName || !schemeName.trim())) missing.push('schemeName');
      if (!schemeId && (!cts || !cts.trim())) missing.push('cts');
      if (!businessName || !businessName.trim()) missing.push('businessName');
      if (!contactName || !contactName.trim()) missing.push('contactName');
      if (missing.length > 0) {
        return res.status(400).json({ error: 'All fields are required.', missingFields: missing });
      }
    }

    let manager;
    if (managerId) {
      const { data, error } = await supabase.from('strata_managers').select('*').eq('id', managerId).single();
      if (error) return res.status(400).json({ error: 'manager not found' });
      manager = data;
    } else {
      if (!managerName || !managerName.trim()) return res.status(400).json({ error: 'managerName is required' });
      const { data, error } = await supabase
        .from('strata_managers')
        .insert({ name: managerName.trim(), agency: (agency || '').trim() })
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      manager = data;
    }

    let scheme;
    if (schemeId) {
      const { data, error } = await supabase.from('strata_schemes').select('*').eq('id', schemeId).single();
      if (error) return res.status(400).json({ error: 'scheme not found' });
      scheme = data;
    } else {
      if (!suburb || !suburb.trim() || !module || !module.trim() || !lotCount) {
        return res.status(400).json({ error: 'suburb, module, and lotCount are required for a new scheme' });
      }
      const { data, error } = await supabase
        .from('strata_schemes')
        .insert({
          suburb: suburb.trim(),
          plan_type: planType || 'BFP',
          module: module.trim(),
          lot_count: Number(lotCount),
          scheme_name: (schemeName || '').trim() || null,
          cts: (cts || '').trim() || null,
        })
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      scheme = data;
    }

    if (!['competitor', 'renewal'].includes(type)) {
      return res.status(400).json({ error: 'type must be "competitor" or "renewal"' });
    }
    const evType = type;
    const term = Number(newTerm);
    if (![1, 2, 3].includes(term)) return res.status(400).json({ error: 'newTerm must be 1, 2, or 3' });

    let prev = null;
    if (evType === 'renewal') {
      if (prevTerm == null || prevTerm === '') return res.status(400).json({ error: 'prevTerm is required for a renewal' });
      prev = Number(prevTerm);
      if (![1, 2, 3].includes(prev)) return res.status(400).json({ error: 'prevTerm must be 1, 2, or 3' });
    }

    const points = computePoints(evType, term, prev);

    const { data: event, error: eventError } = await supabase
      .from('strata_events')
      .insert({
        type: evType,
        scheme_id: scheme.id,
        manager_id: manager.id,
        new_term: term,
        prev_term: prev,
        points,
        date: date || new Date().toISOString().slice(0, 10),
      })
      .select()
      .single();
    if (eventError) return res.status(500).json({ error: eventError.message });

    let inviteError = null;
    if (businessName && businessName.trim()) {
      const { error: inviteInsertError } = await supabase
        .from('strata_sponsor_invites')
        .insert({
          event_id: event.id,
          business_name: businessName.trim(),
          contact_name: (contactName || '').trim() || null,
          event_type: evType,
          scheme_label: buildSchemeLabel(scheme),
          new_term: term,
          nominated_by: manager.name,
          nominated_by_agency: manager.agency || null,
        });
      if (inviteInsertError) inviteError = inviteInsertError.message;
    }

    res.json({
      event: toEventOut(event),
      manager: toManagerOut(manager),
      scheme: toSchemeOut(scheme, { includePrivate: true }),
      inviteError,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Amend everything about an existing nomination — the manager's
// name/agency, the scheme's details, and the event's own fields.
app.patch('/api/events/:id', async (req, res) => {
  try {
    const { data: existing, error: findError } = await supabase
      .from('strata_events')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (findError) return res.status(404).json({ error: 'nomination not found' });

    const { managerName, agency, suburb, planType, module, lotCount, schemeName, cts, type, newTerm, prevTerm, points, date } = req.body;

    const { data: manager, error: managerError } = await supabase
      .from('strata_managers')
      .update({ name: managerName.trim(), agency: (agency || '').trim() })
      .eq('id', existing.manager_id)
      .select()
      .single();
    if (managerError) return res.status(500).json({ error: managerError.message });

    const { data: scheme, error: schemeError } = await supabase
      .from('strata_schemes')
      .update({
        suburb: suburb.trim(),
        plan_type: planType,
        module: module.trim(),
        lot_count: Number(lotCount),
        scheme_name: (schemeName || '').trim() || null,
        cts: (cts || '').trim() || null,
      })
      .eq('id', existing.scheme_id)
      .select()
      .single();
    if (schemeError) return res.status(500).json({ error: schemeError.message });

    const { data: event, error: eventError } = await supabase
      .from('strata_events')
      .update({
        type,
        new_term: Number(newTerm),
        prev_term: prevTerm != null && prevTerm !== '' ? Number(prevTerm) : null,
        points: Number(points),
        date,
      })
      .eq('id', req.params.id)
      .select()
      .single();
    if (eventError) return res.status(500).json({ error: eventError.message });

    res.json({ event: toEventOut(event), manager: toManagerOut(manager), scheme: toSchemeOut(scheme, { includePrivate: true }) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/events/:id', async (req, res) => {
  const { error } = await supabase.from('strata_events').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ deleted: true });
});

// --- agency logos ------------------------------------------------------

app.post('/api/agency-logos', async (req, res) => {
  const { name, logoUrl } = req.body;
  if (!name || !name.trim() || !logoUrl) return res.status(400).json({ error: 'name and logoUrl are required' });
  const key = name.trim().toLowerCase();
  const { data, error } = await supabase
    .from('strata_agency_logos')
    .upsert({ key, name: name.trim(), logo_url: logoUrl }, { onConflict: 'key' })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ key: data.key, name: data.name, logoUrl: data.logo_url });
});

app.delete('/api/agency-logos/:key', async (req, res) => {
  const { error } = await supabase.from('strata_agency_logos').delete().eq('key', req.params.key);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ deleted: true });
});

// --- sponsors ------------------------------------------------------------

app.post('/api/sponsors', async (req, res) => {
  const { id, name, logoUrl, logoName, websiteUrl, position, active, nominatedBy, nominatedByAgency } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  const row = {
    name: name.trim(),
    logo_url: logoUrl || '',
    logo_name: logoName || '',
    website_url: (websiteUrl || '').trim() || null,
    position: Number(position) || 1,
    active: active !== false,
    nominated_by: nominatedBy || null,
    nominated_by_agency: nominatedByAgency || null,
  };
  let query;
  if (id) {
    query = supabase.from('strata_sponsors').update(row).eq('id', id).select().single();
  } else {
    query = supabase.from('strata_sponsors').insert(row).select().single();
  }
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(toSponsorOut(data, loadStaticSponsorLogos()));
});

app.delete('/api/sponsors/:id', async (req, res) => {
  const { error } = await supabase.from('strata_sponsors').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ deleted: true });
});

// --- sponsor invites -------------------------------------------------

app.post('/api/sponsor-invites', async (req, res) => {
  const { eventId, businessName, contactName, eventType, schemeName, newTerm, nominatedBy, nominatedByAgency, status, logoUrl, tagline, websiteUrl, iconUrl } = req.body;
  if (!businessName || !businessName.trim()) return res.status(400).json({ error: 'businessName is required' });
  const { data, error } = await supabase
    .from('strata_sponsor_invites')
    .insert({
      event_id: eventId || null,
      business_name: businessName.trim(),
      contact_name: (contactName || '').trim() || null,
      event_type: eventType || null,
      scheme_label: schemeName || null,
      new_term: newTerm || null,
      nominated_by: nominatedBy || null,
      nominated_by_agency: nominatedByAgency || null,
      status: status || 'pending',
      logo_url: logoUrl || null,
      tagline: (tagline || '').trim() || null,
      website_url: (websiteUrl || '').trim() || null,
      icon_url: iconUrl || null,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(toInviteOut(data));
});

app.patch('/api/sponsor-invites/:id', async (req, res) => {
  const { status, logoUrl, tagline, websiteUrl, iconUrl } = req.body;
  const update = {};
  if (status !== undefined) update.status = status;
  if (logoUrl !== undefined) update.logo_url = logoUrl;
  if (tagline !== undefined) update.tagline = tagline;
  if (websiteUrl !== undefined) update.website_url = websiteUrl;
  if (iconUrl !== undefined) update.icon_url = iconUrl;
  const { data, error } = await supabase
    .from('strata_sponsor_invites')
    .update(update)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(toInviteOut(data));
});

app.delete('/api/sponsor-invites/:id', async (req, res) => {
  const { error } = await supabase.from('strata_sponsor_invites').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ deleted: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`QLD Strata Rankings running on port ${PORT}`));
