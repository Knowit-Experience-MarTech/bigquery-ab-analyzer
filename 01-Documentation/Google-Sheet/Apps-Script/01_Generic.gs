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
    .addSubMenu(ui.createMenu('Settings')
      .addItem('Export AI Summary Settings', 'exportSettingsToBigQuery'))
    .addItem('Check for Updates', 'checkForUpdates')
    .addToUi();
}

// **** END MENU ****

const experimentSheetName = "Experiments";
const filtersSheetName = "Filters";
const funnelSheetName = "Funnels";
const calculatorSheetName = "Calculator";
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
  experimentEventNameColumn = 19,           // Column S - Experiment Event Name used in BQ
  experimentVariantParameterColumn = 20,    // Column T - Experiment Variant String used in BQ
  experimentEventValueParameterColumn = 21, // Column U - Experiment Value used in BQ
  userOverlapColumn = 22,                   // Column V - User Overlap
  funnelsColumn = 23,                       // Column W - Funnels
  aiTotalSampleSize = 24,                   // Column X - AI Total Sample Size
  linksColumn = 25,                         // Column Y - Links
  imagesColumn = 26,                        // Column Z - Images
  editExperimentColumn = 27;                // Column AA - Edit Experiment

function applyMergesForBlock(startRow) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(experimentSheetName);

  sheet.getRange(startRow, idColumn, 2, 1).merge();
  sheet.getRange(startRow, dateStartColumn, 2, 1).merge();
  sheet.getRange(startRow, dateEndColumn, 2, 1).merge();
  sheet.getRange(startRow, dateComparisonColumn, 2, 1).merge();
  sheet.getRange(startRow, experimentNameColumn, 2, 1).merge();
  sheet.getRange(startRow, conversionEventColumn, 2, 1).merge();
  sheet.getRange(startRow, conversionEventCountColumn, 2, 1).merge();
  sheet.getRange(startRow, analyzeTestColumn, 2, 1).merge();
  sheet.getRange(startRow, eventValueTestColumn, 2, 1).merge();
  sheet.getRange(startRow, hypothesisColumn, 2, 1).merge();
  sheet.getRange(startRow, confidenceColumn, 2, 1).merge();
  sheet.getRange(startRow, descriptionColumn, 2, 1).merge();
  sheet.getRange(startRow, scopeColumn, 2, 1).merge();
  sheet.getRange(startRow, identitySourceColumn, 2, 1).merge();
  sheet.getRange(startRow, variantSettingsColumn, 2, 1).merge();
  sheet.getRange(startRow, filterColumn, 2, 1).merge(); // Checkbox merge
  sheet.getRange(startRow, experimentEventNameColumn, 2, 1).merge();
  sheet.getRange(startRow, experimentVariantParameterColumn, 2, 1).merge();
  sheet.getRange(startRow, experimentEventValueParameterColumn, 2, 1).merge();
  sheet.getRange(startRow, userOverlapColumn, 2, 1).merge();
  sheet.getRange(startRow, aiTotalSampleSize, 2, 1).merge();
  sheet.getRange(startRow, linksColumn, 2, 1).merge();
  sheet.getRange(startRow, funnelsColumn, 2, 1).merge();
  sheet.getRange(startRow, editExperimentColumn, 2, 1).merge();
}

/**
 * Builds a data validation rule pointing to the named range "DropdownLookupEvents".
 * Shows a dropdown and disallows invalid values.
 */
/**
 * Builds a data validation rule pointing to the named range "DropdownLookupEvents".
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
 * Builds a data validation rule for Funnel Parameters
 * Pulls exclusively from "DropdownLookupFilterFields" where Scope = "Event"
 */
