/**
 * בינה+ CRM — Gmail bridge (runs inside binaplus@bina-plus.co.il)
 * ⚠️ FIXED VERSION: NEVER marks mail as read. It only adds an invisible-ish
 * label ("bina-crm") to remember what was already ingested. Unread status is
 * preserved for your existing workflow.
 *
 * INBOUND : pollInbox() reads NEW unread mail → creates tickets → labels it (stays UNREAD).
 * OUTBOUND: doPost() receives replies from the CRM → sends them from Gmail (threaded).
 */

var INBOUND_URL = 'https://caolbpofhfyoxdpeegly.functions.supabase.co/inbound-ticket';
var INBOUND_API_KEY = 'bina_f3624361e0661cfa4d21fd98b857e7a571976674bc06f69a';
var SHARED_SECRET = 'as_3796ecb91c7217b9434655477b71a9f65a942b9d';
var LABEL = 'bina-crm';
var SKIP_LABEL = 'bina-crm-skip';
var MAX_PER_RUN = 25;

// Heuristic: is this an automated / bulk / no-reply message (NOT a personal email)?
function isAutomated(from, subject, raw) {
  var f = (from || '').toLowerCase();
  if (/no-?reply|noreply|donotreply|do-not-reply|mailer-daemon|postmaster|bounce|notification|notifications|alerts?@|automated|@docs\.google|@drive\.google|calendar-notification|@resend|@sendgrid|@mailchimp|@sendinblue|@amazonses|@miro\.com|@monday\.com|@slack\.com|@atlassian|@github|@facebookmail|@linkedin|via /.test(f)) return true;
  var s = (subject || '').toLowerCase();
  if (/unsubscribe|newsletter|\bre-?engage|verify your|your receipt|out of office|automatic reply|delivery status/.test(s)) return true;
  var r = (raw || '').toLowerCase();
  if (/\nlist-unsubscribe:/.test(r) || /\nauto-submitted:\s*auto/.test(r) || /\nprecedence:\s*(bulk|list|junk)/.test(r) || /\nx-autoreply:/.test(r)) return true;
  return false;
}

// ---- ONE-TIME RECOVERY: undo the accidental "mark as read" ----
// Run this ONCE now. It marks every thread the old script touched back to UNREAD.
// It keeps the label so those threads are NOT re-ingested (no duplicate tickets).
function restoreUnread() {
  var label = GmailApp.getUserLabelByName(LABEL);
  if (!label) { Logger.log('No "' + LABEL + '" label found — nothing to restore.'); return; }
  var threads = label.getThreads();
  for (var i = 0; i < threads.length; i++) threads[i].markUnread();
  Logger.log('Restored to UNREAD: ' + threads.length + ' threads.');
}

// ---- STOP everything (removes the 5-min trigger) ----
function stop() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'pollInbox') ScriptApp.deleteTrigger(t);
  });
  Logger.log('Stopped: pollInbox trigger removed.');
}

// ---- BASELINE: draw a line under the CURRENT inbox ----
// Labels every existing unread thread as "known" so activation NEVER ingests your
// existing backlog. Only mail that arrives AFTER this becomes a ticket. No tickets, no read-marks.
function baseline() {
  var label = GmailApp.getUserLabelByName(LABEL) || GmailApp.createLabel(LABEL);
  var total = 0;
  for (var iter = 0; iter < 40; iter++) {
    var threads = GmailApp.search('is:unread in:inbox -label:' + LABEL, 0, 100);
    if (!threads.length) break;
    GmailApp.getMessagesForThreads(threads); // warm
    for (var i = 0; i < threads.length; i++) threads[i].addLabel(label); // label only — stays UNREAD
    total += threads.length;
    if (threads.length < 100) break;
  }
  Logger.log('Baseline: labeled ' + total + ' existing unread threads (they will be ignored).');
}

// Safe activation: baseline first (ignore backlog), then start the 5-min trigger.
function setup() {
  if (!GmailApp.getUserLabelByName(LABEL)) GmailApp.createLabel(LABEL);
  baseline();
  stop();
  ScriptApp.newTrigger('pollInbox').timeBased().everyMinutes(5).create();
  Logger.log('Setup done: baseline drawn + 5-min trigger created. Only NEW mail becomes tickets.');
}

