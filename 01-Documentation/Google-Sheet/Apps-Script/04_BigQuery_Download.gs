/**
 * Copyright 2026 Knowit AI & Analytics
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     https://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/** One-click: refresh Events for the selected tool. */
function refreshEvents() {
  const tool = getAnalyticsTool();
  if (tool === 'Google Analytics') {
    refreshEventsGA4();
  } else if (tool === 'GA4 Dataform') {
    refreshEventsGA4Dataform();
  } else if (tool === 'Amplitude') {
    refreshEventsAmplitude();
  } else if (tool === 'Mixpanel') {
    refreshEventsMixpanel();
  } else {
    SpreadsheetApp.getUi().alert('Unsupported SettingsAnalyticsTool: ' + tool);
  }
}

/** One-click: refresh Parameters for the selected tool. */
function refreshParameters() {
  const tool = getAnalyticsTool();
  if (tool === 'Google Analytics') {
    refreshParametersGA4();
  } else if (tool === 'GA4 Dataform') {
    refreshParametersGA4Dataform();
  } else if (tool === 'Amplitude') {
    refreshParametersAmplitude();
  } else if (tool === 'Mixpanel') {
    refreshParametersMixpanel();
  } else {
    SpreadsheetApp.getUi().alert('Unsupported SettingsAnalyticsTool: ' + tool);
  }
}


/** ===================== UTILITIES ===================== **/
function getSS() { return SpreadsheetApp.getActiveSpreadsheet(); }
function getSheet(n) { return getSS().getSheetByName(n) || getSS().insertSheet(n); }

function readNamed(name, fallback) {
  try { return getSS().getRangeByName(name).getValue(); }
  catch (e) { return (typeof fallback !== 'undefined') ? fallback : ''; }
}

/** Trim & split comma-separated tokens; strips wrapping quotes (whole string and each token). */
function parseCommaList(s) {
  if (!s) return [];
  let str = String(s).trim();
  if ((str[0]==='"' && str[str.length-1]==='"') || (str[0]==="'" && str[str.length-1]==="'"))
    str = str.substring(1, str.length-1);
  return str.split(',').map(function(t){
    t = String(t).trim();
    if ((t[0]==='"' && t[t.length-1]==='"') || (t[0]==="'" && t[t.length-1]==="'"))
      t = t.substring(1, t.length-1).trim();
    return t;
  }).filter(Boolean);
}

function parseFirstInteger(s, d) {
  const m = String(s||'').match(/(\d+)/);
  return m ? parseInt(m[1],10) : (d||1);
}

/** Last N complete days (today excluded), as suffixes YYYYMMDD. */
function computeSuffixWindow(nDays) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate()-1);
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate()-(nDays-1));
  function fmt(d){ let y=d.getFullYear(), m=d.getMonth()+1, dd=d.getDate();
    return y + (m<10?'0':'')+m + (dd<10?'0':'')+dd; }
  return { start: fmt(start), end: fmt(end) };
}

/** Execute Standard SQL; location MUST match dataset region. */
function runBQ(projectId, location, sql) {
  const req = { query: sql, useLegacySql: false, location: location };
  const start = Date.now();

  let q = BigQuery.Jobs.query(req, projectId);
  if (q.status && q.status.errorResult) {
    throw new Error('BigQuery error: ' + q.status.errorResult.message + ' | SQL: ' + sql);
  }
  const jobId = q.jobReference && q.jobReference.jobId;
  if (!jobId) throw new Error('BigQuery error: missing jobId');

  // Wait until job is complete if necessary
  while (!q.jobComplete) {
    Utilities.sleep(1000);
    q = BigQuery.Jobs.getQueryResults(projectId, jobId, { location: location, maxResults: 0 });
  }

  function rowsFrom(page) {
    const rows = [];
    const schema = page.schema && page.schema.fields ? page.schema.fields : [];
    const cols = schema.length;
    const data = page.rows || [];
    for (let i = 0; i < data.length; i++) {
      const r = data[i], arr = [];
      for (let c = 0; c < cols; c++) arr.push(r.f[c] ? r.f[c].v : null);
      rows.push(arr);
    }
    return rows;
  }

  let out = rowsFrom(q);
  let pageToken = q.pageToken || null;
  while (pageToken) {
    const page = BigQuery.Jobs.getQueryResults(projectId, jobId, { location: location, pageToken: pageToken });
    out = out.concat(rowsFrom(page));
    pageToken = page.pageToken || null;
  }

  // Optional: quick debug timing
  // Logger.log('runBQ ok in %sms; rows=%s', Date.now()-start, out.length);
  return out;
}

function writeTable(sheetName, values) {
  const sh = getSheet(sheetName);
  sh.clearContents();
  const MAX = 100000; // safety
  if (!values || !values.length) { sh.getRange(1,1).setValue(''); return; }
  const cut = values.slice(0, MAX);
  sh.getRange(1,1,cut.length,cut[0].length).setValues(cut);
}

