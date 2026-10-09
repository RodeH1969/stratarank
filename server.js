require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json({ limit: '10mb' })); // logo uploads come through as base64 data URLs

// The Daily Drill task bank lives in public/Daily Drill/ so QSR can find
// and edit it like any other site file, but it holds the model answers
// — never serve it as a static file, or anyone could view-source today's
// answers before playing. Only the /api/drill/* routes below read it.
app.use((req, res, next) => {
  let decoded;
  try {
    decoded = decodeURIComponent(req.path);
  } catch {
    return res.status(400).end();
  }
  if (decoded.startsWith('/Daily Drill/')) return res.status(404).end();
  next();
});
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
  return { id: m.id, name: m.name, agency: m.agency || '', photoUrl: m.photo_url || '', linkedinUrl: m.linkedin_url || '' };
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

function toEventOut(e, opts) {
  if (!e) return null;
  const out = {
    id: e.id,
    type: e.type,
    schemeId: e.scheme_id,
    managerId: e.manager_id,
    newTerm: e.new_term,
    prevTerm: e.prev_term,
    points: e.points,
    date: e.date,
    status: e.status || 'pending',
    tipSource: e.tip_source || '',
    createdAt: e.created_at,
  };
  if (opts && opts.includePrivate) {
    out.proofUrl = e.proof_url || '';
  }
  return out;
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
    agencyLogos[row.key] = { name: row.name, logoUrl: row.logo_url, websiteUrl: row.website_url || '' };
  }
  const staticSponsorLogos = loadStaticSponsorLogos();

  // Public route only ever sees approved wins — pending submissions stay
  // invisible until an admin has verified them against the committee
  // minutes and approved them.
  const visibleEvents = includePrivate ? events.data : events.data.filter((e) => e.status === 'approved');

  return {
    managers: managers.data.map(toManagerOut),
    schemes: schemes.data.map((s) => toSchemeOut(s, { includePrivate })),
    events: visibleEvents.map((e) => toEventOut(e, { includePrivate })),
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
  const { name, agency, photoUrl, linkedinUrl } = req.body;
  const update = { name, agency };
  if (photoUrl !== undefined) update.photo_url = photoUrl || null;
  if (linkedinUrl !== undefined) update.linkedin_url = linkedinUrl || null;
  const { data, error } = await supabase
    .from('strata_managers')
    .update(update)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(toManagerOut(data));
});

app.delete('/api/managers/:id', async (req, res) => {
  const { data: existingEvents, error: checkError } = await supabase
    .from('strata_events')
    .select('id')
    .eq('manager_id', req.params.id)
    .limit(1);
  if (checkError) return res.status(500).json({ error: checkError.message });
  if (existingEvents && existingEvents.length > 0) {
    return res.status(400).json({ error: 'This manager has nominations attached — delete those in All nominations first, then remove the manager.' });
  }
  const { error } = await supabase.from('strata_managers').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ deleted: true });
});

