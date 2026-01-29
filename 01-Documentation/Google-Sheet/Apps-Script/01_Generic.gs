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

// **** MENU ****
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📈 BigQuery A/B Analyzer')
    .addItem('Analyze A/B Variants in BigQuery', 'confirmQueries')
    .addSubMenu(ui.createMenu('Get Data from BigQuery')
      .addItem('Refresh Events', 'refreshEvents')
      .addItem('Refresh Parameters', 'refreshParameters'))
    .addSubMenu(ui.createMenu('Advanced Filters')
      .addItem('Open Filters Sheet', 'openFiltersSheet')
      .addItem('Backfill missing Advanced Filter rows', 'backfillAllAdvanced'))
    .addItem('Check for Updates', 'checkForUpdates')
    .addToUi();
}

// **** END MENU ****

const experimentSheetName = "Experiments";
const filtersSheetName = "Filters";
const queryInfoSheetName = "Query Info";
const settingsSheetName = "Settings";

const firstRow = 6;

const idColumn = 1,                         // Column A - idColumn
  dateStartColumn = 2,                      // Column B - Date Start
  dateEndColumn = 3,                        // Column C - Date End
  dateComparisonColumn = 4,                 // Column D - Compare Dates (checkbox)
  experimentNameColumn = 5,                 // Column E - Experiment ID/Name
  variantNameColumn = 6,                    // Column F - Variant ID/Name
  conversionEventColumn = 7,                // Column G - Conversion Event
  conversionEventCountColumn = 8,           // Column H - Count All Conversions
  experimentVariantStringColumn = 9,        // Column I - Experiment Variant String
  analyzeTestColumn = 10,                   // Column J - Analyse Experiment
  eventValueTestColumn = 11,                // Column K - Event Value Test
  hypothesisColumn = 12,                    // Column L - Hypothesis
  confidenceColumn = 13,                    // Column M - Confidence
  descriptionColumn = 14,                   // Column N - Description
  scopeColumn = 15,                         // Column O - Scope. Users/Sessions
  identitySourceColumn = 16,                // Column P - Identity source (DEVICE_ID, USER_ID_ONLY, USER_ID_OR_DEVICE_ID)
  variantSettingsColumn = 17,               // Column Q - Variant Settings. Same/Different. 
  filterColumn = 18,                        // Column R - Filter
  filterAdvancedColumn = 19,                // Column S - User Advanced Filter
  filterTypeColumn = 20,                    // Column T - Filter
  filterOnValueColumn = 21,                 // Column U - Filter
  filterScopeColumn = 22,                   // Column V - Filter Scope
  filterFieldColumn = 23,                   // Column W - Parameter Name
  filterValueColumn = 24,                   // Column X - Parameter Value
  experimentEventNameColumn = 25,           // Column Y - Experiment Event Name used in BQ
  experimentVariantParameterColumn = 26,    // Column Z - Experiment Variant String used in BQ
  experimentEventValueParameterColumn = 27, // Column AA - Experiment Value used in BQ
  userOverlapColumn = 28,                   // Column AB - User Overlap
  linksColumn = 29,                         // Column AC - Links
  imagesColumn = 30,                        // Column AD - Images
  editExperimentColumn = 31;                // Column AE - Edit Experiment

function applyMergesForBlock(startRow) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();

  sheet.getRange(firstRow, idColumn, 2, 1).merge();
  sheet.getRange(firstRow, dateStartColumn, 2, 1).merge();
  sheet.getRange(firstRow, dateEndColumn, 2, 1).merge();
  sheet.getRange(firstRow, dateComparisonColumn, 2, 1).merge();
  sheet.getRange(firstRow, experimentNameColumn, 2, 1).merge();
  sheet.getRange(firstRow, conversionEventColumn, 2, 1).merge();
  sheet.getRange(firstRow, conversionEventCountColumn, 2, 1).merge();
  sheet.getRange(firstRow, analyzeTestColumn, 2, 1).merge();
  sheet.getRange(firstRow, eventValueTestColumn, 2, 1).merge();
  sheet.getRange(firstRow, hypothesisColumn, 2, 1).merge();
  sheet.getRange(firstRow, confidenceColumn, 2, 1).merge();
  sheet.getRange(firstRow, descriptionColumn, 2, 1).merge();
  sheet.getRange(firstRow, scopeColumn, 2, 1).merge();
  sheet.getRange(firstRow, identitySourceColumn, 2, 1).merge();
  sheet.getRange(firstRow, variantSettingsColumn, 2, 1).merge();
  sheet.getRange(firstRow, filterColumn, 2, 1).merge();
  sheet.getRange(firstRow, filterAdvancedColumn, 2, 1).merge();
  sheet.getRange(firstRow, filterTypeColumn, 2, 1).merge();
  sheet.getRange(firstRow, filterOnValueColumn, 2, 1).merge();
  sheet.getRange(firstRow, filterScopeColumn, 2, 1).merge();
  sheet.getRange(firstRow, filterFieldColumn, 2, 1).merge();
  sheet.getRange(firstRow, filterValueColumn, 2, 1).merge();
  sheet.getRange(firstRow, experimentEventNameColumn, 2, 1).merge();
  sheet.getRange(firstRow, experimentVariantParameterColumn, 2, 1).merge();
  sheet.getRange(firstRow, experimentEventValueParameterColumn, 2, 1).merge();
  sheet.getRange(firstRow, userOverlapColumn, 2, 1).merge();
  sheet.getRange(firstRow, linksColumn, 2, 1).merge();
  sheet.getRange(firstRow, editExperimentColumn, 2, 1).merge();
}

/**
 * Builds a data validation rule pointing to the named range "DropdownLookupEvents".
 * Shows a dropdown and disallows invalid values.
 */
function getEventsDropdownRule() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rng = ss.getRangeByName('DropdownLookupEvents');
  if (!rng) {
    throw new Error('Named range "DropdownLookupEvents" was not found. Please create it or check spelling.');
  }
  return SpreadsheetApp.newDataValidation()
    .requireValueInRange(rng, true)   // showDropdown = true
    .setAllowInvalid(true)
    .build();
}

/**
 * Builds a data validation rule pointing to the named range "DropdownLookupExperimentEvents".
 * Shows a dropdown and disallows invalid values.
 */
function getExperimentEventsDropdownRule() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rng = ss.getRangeByName('DropdownLookupExperimentEvents');
  if (!rng) {
    throw new Error('Named range "DropdownLookupExperimentEvents" was not found. Please create it or check spelling.');
  }
  return SpreadsheetApp.newDataValidation()
    .requireValueInRange(rng, true)   // showDropdown = true
    .setAllowInvalid(true)
    .build();
}

/**
 * Builds a data validation rule pointing to the named range "DropdownLookupParamsExperimentVariant".
 */
function getExperimentVariantParamDropdownRule() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rng = ss.getRangeByName('DropdownLookupParamsExperimentVariant');
  if (!rng) {
    throw new Error('Named range "DropdownLookupParamsExperimentVariant" was not found. Please create it or check spelling.');
  }
  return SpreadsheetApp.newDataValidation()
    .requireValueInRange(rng, true)
    .setAllowInvalid(true)
    .build();
}

/**
 * Builds a data validation rule pointing to the named range "DropdownLookupParamsExperimentValue".
 */
function getExperimentEventValueParamDropdownRule() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rng = ss.getRangeByName('DropdownLookupParamsExperimentValue');
  if (!rng) {
    throw new Error('Named range "DropdownLookupParamsExperimentValue" was not found. Please create it or check spelling.');
  }
  return SpreadsheetApp.newDataValidation()
    .requireValueInRange(rng, true)
    .setAllowInvalid(true)
    .build();
}

/**
 * Read the named range "DropdownLookupFilterFields" (Scope in col A, Field in col B)
 * and return a map: { event: [...], user: [...], column: [...] }
 */
