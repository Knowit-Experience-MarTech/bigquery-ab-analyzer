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
  
/***** FILTERS MODULE *****/

/** Filters sheet layout */
const filtersNumColumns = 9; // Experiment_ID, Variant, Enabled, Include/Exclude, Filter On Value, Filter Scope, Filter Field, Filter Value, Notes
const filtersHeaderRow = 4; // headers live here
const filtersDataStartRow = filtersHeaderRow + 1; // row 5
const nrFilters = 'FiltersTable'; // named range for Filters body

/** Utility: map "Experiment Event"/"Conversion Event" → "Experiment"/"Conversion" */
function filtersToAppliesLabel(s) {
  s = String(s || '').trim().toLowerCase();
  if (!s) return 'Both';
  // Accepts: "experiment", "experiment event", etc.
  if (s.indexOf('experiment') > -1) return 'Experiment Event';
  if (s.indexOf('conversion') > -1) return 'Conversion Event';
  return 'Both';
}
/** Utility: scope normalization */
function filtersToScopeLabel(s) {
  s = String(s || '').toLowerCase();
  if (s === 'user') return 'User';
  if (s === 'column') return 'Column';
  return 'Event';
}
function filtersNormalizeYesNo(s) {
  s = String(s || '').toLowerCase();
  return s === 'yes' || s === 'true';
}

/** Get scope→fields map from named range A:B = (Scope, Field). */
function getFilterFieldsMap() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rng = ss.getRangeByName('DropdownLookupFilterFields');
  if (!rng) throw new Error('Named range "DropdownLookupFilterFields" not found.');
  const out = { event: [], user: [], column: [] };
  const rows = rng.getValues(); // [[Scope, Field], ...]
  for (let i = 0; i < rows.length; i++) {
    const scope = String(rows[i][0] || '').trim().toLowerCase();
    const field = String(rows[i][1] || '').trim();
    if (!scope || !field) continue;
    if (out[scope]) out[scope].push(field);
  }
  // dedupe + sort
  Object.keys(out).forEach(k => {
    out[k] = Array.from(new Set(out[k])).sort((a,b)=>a.localeCompare(b));
  });
  return out;
}

/** Apply Filter Field dropdown for a single Filters row (row index in Filters sheet). */
function filtersApplyFilterFieldDropdownForRow(sheet, row) {
  const scopeCell = sheet.getRange(row, 6); // Filter Scope
  const fieldCell = sheet.getRange(row, 7); // Filter Field

  const scopeKey = String(scopeCell.getValue() || '').trim().toLowerCase();
  let fields = [];
  try {
    const map = getFilterFieldsMap();
    fields = map[scopeKey] || [];
  } catch (err) {
    // If lookup missing, clear validation gracefully
    fieldCell.clearDataValidations();
    return;
  }

  if (fields.length > 0) {
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(fields, true)
      .setAllowInvalid(true)
      .build();
    fieldCell.setDataValidation(rule);

    // Clear current value if it’s no longer valid
    const cur = String(fieldCell.getValue() || '');
    if (cur && fields.indexOf(cur) === -1) fieldCell.clearContent();
  } else {
    fieldCell.clearDataValidations();
    // Optionally clear content:
    // fieldCell.clearContent();
  }
}

/** Apply Filter Field dropdowns for a range of rows (bulk refresh). */
function filtersRefreshFieldDropdownsForRange(sheet, startRow, numRows) {
  for (let r = 0; r < numRows; r++) {
    filtersApplyFilterFieldDropdownForRow(sheet, startRow + r);
  }
}

