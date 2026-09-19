/* Instagram Lead Desk -- the app.
 *
 * One rule shapes this file: every action happens where you are looking. No
 * modal, no drawer, no "open the lead to copy the reply". The pipeline row
 * carries a copy button; expanding it gives you the reply, the reel links, the
 * live inventory and Sameer's assignment form side by side, and each one is a
 * single call that returns the new state of that row.
 */
(function () {
  'use strict';

  var API = '';
  var state = {
    boot: null,
    leads: [],
    tasks: [],
    view: 'pipeline',
    openId: null,
    query: '',
    score: '',
    flags: {},
    scratch: {},          // per-lead unsaved typing, survives a re-render
    props: {},            // per-lead property search results
    answers: {},          // per-lead last answer
    drafts: {},           // per-lead last AI draft
    busy: {},
    inventory: null,
    inbox: { shots: [], leads: [], batch: '', warnings: [], busy: false, done: '' }
  };

  /* ------------------------------------------------------------- helpers */

  function h(v) {
    return String(v === undefined || v === null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function el(id) { return document.getElementById(id); }
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function txt(v) { return String(v === undefined || v === null ? '' : v).trim(); }

  function api(path, options) {
    options = options || {};
    var init = { method: options.method || (options.body ? 'POST' : 'GET') };
    if (options.body) {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = JSON.stringify(options.body);
    }
    return fetch(API + path, init).then(function (r) {
      return r.json().catch(function () { return { error: 'server sent no JSON' }; })
        .then(function (data) {
          if (!r.ok || data.error) throw new Error(data.error || ('HTTP ' + r.status));
          return data;
        });
    });
  }

  var toastBox;
  function toast(message, kind) {
    if (!toastBox) { toastBox = el('toasts'); }
    var node = document.createElement('div');
    node.className = 'toast' + (kind ? ' ' + kind : '');
    node.textContent = message;
    toastBox.appendChild(node);
    setTimeout(function () {
      node.style.opacity = '0';
      node.style.transition = 'opacity .25s';
      setTimeout(function () { node.remove(); }, 260);
    }, kind === 'bad' ? 6000 : 2600);
  }

  function copy(text, button, label) {
    text = txt(text);
    if (!text) { toast('nothing to copy', 'bad'); return; }
    var done = function () {
      toast((label || 'Copied') + ' -- paste it into Instagram', 'ok');
      if (button) {
        var was = button.textContent;
        button.textContent = 'Copied';
        button.classList.add('copied');
        setTimeout(function () {
          button.textContent = was; button.classList.remove('copied');
        }, 1400);
      }
    };
    if (navigator.clipboard && window.isSecureContext !== false) {
      navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text, done); });
    } else { legacyCopy(text, done); }
  }
  function legacyCopy(text, done) {
    var box = document.createElement('textarea');
    box.value = text;
    box.style.cssText = 'position:fixed;top:-2000px';
    document.body.appendChild(box);
    box.select();
    try { document.execCommand('copy'); done(); }
    catch (e) { toast('could not reach the clipboard', 'bad'); }
    box.remove();
  }

  function scratch(id) {
    if (!state.scratch[id]) {
      state.scratch[id] = { reply: null, incoming: '', question: '', reels: '', assign: {} };
    }
    return state.scratch[id];
  }

  function leadById(id) {
    for (var i = 0; i < state.leads.length; i++) {
      if (state.leads[i].lead_id === id) return state.leads[i];
    }
    return null;
  }

  function replaceLead(lead) {
    if (!lead) return;
    for (var i = 0; i < state.leads.length; i++) {
      if (state.leads[i].lead_id === lead.lead_id) {
        // Keep the thread we already fetched; the server only sends the summary.
        lead.messages = lead.messages || state.leads[i].messages;
        state.leads[i] = lead;
        return;
      }
    }
    state.leads.push(lead);
  }

  function requirementLine(lead) {
    var parts = [lead.property_type, lead.deal_type && lead.deal_type.replace(/_/g, ' '),
                 lead.locality, lead.budget].filter(function (p) { return txt(p); });
    return parts.length ? parts.join(' / ') : 'requirement not captured yet';
  }

  function initials(lead) {
    var name = txt(lead.lead_name) || lead.lead_id;
    var bits = name.replace(/[^A-Za-z ]/g, '').trim().split(/\s+/);
    if (!bits[0]) return (lead.lead_id[0] || '?').toUpperCase();
    return (bits[0][0] + (bits[1] ? bits[1][0] : '')).toUpperCase();
  }

  function money(v) {
    var n = Number(String(v).replace(/[^\d.]/g, '')) || 0;
    if (!n) return '';
    if (n >= 10000000) return (n / 10000000).toFixed(2) + ' cr';
    if (n >= 100000) return (n / 100000).toFixed(2) + ' lakh';
    if (n >= 1000) return Math.round(n / 1000) + 'k';
    return String(n);
  }

  function propAmount(p) {
    if (p.headline) return p.headline;
    if (p.rent) return money(p.rent) + ' rent';
    if (p.price) return money(p.price);
    if (p.deposit) return money(p.deposit) + ' deposit';
    return 'price not returned';
  }

  function busy(key, on) {
    state.busy[key] = on;
    qsa('[data-busy="' + key + '"]').forEach(function (node) {
      node.disabled = !!on;
      if (on && !node.dataset.was) { node.dataset.was = node.textContent; node.innerHTML = '<span class="busy"></span>'; }
      else if (!on && node.dataset.was) { node.textContent = node.dataset.was; delete node.dataset.was; }
    });
  }

  /* --------------------------------------------------------------- filters */

  var FLAGS = {
    has_phone: ['Has mobile', function (l) { return !!txt(l.mobile_number); }],
    can_close: ['Ready to close', function (l) { return l.dm_can_be_closed === 'yes'; }],
    has_meeting: ['Meeting set', function (l) { return !!txt(l.meeting_schedule); }],
    needs_review: ['Needs review', function (l) { return l.needs_review === 'yes'; }],
    sourcing_open: ['Sourcing open', function (l) { return (l.open_tasks || 0) > 0; }],
    has_reels: ['Has reels', function (l) { return (l.reels || []).length > 0; }],
    quiet: ['Quiet 14+ days', function (l) { return Number(l.days_since_last_message) >= 14; }]
  };

  function visibleLeads() {
    var q = state.query.toLowerCase();
    return state.leads.filter(function (l) {
      if (state.score && txt(l.lead_score) !== state.score) return false;
      for (var key in state.flags) {
        if (state.flags[key] && !FLAGS[key][1](l)) return false;
      }
      if (!q) return true;
      return ['lead_id', 'lead_name', 'mobile_number', 'locality', 'city',
              'building_name', 'summary', 'budget', 'property_type', 'next_action',
              'notes', 'suggested_reply'].some(function (f) {
        return String(l[f] || '').toLowerCase().indexOf(q) >= 0;
      });
    });
  }

  /* ------------------------------------------------------------ pipeline */

  function renderKpis() {
    var all = state.leads;
    var count = function (fn) { return all.filter(fn).length; };
    var tiles = [
      ['Conversations', all.length, 'every Instagram handle on file', ''],
      ['Very hot', count(function (l) { return l.lead_score === 'very_hot'; }),
       'number on record or a meeting', 'hot'],
      ['Hot', count(function (l) { return l.lead_score === 'hot'; }),
       'clear requirement, no number yet', 'warm'],
      ['With mobile', count(function (l) { return txt(l.mobile_number); }),
       'can move to call or WhatsApp', 'good'],
      ['Meetings set', count(function (l) { return txt(l.meeting_schedule); }),
       'site or office visit agreed', 'good'],
      ['Sourcing open', state.tasks.filter(function (t) {
        return t.status === 'open' || t.status === 'in_progress'; }).length,
       'waiting on Sameer', 'accent'],
      ['Reels shared', count(function (l) { return (l.reels || []).length; }),
       'threads with listing context', 'accent']
    ];
    el('kpis').innerHTML = tiles.map(function (t) {
      return '<div class="kpi ' + t[3] + '"><div class="v">' + t[1] + '</div>' +
        '<div class="k">' + h(t[0]) + '</div><div class="sub">' + h(t[2]) + '</div></div>';
    }).join('');
  }

  function renderChips() {
    var scores = [['', 'All'], ['very_hot', 'Very hot'], ['hot', 'Hot'], ['cold', 'Cold']];
    el('scoreChips').innerHTML = scores.map(function (s) {
      var n = s[0] ? state.leads.filter(function (l) { return l.lead_score === s[0]; }).length
                   : state.leads.length;
      return '<button class="chip" data-score="' + s[0] + '" aria-pressed="' +
        (state.score === s[0]) + '">' + h(s[1]) + '<span class="n">' + n + '</span></button>';
    }).join('');
    el('flagChips').innerHTML = Object.keys(FLAGS).map(function (k) {
      var n = state.leads.filter(FLAGS[k][1]).length;
      return '<button class="chip" data-flag="' + k + '" aria-pressed="' +
        (!!state.flags[k]) + '">' + h(FLAGS[k][0]) + '<span class="n">' + n +
        '</span></button>';
    }).join('');
  }

  function leadRowHtml(lead) {
    var score = txt(lead.lead_score) || 'cold';
    var quiet = Number(lead.days_since_last_message);
    var reelCount = (lead.reels || []).length;
    var meta = [];
    if (txt(lead.mobile_number)) meta.push('<span title="mobile on record">&#9742; ' + h(lead.mobile_number.split(';')[0]) + '</span>');
    if (txt(lead.meeting_schedule)) meta.push('<span title="meeting noted">&#128197; meeting</span>');
    if (reelCount) meta.push('<span title="reels shared">&#9654; ' + reelCount + ' reel' + (reelCount > 1 ? 's' : '') + '</span>');
    if (lead.open_tasks) meta.push('<span title="open sourcing task">&#9873; Sameer</span>');
    if (quiet) meta.push('<span class="' + (quiet >= 14 ? 'quiet-high' : '') + '">' + quiet + 'd quiet</span>');
    if (lead.dm_can_be_closed === 'yes') meta.push('<span>ready to close</span>');

    return '' +
      '<div class="lead-row" data-act="toggle" data-id="' + h(lead.lead_id) + '" tabindex="0">' +
        '<div class="avatar ' + h(score) + '">' + h(initials(lead)) + '</div>' +
        '<div class="who">' +
          '<div class="name"><span class="who-name">' +
            h(txt(lead.lead_name) || lead.lead_id) + '</span>' +
            '<span class="pill ' + h(score) + '">' + h(score.replace('_', ' ')) + '</span>' +
            (txt(lead.lead_type) ? '<span class="pill tag">' + h(lead.lead_type) + '</span>' : '') +
          '</div>' +
          '<div class="handle">@' + h(lead.lead_id) + '</div>' +
        '</div>' +
        '<div class="need">' +
          '<div class="line">' + h(requirementLine(lead)) + '</div>' +
          '<div class="meta">' + meta.join('') + '</div>' +
        '</div>' +
        '<div class="row-actions">' +
          '<button class="btn" data-act="copy-reply" data-id="' + h(lead.lead_id) + '"' +
            (txt(lead.suggested_reply) ? '' : ' disabled') +
            ' title="Copy the drafted reply straight to the clipboard">Copy reply</button>' +
          '<button class="btn" data-act="open-assign" data-id="' + h(lead.lead_id) + '"' +
            ' title="Assign this requirement to Sameer">Assign Sameer</button>' +
          '<a class="btn ghost" href="https://www.instagram.com/' + h(lead.lead_id) +
            '/" target="_blank" rel="noopener" data-act="stop" title="Open the profile">DM</a>' +
          '<span class="chev">&#9654;</span>' +
        '</div>' +
      '</div>';
  }

  /* ---------------------------------------------------------- work lanes */

  function replyLaneHtml(lead) {
    var s = scratch(lead.lead_id);
    var value = s.reply === null ? txt(lead.suggested_reply) : s.reply;
    var draft = state.drafts[lead.lead_id];
    return '' +
      '<div class="lane">' +
        '<div class="lane-head">Reply' +
          (draft ? '<span class="badge">AI draft ready</span>' : '') +
          '<span class="grow"></span>' +
          '<button class="btn sm ghost" data-act="toggle-thread" data-id="' + h(lead.lead_id) + '">Thread</button>' +
        '</div>' +
        '<textarea class="reply-box" data-role="reply" data-id="' + h(lead.lead_id) + '" ' +
          'placeholder="The reply to paste into Instagram">' + h(value) + '</textarea>' +
        '<div class="btn-row">' +
          '<button class="btn primary" data-act="copy-box" data-id="' + h(lead.lead_id) + '">Copy</button>' +
          '<button class="btn" data-act="draft" data-id="' + h(lead.lead_id) +
            '" data-busy="draft-' + h(lead.lead_id) + '">Draft with AI</button>' +
          '<button class="btn" data-act="save" data-id="' + h(lead.lead_id) +
            '" data-busy="save-' + h(lead.lead_id) + '">Save to thread</button>' +
        '</div>' +
        '<input type="text" data-role="incoming" data-id="' + h(lead.lead_id) + '" ' +
          'value="' + h(s.incoming) + '" placeholder="What the lead just said (optional, sharpens the draft)">' +
        (draft ? draftNoteHtml(draft) : '') +
        '<div class="thread" data-role="thread" data-id="' + h(lead.lead_id) + '" hidden></div>' +
      '</div>';
  }

  function draftNoteHtml(draft) {
    var bits = [];
    if (txt(draft.goal_this_turn)) bits.push('<b>Goal:</b> ' + h(draft.goal_this_turn));
    if (txt(draft.meeting_proposal)) bits.push('<b>Meeting:</b> ' + h(draft.meeting_proposal));
    if (txt(draft.next_action)) bits.push('<b>Next:</b> ' + h(draft.next_action));
    if (txt(draft.confidence_note)) bits.push(h(draft.confidence_note));
    var cls = 'mini';
    if (txt(draft.search_error)) { bits.push('property lookup failed: ' + h(draft.search_error)); cls = 'mini bad'; }
    else if (!draft.matches.length) { bits.push('no matching property, so a sourcing task is offered below'); cls = 'mini warn'; }
    return '<div class="' + cls + '">' + bits.join('<br>') + '</div>';
  }

  function contextLaneHtml(lead) {
    var s = scratch(lead.lead_id);
    var reels = lead.reels || [];
    var fields = [
      ['deal_type', 'Deal', ['', 'rent', 'buy', 'heavy_deposit']],
      ['property_type', 'Config'],
      ['locality', 'Locality'],
      ['budget', 'Budget'],
      ['city', 'City'],
      ['building_name', 'Society'],
      ['mobile_number', 'Mobile'],
      ['lead_score', 'Score', ['', 'very_hot', 'hot', 'cold']],
      ['meeting_schedule', 'Meeting', null, true]
    ];
    return '' +
      '<div class="lane">' +
        '<div class="lane-head">Reels the lead shared' +
          '<span class="badge">' + reels.length + '</span></div>' +
        '<textarea rows="2" data-role="reels" data-id="' + h(lead.lead_id) + '" ' +
          'placeholder="Paste one or many Instagram reel / post links here, then Enter">' + h(s.reels) + '</textarea>' +
        '<div class="btn-row">' +
          '<button class="btn sm" data-act="add-reels" data-id="' + h(lead.lead_id) +
            '" data-busy="reels-' + h(lead.lead_id) + '">Add links</button>' +
          '<span class="mini">Tag a link with a property id and the AI answers in that context.</span>' +
        '</div>' +
        (reels.length ? '<div class="reel-list">' + reels.map(function (r) {
          return '<div class="reel' + (txt(r.property_id) ? ' tagged' : '') + '">' +
            '<div>' +
              '<div class="u" title="' + h(r.url) + '">' + h(r.url) + '</div>' +
              '<div class="tagrow">' +
                '<input type="text" data-role="reel-pid" data-reel="' + r.id + '" ' +
                  'value="' + h(r.property_id) + '" placeholder="property id">' +
                '<button class="btn sm" data-act="reel-tag" data-reel="' + r.id + '">Tag</button>' +
                '<button class="btn sm" data-act="reel-ask" data-reel="' + r.id +
                  '" data-id="' + h(lead.lead_id) + '">Ask</button>' +
              '</div>' +
            '</div>' +
            '<div class="acts">' +
              '<a class="btn sm ghost" href="' + h(r.url) + '" target="_blank" rel="noopener" data-act="stop">Open</a>' +
              '<button class="btn sm ghost" data-act="reel-del" data-reel="' + r.id + '" title="Remove">&times;</button>' +
            '</div>' +
          '</div>';
        }).join('') + '</div>' : '<div class="mini">Nothing shared yet.</div>') +

        '<div class="lane-head spaced">Requirement</div>' +
        '<div class="field-grid">' + fields.map(function (f) {
          var key = f[0], label = f[1], options = f[2], wide = f[3];
          var value = txt(lead[key]);
          var control = options
            ? '<select data-role="field" data-field="' + key + '" data-id="' + h(lead.lead_id) + '">' +
                options.map(function (o) {
                  return '<option value="' + h(o) + '"' + (o === value ? ' selected' : '') +
                    '>' + h(o || '--') + '</option>';
                }).join('') + '</select>'
            : '<input type="text" data-role="field" data-field="' + key + '" data-id="' +
                h(lead.lead_id) + '" value="' + h(value) + '">';
          return '<div class="field' + (wide ? ' wide' : '') + '"><label>' + h(label) + '</label>' +
            control + '</div>';
        }).join('') + '</div>' +
        '<div class="mini">Edits save when you leave the box. Every change lands in the history.</div>' +
      '</div>';
  }

  /* Shown instead of listings when nothing real is connected. The sample file
     in config/ exists so the app runs without credentials, but putting invented
     flats in front of a live conversation is worse than showing nothing. */
  function notConnectedHtml() {
    return '<div class="notice"><b>No live inventory connected</b>' +
      'Set <code>PROPERTY_API_BASE</code>, or the CRM keys, in <code>.env</code> and' +
      ' press Refresh. Sample listings are deliberately not shown, so nothing' +
      ' invented can reach a lead.</div>';
  }

  function propertyLaneHtml(lead) {
    var s = scratch(lead.lead_id);
    var found = state.props[lead.lead_id];
    var answer = state.answers[lead.lead_id];
    var a = s.assign || {};
    var tasks = lead.tasks || [];

    var propsHtml;
    if (!found) {
      propsHtml = '<div class="mini"><span class="busy"></span> searching inventory&hellip;</div>';
    } else if (found.sample) {
      propsHtml = notConnectedHtml();
    } else if (found.error) {
      propsHtml = '<div class="mini bad">' + h(found.error) + '</div>';
    } else if (!found.matches.length) {
      propsHtml = '<div class="mini warn">Nothing in inventory matches this requirement' +
        ' (' + h(found.source) + ', ' + found.pool + ' looked at). Assign it below.</div>';
    } else {
      propsHtml = '<div class="prop-list">' + found.matches.map(function (p) {
        return '<div class="prop' + (a.property_id === p.id ? ' picked' : '') + '">' +
          '<div class="t"><span>' + h(p.config || p.property_type || 'property') + ' ' +
            h(p.society || p.title || '') + '</span>' +
            '<span class="amt">' + h(propAmount(p)) + '</span></div>' +
          '<div class="s">' + h([p.locality, p.city].filter(Boolean).join(', ')) + '</div>' +
          (p.facts && p.facts.length ? '<div class="facts">' + p.facts.slice(0, 7).map(function (f) {
            return '<span>' + h(f.label) + ': ' + h(f.value) + '</span>';
          }).join('') + '</div>' : '') +
          '<div class="why"><span class="pid">' + h(p.id) + '</span>' +
            (p.matched_on ? ' &middot; matched on ' + h(p.matched_on) : '') +
            (p.pricing_known === false ? ' &middot; price not returned by search' : '') + '</div>' +
          '<div class="acts">' +
            '<button class="btn sm" data-act="prop-use" data-id="' + h(lead.lead_id) +
              '" data-pid="' + h(p.id) + '">Use in reply</button>' +
            '<button class="btn sm" data-act="prop-ask" data-id="' + h(lead.lead_id) +
              '" data-pid="' + h(p.id) + '" data-busy="ask-' + h(lead.lead_id) + '">Ask about it</button>' +
            '<button class="btn sm" data-act="prop-assign" data-id="' + h(lead.lead_id) +
              '" data-pid="' + h(p.id) + '">Assign this</button>' +
          '</div>' +
        '</div>';
      }).join('') + '</div>';
    }

    return '' +
      '<div class="lane">' +
        '<div class="lane-head">Live inventory' +
          (found ? '<span class="badge">' + h(found.source || '') + '</span>' : '') +
          '<span class="grow"></span>' +
          '<button class="btn sm ghost" data-act="prop-search" data-id="' + h(lead.lead_id) +
            '" data-busy="props-' + h(lead.lead_id) + '">Search again</button>' +
        '</div>' +
        '<input type="text" data-role="propq" data-id="' + h(lead.lead_id) + '" ' +
          'value="' + h(s.propq || '') + '" placeholder="Search inventory in your own words, then Enter">' +
        propsHtml +

        '<div class="lane-head spaced">Ask about a property</div>' +
        '<input type="text" data-role="question" data-id="' + h(lead.lead_id) + '" ' +
          'value="' + h(s.question) + '" placeholder="What did the lead ask about this property?">' +
        '<div class="btn-row">' +
          '<input type="text" data-role="askpid" data-id="' + h(lead.lead_id) + '" ' +
            'value="' + h(s.askpid || a.property_id || '') + '" placeholder="property id" style="flex:1">' +
          '<button class="btn" data-act="ask" data-id="' + h(lead.lead_id) +
            '" data-busy="ask-' + h(lead.lead_id) + '">Get the answer</button>' +
        '</div>' +
        '<div class="mini">Uses the reel links above plus that property id, so the answer' +
          ' is about the listing the lead actually saw.</div>' +
        (answer ? answerHtml(lead, answer) : '') +

        '<div class="lane-head spaced">Assign Sameer' +
          (tasks.length ? '<span class="badge">' + tasks.length + '</span>' : '') + '</div>' +
        '<div class="field-grid">' +
          assignField(lead, 'property_type', 'Config', a.property_type !== undefined ? a.property_type : lead.property_type) +
          assignField(lead, 'deal_type', 'Deal', a.deal_type !== undefined ? a.deal_type : lead.deal_type) +
          assignField(lead, 'locality', 'Locality', a.locality !== undefined ? a.locality : lead.locality) +
          assignField(lead, 'budget', 'Budget', a.budget !== undefined ? a.budget : lead.budget) +
          assignField(lead, 'property_id', 'Property id', a.property_id || '') +
          assignPriority(lead, a.priority || 'normal') +
          '<div class="field wide"><label>Note for Sameer</label>' +
            '<input type="text" data-role="assign" data-key="detail" data-id="' + h(lead.lead_id) +
            '" value="' + h(a.detail || '') + '" placeholder="anything he needs beyond the fields above"></div>' +
        '</div>' +
        '<div class="btn-row">' +
          '<button class="btn primary" data-act="assign" data-id="' + h(lead.lead_id) +
            '" data-busy="assign-' + h(lead.lead_id) + '">Assign to Sameer</button>' +
          '<button class="btn" data-act="copy-assign" data-id="' + h(lead.lead_id) +
            '">Copy as message</button>' +
        '</div>' +
        (tasks.length ? '<div class="reel-list">' + tasks.map(function (t) {
          return '<div class="reel"><div>' +
            '<div class="title">' + h(t.title) + '</div>' +
            '<div class="mini">' + h(t.assignee) + ' &middot; ' + h(t.created_at.slice(0, 10)) +
              (t.property_id ? ' &middot; ' + h(t.property_id) : '') + '</div></div>' +
            '<div class="acts">' +
              ['open', 'done', 'dropped'].map(function (v) {
                return '<button class="btn sm' + (t.status === v ? ' ok' : '') +
                  '" data-act="task-status" data-task="' + t.id + '" data-status="' + v +
                  '">' + v + '</button>';
              }).join('') +
            '</div></div>';
        }).join('') + '</div>' : '') +
      '</div>';
  }

  function assignField(lead, key, label, value) {
    return '<div class="field"><label>' + h(label) + '</label>' +
      '<input type="text" data-role="assign" data-key="' + key + '" data-id="' +
      h(lead.lead_id) + '" value="' + h(txt(value)) + '"></div>';
  }
  function assignPriority(lead, value) {
    return '<div class="field"><label>Priority</label>' +
      '<select data-role="assign" data-key="priority" data-id="' + h(lead.lead_id) + '">' +
      ['normal', 'high', 'urgent'].map(function (o) {
        return '<option' + (o === value ? ' selected' : '') + '>' + o + '</option>';
      }).join('') + '</select></div>';
  }

  function answerHtml(lead, answer) {
    return '<div class="answer">' +
      '<h5>Answer for ' + h(answer.property_id) + '</h5>' +
      '<p>' + h(answer.answer) + '</p>' +
      (answer.unknowns && answer.unknowns.length
        ? '<div class="mini warn">Not in the record: ' + h(answer.unknowns.join(', ')) + '</div>'
        : '') +
      '<div class="dm" data-role="answer-dm" data-id="' + h(lead.lead_id) + '">' +
        h(answer.dm_reply) + '</div>' +
      '<div class="btn-row" style="margin-top:7px">' +
        '<button class="btn sm primary" data-act="copy-answer" data-id="' + h(lead.lead_id) +
          '">Copy this reply</button>' +
        '<button class="btn sm" data-act="answer-to-reply" data-id="' + h(lead.lead_id) +
          '">Put it in the reply box</button>' +
      '</div>' +
      (txt(answer.follow_up_question)
        ? '<div class="mini" style="margin-top:6px">Worth asking next: ' +
          h(answer.follow_up_question) + '</div>' : '') +
      '</div>';
  }

  function workHtml(lead) {
    return '<div class="work">' + replyLaneHtml(lead) + contextLaneHtml(lead) +
      propertyLaneHtml(lead) + '</div>';
  }

  function renderPipeline() {
    var rows = visibleLeads();
    el('resultCount').textContent = rows.length + ' of ' + state.leads.length +
      ' conversation' + (state.leads.length === 1 ? '' : 's');
    if (!rows.length) {
      el('leadList').innerHTML = '<div class="empty"><b>Nothing matches</b>' +
        'Clear the filters, or run the ingest to bring in new DMs.</div>';
      return;
    }
    el('leadList').innerHTML = rows.map(function (lead) {
      var open = lead.lead_id === state.openId;
      return '<article class="lead' + (open ? ' open' : '') + '" data-lead="' +
        h(lead.lead_id) + '">' + leadRowHtml(lead) +
        (open ? workHtml(lead) : '') + '</article>';
    }).join('');
  }

  function rerenderOpenCard() {
    var lead = leadById(state.openId);
    if (!lead) { renderPipeline(); return; }
    var card = qs('.lead[data-lead="' + CSS.escape(lead.lead_id) + '"]');
    if (!card) { renderPipeline(); return; }
    captureScratch(lead.lead_id);
    card.innerHTML = leadRowHtml(lead) + workHtml(lead);
    card.classList.add('open');
  }

  function captureScratch(id) {
    var s = scratch(id);
    var card = qs('.lead[data-lead="' + CSS.escape(id) + '"]');
    if (!card) return;
    var reply = qs('[data-role="reply"]', card);
    if (reply) s.reply = reply.value;
    var incoming = qs('[data-role="incoming"]', card);
    if (incoming) s.incoming = incoming.value;
    var reels = qs('[data-role="reels"]', card);
    if (reels) s.reels = reels.value;
    var question = qs('[data-role="question"]', card);
    if (question) s.question = question.value;
    var askpid = qs('[data-role="askpid"]', card);
    if (askpid) s.askpid = askpid.value;
    var propq = qs('[data-role="propq"]', card);
    if (propq) s.propq = propq.value;
    qsa('[data-role="assign"]', card).forEach(function (node) {
      s.assign[node.dataset.key] = node.value;
    });
  }

  /* --------------------------------------------------------------- actions */

  function toggleLead(id) {
    if (state.openId === id) {
      captureScratch(id);
      state.openId = null;
      renderPipeline();
      return;
    }
    if (state.openId) captureScratch(state.openId);
    state.openId = id;
    renderPipeline();
    var card = qs('.lead[data-lead="' + CSS.escape(id) + '"]');
    if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    loadThread(id);
    if (!state.props[id]) searchProperties(id);
  }

  function loadThread(id) {
    var lead = leadById(id);
    if (lead && lead.messages) { paintThread(id); return; }
    api('/api/leads/' + encodeURIComponent(id)).then(function (full) {
      var target = leadById(id);
      if (target) {
        target.messages = full.messages;
        target.answers = full.answers;
        target.history = full.history;
      }
      paintThread(id);
    }).catch(function (err) { toast(err.message, 'bad'); });
  }

  function paintThread(id) {
    var lead = leadById(id);
    var box = qs('.lead[data-lead="' + CSS.escape(id) + '"] [data-role="thread"]');
    if (!box || !lead || !lead.messages) return;
    box.innerHTML = lead.messages.map(function (m) {
      var who = m.direction === 'lead' ? 'lead'
              : m.direction === 'business' ? 'business' : 'unknown';
      return '<div class="msg ' + who + '"><div><div class="bubble">' + h(m.text) +
        '</div><div class="when">' + h([m.date, m.time].filter(Boolean).join(' ')) +
        (who === 'unknown' ? ' &middot; sender not proven' : '') + '</div></div></div>';
    }).join('') || '<div class="mini">No messages stored for this thread.</div>';
    box.scrollTop = box.scrollHeight;
  }

  function searchProperties(id, freeText) {
    var lead = leadById(id);
    if (!lead) return;
    busy('props-' + id, true);
    var params = new URLSearchParams({ lead_id: id, limit: '8' });
    if (txt(freeText)) params.set('q', freeText);
    api('/api/properties/search?' + params.toString()).then(function (found) {
      state.props[id] = found;
      busy('props-' + id, false);
      if (state.openId === id) rerenderOpenCard();
    }).catch(function (err) {
      state.props[id] = { matches: [], error: err.message, source: '', pool: 0 };
      busy('props-' + id, false);
      if (state.openId === id) rerenderOpenCard();
    });
  }

  function draftReply(id) {
    var s = scratch(id);
    captureScratch(id);
    busy('draft-' + id, true);
    api('/api/leads/' + encodeURIComponent(id) + '/draft', {
      body: { message: s.incoming, query: s.propq || '' }
    }).then(function (data) {
      state.drafts[id] = data;
      state.props[id] = { matches: data.matches, source: data.match_source,
                          pool: data.inventory_size, error: data.search_error,
                          notes: data.search_notes };
      s.reply = data.reply;
      if (data.sourcing_action_for_sameer) {
        s.assign.detail = data.sourcing_action_for_sameer;
      }
      busy('draft-' + id, false);
      rerenderOpenCard();
      toast('Draft ready. Read it, then Copy.', 'ok');
    }).catch(function (err) {
      busy('draft-' + id, false);
      toast(err.message, 'bad');
    });
  }

  function saveExchange(id) {
    captureScratch(id);
    var s = scratch(id);
    var draft = state.drafts[id] || {};
    busy('save-' + id, true);
    api('/api/leads/' + encodeURIComponent(id) + '/save', {
      body: {
        lead_message: s.incoming,
        reply: s.reply,
        extracted: draft.extracted || {},
        next_action: draft.next_action || '',
        meeting_proposal: draft.meeting_proposal || '',
        sourcing_action_for_sameer: ''
      }
    }).then(function (out) {
      replaceLead(out.lead);
      s.incoming = '';
      busy('save-' + id, false);
      refreshTasks();
      rerenderOpenCard();
      toast('Saved: ' + out.messages_added + ' message(s), ' + out.changes + ' field(s)', 'ok');
    }).catch(function (err) {
      busy('save-' + id, false);
      toast(err.message, 'bad');
    });
  }

  function addReels(id) {
    captureScratch(id);
    var s = scratch(id);
    if (!txt(s.reels)) { toast('paste a link first', 'bad'); return; }
    busy('reels-' + id, true);
    api('/api/leads/' + encodeURIComponent(id) + '/reels', { body: { links: s.reels } })
      .then(function (out) {
        var lead = leadById(id);
        if (lead) lead.reels = out.reels;
        s.reels = '';
        busy('reels-' + id, false);
        rerenderOpenCard();
        toast(out.added + ' link(s) added as context', 'ok');
      }).catch(function (err) {
        busy('reels-' + id, false);
        toast(err.message, 'bad');
      });
  }

  function tagReel(reelId, propertyId, remove) {
    api('/api/reels/' + reelId, {
      body: remove ? { delete: true } : { property_id: propertyId }
    }).then(function (out) {
      var lead = leadById(state.openId);
      if (lead) lead.reels = out.reels;
      rerenderOpenCard();
      toast(remove ? 'link removed' : 'link tagged to ' + propertyId, 'ok');
    }).catch(function (err) { toast(err.message, 'bad'); });
  }

  function askAbout(id, propertyId) {
    captureScratch(id);
    var s = scratch(id);
    propertyId = txt(propertyId) || txt(s.askpid);
    if (!propertyId) { toast('put a property id in first', 'bad'); return; }
    s.askpid = propertyId;
    busy('ask-' + id, true);
    api('/api/properties/answer', {
      body: {
        lead_id: id, property_id: propertyId,
        question: s.question,
        reel_links: txt(s.reels)
      }
    }).then(function (out) {
      state.answers[id] = out;
      var lead = leadById(id);
      if (lead && out.reel_urls) {
        api('/api/leads/' + encodeURIComponent(id)).then(function (full) {
          var target = leadById(id);
          if (target) target.reels = full.reels;
          if (state.openId === id) rerenderOpenCard();
        });
      }
      busy('ask-' + id, false);
      rerenderOpenCard();
      toast('Answer ready', 'ok');
    }).catch(function (err) {
      busy('ask-' + id, false);
      toast(err.message, 'bad');
    });
  }

  function assignTitle(a) {
    return ('Source ' + (txt(a.property_type) || 'property') + ' ' +
      (txt(a.deal_type) ? 'on ' + a.deal_type.replace(/_/g, ' ') + ' ' : '') +
      'in ' + (txt(a.locality) || 'the requested area') +
      (txt(a.budget) ? ', budget ' + a.budget : '')).replace(/\s+/g, ' ').trim();
  }

  function assignText(lead) {
    var a = scratch(lead.lead_id).assign;
    var reels = (lead.reels || []).map(function (r) { return r.url; });
    return [
      assignTitle(a),
      'Lead: ' + (txt(lead.lead_name) || lead.lead_id) + ' (@' + lead.lead_id + ')',
      txt(lead.mobile_number) ? 'Mobile: ' + lead.mobile_number : '',
      txt(a.property_id) ? 'Property id: ' + a.property_id : '',
      txt(a.detail) ? 'Note: ' + a.detail : '',
      reels.length ? 'Reels: ' + reels.join(' ') : ''
    ].filter(Boolean).join('\n');
  }

  function assign(id) {
    captureScratch(id);
    var lead = leadById(id);
    var a = scratch(id).assign;
    busy('assign-' + id, true);
    api('/api/tasks', {
      body: {
        lead_id: id, assignee: 'Sameer', title: assignTitle(a),
        detail: txt(a.detail), property_id: txt(a.property_id),
        deal_type: txt(a.deal_type), property_type: txt(a.property_type),
        locality: txt(a.locality), budget: txt(a.budget),
        city: txt(lead.city), units: txt(lead.units_required),
        possession: txt(lead.possession_timeline),
        priority: txt(a.priority) || 'normal', source: 'pipeline'
      }
    }).then(function (out) {
      replaceLead(out.lead);
      state.tasks = out.tasks;
      busy('assign-' + id, false);
      rerenderOpenCard();
      renderKpis();
      renderNavCounts();
      toast('Assigned to Sameer', 'ok');
    }).catch(function (err) {
      busy('assign-' + id, false);
      toast(err.message, 'bad');
    });
  }

  function setTaskStatus(taskId, status) {
    api('/api/tasks/' + taskId + '/status', { body: { status: status } })
      .then(function (out) {
        state.tasks = out.tasks;
        if (out.lead) replaceLead(out.lead);
        if (state.view === 'sourcing') renderSourcing();
        else if (state.openId) rerenderOpenCard();
        renderKpis();
        renderNavCounts();
        toast('marked ' + status, 'ok');
      }).catch(function (err) { toast(err.message, 'bad'); });
  }

  function refreshTasks() {
    api('/api/bootstrap').then(function (boot) {
      state.tasks = boot.tasks;
      renderKpis();
      renderNavCounts();
    }).catch(function () { /* the pipeline still works without the counts */ });
  }

  /* ------------------------------------------------------------ other views */

  function renderSourcing() {
    var tasks = state.tasks;
    var count = function (s) { return tasks.filter(function (t) { return t.status === s; }).length; };
    el('sourcingKpis').innerHTML = [
      ['Open', count('open'), 'accent'], ['In progress', count('in_progress'), 'warm'],
      ['Done', count('done'), 'good'], ['Dropped', count('dropped'), '']
    ].map(function (t) {
      return '<div class="kpi ' + t[2] + '"><div class="v">' + t[1] + '</div>' +
        '<div class="k">' + t[0] + '</div></div>';
    }).join('');

    if (!tasks.length) {
      el('sourcingList').innerHTML = '<div class="empty"><b>Sameer has nothing queued</b>' +
        'Assign a requirement from any pipeline row and it lands here.</div>';
      return;
    }
    el('sourcingList').innerHTML = '<div class="cards">' + tasks.map(function (t) {
      var bits = [t.property_type, t.deal_type, t.locality, t.budget]
        .filter(function (v) { return txt(v); }).join(' / ');
      return '<div class="card ' + h(t.status) + '">' +
        '<h4>' + h(t.title) + '</h4>' +
        '<div class="sub">' + h(t.assignee) + ' &middot; raised ' +
          h(String(t.created_at).slice(0, 10)) +
          ' &middot; <span class="pill ' + h(t.status) + '">' + h(t.status) + '</span></div>' +
        (bits ? '<p>' + h(bits) + '</p>' : '') +
        (txt(t.detail) ? '<p>' + h(t.detail) + '</p>' : '') +
        (txt(t.property_id) ? '<p class="mini">property ' + h(t.property_id) + '</p>' : '') +
        (txt(t.reel_urls) ? '<p class="mini">' + t.reel_urls.split(/;\s*/).map(function (u) {
          return '<a href="' + h(u) + '" target="_blank" rel="noopener">reel</a>';
        }).join(' ') + '</p>' : '') +
        '<div class="btn-row">' +
          (t.lead_id ? '<button class="btn sm" data-act="goto-lead" data-id="' +
            h(t.lead_id) + '">@' + h(t.lead_id) + '</button>' : '') +
          ['open', 'in_progress', 'done', 'dropped'].map(function (v) {
            return '<button class="btn sm' + (t.status === v ? ' ok' : '') +
              '" data-act="task-status" data-task="' + t.id + '" data-status="' + v +
              '">' + v.replace('_', ' ') + '</button>';
          }).join('') +
          '<button class="btn sm ghost" data-act="copy-task" data-task="' + t.id +
            '">Copy</button>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  function renderInventory() {
    var found = state.inventory;
    if (!found) {
      el('invList').innerHTML = '<div class="mini">Type a requirement above and press Enter.</div>';
      return;
    }
    if (found.sample) {
      el('invMeta').textContent = '';
      el('invList').innerHTML = notConnectedHtml();
      return;
    }
    if (found.error) {
      el('invList').innerHTML = '<div class="empty"><b>Search failed</b>' + h(found.error) + '</div>';
      return;
    }
    el('invMeta').textContent = found.matches.length + ' of ' + found.pool +
      ' looked at, via ' + (found.source || 'unknown');
    if (!found.matches.length) {
      el('invList').innerHTML = '<div class="empty"><b>Nothing matched</b>' +
        'Widen the area or the budget.</div>';
      return;
    }
    el('invList').innerHTML = '<div class="cards">' + found.matches.map(function (p) {
      return '<div class="card">' +
        '<h4>' + h(p.config || '') + ' ' + h(p.society || p.title || 'property') + '</h4>' +
        '<div class="sub">' + h([p.locality, p.city].filter(Boolean).join(', ')) +
          ' &middot; <b style="color:var(--accent)">' + h(propAmount(p)) + '</b></div>' +
        (p.facts && p.facts.length ? '<div class="facts">' +
          p.facts.map(function (f) {
            return '<span>' + h(f.label) + ': ' + h(f.value) + '</span>';
          }).join('') + '</div>' : '') +
        '<p class="mini">' + h(p.id) +
          (p.matched_on ? ' &middot; ' + h(p.matched_on) : '') + '</p>' +
        '<div class="btn-row"><button class="btn sm" data-act="copy-prop" data-pid="' +
          h(p.id) + '">Copy details</button></div>' +
      '</div>';
    }).join('') + '</div>';
  }

  function renderActivity() {
    var daily = (state.boot.daily || []).slice(0, 30).reverse();
    var max = Math.max.apply(null, daily.map(function (d) { return d.messages; }).concat([1]));
    el('dailyBars').innerHTML = daily.map(function (d) {
      var seg = function (cls, n) {
        return n ? '<i class="' + cls + '" style="width:' + (n / max * 100) + '%"></i>' : '';
      };
      return '<div class="bar-row"><span class="d">' + h(d.date) + '</span>' +
        '<span class="bar">' + seg('lead', d.lead_messages) +
        seg('business', d.our_messages) + seg('unknown', d.unattributed) + '</span>' +
        '<span class="n">' + d.messages + '</span></div>';
    }).join('') || '<div class="mini">No dated messages yet.</div>';

    var weekly = state.boot.weekly || [];
    el('weeklyTable').innerHTML =
      '<thead><tr><th>Week</th><th>From</th><th>To</th><th class="num">Messages</th>' +
      '<th class="num">Leads</th></tr></thead><tbody>' +
      weekly.map(function (w) {
        return '<tr><td>' + h(w.week) + '</td><td>' + h(w.week_start) + '</td><td>' +
          h(w.week_end) + '</td><td class="num">' + w.messages + '</td><td class="num">' +
          w.leads + '</td></tr>';
      }).join('') + '</tbody>';

    var log = state.boot.changelog || [];
    el('historyTable').innerHTML =
      '<thead><tr><th>When</th><th>Lead</th><th>Change</th><th>Field</th>' +
      '<th>From</th><th>To</th></tr></thead><tbody>' +
      log.slice(0, 200).map(function (c) {
        return '<tr><td>' + h(String(c.run_timestamp).replace('T', ' ')) + '</td>' +
          '<td class="lead-link" data-act="goto-lead" data-id="' + h(c.lead_id) + '">@' +
          h(c.lead_id) + '</td><td>' + h(c.change_type) + '</td><td>' + h(c.field) +
          '</td><td>' + h(String(c.old_value).slice(0, 70)) + '</td><td>' +
          h(String(c.new_value).slice(0, 70)) + '</td></tr>';
      }).join('') + '</tbody>';
  }

  function renderRequirements() {
    var groups = {};
    state.leads.forEach(function (l) {
      if (['seller', 'landlord', 'not_a_lead'].indexOf(txt(l.lead_type)) >= 0) return;
      if (!txt(l.locality) && !txt(l.property_type) && !txt(l.budget)) return;
      var key = [txt(l.deal_type) || 'deal not said', txt(l.property_type) || 'config not said',
                 txt(l.locality) || 'area not said'].join(' | ');
      if (!groups[key]) groups[key] = { key: key, leads: [], budgets: [] };
      groups[key].leads.push(l);
      if (txt(l.budget)) groups[key].budgets.push(l.budget);
    });
    var rows = Object.keys(groups).map(function (k) { return groups[k]; })
      .sort(function (a, b) { return b.leads.length - a.leads.length; });

    if (!rows.length) {
      el('reqList').innerHTML = '<div class="empty"><b>No requirements captured yet</b>' +
        'They appear once a thread names an area, a configuration or a budget.</div>';
      return;
    }
    el('reqList').innerHTML = '<div class="cards">' + rows.map(function (g) {
      // Escape first, then put the separator in: inserting the entity before
      // h() runs is what printed a literal "&middot;" in the heading.
      return '<div class="card"><h4>' + h(g.key).replace(/ \| /g, ' &middot; ') + '</h4>' +
        '<div class="sub">' + g.leads.length + ' lead' + (g.leads.length > 1 ? 's' : '') +
        (g.budgets.length ? ' &middot; budgets: ' + h(g.budgets.join(', ')) : '') + '</div>' +
        '<div class="btn-row">' + g.leads.map(function (l) {
          return '<button class="btn sm" data-act="goto-lead" data-id="' + h(l.lead_id) +
            '">@' + h(l.lead_id) + '</button>';
        }).join('') + '</div>' +
        '<div class="btn-row" style="margin-top:7px">' +
          '<button class="btn sm ghost" data-act="copy-req" data-key="' + h(g.key) +
            '">Copy for Sameer</button></div>' +
      '</div>';
    }).join('') + '</div>';
  }

  /* ---------------------------------------------------------------- chrome */

  function renderNavCounts() {
    var open = state.tasks.filter(function (t) {
      return t.status === 'open' || t.status === 'in_progress'; }).length;
    var map = { pipeline: state.leads.length, sourcing: open };
    qsa('.nav button').forEach(function (b) {
      var n = map[b.dataset.view];
      var badge = qs('.nav-count', b);
      if (badge) badge.textContent = n === undefined ? '' : n;
    });
  }

  function statHtml(node, dot, label, value, hint) {
    node.innerHTML = '<i class="dot ' + dot + '"></i><b>' + h(label) + '</b>' +
      '<em>' + h(value) + '</em>';
    // The value is the first thing the layout drops on a narrow screen, so it
    // has to stay somewhere the pointer can still reach.
    node.title = label + ': ' + value + (hint ? ' -- ' + hint : '');
  }

  function renderStatus() {
    var health = state.boot.health || {};
    var inv = health.inventory || {};
    var counts = health.counts || {};

    el('brandAccount').textContent = health.account ? '@' + health.account : '';

    var ai = health.ai || {};
    var aiOn = ai.provider ? ai.ok : health.gemini_configured;
    statHtml(el('statGemini'), aiOn ? 'on' : 'off', 'AI',
      aiOn ? (health.model || 'ready')
           : (ai.provider === 'claude_cli' ? 'claude CLI not found' : 'no key in .env'),
      health.model_note || '');

    var invDot = inv.ok ? 'on' : (inv.sample || inv.mode === 'not connected' ? 'warn' : 'off');
    statHtml(el('statProps'), invDot, 'Inventory',
      inv.ok ? (inv.mode || 'ready') + ', ' + (inv.inventory_size || 0) + ' in pool'
             : (inv.mode === 'not connected' ? 'not connected' : (inv.error || 'unavailable')),
      (inv.notes || []).join(' '));

    statHtml(el('statDb'), 'on', 'Data',
      (counts.leads || 0) + ' leads, ' + (counts.messages || 0) + ' messages',
      health.database || '');

    renderEnvCards(health, inv, counts);
  }

  /* The same facts, spelled out, in the How it works tab -- so nobody has to
     guess what a dot in the corner meant. */
  function renderEnvCards(health, inv, counts) {
    var box = el('envCards');
    if (!box) return;
    var invLine = inv.ok
      ? (inv.inventory_size || 0) + ' listings reachable'
      : (inv.mode === 'not connected'
          ? 'set PROPERTY_API_BASE or the CRM keys in .env'
          : (inv.error || 'unavailable'));
    var cards = [
      ['Account', health.account ? '@' + health.account : 'not set',
       'from config/fetch-config.json', health.account ? '' : 'bad'],
      ['Model', health.gemini_configured ? (health.model || 'ready') : 'no key',
       health.model_note || 'GEMINI_API_KEY in .env',
       health.gemini_configured ? 'good' : 'bad'],
      ['Inventory', inv.mode || 'unknown', invLine, inv.ok ? 'good' : 'bad'],
      ['Database', (counts.leads || 0) + ' leads', (counts.messages || 0) +
       ' messages, ' + (counts.changelog || 0) + ' changes', 'accent'],
      ['Reels stored', counts.reels || 0, 'links shared in threads', ''],
      ['Sourcing tasks', counts.tasks || 0, 'raised from this desk', '']
    ];
    box.innerHTML = cards.map(function (c) {
      var tight = String(c[1]).length > 12 ? ' tight' : '';
      return '<div class="kpi ' + c[3] + tight + '"><div class="v">' + h(c[1]) + '</div>' +
        '<div class="k">' + h(c[0]) + '</div><div class="sub">' + h(c[2]) + '</div></div>';
    }).join('');
  }

  function showView(name) {
    state.view = name;
    qsa('.nav button').forEach(function (b) {
      b.setAttribute('aria-current', String(b.dataset.view === name));
    });
    qsa('.view').forEach(function (v) { v.hidden = v.dataset.view !== name; });
    if (name === 'sourcing') renderSourcing();
    if (name === 'activity') renderActivity();
    if (name === 'requirements') renderRequirements();
    if (name === 'inventory') renderInventory();
    if (name === 'inbox') { renderShots(); renderInboxPreview(); }
  }

  /* ----------------------------------------------------------------- inbox
   *
   * A screenshot pasted here becomes a lead. The read and the save are two
   * separate calls on purpose: the handle is guessed off the header of a
   * picture, and one wrong character would open a second row for someone
   * already in the pipeline. So everything below is editable, and nothing
   * reaches the database until Add is pressed.
   */

  function shotName(file, index) {
    return (file && file.name) || ('pasted-' + (index + 1) + '.png');
  }

  function addShots(files) {
    var list = Array.prototype.slice.call(files || []).filter(function (f) {
      return f && /^image\//.test(f.type);
    });
    if (!list.length) { toast('that was not a picture', 'bad'); return; }
    list.forEach(function (file, i) {
      var reader = new FileReader();
      reader.onload = function () {
        state.inbox.shots.push({ name: shotName(file, state.inbox.shots.length + i),
                                 url: String(reader.result) });
        renderShots();
      };
      reader.onerror = function () { toast('could not read that picture', 'bad'); };
      reader.readAsDataURL(file);
    });
  }

  function renderShots() {
    var shots = state.inbox.shots;
    el('inboxShots').innerHTML = shots.map(function (s, i) {
      return '<figure class="shot"><img src="' + h(s.url) + '" alt="' + h(s.name) + '">' +
        '<figcaption><span>' + h(s.name) + '</span>' +
        '<button class="btn sm ghost" data-act="inbox-drop-shot" data-i="' + i +
        '" title="Remove">&times;</button></figcaption></figure>';
    }).join('');
    el('inboxActions').hidden = !shots.length;
    el('inboxHint').textContent = shots.length
      ? shots.length + ' screenshot' + (shots.length === 1 ? '' : 's') +
        ' ready. Reading takes roughly ' + (12 * shots.length) + ' seconds.'
      : '';
  }

  function inboxChips(draft) {
    var got = draft.extracted || {};
    var pairs = [['lead_score', got.lead_score], ['lead_type', got.lead_type],
                 ['deal', got.deal_type], ['type', got.property_type],
                 ['where', got.locality || got.city], ['budget', got.budget],
                 ['phone', got.mobile_number], ['meeting', got.meeting_schedule]];
    return pairs.filter(function (p) { return txt(p[1]); }).map(function (p) {
      return '<span class="chip static">' + h(p[0]) + ': ' + h(p[1]) + '</span>';
    }).join('');
  }

  function inboxLeadHtml(entry, index) {
    var draft = entry.draft || {};
    var edit = entry.edit || {};
    var keep = edit.keep !== false;
    var thread = (entry.read_messages || []).map(function (m) {
      var who = m.direction === 'business' ? 'business'
              : (m.direction === 'lead' ? 'lead' : 'unknown');
      return '<div class="msg ' + who + '"><div><div class="bubble">' + h(m.text) +
        '</div><div class="when">' + h(txt(m.date) || 'no date') + ' ' +
        h(m.time || '') + '</div></div></div>';
    }).join('') || '<div class="mini">no messages were readable</div>';

    return '<article class="inbox-lead' + (keep ? '' : ' skipped') +
      '" data-read="' + h(entry.lead_id) + '" data-i="' + index + '">' +
      '<header class="inbox-head">' +
        '<label class="handle">@<input type="text" data-role="inbox-handle" value="' +
          h(txt(edit.lead_id) || entry.lead_id) + '" spellcheck="false"></label>' +
        '<input type="text" class="named" data-role="inbox-name" placeholder="name" value="' +
          h(txt(edit.lead_name) || entry.lead_name || '') + '">' +
        '<span class="tag ' + (entry.existing ? 'known' : 'fresh') + '">' +
          (entry.existing ? 'already on file' : 'new lead') + '</span>' +
        '<span class="mini">' + (entry.read_messages || []).length +
          ' read, ' + entry.new_messages + ' new to us</span>' +
        '<label class="keep"><input type="checkbox" data-role="inbox-keep"' +
          (keep ? ' checked' : '') + '> add this one</label>' +
      '</header>' +
      (draft.error ? '<div class="warn-line">the draft failed: ' + h(draft.error) +
                     '. The conversation can still be added.</div>' : '') +
      '<div class="inbox-cols">' +
        '<div class="thread inbox-thread">' + thread + '</div>' +
        '<div class="inbox-draft">' +
          '<div class="chips">' + inboxChips(draft) + '</div>' +
          '<label class="mini">What to reply</label>' +
          '<textarea data-role="inbox-reply" rows="5">' +
            h(txt(edit.reply) !== '' ? edit.reply : (draft.reply || '')) + '</textarea>' +
          '<div class="btn-row">' +
            '<button class="btn primary" data-act="inbox-copy" data-i="' + index +
              '">Copy</button>' +
            (draft.next_action ? '<span class="mini">next: ' + h(draft.next_action) +
                                 '</span>' : '') +
          '</div>' +
          (draft.matches && draft.matches.length
            ? '<p class="mini">' + draft.matches.length +
              ' matching listing(s) were used to write this.</p>'
            : '<p class="mini">no inventory matched, so the reply promises nothing.</p>') +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function renderInboxPreview() {
    var box = el('inboxPreview');
    var data = state.inbox;
    if (!data.leads.length) { box.innerHTML = data.done || ''; return; }
    box.innerHTML =
      (data.warnings && data.warnings.length
        ? '<div class="warn-line">' + data.warnings.map(h).join('<br>') + '</div>' : '') +
      '<div class="view-head sub"><div class="view-title"><h3>Read ' +
        data.leads.length + ' conversation' + (data.leads.length === 1 ? '' : 's') +
        '</h3></div><p>Check the handle against the screenshot before you add it. ' +
        'Nothing here is saved yet.</p></div>' +
      data.leads.map(inboxLeadHtml).join('') +
      '<div class="btn-row sticky-actions">' +
        '<button class="btn primary lg" data-act="inbox-commit">Add to pipeline</button>' +
        '<button class="btn ghost" data-act="inbox-discard">Discard this read</button>' +
      '</div>';
  }

  function captureInbox() {
    qsa('#inboxPreview .inbox-lead').forEach(function (card) {
      var entry = state.inbox.leads[Number(card.dataset.i)];
      if (!entry) return;
      var handle = qs('[data-role="inbox-handle"]', card);
      var name = qs('[data-role="inbox-name"]', card);
      var reply = qs('[data-role="inbox-reply"]', card);
      var keep = qs('[data-role="inbox-keep"]', card);
      entry.edit = {
        lead_id: handle ? txt(handle.value).replace(/^@/, '').toLowerCase() : '',
        lead_name: name ? txt(name.value) : '',
        reply: reply ? reply.value : '',
        keep: keep ? keep.checked : true
      };
    });
  }

  function inboxRead() {
    var shots = state.inbox.shots;
    if (!shots.length) { toast('paste a screenshot first', 'bad'); return; }
    if (state.inbox.busy) return;
    state.inbox.busy = true;
    state.inbox.done = '';
    el('inboxPreview').innerHTML = '<div class="mini"><span class="busy"></span> ' +
      'reading ' + shots.length + ' screenshot' + (shots.length === 1 ? '' : 's') +
      ', then drafting the reply&hellip;</div>';
    api('/api/inbox/read', {
      body: { images: shots.map(function (s) { return { name: s.name, data: s.url }; }) }
    }).then(function (out) {
      state.inbox.busy = false;
      state.inbox.batch = out.batch;
      state.inbox.leads = out.leads || [];
      state.inbox.warnings = out.warnings || [];
      renderInboxPreview();
      toast('read ' + state.inbox.leads.length + ' conversation(s)', 'ok');
    }).catch(function (err) {
      state.inbox.busy = false;
      el('inboxPreview').innerHTML = '<div class="empty"><b>Could not read that</b>' +
        h(err.message) + '</div>';
    });
  }

  function inboxCommit() {
    captureInbox();
    if (state.inbox.busy) return;
    var picked = state.inbox.leads.filter(function (e) {
      return !e.edit || e.edit.keep !== false; });
    if (!picked.length) { toast('nothing is ticked to add', 'bad'); return; }
    state.inbox.busy = true;
    api('/api/inbox/commit', {
      body: {
        batch: state.inbox.batch,
        leads: state.inbox.leads.map(function (e) {
          var edit = e.edit || {};
          return { read_as: e.lead_id, lead_id: edit.lead_id || e.lead_id,
                   lead_name: edit.lead_name, reply: edit.reply,
                   skip: edit.keep === false };
        })
      }
    }).then(function (out) {
      state.inbox.busy = false;
      var c = out.counts || {};
      state.inbox.shots = [];
      state.inbox.leads = [];
      state.inbox.batch = '';
      state.inbox.done = '<div class="empty"><b>Added to the pipeline</b>' +
        (c.new || 0) + ' new lead(s), ' + (c.updated || 0) + ' updated, ' +
        (c.messages || 0) + ' message(s) stored.<br>' +
        (c.handles || []).map(function (id) {
          return '<button class="btn sm" data-act="goto-lead" data-id="' + h(id) +
            '">@' + h(id) + '</button>';
        }).join(' ') + '</div>';
      renderShots();
      renderInboxPreview();
      toast('saved ' + ((c.handles || []).length) + ' conversation(s)', 'ok');
      boot(false);
    }).catch(function (err) {
      state.inbox.busy = false;
      toast(err.message, 'bad');
    });
  }

  /* ------------------------------------------------------------------ wire */

  function onClick(event) {
    var node = event.target.closest('[data-act]');
    if (!node) return;
    var act = node.dataset.act;
    var id = node.dataset.id;

    if (act === 'stop') { event.stopPropagation(); return; }
    if (node.tagName !== 'A') event.preventDefault();
    if (act !== 'toggle') event.stopPropagation();

    switch (act) {
      case 'toggle': toggleLead(id); break;
      case 'copy-reply': {
        var lead = leadById(id);
        copy(lead && lead.suggested_reply, node, 'Reply copied');
        break;
      }
      case 'copy-box': {
        captureScratch(id);
        copy(scratch(id).reply, node, 'Reply copied');
        break;
      }
      case 'open-assign':
        if (state.openId !== id) toggleLead(id);
        setTimeout(function () {
          var card = qs('.lead[data-lead="' + CSS.escape(id) + '"]');
          var target = card && qs('[data-act="assign"]', card);
          if (target) {
            target.scrollIntoView({ block: 'center', behavior: 'smooth' });
            var first = qs('[data-role="assign"]', card);
            if (first) first.focus();
          }
        }, 60);
        break;
      case 'draft': draftReply(id); break;
      case 'save': saveExchange(id); break;
      case 'add-reels': addReels(id); break;
      case 'reel-tag': {
        var box = qs('[data-role="reel-pid"][data-reel="' + node.dataset.reel + '"]');
        tagReel(node.dataset.reel, box ? box.value : '', false);
        break;
      }
      case 'reel-del': tagReel(node.dataset.reel, '', true); break;
      case 'reel-ask': {
        var pidBox = qs('[data-role="reel-pid"][data-reel="' + node.dataset.reel + '"]');
        askAbout(id, pidBox ? pidBox.value : '');
        break;
      }
      case 'prop-search': {
        captureScratch(id);
        searchProperties(id, scratch(id).propq);
        break;
      }
      case 'prop-use': {
        captureScratch(id);
        var found = state.props[id];
        var prop = found && found.matches.filter(function (p) {
          return p.id === node.dataset.pid; })[0];
        if (prop) {
          var line = (prop.config ? prop.config + ' ' : '') +
            (prop.society || prop.title || '') +
            (prop.locality ? ', ' + prop.locality : '') + ' -- ' + propAmount(prop);
          var s = scratch(id);
          s.reply = txt(s.reply) ? s.reply + '\n' + line : line;
          rerenderOpenCard();
          toast('added to the reply box', 'ok');
        }
        break;
      }
      case 'prop-ask': askAbout(id, node.dataset.pid); break;
      case 'prop-assign': {
        captureScratch(id);
        var lead2 = leadById(id);
        var f = state.props[id];
        var picked = f && f.matches.filter(function (p) { return p.id === node.dataset.pid; })[0];
        var a = scratch(id).assign;
        a.property_id = node.dataset.pid;
        if (picked) {
          a.locality = a.locality || picked.locality;
          a.property_type = a.property_type || picked.config;
        }
        if (lead2) {
          a.deal_type = a.deal_type || lead2.deal_type;
          a.budget = a.budget || lead2.budget;
        }
        rerenderOpenCard();
        break;
      }
      case 'ask': askAbout(id, null); break;
      case 'assign': assign(id); break;
      case 'copy-assign': {
        captureScratch(id);
        copy(assignText(leadById(id)), node, 'Assignment copied');
        break;
      }
      case 'copy-answer': {
        var ans = state.answers[id];
        copy(ans && ans.dm_reply, node, 'Reply copied');
        break;
      }
      case 'answer-to-reply': {
        var answer = state.answers[id];
        if (answer) { scratch(id).reply = answer.dm_reply; rerenderOpenCard(); }
        break;
      }
      case 'task-status': setTaskStatus(node.dataset.task, node.dataset.status); break;
      case 'copy-task': {
        var task = state.tasks.filter(function (t) {
          return String(t.id) === node.dataset.task; })[0];
        if (task) {
          copy([task.title, task.detail,
                task.lead_id ? 'Lead: @' + task.lead_id : '',
                task.property_id ? 'Property: ' + task.property_id : '',
                task.reel_urls ? 'Reels: ' + task.reel_urls : ''
               ].filter(Boolean).join('\n'), node, 'Task copied');
        }
        break;
      }
      case 'copy-prop': {
        var inv = state.inventory;
        var p = inv && inv.matches.filter(function (x) { return x.id === node.dataset.pid; })[0];
        if (p) {
          copy([(p.config || '') + ' ' + (p.society || p.title || ''),
                [p.locality, p.city].filter(Boolean).join(', '),
                propAmount(p),
                (p.facts || []).map(function (x) { return x.label + ': ' + x.value; }).join('\n')
               ].filter(Boolean).join('\n'), node, 'Details copied');
        }
        break;
      }
      case 'copy-req': copy(node.dataset.key.replace(/ \| /g, ', '), node, 'Requirement copied'); break;
      case 'goto-lead':
        showView('pipeline');
        state.query = '';
        el('search').value = '';
        state.score = ''; state.flags = {};
        renderChips();
        renderPipeline();
        toggleLead(id);
        break;
      case 'toggle-thread': {
        var t = qs('.lead[data-lead="' + CSS.escape(id) + '"] [data-role="thread"]');
        if (t) { t.hidden = !t.hidden; if (!t.hidden) paintThread(id); }
        break;
      }
      case 'inbox-pick': el('inboxFile').click(); break;
      case 'inbox-read': inboxRead(); break;
      case 'inbox-commit': inboxCommit(); break;
      case 'inbox-clear':
        state.inbox.shots = [];
        renderShots();
        break;
      case 'inbox-discard':
        state.inbox.leads = [];
        state.inbox.batch = '';
        state.inbox.warnings = [];
        state.inbox.done = '';
        renderInboxPreview();
        break;
      case 'inbox-drop-shot':
        state.inbox.shots.splice(Number(node.dataset.i), 1);
        renderShots();
        break;
      case 'inbox-copy': {
        captureInbox();
        var entry = state.inbox.leads[Number(node.dataset.i)];
        copy(entry && entry.edit ? entry.edit.reply : '', node, 'Reply copied');
        break;
      }
      case 'refresh': boot(true); break;
      case 'theme': {
        var root = document.documentElement;
        var next = root.dataset.theme === 'light' ? 'dark' : 'light';
        root.dataset.theme = next;
        try { localStorage.setItem('leaddesk.theme', next); } catch (e) { /* private mode */ }
        break;
      }
    }
  }

  function onChange(event) {
    var node = event.target;
    if (node.dataset.role === 'field') {
      var body = {}; body[node.dataset.field] = node.value;
      api('/api/leads/' + encodeURIComponent(node.dataset.id) + '/update', { body: { fields: body } })
        .then(function (out) {
          replaceLead(out.lead);
          if (out.changed.length) toast('saved ' + out.changed.join(', '), 'ok');
          renderKpis();
        }).catch(function (err) { toast(err.message, 'bad'); });
    }
    if (node.dataset.role === 'inbox-keep') {
      captureInbox();
      var card = node.closest('.inbox-lead');
      if (card) card.classList.toggle('skipped', !node.checked);
    }
    if (node.dataset.role === 'assign') {
      scratch(node.dataset.id).assign[node.dataset.key] = node.value;
    }
  }

  function onKeydown(event) {
    var node = event.target;
    if (event.key === '/' && node.tagName !== 'INPUT' && node.tagName !== 'TEXTAREA') {
      event.preventDefault(); el('search').focus(); return;
    }
    if (event.key === 'Escape' && node.id === 'search') { node.blur(); return; }
    if (event.key === 'Enter') {
      if (node.dataset.role === 'reels' && !event.shiftKey) {
        event.preventDefault(); addReels(node.dataset.id); return;
      }
      if (node.dataset.role === 'propq') {
        event.preventDefault();
        captureScratch(node.dataset.id);
        searchProperties(node.dataset.id, node.value);
        return;
      }
      if (node.dataset.role === 'question' || node.dataset.role === 'askpid') {
        event.preventDefault(); askAbout(node.dataset.id, null); return;
      }
      if (node.dataset.role === 'incoming') {
        event.preventDefault(); draftReply(node.dataset.id); return;
      }
      if (node.classList.contains('lead-row')) {
        event.preventDefault(); toggleLead(node.dataset.id); return;
      }
    }
  }

  /* ------------------------------------------------------------------ boot */

  function boot(quiet) {
    return api('/api/bootstrap').then(function (data) {
      state.boot = data;
      state.leads = data.leads;
      state.tasks = data.tasks;
      renderStatus();
      renderKpis();
      renderChips();
      renderNavCounts();
      renderPipeline();
      if (state.view !== 'pipeline') showView(state.view);
      if (quiet) toast('refreshed', 'ok');
    }).catch(function (err) {
      el('leadList').innerHTML = '<div class="empty"><b>Cannot reach the server</b>' +
        h(err.message) + '<br>Start it with: python scripts/lead_desk_app.py</div>';
    });
  }

  function init() {
    try {
      var saved = localStorage.getItem('leaddesk.theme');
      if (saved) document.documentElement.dataset.theme = saved;
    } catch (e) { /* private mode, dark is fine */ }

    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    document.addEventListener('keydown', onKeydown);

    el('search').addEventListener('input', function (e) {
      state.query = e.target.value;
      renderPipeline();
    });
    el('scoreChips').addEventListener('click', function (e) {
      var chip = e.target.closest('[data-score]');
      if (!chip) return;
      state.score = chip.dataset.score;
      renderChips(); renderPipeline();
    });
    el('flagChips').addEventListener('click', function (e) {
      var chip = e.target.closest('[data-flag]');
      if (!chip) return;
      state.flags[chip.dataset.flag] = !state.flags[chip.dataset.flag];
      renderChips(); renderPipeline();
    });
    qsa('.nav button').forEach(function (b) {
      b.addEventListener('click', function () { showView(b.dataset.view); });
    });
    document.addEventListener('paste', function (e) {
      if (state.view !== 'inbox') return;
      var items = (e.clipboardData || {}).items || [];
      var files = [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].kind === 'file' && /^image\//.test(items[i].type)) {
          files.push(items[i].getAsFile());
        }
      }
      if (!files.length) return;
      e.preventDefault();
      addShots(files);
    });

    var drop = el('inboxDrop');
    ['dragenter', 'dragover'].forEach(function (name) {
      drop.addEventListener(name, function (e) {
        e.preventDefault(); drop.classList.add('over');
      });
    });
    ['dragleave', 'drop'].forEach(function (name) {
      drop.addEventListener(name, function (e) {
        e.preventDefault(); drop.classList.remove('over');
      });
    });
    drop.addEventListener('drop', function (e) {
      addShots(e.dataTransfer && e.dataTransfer.files);
    });
    drop.addEventListener('click', function (e) {
      if (!e.target.closest('[data-act]')) el('inboxFile').click();
    });
    el('inboxFile').addEventListener('change', function (e) {
      addShots(e.target.files);
      e.target.value = '';
    });

    el('invSearch').addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var q = e.target.value;
      el('invList').innerHTML = '<div class="mini"><span class="busy"></span> searching&hellip;</div>';
      api('/api/properties/search?' + new URLSearchParams({ q: q, limit: '20' }))
        .then(function (found) { state.inventory = found; renderInventory(); })
        .catch(function (err) {
          state.inventory = { error: err.message, matches: [] }; renderInventory();
        });
    });

    boot();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