function getFilterFieldsMap() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rng = ss.getRangeByName('DropdownLookupFilterFields');
  if (!rng) {
    throw new Error('Named range "DropdownLookupFilterFields" not found.');
  }
  const values = rng.getValues(); // [[Scope, Field], ...]
  const map = { event: [], user: [], column: [] };

  for (let i = 0; i < values.length; i++) {
    const scopeRaw = String(values[i][0] || '').trim();
    const field = String(values[i][1] || '').trim();
    if (!scopeRaw || !field) continue;

    const key = scopeRaw.toLowerCase(); // "event" | "user" | "column"
    if (map[key]) map[key].push(field);
  }

  // de-duplicate + sort for stability
  Object.keys(map).forEach(k => {
    const set = Array.from(new Set(map[k]));
    set.sort((a, b) => a.localeCompare(b));
    map[k] = set;
  });

  return map;
}

/**
 * Apply the filter-field validation to one or two rows (depending on "Different").
 * - If no fields exist for the chosen scope, clears validation on that cell.
 */
function applyFilterFieldDropdownForBlock(sheet, topRow) {
  // Is filter enabled?
  const filterOn = String(sheet.getRange(topRow, /* filterColumn */ 18).getValue() || '').toLowerCase() === 'yes';
  if (!filterOn) return;

  const variantSetting = String(sheet.getRange(topRow, /* variantSettingsColumn */ 17).getValue() || 'Same');
  const isDifferent = (variantSetting === 'Different');

  const map = (function () {
    try { return getFilterFieldsMap(); } catch (e) { return null; }
  })();

  const height = isDifferent ? 2 : 1;
  for (let r = 0; r < height; r++) {
    const row = topRow + r;
    const scope = String(sheet.getRange(row, /* filterScopeColumn */ 22).getValue() || '').toLowerCase();
    const fields = (map && map[scope]) ? map[scope] : [];

    const target = sheet.getRange(row, /* filterFieldColumn */ 23);

    if (fields.length > 0) {
      const rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(fields, true) // show dropdown
        .setAllowInvalid(false)
        .build();
      target.setDataValidation(rule);

      // If current value isn’t in the updated options, clear it to avoid invalid state
      const cur = String(target.getValue() || '');
      if (cur && fields.indexOf(cur) === -1) {
        target.clearContent();
      }
    } else {
      // No fields for this scope → clear validation (and optionally content)
      target.clearDataValidations();
      // target.clearContent(); // uncomment if you prefer to clear the value too
    }
  }
}

function insertRowsAndMerge() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();

  const lastRow = sheet.getLastRow();

  // 1) Insert 2 rows after firsRow (these become rows 6 and 7)
  sheet.insertRowsAfter(firstRow-1, 2);

  // 2) Merge cells as required:
  applyMergesForBlock(firstRow);

  // Insert a checkbox into merged Column dateComparisonColumn and default to unchecked
  const dateCompareCell = sheet.getRange(firstRow, dateComparisonColumn);
    dateCompareCell.insertCheckboxes();
    dateCompareCell.setValue(false);

  // Insert a checkbox into merged Column conversionEventCountColumn and default to unchecked
  const conversionCountCell = sheet.getRange(firstRow, conversionEventCountColumn);
    conversionCountCell.insertCheckboxes();
    conversionCountCell.setValue(false);

  // Apply the Conversion Event dropdown (Event Names) to the merged 2-row cell in Column G
  try {
    const eventsRule = getEventsDropdownRule();
    sheet.getRange(firstRow, conversionEventColumn, 2, 1).setDataValidation(eventsRule);
  } catch (err) {
    // Non-fatal: keeps the rest of the setup working if the named range is missing
    SpreadsheetApp.getActive().toast(String(err), "Conversion Event dropdown", 5);
  }

  // Apply the Experiment Event Name dropdown to the merged 2-row cell in Column Y
  try {
    const expEventsRule = getExperimentEventsDropdownRule();
    sheet.getRange(firstRow, experimentEventNameColumn, 2, 1).setDataValidation(expEventsRule);
  } catch (err) {
    SpreadsheetApp.getActive().toast(String(err), "Experiment Event dropdown", 5);
  }

  // Apply the Experiment Variant Parameter dropdown to Column Z (merged 2-row cell)
  try {
    const expVariantRule = getExperimentVariantParamDropdownRule();
    sheet.getRange(firstRow, experimentVariantParameterColumn, 2, 1).setDataValidation(expVariantRule);
  } catch (err) {
    SpreadsheetApp.getActive().toast(String(err), "Experiment Variant dropdown", 5);
  }

  // Apply the Experiment Event Value Parameter dropdown to Column AA (merged 2-row cell)
  try {
    const expEventValueRule = getExperimentEventValueParamDropdownRule();
    sheet.getRange(firstRow, experimentEventValueParameterColumn, 2, 1).setDataValidation(expEventValueRule);
  } catch (err) {
    SpreadsheetApp.getActive().toast(String(err), "Experiment Event Value dropdown", 5);
  }

  // 3) Set background colors and text styles for the new rows
  sheet.getRange(firstRow, 1, 1, sheet.getMaxColumns()).setBackground('#ffffff'); // Row 5 → white
  sheet.getRange(firstRow+1, 1, 1, sheet.getMaxColumns()-1).setBackground('#f1f1f1'); // Row 6 → light grey
  // Override the date columns (B:C) to white for BOTH rows in the default merged state
  sheet.getRange(firstRow, dateStartColumn, 2, 2).setBackground('#ffffff');
  sheet.getRange(firstRow, 1, 1, sheet.getMaxColumns())
       .setFontColor('#000000')
       .setFontWeight('normal');
  sheet.getRange(firstRow+1, 1, 1, sheet.getMaxColumns())
       .setFontColor('#000000')
       .setFontWeight('normal');
  sheet.getRange(firstRow, filterAdvancedColumn, 1, 6).setBackground("#bfbfbf");

  // 4) Set up data validation (adjust columns as needed)
  const analyzeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Yes", "Update", "No"], true)
    .build();
  const yesNoRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Yes", "No"], true)
    .build();
  const hypothesisRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["One-sided", "Two-sided"], true)
    .build();
  const confidenceRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["90%", "95%", "99%"], true)
    .build();
  const scopeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["User", "Session"], true)
    .build();
  const identitySourceRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["DEVICE_ID", "USER_ID_ONLY", "USER_ID_OR_DEVICE_ID"], true)
    .build();
  const variantSettingsRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Same", "Different"], true)
    .build();
  const userOverLapRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["First Exposure", "Last Exposure", "Exclude", "Credit Both"], true)
    .build();

  sheet.getRange(firstRow, analyzeTestColumn, 2, 1).setDataValidation(analyzeRule);
  sheet.getRange(firstRow, eventValueTestColumn, 2, 1).setDataValidation(yesNoRule);
  sheet.getRange(firstRow, hypothesisColumn, 2, 1).setDataValidation(hypothesisRule);
  sheet.getRange(firstRow, confidenceColumn, 2, 1).setDataValidation(confidenceRule);
  sheet.getRange(firstRow, scopeColumn, 2, 1).setDataValidation(scopeRule);
  sheet.getRange(firstRow, identitySourceColumn, 2, 1).setDataValidation(identitySourceRule);
  sheet.getRange(firstRow, variantSettingsColumn, 2, 1).setDataValidation(variantSettingsRule);
  sheet.getRange(firstRow, filterColumn, 2, 1).setDataValidation(yesNoRule);
  sheet.getRange(firstRow, userOverlapColumn, 2, 1).setDataValidation(userOverLapRule);
  
  // Set default values for the merged drop-down cells
  
  sheet.getRange(firstRow, analyzeTestColumn).setValue("No").setBackground("#ffcfc9");
  sheet.getRange(firstRow, eventValueTestColumn).setValue("No");
  sheet.getRange(firstRow, hypothesisColumn).setValue("Two-sided");
  sheet.getRange(firstRow, confidenceColumn).setValue("95%");
  sheet.getRange(firstRow, scopeColumn).setValue("User");
  sheet.getRange(firstRow, filterColumn).setValue("No");
  sheet.getRange(firstRow, identitySourceColumn).setValue("DEVICE_ID");
  sheet.getRange(firstRow, variantSettingsColumn).setValue("Same");
  sheet.getRange(firstRow, userOverlapColumn).setValue("Exclude");

  // 5) Insert a checkbox into merged Column editExperimentColumn
  const mergedM = sheet.getRange(firstRow, editExperimentColumn);
  mergedM.insertCheckboxes();

  // 6) Make dateStartColumn and dateEndColumn a date field with a date picker (formatted as YYYY-MM-DD)
  const dateValidation = SpreadsheetApp.newDataValidation().requireDate().build();
  const dateRange  = sheet.getRange(firstRow, dateStartColumn, 2, 1);
   dateRange2 = sheet.getRange(firstRow, dateEndColumn,   2, 1);

  function toMidnight(d) {
    if (!(d instanceof Date)) return d;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()); // 00:00 local
  }
  function addDays(d, days) {
    const x = new Date(d);
    x.setDate(x.getDate() + days);
    return x;
  }

  const yesterday = addDays(toMidnight(new Date()), -1);
  const historicDate = addDays(yesterday, -14); // yesterday - 14

  dateRange.setDataValidation(dateValidation).setNumberFormat("yyyy-MM-dd");
  dateRange2.setDataValidation(dateValidation).setNumberFormat("yyyy-MM-dd");

  // start = historicDate, end = yesterday
  sheet.getRange(firstRow, dateStartColumn).setValue(historicDate);
  sheet.getRange(firstRow, dateEndColumn).setValue(yesterday);

  // 7) Draw a thick black bottom border across the 2-row block (columns A to M)
  sheet.getRange(firstRow, 1, 2, sheet.getMaxColumns()).setFontSize(9);
  sheet.getRange(firstRow, 1, 2, editExperimentColumn)
       .setBorder(false, false, true, false, false, false, 'black', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
       
  // 8) Insert the ID number in merged Column A:
  // Look at the cell below (row 7, col A). If it has a numeric value, new ID is that value + 1.
  // Otherwise, new ID is 1.
  const belowCell = sheet.getRange(firstRow + 2, 1);
  const belowValue = belowCell.getValue();

  let newID;
  if (belowValue === "" || isNaN(belowValue)) {
    newID = 1;
  } else {
    newID = parseInt(belowValue, 10) + 1;
  }

  // Display as 01, 02, 03... (but keep numeric value)
  const idCell = sheet.getRange(firstRow, 1);
  idCell.setNumberFormat("00");  // <— this is the key
  idCell.setValue(newID);

  // 9) Insert Variant name examples
  sheet.getRange(firstRow, variantNameColumn).setValue("Variant A");
  sheet.getRange(firstRow+1, variantNameColumn).setValue("Variant B");
  sheet.getRange(firstRow, experimentEventNameColumn).setValue(ss.getRangeByName("SettingsExperimentEventName").getValue());
  sheet.getRange(firstRow+1, experimentEventNameColumn).setValue(ss.getRangeByName("SettingsExperimentEventName").getValue());
  sheet.getRange(firstRow, experimentVariantParameterColumn).setValue(ss.getRangeByName("SettingsExperimentVariantString").getValue());
  sheet.getRange(firstRow+1, experimentVariantParameterColumn).setValue(ss.getRangeByName("SettingsExperimentVariantString").getValue());
  sheet.getRange(firstRow, experimentEventValueParameterColumn).setValue(ss.getRangeByName("SettingsExperimentEventValueParameter").getValue());

  // Ensure Event Value Test UI matches the default ("No") state
  enforceEventValueForBlock(sheet, firstRow);
}