/** Ensure Filters body validations + named range (never writes headers) */
function filtersEnsureFiltersSheet() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(filtersSheetName);
  if (!sh) {
    sh = ss.insertSheet(filtersSheetName);
    SpreadsheetApp.getActive().toast('Created "' + filtersSheetName + '". Add headers on row ' + filtersHeaderRow + '.');
  }
  const lastRow = Math.max(sh.getLastRow(), filtersDataStartRow);
  const numRows = Math.max(lastRow - filtersDataStartRow + 1, 1);
  sh.getRange(startRow, 1, numRows, 1).setNumberFormat("00");

  // Dropdowns + checkbox on body (row 5+)
  filtersApplyValidationList(sh, filtersDataStartRow, 2, numRows, ['A','B']);                          // Variant
  filtersApplyValidationCheckbox(sh, filtersDataStartRow, 3, numRows);                                  // Enabled
  filtersApplyValidationList(sh, filtersDataStartRow, 4, numRows, ['Include','Exclude']);               // Include/Exclude
  filtersApplyValidationList(sh, filtersDataStartRow, 5, numRows, ['Both','Experiment','Conversion']);  // Filter On Value
  filtersApplyValidationList(sh, filtersDataStartRow, 6, numRows, ['Event','User','Column']);           // Filter Scope

  // Maintain Filters_Table named range over body
  const bodyRange = sh.getRange(filtersDataStartRow, 1, numRows, filtersNumColumns);
  ss.setNamedRange(nrFilters, bodyRange);
}
function filtersApplyValidationList(sheet, startRow, col, numRows, list) {
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(list).setAllowInvalid(false).build();
  sheet.getRange(startRow, col, numRows, 1).setDataValidation(rule);
}
function filtersApplyValidationCheckbox(sheet, startRow, col, numRows) {
  const rule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  sheet.getRange(startRow, col, numRows, 1).setDataValidation(rule);
}

/** Check if a Filters row exists for (Experiment_ID, Variant) — scans row 5+ only */
function filtersHasRow(sheet, expId, variant) {
  const last = sheet.getLastRow();
  if (last < filtersDataStartRow) return false;
  const numRows = last - filtersDataStartRow + 1;
  const vals = sheet.getRange(filtersDataStartRow, 1, numRows, filtersNumColumns).getValues();
  for (let i = 0; i < vals.length; i++) {
    const r = vals[i];
    if (String(r[0]||'').trim() === String(expId) && String(r[1]||'').trim() === String(variant)) return true;
  }
  return false;
}

/** ---------- SEEDING (uses the safe append row & per-row validations) ---------- */
function filtersSeedFromExperimentBlock(sheet, topRow, opts) {
  filtersEnsureFiltersSheet();

  const ss = SpreadsheetApp.getActive();
  const filters = ss.getSheetByName(filtersSheetName);

  // ID preference
  let expId = (opts && opts.useIdFrom === 'name')
    ? String(sheet.getRange(topRow, experimentNameColumn).getValue() || '').trim()
    : String(sheet.getRange(topRow, idColumn).getValue() || '').trim();
  if (!expId) expId = String(sheet.getRange(topRow, experimentNameColumn).getValue() || '').trim();
  if (!expId) return { created:0, existed:0 };

  const expName = String(sheet.getRange(topRow, experimentNameColumn).getValue() || '').trim();

  // Flags
  const useFiltersOn = (String(sheet.getRange(topRow, filterColumn).getValue() || '').toLowerCase() === 'yes');
  let advOn = !!sheet.getRange(topRow, filterAdvancedColumn).getValue();
  if (!useFiltersOn || !advOn) return { created:0, existed:0 };

  const variantSetting = String(sheet.getRange(topRow, variantSettingsColumn).getValue() || 'Same');
  const different = (variantSetting === 'Different');

  // Read A row
  let includeA = String(sheet.getRange(topRow, filterTypeColumn).getValue() || 'Include');
  let onA = String(sheet.getRange(topRow, filterOnValueColumn).getValue() || 'Both');
  let scopeA = String(sheet.getRange(topRow, filterScopeColumn).getValue() || 'Event');
  let fieldA = String(sheet.getRange(topRow, filterFieldColumn).getValue() || '').trim();
  let valueA = String(sheet.getRange(topRow, filterValueColumn).getValue() || '').trim();

  // Read B (or mirror A)
  let includeB = includeA, onB = onA, scopeB = scopeA, fieldB = fieldA, valueB = valueA;
  if (different) {
    includeB = String(sheet.getRange(topRow + 1, filterTypeColumn).getValue() || includeA);
    onB = String(sheet.getRange(topRow + 1, filterOnValueColumn).getValue() || onA);
    scopeB = String(sheet.getRange(topRow + 1, filterScopeColumn).getValue() || scopeA);
    let fB = String(sheet.getRange(topRow + 1, filterFieldColumn).getValue() || '').trim();
    let vB = String(sheet.getRange(topRow + 1, filterValueColumn).getValue() || '').trim();
    if (fB) fieldB = fB;
    if (vB) valueB = vB;
  }

  let existed = 0, created = 0;

  // Seed A (only if meaningful)
  if (fieldA || valueA) {
    if (!filtersHasRow(filters, expId, 'A')) {
      const rowA = filtersNextAppendRow(filters);
      filters.getRange(rowA, 1, 1, filtersNumColumns).setValues([[
        expId, 'A', true, includeA, filtersToAppliesLabel(onA), filtersToScopeLabel(scopeA), fieldA, valueA,
        'Seeded from simple filter (' + (expName || expId) + ')'
      ]]);
      filters.getRange(rowA, 1).setNumberFormat("00");
      filtersApplyRowValidations(filters, rowA);
      filtersApplyFilterFieldDropdownForRow(filters, rowA);
      created++;
    } else {
      existed++;
    }
  }

  // Seed B (only if meaningful)
  if (fieldB || valueB) {
    if (!filtersHasRow(filters, expId, 'B')) {
      const rowB = filtersNextAppendRow(filters);
      filters.getRange(rowB, 1, 1, filtersNumColumns).setValues([[
        expId, 'B', true, includeB, filtersToAppliesLabel(onB), filtersToScopeLabel(scopeB), fieldB, valueB,
        'Seeded from simple filter (' + (expName || expId) + ')'
      ]]);
      filters.getRange(rowB, 1).setNumberFormat("00");
      filtersApplyRowValidations(filters, rowB);
      filtersApplyFilterFieldDropdownForRow(filters, rowB);
      created++;
    } else {
      existed++;
    }
  }

  filtersUpdateFiltersTableNameRange();
  return { created: created, existed: existed };
}