function getFunnelEventParamsRule() {
  const map = getFilterFieldsMap(); // Your existing helper function
  const eventParams = map.event || [];
  
  if (eventParams.length === 0) {
    return null; // Return nothing if the list is empty
  }
  
  return SpreadsheetApp.newDataValidation()
    .requireValueInList(eventParams, true)
    .setAllowInvalid(true) // Allows manual override just in case
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

function insertRowsAndMerge() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(experimentSheetName);

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

  // Insert a checkbox into merged Column Funnels and default to unchecked
  const funnelsCell = sheet.getRange(firstRow, funnelsColumn);
    funnelsCell.insertCheckboxes();
    funnelsCell.setValue(false);

  // Insert Checkbox for Filter
  const newFilterCell = sheet.getRange(firstRow, filterColumn);
    newFilterCell.insertCheckboxes();
    newFilterCell.setValue(false);

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

  // 4) Set up data validation (adjust columns as needed)
  const analyzeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Yes", "Update", "No"], true)
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
    .requireValueInList(["DEVICE_ID", "USER_ID_ONLY", "USER_ID_OR_DEVICE_ID", "EXP_DEVICE_ID"], true)
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
  sheet.getRange(firstRow, userOverlapColumn, 2, 1).setDataValidation(userOverLapRule);
  
  // Set default values for the merged drop-down cells
  
  sheet.getRange(firstRow, analyzeTestColumn).setValue("No").setBackground("#ffcfc9");
  sheet.getRange(firstRow, eventValueTestColumn).setValue("No");
  sheet.getRange(firstRow, hypothesisColumn).setValue("Two-sided");
  sheet.getRange(firstRow, confidenceColumn).setValue("95%");
  sheet.getRange(firstRow, scopeColumn).setValue("User");
  sheet.getRange(firstRow, identitySourceColumn).setValue("DEVICE_ID");
  sheet.getRange(firstRow, variantSettingsColumn).setValue("Same");
  sheet.getRange(firstRow, userOverlapColumn).setValue("Exclude");
  sheet.getRange(firstRow, aiTotalSampleSize).setValue(ss.getRangeByName("SettingsAITotalSampleSize").getValue());

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

function installedOnEdit(e) {
  if (!e || !e.range) return; 

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();
  const editedRange = e.range;
  const editedRow = editedRange.getRow();
  const editedCol = editedRange.getColumn();

  // ==========================================
  // 1. SETTINGS SHEET ROUTER
  // ==========================================
  const settingsCell = ss.getRangeByName('SettingsAnalyticsTool');
  if (settingsCell && sheetName === settingsCell.getSheet().getName()) {
    const inRow = editedRow >= settingsCell.getRow() && editedRow <= settingsCell.getLastRow();
    const inCol = editedCol >= settingsCell.getColumn() && editedCol <= settingsCell.getLastColumn();
    
    if (inRow && inCol) {
      updateAnalyticsToolText(e);
      return; // Handled settings, exit early
    }
  }

  // ==========================================
  // 3. EXPERIMENTS SHEET ROUTER
  // ==========================================
  if (sheetName === experimentSheetName) {

    // All subsequent checks only matter if we are below the header rows
    if (editedRow < firstRow) return;

    // --- Date Normalization ---
    if (editedCol === dateStartColumn || editedCol === dateEndColumn) {
      const v = editedRange.getValue();
      if (v instanceof Date) {
        const norm = new Date(v.getFullYear(), v.getMonth(), v.getDate());
        editedRange.setValue(norm).setNumberFormat("yyyy-MM-dd");
      }
    }

    // --- Toggle date merge when dateComparisonColumn checkbox is edited ---
    if (editedCol === dateComparisonColumn) {
      const topRow = ((editedRow - firstRow) % 2 === 0) ? editedRow : editedRow - 1;
      const isChecked = !!editedRange.getValue(); // TRUE = unmerge
      
      setDateMergeForBlock(sheet, topRow, !isChecked);
      colorDatesForBlock(sheet, topRow, isChecked);
      return;
    }

    // --- Identity Source Update ---
    if (editedCol === identitySourceColumn) {
      const topRow = ((editedRow - firstRow) % 2 === 0) ? editedRow : editedRow - 1;
      enforceScopeForIdentitySource(sheet, topRow);
      return; 
    }

    // --- Generate Variant String ---
    if (editedCol === experimentNameColumn || editedCol === variantNameColumn) {
      const genSetting = ss.getRangeByName("SettingsGenerateExpVariantString").getValue();
      if (String(genSetting).toLowerCase() === "yes") {
        let parts = [];
        const toolNameInclude = ss.getRangeByName("SettingsToolNameInclude").getValue();
        const divider = ss.getRangeByName("SettingsDivider").getValue();
        
        if (String(toolNameInclude).toLowerCase() === "yes") {
          const toolName = ss.getRangeByName("SettingsToolName").getValue();
          if (toolName !== "" && toolName !== null) parts.push(toolName);
        }
        
        const topRow = ((editedRow - firstRow) % 2 === 0) ? editedRow : editedRow - 1;
        const valueD = sheet.getRange(topRow, experimentNameColumn).getValue();
        if (valueD !== "" && valueD !== null) parts.push(valueD);
        
        const valueE = sheet.getRange(editedRow, variantNameColumn).getValue();
        if (valueE !== "" && valueE !== null) parts.push(valueE);
        
        sheet.getRange(editedRow, experimentVariantParameterColumn).setValue(parts.join(divider));
      }
    }

    // --- Analyze Test Colors ---
    if (editedCol === analyzeTestColumn) {
      const v = String(e.range.getValue() || "");
      if (v === "Yes") e.range.setBackground("#d4edbc"); // green
      else if (v === "Update") e.range.setBackground("#fff7bf"); // light yellow
      else if (v === "No") e.range.setBackground("#ffcfc9"); // light red
      else e.range.setBackground(null);
    }

    // --- Event Value Test Colors & UI Update ---
    if (editedCol === eventValueTestColumn) {
      const val = String(e.range.getValue() || "");
      if (val === "Yes") e.range.setBackground("#eafcd7");
      else e.range.setBackground(null);

      const topRow = ((editedRow - firstRow) % 2 === 0) ? editedRow : editedRow - 1;
      enforceEventValueForBlock(sheet, topRow);
      return;
    }

    // --- Toggle per-variant settings (Same/Different) ---
    if (editedCol === variantSettingsColumn) {
      const topRow = ((editedRow - firstRow) % 2 === 0) ? editedRow : editedRow - 1;
      enforceVariantSettingsForBlock(sheet, topRow);
      enforceEventValueForBlock(sheet, topRow);
      return;
    }

    // --- Filter Toggle (Dialog Trigger & Status Indicator) ---
    if (editedCol === filterColumn) {
      const topRow = ((editedRow - firstRow) % 2 === 0) ? editedRow : editedRow - 1;
      
      // 1. Snap back the checkbox
      const wasChecked = e.oldValue ? (String(e.oldValue).toLowerCase() === 'true') : false;
      sheet.getRange(topRow, filterColumn).setValue(wasChecked);
      
      // 2. Grab the ID
      const expId = String(sheet.getRange(topRow, idColumn).getValue() || "").trim() || 
                    String(sheet.getRange(topRow, experimentNameColumn).getValue() || "").trim() || 
                    String(topRow);
                    
      if (expId) {
        // We will build this function next!
        openFilterModal(expId); 
      } else {
        ss.toast("Could not find an Experiment ID for this row.", "Error", 5);
      }
      return;
    }

    // --- Funnels Toggle (Dialog Trigger & Status Indicator) ---
    if (editedCol === funnelsColumn) {
      const topRow = ((editedRow - firstRow) % 2 === 0) ? editedRow : editedRow - 1;
      
      // 1. Immediately revert the checkbox so it acts as a status indicator, not an input.
      // If oldValue is undefined (rare, but happens on fresh rows), default to false.
      const wasChecked = e.oldValue ? (String(e.oldValue).toLowerCase() === 'true') : false;
      sheet.getRange(topRow, funnelsColumn).setValue(wasChecked);
      
      // 2. Grab the ID. Fall back to Experiment Name or Row Number
      const expId = String(sheet.getRange(topRow, idColumn).getValue() || "").trim() || 
                    String(sheet.getRange(topRow, experimentNameColumn).getValue() || "").trim() || 
                    String(topRow);
                    
      if (expId) {
        openFunnelModal(expId);
      } else {
        ss.toast("Could not find an Experiment ID for this row.", "Error", 5);
      }
      return;
    }
  }

if (sheetName === calculatorSheetName) {
    
    // 3. Check if the edit happened in Column D (Column 4) AND Row 27 or below
    if (editedRange.getColumn() === 4 && editedRange.getRow() >= 27) {
      
      const scopeValue = e.value; // What the user just selected in Column D
      const targetCell = sheet.getRange(editedRange.getRow(), 5); // The adjacent cell in Column E
      
      // If the user deleted the scope, clear the field dropdown and stop
      if (!scopeValue) {
        targetCell.clearDataValidations().clearContent();
        return;
      }
      
      // Fetch the mapping from Lookup_Filter_Fields
      const ss = e.source;
      const lookupSheet = ss.getSheetByName("Lookup_Filter_Fields");
      const lastRow = lookupSheet.getLastRow();
      
      if (lastRow < 2) return; // Exit if the lookup sheet is empty
      
      const lookupData = lookupSheet.getRange(2, 1, lastRow - 1, 2).getValues();
      
      // Filter the fields that match the selected Scope
      const validFields = [];
      for (let i = 0; i < lookupData.length; i++) {
        if (lookupData[i][0] === scopeValue && lookupData[i][1] !== "") {
          validFields.push(lookupData[i][1]);
        }
      }
      
      // Apply the new dynamic dropdown to Column E
      if (validFields.length > 0) {
        const rule = SpreadsheetApp.newDataValidation().requireValueInList(validFields, true).build();
        targetCell.setDataValidation(rule);
        
        // Safety check: If the user changes D, but E already has an old value, 
        // clear E so they don't accidentally query a mismatched Event/Column combo.
        const currentValue = targetCell.getValue();
        if (validFields.indexOf(currentValue) === -1) {
          targetCell.clearContent();
        }
      } else {
        targetCell.clearDataValidations().clearContent();
      }
    }
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
    experimentEventNameColumn,
    experimentVariantParameterColumn,
    experimentEventValueParameterColumn
  ];

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
  } else if (val === 'ga4dataform') {
    messageCellDataSet.setValue('Data Set ID: superform_outputs_12345 (replace 12345 with your ID).');
    messageCellTable.setValue('Table ID: ga4_events');
  } else if (val === 'amplitude') {
    messageCellDataSet.setValue('Data Set ID: What you called your Amplitude Data Set, ex. amplitude).');
    messageCellTable.setValue('Table ID: EVENTS_12345 (replace 12345 with your ID)');
  } else if (val === 'mixpanel') {
    messageCellDataSet.setValue('Data Set ID: What you called your Mixpanel Data Set, ex. mixpanel).');
    messageCellTable.setValue('Table ID: mp_master_event');
  } else if (val === 'posthog') {
    messageCellDataSet.setValue('Data Set ID: What you called your PostHog Data Set, ex. posthog).');
    messageCellTable.setValue('Table ID: events');
  } else {
    messageCellDataSet.clearContent();
    messageCellTable.clearContent();
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
    const oldID = sheet.getRange(r, idColumn).getValue();

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
    const origTop_expEventName = sheet.getRange(r, experimentEventNameColumn).getValue();
    const origTop_expVariantParam = sheet.getRange(r, experimentVariantParameterColumn).getValue();

    const origBotConversionEvent = sheet.getRange(r + 1, conversionEventColumn).getValue();
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

    if (oldID) {
      copyFunnelsForExperiment(oldID, newID);
      copyFiltersForExperiment(oldID, newID);
    }

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

    if (typeof enforceScopeForIdentitySource === 'function') {
      enforceScopeForIdentitySource(sheet, firstRow);
    }

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

      // Bottom row (B)
      sheet.getRange(firstRow + 1, experimentEventNameColumn).setValue(origBot_expEventName);
      sheet.getRange(firstRow + 1, experimentVariantParameterColumn).setValue(origBot_expVariantParam);
      sheet.getRange(firstRow + 1, conversionEventColumn).setValue(origBotConversionEvent);

      // Style: second row light grey for these columns (helper already does, but ensure)
      sheet.getRange(firstRow + 1, experimentEventNameColumn, 1, 1).setBackground("#f1f1f1");
      sheet.getRange(firstRow + 1, experimentVariantParameterColumn, 1, 1).setBackground("#f1f1f1");
    }

    // --- Re-enforce filter UI (order-independent with Variant Settings) ---
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

// ==========================================
// FUNNEL MODAL BACKEND
// ==========================================

function openFunnelModal(expId) {
  const html = HtmlService.createTemplateFromFile('FunnelModal');
  
  // Pass the variables directly to the HTML template object
  html.experimentId = expId; 
  html.funnelData = getFunnelModalData(expId); 
  
  const page = html.evaluate()
      .setTitle('Edit Funnel: ' + expId)
      .setWidth(650) 
      .setHeight(600);
      
  SpreadsheetApp.getUi().showModelessDialog(page, 'Edit Funnel: ' + expId);
}

function getFunnelModalData(expId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const funnelsSheet = ss.getSheetByName(funnelSheetName);
  
  // 1. Fetch Existing Steps for this Experiment
  let steps = [];
  const lastRow = funnelsSheet.getLastRow();
  
  if (lastRow >= 5) {
    // Read columns A through G
    const data = funnelsSheet.getRange(5, 1, lastRow - 4, 7).getValues();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(expId).trim()) {
        steps.push({
          stepNum: parseInt(data[i][1]) || 1,
          variant: data[i][2] || "Both",
          eventName: data[i][3] || "",
          filterOn: data[i][4] === true || String(data[i][4]).toLowerCase() === 'true',
          filterField: data[i][5] || "",
          filterValue: data[i][6] || "" // Added Column G
        });
      }
    }
  }

  // If no steps exist, provide a default Step 1
  if (steps.length === 0) {
    steps.push({ stepNum: 1, variant: "Both", eventName: "", filterOn: false, filterField: "", filterValue: "" });
  } else {
    // Sort steps numerically just in case they got jumbled in the sheet
    steps.sort((a, b) => a.stepNum - b.stepNum); 
  }

  // 2. Fetch Dropdown Options
  let events = [];
  try {
    const eventsRange = ss.getRangeByName('DropdownLookupEvents');
    if (eventsRange) events = eventsRange.getValues().map(r => r[0]).filter(String);
  } catch(e) {}

  let filterFields = [];
  try {
    const filterFieldsMap = getFilterFieldsMap();
    if (filterFieldsMap && filterFieldsMap.event) filterFields = filterFieldsMap.event;
  } catch(e) {}

  return {
    steps: steps,
    events: events,
    filterFields: filterFields
  };
}