function pollInbox() {
  var label = GmailApp.getUserLabelByName(LABEL) || GmailApp.createLabel(LABEL);
  // unread, in inbox, not from us, and NOT already ingested (no bina-crm label)
  var threads = GmailApp.search('is:unread in:inbox -label:' + LABEL + ' -from:binaplus@bina-plus.co.il', 0, MAX_PER_RUN);
  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];
    try {
      var msgs = thread.getMessages();
      var m = msgs[msgs.length - 1];
      var from = m.getFrom();
      var email = (from.match(/<(.+?)>/) || [null, from])[1].trim();
      var name = from.replace(/<.*>/, '').replace(/"/g, '').trim() || email;
      // SPAM / AUTOMATION FILTER — only real personal emails become tickets
      var rawHead = '';
      try { rawHead = m.getRawContent().slice(0, 4000); } catch (e3) { rawHead = ''; }
      if (isAutomated(from, m.getSubject(), rawHead)) {
        var skip = GmailApp.getUserLabelByName(SKIP_LABEL) || GmailApp.createLabel(SKIP_LABEL);
        thread.addLabel(skip); thread.addLabel(label); // label-only, stays unread, never re-ingested
        continue;
      }
      // collect attachments (skip inline images; cap ~8MB total to stay under limits)
      var atts = [];
      var total = 0;
      var files = m.getAttachments({ includeInlineImages: false, includeAttachments: true });
      for (var k = 0; k < files.length && atts.length < 10; k++) {
        var f = files[k];
        var size = f.getSize();
        if (size > 8 * 1024 * 1024 || total + size > 8 * 1024 * 1024) continue;
        total += size;
        atts.push({ name: f.getName(), mime: f.getContentType(), data: Utilities.base64Encode(f.getBytes()) });
      }
      var payload = {
        email: email, name: name,
        message: m.getPlainBody().slice(0, 6000),
        body_html: (function () { try { return m.getBody().slice(0, 60000); } catch (e4) { return null; } })(),
        subject: m.getSubject(),
        email_to: (function () { try { return m.getTo(); } catch (e5) { return null; } })(),
        email_cc: (function () { try { return m.getCc(); } catch (e6) { return null; } })(),
        received_at: m.getDate().toISOString(),
        source_ref: 'gmail:' + thread.getId(),
        channel: 'email',
        attachments: atts
      };
      var res = UrlFetchApp.fetch(INBOUND_URL, {
        method: 'post', contentType: 'application/json',
        headers: { 'x-api-key': INBOUND_API_KEY },
        payload: JSON.stringify(payload), muteHttpExceptions: true
      });
      // ✅ only LABEL it — do NOT mark read. Unread status is preserved.
      if (res.getResponseCode() === 200) thread.addLabel(label);
      else Logger.log('inbound failed ' + res.getResponseCode() + ': ' + res.getContentText());
    } catch (e) {
      Logger.log('thread error: ' + e);
    }
  }
}

function doPost(e) {
  var out = function (obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); };
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.secret !== SHARED_SECRET) return out({ error: 'unauthorized' });
    if (body.action === 'send') {
      // optional attachments: [{name, url}] — fetched and attached to the email
      var blobs = [];
      var atts = body.attachments || [];
      for (var i = 0; i < atts.length && i < 10; i++) {
        try {
          var resp = UrlFetchApp.fetch(atts[i].url, { muteHttpExceptions: true });
          if (resp.getResponseCode() === 200) {
            var blob = resp.getBlob();
            if (atts[i].name) blob.setName(atts[i].name);
            blobs.push(blob);
          }
        } catch (e2) { /* skip failed attachment */ }
      }
      var opts = blobs.length ? { attachments: blobs } : {};
      if (body.htmlBody) opts.htmlBody = body.htmlBody;
      var threadId = (body.threadId || '').replace('gmail:', '');
      if (threadId) {
        var thread = GmailApp.getThreadById(threadId);
        if (thread) { thread.reply(body.body || '', opts); return out({ ok: true, threaded: true, attached: blobs.length }); }
      }
      GmailApp.sendEmail(body.to, body.subject || 'מענה מצוות בינה+', body.body || '', opts);
      return out({ ok: true, threaded: false, attached: blobs.length });
    }
    return out({ error: 'unknown action' });
  } catch (err) {
    return out({ error: String(err) });
  }
}