/** ---------- DATA ROW DETECTION (ignores bare FALSE checkboxes) ---------- */

/** Last row that actually has data (any of: Experiment_ID, Field, Value) at/after row 5. Returns 4 if none. */
function filtersGetLastDataRow(sheet) {
  const lastVis = sheet.getLastRow();
  if (lastVis < filtersDataStartRow) return filtersDataStartRow - 1;

  const numRows = lastVis - filtersDataStartRow + 1;
  const vals = sheet.getRange(filtersDataStartRow, 1, numRows, filtersNumColumns).getValues();

  let lastDataOffset = -1;
  for (let i = 0; i < vals.length; i++) {
    const row = vals[i];
    const expId = String(row[0] || '').trim(); // Experiment_ID
    const field = String(row[6] || '').trim(); // Filter Field
    const value = String(row[7] || '').trim(); // Filter Value
    // Count as "has data" ONLY if any of these key columns are filled
    if (expId || field || value) lastDataOffset = i;
  }
  return (lastDataOffset === -1) ? (filtersDataStartRow - 1) : (filtersDataStartRow + lastDataOffset);
}

/** Next safe append row (row 5 if empty; otherwise last data row + 1). */
function filtersNextAppendRow(sheet) {
  const lastData = filtersGetLastDataRow(sheet);
  return Math.max(filtersDataStartRow, lastData + 1);
}

/** True if a real data row exists for (Experiment_ID, Variant). Scans only through the last data row. */
function filtersHasRow(sheet, expId, variant) {
  const lastData = filtersGetLastDataRow(sheet);
  if (lastData < filtersDataStartRow) return false;

  const numRows = lastData - filtersDataStartRow + 1;
  const vals = sheet.getRange(filtersDataStartRow, 1, numRows, filtersNumColumns).getValues();
  for (let i = 0; i < vals.length; i++) {
    const r = vals[i];
    if (String(r[0]||'').trim() === String(expId) &&
        String(r[1]||'').trim() === String(variant)) {
      return true;
    }
  }
  return false;
}

/** ---------- VALIDATIONS & NAMED RANGE ---------- */

/** Apply validations only to a single row that we just wrote. */
function filtersApplyRowValidations(sheet, row) {
  // Variant
  const vRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['A','B'])
    .setAllowInvalid(false)
    .build();
  sheet.getRange(row, 2, 1, 1).setDataValidation(vRule);

  // Enabled (checkbox) — default TRUE
  const cbRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  const cbCell = sheet.getRange(row, 3, 1, 1);
  cbCell.setDataValidation(cbRule).setValue(true);

  // Include/Exclude
  const incRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Include','Exclude'])
    .setAllowInvalid(false)
    .build();
  sheet.getRange(row, 4, 1, 1).setDataValidation(incRule);

  // Filter On Value
  const onRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Both','Experiment Event','Conversion Event'])
    .setAllowInvalid(false)
    .build();
  sheet.getRange(row, 5, 1, 1).setDataValidation(onRule);

  // Filter Scope
  const scopeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Event','User','Column'])
    .setAllowInvalid(false)
    .build();
  sheet.getRange(row, 6, 1, 1).setDataValidation(scopeRule);
}