function enforceScopeForIdentitySource(sheet, topRow) {
  // Read the identity source for this 2-row block
  const identity = String(sheet.getRange(topRow, identitySourceColumn).getValue() || "").toUpperCase();

  // Build the appropriate scope rule
  let scopeRule;
  if (identity && identity !== "DEVICE_ID") {
    // Only "User" allowed if not DEVICE_ID
    scopeRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(["User"], true)
      .build();
  } else {
    // Default: User or Session
    scopeRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(["User", "Session"], true)
      .build();
  }

  // Apply to the merged 2-row scope cell (column scopeColumn)
  const scopeRange = sheet.getRange(topRow, scopeColumn, 2, 1);
  scopeRange.setDataValidation(scopeRule);

  // Ensure current value is valid for the new rule
  const currentScope = String(sheet.getRange(topRow, scopeColumn).getValue() || "");
  if (identity && identity !== "DEVICE_ID") {
    // Force to "User" if invalid/empty
    if (currentScope !== "User") {
      sheet.getRange(topRow, scopeColumn).setValue("User");
    }
  } else {
    // If DEVICE_ID and empty, keep your default of "User"
    if (!currentScope) {
      sheet.getRange(topRow, scopeColumn).setValue("User");
    }
  }
}

function getExperimentBlockTopRow_(row) {
  return ((row - firstRow) % 2 === 0) ? row : (row - 1);
}

function getExperimentKey_(sheet, topRow) {
  // Prefer ID (col A), else experiment name (col E), else row number.
  var idStr = String(sheet.getRange(topRow, idColumn).getValue() || '').trim();
  var nameStr = String(sheet.getRange(topRow, experimentNameColumn).getValue() || '').trim();
  var key = idStr || nameStr || String(topRow);
  return String(sheet.getSheetId()) + ':' + key;
}

function storeFilterDropdownSnapshotForBlock_(sheet, topRow) {
  var props = PropertiesService.getDocumentProperties();
  var baseKey = 'advLock.filterDropdown.' + getExperimentKey_(sheet, topRow);

  // filterColumn is merged, so top cell is the value
  var v = String(sheet.getRange(topRow, filterColumn).getValue() || '');
  props.setProperty(baseKey, v);
}

function getStoredFilterDropdown_(sheet, topRow) {
  var props = PropertiesService.getDocumentProperties();
  var baseKey = 'advLock.filterDropdown.' + getExperimentKey_(sheet, topRow);
  return props.getProperty(baseKey);
}