function arrLit(list) {
  return '[' + list.map(function(v){
    return "'" + String(v).replace(/'/g, "''") + "'";
  }).join(',') + ']';
}

function escapeSqlString(s) {
  return String(s == null ? '' : s).replace(/'/g, "''");
}

/** Safely trim a value to string. */
function safeTrim(v){ return String(v == null ? '' : v).trim(); }

/** If SettingsExperimentEventName is set, ensure ['EVENT', <name>] exists in Lookup_Experiments rows. */
function addDefaultToExperiments(rows, defaultName) {
  const name = safeTrim(defaultName);
  if (!name) return rows;
  const out = rows ? rows.slice() : [];
  let exists = false; // <-- let, not const
  for (let i = 0; i < out.length; i++) {
    if (String(out[i][0]) === 'EVENT' && safeTrim(out[i][1]) === name) { exists = true; break; }
  }
  if (!exists) out.push(['EVENT', name]);
  return out;
}

/** Merge two [[name, scope]] lists into distinct, sorted rows. */
function unionDistinct2col(a, b) {
  var seen = Object.create(null);
  var out = [];

  function add(rows) {
    if (!rows) return;
    for (var i = 0; i < rows.length; i++) {
      var name  = safeTrim(rows[i][0]);
      var scope = safeTrim(rows[i][1]);
      if (!name || !scope) continue;

      var key = scope + '||' + name;
      if (!seen[key]) {
        seen[key] = true;
        out.push([name, scope]);
      }
    }
  }

  add(a); add(b);

  out.sort(function(x, y) {
    if (x[1] === y[1]) return x[0] < y[0] ? -1 : (x[0] > y[0] ? 1 : 0);
    return x[1] < y[1] ? -1 : 1;
  });

  return out;
}

/**
 * GA4 (events_*): Columns to include as "variant-like" fields, controlled by allowRegex.
 * NOTE: scope is set to 'COLUMN' so your downstream SQL can handle it explicitly.
 * If you prefer compatibility with existing logic, change 'COLUMN' to 'EVENT'.
 */
function buildColumnsAsVariantSqlGA4(projectId, datasetId, tablePrefix, allowRegex, excludeList) {
  if (!safeTrim(allowRegex)) return "SELECT '' AS parameter_name, '' AS parameter_scope WHERE FALSE";

  var rex = escapeSqlString(allowRegex);
  var ex  = (excludeList && excludeList.length)
    ? "AND field_path NOT IN UNNEST(" + arrLit(excludeList) + ")\n"
    : "";

  return ""
    + "SELECT DISTINCT field_path AS parameter_name, 'COLUMN' AS parameter_scope\n"
    + "FROM `" + projectId + "." + datasetId + "`.INFORMATION_SCHEMA.COLUMN_FIELD_PATHS\n"
    + "WHERE STARTS_WITH(table_name, '" + escapeSqlString(tablePrefix) + "')\n"
    + "AND REGEXP_CONTAINS(field_path, r'" + rex + "')\n"
    + ex
    + "ORDER BY parameter_scope, parameter_name";
}

/**
 * GA4 (events_*): Numeric columns to include as "value params", controlled by allowRegex.
 * This replaces the hard-coded ecommerce whitelist.
 */
function buildNumericColumnsAsValueSqlGA4(projectId, datasetId, tablePrefix, allowRegex, excludeList) {
  if (!safeTrim(allowRegex)) return "SELECT '' AS parameter_name WHERE FALSE";

  var rex = escapeSqlString(allowRegex);
  var ex  = (excludeList && excludeList.length)
    ? "AND field_path NOT IN UNNEST(" + arrLit(excludeList) + ")\n"
    : "";

  return ""
    + "SELECT DISTINCT field_path AS parameter_name\n"
    + "FROM `" + projectId + "." + datasetId + "`.INFORMATION_SCHEMA.COLUMN_FIELD_PATHS\n"
    + "WHERE STARTS_WITH(table_name, '" + escapeSqlString(tablePrefix) + "')\n"
    + "AND data_type IN ('INT64','FLOAT64','NUMERIC','BIGNUMERIC')\n"
    + "AND REGEXP_CONTAINS(field_path, r'" + rex + "')\n"
    + ex
    + "ORDER BY parameter_name";
}

/** If SettingsExperimentEventValueParameter is set, ensure [<param>] exists in Lookup_Params_ExperimentValue rows. */
function addDefaultToParamValue(rows, defaultParam) {
  const p = safeTrim(defaultParam);
  if (!p) return rows;
  const out = rows ? rows.slice() : [];
  let exists = false;
  for (let i = 0; i < out.length; i++) {
    if (safeTrim(out[i][0]) === p) { exists = true; break; }
  }
  if (!exists) out.push([p]);
  return out;
}

/** If SettingsExperimentVariantString is set, ensure [<param>, 'EVENT'] exists in Lookup_Params_ExperimentVariant rows. */
function addDefaultToParamVariant(rows, defaultParam) {
  const p = safeTrim(defaultParam);
  if (!p) return rows;
  const out = rows ? rows.slice() : [];
  let exists = false;
  for (let i = 0; i < out.length; i++) {
    if (safeTrim(out[i][0]) === p && String(out[i][1]) === 'EVENT') { exists = true; break; }
  }
  if (!exists) out.push([p, 'EVENT']);
  return out;
}

/** Merge two [[value]] lists into a distinct, sorted [[value]] list (by first column). */
function unionDistinct1col(a, b) {
  const seen = Object.create(null);
  const out = [];
  function add(rows) {
    if (!rows) return;
    for (let i = 0; i < rows.length; i++) {
      const k = safeTrim(rows[i][0]);
      if (k && !seen[k]) { seen[k] = true; out.push([k]); }
    }
  }
  add(a); add(b);
  out.sort(function(x, y){ return x[0] < y[0] ? -1 : (x[0] > y[0] ? 1 : 0); });
  return out;
}

/** ===================== GA4: EVENTS ===================== **/
function buildEventsSqlGA4(fqTable, suffixWin, excludeEvents) {
  const ex = excludeEvents.length ? "AND event_name NOT IN UNNEST(" + arrLit(excludeEvents) + ")\n" : "";
  return ""
    + "SELECT event_name\n"
    + "FROM `" + fqTable + "`\n"
    + "WHERE _TABLE_SUFFIX BETWEEN '" + suffixWin.start + "' AND '" + suffixWin.end + "'\n"
    + ex
    + "GROUP BY event_name\n"
    + "ORDER BY event_name";
}

function buildExperimentsSqlGA4(fqTable, suffixWin, excludeEvents) {
  const exE = excludeEvents.length ? "AND event_name NOT IN UNNEST(" + arrLit(excludeEvents) + ")\n" : "";
  return ""
    + "SELECT DISTINCT 'EVENT' AS experiment_source, event_name AS name\n"
    + "FROM `" + fqTable + "`\n"
    + "WHERE _TABLE_SUFFIX BETWEEN '" + suffixWin.start + "' AND '" + suffixWin.end + "'\n"
    + exE
    + "UNION DISTINCT\n"
    + "SELECT DISTINCT 'USER_PROPERTY' AS experiment_source, up.key AS name\n"
    + "FROM `" + fqTable + "`, UNNEST(user_properties) up\n"
    + "WHERE _TABLE_SUFFIX BETWEEN '" + suffixWin.start + "' AND '" + suffixWin.end + "'\n"
    + "AND REGEXP_CONTAINS(up.key, r'^firebase_exp_\\d+$')\n"
    + "ORDER BY experiment_source, name";
}

/** ===================== GA4: COLUMNS & PARAMETERS ===================== **/
function buildColumnsSqlGA4(projectId, datasetId, allowRegex) {
  return ""
    + "SELECT DISTINCT field_path\n"
    + "FROM `" + projectId + "." + datasetId + "`.INFORMATION_SCHEMA.COLUMN_FIELD_PATHS\n"
    + "WHERE table_name LIKE 'events_%'\n"
    + (allowRegex ? ("AND REGEXP_CONTAINS(field_path, r'" + String(allowRegex).replace(/'/g,"\\'") + "')\n") : "")
    + "ORDER BY field_path";
}

function buildParamsExperimentVariantSqlGA4(fqTable, suffixWin, excludeParams) {
  const exP_ev = excludeParams.length ? "AND ep.key NOT IN UNNEST(" + arrLit(excludeParams) + ")\n" : "";
  const exP_up = excludeParams.length ? "AND up.key NOT IN UNNEST(" + arrLit(excludeParams) + ")\n" : "";
  return ""
    + "WITH win AS (\n"
    + "  SELECT event_params, user_properties FROM `" + fqTable + "`\n"
    + "  WHERE _TABLE_SUFFIX BETWEEN '" + suffixWin.start + "' AND '" + suffixWin.end + "'\n"
    + ")\n"
    + "SELECT DISTINCT parameter_name, parameter_scope FROM (\n"
    + "  SELECT ep.key AS parameter_name, 'EVENT' AS parameter_scope FROM win, UNNEST(event_params) ep WHERE TRUE " + exP_ev + "\n"
    + "  UNION DISTINCT\n"
    + "  SELECT up.key AS parameter_name, 'USER'  AS parameter_scope FROM win, UNNEST(user_properties) up WHERE TRUE " + exP_up + "\n"
    + ")\n"
    + "ORDER BY parameter_scope, parameter_name";
}

function buildParamsExperimentValueSqlGA4(fqTable, suffixWin, excludeParams) {
  const exP_ev = excludeParams.length ? "AND ep.key NOT IN UNNEST(" + arrLit(excludeParams) + ")\n" : "";
  return ""
    + "WITH win AS (\n"
    + "  SELECT event_params FROM `" + fqTable + "`\n"
    + "  WHERE _TABLE_SUFFIX BETWEEN '" + suffixWin.start + "' AND '" + suffixWin.end + "'\n"
    + ")\n"
    + "SELECT DISTINCT ep.key AS parameter_name\n"
    + "FROM win, UNNEST(event_params) ep\n"
    + "WHERE (ep.value.int_value IS NOT NULL OR ep.value.float_value IS NOT NULL OR ep.value.double_value IS NOT NULL)\n"
    + exP_ev
    + "ORDER BY parameter_name";
}

function buildFilterFieldsSqlGA4(fqTable, suffixWin, excludeParams, projectId, datasetId, allowRegex, tablePrefix) {
  var exP_ev = excludeParams.length ? "AND ep.key NOT IN UNNEST(" + arrLit(excludeParams) + ")\n" : "";
  var exP_up = excludeParams.length ? "AND up.key NOT IN UNNEST(" + arrLit(excludeParams) + ")\n" : "";

  var paramsPart = ""
    + "WITH win AS (\n"
    + "  SELECT event_params, user_properties FROM `" + fqTable + "`\n"
    + "  WHERE _TABLE_SUFFIX BETWEEN '" + suffixWin.start + "' AND '" + suffixWin.end + "'\n"
    + ")\n"
    + "SELECT DISTINCT 'Event' AS filter_type, ep.key AS name FROM win, UNNEST(event_params) ep WHERE TRUE " + exP_ev + "\n"
    + "UNION DISTINCT\n"
    + "SELECT DISTINCT 'User'  AS filter_type, up.key AS name FROM win, UNNEST(user_properties) up WHERE TRUE " + exP_up;

  // Columns are opt-in via allowRegex
  if (!safeTrim(allowRegex)) {
    return "(" + paramsPart + ")\nORDER BY filter_type, name";
  }

  var rex = escapeSqlString(allowRegex);
  var columnsPart = ""
    + "SELECT DISTINCT 'Column' AS filter_type, field_path AS name\n"
    + "FROM `" + projectId + "." + datasetId + "`.INFORMATION_SCHEMA.COLUMN_FIELD_PATHS\n"
    + "WHERE STARTS_WITH(table_name, '" + escapeSqlString(tablePrefix) + "')\n"
    + "AND REGEXP_CONTAINS(field_path, r'" + rex + "')\n";

  return "(" + paramsPart + ")\nUNION DISTINCT\n(" + columnsPart + ")\nORDER BY filter_type, name";
}

/** ===================== DRIVERS: GA4 ===================== **/
function refreshEventsGA4() {
  // ---- Read settings
  const projectId = readNamed('SettingsBigQueryProjectID', '');
  const datasetId = readNamed('SettingsBigQueryDataSetID', '');
  const location = readNamed('SettingsBigQueryDataSetLocation', 'EU');
  const daysHuman = readNamed('SettingsBigQueryNumberOfDaysToQuery', '2 Last Days');
  const exclEvents = parseCommaList(readNamed('SettingsBigQueryExcludeEventsList', ''));
  // Read Table Name (default to 'events_')
  const tableNameSetting = readNamed('SettingsBigQueryTableID', ''); 
  const tableName = tableNameSetting ? tableNameSetting : 'events_';

  if (!projectId || !datasetId || !tableName) {
    SpreadsheetApp.getUi().alert('Missing projectId, datasetId or tableId in Settings.');
    return;
  }

  // ---- Build window (exclude today) + fully-qualified table wildcard
  const nDays  = Math.max(1, parseFirstInteger(daysHuman, 2));
  const suffix = computeSuffixWindow(nDays);
  const fqTable = projectId + "." + datasetId + "." + tableName + "*";

  // ---- Build and run queries
  const sqlEvents = buildEventsSqlGA4(fqTable, suffix, exclEvents);
  const sqlExper = buildExperimentsSqlGA4(fqTable, suffix, exclEvents);

  const evRows = runBQ(projectId, location, sqlEvents); // [[event_name]]
  let exRows = runBQ(projectId, location, sqlExper);  // [[experiment_source, name]]

  // ---- Inject default experiment event name if provided
  const defaultExpEvent = readNamed('SettingsExperimentEventName', '');
  exRows = addDefaultToExperiments(exRows, defaultExpEvent);

  // ---- Write outputs
  writeTable('Lookup_Events', evRows);
  writeTable('Lookup_Experiments', exRows);

  SpreadsheetApp.getActive().toast(
    'GA4 events refreshed · Conversion Events: ' + evRows.length + ' · Experiment names: ' + exRows.length,
    'GA4', 6
  );
}

function refreshParametersGA4() {
  // ---- Read settings
  const projectId = readNamed('SettingsBigQueryProjectID', '');
  const datasetId = readNamed('SettingsBigQueryDataSetID', '');
  const location = readNamed('SettingsBigQueryDataSetLocation', 'EU');
  const daysHuman = readNamed('SettingsBigQueryNumberOfDaysToQuery', '2 Last Days');
  const exclParams = parseCommaList(readNamed('SettingsBigQueryExcludeParametersList', ''));
  const allowRegex = readNamed('SettingsBigQueryColumns', '');
  // Read Table Name (default to 'events_')
  const tableNameSetting = readNamed('SettingsBigQueryTableID', ''); 
  const tableName = tableNameSetting ? tableNameSetting : 'events_';

  if (!projectId || !datasetId) {
    SpreadsheetApp.getUi().alert('Missing projectId, datasetId or tableId in Settings.');
    return;
  }

  // ---- Build window (exclude today) + fully-qualified table wildcard
  const nDays = Math.max(1, parseFirstInteger(daysHuman, 2));
  const suffix = computeSuffixWindow(nDays);
  const fqTable = projectId + "." + datasetId + "." + tableName + "*";

  // ---- Build SQL
  var sqlVariant = buildParamsExperimentVariantSqlGA4(fqTable, suffix, exclParams);
  var sqlValue   = buildParamsExperimentValueSqlGA4(fqTable, suffix, exclParams);

  // NEW: columns (variant + numeric value) controlled by SettingsBigQueryColumns
  var sqlColVariant = buildColumnsAsVariantSqlGA4(projectId, datasetId, tableName, allowRegex, exclParams);
  var sqlColValue   = buildNumericColumnsAsValueSqlGA4(projectId, datasetId, tableName, allowRegex, exclParams);

  var sqlFilter = buildFilterFieldsSqlGA4(
    fqTable, suffix, exclParams,
    projectId, datasetId, allowRegex,
    tableName // <-- NEW: table prefix for INFORMATION_SCHEMA
  );

  // ---- Run queries
  var pvar   = runBQ(projectId, location, sqlVariant);     // [[parameter_name, parameter_scope]] EVENT/USER
  var pval1  = runBQ(projectId, location, sqlValue);       // [[parameter_name]] numeric event_params
  var colVar = runBQ(projectId, location, sqlColVariant);  // [[parameter_name, parameter_scope]] COLUMN (opt-in)
  var colVal = runBQ(projectId, location, sqlColValue);    // [[parameter_name]] numeric columns (opt-in)
  var filt   = runBQ(projectId, location, sqlFilter);      // [[filter_type, name]]

  // Merge
  pvar = unionDistinct2col(pvar, colVar);
  var pval = unionDistinct1col(pval1, colVal);

  // ---- Inject defaults from Settings
  const defaultVariant    = readNamed('SettingsExperimentVariantString', '');
  const defaultValueParam = readNamed('SettingsExperimentEventValueParameter', '');

  pvar = addDefaultToParamVariant(pvar, defaultVariant);   // ensure [<param>, 'EVENT']
  pval = addDefaultToParamValue(pval, defaultValueParam);  // ensure [<param>]

  // ---- Write outputs
  writeTable('Lookup_Params_ExperimentVariant', pvar);
  writeTable('Lookup_Params_ExperimentValue', pval);
  writeTable('Lookup_Filter_Fields', filt);

  SpreadsheetApp.getActive().toast(
    'GA4 parameters refreshed · Variant: ' + pvar.length + ' · Value: ' + pval.length + ' · Filter fields: ' + filt.length,
    'GA4', 7
  );
}

/** ===================== AMPLITUDE SUPPORT ===================== **/
/** Table name only (e.g., EVENTS_100030914, optional $partition or *). */
function normalizeTableId(t) {
  const s = String(t||'').trim(); if (!s) return null;
  const base = s.replace(/(\$.*$)|(\*+$)/,'');
  return { tableId: s, baseTableId: base };
}

function amplitudeColumnFieldPathsSQL(projectId, datasetId, baseTableId) {
  return ""
    + "SELECT field_path, data_type\n"
    + "FROM `" + projectId + "." + datasetId + "`.INFORMATION_SCHEMA.COLUMN_FIELD_PATHS\n"
    + "WHERE table_name = '" + baseTableId + "'";
}

function amplitudeDetectDateColumn(projectId, datasetId, baseTableId, location) {
  const sql = ""
    + "SELECT column_name\n"
    + "FROM `" + projectId + "." + datasetId + "`.INFORMATION_SCHEMA.COLUMNS\n"
    + "WHERE table_name = '" + baseTableId + "'";
  const rows = runBQ(projectId, location, sql);
  let have = {};
  for (let i=0;i<rows.length;i++) have[String(rows[i][0])] = true;
  const candidates = ['event_time','client_event_time','server_upload_time','ingest_time','event_datetime','event_date'];
  for (let j=0;j<candidates.length;j++) if (have[candidates[j]]) return candidates[j];
  return null;
}

/** WHERE for last N complete days using detected date column. */
function amplitudeDateWhereClause(dateCol, nDays) {
  if (!dateCol) return "WHERE TRUE";
  const w = computeSuffixWindow(Math.max(1,nDays));
  const start = w.start.slice(0,4)+"-"+w.start.slice(4,6)+"-"+w.start.slice(6,8);
  const end   = w.end.slice(0,4)+"-"+w.end.slice(4,6)+"-"+w.end.slice(6,8);
  return "WHERE DATE(" + dateCol + ") BETWEEN DATE('" + start + "') AND DATE('" + end + "')";
}

/** Events (Amplitude) – assumes event name is 'event_type'. */
function buildEventsSqlAmplitude(fq, nDays, exclEvents, projectId, datasetId, baseTableId, location) {
  const dateCol = amplitudeDetectDateColumn(projectId, datasetId, baseTableId, location);
  const where = amplitudeDateWhereClause(dateCol, nDays);
  const ex = exclEvents.length ? "AND event_type NOT IN UNNEST(" + arrLit(exclEvents) + ")\n" : "";
  return ""
    + "SELECT event_type\n"
    + "FROM `" + fq + "`\n"
    + where + "\n"
    + ex
    + "GROUP BY event_type\n"
    + "ORDER BY event_type";
}

/** Experiments (Amplitude): all event_type + firebase_exp_* user props (if present as columns). */
function buildExperimentsSqlAmplitude(fq, nDays, exclEvents, projectId, datasetId, baseTableId, location) {
  const dateCol = amplitudeDetectDateColumn(projectId, datasetId, baseTableId, location);
  const where = amplitudeDateWhereClause(dateCol, nDays);
  const exE = exclEvents.length ? "AND event_type NOT IN UNNEST(" + arrLit(exclEvents) + ")\n" : "";
  const eventPart =
    "SELECT DISTINCT 'EVENT' AS experiment_source, event_type AS name\n" +
    "FROM `" + fq + "`\n" + where + "\n" + exE;

  // Firebase keys if user_properties.* exists in schema
  const userRows = runBQ(projectId, location,
    amplitudeColumnFieldPathsSQL(projectId, datasetId, baseTableId)
    + " AND REGEXP_CONTAINS(field_path, r'^user_properties\\.firebase_exp_\\d+$')"
  );
  let keys = [];
  for (let i=0;i<userRows.length;i++){
    const fp = String(userRows[i][0]||'');
    const k = fp.replace(/^user_properties\./,'');
    if (k) keys.push(k);
  }
  const userPart = keys.length ? "SELECT 'USER_PROPERTY' AS experiment_source, name FROM UNNEST(" + arrLit(keys) + ") AS name" : null;

  return userPart ? (eventPart + "\nUNION DISTINCT\n" + userPart + "\nORDER BY experiment_source, name")
                  : (eventPart + "\nORDER BY experiment_source, name");
}

/** ---------- Amplitude: JSON-aware parameter discovery ---------- **/
/** 1) Try schema for event/user property names; 2) If no event props in schema, scan JSON text. */
function amplitudeDetectParamNames(projectId, datasetId, baseTableId, nDays, location) {
  // Try schema first
  let evSet={}, usrSet={};
  const rows = runBQ(projectId, location, amplitudeColumnFieldPathsSQL(projectId, datasetId, baseTableId));
  for (let i=0;i<rows.length;i++){
    const fp = String(rows[i][0]||'');
    if (fp.indexOf('event_properties.')===0) { let e=fp.substring('event_properties.'.length).split('.')[0]; if (e) evSet[e]=true; }
    if (fp.indexOf('user_properties.')===0)  { let u=fp.substring('user_properties.'.length).split('.')[0];  if (u) usrSet[u]=true; }
  }
  const ev = Object.keys(evSet).sort();
  const usr = Object.keys(usrSet).sort();
  if (ev.length) return { eventParamNames: ev, userParamNames: usr }; // schema had event props

  // Fallback: scan JSON in event_properties (top-level keys)
  const fq = projectId + "." + datasetId + "." + baseTableId;
  const dateCol = amplitudeDetectDateColumn(projectId, datasetId, baseTableId, location);
  const where = amplitudeDateWhereClause(dateCol, nDays);
  const sql = ""
    + "WITH base AS (\n"
    + "  SELECT TO_JSON_STRING(event_properties) AS ep_json\n"
    + "  FROM `" + fq + "`\n" + where + "\n"
    + "), keys AS (\n"
    + "  SELECT DISTINCT key\n"
    + "  FROM base, UNNEST(REGEXP_EXTRACT_ALL(ep_json, r'\"((?:[^\"\\\\]|\\\\.)+)\"\\s*:')) AS key\n"
    + ")\n"
    + "SELECT key FROM keys ORDER BY key";
  const krows = runBQ(projectId, location, sql);
  let out = [];
  for (let j=0;j<krows.length;j++){ let k = String(krows[j][0]||'').trim(); if (k) out.push(k); }
  return { eventParamNames: out, userParamNames: usr }; // user props likely empty in your table
}

/** Variant params (Amplitude): EVENT + USER names minus exact excludes (JSON-aware). */
function buildParamsExperimentVariantSqlAmplitude(projectId, datasetId, baseTableId, excludeParams, nDays, location) {
  const names = amplitudeDetectParamNames(projectId, datasetId, baseTableId, nDays, location);
  const ev  = names.eventParamNames.filter(function(n){ return excludeParams.indexOf(n) === -1; });
  const usr = names.userParamNames.filter(function(n){ return excludeParams.indexOf(n) === -1; });

  let parts = [];
  if (ev.length)  parts.push("SELECT 'EVENT' AS parameter_scope, name AS parameter_name FROM UNNEST(" + arrLit(ev)  + ") AS name");
  if (usr.length) parts.push("SELECT 'USER'  AS parameter_scope, name AS parameter_name FROM UNNEST(" + arrLit(usr) + ") AS name");

  return parts.length
    ? parts.join("\nUNION DISTINCT\n") + "\nORDER BY parameter_scope, parameter_name"
    : "SELECT 'EVENT' AS parameter_scope, '' AS parameter_name LIMIT 0";
}

/** Value params (Amplitude): EVENT keys with NON-STRING value at least once (JSON-aware, regex-only). */
function buildParamsExperimentValueSqlAmplitude(projectId, datasetId, baseTableId, excludeParams, nDays, location) {
  // Candidate keys from JSON/schema (event scope), minus exact excludes
  const evKeys = amplitudeDetectParamNames(projectId, datasetId, baseTableId, nDays, location)
               .eventParamNames.filter(function(n){ return excludeParams.indexOf(n) === -1; });
  if (!evKeys.length) return "SELECT '' AS parameter_name LIMIT 0";

  const fq = projectId + "." + datasetId + "." + baseTableId;
  const dateCol = amplitudeDetectDateColumn(projectId, datasetId, baseTableId, location);
  const where = amplitudeDateWhereClause(dateCol, nDays); // "WHERE TRUE" if none

  /* From JSON text ep_json, pull raw token after "key": and classify.
     Non-string if it matches:
       - number:   ^\s*-?(?:\d+\.?\d*|\d*\.\d+)(?:[eE][+-]?\d+)?\s*$
       - boolean:  ^\s*(true|false)\s*$
       - object:   ^\s*\{
       - array:    ^\s*\[
     Exclude quoted strings and null explicitly.
  */
  const sql =
    "WITH k AS (\n" +
    "  SELECT name FROM UNNEST(" + arrLit(evKeys) + ") AS name\n" +
    "), base AS (\n" +
    "  SELECT TO_JSON_STRING(event_properties) AS ep_json\n" +
    "  FROM `" + fq + "`\n" + where + "\n" +
    "), pairs AS (\n" +
    "  SELECT k.name AS key,\n" +
    "         TRIM(v) AS val\n" +
    "  FROM base\n" +
    "  CROSS JOIN k,\n" +
    "  UNNEST(\n" +
    "    REGEXP_EXTRACT_ALL(\n" +
    "      ep_json,\n" +
    "      CONCAT(\n" +
    "        '\\\"',\n" +
    "        REGEXP_REPLACE(k.name, r'([\\\\^$.*+?()\\[\\]{}|])', r'\\\\\\\\\\1'),\n" +
    "        '\\\"\\\\s*:\\\\s*([^,}\\\\]]+)'\n" +
    "      )\n" +
    "    )\n" +
    "  ) AS v\n" +
    "), agg AS (\n" +
    "  SELECT key,\n" +
    "         COUNTIF(\n" +
    "           val IS NOT NULL AND LOWER(val) != 'null' AND NOT REGEXP_CONTAINS(val, r'^\\s*\\\"') AND (\n" +
    "             REGEXP_CONTAINS(val, r'^\\s*-?(?:\\d+\\.?\\d*|\\d*\\.\\d+)(?:[eE][+-]?\\d+)?\\s*$') OR\n" +
    "             REGEXP_CONTAINS(val, r'^\\s*(?:true|false)\\s*$') OR\n" +
    "             REGEXP_CONTAINS(val, r'^\\s*\\{') OR\n" +
    "             REGEXP_CONTAINS(val, r'^\\s*\\[')\n" +
    "           )\n" +
    "         ) AS non_string_hits\n" +
    "  FROM pairs\n" +
    "  GROUP BY key\n" +
    ")\n" +
    "SELECT key AS parameter_name\n" +
    "FROM agg\n" +
    "WHERE non_string_hits > 0\n" +
    "ORDER BY parameter_name";

  return sql;
}

/** Filter fields (Amplitude): Event + User params (JSON-aware) minus excludes + Columns by regex. */
function buildFilterFieldsSQL_Amplitude(projectId, datasetId, baseTableId, excludeParams, allowRegex, nDays, location) {
  const names = amplitudeDetectParamNames(projectId, datasetId, baseTableId, nDays, location);
  const ev  = names.eventParamNames.filter(function(n){ return excludeParams.indexOf(n) === -1; });
  const usr = names.userParamNames.filter(function(n){ return excludeParams.indexOf(n) === -1; });

  let parts = [];
  if (ev.length)  parts.push("SELECT 'Event' AS filter_type, name FROM UNNEST(" + arrLit(ev)  + ") AS name");
  if (usr.length) parts.push("SELECT 'User'  AS filter_type, name FROM UNNEST(" + arrLit(usr) + ") AS name");

  const colSql = ""
    + "SELECT 'Column' AS filter_type, field_path AS name\n"
    + "FROM `" + projectId + "." + datasetId + "`.INFORMATION_SCHEMA.COLUMN_FIELD_PATHS\n"
    + "WHERE table_name = '" + baseTableId + "'\n"
    + (allowRegex ? ("  AND REGEXP_CONTAINS(field_path, r'" + String(allowRegex).replace(/'/g,"\\'") + "')\n") : "");
  parts.push(colSql);

  return parts.length
    ? parts.join("\nUNION DISTINCT\n") + "\nORDER BY filter_type, name"
    : "SELECT '' AS filter_type, '' AS name LIMIT 0";
}

/** ===================== DRIVERS: AMPLITUDE ===================== **/
function refreshEventsAmplitude() {
  const projectId = readNamed('SettingsBigQueryProjectID','');
  const datasetId = readNamed('SettingsBigQueryDataSetID','');
  const tableId   = readNamed('SettingsBigQueryTableID',''); // table name only
  const location  = readNamed('SettingsBigQueryDataSetLocation','EU');
  const daysHuman = readNamed('SettingsBigQueryNumberOfDaysToQuery','2 Last Days');
  const exclEvents= parseCommaList(readNamed('SettingsBigQueryExcludeEventsList',''));

  if (!projectId || !datasetId || !tableId) { SpreadsheetApp.getUi().alert('Missing projectId, datasetId, or tableId'); return; }

  const norm = normalizeTableId(tableId);
  if (!norm) { SpreadsheetApp.getUi().alert('SettingsBigQueryTableID must be a table name (optional $partition or *)'); return; }

  const fq = projectId + "." + datasetId + "." + norm.tableId;
  const nDays = Math.max(1, parseFirstInteger(daysHuman,2));

  const evRows = runBQ(projectId, location, buildEventsSqlAmplitude(fq, nDays, exclEvents, projectId, datasetId, norm.baseTableId, location));
  let exRows = runBQ(projectId, location, buildExperimentsSqlAmplitude(fq, nDays, exclEvents, projectId, datasetId, norm.baseTableId, location));

  // --- Add default experiment event name, if provided ---
  const defaultExpEvent = readNamed('SettingsExperimentEventName', '');
  exRows = addDefaultToExperiments(exRows, defaultExpEvent);

  writeTable('Lookup_Events', evRows);
  writeTable('Lookup_Experiments', exRows);
  SpreadsheetApp.getActive().toast('Amplitude events refreshed · Events: '+evRows.length+' · Experiments: '+exRows.length,'Amplitude',6);
}

function refreshParametersAmplitude() {
  const projectId   = readNamed('SettingsBigQueryProjectID', '');
  const datasetId   = readNamed('SettingsBigQueryDataSetID', '');
  const tableIdRaw  = readNamed('SettingsBigQueryTableID', ''); // table name ONLY (e.g., EVENTS_100030914)
  const location    = readNamed('SettingsBigQueryDataSetLocation', 'EU');
  const exclParams  = parseCommaList(readNamed('SettingsBigQueryExcludeParametersList', ''));
  const allowRegex  = readNamed('SettingsBigQueryColumns', '');
  const daysHuman   = readNamed('SettingsBigQueryNumberOfDaysToQuery', '2 Last Days');

  if (!projectId || !datasetId || !tableIdRaw) {
    SpreadsheetApp.getUi().alert('Missing projectId, datasetId, or tableId in Settings.');
    return;
  }

  const norm = normalizeTableId(tableIdRaw); // -> { tableId, baseTableId }
  if (!norm) {
    SpreadsheetApp.getUi().alert('SettingsBigQueryTableID must be a table name (optionally with $partition or *).');
    return;
  }

  const nDays = Math.max(1, parseFirstInteger(daysHuman, 2));

  // ----- Build ExperimentVariant IN-MEMORY (robust for JSON keys with spaces/brackets)
  const names = amplitudeDetectParamNames(projectId, datasetId, norm.baseTableId, nDays, location);
  const evParams  = names.eventParamNames.filter(function(n){ return exclParams.indexOf(n) === -1; });
  const usrParams = names.userParamNames.filter(function(n){ return exclParams.indexOf(n) === -1; });

  let pvarOut = [];
  for (let i = 0; i < evParams.length; i++)  pvarOut.push([evParams[i], 'EVENT']);
  for (let j = 0; j < usrParams.length; j++) pvarOut.push([usrParams[j], 'USER']);

  // ----- Build ExperimentValue via SQL (regex-based non-string classifier)
  const sqlValue = buildParamsExperimentValueSqlAmplitude(
    projectId, datasetId, norm.baseTableId, exclParams, nDays, location
  );
  let pval = runBQ(projectId, location, sqlValue);   // rows: [parameter_name]

  // ----- Build Filter Fields via SQL (uses same discovery + your regex for Columns)
  const sqlFilter = buildFilterFieldsSQL_Amplitude(
    projectId, datasetId, norm.baseTableId, exclParams, allowRegex, nDays, location
  );
  const filt = runBQ(projectId, location, sqlFilter);  // rows: [filter_type, name]

  const defaultVariant = readNamed('SettingsExperimentVariantString', '');
  const defaultValueParam = readNamed('SettingsExperimentEventValueParameter', '');

  // Add defaults
  pvarOut = addDefaultToParamVariant(pvarOut, defaultVariant);   // [name, 'EVENT']
  pval = addDefaultToParamValue(pval, defaultValueParam);     // [name]

  writeTable('Lookup_Params_ExperimentVariant', pvarOut);
  writeTable('Lookup_Params_ExperimentValue',   pval);
  writeTable('Lookup_Filter_Fields',            filt);

  SpreadsheetApp.getActive().toast(
    'Amplitude parameters refreshed · Variant: ' + pvarOut.length + ' · Value: ' + pval.length + ' · Filters: ' + filt.length,
    'Amplitude', 7
  );
}

/** ===================== GA4 DATAFORM: DRIVERS ===================== **/

function refreshEventsGA4Dataform() {
  // 1. Read Settings
  const projectId = readNamed('SettingsBigQueryProjectID', '');
  const datasetId = readNamed('SettingsBigQueryDataSetID', '');
  const location = readNamed('SettingsBigQueryDataSetLocation', 'EU');
  const daysHuman = readNamed('SettingsBigQueryNumberOfDaysToQuery', '2 Last Days');
  const exclEvents = parseCommaList(readNamed('SettingsBigQueryExcludeEventsList', ''));
  
  // Read the Table Name from Settings (default to 'ga4_events' if empty)
  const tableNameSetting = readNamed('SettingsBigQueryTableID', ''); 
  const tableName = tableNameSetting ? tableNameSetting : 'ga4_events';

  if (!projectId || !datasetId) {
    SpreadsheetApp.getUi().alert('Missing projectId or datasetId in Settings.');
    return;
  }

  // 2. Setup Table & Date Window
  // Construct Fully Qualified Table Name dynamically
  const fqTable = projectId + "." + datasetId + "." + tableName;
  const nDays = Math.max(1, parseFirstInteger(daysHuman, 2));
  const suffix = computeSuffixWindow(nDays); 

  // 3. Build & Run SQL
  const sqlEvents = buildEventsSqlGA4Dataform(fqTable, suffix, exclEvents);
  const sqlExper = buildExperimentsSqlGA4Dataform(fqTable, suffix, exclEvents);

  const evRows = runBQ(projectId, location, sqlEvents);
  let exRows = runBQ(projectId, location, sqlExper);

  // 4. Defaults
  const defaultExpEvent = readNamed('SettingsExperimentEventName', '');
  exRows = addDefaultToExperiments(exRows, defaultExpEvent);

  // 5. Write Output
  writeTable('Lookup_Events', evRows);
  writeTable('Lookup_Experiments', exRows);

  SpreadsheetApp.getActive().toast(
    'GA4 Dataform events refreshed (' + tableName + ') · Events: ' + evRows.length,
    'GA4 Dataform', 6
  );
}

function refreshParametersGA4Dataform() {
  // 1. Read Settings
  const projectId = readNamed('SettingsBigQueryProjectID', '');
  const datasetId = readNamed('SettingsBigQueryDataSetID', '');
  const location = readNamed('SettingsBigQueryDataSetLocation', 'EU');
  const daysHuman = readNamed('SettingsBigQueryNumberOfDaysToQuery', '2 Last Days');
  const exclParams = parseCommaList(readNamed('SettingsBigQueryExcludeParametersList', ''));
  const allowRegex = readNamed('SettingsBigQueryColumns', '');

  // Read Table Name (default to 'ga4_events')
  const tableNameSetting = readNamed('SettingsBigQueryTableID', ''); 
  const tableName = tableNameSetting ? tableNameSetting : 'ga4_events';

  if (!projectId || !datasetId) {
    SpreadsheetApp.getUi().alert('Missing projectId or datasetId in Settings.');
    return;
  }

  // 2. Setup
  const fqTable = projectId + "." + datasetId + "." + tableName;
  const nDays = Math.max(1, parseFirstInteger(daysHuman, 2));
  const suffix = computeSuffixWindow(nDays);

  // 3. Build SQL 
  // CHANGED: We now pass projectId, datasetId, tableName to all functions
  const sqlVariant = buildParamsExperimentVariantSqlGA4Dataform(projectId, datasetId, tableName, exclParams, allowRegex);
  const sqlValue = buildParamsExperimentValueSqlGA4Dataform(projectId, datasetId, tableName, exclParams);
  const sqlColVal = buildNumericColumnsAsValueSqlGA4Dataform(projectId, datasetId, tableName, exclParams, allowRegex);
  const sqlFilter = buildFilterFieldsSqlGA4Dataform(projectId, datasetId, tableName, exclParams, allowRegex);

  // 4. Run & Merge
  let pvar = runBQ(projectId, location, sqlVariant);
  let pval1 = runBQ(projectId, location, sqlValue); 
  let pval2 = runBQ(projectId, location, sqlColVal);  
  let pval = unionDistinct1col(pval1, pval2);       
  const filt = runBQ(projectId, location, sqlFilter);

  // 5. Defaults
  const defaultVariant = readNamed('SettingsExperimentVariantString', '');
  const defaultValueParam = readNamed('SettingsExperimentEventValueParameter', '');

  pvar = addDefaultToParamVariant(pvar, defaultVariant);
  pval = addDefaultToParamValue(pval, defaultValueParam);

  // 6. Write
  writeTable('Lookup_Params_ExperimentVariant', pvar);
  writeTable('Lookup_Params_ExperimentValue', pval);
  writeTable('Lookup_Filter_Fields', filt);

  SpreadsheetApp.getActive().toast(
    'GA4 Dataform params refreshed (' + tableName + ') · Fields: ' + filt.length,
    'GA4 Dataform', 7
  );
}

/** ===================== GA4 DATAFORM: SQL BUILDERS ===================== **/

function buildEventsSqlGA4Dataform(fqTable, suffix, excludeEvents) {
  // Uses PARSE_DATE because suffix is YYYYMMDD but event_date is DATE type
  const ex = excludeEvents.length ? "AND event_name NOT IN UNNEST(" + arrLit(excludeEvents) + ")\n" : "";
  return `
    SELECT event_name
    FROM \`${fqTable}\`
    WHERE event_date BETWEEN PARSE_DATE('%Y%m%d', '${suffix.start}') AND PARSE_DATE('%Y%m%d', '${suffix.end}')
    ${ex}
    GROUP BY 1 ORDER BY 1
  `;
}

function buildExperimentsSqlGA4Dataform(fqTable, suffix, excludeEvents) {
  const exE = excludeEvents.length ? "AND event_name NOT IN UNNEST(" + arrLit(excludeEvents) + ")\n" : "";
  
  // FIXED: Removed the UNION looking for user_properties
  return `
    SELECT DISTINCT 'EVENT' AS experiment_source, event_name AS name
    FROM \`${fqTable}\`
    WHERE event_date BETWEEN PARSE_DATE('%Y%m%d', '${suffix.start}') AND PARSE_DATE('%Y%m%d', '${suffix.end}')
    ${exE}
    ORDER BY experiment_source, name
  `;
}

function buildParamsExperimentVariantSqlGA4Dataform(projectId, datasetId, tableName, excludeParams, allowRegex) {
  // Logic: Get "event_params.*" AND Top-level columns matching regex.
  // FIXED: The exclusion check now runs on the 'Cleaned' name (removing event_params. prefix)
  
  const excludeSql = excludeParams.length 
    ? `AND REGEXP_REPLACE(field_path, '^event_params\\\\.', '') NOT IN UNNEST(${arrLit(excludeParams)})` 
    : "";
  
  const regexCondition = allowRegex 
    ? `OR REGEXP_CONTAINS(field_path, r'${allowRegex}')` 
    : "";

  return `
    SELECT DISTINCT 
      CASE 
        WHEN field_path LIKE 'event_params.%' THEN REGEXP_REPLACE(field_path, '^event_params\\\\.', '') 
        ELSE field_path 
      END AS parameter_name,
      'EVENT' AS parameter_scope
      
    FROM \`${projectId}.${datasetId}\`.INFORMATION_SCHEMA.COLUMN_FIELD_PATHS
    WHERE table_name = '${tableName}'
    AND (
      field_path LIKE 'event_params.%' 
      ${regexCondition}
    )
    AND field_path != 'event_params'
    ${excludeSql}
    ORDER BY parameter_scope, parameter_name
  `;
}

function buildParamsExperimentValueSqlGA4Dataform(projectId, datasetId, tableName, excludeParams) {
  // Logic: Numeric params inside event_params
  // FIXED: Exclusion now checks the short name
  
  const excludeSql = excludeParams.length 
    ? `AND REGEXP_REPLACE(field_path, '^event_params\\\\.', '') NOT IN UNNEST(${arrLit(excludeParams)})` 
    : "";

  return `
    SELECT DISTINCT 
      REGEXP_REPLACE(field_path, '^event_params\\\\.', '') AS parameter_name
    FROM \`${projectId}.${datasetId}\`.INFORMATION_SCHEMA.COLUMN_FIELD_PATHS
    WHERE table_name = '${tableName}'
    AND field_path LIKE 'event_params.%'
    AND data_type IN ('INT64', 'FLOAT64', 'NUMERIC', 'BIGNUMERIC')
    ${excludeSql}
    ORDER BY parameter_name
  `;
}

function buildNumericColumnsAsValueSqlGA4Dataform(projectId, datasetId, tableName, excludeParams, allowRegex) {
  if (!safeTrim(allowRegex)) return "SELECT '' AS parameter_name WHERE FALSE";

  var rex = escapeSqlString(allowRegex);
  var excludeSql = (excludeParams && excludeParams.length)
    ? `AND field_path NOT IN UNNEST(${arrLit(excludeParams)})`
    : "";

  return `
    SELECT DISTINCT field_path AS parameter_name
    FROM \`${projectId}.${datasetId}\`.INFORMATION_SCHEMA.COLUMN_FIELD_PATHS
    WHERE table_name = '${escapeSqlString(tableName)}'
      AND data_type IN ('INT64', 'FLOAT64', 'NUMERIC', 'BIGNUMERIC')
      AND REGEXP_CONTAINS(field_path, r'${rex}')
      ${excludeSql}
    ORDER BY 1
  `;
}

function buildFilterFieldsSqlGA4Dataform(projectId, datasetId, tableName, excludeParams, allowRegex) {
  // FIXED: Exclusion now checks the short name
  const excludeSql = excludeParams.length 
    ? `AND REGEXP_REPLACE(field_path, '^event_params\\\\.', '') NOT IN UNNEST(${arrLit(excludeParams)})` 
    : "";
  
  const regexCondition = allowRegex 
    ? `OR REGEXP_CONTAINS(field_path, r'${allowRegex}')` 
    : "";

  return `
    SELECT DISTINCT 
      CASE 
        WHEN field_path LIKE 'event_params.%' THEN 'Event'
        ELSE 'Column'
      END AS filter_type,
      
      CASE 
        WHEN field_path LIKE 'event_params.%' THEN REGEXP_REPLACE(field_path, '^event_params\\\\.', '') 
        ELSE field_path 
      END AS name

    FROM \`${projectId}.${datasetId}\`.INFORMATION_SCHEMA.COLUMN_FIELD_PATHS
    WHERE table_name = '${tableName}'
    AND (
      field_path LIKE 'event_params.%' 
      ${regexCondition}
    )
    AND field_path != 'event_params'
    ${excludeSql}
    ORDER BY filter_type, name
  `;
}

/** ===================== DRIVERS: MIXPANEL ===================== **/

function refreshEventsMixpanel() {
  const projectId = readNamed('SettingsBigQueryProjectID', '');
  const datasetId = readNamed('SettingsBigQueryDataSetID', '');
  const tableId   = readNamed('SettingsBigQueryTableID', ''); // e.g. mp_master_event
  const location  = readNamed('SettingsBigQueryDataSetLocation', 'EU');
  const daysHuman = readNamed('SettingsBigQueryNumberOfDaysToQuery', '2 Last Days');
  const exclEvents = parseCommaList(readNamed('SettingsBigQueryExcludeEventsList', ''));

  if (!projectId || !datasetId || !tableId) {
    SpreadsheetApp.getUi().alert('Missing projectId, datasetId, or tableId in Settings.');
    return;
  }

  const nDays = Math.max(1, parseFirstInteger(daysHuman, 2));
  const fqTable = "`" + projectId + "." + datasetId + "." + tableId + "`";

  // 1. Build SQL
  const sqlEvents = buildEventsSqlMixpanel(fqTable, nDays, exclEvents);
  const sqlExper  = buildExperimentsSqlMixpanel(fqTable, nDays, exclEvents);

  // 2. Run Query
  const evRows = runBQ(projectId, location, sqlEvents);
  let exRows   = runBQ(projectId, location, sqlExper);

  // 3. Add Default Experiment Name (if set in settings)
  const defaultExpEvent = readNamed('SettingsExperimentEventName', '');
  exRows = addDefaultToExperiments(exRows, defaultExpEvent);

  // 4. Write to Sheets
  writeTable('Lookup_Events', evRows);
  writeTable('Lookup_Experiments', exRows);

  SpreadsheetApp.getActive().toast(
    'Mixpanel events refreshed · Events: ' + evRows.length,
    'Mixpanel', 6
  );
}

function refreshParametersMixpanel() {
  const projectId = readNamed('SettingsBigQueryProjectID', '');
  const datasetId = readNamed('SettingsBigQueryDataSetID', '');
  const tableId   = readNamed('SettingsBigQueryTableID', '');
  const location  = readNamed('SettingsBigQueryDataSetLocation', 'EU');
  const daysHuman = readNamed('SettingsBigQueryNumberOfDaysToQuery', '2 Last Days');
  const exclParams = parseCommaList(readNamed('SettingsBigQueryExcludeParametersList', ''));
  const allowRegex = readNamed('SettingsBigQueryColumns', '');

  if (!projectId || !datasetId || !tableId) {
    SpreadsheetApp.getUi().alert('Missing projectId, datasetId, or tableId in Settings.');
    return;
  }

  const nDays = Math.max(1, parseFirstInteger(daysHuman, 2));
  const fqTable = "`" + projectId + "." + datasetId + "." + tableId + "`";

  // 1. Build SQL
  // Mixpanel params are buried in the 'properties' JSON column.
  const sqlVariant = buildParamsExperimentVariantSqlMixpanel(fqTable, nDays, exclParams);
  const sqlValue   = buildParamsExperimentValueSqlMixpanel(fqTable, nDays, exclParams);
  const sqlFilter  = buildFilterFieldsSqlMixpanel(fqTable, nDays, exclParams, allowRegex, projectId, datasetId, tableId);

  // 2. Run Query
  let pvar = runBQ(projectId, location, sqlVariant);
  let pval = runBQ(projectId, location, sqlValue);
  const filt = runBQ(projectId, location, sqlFilter);

  // 3. Add Defaults
  const defaultVariant = readNamed('SettingsExperimentVariantString', '');
  const defaultValueParam = readNamed('SettingsExperimentEventValueParameter', '');

  pvar = addDefaultToParamVariant(pvar, defaultVariant);
  pval = addDefaultToParamValue(pval, defaultValueParam);

  // 4. Write to Sheets
  writeTable('Lookup_Params_ExperimentVariant', pvar);
  writeTable('Lookup_Params_ExperimentValue', pval);
  writeTable('Lookup_Filter_Fields', filt);

  SpreadsheetApp.getActive().toast(
    'Mixpanel params refreshed · Fields: ' + filt.length,
    'Mixpanel', 7
  );
}

/** ===================== MIXPANEL: SQL BUILDERS ===================== **/

function buildEventsSqlMixpanel(fqTable, nDays, excludeEvents) {
  // CORRECTED: Uses 'event_name' column
  const ex = excludeEvents.length ? "AND event_name NOT IN UNNEST(" + arrLit(excludeEvents) + ")\n" : "";
  
  return `
    SELECT event_name
    FROM ${fqTable}
    WHERE time >= TIMESTAMP(DATE_SUB(CURRENT_DATE(), INTERVAL ${nDays} DAY))
    ${ex}
    GROUP BY 1
    ORDER BY 1
  `;
}

function buildExperimentsSqlMixpanel(fqTable, nDays, excludeEvents) {
  // CORRECTED: Uses 'event_name' column
  const ex = excludeEvents.length ? "AND event_name NOT IN UNNEST(" + arrLit(excludeEvents) + ")\n" : "";

  return `
    SELECT DISTINCT 'EVENT' AS experiment_source, event_name AS name
    FROM ${fqTable}
    WHERE time >= TIMESTAMP(DATE_SUB(CURRENT_DATE(), INTERVAL ${nDays} DAY))
    ${ex}
    ORDER BY 1, 2
  `;
}

function buildParamsExperimentVariantSqlMixpanel(fqTable, nDays, excludeParams) {
  // Scans the 'properties' column for keys.
  // We exclude keys starting with '$' (internal Mixpanel keys) unless specifically needed, 
  // but usually for A/B testing we want custom properties.
  // You can remove "AND NOT STARTS_WITH(key, '$')" if you need internal keys.

  const excludeSql = excludeParams.length 
    ? `AND key NOT IN UNNEST(${arrLit(excludeParams)})` 
    : "";

  return `
    WITH raw_json AS (
      SELECT TO_JSON_STRING(properties) as json_str
      FROM ${fqTable}
      WHERE time >= TIMESTAMP(DATE_SUB(CURRENT_DATE(), INTERVAL ${nDays} DAY))
    ),
    extracted_keys AS (
      SELECT DISTINCT key
      FROM raw_json,
      UNNEST(REGEXP_EXTRACT_ALL(json_str, r'"([^"]+)":')) AS key
    )
    SELECT DISTINCT key AS parameter_name, 'EVENT' AS parameter_scope
    FROM extracted_keys
    WHERE key IS NOT NULL
    ${excludeSql}
    ORDER BY 1
  `;
}

function buildParamsExperimentValueSqlMixpanel(fqTable, nDays, excludeParams) {
  // Detects Numeric parameters inside the 'properties' JSON blob.
  // It looks for patterns like "key": 123 or "key": 12.34
  
  const excludeSql = excludeParams.length 
    ? `AND key NOT IN UNNEST(${arrLit(excludeParams)})` 
    : "";

  return `
    WITH raw_data AS (
      SELECT TO_JSON_STRING(properties) as json_str
      FROM ${fqTable}
      WHERE time >= TIMESTAMP(DATE_SUB(CURRENT_DATE(), INTERVAL ${nDays} DAY))
    ),
    pairs AS (
      SELECT 
        REGEXP_EXTRACT(pair, r'^"([^"]+)":') as key,
        REGEXP_EXTRACT(pair, r':(.*)$') as val
      FROM raw_data,
      UNNEST(REGEXP_EXTRACT_ALL(json_str, r'"[^"]+":[^,}]+')) AS pair
    )
    SELECT DISTINCT key AS parameter_name
    FROM pairs
    WHERE 
      -- Check if value looks like a number (integer or float)
      REGEXP_CONTAINS(val, r'^\\s*-?(?:\\d+\\.?\\d*|\\d*\\.\\d+)(?:[eE][+-]?\\d+)?\\s*$')
      -- Ensure it's not wrapped in quotes (which would be a string)
      AND NOT REGEXP_CONTAINS(val, r'^\\s*"')
      ${excludeSql}
    ORDER BY 1
  `;
}

function buildFilterFieldsSqlMixpanel(fqTable, nDays, excludeParams, allowRegex, projectId, datasetId, tableId) {
  // 1. JSON Properties from the 'properties' column
  const excludeSql = excludeParams.length 
    ? `AND key NOT IN UNNEST(${arrLit(excludeParams)})` 
    : "";

  // 2. Standard Columns (if enabled via regex) from Information Schema
  const regexCondition = allowRegex 
    ? `AND REGEXP_CONTAINS(field_path, r'${allowRegex}')` 
    : "AND FALSE"; // Disable if no regex provided

  return `
    /* 1. Extract Keys from JSON Properties */
    WITH raw_json AS (
      SELECT TO_JSON_STRING(properties) as json_str
      FROM ${fqTable}
      WHERE time >= TIMESTAMP(DATE_SUB(CURRENT_DATE(), INTERVAL ${nDays} DAY))
    ),
    json_keys AS (
      SELECT DISTINCT key as name, 'Event' as filter_type
      FROM raw_json,
      UNNEST(REGEXP_EXTRACT_ALL(json_str, r'"([^"]+)":')) AS key
      WHERE key IS NOT NULL
      ${excludeSql}
    ),
    /* 2. Extract Matching Columns from Schema */
    col_keys AS (
      SELECT DISTINCT field_path as name, 'Column' as filter_type
      FROM \`${projectId}.${datasetId}\`.INFORMATION_SCHEMA.COLUMN_FIELD_PATHS
      WHERE table_name = '${tableId}'
      ${regexCondition}
    )
    SELECT * FROM json_keys
    UNION DISTINCT
    SELECT * FROM col_keys
    ORDER BY filter_type, name
  `;
}