function saveFunnelModalData(expId, stepsArray) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const funnelsSheet = ss.getSheetByName(funnelSheetName);
  const expSheet = ss.getSheetByName(experimentSheetName);
  
  if (!funnelsSheet || !expSheet) return "Error: Sheets not found.";

  // 1. Delete all existing rows for this specific experiment ID in the Funnels sheet
  const lastRow = funnelsSheet.getLastRow();
  if (lastRow >= 5) {
    const ids = funnelsSheet.getRange(5, 1, lastRow - 4, 1).getValues();
    for (let i = ids.length - 1; i >= 0; i--) {
      if (String(ids[i][0]).trim() === String(expId).trim()) {
        funnelsSheet.deleteRow(i + 5); 
      }
    }
  }

  // 2. Insert the updated steps
  const hasFunnel = stepsArray && stepsArray.length > 0;
  
  if (hasFunnel) {
    stepsArray.sort((a, b) => parseInt(a.stepNum) - parseInt(b.stepNum));
    
    const newData = stepsArray.map(step => [
      expId,
      parseInt(step.stepNum),
      step.variant,
      step.eventName,
      step.filterOn,
      step.filterField,
      step.filterValue || "" 
    ]);

    const insertRow = Math.max(5, funnelsSheet.getLastRow() + 1);
    funnelsSheet.getRange(insertRow, 1, newData.length, newData[0].length).setValues(newData);
    
    for (let i = 0; i < newData.length; i++) {
      const bgColor = ((insertRow + i) % 2 !== 0) ? '#ffffff' : '#f1f1f1';
      funnelsSheet.getRange(insertRow + i, 1, 1, funnelsSheet.getMaxColumns()).setBackground(bgColor).setFontColor('#000000');
    }
  }
  
  // 3. Update the Checkbox Status in the Experiments Sheet
  const expLastRow = expSheet.getLastRow();
  if (expLastRow >= firstRow) {
    // Read the IDs to find which row triggered this save
    const expIds = expSheet.getRange(firstRow, idColumn, expLastRow - firstRow + 1, 1).getValues();
    const expNames = expSheet.getRange(firstRow, experimentNameColumn, expLastRow - firstRow + 1, 1).getValues();
    
    for (let r = 0; r < expIds.length; r++) {
      const rowNum = firstRow + r;
      
      // Only check the top row of the 2-row blocks
      if ((rowNum - firstRow) % 2 !== 0) continue; 
      
      const currentId = String(expIds[r][0] || "").trim();
      const currentName = String(expNames[r][0] || "").trim();
      
      // If we found the row, check or uncheck the box based on whether steps exist
      if (currentId === String(expId).trim() || currentName === String(expId).trim()) {
        expSheet.getRange(rowNum, funnelsColumn).setValue(hasFunnel);
        break;
      }
    }
  }
  
  return "Success";
}