function onEdit(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const editedRange = e.range;
  const editedRow = editedRange.getRow();
  const editedCol = editedRange.getColumn();

    // --- Lock Filter dropdown (filterColumn) when Advanced Filters is ON ---
  if (editedRow >= firstRow && editedCol === filterColumn) {
    var topRowLock = getExperimentBlockTopRow_(editedRow);
    var advOn = !!sheet.getRange(topRowLock, filterAdvancedColumn).getValue();

    if (advOn) {
      // Try stored snapshot; fall back to oldValue; fall back to current "Yes"
      var prev = getStoredFilterDropdown_(sheet, topRowLock);
      if (prev === null || typeof prev === 'undefined') {
        if (typeof e.oldValue !== 'undefined') prev = e.oldValue;
        else prev = 'Yes';
      }

      // filterColumn is merged → set value in the top cell
      sheet.getRange(topRowLock, filterColumn).setValue(prev);

      SpreadsheetApp.getActive().toast(
        'Advanced Filters is ON — turn it OFF before changing "Filter".',
        'Advanced Filters',
        5
      );
      return;
    } else {
      // Advanced is OFF → keep snapshot updated
      storeFilterDropdownSnapshotForBlock_(sheet, topRowLock);
      // do not return
    }
  }

  // --- Sheet router: handle Filters sheet separately and exit early
  if (sheet.getName() === filtersSheetName) {
    // React when Filter Scope (col 6) changes on real data rows
    if (editedRow >= filtersDataStartRow && editedCol === 6 && typeof filtersApplyFilterFieldDropdownForRow === 'function') {
      filtersApplyFilterFieldDropdownForRow(sheet, editedRow);
    }
    return; // IMPORTANT: don't execute Experiments logic on the Filters sheet
  }

  if (editedRow >= firstRow && (editedCol === dateStartColumn || editedCol === dateEndColumn)) {
    const v = editedRange.getValue();
    if (v instanceof Date) {
      const norm = new Date(v.getFullYear(), v.getMonth(), v.getDate());
      editedRange.setValue(norm).setNumberFormat("yyyy-MM-dd");
    }
    // don't return; let other handlers run if needed
  }

  // --- Case: Toggle date merge when dateComparisonColumn checkbox is edited ---
  if (editedCol === dateComparisonColumn && editedRow >= firstRow) {
    const row = editedRow;
    const topRow = ((row - firstRow) % 2 === 0) ? row : row - 1;

    const isChecked = !!editedRange.getValue(); // TRUE = unmerge
    setDateMergeForBlock(sheet, topRow, /* shouldMerge */ !isChecked);

    // Color only the date columns (B & C) according to the state
    colorDatesForBlock(sheet, topRow, isChecked);

    return;
  }

  // If Identity Source changed, update scope rule for this 2-row block
  if (editedCol === identitySourceColumn && editedRow >= firstRow) {
    const row = editedRow;
    const topRow = ((row - firstRow) % 2 === 0) ? row : row - 1;
    enforceScopeForIdentitySource(sheet, topRow);
    return; // handled
  }
 
  // --- Case 1: Check if the edited cell is the dropdown to show/hide columns ---
  const advRange = ss.getRangeByName("ExperimentsAdvSettingsShowHide");
  if (advRange && editedRange.getA1Notation() === advRange.getA1Notation()) {
    const dropdownValue = editedRange.getValue();
    if (dropdownValue === "Hide") {
      sheet.hideColumns(scopeColumn, 11);
    } else if (dropdownValue === "Show") {
      sheet.showColumns(scopeColumn, 11);
    }
    return;
  }

  // --- Case 2: Generate Variant String ---
  // Trigger when editing either experimentNameColumn or variantNameColumn
  if (editedCol === experimentNameColumn || editedCol === variantNameColumn) {
    // Check if automatic generation is enabled
    const genSetting = ss.getRangeByName("SettingsGenerateExpVariantString").getValue();
    if (String(genSetting).toLowerCase() === "yes") {
      let parts = [];
      const toolNameInclude = ss.getRangeByName("SettingsToolNameInclude").getValue();
      const divider = ss.getRangeByName("SettingsDivider").getValue();
      if (String(toolNameInclude).toLowerCase() === "yes") {
        const toolName = ss.getRangeByName("SettingsToolName").getValue();
        if (toolName !== "" && toolName !== null) {
          parts.push(toolName);
        }
      }
      // For Column experimentNameColumn (merged) we always get the top cell of the 2-row block.
      const row = editedRow;
      const topRow = ((row - firstRow) % 2 === 0) ? row : row - 1;
      const valueD = sheet.getRange(topRow, experimentNameColumn).getValue();
      if (valueD !== "" && valueD !== null) {
        parts.push(valueD);
      }
      // For Column E (unmerged), we get the value from the edited row.
      const valueE = sheet.getRange(row, variantNameColumn).getValue();
      if (valueE !== "" && valueE !== null) {
        parts.push(valueE);
      }
      const result = parts.join(divider);
      sheet.getRange(row, experimentVariantParameterColumn).setValue(result);
    }
  }
  
  // --- Case 3: Handle dropdown in filterColumn for formatting columns
  if (editedCol === filterColumn && editedRow >= firstRow) {
    const topRow = ((editedRow - firstRow) % 2 === 0) ? editedRow : editedRow - 1;

    const turnedOn = String(e.range.getValue() || '').toLowerCase() === 'yes';
    if (turnedOn) {
      // Force default Scope = "Event" when filtering is activated
      const variantSetting = String(sheet.getRange(topRow, variantSettingsColumn).getValue() || 'Same');
      const isDifferent = (variantSetting === 'Different');

      // Apply to top row; if Different, also apply to bottom row
      sheet.getRange(topRow, filterScopeColumn).setValue('Event');
      if (isDifferent) {
        sheet.getRange(topRow + 1, filterScopeColumn).setValue('Event');
      }
    }

    // Apply/refresh the rest of the filter UI
    enforceFilterForBlock(sheet, topRow);

    // After enforcing, (re)bind the Field dropdown(s) to the chosen Scope(s)
    // This ensures the Field list appears immediately after setting "Event".
    if (typeof applyFilterFieldDropdownForBlock === 'function') {
      applyFilterFieldDropdownForBlock(sheet, topRow);
    }
    return;
  }

  // When the user changes Filter Scope, refresh the Field dropdown(s) for that block
  if (editedCol === filterScopeColumn && editedRow >= firstRow) {
    const topRow = ((editedRow - firstRow) % 2 === 0) ? editedRow : editedRow - 1;
    applyFilterFieldDropdownForBlock(sheet, topRow);
    return;
  }
  
  if (e.range.getColumn() === analyzeTestColumn) {
    const v = String(e.range.getValue() || "");
    if (v === "Yes") {
      e.range.setBackground("#d4edbc"); // green
    } else if (v === "Update") {
      e.range.setBackground("#fff7bf"); // light yellow
    } else if (v === "No") {
      e.range.setBackground("#ffcfc9"); // light red
    } else {
      e.range.setBackground(null);
    }
  }

  if (e.range.getColumn() === eventValueTestColumn && e.range.getRow() >= firstRow) {
    const val = String(e.range.getValue() || "");
    if (val === "Yes") {
      e.range.setBackground("#eafcd7"); // light green
    } else if (val === "No") {
      e.range.setBackground(null);
    } else {
      e.range.setBackground(null);
    }

  // Apply/refresh the Event Value UI for this 2-row block
  const topRow = ((e.range.getRow() - firstRow) % 2 === 0) ? e.range.getRow() : e.range.getRow() - 1;
  enforceEventValueForBlock(sheet, topRow);
  return;
}


  // Toggle per-variant settings (Same/Different)
  if (editedCol === variantSettingsColumn && editedRow >= firstRow) {
    const topRow = ((editedRow - firstRow) % 2 === 0) ? editedRow : editedRow - 1;

    enforceVariantSettingsForBlock(sheet, topRow);
    // ensure filter dropdowns align with the (un)merged state
    enforceFilterForBlock(sheet, topRow);
    return;
  }

  if (editedCol === variantSettingsColumn && editedRow >= firstRow) {
    const topRow = ((editedRow - firstRow) % 2 === 0) ? editedRow : editedRow - 1;

    enforceVariantSettingsForBlock(sheet, topRow);
    enforceFilterForBlock(sheet, topRow);
    enforceEventValueForBlock(sheet, topRow); // <-- add this line
    return;
  }

  // --- Filters integration: seed Filters rows when Advanced toggles or Variant Settings change
  if (editedRow >= firstRow) {
    const topRow = ((editedRow - firstRow) % 2 === 0) ? editedRow : (editedRow - 1);

    const useFiltersOn = (String(sheet.getRange(topRow, filterColumn).getValue() || '').toLowerCase() === 'yes');
    const advCellVal = !!sheet.getRange(topRow, filterAdvancedColumn).getValue();

    const isAdvancedToggle  = (editedCol === filterAdvancedColumn);
    const isVariantSettings = (editedCol === variantSettingsColumn);
    const isSimpleFilterCol = (editedCol === filterTypeColumn ||
                                editedCol === filterOnValueColumn ||
                                editedCol === filterScopeColumn ||
                                editedCol === filterFieldColumn ||
                                editedCol === filterValueColumn);

    // Identify this experiment using both numeric ID and name (safer)
    const idStr = String(sheet.getRange(topRow, idColumn).getValue() || '').trim();
    const nameStr = String(sheet.getRange(topRow, experimentNameColumn).getValue() || '').trim();
    const idKeys = [];
    if (idStr) idKeys.push(idStr);
    if (nameStr && nameStr !== idStr) idKeys.push(nameStr);

    if (isAdvancedToggle) {
      if (useFiltersOn && advCellVal) {
        storeFilterDropdownSnapshotForBlock_(sheet, topRow);
        // Advanced turned ON → seed (or refresh missing) rows
        filtersSeedFromExperimentBlock(sheet, topRow, { useIdFrom: 'id' });
        filtersBtnFormatBlocks();
      } else if (useFiltersOn && !advCellVal) {
        // Advanced turned OFF → delete all Filters rows for this experiment
        const removed = filtersDeleteRowsForExperiment(idKeys);
        SpreadsheetApp.getActive().toast('Advanced OFF → removed ' + removed + ' filter row' + (removed===1?'':'s') + ' for ' + (nameStr || idStr) + '.');
      }
    } else if (useFiltersOn && advCellVal && (isVariantSettings || isSimpleFilterCol)) {
      // While Advanced is ON, keep seeded rows in sync when variant settings or legacy filter cells change
      filtersSeedFromExperimentBlock(sheet, topRow, { useIdFrom: 'id' });
    }
  }

  // If editing on the Filters sheet, re-bind Filter Field dropdown when Scope changes
  if (sheet.getName() === filtersSheetName && editedRow >= filtersDataStartRow) {
    if (editedCol === 6) { // Filter Scope column in Filters sheet
      filtersApplyFilterFieldDropdownForRow(sheet, editedRow);
      return;
    }
  }

  // Show or hide row in Settings Sheet.
  const settingsCell = ss.getRangeByName('SettingsAnalyticsTool');
  if (!settingsCell || !e || !e.range) return;

  // Only run when the named range cell is edited (handles multi-cell named ranges too)
  const r = e.range, s = settingsCell;
  const sameSheet = r.getSheet().getSheetId() === s.getSheet().getSheetId();
  const inRow = r.getRow() >= s.getRow() && r.getRow() <= s.getLastRow();
  const inCol = r.getColumn() >= s.getColumn() && r.getColumn() <= s.getLastColumn();

  if (sameSheet && inRow && inCol) {
    updateAnalyticsToolText();
  }
}