/** Keep Filters_Table named range tightly around actual data (or 1 empty data row if none). */
function filtersUpdateFiltersTableNameRange() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(filtersSheetName);
  if (!sh) return;

  const lastData = filtersGetLastDataRow(sh);
  const startRow = filtersDataStartRow;

  const height = (lastData >= startRow) ? (lastData - startRow + 1) : 1; // keep at least 1 row in the body
  const body = sh.getRange(startRow, 1, height, filtersNumColumns);
  ss.setNamedRange(nrFilters, body);
}

/** Ensure the sheet exists; DO NOT push validations across empty rows. Only keep named range correct. */
function filtersEnsureFiltersSheet() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(filtersSheetName);
  if (!sh) {
    sh = ss.insertSheet(filtersSheetName);
    SpreadsheetApp.getActive().toast('Created "' + filtersSheetName + '". Add headers on row ' + filtersHeaderRow + '.');
  }
  filtersUpdateFiltersTableNameRange();

  const lastData = filtersGetLastDataRow(sh);
  if (lastData >= filtersDataStartRow) {
    filtersRefreshFieldDropdownsForRange(sh, filtersDataStartRow, lastData - filtersDataStartRow + 1);
  }
}

// Delete all Filters rows for any of the provided identifiers (e.g., numeric ID and/or name).
function filtersDeleteRowsForExperiment(expIdentifiers) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(filtersSheetName);
  if (!sh) return 0;

  // Normalize to array of trimmed strings
  const ids = [];
  if (Array.isArray(expIdentifiers)) {
    for (let k = 0; k < expIdentifiers.length; k++) {
      const v = String(expIdentifiers[k] || '').trim();
      if (v) ids.push(v);
    }
  } else {
    const single = String(expIdentifiers || '').trim();
    if (single) ids.push(single);
  }
  if (!ids.length) return 0;

  // Scan only real data rows
  const lastData = filtersGetLastDataRow(sh);
  if (lastData < filtersDataStartRow) return 0;

  const numRows = lastData - filtersDataStartRow + 1;
  const vals = sh.getRange(filtersDataStartRow, 1, numRows, filtersNumColumns).getValues();

  const deleted = 0;
  // Delete bottom-up to avoid index shifting
  for (let i = vals.length - 1; i >= 0; i--) {
    const rowExpId = String(vals[i][0] || '').trim(); // Experiment_ID in Filters
    if (ids.indexOf(rowExpId) !== -1) {
      sh.deleteRow(filtersDataStartRow + i);
      deleted++;
    }
  }

  filtersUpdateFiltersTableNameRange();
  return deleted;
}

/** Return the last data row for this Experiment_ID in Filters (or -1 if none). */
function filtersFindEndOfExperimentBlockRow(sheet, expId) {
  const lastData = filtersGetLastDataRow(sheet);
  if (lastData < filtersDataStartRow) return -1;

  const numRows = lastData - filtersDataStartRow + 1;
  const vals = sheet.getRange(filtersDataStartRow, 1, numRows, filtersNumColumns).getValues();

  let endRow = -1;
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i][0] || '').trim() === String(expId)) {
      endRow = filtersDataStartRow + i;
    }
  }
  return endRow; // absolute row index, or -1 if none
}

/** Ensure there are `count` blank rows directly after the experiment block; return the first row index to write. */
function filtersInsertSlotsAfterBlock(sheet, expId, count) {
  const endRow = filtersFindEndOfExperimentBlockRow(sheet, expId);
  let startRow;
  if (endRow >= filtersDataStartRow) {
    // Insert physically below the block
    sheet.insertRowsAfter(endRow, count);
    startRow = endRow + 1;
  } else {
    // No existing block → use the next append row, ensure capacity
    startRow = filtersNextAppendRow(sheet);
    let need = (startRow + count - 1) - sheet.getMaxRows();
    if (need > 0) sheet.insertRowsAfter(sheet.getMaxRows(), need);
  }
  return startRow;
}

function filtersBtnAddInclude() { filtersAddRowFromSelection(/*isInclude=*/true, /*bothVariants=*/false); }
function filtersBtnAddExclude() { filtersAddRowFromSelection(/*isInclude=*/false, /*bothVariants=*/false); }
function filtersBtnAddIncludeBoth() { filtersAddRowFromSelection(/*isInclude=*/true, /*bothVariants=*/true);  }
function filtersBtnAddExcludeBoth() { filtersAddRowFromSelection(/*isInclude=*/false, /*bothVariants=*/true);  }