// ==========================================
// FILTER MODAL BACKEND
// ==========================================

function openFilterModal(expId) {
  const html = HtmlService.createTemplateFromFile('FilterModal');
  
  html.experimentId = expId; 
  html.filterData = getFilterModalData(expId); 
  
  const page = html.evaluate()
      .setTitle('Edit Filters: ' + expId)
      .setWidth(650)  
      .setHeight(500); 
      
  SpreadsheetApp.getUi().showModelessDialog(page, 'Edit Filters: ' + expId);
}

function getFilterModalData(expId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const filterSheet = ss.getSheetByName(filtersSheetName);
  
  let filters = [];
  const lastRow = filterSheet ? filterSheet.getLastRow() : 0;
  
  if (lastRow >= 2) {
    const data = filterSheet.getRange(2, 1, lastRow - 1, 7).getValues();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(expId).trim()) {
        filters.push({
          variant: data[i][1] || "Both", 
          type: data[i][2] || "Include",
          onValue: data[i][3] || "Both",
          scope: data[i][4] || "Event",
          field: data[i][5] || "",
          value: data[i][6] || ""
        });
      }
    }
  }

  let fieldsMap = { event: [], user: [], column: [] };
  try {
    fieldsMap = getFilterFieldsMap();
  } catch(e) {}

  return {
    filters: filters,
    fieldsMap: fieldsMap
  };
}