function setDateMergeForBlock(sheet, topRow, shouldMerge) {
  const startRange = sheet.getRange(topRow, dateStartColumn, 2, 1);
  const endRange = sheet.getRange(topRow, dateEndColumn,   2, 1);

  // Helpers
  function toMidnight(d) {
    if (!(d instanceof Date)) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function addDays(d, days) {
    const x = new Date(d);
    x.setDate(x.getDate() + days);
    return x;
  }
  function diffDaysInclusive(a, b) {
    const MS = 24 * 60 * 60 * 1000;
    return Math.round((b - a) / MS) + 1;
  }

  if (shouldMerge) {
    // MERGE BACK: keep the BOTTOM value in the merged cell
    // capture bottom values first
    const bottomStartKeep = toMidnight(sheet.getRange(topRow + 1, dateStartColumn).getValue());
    const bottomEndKeep = toMidnight(sheet.getRange(topRow + 1, dateEndColumn).getValue());

    // do the merge (Google Sheets will keep the top by default)
    startRange.merge();
    endRange.merge();

    // overwrite merged (top) cell with the bottom values (fallback to existing top if bottom empty)
    const topStartExisting = toMidnight(sheet.getRange(topRow, dateStartColumn).getValue());
    const topEndExisting = toMidnight(sheet.getRange(topRow, dateEndColumn).getValue());
    sheet.getRange(topRow, dateStartColumn).setValue(bottomStartKeep || topStartExisting || '');
    sheet.getRange(topRow, dateEndColumn).setValue(bottomEndKeep   || topEndExisting   || '');

  } else {
    // UNMERGE: A (top row) = BEFORE, B (bottom row) = AFTER (original merged dates)
    startRange.breakApart();
    endRange.breakApart();

    // The (previous) merged top cell holds the AFTER window
    const afterStart = toMidnight(sheet.getRange(topRow, dateStartColumn).getValue());
    const afterEnd = toMidnight(sheet.getRange(topRow, dateEndColumn).getValue());

    if (afterStart && afterEnd && afterStart <= afterEnd) {
      const len = diffDaysInclusive(afterStart, afterEnd);
      const beforeEnd = addDays(afterStart, -1);
      const beforeStart = addDays(beforeEnd, -(len - 1));

      // Assign BEFORE → top row (A), AFTER → bottom row (B)
      sheet.getRange(topRow, dateStartColumn).setValue(beforeStart);
      sheet.getRange(topRow, dateEndColumn).setValue(beforeEnd);
      sheet.getRange(topRow + 1, dateStartColumn).setValue(afterStart);
      sheet.getRange(topRow + 1, dateEndColumn).setValue(afterEnd);
    }
  }

  // Keep validation & formatting on both rows
  const dateValidation = SpreadsheetApp.newDataValidation().requireDate().build();
  sheet.getRange(topRow, dateStartColumn, 2, 1)
       .setDataValidation(dateValidation)
       .setNumberFormat("yyyy-MM-dd");
  sheet.getRange(topRow, dateEndColumn, 2, 1)
       .setDataValidation(dateValidation)
       .setNumberFormat("yyyy-MM-dd");

  // Normalize any existing date values to midnight (so clicking shows YYYY-MM-DD)
  const vals = sheet.getRange(topRow, dateStartColumn, 2, 2).getValues(); // B:C over 2 rows
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      if (vals[i][j] instanceof Date) {
        const d = vals[i][j];
        vals[i][j] = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      }
    }
  }
  sheet.getRange(topRow, dateStartColumn, 2, 2).setValues(vals);
}

function colorDatesForBlock(sheet, topRow, isChecked) {
  if (isChecked) {
    // Unmerged mode: top row white, bottom row light grey
    sheet.getRange(topRow, dateStartColumn, 1, 2).setBackground('#ffffff'); // B:C top
    sheet.getRange(topRow + 1, dateStartColumn, 1, 2).setBackground('#f1f1f1'); // B:C bottom
  } else {
    // Merged mode: both rows white
    sheet.getRange(topRow, dateStartColumn, 2, 2).setBackground('#ffffff'); // B:C both rows
  }
}