/** Insert new row(s) right under the current experiment’s block. */
function filtersAddRowFromSelection(isInclude, bothVariants) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(filtersSheetName);
  if (!sh) { SpreadsheetApp.getUi().alert(filtersSheetName+' sheet not found.'); return; }

  const cell = sh.getActiveCell();
  if (!cell) { SpreadsheetApp.getUi().alert('Select a row in '+filtersSheetName+' first.'); return; }
  const r = cell.getRow();
  if (r < filtersDataStartRow) { SpreadsheetApp.getUi().alert('Select a data row (row ' + filtersDataStartRow + ' or below).'); return; }

  const base = sh.getRange(r, 1, 1, filtersNumColumns).getValues()[0];
  const expId = String(base[0] || '').trim();
  const variant = String(base[1] || '').trim();
  if (!expId) { SpreadsheetApp.getUi().alert('Selected row has no Experiment_ID.'); return; }

  const onLbl = String(base[4] || 'Both'); // keep same “Filter On Value”
  const scope = String(base[5] || 'Event'); // keep same scope
  const includeLabel = isInclude ? 'Include' : 'Exclude';

  const variants = bothVariants ? ['A','B'] : [(variant === 'A' || variant === 'B') ? variant : 'A'];

  // Allocate consecutive slots directly below this experiment’s block
  const firstRow = filtersInsertSlotsAfterBlock(sh, expId, variants.length);

  // Write rows in order (kept contiguous under the block)
  for (let i = 0; i < variants.length; i++) {
    const writeRow = firstRow + i;
    sh.getRange(writeRow, 1, 1, filtersNumColumns).setValues([[
      expId,            // Experiment_ID
      variants[i],      // Variant
      false,            // Enabled
      includeLabel,     // Include/Exclude
      onLbl,            // Filter On Value
      scope,            // Filter Scope
      '',               // Filter Field (user types)
      '',               // Filter Value (user types)
      'Added via button'
    ]]);
    sh.getRange(writeRow, 1).setNumberFormat("00");
    filtersApplyRowValidations(sh, writeRow);
    filtersApplyFilterFieldDropdownForRow(sh, writeRow);
  }

  // Focus on Filter Field of the first new row
  ss.setActiveSheet(sh);
  sh.setActiveRange(sh.getRange(firstRow, 7, 1, 1));

  filtersUpdateFiltersTableNameRange();
  filtersBtnFormatBlocks();
}

function filtersBtnDuplicateSelected() { 
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(filtersSheetName);
  if (!sh) { SpreadsheetApp.getUi().alert(filtersSheetName+' sheet not found.'); return; }

  const cell = sh.getActiveCell();
  if (!cell) { SpreadsheetApp.getUi().alert('Select a row in '+filtersSheetName+' first.'); return; }
  const r = cell.getRow();
  if (r < filtersDataStartRow) { SpreadsheetApp.getUi().alert('Select a data row (row ' + filtersDataStartRow + ' or below).'); return; }

  const src = sh.getRange(r, 1, 1, filtersNumColumns).getValues()[0];
  const expId   = String(src[0] || '').trim();
  if (!expId) { SpreadsheetApp.getUi().alert('Selected row has no Experiment_ID.'); return; }

  // Insert one slot directly below this experiment’s block
  const writeRow = filtersInsertSlotsAfterBlock(sh, expId, 1);

  // Clone, but clear the Filter Value so the user can quickly type a new one
  const dst = [
    expId,
    String(src[1] || 'A'),      // Variant
    false,                      // Enabled
    src[3] || 'Include',        // Include/Exclude
    src[4] || 'Both',           // Filter On Value
    src[5] || 'Event',          // Filter Scope
    src[6] || '',               // Filter Field
    '',                         // Filter Value (cleared)
    'Duplicated via button'
  ];
  sh.getRange(writeRow, 1, 1, filtersNumColumns).setValues([dst]);
  sh.getRange(writeRow, 1).setNumberFormat("00");
  filtersApplyRowValidations(sh, writeRow);
  filtersApplyFilterFieldDropdownForRow(sh, writeRow);

  ss.setActiveSheet(sh);
  sh.setActiveRange(sh.getRange(writeRow, 8, 1, 1)); // jump to Value
  filtersUpdateFiltersTableNameRange();

  filtersBtnFormatBlocks();
}