function saveFilterModalData(expId, filtersArray) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const filterSheet = ss.getSheetByName(filtersSheetName);
  const expSheet = ss.getSheetByName(experimentSheetName);
  
  if (!filterSheet || !expSheet) return "Error: Sheets not found.";

  const lastRow = filterSheet.getLastRow();
  if (lastRow >= 2) {
    const ids = filterSheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = ids.length - 1; i >= 0; i--) {
      if (String(ids[i][0]).trim() === String(expId).trim()) {
        filterSheet.deleteRow(i + 2); 
      }
    }
  }

  const hasFilters = filtersArray && filtersArray.length > 0;
  
  if (hasFilters) {
    const newData = filtersArray.map(f => [
      expId,
      f.variant || "Both", 
      f.type,
      f.onValue,
      f.scope,
      f.field,
      f.value || ""
    ]);

    const insertRow = Math.max(2, filterSheet.getLastRow() + 1);
    filterSheet.getRange(insertRow, 1, newData.length, 7).setValues(newData);
    
    for (let i = 0; i < newData.length; i++) {
      const bgColor = ((insertRow + i) % 2 !== 0) ? '#f1f1f1' : '#ffffff';
      filterSheet.getRange(insertRow + i, 1, 1, 7).setBackground(bgColor).setFontColor('#000000');
    }
  }
  
  const expLastRow = expSheet.getLastRow();
  if (expLastRow >= firstRow) {
    const expIds = expSheet.getRange(firstRow, idColumn, expLastRow - firstRow + 1, 1).getValues();
    const expNames = expSheet.getRange(firstRow, experimentNameColumn, expLastRow - firstRow + 1, 1).getValues();
    
    for (let r = 0; r < expIds.length; r++) {
      const rowNum = firstRow + r;
      if ((rowNum - firstRow) % 2 !== 0) continue; 
      
      const currentId = String(expIds[r][0] || "").trim();
      const currentName = String(expNames[r][0] || "").trim();
      
      if (currentId === String(expId).trim() || currentName === String(expId).trim()) {
        expSheet.getRange(rowNum, filterColumn).setValue(hasFilters); 
        break;
      }
    }
  }
  
  return "Success";
}