function enforceVariantSettingsForBlock(sheet, topRow) {
  const setting = String(sheet.getRange(topRow, variantSettingsColumn).getValue() || "Same");
  const makeDifferent = setting === "Different";

  // Columns to (un)merge when setting = "Different"
  const targetCols = [
    conversionEventColumn,
    filterTypeColumn,
    filterOnValueColumn,
    filterScopeColumn,
    filterFieldColumn,
    filterValueColumn,
    experimentEventNameColumn,
    experimentVariantParameterColumn,
    experimentEventValueParameterColumn
  ];

  // Read whether filter is enabled ("Yes") — if so, we apply dropdowns
  const filterEnabled = String(sheet.getRange(topRow, filterColumn).getValue() || "").toLowerCase() === "yes";

  // Reusable validations (only applied where they exist conceptually)
  const eventsRule = (function(){ 
    try { return getEventsDropdownRule(); } 
    catch(e){ return null; } 
  })();

  const expEventsRule = (function(){
    try { return getExperimentEventsDropdownRule(); }
    catch(e){ return null; }
  })();

  const expVariantRule = (function(){
    try { return getExperimentVariantParamDropdownRule(); }
    catch(e){ return null; }
  })();

  const expEventValueRule = (function(){
    try { return getExperimentEventValueParamDropdownRule(); }
    catch(e){ return null; }
  })();

  const filterTypeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Include", "Exclude"], true).build();
  const filterOnValueRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Both", "Experiment", "Conversion"], true).build();
  const filterScopeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Event", "User", "Column"], true).build();

  if (makeDifferent) {
    // Unmerge each target column, copy top value down, style bottom, and add per-row validation where relevant
    targetCols.forEach((col) => {
      const twoRowRange = sheet.getRange(topRow, col, 2, 1);
      twoRowRange.breakApart();

      // Apply dropdown to BOTH rows when column is Conversion Event
    if (eventsRule && col === conversionEventColumn) {
      sheet.getRange(topRow, col).setDataValidation(eventsRule);
      sheet.getRange(topRow + 1, col).setDataValidation(eventsRule);
    }

    // Apply Experiment Event Name dropdown to BOTH rows when unmerged
    if (expEventsRule && col === experimentEventNameColumn) {
      sheet.getRange(topRow, col).setDataValidation(expEventsRule);
      sheet.getRange(topRow + 1, col).setDataValidation(expEventsRule);
    }

    // Apply Experiment Variant Parameter dropdown to BOTH rows when unmerged
    if (expVariantRule && col === experimentVariantParameterColumn) {
      sheet.getRange(topRow, col).setDataValidation(expVariantRule);
      sheet.getRange(topRow + 1, col).setDataValidation(expVariantRule);
    }

    // Apply Experiment Event Value Parameter dropdown to BOTH rows when unmerged
    if (expEventValueRule && col === experimentEventValueParameterColumn) {
      sheet.getRange(topRow, col).setDataValidation(expEventValueRule);
      sheet.getRange(topRow + 1, col).setDataValidation(expEventValueRule);
    }

    // Copy top value to bottom (always, per your requirement)
    const topVal = sheet.getRange(topRow, col).getValue();
    sheet.getRange(topRow + 1, col).setValue(topVal);

    // Apply dropdowns to BOTH rows when filter is enabled and the column supports it
    if (filterEnabled) {
      // After applying filter type/on/scope rules, bind the Field dropdown to the chosen Scope(s)
      applyFilterFieldDropdownForBlock(sheet, topRow);

      if (col === filterTypeColumn) {
        sheet.getRange(topRow, col).setDataValidation(filterTypeRule);
        sheet.getRange(topRow + 1, col).setDataValidation(filterTypeRule);
      } else if (col === filterOnValueColumn) {
        sheet.getRange(topRow, col).setDataValidation(filterOnValueRule);
        sheet.getRange(topRow + 1, col).setDataValidation(filterOnValueRule);
      } else if (col === filterScopeColumn) {
        sheet.getRange(topRow, col).setDataValidation(filterScopeRule);
        sheet.getRange(topRow + 1, col).setDataValidation(filterScopeRule);
      }
    }

    // Bottom row cell should be light grey
    sheet.getRange(topRow + 1, col).setBackground("#f1f1f1");
  });
  } else {
    // Merge the columns back; keep top value (merge keeps top-left by default)
    targetCols.forEach((col) => {
      const twoRowRange = sheet.getRange(topRow, col, 2, 1);
      twoRowRange.merge();

    // Re-apply dropdown to merged cell for Conversion Event
    if (eventsRule && col === conversionEventColumn) {
      sheet.getRange(topRow, col).setDataValidation(eventsRule);
    }

    // Re-apply Experiment Event Name dropdown to the merged cell
    if (expEventsRule && col === experimentEventNameColumn) {
      sheet.getRange(topRow, col).setDataValidation(expEventsRule);
    }

    // Re-apply Experiment Variant Parameter dropdown to the merged cell
    if (expVariantRule && col === experimentVariantParameterColumn) {
      sheet.getRange(topRow, col).setDataValidation(expVariantRule);
    }

    // Re-apply Experiment Event Value Parameter dropdown to the merged cell
    if (expEventValueRule && col === experimentEventValueParameterColumn) {
      sheet.getRange(topRow, col).setDataValidation(expEventValueRule);
    }

    // Re-apply a single validation to the merged cell if filter is enabled and the column supports it
    if (filterEnabled) {
      if (col === filterTypeColumn) {
        sheet.getRange(topRow, col).setDataValidation(filterTypeRule);
      } else if (col === filterOnValueColumn) {
        sheet.getRange(topRow, col).setDataValidation(filterOnValueRule);
      } else if (col === filterScopeColumn) {
        sheet.getRange(topRow, col).setDataValidation(filterScopeRule);
      }
    }
  });
  }
}

function updateAnalyticsToolText(e) {
  const ss = e && e.source ? e.source : SpreadsheetApp.getActive();
  const settingsCell = ss.getRangeByName('SettingsAnalyticsTool');
  if (!settingsCell) return;

  // Only react when the dropdown cell itself was edited
  if (e && e.range) {
    const edited = e.range;
    const sameSheet = edited.getSheet().getSheetId() === settingsCell.getSheet().getSheetId();
    const sameRow = edited.getRow() === settingsCell.getRow();
    const sameCol = edited.getColumn() === settingsCell.getColumn();
    if (!(sameSheet && sameRow && sameCol)) return;
  }

  const val = String(settingsCell.getDisplayValue()).trim().toLowerCase();

  const targetRowDataSet = settingsCell.getRow() + 1;
  const targetRowTable = settingsCell.getRow() + 2;
  const targetCol = settingsCell.getColumn() + 1;
  const messageCellDataSet = settingsCell.getSheet().getRange(targetRowDataSet, targetCol);
  const messageCellTable = settingsCell.getSheet().getRange(targetRowTable, targetCol);

  if (val === 'google analytics') {
    messageCellDataSet.setValue('Data Set ID: analytics_12345 (replace 12345 with your ID).');
    messageCellTable.setValue('Table ID: events_ OR events_fresh_ (GA360 only)');
  } else if (val === 'ga4 dataform') {
    messageCellDataSet.setValue('Data Set ID: superform_outputs_12345 (replace 12345 with your ID).');
    messageCellTable.setValue('Table ID: ga4_events');
  } else if (val === 'amplitude') {
    messageCellDataSet.setValue('Data Set ID: What you called your Amplitude Data Set, ex. amplitude).');
    messageCellTable.setValue('Table ID: EVENTS_12345 (replace 12345 with your ID)');
  } else if (val === 'mixpanel') {
    messageCellDataSet.setValue('Data Set ID: What you called your Mixpanel Data Set, ex. mixpanel).');
    messageCellTable.setValue('Table ID: mp_master_event');
  } else {
    messageCellDataSet.clearContent();
    messageCellTable.clearContent();
  }
}

function enforceFilterForBlock(sheet, topRow) {
  // Read state
  const filterVal = String(sheet.getRange(topRow, filterColumn).getValue() || "").toLowerCase();
  const filterEnabled = (filterVal === "yes");

  const variantSetting = String(sheet.getRange(topRow, variantSettingsColumn).getValue() || "Same");
  const isDifferent = (variantSetting === "Different");

  // Column span: filterType .. filterValue (5 cols)
  const startCol = filterAdvancedColumn;
  const numCols = 6;

  // Validations
  const filterTypeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Include", "Exclude"], true)
    .build();
  const filterOnValueRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Both", "Experiment", "Conversion"], true)
    .build();
  const filterScopeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Event", "User", "Column"], true)
    .build();

  // Utility: set default if empty
  function setDefaultIfEmpty(rng, v) {
    const cur = rng.getValue();
    if (cur === "" || cur === null) rng.setValue(v);
  }

  if (filterEnabled) {
    // Backgrounds
    if (isDifferent) {
      // Top row white, bottom row light grey (to match your per-variant convention)
      sheet.getRange(topRow, startCol, 1, numCols).setBackground("#ffffff");
      sheet.getRange(topRow + 1, startCol, 1, numCols).setBackground("#f1f1f1");
    } else {
      // Merged case: white (applies to merged area visually)
      sheet.getRange(topRow, startCol, 2, numCols).setBackground("#ffffff");
    }

    // Apply validations
    // These three columns have dropdowns; name/value are free text.
    const height = isDifferent ? 2 : 1;
    sheet.getRange(topRow, filterTypeColumn, height, 1).setDataValidation(filterTypeRule);
    sheet.getRange(topRow, filterOnValueColumn, height, 1).setDataValidation(filterOnValueRule);
    sheet.getRange(topRow, filterScopeColumn, height, 1).setDataValidation(filterScopeRule);

      // Insert a checkbox into merged Column filterAdvancedColumn and default to unchecked
    const filterAdvancedCell = sheet.getRange(topRow, filterAdvancedColumn);
      filterAdvancedCell.insertCheckboxes();
      filterAdvancedCell.setValue(false);

    // Defaults (only if empty)
    if (isDifferent) {
      setDefaultIfEmpty(sheet.getRange(topRow, filterTypeColumn), "Include");
      setDefaultIfEmpty(sheet.getRange(topRow + 1, filterTypeColumn), "Include");

      setDefaultIfEmpty(sheet.getRange(topRow, filterOnValueColumn), "Both");
      setDefaultIfEmpty(sheet.getRange(topRow + 1, filterOnValueColumn), "Both");

      setDefaultIfEmpty(sheet.getRange(topRow, filterScopeColumn), "Event");
      setDefaultIfEmpty(sheet.getRange(topRow + 1, filterScopeColumn), "Event");
    } else {
      setDefaultIfEmpty(sheet.getRange(topRow, filterTypeColumn), "Include");
      setDefaultIfEmpty(sheet.getRange(topRow, filterOnValueColumn), "Both");
      setDefaultIfEmpty(sheet.getRange(topRow, filterScopeColumn), "Event");
    }
  } else {
    // Filter disabled → clear validations/content and set grey background on BOTH rows
    const clearRange = sheet.getRange(topRow, startCol, 2, numCols);
    clearRange.setBackground("#bfbfbf");
    clearRange.clearDataValidations();
    clearRange.clearContent();
  }
}