/** ===== Block-aware formatting for Filters sheet ===== */
const filtersZebraColor = '#f7f7f7'; // light gray

/** Format: shade every second Experiment_ID block and draw thick borders around each block. */
function filtersBtnFormatBlocks() { filtersFormatBlocks({ shade:true, borders:true }); }

/** Core formatter */
function filtersFormatBlocks(opts) {
  const shade   = opts && opts.shade   !== false;
  const borders = opts && opts.borders !== false;

  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(filtersSheetName);
  if (!sh) return;

  const start = filtersDataStartRow;
  const last  = filtersGetLastDataRow(sh);
  if (last < start) return;

  const numRows = last - start + 1;

  // Normalize font weight for the whole body (row 5+)
  sh.getRange(start, 1, numRows, filtersNumColumns).setFontWeight('normal');

  const data = sh.getRange(start, 1, numRows, filtersNumColumns).getValues();

  // Find contiguous blocks per Experiment_ID (skip blank rows)
  const blocks = [];
  let i = 0;
  while (i < numRows) {
    let id = String(data[i][0] || '').trim(); // col 1 = Experiment_ID
    if (!id) { i++; continue; }
    let j = i;
    while (j + 1 < numRows && String(data[j+1][0] || '').trim() === id) j++;
    blocks.push({ id: id, r1: i, r2: j });
    i = j + 1;
  }

  // 1) SHADING (zebra per block)
  if (shade) {
    // Clear all backgrounds first
    sh.getRange(start, 1, numRows, filtersNumColumns).setBackground(null);

    // Build colors matrix (null = leave default; color for shaded blocks)
    const colors = new Array(numRows);
    for (let r = 0; r < numRows; r++) {
      colors[r] = new Array(filtersNumColumns);
      for (let c = 0; c < filtersNumColumns; c++) colors[r][c] = null;
    }
    for (let b = 0; b < blocks.length; b++) {
      if (b % 2 === 1) { // shade every second block
        for (let r2 = blocks[b].r1; r2 <= blocks[b].r2; r2++) {
          for (let c2 = 0; c2 < filtersNumColumns; c2++) colors[r2][c2] = filtersZebraColor;
        }
      }
    }
    sh.getRange(start, 1, numRows, filtersNumColumns).setBackgrounds(colors);
  }

  // 2) BORDERS (thick top on first row of block, thick bottom on last)
  if (borders) {
    // Clear all row top/bottom borders first to avoid leftovers
    for (let r3 = 0; r3 < numRows; r3++) {
      sh.getRange(start + r3, 1, 1, filtersNumColumns)
        .setBorder(false, null, false, null, false, false);
    }
    // Apply thick borders for each block
    for (let k = 0; k < blocks.length; k++) {
      const topRow = start + blocks[k].r1;
      const botRow = start + blocks[k].r2;
      sh.getRange(topRow, 1, 1, filtersNumColumns)
        .setBorder(true, null, null, null, false, false, 'black', SpreadsheetApp.BorderStyle.SOLID_THICK);
      sh.getRange(botRow, 1, 1, filtersNumColumns)
        .setBorder(null, null, true, null, false, false, 'black', SpreadsheetApp.BorderStyle.SOLID_THICK);
    }
  }
}


/** UI helpers your menu already references */
function openFiltersSheet() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(filtersSheetName) || ss.insertSheet(filtersSheetName);
  ss.setActiveSheet(sh);
}
function backfillAllAdvanced() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(experimentSheetName); // adjust if needed
  if (!sheet) { SpreadsheetApp.getUi().alert('Sheet '+experimentSheetName+' not found.'); return; }

  filtersEnsureFiltersSheet();

  const lastRow = sheet.getLastRow();
  let seeded = 0, already = 0;

  for (let r = firstRow; r <= lastRow; r += 2) {
    // Only top row of each 2-row block
    const useFiltersOn = filtersNormalizeYesNo(sheet.getRange(r, filterColumn).getValue());
    const advOn = !!sheet.getRange(r, filterAdvancedColumn).getValue();
    if (!useFiltersOn || !advOn) continue;

    const res = filtersSeedFromExperimentBlock(sheet, r, { useIdFrom: 'id' }); // or 'name' if you prefer
    seeded += res.created;
    already += res.existed;
  }

  SpreadsheetApp.getUi().alert('Backfill complete.\nNew rows: ' + seeded + '\nAlready existed: ' + already);
}