// Merge a duplicate manager record into another — every win recorded
// against the duplicate (fromId) is reassigned to the keeper (toId), so
// their points accumulate onto one person, then the duplicate is deleted.
// This is how admin reconciles different spellings of the same name
// coming in through the public tip-off form, which no longer lets the
// person picking a win pick from an existing-manager list.
app.post('/api/managers/:fromId/merge-into/:toId', async (req, res) => {
  const { fromId, toId } = req.params;
  if (fromId === toId) return res.status(400).json({ error: 'Cannot merge a manager into themselves.' });

  const { data: fromManager, error: fromError } = await supabase.from('strata_managers').select('*').eq('id', fromId).single();
  if (fromError) return res.status(404).json({ error: 'Manager to merge from was not found.' });
  const { data: toManager, error: toError } = await supabase.from('strata_managers').select('*').eq('id', toId).single();
  if (toError) return res.status(404).json({ error: 'Manager to merge into was not found.' });

  const { error: eventsError } = await supabase.from('strata_events').update({ manager_id: toId }).eq('manager_id', fromId);
  if (eventsError) return res.status(500).json({ error: eventsError.message });

  const { error: schemesError } = await supabase.from('strata_schemes').update({ current_manager_id: toId }).eq('current_manager_id', fromId);
  if (schemesError) return res.status(500).json({ error: schemesError.message });

  const { error: deleteError } = await supabase.from('strata_managers').delete().eq('id', fromId);
  if (deleteError) return res.status(500).json({ error: deleteError.message });

  res.json({ merged: true, from: toManagerOut(fromManager), into: toManagerOut(toManager) });
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
// where the core fields are mandatory. Admin's own "Record a win"
// doesn't send this flag, so it isn't held to it. businessName is
// admin-only now — QSR approaches tradies on site himself and adds
// them under the "All nominations" tab — so it's optional here.
app.post('/api/events', async (req, res) => {
  try {
    const {
      managerId, managerName, agency, managerPhotoUrl,
      schemeId, suburb, planType, module, lotCount, schemeName, cts,
      type, newTerm, prevTerm, date,
      source, businessName, contactName, tipSource,
    } = req.body;

    if (source === 'public') {
      const missing = [];
      if (!managerId && (!managerName || !managerName.trim())) missing.push('managerName');
      if (!managerId && (!agency || !agency.trim())) missing.push('agency');
      if (!schemeId && (!suburb || !suburb.trim())) missing.push('suburb');
      if (!schemeId && !lotCount) missing.push('lotCount');
      if (!schemeId && (!schemeName || !schemeName.trim())) missing.push('schemeName');
      if (!tipSource || !['body_corporate', 'strata_company', 'tradie'].includes(tipSource)) missing.push('tipSource');
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
        .insert({ name: managerName.trim(), agency: (agency || '').trim(), photo_url: managerPhotoUrl || null })
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
      if (!suburb || !suburb.trim() || !lotCount) {
        return res.status(400).json({ error: 'suburb and lotCount are required for a new scheme' });
      }
      const { data, error } = await supabase
        .from('strata_schemes')
        .insert({
          suburb: suburb.trim(),
          // Scheme type & module are no longer collected on the public tip-off
          // form — admin fills these in before approving (see schema.sql note).
          plan_type: (planType || '').trim() || null,
          module: (module || '').trim() || null,
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
    const validTipSource = ['body_corporate', 'strata_company', 'tradie'].includes(tipSource) ? tipSource : null;

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
        tip_source: validTipSource,
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
      event: toEventOut(event, { includePrivate: true }),
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

    res.json({ event: toEventOut(event, { includePrivate: true }), manager: toManagerOut(manager), scheme: toSchemeOut(scheme, { includePrivate: true }) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve/unapprove a nomination and/or attach proof of the committee's
// motion (a screenshot of the minutes). Separate from the full-edit route
// above so admin can review a submission without touching its content.
app.patch('/api/events/:id/review', async (req, res) => {
  const { status, proofUrl, tipSource } = req.body;
  const update = {};
  if (status !== undefined) {
    if (!['pending', 'approved'].includes(status)) {
      return res.status(400).json({ error: 'status must be "pending" or "approved"' });
    }
    update.status = status;
  }
  if (proofUrl !== undefined) update.proof_url = proofUrl || null;
  if (tipSource !== undefined) {
    if (tipSource && !['body_corporate', 'strata_company', 'tradie'].includes(tipSource)) {
      return res.status(400).json({ error: 'tipSource must be "body_corporate", "strata_company", "tradie", or empty' });
    }
    update.tip_source = tipSource || null;
  }
  const { data, error } = await supabase
    .from('strata_events')
    .update(update)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(toEventOut(data, { includePrivate: true }));
});

app.delete('/api/events/:id', async (req, res) => {
  const { error } = await supabase.from('strata_events').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ deleted: true });
});

// --- agency logos ------------------------------------------------------

app.post('/api/agency-logos', async (req, res) => {
  const { name, logoUrl, websiteUrl } = req.body;
  if (!name || !name.trim() || !logoUrl) return res.status(400).json({ error: 'name and logoUrl are required' });
  const key = name.trim().toLowerCase();
  const { data, error } = await supabase
    .from('strata_agency_logos')
    .upsert({ key, name: name.trim(), logo_url: logoUrl, website_url: (websiteUrl || '').trim() || null }, { onConflict: 'key' })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ key: data.key, name: data.name, logoUrl: data.logo_url, websiteUrl: data.website_url || '' });
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

// --- strata daily drill ---------------------------------------------------
//
// A hook to get people checking the site daily, and into the habit of
// coming back — from there they're one tap from The Scoop. One practical,
// scenario-based task a day, chosen by hand from the 100-task bank in
// public/Daily Drill/tasks.json. Each day QSR picks a task in the Daily
// Drill admin tab and hits Launch — that records a row in
// strata_drill_launches and starts the clock. Until then, the public tab
// shows a "goes live at 9am" holding card. Anyone can play; they write a
// freeform answer and say who they are and what strata company they're
// with (honour system — not verified against anything).
//
// There's no auto-marking a freeform answer, so every submission starts
// as "pending" (is_correct = null) until QSR reads it against the task
// bank's model answer and marking guide from the Daily Drill admin tab
// and marks it correct or incorrect by hand. Only submissions marked
// correct ever appear on the public board, ranked by how fast they
// answered — timed from the moment the day's task was launched to when
// the server received their submission.

let DRILL_TASKS = [];
try {
  DRILL_TASKS = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'Daily Drill', 'tasks.json'), 'utf8'));
} catch (err) {
  console.error('Could not load Daily Drill set 1:', err.message);
}
// Set 2 — a second bank, ids 101+ (so audio names stay unambiguous). No
// model answers yet; judging for these is from the scenario and topic alone.
try {
  const set2 = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'Daily Drill', 'tasks-set2.json'), 'utf8'));
  DRILL_TASKS = DRILL_TASKS.concat(set2);
} catch (err) {
  console.error('Could not load Daily Drill set 2:', err.message);
}
const drillTaskById = (id) => DRILL_TASKS.find((t) => t.id === id) || null;

// Queensland doesn't observe daylight saving, so Brisbane is always a
// fixed UTC+10 — no timezone-DB lookup needed.
function brisbaneDateStr(d = new Date()) {
  return new Date(d.getTime() + 10 * 3600 * 1000).toISOString().slice(0, 10);
}
const isDateStr = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

// The launch row for a day (which task, and when it went live), or null.
async function getDrillLaunch(drillDate) {
  const { data, error } = await supabase
    .from('strata_drill_launches')
    .select('task_id, launched_at')
    .eq('drill_date', drillDate)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

// Today's task — scenario and instructions only, never the model answer
// or marking guide. Locked (no tasks) until QSR hits Launch.
// ---- Strata jobs board ----
const jobRow = (j) => ({
  id: j.id,
  title: j.title,
  company: j.company,
  location: j.location || '',
  type: j.job_type || '',
  description: j.description || '',
  applyUrl: j.apply_url || '',
  logoUrl: j.logo_url || '',
  featured: !!j.featured,
  createdAt: j.created_at,
  expiresAt: j.expires_at,
});
async function getJobsPostUrl() {
  const { data } = await supabase.from('strata_settings').select('value').eq('key', 'jobs_post_url').maybeSingle();
  return (data && data.value) || '';
}

app.get('/api/jobs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('strata_jobs')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ jobs: data.map(jobRow), postUrl: await getJobsPostUrl() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/jobs', async (req, res) => {
  try {
    const { data, error } = await supabase.from('strata_jobs').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ jobs: data.map(jobRow), postUrl: await getJobsPostUrl() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/jobs', async (req, res) => {
  const b = req.body || {};
  const title = String(b.title || '').trim();
  const company = String(b.company || '').trim();
  if (!title) return res.status(400).json({ error: 'Job title is required.' });
  if (!company) return res.status(400).json({ error: 'Company is required.' });
  const days = Math.min(365, Math.max(1, Math.round(Number(b.days)) || 30));
  let apply = String(b.applyUrl || '').trim();
  if (apply && !/^(https?:|mailto:)/i.test(apply)) apply = apply.includes('@') ? `mailto:${apply}` : `https://${apply}`;
  try {
    const { data, error } = await supabase.from('strata_jobs').insert({
      title, company,
      location: String(b.location || '').trim() || null,
      job_type: String(b.type || '').trim() || null,
      description: String(b.description || '').trim() || null,
      apply_url: apply || null,
      logo_url: b.logoUrl || null,
      featured: !!b.featured,
      expires_at: new Date(Date.now() + days * 86400000).toISOString(),
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ job: jobRow(data) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/admin/jobs/:id', async (req, res) => {
  const update = {};
  if (req.body && 'featured' in req.body) update.featured = !!req.body.featured;
  if (req.body && req.body.days) update.expires_at = new Date(Date.now() + Math.min(365, Math.max(1, Math.round(Number(req.body.days)))) * 86400000).toISOString();
  if (req.body && req.body.expireNow) update.expires_at = new Date().toISOString();
  try {
    const { error } = await supabase.from('strata_jobs').update(update).eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/jobs/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('strata_jobs').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Where the public "Post a job" button goes (a payment link, say).
app.put('/api/admin/jobs/post-url', async (req, res) => {
  let url = String((req.body || {}).postUrl || '').trim();
  if (url && !/^(https?:|mailto:)/i.test(url)) url = url.includes('@') ? `mailto:${url}` : `https://${url}`;
  try {
    const q = url
      ? supabase.from('strata_settings').upsert({ key: 'jobs_post_url', value: url })
      : supabase.from('strata_settings').delete().eq('key', 'jobs_post_url');
    const { error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ postUrl: url });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// The "brought to you by" sponsor shown on today's question. One row, kept
// until QSR changes or clears it in admin.
async function getDrillSponsor() {
  const { data } = await supabase.from('strata_drill_sponsor').select('name, logo_url, website_url').eq('id', 1).maybeSingle();
  return data && data.name ? { name: data.name, logoUrl: data.logo_url || '', websiteUrl: data.website_url || '' } : null;
}

app.get('/api/admin/drill/sponsor', async (req, res) => {
  try { res.json({ sponsor: await getDrillSponsor() }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/admin/drill/sponsor', async (req, res) => {
  const name = String((req.body || {}).name || '').trim();
  try {
    if (!name) {
      const { error } = await supabase.from('strata_drill_sponsor').delete().eq('id', 1);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ sponsor: null });
    }
    let site = String(req.body.websiteUrl || '').trim();
    if (site && !/^https?:\/\//i.test(site)) site = `https://${site}`;
    const { error } = await supabase.from('strata_drill_sponsor').upsert({ id: 1, name, logo_url: req.body.logoUrl || null, website_url: site || null });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ sponsor: await getDrillSponsor() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/drill/today', async (req, res) => {
  const drillDate = brisbaneDateStr();
  try {
    const launch = await getDrillLaunch(drillDate);
    const task = launch ? drillTaskById(launch.task_id) : null;
    if (!launch || !task) return res.json({ drillDate, postedAt: null, locked: true, tasks: [], sponsor: await getDrillSponsor() });
    res.json({
      drillDate,
      postedAt: new Date(launch.launched_at).toISOString(),
      locked: false,
      // Audio only: the task's text is never sent to visitors.
      tasks: [{ id: task.id }],
      sponsor: await getDrillSponsor(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Today's spoken clip — 'scenario' or 'question'. Only served for the task
// launched today, so nothing can be fetched early. Supports Range requests
// (Safari won't play audio without them).
app.get('/api/drill/audio/:part', async (req, res) => {
  const part = req.params.part;
  if (part !== 'scenario' && part !== 'question') return res.status(404).end();
  try {
    const launch = await getDrillLaunch(brisbaneDateStr());
    if (!launch) return res.status(403).end();
    const { data, error } = await supabase
      .from('strata_drill_audio')
      .select('mime, data_b64')
      .eq('task_id', launch.task_id)
      .eq('part', part)
      .maybeSingle();
    if (error) return res.status(500).end();
    if (!data) return res.status(404).end();
    const buf = Buffer.from(data.data_b64, 'base64');
    res.set({ 'Content-Type': data.mime || 'audio/mpeg', 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, no-store' });
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (m && (m[1] || m[2])) {
      let start = m[1] ? parseInt(m[1], 10) : buf.length - parseInt(m[2], 10);
      let end = m[1] && m[2] ? parseInt(m[2], 10) : buf.length - 1;
      end = Math.min(end, buf.length - 1);
      if (start < 0 || start > end) return res.status(416).set('Content-Range', `bytes */${buf.length}`).end();
      res.status(206).set({ 'Content-Range': `bytes ${start}-${end}/${buf.length}`, 'Content-Length': end - start + 1 });
      return res.end(buf.subarray(start, end + 1));
    }
    res.set('Content-Length', buf.length);
    res.end(buf);
  } catch (e) {
    res.status(500).end();
  }
});

// Submit today's answer. Elapsed time is computed here, server-side, from
// the server clock and the launch time — never trust a client-supplied
// timestamp. Correctness is left null (pending) — an admin judges it.
app.post('/api/drill/submit', async (req, res) => {
  const { name, role, company, answers } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required.' });
  if (!company || !company.trim()) return res.status(400).json({ error: 'Strata company is required.' });

  const drillDate = brisbaneDateStr();
  let launch;
  try {
    launch = await getDrillLaunch(drillDate);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
  const task = launch ? drillTaskById(launch.task_id) : null;
  if (!launch || !task) return res.status(403).json({ error: "Today's drill hasn't started yet." });

  const text = Array.isArray(answers) && answers.length === 1 && answers[0] && answers[0].taskId === task.id
    ? String(answers[0].text || '').trim()
    : '';
  if (!text) return res.status(400).json({ error: 'Please write your answer.' });

  const elapsedSeconds = Math.max(0, Math.round((Date.now() - new Date(launch.launched_at).getTime()) / 1000));

  const { error } = await supabase.from('strata_drill_entries').insert({
    drill_date: drillDate,
    name: name.trim(),
    role: (role || '').trim() || null,
    company: company.trim(),
    answers: [{ taskId: task.id, text }],
    is_correct: null,
    elapsed_seconds: elapsedSeconds,
  });
  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: "Looks like you've already played today's drill." });
    }
    return res.status(500).json({ error: error.message });
  }

  res.json({ drillDate, elapsedSeconds });
});

// The day's winner — the entry QSR crowned as the most thorough answer. The first
// five get their photo/logo (if the admin's attached one). With no date
// given: today's winners if today's task has been launched, otherwise the
// most recent launched day's, so the last winners stay up until the next
// task goes live.
app.get('/api/drill/winners', async (req, res) => {
  let drillDate;
  if (isDateStr(req.query.date)) {
    drillDate = req.query.date;
  } else {
    // Newest day (up to today) that actually has a winner. So on a new game
    // day, until QSR marks today's winner, yesterday's stays up.
    const today = brisbaneDateStr();
    const { data: recent, error: rErr } = await supabase
      .from('strata_drill_entries')
      .select('drill_date')
      .eq('is_winner', true)
      .lte('drill_date', today)
      .order('drill_date', { ascending: false })
      .limit(1);
    if (rErr) return res.status(500).json({ error: rErr.message });
    // No winner anywhere yet: show the last contest day (empty), never today.
    const y = new Date(`${today}T00:00:00Z`);
    do { y.setUTCDate(y.getUTCDate() - 1); } while (y.getUTCDay() === 0 || y.getUTCDay() === 6); // last contest day (Mon-Fri)
    drillDate = recent && recent[0] ? recent[0].drill_date : y.toISOString().slice(0, 10);
  }
  const { data, error } = await supabase
    .from('strata_drill_entries')
    .select('name, role, company, answers, photo_url, logo_url')
    .eq('drill_date', drillDate)
    .eq('is_winner', true)
    .limit(1);
  if (error) return res.status(500).json({ error: error.message });
  res.json({
    drillDate,
    entries: data.map((e, i) => ({
      name: e.name,
      role: e.role,
      company: e.company,
      answer: (Array.isArray(e.answers) ? e.answers : []).map((a) => String((a && a.text) || '').trim()).filter(Boolean).join('\n\n'),
      photoUrl: e.photo_url || '',
      logoUrl: e.logo_url || '',
    })),
  });
});

const drillTaskFull = (t) => ({
  id: t.id,
  set: t.set || 1,
  num: t.num || t.id,
  difficulty: t.difficulty || null,
  topic: t.topic || null,
  section: t.section,
  title: t.title,
  scenario: t.scenario,
  instructions: t.instructions,
  modelAnswer: t.modelAnswer,
  markingGuide: t.markingGuide,
});

// Admin: the whole question bank, with every date each task has been
// launched on, plus today's launch (if any) — for the "pick today's
// question" list.
app.get('/api/admin/drill/tasks', async (req, res) => {
  const { data, error } = await supabase
    .from('strata_drill_launches')
    .select('drill_date, task_id, launched_at')
    .order('drill_date', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  const usedOn = {};
  for (const l of data) (usedOn[l.task_id] = usedOn[l.task_id] || []).push(l.drill_date);
  const { data: audioRows, error: aErr } = await supabase.from('strata_drill_audio').select('task_id, part');
  if (aErr) return res.status(500).json({ error: aErr.message });
  const audio = {};
  for (const a of audioRows) (audio[a.task_id] = audio[a.task_id] || {})[a.part] = true;
  const today = brisbaneDateStr();
  const todays = data.find((l) => l.drill_date === today);
  res.json({
    today,
    launch: todays ? { taskId: todays.task_id, launchedAt: todays.launched_at } : null,
    tasks: DRILL_TASKS.map((t) => ({ ...drillTaskFull(t), usedOn: usedOn[t.id] || [], audio: { scenario: !!(audio[t.id] && audio[t.id].scenario), question: !!(audio[t.id] && audio[t.id].question) } })),
  });
});

// Admin: upload one clip (base64 data URL or raw base64) for a task.
app.post('/api/admin/drill/audio', async (req, res) => {
  const taskId = Number(req.body && req.body.taskId);
  const part = req.body && req.body.part;
  if (!drillTaskById(taskId)) return res.status(400).json({ error: 'Unknown question number.' });
  if (part !== 'scenario' && part !== 'question') return res.status(400).json({ error: 'Part must be scenario or question.' });
  const raw = String((req.body && req.body.data) || '');
  const b64 = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
  const size = Buffer.from(b64, 'base64').length;
  if (!size) return res.status(400).json({ error: 'Empty file.' });
  const { error } = await supabase
    .from('strata_drill_audio')
    .upsert({ task_id: taskId, part, mime: 'audio/mpeg', size, data_b64: b64, updated_at: new Date().toISOString() }, { onConflict: 'task_id,part' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ taskId, part, size });
});

// Admin: launch today's question — records the pick and starts the clock.
// Can be switched to a different question only while nobody's submitted
// yet (otherwise their answers would belong to a different question).
app.post('/api/admin/drill/launch', async (req, res) => {
  const taskId = Number(req.body && req.body.taskId);
  if (!drillTaskById(taskId)) return res.status(400).json({ error: 'Unknown question.' });
  const drillDate = brisbaneDateStr();
  try {
    const { data: clips, error: aErr } = await supabase.from('strata_drill_audio').select('part').eq('task_id', taskId);
    if (aErr) return res.status(500).json({ error: aErr.message });
    if (!clips || clips.length < 2) return res.status(400).json({ error: "This question has no audio yet. Upload its scenario and question clips first." });
    const existing = await getDrillLaunch(drillDate);
    if (existing) {
      const { count, error: cErr } = await supabase
        .from('strata_drill_entries')
        .select('id', { count: 'exact', head: true })
        .eq('drill_date', drillDate);
      if (cErr) return res.status(500).json({ error: cErr.message });
      if (count > 0) return res.status(409).json({ error: "Today's drill already has submissions, so the question can't be changed." });
    }
    const launchedAt = new Date().toISOString();
    const { error } = await supabase
      .from('strata_drill_launches')
      .upsert({ drill_date: drillDate, task_id: taskId, launched_at: launchedAt }, { onConflict: 'drill_date' });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ drillDate, launch: { taskId, launchedAt } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin: take today's question offline (back to "goes live at 9am").
// Only while nobody's submitted.
app.post('/api/admin/drill/unlaunch', async (req, res) => {
  const drillDate = brisbaneDateStr();
  const { count, error: cErr } = await supabase
    .from('strata_drill_entries')
    .select('id', { count: 'exact', head: true })
    .eq('drill_date', drillDate);
  if (cErr) return res.status(500).json({ error: cErr.message });
  if (count > 0) return res.status(409).json({ error: "Today's drill already has submissions, so it can't be taken offline." });
  const { error } = await supabase.from('strata_drill_launches').delete().eq('drill_date', drillDate);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ drillDate, launch: null });
});

// Admin: every submission for a day (pending, correct and incorrect
// alike), plus that day's launched question including its model answer
// and marking guide, so QSR can judge each written answer against them.
app.get('/api/admin/drill', async (req, res) => {
  const drillDate = isDateStr(req.query.date) ? req.query.date : brisbaneDateStr();
  try {
    const launch = await getDrillLaunch(drillDate);
    const { data, error } = await supabase
      .from('strata_drill_entries')
      .select('*')
      .eq('drill_date', drillDate)
      .order('elapsed_seconds', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    // Entries remember which task they answered, so judge against that
    // (covers older days from before the launch table existed too).
    const ids = new Set(data.flatMap((e) => (e.answers || []).map((a) => a.taskId)));
    if (launch) ids.add(launch.task_id);
    const tasks = [...ids].map(drillTaskById).filter(Boolean).map(drillTaskFull);
    res.json({
      drillDate,
      launch: launch ? { taskId: launch.task_id, launchedAt: launch.launched_at } : null,
      tasks,
      entries: data.map((e) => ({
        id: e.id,
        name: e.name,
        role: e.role || '',
        company: e.company,
        answers: e.answers,
        isCorrect: e.is_correct,
        isWinner: !!e.is_winner,
        elapsedSeconds: e.elapsed_seconds,
        photoUrl: e.photo_url || '',
        logoUrl: e.logo_url || '',
        submittedAt: e.submitted_at,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin: judge a submission correct / incorrect / back to pending.
app.patch('/api/admin/drill/:id', async (req, res) => {
  const { isCorrect } = req.body;
  const { data, error } = await supabase
    .from('strata_drill_entries')
    .update(isCorrect === true ? { is_correct: true } : { is_correct: isCorrect === null ? null : !!isCorrect, is_winner: false })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ id: data.id, isCorrect: data.is_correct });
});

// Admin: edit the written answer on an entry (tidy it up before it's shown as the winning answer).
app.patch('/api/admin/drill/:id/answer', async (req, res) => {
  const text = String((req.body && req.body.text) || '').trim();
  if (!text) return res.status(400).json({ error: 'Answer can\'t be empty.' });
  try {
    const { data: e, error } = await supabase.from('strata_drill_entries').select('id, answers').eq('id', req.params.id).single();
    if (error || !e) return res.status(404).json({ error: 'Entry not found.' });
    const taskId = Array.isArray(e.answers) && e.answers[0] ? e.answers[0].taskId : 0;
    const answers = [{ taskId, text }];
    const u = await supabase.from('strata_drill_entries').update({ answers }).eq('id', e.id);
    if (u.error) return res.status(500).json({ error: u.error.message });
    res.json({ id: e.id, answers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: crown this entry as that day's winner (most thorough answer).
app.post('/api/admin/drill/:id/winner', async (req, res) => {
  try {
    const { data: e, error } = await supabase.from('strata_drill_entries').select('id, drill_date').eq('id', req.params.id).single();
    if (error || !e) return res.status(404).json({ error: 'Entry not found.' });
    const a = await supabase.from('strata_drill_entries').update({ is_winner: false }).eq('drill_date', e.drill_date);
    if (a.error) return res.status(500).json({ error: a.error.message });
    const b = await supabase.from('strata_drill_entries').update({ is_winner: true, is_correct: true }).eq('id', e.id);
    if (b.error) return res.status(500).json({ error: b.error.message });
    res.json({ id: e.id, isWinner: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: add a winner by hand (someone who answered outside the site, say).
// Goes straight in as correct, with an optional photo and company logo.
app.post('/api/admin/drill/manual', async (req, res) => {
  const b = req.body || {};
  const drillDate = isDateStr(b.drillDate) ? b.drillDate : brisbaneDateStr();
  const name = String(b.name || '').trim();
  const company = String(b.company || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required.' });
  if (!company) return res.status(400).json({ error: 'Company is required.' });
  const elapsed = Math.max(0, Math.round(Number(b.elapsedSeconds)) || 0);
  try {
    const launch = await getDrillLaunch(drillDate);
    await supabase.from('strata_drill_entries').update({ is_winner: false }).eq('drill_date', drillDate);
    const { data, error } = await supabase
      .from('strata_drill_entries')
      .insert({
        drill_date: drillDate,
        name,
        role: String(b.role || '').trim() || null,
        company,
        answers: [{ taskId: launch ? launch.task_id : 0, text: String(b.answer || '').trim() }],
        is_correct: true,
        is_winner: true,
        elapsed_seconds: elapsed,
        photo_url: b.photoUrl || null,
        logo_url: b.logoUrl || null,
      })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'That name and company already has an entry for this day.' });
      return res.status(500).json({ error: error.message });
    }
    res.json({ id: data.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin: attach (or clear) a photo / company logo on a submission —
// shown on the public board only for that day's top five.
app.patch('/api/admin/drill/:id/photo', async (req, res) => {
  const { photoUrl } = req.body;
  const { data, error } = await supabase
    .from('strata_drill_entries')
    .update({ photo_url: photoUrl || null })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ id: data.id, photoUrl: data.photo_url || '' });
});
app.patch('/api/admin/drill/:id/logo', async (req, res) => {
  const { logoUrl } = req.body;
  const { data, error } = await supabase
    .from('strata_drill_entries')
    .update({ logo_url: logoUrl || null })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ id: data.id, logoUrl: data.logo_url || '' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`QLD Strata Rankings running on port ${PORT}`));