function enforceEventValueForBlock(sheet, topRow) {
  // Read toggle state (Yes/No) and the variant setting (Same/Different)
  const testVal = String(sheet.getRange(topRow, eventValueTestColumn).getValue() || "").toLowerCase();
  const isOn = (testVal === "yes");

  const variantSetting = String(sheet.getRange(topRow, variantSettingsColumn).getValue() || "Same");
  const isDifferent = (variantSetting === "Different");

  // Column to enable/disable (Experiment Event Value Parameter)
  const targetCol = experimentEventValueParameterColumn;
  const height = isDifferent ? 2 : 1;

  // Try to get the dropdown rule (named range backed). If missing, we still handle gray/clear.
  let valueParamRule = null;
  try {
    valueParamRule = getExperimentEventValueParamDropdownRule();
  } catch (err) {
    // Non-fatal. We just won't apply validation if the named range is missing.
    SpreadsheetApp.getActive().toast(String(err), "Event Value dropdown", 5);
  }

  if (isOn) {
    // Active state → white background; apply validation
    // Top row white, bottom row (if Different) light grey to match your two-row convention
    sheet.getRange(topRow, targetCol, 1, 1).setBackground("#ffffff");
    if (isDifferent) {
      sheet.getRange(topRow + 1, targetCol, 1, 1).setBackground("#f1f1f1");
    } else {
      // merged visual area = treat both as white
      sheet.getRange(topRow, targetCol, 2, 1).setBackground("#ffffff");
    }

    if (valueParamRule) {
      sheet.getRange(topRow, targetCol, height, 1).setDataValidation(valueParamRule);
    }
    // Do NOT clear content; keep any existing selection

  } else {
    // Off state → gray background, clear validation & content (same behavior as Filters off)
    const rng = sheet.getRange(topRow, targetCol, 2, 1);
    rng.setBackground("#bfbfbf");
    rng.clearDataValidations();
    rng.clearContent();
  }
}

