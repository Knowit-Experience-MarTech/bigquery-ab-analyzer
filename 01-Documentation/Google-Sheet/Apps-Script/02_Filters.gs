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
      .setHeight(600); 
      
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
          variant: data[i][1] || "Both", // <-- Added Variant mapping (Col B)
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
      f.variant || "Both", // <-- Now saving the chosen Variant dynamically
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
        expSheet.getRange(rowNum, 18).setValue(hasFilters); 
        break;
      }
    }
  }
  
  return "Success";
}