// ==========================================
// COPY HELPERS FOR FUNNELS & FILTERS
// ==========================================

function copyFunnelsForExperiment(oldId, newId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const funnelsSheet = ss.getSheetByName(funnelSheetName);
  if (!funnelsSheet) return;
  
  const lastRow = funnelsSheet.getLastRow();
  if (lastRow < 5) return; // No funnels exist
  
  const data = funnelsSheet.getRange(5, 1, lastRow - 4, 7).getValues();
  const rowsToCopy = [];
  const oldIdStr = String(oldId).trim();
  
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === oldIdStr) {
      const newRow = [...data[i]]; // Clone the array row
      newRow[0] = newId;           // Replace the old ID with the new ID
      rowsToCopy.push(newRow);
    }
  }
  
  if (rowsToCopy.length > 0) {
    const insertRow = Math.max(5, funnelsSheet.getLastRow() + 1);
    funnelsSheet.getRange(insertRow, 1, rowsToCopy.length, 7).setValues(rowsToCopy);
    
    for (let i = 0; i < rowsToCopy.length; i++) {
      const bgColor = ((insertRow + i) % 2 !== 0) ? '#ffffff' : '#f1f1f1';
      funnelsSheet.getRange(insertRow + i, 1, 1, 7).setBackground(bgColor).setFontColor('#000000');
    }
  }
}

function copyFiltersForExperiment(oldId, newId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const filterSheet = ss.getSheetByName(filtersSheetName);
  if (!filterSheet) return;
  
  const lastRow = filterSheet.getLastRow();
  if (lastRow < 2) return; // No filters exist
  
  const data = filterSheet.getRange(2, 1, lastRow - 1, 7).getValues();
  const rowsToCopy = [];
  const oldIdStr = String(oldId).trim();
  
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === oldIdStr) {
      const newRow = [...data[i]]; // Clone the array row
      newRow[0] = newId;           // Replace the old ID with the new ID
      rowsToCopy.push(newRow);
    }
  }
  
  if (rowsToCopy.length > 0) {
    const insertRow = Math.max(2, filterSheet.getLastRow() + 1);
    filterSheet.getRange(insertRow, 1, rowsToCopy.length, 7).setValues(rowsToCopy);
    
    for (let i = 0; i < rowsToCopy.length; i++) {
      const bgColor = ((insertRow + i) % 2 !== 0) ? '#f1f1f1' : '#ffffff';
      filterSheet.getRange(insertRow + i, 1, 1, 7).setBackground(bgColor).setFontColor('#000000');
    }
  }
}