function copyCheckedExperiments() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(experimentSheetName);
  let lastRow = sheet.getLastRow();
  let idsCopied = [];

  // Helper: normalize date to midnight
  function toMidnight(d) {
    if (!(d instanceof Date)) return d;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  for (let r = lastRow; r >= firstRow; r--) {
    // Only process the top row of each 2-row block
    if ((r - firstRow) % 2 !== 0) continue;

    const checkbox = sheet.getRange(r, editExperimentColumn);
    if (checkbox.getValue() !== true) continue;

    // --- Read original state & values BEFORE copying ---

    // 1) Date comparison + dates
    const originalIsCompared = !!sheet.getRange(r, dateComparisonColumn).getValue(); // TRUE => per-row dates
    const origTopStart = toMidnight(sheet.getRange(r, dateStartColumn).getValue());
    const origTopEnd = toMidnight(sheet.getRange(r, dateEndColumn).getValue());
    const origBotStart = toMidnight(sheet.getRange(r + 1, dateStartColumn).getValue());
    const origBotEnd = toMidnight(sheet.getRange(r + 1, dateEndColumn).getValue());

    // 2) Variant settings (“Same” | “Different”) and Filter Yes/No
    const originalVariantSetting = String(sheet.getRange(r, variantSettingsColumn).getValue() || "Same");
    const isDifferent = (originalVariantSetting === "Different");

    // 3) Row-specific values for DIFFERENT mode
    const origTopConversionEvent = sheet.getRange(r, conversionEventColumn).getValue();
    const origTopFilterType = sheet.getRange(r, filterTypeColumn).getValue();
    const origTopFilterOnValue = sheet.getRange(r, filterOnValueColumn).getValue();
    const origTopFilterScope = sheet.getRange(r, filterScopeColumn).getValue();
    const origTopFilterField = sheet.getRange(r, filterFieldColumn).getValue();
    const origTopFilterValue = sheet.getRange(r, filterValueColumn).getValue();
    const origTop_expEventName = sheet.getRange(r, experimentEventNameColumn).getValue();
    const origTop_expVariantParam = sheet.getRange(r, experimentVariantParameterColumn).getValue();

    const origBotConversionEvent = sheet.getRange(r + 1, conversionEventColumn).getValue();
    const origBotFilterType = sheet.getRange(r + 1, filterTypeColumn).getValue();
    const origBotFilterOnValue = sheet.getRange(r + 1, filterOnValueColumn).getValue();
    const origBotFilterScope = sheet.getRange(r + 1, filterScopeColumn).getValue();
    const origBotFilterField = sheet.getRange(r + 1, filterFieldColumn).getValue();
    const origBotFilterValue = sheet.getRange(r + 1, filterValueColumn).getValue();
    const origBot_expEventName = sheet.getRange(r + 1, experimentEventNameColumn).getValue();
    const origBot_expVariantParam = sheet.getRange(r + 1, experimentVariantParameterColumn).getValue();

    // 4) Copy entire 2-row block values
    const blockRange = sheet.getRange(r, 1, 2, sheet.getLastColumn());
    const blockValues = blockRange.getValues();

    // Insert 2 new rows at the top (above firstRow)
    sheet.insertRowsBefore(firstRow, 2);

    // Paste the block to the newly inserted rows (now at firstRow and firstRow+1)
    const newBlockRange = sheet.getRange(firstRow, 1, 2, sheet.getLastColumn());
    newBlockRange.setValues(blockValues);

    // --- ID handling: use ID from row 8 (keep numeric, display 2 digits)
    const belowIDRaw = sheet.getRange(8, 1).getValue();
    const belowID = parseInt(belowIDRaw, 10);

    const newID = isNaN(belowID) ? 1 : (belowID + 1);

    const idCell = sheet.getRange(firstRow, 1);
    idCell.setNumberFormat("00");   // shows 01, 02, 03...
    idCell.setValue(newID);

    // Clear the "Edit Experiment" checkbox in the new block
    sheet.getRange(firstRow, editExperimentColumn).clearContent();

    // --- Re-apply standard merges for the new block ---
    // (This merges B/C and many columns; we’ll restore unmerged state as needed)
    applyMergesForBlock(firstRow);

    sheet.getRange(firstRow, analyzeTestColumn).setValue("No").setBackground("#ffcfc9");

    // --- Restore date comparison & dates ---
    const dateCompareCell = sheet.getRange(firstRow, dateComparisonColumn);
      dateCompareCell.insertCheckboxes();
      dateCompareCell.setValue(originalIsCompared);

    if (originalIsCompared) {
      // Unmerge and restore both rows’ dates
      setDateMergeForBlock(sheet, firstRow, /* shouldMerge */ false);

      sheet.getRange(firstRow, dateStartColumn).setValue(origTopStart);
      sheet.getRange(firstRow, dateEndColumn).setValue(origTopEnd);
      sheet.getRange(firstRow + 1, dateStartColumn).setValue(origBotStart);
      sheet.getRange(firstRow + 1, dateEndColumn).setValue(origBotEnd);

      colorDatesForBlock(sheet, firstRow, /* isChecked */ true);
    } else {
      // Keep merged; set top values
      sheet.getRange(firstRow, dateStartColumn).setValue(origTopStart);
      sheet.getRange(firstRow, dateEndColumn).setValue(origTopEnd);

      colorDatesForBlock(sheet, firstRow, /* isChecked */ false);
    }

    // Enforce User Overlap options based on dateComparison
    if (typeof enforceUserOverlapForDateComparison === 'function') {
      enforceUserOverlapForDateComparison(sheet, firstRow);
    }

    // Ensure the Variant Settings dropdown exists on the new block
    const variantSettingsRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(["Same", "Different"], true).build();
    sheet.getRange(firstRow, variantSettingsColumn, 2, 1).setDataValidation(variantSettingsRule);
    sheet.getRange(firstRow, variantSettingsColumn).setValue(originalVariantSetting);

    // Apply (un)merge for target columns based on setting
    if (typeof enforceVariantSettingsForBlock === 'function') {
      enforceVariantSettingsForBlock(sheet, firstRow);
    }

    if (isDifferent) {
      // Restore row-specific values for the target columns
      // Top row (A)
      sheet.getRange(firstRow, experimentEventNameColumn).setValue(origTop_expEventName);
      sheet.getRange(firstRow, experimentVariantParameterColumn).setValue(origTop_expVariantParam);

      sheet.getRange(firstRow, conversionEventColumn).setValue(origTopConversionEvent);
      sheet.getRange(firstRow, filterTypeColumn).setValue(origTopFilterType);
      sheet.getRange(firstRow, filterOnValueColumn).setValue(origTopFilterOnValue);
      sheet.getRange(firstRow, filterScopeColumn).setValue(origTopFilterScope);
      sheet.getRange(firstRow, filterFieldColumn).setValue(origTopFilterField);
      sheet.getRange(firstRow, filterValueColumn).setValue(origTopFilterValue);

      // Bottom row (B)
      sheet.getRange(firstRow + 1, experimentEventNameColumn).setValue(origBot_expEventName);
      sheet.getRange(firstRow + 1, experimentVariantParameterColumn).setValue(origBot_expVariantParam);

      sheet.getRange(firstRow + 1, conversionEventColumn).setValue(origBotConversionEvent);
      sheet.getRange(firstRow + 1, filterTypeColumn).setValue(origBotFilterType);
      sheet.getRange(firstRow + 1, filterOnValueColumn).setValue(origBotFilterOnValue);
      sheet.getRange(firstRow + 1, filterScopeColumn).setValue(origBotFilterScope);
      sheet.getRange(firstRow + 1, filterFieldColumn).setValue(origBotFilterField);
      sheet.getRange(firstRow + 1, filterValueColumn).setValue(origBotFilterValue);

      // Style: second row light grey for these columns (helper already does, but ensure)
      sheet.getRange(firstRow + 1, filterTypeColumn, 1, 1).setBackground("#f1f1f1");
      sheet.getRange(firstRow + 1, filterOnValueColumn, 1, 1).setBackground("#f1f1f1");
      sheet.getRange(firstRow + 1, filterScopeColumn, 1, 1).setBackground("#f1f1f1");
      sheet.getRange(firstRow + 1, filterFieldColumn, 1, 1).setBackground("#f1f1f1");
      sheet.getRange(firstRow + 1, filterValueColumn, 1, 1).setBackground("#f1f1f1");
      sheet.getRange(firstRow + 1, experimentEventNameColumn, 1, 1).setBackground("#f1f1f1");
      sheet.getRange(firstRow + 1, experimentVariantParameterColumn, 1, 1).setBackground("#f1f1f1");
    }

    // --- Re-enforce filter UI (order-independent with Variant Settings) ---
    // Keep the original Filter Yes/No value (it was copied with values),
    // then apply dropdowns/backgrounds to correct rows.
    if (typeof enforceFilterForBlock === 'function') {
      enforceFilterForBlock(sheet, firstRow);
    }

    if (typeof enforceEventValueForBlock === 'function') {
      enforceEventValueForBlock(sheet, firstRow);
    }

    // --- Row backgrounds & bottom border to match your layout ---
    sheet.getRange(firstRow + 1, 1, 1, sheet.getMaxColumns() - 1).setBackground('#f1f1f1'); // bottom row grey
    sheet.getRange(firstRow, 1, 2, editExperimentColumn)
         .setBorder(false, false, true, false, false, false, 'black', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

    idsCopied.push(Utilities.formatString("%02d", newID));

    // Adjust lastRow since we've inserted 2 rows at the top
    lastRow += 2;
  }

  if (idsCopied.length > 0) {
    SpreadsheetApp.getUi().alert("Copied experiments with new IDs: " + idsCopied.join(", "));
  } else {
    SpreadsheetApp.getUi().alert("No experiments were selected to copy.");
  }
}

function untickAllEditExperimentCheckboxes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(experimentSheetName); // adjust if needed
  const lastRow = sheet.getLastRow();

  let total = 0;
  let changed = 0;

  for (let r = firstRow; r <= lastRow; r += 2) {
    const cell = sheet.getRange(r, editExperimentColumn); // merged checkbox cell (top row of block)
    const dv = cell.getDataValidation();
    const isCheckbox = dv && dv.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.CHECKBOX;
    if (!isCheckbox) continue;

    total++;
    if (cell.getValue() === true) {
      cell.setValue(false);
      changed++;
    }
  }

  const msg =
    changed > 0
      ? `Unticked ${changed} checkbox${changed > 1 ? 'es' : ''} (out of ${total}).`
      : total > 0
        ? `All ${total} checkboxes were already unticked.`
        : `No checkboxes found.`;

  ss.toast(msg, "Edit Experiments", 4); // subtle toast for 4 seconds
}

function setAllAnalyzeToNo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(experimentSheetName); // adjust if needed
  const lastRow = sheet.getLastRow();

  let totalBlocks = 0;
  let changedYesToNo = 0;
  let alreadyNo = 0;

  for (let r = firstRow; r <= lastRow; r += 2) {
    const cell = sheet.getRange(r, analyzeTestColumn); // merged cell at top of 2-row block
    const val = String(cell.getValue() || "").trim().toLowerCase();

    totalBlocks++;
    if (val === "yes") changedYesToNo++;
    else if (val === "no" || val === "") alreadyNo++;

    // Set to "No" and keep your visual convention (light red)
    cell.setValue("No").setBackground("#ffcfc9");
  }

  const msg = `Analyze set to "No" for ${totalBlocks} block${totalBlocks !== 1 ? "s" : ""}. `
            + `Changed from Yes→No: ${changedYesToNo}. `
            + `Already "No": ${alreadyNo}.`;
  ss.toast(msg, "Analyze Experiment", 4);
}

function tickAllQueryInfoCheckboxes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(queryInfoSheetName);
  const lastRow = sheet.getLastRow();

  let total = 0;
  let changed = 0;

  for (let r = firstRow; r <= lastRow; r += 1) {
    const cell = sheet.getRange(r, 7);
    const dv = cell.getDataValidation();
    const isCheckbox = dv && dv.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.CHECKBOX;
    if (!isCheckbox) continue;

    total++;
    if (cell.getValue() === false) {
      cell.setValue(true);
      changed++;
    }
  }

  const msg =
    changed > 0
      ? `Ticked ${changed} checkbox${changed > 1 ? 'es' : ''}`
      : total > 0
        ? `All ${total} checkboxes were already ticked.`
        : `No checkboxes found.`;

  ss.toast(msg, "Query Info", 4); // subtle toast for 4 seconds
}
